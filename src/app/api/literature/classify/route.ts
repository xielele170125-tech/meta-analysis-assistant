import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const client = getSupabaseClient();

/**
 * 获取所有分类维度
 * GET /api/literature/classify
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // 获取分类维度列表
    if (action === 'dimensions') {
      const { data, error } = await client
        .from('classification_dimensions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // 获取文献分类结果
    if (action === 'results') {
      const dimensionId = searchParams.get('dimensionId');
      
      let query = client
        .from('literature_classifications')
        .select(`
          *,
          literature:literature_id(id, title, authors, year, doi),
          dimension:dimension_id(id, name)
        `);
      
      if (dimensionId) {
        query = query.eq('dimension_id', dimensionId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // 获取分类统计
    if (action === 'stats') {
      const { data: dimensions, error: dimError } = await client
        .from('classification_dimensions')
        .select('*');

      if (dimError) throw dimError;

      const stats = await Promise.all(
        (dimensions || []).map(async (dim) => {
          const { data: classifications, error } = await client
            .from('literature_classifications')
            .select('category, literature_id')
            .eq('dimension_id', dim.id);

          const categoryCounts: Record<string, number> = {};
          (classifications || []).forEach((c) => {
            const cat = c.category || '未分类';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
          });

          return {
            ...dim,
            totalClassified: (classifications || []).length,
            categoryCounts,
          };
        })
      );

      return NextResponse.json({ success: true, data: stats });
    }

    return NextResponse.json({ error: '无效的action参数' }, { status: 400 });
  } catch (error) {
    console.error('Classification GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}

/**
 * 创建分类维度或执行AI分类
 * POST /api/literature/classify
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, apiKey } = body;

    // 创建/更新分类维度
    if (action === 'create_dimension') {
      const { name, description, categories } = body;

      const { data, error } = await client
        .from('classification_dimensions')
        .insert({ name, description, categories })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // 删除分类维度
    if (action === 'delete_dimension') {
      const { dimensionId } = body;

      const { error } = await client
        .from('classification_dimensions')
        .delete()
        .eq('id', dimensionId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // 执行AI分类
    if (action === 'classify') {
      const { dimensionId, literatureIds } = body;

      if (!apiKey) {
        return NextResponse.json({ error: '请提供API Key' }, { status: 400 });
      }

      // 获取分类维度
      const { data: dimension, error: dimError } = await client
        .from('classification_dimensions')
        .select('*')
        .eq('id', dimensionId)
        .single();

      if (dimError || !dimension) {
        return NextResponse.json({ error: '分类维度不存在' }, { status: 404 });
      }

      // 获取待分类的文献（不限制状态，只要有内容就行）
      let query = client
        .from('literature')
        .select('id, title, raw_content, authors, year, doi, journal');

      if (literatureIds && literatureIds.length > 0) {
        query = query.in('id', literatureIds);
      }

      const { data: literatureList, error: litError } = await query;

      if (litError) {
        console.error('[Classify] Query error:', litError);
        throw litError;
      }

      // 过滤出有标题的文献
      const validLiterature = (literatureList || []).filter(lit => lit.title);

      if (validLiterature.length === 0) {
        return NextResponse.json({ 
          error: '没有可分类的文献，请先导入文献', 
          classified: 0 
        }, { status: 400 });
      }

      console.log(`[Classify] Found ${validLiterature.length} literature for classification`);

      // 批量分类（每批 15 篇文献）
      const BATCH_SIZE = 15;
      const results: Array<{
        literatureId: string;
        title: string;
        category: string;
        confidence: number;
      }> = [];

      // 准备文献数据
      const literatureData = validLiterature.map(lit => {
        let content = '';
        if (lit.raw_content) {
          try {
            const raw = JSON.parse(lit.raw_content);
            content = raw.abstract || lit.raw_content;
          } catch {
            content = lit.raw_content;
          }
        }
        return {
          id: lit.id,
          title: lit.title || '',
          content,
          authors: lit.authors,
          year: lit.year,
        };
      }).filter(lit => lit.title);

      // 分批处理
      const totalBatches = Math.ceil(literatureData.length / BATCH_SIZE);
      console.log(`[Classify] Processing ${literatureData.length} literature in ${totalBatches} batches`);

      for (let i = 0; i < literatureData.length; i += BATCH_SIZE) {
        const batch = literatureData.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        console.log(`[Classify] Processing batch ${batchNum}/${totalBatches} (${batch.length} literature)`);

        try {
          const batchResults = await batchClassifyLiterature(apiKey, dimension, batch);

          // 批量保存分类结果
          const upsertData = batchResults.map(r => ({
            literature_id: r.literatureId,
            dimension_id: dimensionId,
            category: r.category,
            confidence: r.confidence,
            evidence: r.evidence,
          }));

          const { error: upsertError } = await client
            .from('literature_classifications')
            .upsert(upsertData, { onConflict: 'literature_id,dimension_id' });

          if (upsertError) {
            console.error(`[Classify] Batch ${batchNum} upsert error:`, upsertError);
          }

          // 添加到结果列表
          batchResults.forEach(r => {
            const lit = validLiterature.find(l => l.id === r.literatureId);
            results.push({
              literatureId: r.literatureId,
              title: lit?.title || '',
              category: r.category,
              confidence: r.confidence,
            });
          });

          console.log(`[Classify] Batch ${batchNum} completed, ${batchResults.length} classified`);
        } catch (batchErr) {
          console.error(`[Classify] Batch ${batchNum} error:`, batchErr);
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          total: validLiterature.length,
          classified: results.length,
          results,
        },
      });
    }

    // AI推荐分类维度
    if (action === 'recommend_dimensions') {
      const { researchQuestion, literatureIds } = body;

      if (!apiKey) {
        return NextResponse.json({ error: '请提供API Key' }, { status: 400 });
      }

      if (!researchQuestion) {
        return NextResponse.json({ error: '请提供研究问题' }, { status: 400 });
      }

      // 获取文献列表（不限制状态，只要有标题就行）
      let query = client
        .from('literature')
        .select('id, title, raw_content, authors, year, doi, journal');

      if (literatureIds && literatureIds.length > 0) {
        query = query.in('id', literatureIds);
      }

      const { data: literatureList, error: litError } = await query;

      if (litError) {
        console.error('[Recommend] Query error:', litError);
        throw litError;
      }

      // 过滤出有标题的文献
      const validLiterature = (literatureList || []).filter(lit => lit.title);

      if (validLiterature.length === 0) {
        return NextResponse.json({ error: '没有可分析的文献，请先导入文献' }, { status: 400 });
      }

      console.log(`[Recommend] Found ${validLiterature.length} literature for analysis`);

      // 调用AI推荐维度
      const recommendations = await recommendDimensions(
        apiKey,
        researchQuestion,
        validLiterature
      );

      return NextResponse.json({
        success: true,
        data: recommendations,
      });
    }

    // 批量采纳推荐维度
    if (action === 'adopt_recommendations') {
      const { dimensions } = body;

      if (!dimensions || !Array.isArray(dimensions)) {
        return NextResponse.json({ error: '请提供维度列表' }, { status: 400 });
      }

      const createdDimensions = [];
      for (const dim of dimensions) {
        const { data, error } = await client
          .from('classification_dimensions')
          .insert({
            name: dim.name,
            description: dim.description,
            categories: dim.categories,
          })
          .select()
          .single();

        if (!error && data) {
          createdDimensions.push(data);
        }
      }

      return NextResponse.json({
        success: true,
        data: createdDimensions,
      });
    }

    return NextResponse.json({ error: '无效的action参数' }, { status: 400 });
  } catch (error) {
    console.error('Classification POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}

/**
 * 使用AI对文献进行分类
 */
