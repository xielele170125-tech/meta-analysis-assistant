import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

// DeepSeek 数据提取提示词 - 优化版（含结局指标标准化和亚组识别）
const EXTRACTION_PROMPT = `你是一位专业的Meta分析数据提取专家。请从以下文献内容中仔细提取Meta分析所需的数据。

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

#### 类型A：连续型变量（均值±标准差）
提取：
- 治疗组均值、标准差
- 对照组均值、标准差
- 注意单位是否一致

#### 类型B：二分类变量（事件数/总数）
提取：
- 治疗组事件数及事件名称（如"非整倍体胚胎数"、"妊娠数"等）
- 对照组事件数及事件名称
- 样本量名称（如"胚胎总数"、"周期总数"等）

#### 类型C：已计算的效应量
如果文献直接报告了：
- OR值/RR值/HR值及其95%CI
- 均值差及其95%CI
- 请在notes中说明

### 4. 结局指标处理（重要！）

#### 4.1 结局指标标准化（使用国际通用术语）
不同文献可能用不同名称表示相同含义的指标，请统一标准化为以下国际通用术语：

**标准化对照表（按领域分类）：**

**生殖医学/IVF领域：**

| 标准化英文名称 | 标准化中文名称 | 可能的原始名称形式 |
|--------------|--------------|------------------|
| Live Birth Rate | 活产率 | 活产率、活产成功率、live birth rate、LBR、累积活产率、cumulative live birth rate |
| Clinical Pregnancy Rate | 临床妊娠率 | 临床妊娠率、妊娠率、clinical pregnancy rate、CPR |
| Biochemical Pregnancy Rate | 生化妊娠率 | 生化妊娠率、生化率、biochemical pregnancy rate |
| Implantation Rate | 种植率 | 种植率、着床率、implantation rate |
| Miscarriage Rate | 流产率 | 流产率、自然流产率、早期流产率、miscarriage rate、spontaneous abortion rate |
| Ongoing Pregnancy Rate | 持续妊娠率 | 持续妊娠率、ongoing pregnancy rate |
| Multiple Pregnancy Rate | 多胎妊娠率 | 多胎妊娠率、multiple pregnancy rate |
| Ectopic Pregnancy Rate | 异位妊娠率 | 异位妊娠率、宫外孕率、ectopic pregnancy rate |

**胚胎/配子相关：**

| 标准化英文名称 | 标准化中文名称 | 可能的原始名称形式 |
|--------------|--------------|------------------|
| Aneuploidy Rate | 非整倍体率 | 非整倍体率、染色体异常率、aneuploidy rate、染色体异常发生率 |
| Fertilization Rate | 受精率 | 受精率、正常受精率、fertilization rate、2PN率 |
| Cleavage Rate | 卵裂率 | 卵裂率、分裂率、cleavage rate |
| Blastocyst Formation Rate | 囊胚形成率 | 囊胚形成率、囊胚率、blastocyst formation rate |
| Good Quality Embryo Rate | 优质胚胎率 | 优胚率、优质胚胎率、good quality embryo rate、可用胚胎率 |
| Blastocyst Utilization Rate | 囊胚利用率 | 囊胚利用率、blastocyst utilization rate |

**周期/移植相关：**

| 标准化英文名称 | 标准化中文名称 | 可能的原始名称形式 |
|--------------|--------------|------------------|
| Cycle Cancellation Rate | 周期取消率 | 周期取消率、cycle cancellation rate |
| Oocyte Retrieval Rate | 获卵率 | 获卵率、oocyte retrieval rate |
| Embryo Transfer Rate | 胚胎移植率 | 胚胎移植率、embryo transfer rate |

**标准化规则：**
1. 优先使用国际通用英文名称作为主名称
2. 中文文献使用"英文名称 (中文名称)"格式，如 "Live Birth Rate (活产率)"
3. 请保留原始名称（outcome_type_raw）
4. 同时提供标准化名称（outcome_type_standardized）
5. 如果不在上述对照表中，请根据含义自行标准化，遵循国际惯例

#### 4.2 亚组识别（非常重要！）
如果同一文献报告了多个相同结局指标但针对不同人群/分组，请识别亚组：

**常见亚组类型：**
- 年龄分组：Advanced maternal age (≥35岁) vs Young age (<35岁)
- 周期类型：First cycle vs Repeated cycle
- 胚胎类型：Blastocyst vs Cleavage stage embryo
- 卵子来源：Autologous vs Donor oocytes
- 精子来源：Autologous vs Donor sperm
- 移植周期类型：Per transfer vs Per retrieval (每次移植 vs 每次取卵)
- 其他特定分组
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

\`\`\`json
{
  "studies": [
    {
      "study_name": "作者(年份)",
      "sample_size_treatment": 数字,
      "sample_size_treatment_name": "样本量名称，如'胚胎总数'",
      "sample_size_control": 数字,
      "sample_size_control_name": "样本量名称",
      "mean_treatment": 数字或null,
      "sd_treatment": 数字或null,
      "mean_control": 数字或null,
      "sd_control": 数字或null,
      "events_treatment": 数字或null,
      "events_treatment_name": "事件名称，如'非整倍体胚胎数'",
      "events_control": 数字或null,
      "events_control_name": "事件名称",
      "outcome_type": "结局指标名称（标准化后的名称）",
      "outcome_type_raw": "原始结局指标名称",
      "outcome_type_standardized": "标准化后的结局指标名称",
      "subgroup": "亚组名称，如'高龄组'，无亚组则填null",
      "subgroup_detail": "亚组详细描述，如'女性年龄≥35岁'",
      "confidence": 0.0-1.0,
      "notes": "任何需要说明的问题"
    }
  ]
}
\`\`\`

## 示例

### 示例1：简单情况
表格显示：
| 组别 | 胚胎总数 | 非整倍体胚胎数 | 非整倍体率 |
|------|---------|---------------|-----------|
| PGT-A组 | 156 | 23 | 14.7% |
| 对照组 | 189 | 52 | 27.5% |

提取为：
\`\`\`json
{
  "studies": [{
    "study_name": "作者(年份)",
    "sample_size_treatment": 156,
    "sample_size_treatment_name": "胚胎总数",
    "sample_size_control": 189,
    "sample_size_control_name": "胚胎总数",
    "events_treatment": 23,
    "events_treatment_name": "非整倍体胚胎数",
    "events_control": 52,
    "events_control_name": "非整倍体胚胎数",
    "outcome_type": "非整倍体率",
    "outcome_type_raw": "非整倍体率",
    "outcome_type_standardized": "非整倍体率",
    "subgroup": null,
    "subgroup_detail": null,
    "confidence": 0.95
  }]
}
\`\`\`

### 示例2：含亚组的情况
表格显示不同年龄组的临床妊娠率：
| 组别 | 高龄组(≥35岁)周期数 | 高龄组妊娠数 | 高龄组妊娠率 | 年轻组(<35岁)周期数 | 年轻组妊娠数 | 年轻组妊娠率 |
|------|-------------------|------------|------------|-------------------|------------|------------|
| PGT-A组 | 45 | 18 | 40.0% | 82 | 42 | 51.2% |
| 对照组 | 52 | 12 | 23.1% | 78 | 28 | 35.9% |

应提取为两项：
\`\`\`json
{
  "studies": [
    {
      "study_name": "作者(年份)",
      "sample_size_treatment": 45,
      "sample_size_treatment_name": "周期数",
      "sample_size_control": 52,
      "sample_size_control_name": "周期数",
      "events_treatment": 18,
      "events_treatment_name": "妊娠数",
      "events_control": 12,
      "events_control_name": "妊娠数",
      "outcome_type": "临床妊娠率",
      "outcome_type_raw": "临床妊娠率",
      "outcome_type_standardized": "临床妊娠率",
      "subgroup": "高龄组",
      "subgroup_detail": "女性年龄≥35岁",
      "confidence": 0.90
    },
    {
      "study_name": "作者(年份)",
      "sample_size_treatment": 82,
      "sample_size_treatment_name": "周期数",
      "sample_size_control": 78,
      "sample_size_control_name": "周期数",
      "events_treatment": 42,
      "events_treatment_name": "妊娠数",
      "events_control": 28,
      "events_control_name": "妊娠数",
      "outcome_type": "临床妊娠率",
      "outcome_type_raw": "临床妊娠率",
      "outcome_type_standardized": "临床妊娠率",
      "subgroup": "年轻组",
      "subgroup_detail": "女性年龄<35岁",
      "confidence": 0.90
    }
  ]
}
\`\`\`

请开始提取以下文献：

---
文献内容：
`;

