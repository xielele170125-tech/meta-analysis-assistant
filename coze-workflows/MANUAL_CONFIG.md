# Coze 工作流手动配置指南

本文档提供每个工作流的详细配置，可直接复制到Coze平台使用。

---

## 文献检索式生成

**描述**: 根据研究问题自动生成PubMed/EMBASE等数据库的专业检索式

**文件**: `01-search-query-generation.json`

### 节点配置

#### 1. 开始 (start)

**输入变量**:

- `research_question` (string) *必填*: 研究问题，例如：胚胎植入前遗传学检测对IVF结局的影响
- `framework_type` (string): 研究框架类型：PICO/PECO/SPIDER/auto（自动识别） (默认: `auto`)
- `search_strategy` (string): 检索策略：precise（精确）/sensitive（敏感）/limited（限定） (默认: `precise`)

#### 2. 解析研究框架 (llm)

**模型**: deepseek-chat

**Temperature**: 0.3

**System Prompt**:
```
你是一位循证医学专家，精通多种研究问题框架。

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

## 任务
1. 首先判断研究问题属于哪种类型
2. 提取相应的要素
3. 如果问题宽泛，**主动推断和扩展**可能的要素
4. 识别关键概念和同义词
5. 提供相关的MeSH主题词

【重要】即使问题不完整，也要尽可能推断和扩展，而不是返回空值。
```

**User Prompt**:
```
研究问题：{{start.research_question}}

请分析研究类型，提取关键要素，并尽可能扩展相关概念。如果问题宽泛，请主动推断可能的PICO/PECO要素。
```


#### 3. 生成检索式 (llm)

**模型**: deepseek-chat

**Temperature**: 0.3

**System Prompt**:
```
你是一位资深的医学文献检索专家，精通各大生物医学数据库的检索语法。

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

1. **字段限定**：使用[Title/Abstract]而非全字段检索
2. **概念筛选**：只组合最核心的概念，不必包含所有PICO要素
3. **主题词限定**：使用[MeSH Terms]限定词
4. **研究类型**：添加study type过滤器

## 检索策略选择

当前选择：{{start.search_strategy}}
- precise → 使用策略A
- sensitive → 使用策略B  
- limited → 使用策略C

## 输出要求

请生成以下数据库的检索式：
1. PubMed（使用MeSH主题词）
2. EMBASE（使用EMTREE主题词）
3. Cochrane Library

返回纯JSON格式（不要markdown代码块）：
{
  "pubmed": {
    "query": "完整检索式",
    "mesh_terms": ["使用的MeSH词列表"],
    "keywords": ["关键词列表"],
    "estimated_results": "预估结果数量范围"
  },
  "embase": {
    "query": "完整检索式",
    "emtree_terms": ["EMTREE词列表"],
    "keywords": ["关键词列表"],
    "estimated_results": "预估结果数量范围"
  },
  "cochrane": {
    "query": "完整检索式",
    "keywords": ["关键词列表"],
    "estimated_results": "预估结果数量范围"
  },
  "search_tips": ["检索建议1", "检索建议2"]
}
```

**User Prompt**:
```
研究问题：{{start.research_question}}

提取的要素：
{{parse_framework.elements}}

请生成精确的检索式，控制结果数量在合理范围内。
```


#### 4. 格式化输出 (code)

**语言**: javascript

**代码**:
```javascript
async function main({ parse_framework, generate_queries, start }) {
  // 构建输出结果
  const result = {
    research_question: start.research_question,
    framework: {
      type: parse_framework.frameworkType || 'PICO',
      description: parse_framework.frameworkDescription || '',
      elements: parse_framework.elements || {}
    },
    search_queries: generate_queries,
    created_at: new Date().toISOString()
  };
  
  // 格式化为Markdown
  let markdown = `# 文献检索式生成结果\n\n`;
  markdown += `## 研究问题\n${result.research_question}\n\n`;
  markdown += `## 研究框架\n类型：${result.framework.type}\n\n`;
  
  // 添加要素
  const elements = result.framework.elements;
  if (elements.population) {
    markdown += `### P - 人群\n${elements.population.terms?.join('、') || '未明确'}\n`;
    if (elements.population.mesh?.length > 0) {
      markdown += `MeSH词：${elements.population.mesh.join('、')}\n`;
    }
    markdown += '\n';
  }
  
  if (elements.intervention_or_exposure) {
    markdown += `### I/E - 干预/暴露\n${elements.intervention_or_exposure.terms?.join('、') || '未明确'}\n`;
    if (elements.intervention_or_exposure.mesh?.length > 0) {
      markdown += `MeSH词：${elements.intervention_or_exposure.mesh.join('、')}\n`;
    }
    markdown += '\n';
  }
  
  if (elements.comparison) {
    markdown += `### C - 对照\n${elements.comparison.terms?.join('、') || '未明确'}\n\n`;
  }
  
  if (elements.outcome) {
    markdown += `### O - 结局\n${elements.outcome.terms?.join('、') || '未明确'}\n\n`;
  }
  
  // 添加检索式
  markdown += `## 检索式\n\n`;
  markdown += `### PubMed\n\`\`\`\n${result.search_queries.pubmed?.query || '生成失败'}\n\`\`\`\n`;
  markdown += `预估结果：${result.search_queries.pubmed?.estimated_results || '未知'}\n\n`;
  
  markdown += `### EMBASE\n\`\`\`\n${result.search_queries.embase?.query || '生成失败'}\n\`\`\`\n`;
  markdown += `预估结果：${result.search_queries.embase?.estimated_results || '未知'}\n\n`;
  
  markdown += `### Cochrane Library\n\`\`\`\n${result.search_queries.cochrane?.query || '生成失败'}\n\`\`\`\n`;
  markdown += `预估结果：${result.search_queries.cochrane?.estimated_results || '未知'}\n\n`;
  
  // 添加检索建议
  if (result.search_queries.search_tips?.length > 0) {
    markdown += `## 检索建议\n`;
    result.search_queries.search_tips.forEach((tip, i) => {
      markdown += `${i + 1}. ${tip}\n`;
    });
  }
  
  return {
    json: result,
    markdown: markdown
  };
}
```


#### 5. 结束 (end)


---

## 文献AI初筛

**描述**: 使用AI根据研究问题对检索到的文献进行初步筛选

**文件**: `02-literature-screening.json`

### 节点配置

#### 1. 开始 (start)

**输入变量**:

- `research_question` (string) *必填*: 研究问题
- `articles` (array) *必填*: 待筛选的文献列表，格式：[{pmid, title, abstract}]
- `inclusion_criteria` (array): 纳入标准（可选）
- `exclusion_criteria` (array): 排除标准（可选）

#### 2. 生成筛选标准 (llm)

**模型**: deepseek-chat

**Temperature**: 0.3

**System Prompt**:
```
你是一位循证医学专家，精通文献筛选工作。

