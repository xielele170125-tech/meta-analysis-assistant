import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { callLLM } from '@/lib/llm/service';

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

    // 执行AI分类（优化版：并行处理）
    if (action === 'classify') {
      const { dimensionId, literatureIds, forceReclassify } = body;
      
      console.log('[Classify] Request params:', { 
        dimensionId, 
        forceReclassify, 
        forceReclassifyType: typeof forceReclassify,
        hasLiteratureIds: !!literatureIds 
      });

      // 获取分类维度
      const { data: dimension, error: dimError } = await client
        .from('classification_dimensions')
        .select('*')
        .eq('id', dimensionId)
        .single();

      if (dimError || !dimension) {
        return NextResponse.json({ error: '分类维度不存在' }, { status: 404 });
      }

      // 获取待分类的文献
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
      let validLiterature = (literatureList || []).filter(lit => lit.title);
      
      console.log('[Classify] Valid literature count:', validLiterature.length);
      console.log('[Classify] forceReclassify value:', forceReclassify, 'type:', typeof forceReclassify);
      
      // 如果不是强制重新分类，排除已分类的文献
      if (!forceReclassify && (!literatureIds || literatureIds.length === 0)) {
        console.log('[Classify] Checking for existing classifications...');
        const { data: existingClassifications } = await client
          .from('literature_classifications')
          .select('literature_id')
          .eq('dimension_id', dimensionId);
        
        const classifiedIds = new Set((existingClassifications || []).map(c => c.literature_id));
        validLiterature = validLiterature.filter(lit => !classifiedIds.has(lit.id));
        
        console.log(`[Classify] Skipping ${classifiedIds.size} already classified literature, ${validLiterature.length} remaining`);
      } else {
        console.log('[Classify] Force reclassify or specific literatureIds provided, processing all literature');
      }

      if (validLiterature.length === 0) {
        return NextResponse.json({ 
          success: true,
          data: {
            total: 0,
            classified: 0,
            results: [],
            message: '所有文献已分类，如需重新分类请勾选"强制重新分类"'
          }
        });
      }

      console.log(`[Classify] Found ${validLiterature.length} literature for classification`);

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

      // 优化：并行处理多个批次
      const BATCH_SIZE = 10; // 每批处理的文献数（减小批次大小提高速度）
      const MAX_CONCURRENT = 5; // 最大并发批次数（增加并发数）
      
      const batches: Array<typeof literatureData> = [];
      for (let i = 0; i < literatureData.length; i += BATCH_SIZE) {
        batches.push(literatureData.slice(i, i + BATCH_SIZE));
      }

      console.log(`[Classify] Processing ${literatureData.length} literature in ${batches.length} batches (max ${MAX_CONCURRENT} concurrent)`);

      // 并发控制器
      const results: Array<{
        literatureId: string;
        title: string;
        category: string;
        confidence: number;
      }> = [];

      let completedBatches = 0;

      // 分组并行处理
      for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
        const concurrentBatches = batches.slice(i, i + MAX_CONCURRENT);
        
        const batchPromises = concurrentBatches.map(async (batch, batchIdx) => {
          const actualBatchNum = i + batchIdx + 1;
          console.log(`[Classify] Starting batch ${actualBatchNum}/${batches.length}`);

          try {
            const batchResults = await batchClassifyLiterature(dimension, batch);

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
              console.error(`[Classify] Batch ${actualBatchNum} upsert error:`, upsertError);
            }

            completedBatches++;
            console.log(`[Classify] Batch ${actualBatchNum} completed (${completedBatches}/${batches.length})`);

            return batchResults.map(r => {
              const lit = validLiterature.find(l => l.id === r.literatureId);
              return {
                literatureId: r.literatureId,
                title: lit?.title || '',
                category: r.category,
                confidence: r.confidence,
              };
            });
          } catch (batchErr) {
            console.error(`[Classify] Batch ${actualBatchNum} error:`, batchErr);
            return [];
          }
        });

        // 等待当前组的所有批次完成
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.flat());
      }

      console.log(`[Classify] All batches completed, ${results.length} literature classified`);

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

      if (!researchQuestion) {
        return NextResponse.json({ error: '请提供研究问题' }, { status: 400 });
      }

      // 获取文献列表
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
        const enhancedDescription = dim.dataAvailability || dim.contrastValue
          ? `${dim.dataAvailability ? `【${dim.dataAvailability}】` : ''}${dim.contrastValue || ''}${dim.description ? `\n${dim.description}` : ''}`
          : dim.description;
        
        const { data, error } = await client
          .from('classification_dimensions')
          .insert({
            name: dim.name,
            description: enhancedDescription,
            categories: dim.categories,
          })
          .select()
          .single();

        if (!error && data) {
          createdDimensions.push({
            ...data,
            dataAvailability: dim.dataAvailability,
            contrastValue: dim.contrastValue,
          });
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
 * 批量分类文献（使用新的LLM服务）
 */
async function batchClassifyLiterature(
  dimension: { name: string; description?: string; categories: string[] },
  literatureBatch: Array<{
    id: string;
    title: string;
    content: string;
    authors?: string;
    year?: number;
  }>
): Promise<Array<{
  literatureId: string;
  category: string;
  confidence: number;
  evidence: string;
}>> {
  // 构建文献列表文本 - 使用索引号作为标识，减少token消耗
  const literatureText = literatureBatch.map((lit, idx) => {
    // 缩短内容预览，减少token
    const contentPreview = lit.content.substring(0, 300);
    return `[${idx + 1}] ${lit.title}${lit.year ? ` (${lit.year})` : ''}\n${contentPreview}`;
  }).join('\n\n');

  const systemPrompt = `你是医学文献分类专家。根据维度对文献分类。

分类维度: ${dimension.name}
${dimension.description ? `说明: ${dimension.description}` : ''}
可选分类: ${(dimension.categories as string[]).join('、')}

重要规则:
1. 每篇文献必须返回一个分类结果
2. confidence表示分类置信度(0.0-1.0)，0.7以上表示确定，0.5-0.7表示可能，0.5以下表示不确定
3. evidence是从文献中提取的判断依据

【重要】只返回纯JSON，不要使用markdown代码块，不要任何其他文字。返回格式:
{"results":[{"index":1,"category":"选择的分类","confidence":0.8,"evidence":"判断依据"}]}`;

  const userPrompt = `请对以下 ${literatureBatch.length} 篇文献进行分类：

${literatureText}

请返回JSON格式的分类结果，每篇文献一个结果。`;

  const startTime = Date.now();
  
  try {
    // 使用新的LLM服务
    const response = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], {
      usageType: 'classification',
      temperature: 0.2,
    });

    console.log(`[BatchClassify] LLM call completed in ${Date.now() - startTime}ms`);
    console.log(`[BatchClassify] Response preview:`, response.content.substring(0, 300));

    // 处理AI返回的JSON - 去除markdown代码块
    let jsonContent = response.content.trim();
    // 去除markdown代码块标记
    if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
    }
    
    const parsed = JSON.parse(jsonContent);
    const parsedResults = parsed.results || [];
    
    console.log(`[BatchClassify] Parsed ${parsedResults.length} results from AI`);
    
    // 使用索引号匹配结果
    const results = literatureBatch.map((lit, idx) => {
      // 尝试用索引号匹配
      const found = parsedResults.find((r: any) => r.index === idx + 1 || r.index === String(idx + 1));
      
      if (found) {
        return {
          literatureId: lit.id,
          category: found.category || dimension.categories[0],
          confidence: typeof found.confidence === 'number' ? found.confidence : 0.7,
          evidence: found.evidence || '',
        };
      }
      
      // 如果没找到，尝试从AI返回中按顺序匹配
      const orderedResult = parsedResults[idx];
      if (orderedResult) {
        return {
          literatureId: lit.id,
          category: orderedResult.category || dimension.categories[0],
          confidence: typeof orderedResult.confidence === 'number' ? orderedResult.confidence : 0.7,
          evidence: orderedResult.evidence || '',
        };
      }
      
      // 默认值
      return {
        literatureId: lit.id,
        category: dimension.categories[dimension.categories.length - 1] || '未分类',
        confidence: 0.5,
        evidence: '未能从AI获取分类结果',
      };
    });
    
    console.log(`[BatchClassify] Final results: ${results.length} items`);
    
    return results;
  } catch (error) {
    console.error('[BatchClassify] Error:', error);
    // 返回默认值
    return literatureBatch.map(lit => ({
      literatureId: lit.id,
      category: dimension.categories[dimension.categories.length - 1] || '未分类',
      confidence: 0.3,
      evidence: '分类处理失败',
    }));
  }
}

