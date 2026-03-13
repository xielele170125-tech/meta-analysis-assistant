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
 * 从研究问题解析研究要素（支持多种框架）
 */
async function parsePICO(researchQuestion: string) {
  const systemPrompt = `你是一位循证医学专家，精通多种研究问题框架。

## 常见研究框架

### 1. PICO（干预性研究）
- P (Population): 研究人群
- I (Intervention): 干预措施
- C (Comparison): 对照措施
- O (Outcome): 结局指标

### 2. PECO（暴露研究/观察性研究）
- P (Population): 研究人群
- E (Exposure): 暴露因素
- C (Comparison): 对照/非暴露
- O (Outcome): 结局指标

### 3. SPIDER（定性/混合研究）
- S (Sample): 样本
- PI (Phenomenon of Interest): 感兴趣的现象
- D (Design): 研究设计
- E (Evaluation): 评估方法
- R (Research type): 研究类型

### 4. PICOS（增加研究类型）
- 在PICO基础上增加S (Study design)

### 5. CIMO（管理学/社会科学）
- C (Context): 背景/环境
- I (Intervention): 干预
- M (Mechanisms): 机制
- O (Outcomes): 结果

## 任务
1. 首先判断研究问题属于哪种类型
2. 提取相应的要素
3. 如果问题宽泛，**主动推断和扩展**可能的要素：
   - 根据研究主题推断可能的人群
   - 推断可能相关的干预/暴露因素
   - 推断可能的对照
   - 推断可能关注的结局
4. 识别关键概念和同义词
5. 提供相关的MeSH主题词

【重要】即使问题不完整，也要尽可能推断和扩展，而不是返回空值。

返回纯JSON格式（不要markdown代码块）：
{
  "frameworkType": "PICO/PECO/SPIDER/宽泛主题",
  "frameworkDescription": "为何选择此框架",
  "elements": {
    "population": { "terms": ["推断的人群"], "mesh": ["MeSH词"], "synonyms": ["同义词"], "inferred": true/false },
    "intervention_or_exposure": { "terms": ["干预或暴露"], "mesh": [], "synonyms": [], "inferred": true/false },
    "comparison": { "terms": ["对照"], "mesh": [], "synonyms": [], "inferred": true/false },
    "outcome": { "terms": ["结局"], "mesh": [], "synonyms": [], "inferred": true/false }
  },
  "keyConcepts": ["核心概念1", "核心概念2"],
  "expandedConcepts": {
    "relatedTopics": ["相关主题扩展"],
    "studyTypes": ["可能涉及的研究类型"],
    "timeframe": "时间范围推断",
    "geographicScope": "地理范围推断"
  },
  "searchStrategy": {
    "mainConcepts": ["主要检索概念"],
    "combinationLogic": "概念组合逻辑说明",
    "sensitivityVsPrecision": "sensitivity/precision",
    "suggestions": ["检索策略建议"]
  }
}`;

  const response = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `研究问题：${researchQuestion}\n\n请分析研究类型，提取关键要素，并尽可能扩展相关概念。如果问题宽泛，请主动推断可能的PICO/PECO要素。` },
  ], {
    usageType: 'classification',
    temperature: 0.3,
  });

  let jsonContent = response.content.trim();
  if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
  }

  const parsed = JSON.parse(jsonContent);

  // 兼容旧格式，转换为新格式
  if (!parsed.elements && parsed.pico) {
    parsed.elements = parsed.pico;
  }

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
    population?: { terms?: string[]; inferred?: boolean };
    intervention?: { terms?: string[]; inferred?: boolean };
    intervention_or_exposure?: { terms?: string[]; inferred?: boolean };
    comparison?: { terms?: string[]; inferred?: boolean };
    outcome?: { terms?: string[]; inferred?: boolean };
  }
) {
  // 提取要素文本
  const getTerms = (elem: any) => {
    if (!elem) return null;
    if (Array.isArray(elem)) return elem;
    if (elem.terms) return elem.terms;
    return null;
  };

  const popTerms = getTerms(pico?.population);
  const intTerms = getTerms(pico?.intervention) || getTerms(pico?.intervention_or_exposure);
  const compTerms = getTerms(pico?.comparison);
  const outTerms = getTerms(pico?.outcome);

  const picoText = (popTerms || intTerms || compTerms || outTerms)
    ? `
提取的要素：
- 人群(P): ${popTerms?.join(', ') || '未明确指定'}
- 干预/暴露(I/E): ${intTerms?.join(', ') || '未明确指定'}
- 对照(C): ${compTerms?.join(', ') || '未明确指定'}
- 结局(O): ${outTerms?.join(', ') || '未明确指定'}
`
    : '';

  const systemPrompt = `你是一位资深的医学文献检索专家，精通各大生物医学数据库的检索语法。

## 核心原则：精确性优先

检索结果过多（如超过5000篇）会严重影响后续筛选工作。请生成**精确且可操作**的检索式。

## 检索策略层次

### 策略A：核心概念精确检索（推荐）
- 仅组合最核心的2-3个概念
- 使用AND连接核心概念
- 使用[Title/Abstract]字段限定，提高精确性
- 目标结果：100-2000篇

### 策略B：敏感性检索
- 使用更宽松的检索策略
- 扩展同义词和主题词
- 使用OR连接同义词
- 目标结果：1000-5000篇

### 策略C：研究类型限定
- 在核心概念基础上添加研究类型过滤器
- RCT过滤器、系统评价过滤器等
- 目标结果：50-500篇

## 限制结果数量的关键技巧

### 1. 字段限定
- 使用[Title/Abstract]而非[All Fields]
- 重要概念限定在标题：[Title]
- 减少使用通配符*

### 2. 概念组合
- 增加AND连接的概念数量
- 避免单个概念单独检索
- 核心概念必须全部出现在标题或摘要中

### 3. 研究类型过滤器
- RCT: (randomized controlled trial[pt] OR randomized[tiab] OR placebo[tiab])
- 系统评价: (systematic review[pt] OR meta-analysis[pt] OR meta-analysis[tiab])
- 队列研究: (cohort studies[mh] OR cohort[tiab])

### 4. 时间限制
- 建议近10年文献
- 格式: ("2014"[Date - Publication] : "3000"[Date - Publication])

## 输出要求

为每个数据库生成**三种策略**的检索式：

返回纯JSON格式：
{
  "frameworkType": "PICO/PECO/宽泛主题",
  "conceptAnalysis": {
    "mainConcepts": ["核心概念1", "核心概念2"],
    "secondaryConcepts": ["次要概念"],
    "expandedTerms": {
      "概念1": ["同义词1", "MeSH词1"]
    }
  },
  "queries": {
    "pubmed": {
      "queryCore": "核心概念精确检索式（目标100-2000篇）",
      "querySensitive": "敏感性检索式（目标1000-5000篇）",
      "queryFiltered": "带研究类型过滤的检索式（目标50-500篇）",
      "meshTerms": ["使用的MeSH词"],
      "keywords": ["关键词"],
      "estimatedResultsCore": "预估数量如200-500",
      "estimatedResultsSensitive": "预估数量如1000-2000",
      "estimatedResultsFiltered": "预估数量如50-100"
    },
    "embase": {
      "queryCore": "核心检索式",
      "querySensitive": "敏感性检索式", 
      "queryFiltered": "带过滤器的检索式",
      "emtreeTerms": [],
      "keywords": []
    },
    "cochrane": {
      "queryCore": "核心检索式",
      "querySensitive": "敏感性检索式",
      "queryFiltered": "带过滤器的检索式"
    },
    "webofscience": {
      "queryCore": "核心检索式",
      "querySensitive": "敏感性检索式",
      "queryFiltered": "带过滤器的检索式"
    }
  },
  "strategy": "检索策略说明",
  "sensitivityNotes": "敏感性策略说明",
  "precisionNotes": "精确性策略说明",
  "suggestions": ["如结果仍过多，建议：1.增加概念 2.限定时间范围 3.添加研究类型过滤器"],
  "filters": {
    "rctFilter": "RCT过滤器字符串",
    "systematicReviewFilter": "系统评价过滤器字符串",
    "timeFilter": "时间范围建议"
  }
}`;

  const response = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `研究问题：${researchQuestion}\n${picoText}\n\n请生成**三种精确度**的检索式，优先推荐核心概念精确检索，目标结果控制在100-2000篇之间。如果核心概念不够明确，建议添加研究类型过滤器来限制结果数量。` },
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