async function classifyLiterature(
  apiKey: string,
  dimension: { name: string; description?: string; categories: string[] },
  title: string,
  content: string,
  authors?: string,
  year?: number
): Promise<{ category: string; confidence: number; evidence: string }> {
  // 构建提示词
  const systemPrompt = `你是一位专业的医学文献分析专家。你的任务是根据给定的分类维度，对文献进行分类。

分类维度：${dimension.name}
${dimension.description ? `描述：${dimension.description}` : ''}
可选分类：${(dimension.categories as string[]).join('、')}

请根据文献的标题、摘要或全文内容，判断该文献属于哪个分类。
如果无法确定，选择"未说明"或最接近的分类。

请以JSON格式返回：
{
  "category": "选择的分类",
  "confidence": 0.0-1.0的置信度,
  "evidence": "从文献中提取的支持该分类的证据文本（简要摘录）"
}`;

  const userPrompt = `请对以下文献进行分类：

标题：${title}
作者：${authors || '未知'}
年份：${year || '未知'}

内容摘要：
${content.substring(0, 3000)}

请返回JSON格式的分类结果。`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  const content_text = data.choices[0]?.message?.content || '{}';

  try {
    const result = JSON.parse(content_text);
    return {
      category: result.category || '未分类',
      confidence: result.confidence || 0.5,
      evidence: result.evidence || '',
    };
  } catch {
    return {
      category: '未分类',
      confidence: 0,
      evidence: '',
    };
  }
}

