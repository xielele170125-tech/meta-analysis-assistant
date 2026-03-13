/**
 * LLM服务 - 提供统一的LLM调用接口
 * 自动使用默认配置或指定配置进行调用
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  LLMProvider,
  ChatMessage,
  LLMResponse,
  createLLMAdapter,
} from './adapter';

export type UsageType = 'extraction' | 'classification' | 'quality_assessment' | 'network_analysis' | 'dimension_recommendation';

/**
 * 获取默认LLM配置
 */
export async function getDefaultLLMConfig() {
  const client = getSupabaseClient();
  const { data: configs, error } = await client
    .from('llm_configs')
    .select('*')
    .eq('is_default', true)
    .eq('is_enabled', true)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch LLM config: ${error.message}`);
  }

  if (!configs || configs.length === 0) {
    throw new Error('No default LLM config found. Please configure an LLM provider in settings.');
  }

  return configs[0];
}

/**
 * 获取指定ID的LLM配置
 */
export async function getLLMConfigById(configId: string) {
  const client = getSupabaseClient();
  const { data: configs, error } = await client
    .from('llm_configs')
    .select('*')
    .eq('id', configId)
    .eq('is_enabled', true)
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch LLM config: ${error.message}`);
  }

  if (!configs || configs.length === 0) {
    throw new Error(`LLM config not found: ${configId}`);
  }

  return configs[0];
}

/**
 * 使用指定配置调用LLM
 */
export async function callLLM(
  messages: ChatMessage[],
  options?: {
    configId?: string;
    usageType?: UsageType;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<LLMResponse> {
  const startTime = Date.now();
  const client = getSupabaseClient();
  
  // 获取配置
  const config = options?.configId
    ? await getLLMConfigById(options.configId)
    : await getDefaultLLMConfig();

  // 创建适配器
  const adapter = createLLMAdapter({
    provider: config.provider as LLMProvider,
    apiKey: config.api_key as string,
    baseUrl: (config.base_url as string) || undefined,
    model: config.model as string,
    temperature: options?.temperature ?? (config.temperature as number) ?? 0.7,
    maxTokens: options?.maxTokens ?? (config.max_tokens as number) ?? 4096,
  });

  let response: LLMResponse | null = null;
  let success = true;
  let errorMessage = '';

  try {
    response = await adapter.chat(messages);
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  } finally {
    // 记录使用日志
    const responseTime = Date.now() - startTime;
    await client.from('llm_usage_logs').insert({
      config_id: config.id,
      usage_type: options?.usageType || 'extraction',
      prompt_tokens: response?.usage?.promptTokens,
      completion_tokens: response?.usage?.completionTokens,
      total_tokens: response?.usage?.totalTokens,
      is_success: success,
      error_message: errorMessage || null,
      response_time: responseTime,
    });
  }

  return response;
}

/**
 * 使用指定配置流式调用LLM
 */
export async function streamLLM(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  options?: {
    configId?: string;
    usageType?: UsageType;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<void> {
  const startTime = Date.now();
  const client = getSupabaseClient();
  
  // 获取配置
  const config = options?.configId
    ? await getLLMConfigById(options.configId)
    : await getDefaultLLMConfig();

  // 创建适配器
  const adapter = createLLMAdapter({
    provider: config.provider as LLMProvider,
    apiKey: config.api_key as string,
    baseUrl: (config.base_url as string) || undefined,
    model: config.model as string,
    temperature: options?.temperature ?? (config.temperature as number) ?? 0.7,
    maxTokens: options?.maxTokens ?? (config.max_tokens as number) ?? 4096,
  });

  let success = true;
  let errorMessage = '';

  try {
    await adapter.streamChat(messages, onChunk);
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  } finally {
    // 记录使用日志
    const responseTime = Date.now() - startTime;
    await client.from('llm_usage_logs').insert({
      config_id: config.id,
      usage_type: options?.usageType || 'extraction',
      is_success: success,
      error_message: errorMessage || null,
      response_time: responseTime,
    });
  }
}

/**
 * 快速调用DeepSeek（兼容旧代码）
 * 保持向后兼容性，同时支持使用配置的模型
 */
export async function callDeepSeek(
  messages: ChatMessage[],
  model: 'deepseek-chat' | 'deepseek-reasoner' = 'deepseek-chat'
): Promise<LLMResponse> {
  try {
    // 尝试使用配置的LLM
    return await callLLM(messages, { usageType: 'extraction' });
  } catch {
    // 如果没有配置，尝试使用环境变量中的DeepSeek配置
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('No LLM configuration found. Please configure an LLM provider in settings.');
    }

    const adapter = createLLMAdapter({
      provider: 'deepseek',
      apiKey,
      model,
    });

    return await adapter.chat(messages);
  }
}

/**
 * 批量调用LLM（用于处理大量文献）
 */
export async function batchCallLLM<T>(
  items: T[],
  processor: (item: T) => Promise<ChatMessage[]>,
  options?: {
    configId?: string;
    usageType?: UsageType;
    concurrency?: number;
  }
): Promise<Map<T, LLMResponse>> {
  const results = new Map<T, LLMResponse>();
  const concurrency = options?.concurrency ?? 5;

  // 分批处理
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const promises = batch.map(async (item) => {
      const messages = await processor(item);
      const response = await callLLM(messages, options);
      return { item, response };
    });

    const batchResults = await Promise.all(promises);
    for (const { item, response } of batchResults) {
      results.set(item, response);
    }
  }

  return results;
}
