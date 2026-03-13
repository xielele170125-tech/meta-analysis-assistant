# Coze 工作流配置指南

本文档包含5个核心工作流配置，用于将Meta分析智能体的AI能力迁移到Coze平台。

## 📁 工作流清单

| 文件名 | 功能 | 输入 | 输出 |
|--------|------|------|------|
| `01-search-query-generation.json` | 检索式生成 | 研究问题 | 多数据库检索式 |
| `02-literature-screening.json` | 文献初筛 | 文献列表 | 筛选结果 |
| `03-data-extraction.json` | 数据提取 | 文献内容 | 结构化数据 |
| `04-quality-assessment.json` | 质量评估 | 文献内容 | 偏倚风险/质量评分 |
| `05-meta-analysis.json` | Meta分析 | 研究数据 | 合并效应量、异质性 |

## 🚀 快速开始

### 第一步：在Coze创建Bot

1. 登录 [Coze平台](https://www.coze.cn)
2. 点击「创建Bot」
3. 填写基本信息：
   - 名称：`文献Meta分析助手`
   - 简介：`专业的医学文献Meta分析AI助手`
   - 图标：选择医学/科研图标

### 第二步：配置人设

在「人设与回复逻辑」中粘贴以下内容：

```
你是一位专业的循证医学研究助手，精通Meta分析方法论。

## 核心能力
1. 文献检索：根据研究问题生成PICO/PECO框架检索式
2. 文献筛选：AI辅助判断文献相关性
3. 数据提取：从文献中提取研究数据
4. 质量评估：使用Cochrane RoB 2.0等量表评估
5. Meta分析：固定/随机效应模型分析

## 工作流程
- 用户提出研究问题 → 引导生成检索式
- 用户上传文献 → 自动分类和筛选
- 用户请求数据提取 → 引导提取关键信息
- 用户请求分析 → 执行Meta分析并展示结果

## 沟通风格
- 专业但易懂
- 主动引导用户完成步骤
- 提供详细解释和建议
```

### 第三步：创建工作流

#### 方法1：手动创建（推荐新手）

以「检索式生成」工作流为例：

1. 在Bot配置页 → 点击「工作流」→「创建工作流」
2. 命名为 `search_query_generation`
3. 添加节点：

```
开始节点
├─ 输入变量：research_question（研究问题）
├─ 输入变量：search_strategy（检索策略，默认precise）

LLM节点
├─ 模型：选择扣子内置模型或配置的DeepSeek
├─ System Prompt：（从01-search-query-generation.json复制）
├─ User Prompt：研究问题：{{start.research_question}}

代码节点
├─ 功能：格式化输出为Markdown
├─ 代码：（从JSON文件复制）

结束节点
├─ 输出：result（JSON格式）
├─ 输出：markdown（Markdown格式）
```

#### 方法2：通过API导入（高级）

```bash
# 安装Coze CLI
npm install -g @coze/cli

# 导入工作流
coze workflow import --file 01-search-query-generation.json --bot-id YOUR_BOT_ID
```

## 📝 各工作流详细说明

### 1️⃣ 检索式生成工作流

**用途**：根据研究问题自动生成PubMed、EMBASE、Cochrane等专业检索式

**输入参数**：
```json
{
  "research_question": "胚胎植入前遗传学检测对IVF结局的影响",
  "framework_type": "auto",  // PICO/PECO/SPIDER/auto
  "search_strategy": "precise"  // precise/sensitive/limited
}
```

**输出示例**：
```markdown
# 文献检索式生成结果

## 研究框架
类型：PICO

### P - 人群
不孕症患者、接受IVF治疗的患者
MeSH词：Infertility, In Vitro Fertilization

### I - 干预
胚胎植入前遗传学检测（PGT）
MeSH词：Preimplantation Genetic Testing

## 检索式

### PubMed
```
("Preimplantation Genetic Testing"[MeSH] OR "PGT"[TIAB] OR "PGD"[TIAB])
AND ("In Vitro Fertilization"[MeSH] OR "IVF"[TIAB])
AND ("pregnancy rate"[TIAB] OR "live birth"[TIAB])
```
预估结果：100-500篇
```

### 2️⃣ 文献初筛工作流

**用途**：AI自动判断文献是否与研究问题相关

**输入参数**：
```json
{
  "research_question": "研究问题",
  "articles": [
    {
      "pmid": "12345678",
      "title": "文献标题",
      "abstract": "摘要内容"
    }
  ],
  "inclusion_criteria": ["纳入标准1"],  // 可选
  "exclusion_criteria": ["排除标准1"]   // 可选
}
```

**输出示例**：
```markdown
# 文献初筛结果

## 筛选结果统计
- 总文献数：50
- ✅ 明确纳入：35 (70%)
- ❓ 需进一步判断：10 (20%)
- ❌ 明确排除：5 (10%)
```

### 3️⃣ 数据提取工作流

**用途**：从文献全文中提取Meta分析所需的定量数据

**输入参数**：
```json
{
  "literature_content": "文献全文或摘要",
  "research_question": "研究问题",
  "outcome_of_interest": "临床妊娠率"  // 可选
}
```

**输出示例**：
```markdown
# 数据提取结果

## 提取数据表

| 研究 | 结局指标 | 干预组 | 对照组 | 效应量(95%CI) | 置信度 |
|------|---------|--------|--------|--------------|--------|
| Zhang(2023) | 临床妊娠率 | 45/100 | 30/100 | 1.50 (1.05-2.14) | 85% |
| Li(2022) | 临床妊娠率 | 60/120 | 40/120 | 1.50 (1.10-2.04) | 90% |
```

### 4️⃣ 质量评估工作流

**用途**：使用国际标准量表评估文献质量

**输入参数**：
```json
{
  "literature_content": "文献全文",
  "study_type": "rct",  // rct/cohort/case_control
  "tool": "auto"        // rob2/nos/auto
}
```

**输出示例（RCT）**：
```markdown
# 文献质量评估结果

## 偏倚风险评估

### D1: 随机化过程
判断：✅ low

- D1.1 分配序列是否真正随机？✅ low
  - 回答：使用计算机随机数生成器
- D1.2 分配序列是否被隐藏？✅ low
  - 回答：使用不透明信封隐藏

## 总体评估
✅ LOW - 总体偏倚风险低
```

### 5️⃣ Meta分析工作流

**用途**：执行固定/随机效应模型Meta分析

**输入参数**：
```json
{
  "studies": [
    {
      "id": "study_1",
      "study_name": "Zhang(2023)",
      "effect_size": 0.405,  // log(RR)
      "standard_error": 0.182,
      "sample_size_treatment": 100,
      "sample_size_control": 100
    }
  ],
  "model_type": "auto",  // fixed/random/auto
  "effect_measure": "RR"  // RR/OR/HR/SMD/MD
}
```

**输出示例**：
```markdown
# Meta分析结果报告

## 合并效应量

| 指标 | 值 |
|------|-----|
| 合并效应量 | 1.50 (95% CI: 1.20 - 1.88) |
| P值 | <0.001 |
| 统计学显著性 | ✅ 显著 |

## 异质性检验

| 指标 | 值 |
|------|-----|
| I² | 35.2% (中等异质性) |
| 异质性P值 | 0.12 |

## 结果解读
主要发现：干预组相比对照组显著提高了临床妊娠率...
```

## 🔧 高级配置

### 配置DeepSeek模型（推荐）

Coze支持配置自定义LLM，建议使用DeepSeek以获得更好的医学推理能力：

1. 在Bot配置页 → 模型配置 → 添加自定义模型
2. 填写API信息：
   ```
   API地址：https://api.deepseek.com/v1
   API Key：您的DeepSeek API Key
   模型名称：deepseek-chat 或 deepseek-reasoner
   ```

### 连接数据库（可选）

如果需要持久化存储，可以连接Supabase：

1. 在Bot配置页 → 插件 → 添加「HTTP Request」插件
2. 配置Supabase API：
   ```javascript
   // 示例：保存检索式
   POST https://your-project.supabase.co/rest/v1/search_queries
   Headers: {
     "apikey": "your-anon-key",
     "Content-Type": "application/json"
   }
   Body: {
     "query": "{{generated_query}}",
     "database": "pubmed"
   }
   ```

### 发布到多平台

Coze支持一键发布到：

- **飞书机器人**：适合团队协作
- **微信公众号**：适合大众服务
- **抖音私信**：适合内容创作者
- **企业微信**：适合企业内部使用

## 💡 最佳实践

### 1. 工作流串联

可以创建主工作流，串联各个子工作流：

```
用户输入研究问题
    ↓
调用「检索式生成」工作流
    ↓
展示检索式，询问是否继续
    ↓
调用「文献初筛」工作流
    ↓
调用「数据提取」工作流
    ↓
调用「Meta分析」工作流
    ↓
生成完整报告
```

### 2. 错误处理

在每个工作流中添加错误处理节点：

```javascript
// 代码节点：错误处理
async function main({ previousNode }) {
  if (previousNode.error) {
    return {
      success: false,
      error: previousNode.error,
      suggestion: "请检查输入数据格式"
    };
  }
  return previousNode;
}
```

### 3. 用户引导

在Bot人设中添加引导逻辑：

```
## 交互流程
1. 用户首次对话 → 询问研究问题
2. 识别意图：
   - 检索式生成 → 调用search_query_generation工作流
   - 文献筛选 → 调用screening工作流
   - 数据提取 → 调用extraction工作流
   - 质量评估 → 调用quality_assessment工作流
   - Meta分析 → 调用meta_analysis工作流
3. 结果展示 → 询问是否需要进一步操作
```

## 📞 技术支持

如有问题，请参考：
- [Coze官方文档](https://www.coze.cn/docs)
- [Coze社区](https://www.coze.cn/community)

## 📄 许可证

本配置代码遵循MIT许可证，可自由使用和修改。
