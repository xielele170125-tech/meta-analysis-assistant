import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { 
  LLMProvider,
  createLLMAdapter, 
  getDefaultConfig, 
  getAvailableModels,
  getProviderDisplayName 
} from '@/lib/llm/adapter';

/**
 * 获取所有LLM配置
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const client = getSupabaseClient();

    // 获取提供商信息
    if (action === 'providers') {
      const providers: LLMProvider[] = ['deepseek', 'openai', 'claude', 'qwen', 'zhipu', 'kimi', 'custom'];
      const providerInfo = providers.map(p => ({
        id: p,
        name: getProviderDisplayName(p),
        defaultConfig: getDefaultConfig(p),
        availableModels: getAvailableModels(p),
      }));
      return NextResponse.json({ providers: providerInfo });
    }

    // 获取使用统计
    if (action === 'usage') {
      const configId = searchParams.get('configId');
      let query = client
        .from('llm_usage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (configId) {
        query = query.eq('config_id', configId);
      }
      
      const { data: logs } = await query;
      
      // 汇总统计
      const stats = (logs || []).reduce((acc: {
        totalRequests: number;
        totalTokens: number;
        totalPromptTokens: number;
        totalCompletionTokens: number;
        successCount: number;
        failureCount: number;
      }, log: Record<string, unknown>) => {
        acc.totalRequests += 1;
        acc.totalTokens += (log.total_tokens as number) || 0;
        acc.totalPromptTokens += (log.prompt_tokens as number) || 0;
        acc.totalCompletionTokens += (log.completion_tokens as number) || 0;
        if (log.is_success) acc.successCount += 1;
        else acc.failureCount += 1;
        return acc;
      }, {
        totalRequests: 0,
        totalTokens: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        successCount: 0,
        failureCount: 0,
      });

      return NextResponse.json({ logs, stats });
    }

    // 获取配置列表
    const { data: configs } = await client
      .from('llm_configs')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    // 隐藏API密钥的敏感部分
    const safeConfigs = (configs || []).map((config: Record<string, unknown>) => ({
      ...config,
      api_key: config.api_key ? `${(config.api_key as string).slice(0, 8)}...${(config.api_key as string).slice(-4)}` : '',
    }));

    return NextResponse.json({ configs: safeConfigs });
  } catch (error) {
    console.error('Error fetching LLM configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LLM configs' },
      { status: 500 }
    );
  }
}

/**
 * 创建或更新LLM配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id,
      name, 
      provider, 
      apiKey, 
      baseUrl, 
      model, 
      temperature, 
      maxTokens,
      isDefault,
      isEnabled,
    } = body;
    const client = getSupabaseClient();

    if (!name || !provider || !apiKey || !model) {
      return NextResponse.json(
        { error: 'Missing required fields: name, provider, apiKey, model' },
        { status: 400 }
      );
    }

    // 如果设置为默认，先清除其他默认配置
    if (isDefault) {
      await client
        .from('llm_configs')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    if (id) {
      // 更新现有配置
      const { data: updated, error } = await client
        .from('llm_configs')
        .update({
          name,
          provider,
          api_key: apiKey,
          base_url: baseUrl,
          model,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 4096,
          is_default: isDefault ?? false,
          is_enabled: isEnabled ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select();

      if (error) throw error;

      return NextResponse.json({ 
        config: {
          ...updated?.[0],
          api_key: `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`,
        }
      });
    } else {
      // 创建新配置
      const { data: created, error } = await client
        .from('llm_configs')
        .insert({
          name,
          provider,
          api_key: apiKey,
          base_url: baseUrl,
          model,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 4096,
          is_default: isDefault ?? false,
          is_enabled: isEnabled ?? true,
        })
        .select();

      if (error) throw error;

      return NextResponse.json({ 
        config: {
          ...created?.[0],
          api_key: `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`,
        }
      });
    }
  } catch (error) {
    console.error('Error saving LLM config:', error);
    return NextResponse.json(
      { error: 'Failed to save LLM config' },
      { status: 500 }
    );
  }
}

/**
 * 删除LLM配置
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const client = getSupabaseClient();

    if (!id) {
      return NextResponse.json(
        { error: 'Missing config ID' },
        { status: 400 }
      );
    }

    await client.from('llm_configs').delete().eq('id', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting LLM config:', error);
    return NextResponse.json(
      { error: 'Failed to delete LLM config' },
      { status: 500 }
    );
  }
}

/**
 * 测试LLM配置
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { configId, testMessage } = body;
    const client = getSupabaseClient();

    if (!configId) {
      return NextResponse.json(
        { error: 'Missing config ID' },
        { status: 400 }
      );
    }

    // 获取配置
    const { data: configs } = await client
      .from('llm_configs')
      .select('*')
      .eq('id', configId)
      .limit(1);

    if (!configs || configs.length === 0) {
      return NextResponse.json(
        { error: 'Config not found' },
        { status: 404 }
      );
    }

    const llmConfig = configs[0] as Record<string, unknown>;

    // 创建适配器并测试
    const adapter = createLLMAdapter({
      provider: llmConfig.provider as LLMProvider,
      apiKey: llmConfig.api_key as string,
      baseUrl: (llmConfig.base_url as string) || undefined,
      model: llmConfig.model as string,
      temperature: (llmConfig.temperature as number) ?? 0.7,
      maxTokens: (llmConfig.max_tokens as number) ?? 4096,
    });

    const startTime = Date.now();
    let success = false;
    let errorMessage = '';
    let response: { content: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } } | null = null;

    try {
      response = await adapter.chat([
        { role: 'user', content: testMessage || 'Hello, this is a test message. Please respond with "OK".' }
      ]);
      success = true;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Unknown error';
    }

    const responseTime = Date.now() - startTime;

    // 记录使用日志
    await client.from('llm_usage_logs').insert({
      config_id: llmConfig.id,
      usage_type: 'test',
      prompt_tokens: response?.usage?.promptTokens,
      completion_tokens: response?.usage?.completionTokens,
      total_tokens: response?.usage?.totalTokens,
      is_success: success,
      error_message: errorMessage || null,
      response_time: responseTime,
    });

    if (!success) {
      return NextResponse.json(
        { error: `Test failed: ${errorMessage}`, responseTime },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      response: response?.content,
      usage: response?.usage,
      responseTime,
    });
  } catch (error) {
    console.error('Error testing LLM config:', error);
    return NextResponse.json(
      { error: 'Failed to test LLM config' },
      { status: 500 }
    );
  }
}