请根据研究问题，生成明确的纳入标准和排除标准。

原则：
1. 纳入标准要宽松，尽量保留可能有用的文献
2. 排除标准要明确，只剔除完全不相关的
3. 标准要具体可操作

返回纯JSON格式：
{
  "inclusionCriteria": ["纳入标准1", "纳入标准2"],
  "exclusionCriteria": ["排除标准1", "排除标准2"],
  "keyTopics": ["关键主题词，用于快速判断"],
  "studyDesigns": ["需要的研究类型"],
  "populationKeywords": ["人群相关关键词"],
  "interventionKeywords": ["干预相关关键词"],
  "outcomeKeywords": ["结局相关关键词"]
}
```

**User Prompt**:
```
研究问题：{{start.research_question}}

请生成文献初筛标准。
```


#### 3. 批量筛选文献 (iterator)


#### 4. 汇总筛选结果 (code)

**语言**: javascript

**代码**:
```javascript
async function main({ start, generate_criteria, screen_articles }) {
  // 获取筛选标准（用户提供的或AI生成的）
  const criteria = start.inclusion_criteria ? {
    inclusionCriteria: start.inclusion_criteria,
    exclusionCriteria: start.exclusion_criteria || []
  } : generate_criteria;
  
  // 合并所有批次的筛选结果
  const allResults = [];
  let resultIndex = 0;
  
  // screen_articles 是迭代器的结果，需要合并
  if (Array.isArray(screen_articles)) {
    screen_articles.forEach(batch => {
      if (Array.isArray(batch)) {
        batch.forEach(item => {
          // 从原始文献列表中获取完整信息
          const originalArticle = start.articles[resultIndex];
          allResults.push({
            pmid: originalArticle?.pmid || '',
            title: originalArticle?.title || '',
            decision: item.decision || 'uncertain',
            confidence: item.confidence || 0.5,
            reason: item.reason || '',
            matched_keywords: item.matched_keywords || [],
            study_type: item.study_type || ''
          });
          resultIndex++;
        });
      }
    });
  }
  
  // 统计结果
  const summary = {
    total: allResults.length,
    included: allResults.filter(r => r.decision === 'include').length,
    uncertain: allResults.filter(r => r.decision === 'uncertain').length,
    excluded: allResults.filter(r => r.decision === 'exclude').length
  };
  
  // 构建Markdown输出
  let markdown = `# 文献初筛结果\n\n`;
  markdown += `## 筛选标准\n\n`;
  markdown += `### 纳入标准\n`;
  criteria.inclusionCriteria?.forEach((c, i) => {
    markdown += `${i + 1}. ${c}\n`;
  });
  markdown += `\n### 排除标准\n`;
  criteria.exclusionCriteria?.forEach((c, i) => {
    markdown += `${i + 1}. ${c}\n`;
  });
  
  markdown += `\n## 筛选结果统计\n\n`;
  markdown += `- 总文献数：${summary.total}\n`;
  markdown += `- ✅ 明确纳入：${summary.included} (${((summary.included/summary.total)*100).toFixed(1)}%)\n`;
  markdown += `- ❓ 需进一步判断：${summary.uncertain} (${((summary.uncertain/summary.total)*100).toFixed(1)}%)\n`;
  markdown += `- ❌ 明确排除：${summary.excluded} (${((summary.excluded/summary.total)*100).toFixed(1)}%)\n`;
  
  // 分类展示
  markdown += `\n### ✅ 明确纳入的文献\n\n`;
  allResults.filter(r => r.decision === 'include').forEach(r => {
    markdown += `- **${r.title}** (PMID: ${r.pmid})\n`;
    markdown += `  - 置信度: ${(r.confidence * 100).toFixed(0)}%\n`;
    markdown += `  - 理由: ${r.reason}\n`;
    markdown += `  - 研究类型: ${r.study_type}\n\n`;
  });
  
  return {
    json: {
      criteria,
      results: allResults,
      summary
    },
    markdown
  };
}
```


#### 5. 结束 (end)


---

## 文献数据提取

**描述**: 从文献内容中提取Meta分析所需的结构化数据

**文件**: `03-data-extraction.json`

### 节点配置

#### 1. 开始 (start)

**输入变量**:

- `literature_content` (string) *必填*: 文献全文或摘要内容
- `research_question` (string): 研究问题（用于指导提取）
- `outcome_of_interest` (string): 关注的结局指标（可选）

#### 2. 提取数据 (llm)

**模型**: deepseek-reasoner

**Temperature**: 0.1

**System Prompt**:
```
你是一位专业的Meta分析数据提取专家。请从以下文献内容中仔细提取Meta分析所需的数据。

## 重要说明
请**严格按照文献原文**提取数据，保留原始的指标名称和数值。如果文献中有表格，请仔细阅读表格的行列标题。

## 数据提取指南

### 1. 研究标识
- 研究名称：通常是"第一作者(年份)"格式

### 2. 样本量（必填）
请提取以下信息，并**保留原始名称**：
- 治疗组/实验组样本量及名称：例如"胚胎总数"、"周期数"、"患者数"等
- 对照组样本量及名称

### 3. 数据类型判断
根据文献报告的数据类型，选择合适的提取方式：
- 连续型变量（均值±标准差）
- 二分类变量（事件数/总数）
- 已计算的效应量（OR/RR/HR等）

### 4. 结局指标处理（重要！）

