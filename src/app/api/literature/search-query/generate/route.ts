/**
 * 文献检索式生成API
 * 根据研究问题自动构建PubMed、EMBASE、Cochrane等数据库的专业检索式
 */

import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/llm/service';

/**
 * POST /api/literature/search-query/generate
 * 生成多数据库检索式
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, researchQuestion, pico } = body;

    if (action === 'generate') {
      // 生成检索式
      return await generateSearchQueries(researchQuestion, pico);
    }

    if (action === 'parse_pico') {
      // 从研究问题解析PICO要素
      return await parsePICO(researchQuestion);
    }

    return NextResponse.json({ error: '无效的action参数' }, { status: 400 });
  } catch (error) {
    console.error('Search query generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}

/**
 * 从研究问题解析PICO要素
 */
async function parsePICO(researchQuestion: string) {
  const systemPrompt = `你是一位循证医学专家，精通PICO框架分析。

PICO框架：
- P (Population/Patient/Problem): 研究人群/患者/问题
- I (Intervention/Exposure): 干预措施/暴露因素
- C (Comparison/Control): 对照措施
- O (Outcome): 结局指标

请分析研究问题，提取PICO各要素，并识别：
1. 关键概念和同义词
2. 相关的MeSH主题词
3. 建议的检索扩展词

返回纯JSON格式（不要markdown代码块）：
{
  "pico": {
    "population": { "terms": ["术语1", "术语2"], "mesh": ["MeSH词1"], "synonyms": ["同义词1"] },
    "intervention": { "terms": ["术语1"], "mesh": ["MeSH词1"], "synonyms": ["同义词1"] },
    "comparison": { "terms": ["术语1"], "mesh": [], "synonyms": [] },
    "outcome": { "terms": ["术语1"], "mesh": ["MeSH词1"], "synonyms": ["同义词1"] }
  },
  "keyConcepts": ["概念1", "概念2"],
  "studyTypes": ["RCT", "队列研究"],
  "timeframe": "时间范围（如有）",
  "limitations": "检索限制建议"
}`;

  const response = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `研究问题：${researchQuestion}\n\n请分析并提取PICO要素。` },
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
    data: parsed,
  });
}

/**
 * 生成多数据库检索式
 */
async function generateSearchQueries(
  researchQuestion: string,
  pico?: {
    population?: string[];
    intervention?: string[];
    comparison?: string[];
    outcome?: string[];
  }
) {
  const picoText = pico
    ? `
PICO要素：
- P (人群): ${pico.population?.join(', ') || '未指定'}
- I (干预): ${pico.intervention?.join(', ') || '未指定'}
- C (对照): ${pico.comparison?.join(', ') || '未指定'}
- O (结局): ${pico.outcome?.join(', ') || '未指定'}
`
    : '';

  const systemPrompt = `你是一位资深的医学文献检索专家，精通各大生物医学数据库的检索语法。

请根据研究问题和PICO要素，为以下数据库生成专业、全面的检索式：

## 1. PubMed/MEDLINE
- 使用MeSH主题词和自由词结合
- 使用[MeSH Terms]、[Title/Abstract]、[All Fields]等字段限定
- 使用布尔运算符AND、OR、NOT
- 使用括号确保逻辑正确

## 2. EMBASE
- 使用EMTREE主题词
- 使用Embase特有的字段限定符
- 语法与PubMed类似但字段不同

## 3. Cochrane Library
- 使用MeSH和自由词
- 针对系统评价优化的检索策略
- 可限定为Cochrane Reviews或Trials

## 4. Web of Science
- 使用TS(主题)、TI(标题)、AB(摘要)字段
- 使用通配符*扩展

## 检索策略原则
1. 敏感性优先：尽量检索全面，宁可多不可漏
2. 使用同义词、近义词、拼写变体扩展检索
3. 使用主题词扩展上下位词
4. 合理使用布尔运算符组合概念
5. 考虑不同数据库的语法差异

返回纯JSON格式：
{
  "queries": {
    "pubmed": {
      "query": "完整检索式",
      "meshTerms": ["使用的MeSH词"],
      "keywords": ["关键词"],
      "estimatedResults": "预估结果数量范围"
    },
    "embase": {
      "query": "完整检索式",
      "emtreeTerms": ["使用的EMTREE词"],
      "keywords": ["关键词"],
      "estimatedResults": "预估结果数量范围"
    },
    "cochrane": {
      "query": "完整检索式",
      "fields": ["检索字段"],
      "estimatedResults": "预估结果数量范围"
    },
    "webofscience": {
      "query": "完整检索式",
      "fields": ["检索字段"],
      "estimatedResults": "预估结果数量范围"
    }
  },
  "strategy": "检索策略说明",
  "suggestions": ["检索优化建议"],
  "filters": {
    "studyTypes": ["研究类型过滤器"],
    "timeRange": "时间范围建议",
    "languages": ["语言限制建议"]
  }
}`;

  const response = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `研究问题：${researchQuestion}\n${picoText}\n\n请生成各数据库的专业检索式。` },
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
      pico: pico || null,
      ...parsed,
    },
  });
}