/**
 * 使用AI推荐分类维度
 */
async function recommendDimensions(
  apiKey: string,
  researchQuestion: string,
  literatureList: Array<{
    id: string;
    title?: string;
    raw_content?: string;
    authors?: string;
    year?: number;
    doi?: string;
    journal?: string;
  }>
): Promise<Array<{
  name: string;
  description: string;
  categories: string[];
  rationale: string;
  literatureCount: number;
}>> {
  // 准备文献摘要（限制总长度）
  const literatureSummaries = literatureList
    .slice(0, 30) // 最多分析30篇
    .map((lit, idx) => {
      // 从 raw_content 中提取摘要和关键词
      let abstract = '';
      let keywords = '';
      
      if (lit.raw_content) {
        try {
          const raw = JSON.parse(lit.raw_content);
          abstract = raw.abstract || '';
          keywords = Array.isArray(raw.keywords) 
            ? raw.keywords.join(', ') 
            : (raw.keywords || '');
        } catch {
          // 如果解析失败，直接使用 raw_content
          abstract = lit.raw_content.substring(0, 500);
        }
      }
      
      return `[${idx + 1}] 标题: ${lit.title || '未知'}
    作者: ${lit.authors || '未知'} (${lit.year || '未知年份'})
    期刊: ${lit.journal || '未知'}
    DOI: ${lit.doi || '无'}
    关键词: ${keywords}
    摘要: ${abstract.substring(0, 500)}`;
    })
    .join('\n\n');

  const systemPrompt = `你是一位专业的医学Meta分析专家。你的任务是根据研究问题和文献内容，推荐适合进行亚组分析或敏感性分析的分类维度。

## 你的任务
1. 分析研究问题，识别可能影响研究结果的关键因素
2. 从文献中提取这些因素的不同取值/类别
3. 推荐有意义的分类维度，用于亚组分析

## 分类维度的选择原则
1. 临床意义：该因素在临床上可能影响治疗效果或结局
2. 可操作性：文献中通常会报告该因素的信息
3. 异质性来源：该因素可能是导致研究间异质性的原因
4. 常见维度示例：
   - 人群特征：年龄、性别、疾病分期、严重程度
   - 干预特征：药物剂量、给药方式、治疗周期
   - 研究设计：RCT vs 观察性研究、单中心 vs 多中心
   - 地域/种族：亚洲人群 vs 西方人群

## 输出格式
请以JSON格式返回推荐的分类维度列表（最多5个）：
{
  "dimensions": [
    {
      "name": "维度名称（简洁）",
      "description": "维度描述（说明为什么这个维度重要）",
      "categories": ["分类1", "分类2", "未说明/未知"],
      "rationale": "推荐理由（基于研究问题和文献内容）",
      "literatureCount": 估计有多少篇文献可以据此分类
    }
  ]
}

注意：
- 每个维度必须有明确的分类选项，通常2-4个类别
- 类别应互斥且覆盖主要情况
- 建议包含"未说明"或"未知"类别以处理信息缺失`;

  const userPrompt = `## 研究问题
${researchQuestion}

## 待分析的文献（共${literatureList.length}篇，以下为前${Math.min(30, literatureList.length)}篇摘要）
${literatureSummaries}

请根据研究问题和文献内容，推荐适合的分类维度。`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Recommend] DeepSeek API error:', response.status, errorText);
    throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content_text = data.choices[0]?.message?.content || '{"dimensions":[]}';
  
  console.log('[Recommend] DeepSeek response:', content_text.substring(0, 500));

  try {
    const result = JSON.parse(content_text);
    console.log('[Recommend] Parsed dimensions:', result.dimensions?.length || 0);
    return result.dimensions || [];
  } catch (parseError) {
    console.error('[Recommend] Failed to parse response:', parseError);
    return [];
  }
}