#### 4.1 结局指标标准化
不同文献可能用不同名称表示相同含义的指标，请进行标准化：

**标准化对照表：**
| 原始名称可能的形式 | 标准化名称 |
|------------------|-----------||
| 非整倍体率、染色体异常率、非整倍体发生率、aneuploidy rate | 非整倍体率 |
| 临床妊娠率、妊娠率、clinical pregnancy rate | 临床妊娠率 |
| 生化妊娠率、生化率 | 生化妊娠率 |
| 流产率、自然流产率 | 流产率 |
| 活产率、活产成功率 | 活产率 |
| 种植率、着床率、implantation rate | 种植率 |
| 卵裂率、分裂率 | 卵裂率 |
| 受精率、正常受精率 | 受精率 |
| 优胚率、优质胚胎率 | 优胚率 |
| 囊胚形成率、囊胚率 | 囊胚形成率 |

- 请保留原始名称（outcome_type_raw）
- 同时提供标准化名称（outcome_type_standardized）
- 如果不在上述对照表中，请根据含义自行标准化

#### 4.2 亚组识别
如果同一文献报告了多个相同结局指标但针对不同人群/分组，请识别亚组：

**常见亚组类型：**
- 年龄分组：高龄组(≥35岁) vs 年轻组(<35岁)
- 周期类型：首次周期 vs 重复周期
- 胚胎类型：囊胚 vs 卵裂胚
- 卵子来源：自卵 vs 供卵
- 精子来源：自精 vs 供精
- 其他特定分组

### 5. 数据提取注意事项
- 如果文献包含多个不同的结局指标，请分别提取
- 如果文献包含同一指标的不同亚组，也要分别提取并标注亚组信息
- 如果表格中数据缺失，填null并在notes中说明
- 注意区分"干预组"和"对照组"，不要搞反
- 对于比率数据，样本量是分母，事件数是分子

## JSON输出格式
请严格按照以下格式输出：

