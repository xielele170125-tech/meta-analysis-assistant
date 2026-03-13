# 📖 PROMPTS.md 使用指南

## 文件位置
```
coze-workflows/PROMPTS.md
```

## 文件结构速览

这个文件包含**5个工作流**的Prompt配置：

---

## 📋 工作流1：文献检索式生成

### 位置：第1-200行左右

**包含内容：**
- **节点1：解析研究框架**
  - System Prompt：解释PICO/PECO/SPIDER框架
  - User Prompt：输入研究问题
  
- **节点2：生成检索式**
  - System Prompt：生成PubMed/EMBASE/Cochrane检索式
  - User Prompt：根据要素生成检索式

**在Coze创建时：**
```
工作流名称：search_query_generation
节点数量：2个LLM节点
输入变量：research_question, search_strategy
```

---

## 📋 工作流2：文献AI初筛

### 位置：第201-270行左右

**包含内容：**
- **节点1：生成筛选标准**
  - System Prompt：生成纳入/排除标准
  - User Prompt：研究问题

**在Coze创建时：**
```
工作流名称：literature_screening
节点数量：1个LLM节点（+迭代节点）
输入变量：research_question, articles
```

---

## 📋 工作流3：文献数据提取

### 位置：第271-400行左右

**包含内容：**
- **节点1：提取数据**
  - System Prompt：详细的数据提取指南
  - User Prompt：文献内容

**在Coze创建时：**
```
工作流名称：data_extraction
节点数量：1个LLM节点
输入变量：literature_content, research_question
```

---

## 📋 工作流4：文献质量评估

### 位置：第401-600行左右

**包含内容：**
- **节点1：Cochrane RoB 2.0评估**（RCT用）
  - System Prompt：5个域的偏倚风险评估
  - User Prompt：文献内容
  
- **节点2：Newcastle-Ottawa评估**（观察性研究用）
  - System Prompt：选择/可比性/结局评分
  - User Prompt：文献内容

**在Coze创建时：**
```
工作流名称：quality_assessment
节点数量：2个LLM节点（根据study_type选择）
输入变量：literature_content, study_type
```

---

## 📋 工作流5：Meta分析计算

### 位置：第601-末尾

**包含内容：**
- **节点1：解读分析结果**
  - System Prompt：效应量和异质性解读
  - User Prompt：分析结果数据

**在Coze创建时：**
```
工作流名称：meta_analysis
节点数量：主要是代码节点（LLM用于解读）
输入变量：studies, effect_measure, model_type
```

---

## 🚀 快速使用方法

### 步骤1：确定要创建哪个工作流
例如：先创建"文献检索式生成"

### 步骤2：在PROMPTS.md中定位
找到对应的章节：
```
## 文献检索式生成
```

### 步骤3：复制Prompt
- 复制 **System Prompt** 部分
- 复制 **User Prompt** 部分

### 步骤4：粘贴到Coze
在Coze平台的LLM节点配置中粘贴

---

## 💡 复制粘贴技巧

### 技巧1：准确定位
```
System Prompt 部分标识：
**System Prompt** (复制以下内容):

User Prompt 部分标识：
**User Prompt** (复制以下内容):
```

### 技巧2：完整复制
确保复制完整的代码块，包括：
```json
{
  ...
}
```

### 技巧3：变量替换
注意User Prompt中的变量格式：
```
{{start.research_question}}
{{start.literature_content}}
```
这些是工作流的输入变量，在Coze中会自动识别

---

## 📊 文件统计

```
总行数：约650行
工作流数量：5个
Prompt节点总数：约10个
每个Prompt长度：约50-200行
```

---

## 🎯 推荐阅读顺序

1. **先看这个指南**（PROMPTS_GUIDE.md）了解结构
2. **再看完整文件**（PROMPTS.md）了解内容
3. **然后创建工作流**，边创建边复制

---

## 📞 需要帮助？

如果您：
- 不知道某个Prompt对应哪个节点
- 不知道如何粘贴到Coze
- 不确定变量如何配置

随时告诉我，我可以详细指导！