/**
 * 异步处理文献：解析 + 数据提取
 * POST /api/literature/process
 * Body: { literatureId, fileUrl, apiKey }
 */
export async function POST(request: NextRequest) {
  try {
    const { literatureId, fileUrl, apiKey } = await request.json();

    if (!literatureId || !fileUrl) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 更新状态为解析中
    await client
      .from('literature')
      .update({ status: 'parsing' })
      .eq('id', literatureId);

    // 1. 解析文件
    let textContent = '';
    try {
      const config = new Config();
      const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
      const fetchClient = new FetchClient(config, customHeaders);
      const response = await fetchClient.fetch(fileUrl);

      if (response.status_code === 0) {
        textContent = response.content
          .filter((item) => item.type === 'text')
          .map((item) => item.text)
          .join('\n');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      await client
        .from('literature')
        .update({ 
          status: 'error', 
          error_message: '文件解析失败' 
        })
        .eq('id', literatureId);
      return NextResponse.json({ error: '文件解析失败' }, { status: 500 });
    }

    if (!textContent || textContent.length < 100) {
      await client
        .from('literature')
        .update({ 
          status: 'error', 
          error_message: '无法提取有效文本内容' 
        })
        .eq('id', literatureId);
      return NextResponse.json({ error: '无法提取有效文本内容' }, { status: 400 });
    }

    // 保存解析内容到数据库
    await client
      .from('literature')
      .update({ raw_content: textContent })
      .eq('id', literatureId);

    // 更新状态为提取中
    await client
      .from('literature')
      .update({ status: 'extracting' })
      .eq('id', literatureId);

    // 2. 调用 DeepSeek 提取数据
    if (!apiKey) {
      await client
        .from('literature')
        .update({ 
          status: 'error', 
          error_message: '未配置API Key' 
        })
        .eq('id', literatureId);
      return NextResponse.json({ error: '未配置API Key' }, { status: 400 });
    }

    try {
      const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: apiKey,
      });

      const completion = await openai.chat.completions.create({
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的Meta分析数据提取专家，擅长从医学文献中提取结构化数据。',
          },
          {
            role: 'user',
            content: EXTRACTION_PROMPT + textContent,
          },
        ],
      });

      const responseContent = completion.choices[0].message.content || '';

      // 解析JSON结果
      let extractedStudies: Array<{
        study_name: string;
        sample_size_treatment: number | null;
        sample_size_treatment_name: string | null;
        sample_size_control: number | null;
        sample_size_control_name: string | null;
        mean_treatment: number | null;
        sd_treatment: number | null;
        mean_control: number | null;
        sd_control: number | null;
        events_treatment: number | null;
        events_treatment_name: string | null;
        events_control: number | null;
        events_control_name: string | null;
        outcome_type: string | null;
        outcome_type_raw: string | null;
        outcome_type_standardized: string | null;
        subgroup: string | null;
        subgroup_detail: string | null;
        confidence: number;
        notes: string | null;
      }> = [];

      try {
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          extractedStudies = parsed.studies || [];
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
      }

      // 计算效应量和标准误
      const processedStudies = extractedStudies.map((study) => {
        const processed: Record<string, unknown> = { ...study };

        // 连续型变量：计算标准化均数差 (SMD) 和标准误
        if (
          study.mean_treatment !== null &&
          study.sd_treatment !== null &&
          study.mean_control !== null &&
          study.sd_control !== null &&
          study.sample_size_treatment &&
          study.sample_size_control
        ) {
          const n1 = study.sample_size_treatment;
          const n2 = study.sample_size_control;
          const m1 = study.mean_treatment;
          const m2 = study.mean_control;
          const s1 = study.sd_treatment;
          const s2 = study.sd_control;

          const pooledSD = Math.sqrt(
            ((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2)
          );

          const smd = (m1 - m2) / pooledSD;
          const se = Math.sqrt((n1 + n2) / (n1 * n2) + smd * smd / (2 * (n1 + n2)));
          const z = 1.96;
          const ciLower = smd - z * se;
          const ciUpper = smd + z * se;

          processed.effect_size = smd;
          processed.standard_error = se;
          processed.ci_lower = ciLower;
          processed.ci_upper = ciUpper;
        }

        // 二分类变量：计算 Log Odds Ratio 和标准误
        if (
          study.events_treatment !== null &&
          study.events_control !== null &&
          study.sample_size_treatment &&
          study.sample_size_control
        ) {
          const a = study.events_treatment; // 治疗组事件数
          const b = study.sample_size_treatment - a; // 治疗组非事件数
          const c = study.events_control; // 对照组事件数
          const d = study.sample_size_control - c; // 对照组非事件数

          // 添加0.5连续性校正（如果有零单元格）
          const correction = (a === 0 || b === 0 || c === 0 || d === 0) ? 0.5 : 0;
          const aAdj = a + correction;
          const bAdj = b + correction;
          const cAdj = c + correction;
          const dAdj = d + correction;

          // Log Odds Ratio
          const logOR = Math.log((aAdj * dAdj) / (bAdj * cAdj));
          // 标准误
          const se = Math.sqrt(1/aAdj + 1/bAdj + 1/cAdj + 1/dAdj);
          // 95% CI
          const z = 1.96;
          const ciLower = logOR - z * se;
          const ciUpper = logOR + z * se;

          // 如果之前没有连续型数据的效应量，使用OR
          if (!processed.effect_size) {
            processed.effect_size = logOR;
            processed.standard_error = se;
            processed.ci_lower = ciLower;
            processed.ci_upper = ciUpper;
          }
        }

        return processed;
      });

      // 保存提取的数据
      if (processedStudies.length > 0) {
        const dataToInsert = processedStudies.map((study) => ({
          literature_id: literatureId,
          study_name: study.study_name,
          sample_size_treatment: study.sample_size_treatment,
          sample_size_treatment_name: study.sample_size_treatment_name,
          sample_size_control: study.sample_size_control,
          sample_size_control_name: study.sample_size_control_name,
          mean_treatment: study.mean_treatment,
          mean_control: study.mean_control,
          sd_treatment: study.sd_treatment,
          sd_control: study.sd_control,
          events_treatment: study.events_treatment,
          events_treatment_name: study.events_treatment_name,
          events_control: study.events_control,
          events_control_name: study.events_control_name,
          effect_size: study.effect_size,
          standard_error: study.standard_error,
          ci_lower: study.ci_lower,
          ci_upper: study.ci_upper,
          outcome_type: study.outcome_type_standardized || study.outcome_type,
          outcome_type_raw: study.outcome_type_raw || study.outcome_type,
          outcome_type_standardized: study.outcome_type_standardized || study.outcome_type,
          subgroup: study.subgroup,
          subgroup_detail: study.subgroup_detail,
          confidence: study.confidence,
          notes: study.notes,
        }));

        await client.from('extracted_data').insert(dataToInsert);
      }

      // 更新状态为完成
      await client
        .from('literature')
        .update({
          status: 'completed',
          error_message: null,
        })
        .eq('id', literatureId);

      return NextResponse.json({
        success: true,
        data: {
          literatureId,
          studiesCount: processedStudies.length,
        },
      });
    } catch (extractError) {
      console.error('Extract error:', extractError);
      await client
        .from('literature')
        .update({
          status: 'error',
          error_message: extractError instanceof Error ? extractError.message : '数据提取失败',
        })
        .eq('id', literatureId);
      return NextResponse.json({ error: '数据提取失败' }, { status: 500 });
    }
  } catch (error) {
    console.error('Process error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理失败' },
      { status: 500 }
    );
  }
}