```json
{
  "studies": [
    {
      "study_name": "作者(年份)",
      "sample_size_treatment": 数字,
      "sample_size_treatment_name": "样本量名称",
      "sample_size_control": 数字,
      "sample_size_control_name": "样本量名称",
      "mean_treatment": 数字或null,
      "sd_treatment": 数字或null,
      "mean_control": 数字或null,
      "sd_control": 数字或null,
      "events_treatment": 数字或null,
      "events_treatment_name": "事件名称",
      "events_control": 数字或null,
      "events_control_name": "事件名称",
      "outcome_type": "标准化结局指标名称",
      "outcome_type_raw": "原始结局指标名称",
      "outcome_type_standardized": "标准化结局指标名称",
      "subgroup": "亚组名称或null",
      "subgroup_detail": "亚组详细描述或null",
      "confidence": 0.0-1.0,
      "notes": "备注或null"
    }
  ]
}
```
```

**User Prompt**:
```
研究问题：{{start.research_question}}
{{#if start.outcome_of_interest}}关注的结局指标：{{start.outcome_of_interest}}{{/if}}

请提取以下文献的数据：

---
{{start.literature_content}}
---
```


#### 3. 验证和格式化数据 (code)

**语言**: javascript

**代码**:
```javascript
async function main({ extract_data, start }) {
  const studies = extract_data.studies || [];
  
  // 验证数据完整性
  const validatedStudies = studies.map((study, index) => {
    const warnings = [];
    
    // 检查必填字段
    if (!study.sample_size_treatment || !study.sample_size_control) {
      warnings.push('样本量缺失');
    }
    
    // 检查数据类型一致性
    const hasContinuousData = study.mean_treatment && study.sd_treatment;
    const hasDichotomousData = study.events_treatment !== null;
    
    if (!hasContinuousData && !hasDichotomousData) {
      warnings.push('未提取到有效数据');
    }
    
    // 计算效应量（如果原始数据存在）
    let effectSize = null;
    let standardError = null;
    
    if (hasDichotomousData) {
      // 二分类数据：计算RR和SE
      const rate_t = study.events_treatment / study.sample_size_treatment;
      const rate_c = study.events_control / study.sample_size_control;
      effectSize = Math.log(rate_t / rate_c); // log(RR)
      standardError = Math.sqrt(
        (1 / study.events_treatment) - 
        (1 / study.sample_size_treatment) + 
        (1 / study.events_control) - 
        (1 / study.sample_size_control)
      );
    }
    
    return {
      ...study,
      index: index + 1,
      warnings: warnings.length > 0 ? warnings : undefined,
      calculated_effect_size: effectSize,
      calculated_se: standardError,
      data_type: hasContinuousData ? 'continuous' : 'dichotomous'
    };
  });
  
  // 生成Markdown表格
  let markdown = `# 数据提取结果\n\n`;
  markdown += `## 提取概览\n\n`;
  markdown += `- 提取研究数：${validatedStudies.length}\n`;
  markdown += `- 数据类型：${[...new Set(validatedStudies.map(s => s.data_type))].join('、')}\n`;
  markdown += `- 结局指标：${[...new Set(validatedStudies.map(s => s.outcome_type_standardized || s.outcome_type))].join('、')}\n\n`;
  
  // 数据表格
  markdown += `## 提取数据表\n\n`;
  markdown += `| 研究 | 结局指标 | 干预组 | 对照组 | 效应量(95%CI) | 置信度 |\n`;
  markdown += `|------|---------|--------|--------|--------------|--------|\n`;
  
  validatedStudies.forEach(study => {
    const intervention = study.data_type === 'dichotomous' 
      ? `${study.events_treatment}/${study.sample_size_treatment}`
      : `${study.mean_treatment}±${study.sd_treatment}`;
    const control = study.data_type === 'dichotomous'
      ? `${study.events_control}/${study.sample_size_control}`
      : `${study.mean_control}±${study.sd_control}`;
    
    let effectDisplay = '-';
    if (study.calculated_effect_size && study.calculated_se) {
      const ciLower = study.calculated_effect_size - 1.96 * study.calculated_se;
      const ciUpper = study.calculated_effect_size + 1.96 * study.calculated_se;
      effectDisplay = `${Math.exp(study.calculated_effect_size).toFixed(2)} (${Math.exp(ciLower).toFixed(2)}-${Math.exp(ciUpper).toFixed(2)})`;
    }
    
    markdown += `| ${study.study_name} | ${study.outcome_type_standardized || study.outcome_type} | ${intervention} | ${control} | ${effectDisplay} | ${(study.confidence * 100).toFixed(0)}% |\n`;
  });
  
  // 警告信息
  const studiesWithWarnings = validatedStudies.filter(s => s.warnings && s.warnings.length > 0);
  if (studiesWithWarnings.length > 0) {
    markdown += `\n## ⚠️ 数据完整性警告\n\n`;
    studiesWithWarnings.forEach(study => {
      markdown += `- **${study.study_name}**: ${study.warnings.join('、')}\n`;
    });
  }
  
  return {
    json: {
      studies: validatedStudies,
      summary: {
        total: validatedStudies.length,
        by_outcome: validatedStudies.reduce((acc, s) => {
          const outcome = s.outcome_type_standardized || s.outcome_type;
          acc[outcome] = (acc[outcome] || 0) + 1;
          return acc;
        }, {}),
        by_data_type: validatedStudies.reduce((acc, s) => {
          acc[s.data_type] = (acc[s.data_type] || 0) + 1;
          return acc;
        }, {})
      }
    },
    markdown
  };
}
```


#### 4. 结束 (end)


---

## 文献质量评估

**描述**: 使用Cochrane RoB 2.0或Newcastle-Ottawa量表评估文献质量

**文件**: `04-quality-assessment.json`

### 节点配置

#### 1. 开始 (start)

**输入变量**:

- `literature_content` (string) *必填*: 文献全文或摘要内容
- `study_type` (string) *必填*: 研究类型：rct（随机对照试验）/cohort（队列研究）/case_control（病例对照）
- `tool` (string): 评估工具：rob2（Cochrane RoB 2.0）/nos（Newcastle-Ottawa）/auto（自动选择） (默认: `auto`)

#### 2. Cochrane RoB 2.0评估 (llm)

**模型**: deepseek-chat

**Temperature**: 0.3

**System Prompt**:
```
你是一位专业的系统综述方法学专家。请根据Cochrane偏倚风险评估工具2.0版(RoB 2.0)对以下随机对照试验(RCT)进行质量评估。

## RoB 2.0 评估域

### 域1: 随机化过程 (D1)
- D1.1 分配序列是否真正随机？
- D1.2 分配序列是否被隐藏？
- D1.3 基线特征是否平衡？

判断标准：
- 低风险(Low): 真正随机、分配隐藏、基线平衡
- 有些担忧(Some concerns): 存在一些问题但不太可能严重影响结果
- 高风险(High): 非随机、无分配隐藏、基线不平衡

### 域2: 偏离预期干预 (D2)
- D2.1 参与者和实施者是否知晓分配？
- D2.2 是否存在偏离预期干预的情况？
- D2.3 这些偏离是否可能影响结果？

### 域3: 结局数据缺失 (D3)
- D3.1 是否有结局数据缺失？
- D3.2 缺失是否与真实结果相关？
- D3.3 缺失数据比例是否可能导致偏倚？

### 域4: 结局测量 (D4)
- D4.1 结局测量方法是否恰当？
- D4.2 测量者是否知晓干预分配？
- D4.3 测量偏差是否可能影响结果？

### 域5: 结果报告选择性 (D5)
- D5.1 是否有预先注册的方案？
- D5.2 报告的结果是否与预先指定的结果一致？
- D5.3 是否有选择性报告的迹象？

## 总体风险判断规则
- 低风险(Low): 所有域均为低风险
- 有些担忧(Some concerns): 至少一个域为有些担忧，但没有高风险域
- 高风险(High): 至少一个域为高风险，或多个域为有些担忧

## 输出格式

请严格按照以下JSON格式输出：

```json
{
  "study_type": "rct",
  "domains": {
    "D1": {
      "name": "随机化过程",
      "judgment": "low/some_concerns/high",
      "questions": {
        "D1.1": {"question": "分配序列是否真正随机？", "answer": "回答内容", "judgment": "low/some_concerns/high"},
        "D1.2": {"question": "分配序列是否被隐藏？", "answer": "回答内容", "judgment": "low/some_concerns/high"},
        "D1.3": {"question": "基线特征是否平衡？", "answer": "回答内容", "judgment": "low/some_concerns/high"}
      },
      "reason": "综合判断理由"
    },
    "D2": {
      "name": "偏离预期干预",
      "judgment": "low/some_concerns/high",
      "questions": {
        "D2.1": {"question": "参与者和实施者是否知晓分配？", "answer": "回答内容", "judgment": "low/some_concerns/high"},
        "D2.2": {"question": "是否存在偏离预期干预的情况？", "answer": "回答内容", "judgment": "low/some_concerns/high"},
        "D2.3": {"question": "这些偏离是否可能影响结果？", "answer": "回答内容", "judgment": "low/some_concerns/high"}
      },
      "reason": "综合判断理由"
    },
    "D3": {
      "name": "结局数据缺失",
      "judgment": "low/some_concerns/high",
      "questions": {
        "D3.1": {"question": "是否有结局数据缺失？", "answer": "回答内容", "judgment": "low/some_concerns/high"},
        "D3.2": {"question": "缺失是否与真实结果相关？", "answer": "回答内容", "judgment": "low/some_concerns/high"},
        "D3.3": {"question": "缺失数据比例是否可能导致偏倚？", "answer": "回答内容", "judgment": "low/some_concerns/high"}
      },
      "reason": "综合判断理由"
    },
    "D4": {
      "name": "结局测量",
      "judgment": "low/some_concerns/high",
      "questions": {
        "D4.1": {"question": "结局测量方法是否恰当？", "answer": "回答内容", "judgment": "low/some_concerns/high"},
        "D4.2": {"question": "测量者是否知晓干预分配？", "answer": "回答内容", "judgment": "low/some_concerns/high"},
        "D4.3": {"question": "测量偏差是否可能影响结果？", "answer": "回答内容", "judgment": "low/some_concerns/high"}
      },
      "reason": "综合判断理由"
    },
    "D5": {
      "name": "结果报告选择性",
      "judgment": "low/some_concerns/high",
      "questions": {
        "D5.1": {"question": "是否有预先注册的方案？", "answer": "回答内容", "judgment": "low/some_concerns/high"},
        "D5.2": {"question": "报告的结果是否与预先指定的结果一致？", "answer": "回答内容", "judgment": "low/some_concerns/high"},
        "D5.3": {"question": "是否有选择性报告的迹象？", "answer": "回答内容", "judgment": "low/some_concerns/high"}
      },
      "reason": "综合判断理由"
    }
  },
  "overall_risk": "low/some_concerns/high",
  "overall_reason": "总体偏倚风险判断理由",
  "confidence": 0.0-1.0
}
```
```

**User Prompt**:
```
请评估以下文献：

---
{{start.literature_content}}
---
```


#### 3. Newcastle-Ottawa评估 (llm)

**模型**: deepseek-chat

**Temperature**: 0.3

**System Prompt**:
```
你是一位专业的系统综述方法学专家。请根据Newcastle-Ottawa量表(NOS)对以下观察性研究进行质量评估。

## Newcastle-Ottawa量表条目

### 选择组 (Selection) - 最多4星

**S1. 暴露队列的代表性**
- ★ (a) 真正有代表性（如全人群、社区样本）
- ★ (b) 一定程度上有代表性（如医院样本但无选择偏倚）
- (c) 选择的人群（特定人群如护士、志愿者）
- (d) 无描述

**S2. 非暴露队列的选择**
- ★ (a) 来自同一社区
- ★ (b) 来自同一来源但不同时间
- (c) 无描述
- (d) 与暴露组不可比

**S3. 暴露的确定**
- ★ (a) 安全记录（如医疗记录）
- ★ (b) 结构化访谈
- (c) 书面自我报告
- (d) 无描述

**S4. 研究开始时结局未发生**
- ★ (a) 是（研究开始时无结局）
- (b) 无描述

### 可比性组 (Comparability) - 最多2星

**C1. 研究控制了最重要的混杂因素**
- ★★ (a) 研究控制了最重要的混杂因素（如年龄）
- ★ (b) 研究控制了其他重要混杂因素

**C2. 研究控制了其他混杂因素**
- ★ (a) 是（研究控制了额外的混杂因素）
- (b) 无描述

### 结局组 (Outcome) - 最多3星

**O1. 结局评估**
- ★ (a) 独立盲法评估或记录链接
- ★ (b) 记录链接
- (c) 自我报告
- (d) 无描述

**O2. 随访时间是否足够长**
- ★ (a) 是（足以看到结局发生）
- (b) 无描述

**O3. 随访完整性**
- ★ (a) 完整随访（失访率<5%）或失访不影响结果
- ★ (b) 失访率5-20%
- (c) 失访率>20%
- (d) 无描述

## 质量等级
- 高质量：8-9星
- 中等质量：6-7星
- 低质量：≤5星

## 输出格式

请严格按照以下JSON格式输出：

```json
{
  "study_type": "cohort/case_control",
  "domains": {
    "selection": {
      "name": "选择",
      "max_stars": 4,
      "earned_stars": 0-4,
      "questions": {
        "S1": {"question": "暴露队列的代表性", "answer": "回答内容", "stars": 0-1},
        "S2": {"question": "非暴露队列的选择", "answer": "回答内容", "stars": 0-1},
        "S3": {"question": "暴露的确定", "answer": "回答内容", "stars": 0-1},
        "S4": {"question": "研究开始时结局未发生", "answer": "回答内容", "stars": 0-1}
      },
      "reason": "综合判断理由"
    },
    "comparability": {
      "name": "可比性",
      "max_stars": 2,
      "earned_stars": 0-2,
      "questions": {
        "C1": {"question": "控制了最重要的混杂因素", "answer": "回答内容", "stars": 0-2},
        "C2": {"question": "控制了其他混杂因素", "answer": "回答内容", "stars": 0-1}
      },
      "reason": "综合判断理由"
    },
    "outcome": {
      "name": "结局",
      "max_stars": 3,
      "earned_stars": 0-3,
      "questions": {
        "O1": {"question": "结局评估", "answer": "回答内容", "stars": 0-1},
        "O2": {"question": "随访时间是否足够长", "answer": "回答内容", "stars": 0-1},
        "O3": {"question": "随访完整性", "answer": "回答内容", "stars": 0-1}
      },
      "reason": "综合判断理由"
    }
  },
  "total_stars": 0-9,
  "quality_level": "high/medium/low",
  "confidence": 0.0-1.0
}
```
```

**User Prompt**:
```
请评估以下文献：

---
{{start.literature_content}}
---
```


#### 4. 格式化输出 (code)

**语言**: javascript

**代码**:
```javascript
async function main({ start, assess_rct, assess_observational }) {
  const isRCT = start.study_type === 'rct';
  const assessment = isRCT ? assess_rct : assess_observational;
  
  let markdown = `# 文献质量评估结果\n\n`;
  markdown += `## 研究信息\n\n`;
  markdown += `- 研究类型：${isRCT ? '随机对照试验（RCT）' : '观察性研究'}\n`;
  markdown += `- 评估工具：${isRCT ? 'Cochrane RoB 2.0' : 'Newcastle-Ottawa量表'}\n`;
  markdown += `- 置信度：${(assessment.confidence * 100).toFixed(0)}%\n\n`;
  
  if (isRCT) {
    // RCT质量评估输出
    markdown += `## 偏倚风险评估\n\n`;
    const domainEmojis = {
      'low': '✅',
      'some_concerns': '⚠️',
      'high': '❌'
    };
    
    Object.entries(assessment.domains).forEach(([key, domain]) => {
      markdown += `### ${domain.name}\n`;
      markdown += `判断：${domainEmojis[domain.judgment]} ${domain.judgment}\n\n`;
      
      Object.entries(domain.questions).forEach(([qKey, question]) => {
        markdown += `- **${question.question}**\n`;
        markdown += `  - 回答：${question.answer}\n`;
        markdown += `  - 判断：${domainEmojis[question.judgment]} ${question.judgment}\n`;
      });
      markdown += `\n**综合理由**：${domain.reason}\n\n---\n\n`;
    });
    
    markdown += `## 总体评估\n\n`;
    markdown += `${domainEmojis[assessment.overall_risk]} **${assessment.overall_risk.toUpperCase()}**\n\n`;
    markdown += `${assessment.overall_reason}\n`;
  } else {
    // 观察性研究质量评估输出
    markdown += `## Newcastle-Ottawa量表评分\n\n`;
    
    const domains = assessment.domains;
    
    // 选择组
    markdown += `### 选择组（${domains.selection.earned_stars}/${domains.selection.max_stars}星）\n\n`;
    Object.entries(domains.selection.questions).forEach(([key, q]) => {
      markdown += `- **${q.question}**：${'⭐'.repeat(q.stars)} ${q.answer}\n`;
    });
    markdown += `\n`;
    
    // 可比性组
    markdown += `### 可比性组（${domains.comparability.earned_stars}/${domains.comparability.max_stars}星）\n\n`;
    Object.entries(domains.comparability.questions).forEach(([key, q]) => {
      markdown += `- **${q.question}**：${'⭐'.repeat(q.stars)} ${q.answer}\n`;
    });
    markdown += `\n`;
    
    // 结局组
    markdown += `### 结局组（${domains.outcome.earned_stars}/${domains.outcome.max_stars}星）\n\n`;
    Object.entries(domains.outcome.questions).forEach(([key, q]) => {
      markdown += `- **${q.question}**：${'⭐'.repeat(q.stars)} ${q.answer}\n`;
    });
    markdown += `\n`;
    
    markdown += `---\n\n`;
    markdown += `## 总体评分\n\n`;
    markdown += `总星级：${'⭐'.repeat(assessment.total_stars)} (${assessment.total_stars}/9)\n\n`;
    markdown += `质量等级：${assessment.quality_level === 'high' ? '✅ 高质量' : assessment.quality_level === 'medium' ? '⚠️ 中等质量' : '❌ 低质量'}\n`;
  }
  
  return {
    json: assessment,
    markdown
  };
}
```


#### 5. 结束 (end)


---

## Meta分析计算

**描述**: 执行固定/随机效应模型Meta分析，计算合并效应量和异质性

**文件**: `05-meta-analysis.json`

### 节点配置

#### 1. 开始 (start)

**输入变量**:

- `studies` (array) *必填*: 研究数据列表，格式：[{id, study_name, effect_size, standard_error, sample_size_treatment, sample_size_control}]
- `model_type` (string): 效应模型：fixed（固定效应）/random（随机效应）/auto（自动选择） (默认: `auto`)
- `effect_measure` (string): 效应量类型：RR/OR/HR/SMD/MD (默认: `RR`)

#### 2. 验证输入数据 (code)

**语言**: javascript

**代码**:
```javascript
async function main({ start }) {
  const studies = start.studies || [];
  const errors = [];
  const validStudies = [];
  
  studies.forEach((study, index) => {
    // 检查必填字段
    if (!study.study_name) {
      errors.push(`研究${index + 1}：缺少研究名称`);
    }
    
    if (typeof study.effect_size !== 'number') {
      errors.push(`${study.study_name || '研究' + (index + 1)}：缺少效应量`);
      return;
    }
    
    if (typeof study.standard_error !== 'number' || study.standard_error <= 0) {
      errors.push(`${study.study_name}：标准误无效`);
      return;
    }
    
    // 有效研究
    validStudies.push({
      id: study.id || `study_${index + 1}`,
      study_name: study.study_name,
      effect_size: study.effect_size,
      standard_error: study.standard_error,
      sample_size_treatment: study.sample_size_treatment || null,
      sample_size_control: study.sample_size_control || null
    });
  });
  
  if (validStudies.length < 2) {
    errors.push('有效研究数量不足（至少需要2个研究）');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    valid_studies: validStudies,
    total_studies: studies.length,
    valid_studies_count: validStudies.length
  };
}
```


#### 3. 固定效应模型 (code)

**语言**: javascript

**代码**:
```javascript
async function main({ validate_input }) {
  if (!validate_input.valid) {
    return null;
  }
  
  const studies = validate_input.valid_studies;
  
  // 计算权重 (w = 1/SE^2)
  const weights = studies.map(s => 1 / (s.standard_error * s.standard_error));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  // 加权平均效应量
  const combinedEffect = studies.reduce((sum, s, i) => sum + weights[i] * s.effect_size, 0) / totalWeight;
  
  // 合并标准误
  const combinedSe = Math.sqrt(1 / totalWeight);
  
  // 95% CI
  const z = 1.96;
  const combinedCiLower = combinedEffect - z * combinedSe;
  const combinedCiUpper = combinedEffect + z * combinedSe;
  
  // Z检验和P值
  const zStat = combinedEffect / combinedSe;
  const combinedPValue = 2 * (1 - normalCDF(Math.abs(zStat)));
  
  // 异质性检验
  const Q = studies.reduce((sum, s, i) => sum + weights[i] * Math.pow(s.effect_size - combinedEffect, 2), 0);
  const df = studies.length - 1;
  const I2 = Q > 0 ? Math.max(0, (Q - df) / Q) : 0;
  const heterogeneityPValue = 1 - chiSquareCDF(Q, df);
  
  // 构建结果
  return {
    model_type: 'fixed',
    combined_effect: combinedEffect,
    combined_se: combinedSe,
    combined_ci_lower: combinedCiLower,
    combined_ci_upper: combinedCiUpper,
    combined_p_value: combinedPValue,
    z_statistic: zStat,
    heterogeneity: {
      Q,
      df,
      I2,
      tau2: 0,
      p_value: heterogeneityPValue
    },
    studies: studies.map((s, i) => ({
      id: s.id,
      study_name: s.study_name,
      effect_size: s.effect_size,
      se: s.standard_error,
      weight: (weights[i] / totalWeight) * 100,
      ci_lower: s.effect_size - 1.96 * s.standard_error,
      ci_upper: s.effect_size + 1.96 * s.standard_error
    }))
  };
}

// 标准正态分布CDF
function normalCDF(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}

// 卡方分布CDF
function chiSquareCDF(x, df) {
  if (x <= 0) return 0;
  const y = Math.pow(x / df, 1 / 3);
  const mu = 1 - 2 / (9 * df);
  const sigma = Math.sqrt(2 / (9 * df));
  const z = (y - mu) / sigma;
  return normalCDF(z);
}
```


#### 4. 随机效应模型 (code)

**语言**: javascript

**代码**:
```javascript
async function main({ validate_input, calculate_fixed }) {
  if (!validate_input.valid || !calculate_fixed) {
    return null;
  }
  
  const studies = validate_input.valid_studies;
  const Q = calculate_fixed.heterogeneity.Q;
  const df = studies.length - 1;
  
  // 计算 τ² (DerSimonian-Laird方法)
  const fixedWeights = studies.map(s => 1 / (s.standard_error * s.standard_error));
  const C = fixedWeights.reduce((a, b) => a + b, 0);
  const sumWSquared = fixedWeights.reduce((sum, w) => sum + w * w, 0);
  const tau2 = Math.max(0, (Q - df) / (C - sumWSquared / C));
  
  // 重新计算权重 (包含τ²)
  const weights = studies.map(s => 1 / (s.standard_error * s.standard_error + tau2));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  // 加权平均效应量
  const combinedEffect = studies.reduce((sum, s, i) => sum + weights[i] * s.effect_size, 0) / totalWeight;
  
  // 合并标准误
  const combinedSe = Math.sqrt(1 / totalWeight);
  
  // 95% CI
  const z = 1.96;
  const combinedCiLower = combinedEffect - z * combinedSe;
  const combinedCiUpper = combinedEffect + z * combinedSe;
  
  // Z检验和P值
  const zStat = combinedEffect / combinedSe;
  const combinedPValue = 2 * (1 - normalCDF(Math.abs(zStat)));
  
  // I² 统计量
  const I2 = Q > 0 ? Math.max(0, (Q - df) / Q) : 0;
  const heterogeneityPValue = 1 - chiSquareCDF(Q, df);
  
  return {
    model_type: 'random',
    combined_effect: combinedEffect,
    combined_se: combinedSe,
    combined_ci_lower: combinedCiLower,
    combined_ci_upper: combinedCiUpper,
    combined_p_value: combinedPValue,
    z_statistic: zStat,
    heterogeneity: {
      Q,
      df,
      I2,
      tau2,
      p_value: heterogeneityPValue
    },
    studies: studies.map((s, i) => ({
      id: s.id,
      study_name: s.study_name,
      effect_size: s.effect_size,
      se: s.standard_error,
      weight: (weights[i] / totalWeight) * 100,
      ci_lower: s.effect_size - 1.96 * s.standard_error,
      ci_upper: s.effect_size + 1.96 * s.standard_error
    }))
  };
}

function normalCDF(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}

function chiSquareCDF(x, df) {
  if (x <= 0) return 0;
  const y = Math.pow(x / df, 1 / 3);
  const mu = 1 - 2 / (9 * df);
  const sigma = Math.sqrt(2 / (9 * df));
  const z = (y - mu) / sigma;
  return normalCDF(z);
}
```


#### 5. 选择最优模型 (code)

**语言**: javascript

**代码**:
```javascript
async function main({ start, validate_input, calculate_fixed, calculate_random }) {
  if (!validate_input.valid) {
    return {
      error: true,
      message: validate_input.errors.join('\n')
    };
  }
  
  const fixedResult = calculate_fixed;
  const randomResult = calculate_random;
  
  // 确定使用哪个模型
  let selectedModel;
  let modelReason;
  
  if (start.model_type === 'fixed') {
    selectedModel = fixedResult;
    modelReason = '用户指定使用固定效应模型';
  } else if (start.model_type === 'random') {
    selectedModel = randomResult;
    modelReason = '用户指定使用随机效应模型';
  } else {
    // 自动选择：根据I²判断
    const I2 = fixedResult.heterogeneity.I2;
    if (I2 < 0.5) {
      selectedModel = fixedResult;
      modelReason = `异质性较低(I²=${(I2*100).toFixed(1)}%)，自动选择固定效应模型`;
    } else {
      selectedModel = randomResult;
      modelReason = `异质性较高(I²=${(I2*100).toFixed(1)}%)，自动选择随机效应模型`;
    }
  }
  
  return {
    selected_model: selectedModel,
    fixed_model: fixedResult,
    random_model: randomResult,
    model_selection_reason: modelReason
  };
}
```


#### 6. 解读分析结果 (llm)

**模型**: deepseek-chat

**Temperature**: 0.3

**System Prompt**:
```
你是一位专业的循证医学专家，请解读Meta分析结果。

## 解读要点

### 1. 效应量解读
根据效应量类型进行解读：
- RR (相对风险)：RR<1表示干预降低风险，RR>1表示增加风险
- OR (比值比)：OR<1表示干预降低几率，OR>1表示增加几率
- HR (风险比)：HR<1表示干预降低风险率
- SMD (标准化均数差)：SMD<0.2小效应，0.2-0.8中效应，>0.8大效应
- MD (均数差)：直接解释差异大小

### 2. 异质性解读
- I² < 25%：低异质性
- I² 25-50%：中等异质性
- I² 50-75%：较高异质性
- I² > 75%：高异质性

### 3. 统计学显著性
- P < 0.05：统计学显著
- P ≥ 0.05：无统计学显著性

### 4. 临床意义
综合考虑效应量大小、置信区间、研究质量等因素

## 输出格式

请用通俗易懂的语言撰写解读报告，包含以下部分：

```json
{
  "main_findings": "主要发现（2-3句话）",
  "effect_interpretation": "效应量解读",
  "heterogeneity_interpretation": "异质性解读",
  "clinical_significance": "临床意义",
  "limitations": ["局限性1", "局限性2"],
  "conclusions": "结论"
}
```
```

**User Prompt**:
```
请解读以下Meta分析结果：

模型类型：{{select_model.selected_model.model_type}}
效应量类型：{{start.effect_measure}}
合并效应量：{{select_model.selected_model.combined_effect}}
95%置信区间：[{{select_model.selected_model.combined_ci_lower}}, {{select_model.selected_model.combined_ci_upper}}]
P值：{{select_model.selected_model.combined_p_value}}
异质性(I²)：{{select_model.selected_model.heterogeneity.I2}}
异质性P值：{{select_model.selected_model.heterogeneity.p_value}}
纳入研究数：{{validate_input.valid_studies_count}}
```


#### 7. 生成完整报告 (code)

**语言**: javascript

**代码**:
```javascript
async function main({ start, validate_input, select_model, interpret_results }) {
  const selectedModel = select_model.selected_model;
  const fixedModel = select_model.fixed_model;
  const randomModel = select_model.random_model;
  
  let markdown = `# Meta分析结果报告\n\n`;
  
  // 分析概览
  markdown += `## 分析概览\n\n`;
  markdown += `- 效应量类型：${start.effect_measure}\n`;
  markdown += `- 选用模型：${selectedModel.model_type === 'fixed' ? '固定效应模型' : '随机效应模型'}\n`;
  markdown += `- 模型选择理由：${select_model.model_selection_reason}\n`;
  markdown += `- 纳入研究数：${validate_input.valid_studies_count}\n\n`;
  
  // 合并效应量
  markdown += `## 合并效应量\n\n`;
  const effectDisplay = start.effect_measure === 'RR' || start.effect_measure === 'OR' || start.effect_measure === 'HR'
    ? `${Math.exp(selectedModel.combined_effect).toFixed(3)} (95% CI: ${Math.exp(selectedModel.combined_ci_lower).toFixed(3)} - ${Math.exp(selectedModel.combined_ci_upper).toFixed(3)})`
    : `${selectedModel.combined_effect.toFixed(3)} (95% CI: ${selectedModel.combined_ci_lower.toFixed(3)} - ${selectedModel.combined_ci_upper.toFixed(3)})`;
  
  markdown += `| 指标 | 值 |\n`;
  markdown += `|------|-----|\n`;
  markdown += `| 合并效应量 | ${effectDisplay} |\n`;
  markdown += `| Z统计量 | ${selectedModel.z_statistic.toFixed(3)} |\n`;
  markdown += `| P值 | ${selectedModel.combined_p_value < 0.001 ? '<0.001' : selectedModel.combined_p_value.toFixed(3)} |\n`;
  markdown += `| 统计学显著性 | ${selectedModel.combined_p_value < 0.05 ? '✅ 显著' : '❌ 不显著'} |\n\n`;
  
  // 异质性检验
  markdown += `## 异质性检验\n\n`;
  const I2Percent = (selectedModel.heterogeneity.I2 * 100).toFixed(1);
  const heterogeneityLevel = selectedModel.heterogeneity.I2 < 0.25 ? '低' 
    : selectedModel.heterogeneity.I2 < 0.5 ? '中等'
    : selectedModel.heterogeneity.I2 < 0.75 ? '较高' : '高';
  
  markdown += `| 指标 | 值 |\n`;
  markdown += `|------|-----|\n`;
  markdown += `| Q统计量 | ${selectedModel.heterogeneity.Q.toFixed(2)} |\n`;
  markdown += `| 自由度 | ${selectedModel.heterogeneity.df} |\n`;
  markdown += `| I² | ${I2Percent}% (${heterogeneityLevel}异质性) |\n`;
  if (selectedModel.model_type === 'random') {
    markdown += `| τ² | ${selectedModel.heterogeneity.tau2.toFixed(4)} |\n`;
  }
  markdown += `| 异质性P值 | ${selectedModel.heterogeneity.p_value < 0.001 ? '<0.001' : selectedModel.heterogeneity.p_value.toFixed(3)} |\n\n`;
  
  // 研究详情
  markdown += `## 纳入研究\n\n`;
  markdown += `| 研究 | 效应量(95%CI) | 权重(%) |\n`;
  markdown += `|------|--------------|---------|\n`;
  selectedModel.studies.forEach(study => {
    const effectValue = start.effect_measure === 'RR' || start.effect_measure === 'OR' || start.effect_measure === 'HR'
      ? Math.exp(study.effect_size).toFixed(2)
      : study.effect_size.toFixed(2);
    const ciLower = start.effect_measure === 'RR' || start.effect_measure === 'OR' || start.effect_measure === 'HR'
      ? Math.exp(study.ci_lower).toFixed(2)
      : study.ci_lower.toFixed(2);
    const ciUpper = start.effect_measure === 'RR' || start.effect_measure === 'OR' || start.effect_measure === 'HR'
      ? Math.exp(study.ci_upper).toFixed(2)
      : study.ci_upper.toFixed(2);
    
    markdown += `| ${study.study_name} | ${effectValue} (${ciLower}-${ciUpper}) | ${study.weight.toFixed(1)} |\n`;
  });
  
  // 结果解读
  markdown += `\n## 结果解读\n\n`;
  markdown += `### 主要发现\n${interpret_results.main_findings}\n\n`;
  markdown += `### 效应量解读\n${interpret_results.effect_interpretation}\n\n`;
  markdown += `### 异质性解读\n${interpret_results.heterogeneity_interpretation}\n\n`;
  markdown += `### 临床意义\n${interpret_results.clinical_significance}\n\n`;
  
  if (interpret_results.limitations && interpret_results.limitations.length > 0) {
    markdown += `### 局限性\n`;
    interpret_results.limitations.forEach((l, i) => {
      markdown += `${i + 1}. ${l}\n`;
    });
    markdown += '\n';
  }
  
  markdown += `### 结论\n${interpret_results.conclusions}\n`;
  
  return {
    json: {
      model_type: selectedModel.model_type,
      combined_effect: selectedModel.combined_effect,
      combined_ci: [selectedModel.combined_ci_lower, selectedModel.combined_ci_upper],
      p_value: selectedModel.combined_p_value,
      heterogeneity: selectedModel.heterogeneity,
      studies: selectedModel.studies,
      interpretation: interpret_results,
      fixed_model: fixedModel,
      random_model: randomModel
    },
    markdown
  };
}
```


#### 8. 结束 (end)


---