/**
 * 批量分类文献（一次 API 调用处理多篇文献）
 * 性能优化：减少 API 调用次数，从 N 次变成 ceil(N/batchSize) 次
 */
async function batchClassifyLiterature(
  apiKey: string,
  dimension: { name: string; description?: string; categories: string[] },
  literatureBatch: Array<{
    id: string;
    title: string;
    content: string;
    authors?: string;
    year?: number;
  }>,
  batchSize: number = 15
): Promise<Array<{
  literatureId: string;
  category: string;
  confidence: number;
  evidence: string;
}>> {
  const results: Array<{
    literatureId: string;
    category: string;
    confidence: number;
    evidence: string;
  }> = [];

  // 构建文献列表文本
  const literatureText = literatureBatch.map((lit, idx) => {
    return `[文献${idx + 1}]
ID: ${lit.id}
标题: ${lit.title}
作者: ${lit.authors || '未知'}
年份: ${lit.year || '未知'}
内容摘要: ${lit.content.substring(0, 800)}`;
  }).join('\n\n');

  const systemPrompt = `你是一位专业的医学文献分析专家。你的任务是根据给定的分类维度，对多篇文献进行批量分类。

## 分类维度
名称：${dimension.name}
${dimension.description ? `描述：${dimension.description}` : ''}
可选分类：${(dimension.categories as string[]).join('、')}

## 输出格式要求
请以JSON格式返回所有文献的分类结果：
{
  "results": [
    {
      "literatureId": "文献ID",
      "category": "选择的分类",
      "confidence": 0.0-1.0的置信度,
      "evidence": "从文献中提取的支持该分类的简要证据"
    }
  ]
}

## 注意事项
1. 每篇文献必须返回一个分类结果
2. 如果无法确定分类，选择"未说明"或最接近的分类
3. confidence 表示分类的确定程度，0.5以下表示不确定
4. evidence 应简要摘录文献中支持该分类的关键信息`;

  const userPrompt = `请对以下 ${literatureBatch.length} 篇文献进行分类：

${literatureText}

请返回JSON格式的分类结果列表。`;

  console.log(`[BatchClassify] Processing ${literatureBatch.length} literature in one API call`);

  const startTime = Date.now();
  
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[BatchClassify] API error:', response.status, errorText);
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  const contentText = data.choices[0]?.message?.content || '{"results":[]}';
  
  console.log(`[BatchClassify] API call completed in ${Date.now() - startTime}ms`);

  try {
    const parsed = JSON.parse(contentText);
    const parsedResults = parsed.results || [];
    
    // 验证并补充缺失的结果
    for (const lit of literatureBatch) {
      const found = parsedResults.find((r: any) => r.literatureId === lit.id);
      if (found) {
        results.push({
          literatureId: lit.id,
          category: found.category || dimension.categories[0],
          confidence: found.confidence || 0.5,
          evidence: found.evidence || '',
        });
      } else {
        // 如果 AI 没有返回某篇文献的结果，使用默认值
        results.push({
          literatureId: lit.id,
          category: dimension.categories[dimension.categories.length - 1] || '未知',
          confidence: 0.3,
          evidence: 'AI未能返回分类结果',
        });
      }
    }
    
    console.log(`[BatchClassify] Parsed ${results.length} results`);
  } catch (parseError) {
    console.error('[BatchClassify] Parse error:', parseError);
    // 解析失败，为所有文献返回默认值
    for (const lit of literatureBatch) {
      results.push({
        literatureId: lit.id,
        category: dimension.categories[dimension.categories.length - 1] || '未知',
        confidence: 0.2,
        evidence: '解析AI响应失败',
      });
    }
  }

  return results;
}