/**
 * 使用AI推荐分类维度
 */
async function recommendDimensions(
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
  // 准备文献摘要（精简版，增加数量）
  const literatureSummaries = literatureList
    .slice(0, 50) // 增加到50篇
    .map((lit, idx) => {
      let abstract = '';
      if (lit.raw_content) {
        try {
          const raw = JSON.parse(lit.raw_content);
          abstract = (raw.abstract || '').substring(0, 300);
        } catch {
          abstract = lit.raw_content.substring(0, 300);
        }
      }
      return `[${idx + 1}] ${lit.title} (${lit.year || '?'}) ${abstract}`;
    })
    .join('\n');

  const systemPrompt = `你是Meta分析专家。识别文献中的对照维度用于亚组分析。

识别维度类型:
1. 人群特征(疾病类型/年龄/性别等)
2. 干预因素(治疗方案/剂量/方式)
3. 结局指标(主要/次要/短期/长期)
4. 研究设计(RCT/队列/样本量)

每个维度需:
- 至少2个可比较类别
- 标注数据可获得性
- 说明对照价值

返回JSON:{"dimensions":[{"name":"","description":"","categories":[],"rationale":"","dataAvailability":"","literatureCount":0,"contrastValue":""}]}`;

  const userPrompt = `研究问题:${researchQuestion}

文献(${Math.min(50, literatureList.length)}篇):
${literatureSummaries}

推荐分类维度。`;

  try {
    const response = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], {
      usageType: 'dimension_recommendation',
      temperature: 0.3,
    });

    const result = JSON.parse(response.content);
    return result.dimensions || [];
  } catch (error) {
    console.error('[Recommend] Error:', error);
    return [];
  }
}
