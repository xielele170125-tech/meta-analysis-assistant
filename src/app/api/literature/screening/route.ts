/**
 * 文献初筛API
 * 使用AI根据研究问题对检索结果进行初步筛选
 */

import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm/service';

interface Article {
  pmid: string;
  title: string;
  abstract: string;
  authors?: string[];
  journal?: string;
  year?: string;
}

/**
 * POST /api/literature/screening
 * 执行AI初筛
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, researchQuestion, articles, criteria } = body;

    if (action === 'screen') {
      return await screenArticles(researchQuestion, articles, criteria);
    }

    if (action === 'generate_criteria') {
      return await generateScreeningCriteria(researchQuestion);
    }

    return NextResponse.json({ error: '无效的action参数' }, { status: 400 });
  } catch (error) {
    console.error('Screening error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '初筛失败' },
      { status: 500 }
    );
  }
}

/**
 * 生成初筛标准
 */
async function generateScreeningCriteria(researchQuestion: string) {
  const systemPrompt = `你是一位循证医学专家，精通文献筛选工作。

请根据研究问题，生成明确的纳入标准和排除标准。

原则：
1. 纳入标准要宽松，尽量保留可能有用的文献
2. 排除标准要明确，只剔除完全不相关的
3. 标准要具体可操作

返回纯JSON格式：
{
  "inclusionCriteria": [
    "纳入标准1",
    "纳入标准2"
  ],
  "exclusionCriteria": [
    "排除标准1",
    "排除标准2"
  ],
  "keyTopics": ["关键主题词，用于快速判断"],
  "studyDesigns": ["需要的研究类型"],
  "populationKeywords": ["人群相关关键词"],
  "interventionKeywords": ["干预相关关键词"],
  "outcomeKeywords": ["结局相关关键词"]
}`;

  const response = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `研究问题：${researchQuestion}\n\n请生成文献初筛标准。` },
  ], {
    usageType: 'classification',
    temperature: 0.3,
  });

  let jsonContent = response.content.trim();
  if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
  }

  const parsed = JSON.parse(jsonContent);

  return NextResponse.json({
    success: true,
    data: {
      researchQuestion,
      ...parsed,
    },
  });
}

/**
 * 执行文献初筛
 */
async function screenArticles(
  researchQuestion: string,
  articles: Article[],
  criteria?: {
    inclusionCriteria?: string[];
    exclusionCriteria?: string[];
    keyTopics?: string[];
  }
) {
  if (!articles || articles.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        total: 0,
        included: 0,
        excluded: 0,
        results: [],
      },
    });
  }

  // 分批处理，每批最多20篇
  const batchSize = 20;
  const results: Array<{
    pmid: string;
    decision: 'include' | 'exclude' | 'uncertain';
    confidence: number;
    reason: string;
    matchedKeywords: string[];
  }> = [];

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    const batchResults = await screenBatch(researchQuestion, batch, criteria);
    results.push(...batchResults);

    console.log(`[Screening] Processed ${Math.min(i + batchSize, articles.length)}/${articles.length}`);
  }

  const included = results.filter(r => r.decision === 'include' || r.decision === 'uncertain');
  const excluded = results.filter(r => r.decision === 'exclude');

  return NextResponse.json({
    success: true,
    data: {
      total: articles.length,
      included: included.length,
      excluded: excluded.length,
      results,
      summary: {
        includeCount: results.filter(r => r.decision === 'include').length,
        uncertainCount: results.filter(r => r.decision === 'uncertain').length,
        excludeCount: results.filter(r => r.decision === 'exclude').length,
      },
    },
  });
}

/**
 * 批量初筛
 */
async function screenBatch(
  researchQuestion: string,
  articles: Article[],
  criteria?: {
    inclusionCriteria?: string[];
    exclusionCriteria?: string[];
    keyTopics?: string[];
  }
) {
  const criteriaText = criteria
    ? `
纳入标准：
${criteria.inclusionCriteria?.map((c, i) => `${i + 1}. ${c}`).join('\n') || '未指定'}

排除标准：
${criteria.exclusionCriteria?.map((c, i) => `${i + 1}. ${c}`).join('\n') || '未指定'}

关键主题：${criteria.keyTopics?.join('、') || '未指定'}
`
    : '';

  const articlesText = articles.map((a, idx) => {
    const abstractPreview = a.abstract?.substring(0, 500) || '无摘要';
    return `[文献${idx + 1}] PMID: ${a.pmid}
标题: ${a.title}
摘要: ${abstractPreview}`;
  }).join('\n\n---\n\n');

  const systemPrompt = `你是一位专业的文献筛选专家，负责对检索结果进行初步筛选。

## 研究问题
${researchQuestion}

${criteriaText}

## 筛选原则
1. **宽松纳入**：只要文献可能与研究问题相关，就标记为"include"或"uncertain"
2. **严格排除**：只有明确不相关的文献才标记为"exclude"
3. **不确定处理**：如果有疑问，宁可纳入待后续确认

## 决策标准
- include: 文献明显与研究问题相关
- uncertain: 文献可能相关，需要进一步查看全文确认
- exclude: 文献明确与研究问题无关

## 置信度
- 0.8-1.0: 确定相关/不相关
- 0.5-0.8: 较为确定
- 0.3-0.5: 有一定把握
- 0.0-0.3: 不确定

返回纯JSON格式：
{
  "results": [
    {
      "index": 1,
      "pmid": "PMID号",
      "decision": "include/exclude/uncertain",
      "confidence": 0.85,
      "reason": "判断理由",
      "matchedKeywords": ["匹配的关键词"]
    }
  ]
}`;

  const response = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请对以下 ${articles.length} 篇文献进行初筛判断：\n\n${articlesText}` },
  ], {
    usageType: 'classification',
    temperature: 0.3,
  });

  let jsonContent = response.content.trim();
  if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
  }

  const parsed = JSON.parse(jsonContent);
  const parsedResults = parsed.results || [];

  // 匹配结果
  return articles.map((article, idx) => {
    const found = parsedResults.find(
      (r: any) => r.index === idx + 1 || r.pmid === article.pmid
    );

    if (found) {
      return {
        pmid: article.pmid,
        decision: found.decision || 'uncertain',
        confidence: typeof found.confidence === 'number' ? found.confidence : 0.5,
        reason: found.reason || '',
        matchedKeywords: found.matchedKeywords || [],
      };
    }

    // 默认不确定
    return {
      pmid: article.pmid,
      decision: 'uncertain' as const,
      confidence: 0.3,
      reason: 'AI未能做出判断',
      matchedKeywords: [],
    };
  });
}
