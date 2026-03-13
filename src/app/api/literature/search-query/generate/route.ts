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

## 核心任务
根据研究问题生成**专业、全面**的检索式，确保：
1. **敏感性优先**：宁可多检，不可漏检
2. **概念完整**：覆盖所有相关概念和同义词
3. **语法正确**：符合各数据库的检索语法

## 检索策略原则

### 概念提取与扩展
1. 从研究问题中提取核心概念（通常2-5个）
2. 每个概念扩展：
   - 同义词、近义词、拼写变体
   - 上位词、下位词
   - 英式/美式拼写差异
   - 缩写全称

### 概念组合策略
1. **核心概念必须包含**：使用AND连接
2. **同义词概念扩展**：使用OR连接
3. **排除明显无关**：谨慎使用NOT

### 不同研究类型策略
- **干预性研究**：PICO框架 + 研究类型过滤器
- **观察性研究**：PECO框架 + 队列/病例对照过滤器
- **诊断性研究**：QUADAS框架 + 敏感性/特异性词
- **广泛综述**：核心概念组合，不过度限制

## 数据库特定语法

### PubMed/MEDLINE
- MeSH主题词: "term"[MeSH Terms]
- 标题/摘要: "term"[Title/Abstract]
- 字段: [tiab], [ot], [nm], [sh]
- 通配符: *用于词根扩展

### EMBASE
- EMTREE主题词: 'term'/exp
- 字段: :ti, :ab, :de
- 通配符: *用于词根扩展

### Cochrane Library
- MeSH和自由词结合
- 字段: :ti, :ab, :kw
- 可限定为Cochrane Reviews或Trials

### Web of Science
- 主题字段: TS=(term)
- 标题: TI=(term)
- 摘要: AB=(term)
- 通配符: *用于词根扩展

## 输出要求
为每个数据库生成：
1. 完整可执行的检索式
2. 使用的主题词列表
3. 关键词列表
4. 预估结果数量范围

返回纯JSON格式：
{
  "frameworkType": "PICO/PECO/宽泛主题/其他",
  "conceptAnalysis": {
    "mainConcepts": ["概念1", "概念2"],
    "expandedTerms": {
      "概念1": ["同义词1", "同义词2", "MeSH词"],
      "概念2": ["同义词1", "变体1"]
    }
  },
  "queries": {
    "pubmed": {
      "query": "完整检索式（一行，可直接复制使用）",
      "meshTerms": ["使用的MeSH词"],
      "keywords": ["关键词"],
      "estimatedResults": "预估数量范围，如1000-5000"
    },
    "embase": {
      "query": "完整检索式",
      "emtreeTerms": ["使用的EMTREE词"],
      "keywords": ["关键词"],
      "estimatedResults": "预估数量范围"
    },
    "cochrane": {
      "query": "完整检索式",
      "fields": ["检索字段"],
      "estimatedResults": "预估数量范围"
    },
    "webofscience": {
      "query": "完整检索式",
      "fields": ["检索字段"],
      "estimatedResults": "预估数量范围"
    }
  },
  "strategy": "检索策略说明（为什么这样组合概念）",
  "sensitivityNotes": "敏感性说明（可能漏检的风险点）",
  "precisionNotes": "精确性说明（可能包含的不相关文献类型）",
  "suggestions": ["进一步优化建议"],
  "filters": {
    "studyTypeFilters": ["研究类型过滤器，如RCT过滤器"],
    "timeRange": "建议的时间范围",
    "languageFilters": ["语言限制建议"]
  }
}`;

  const response = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `研究问题：${researchQuestion}\n${picoText}\n\n请生成各数据库的专业检索式。如果研究问题宽泛或要素不完整，请主动推断和扩展相关概念，确保检索的全面性。` },
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
