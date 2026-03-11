import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// DeepSeek 数据提取提示词 - 优化版
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

### 4. 结局指标
- 明确标注是什么结局指标（如"非整倍体率"、"临床妊娠率"等）

### 5. 数据提取注意事项
- 如果文献包含多个不同的结局指标，请分别提取
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
      "outcome_type": "结局指标名称，如'非整倍体率'",
      "confidence": 0.0-1.0,
      "notes": "任何需要说明的问题，如数据缺失、单位转换等"
    }
  ]
}
\`\`\`

## 示例
如果表格显示：
| 组别 | 胚胎总数 | 非整倍体胚胎数 | 非整倍体率 |
|------|---------|---------------|-----------|
| PGT-A组 | 156 | 23 | 14.7% |
| 对照组 | 189 | 52 | 27.5% |

应提取为：
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
    "confidence": 0.95
  }]
}
\`\`\`

请开始提取以下文献：

---
文献内容：
`;

export async function POST(request: NextRequest) {
  try {
    const { literatureId, content, apiKey } = await request.json();

    if (!content || !apiKey || !literatureId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 更新文献状态为提取中
    const client = getSupabaseClient();
    await client
      .from('literature')
      .update({ status: 'extracting' })
      .eq('id', literatureId);

    // 调用 DeepSeek API
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
          content: EXTRACTION_PROMPT + content,
        },
      ],
    });

    const responseContent = completion.choices[0].message.content || '';
    // DeepSeek Reasoner 返回的推理内容（需要类型断言）
    const message = completion.choices[0].message as { content: string | null; reasoning_content?: string };
    const reasoning = message.reasoning_content || '';

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
      confidence: number;
      notes: string | null;
    }> = [];

    try {
      // 尝试从响应中提取JSON
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

        // 计算合并标准差
        const pooledSD = Math.sqrt(
          ((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2)
        );

        // Cohen's d (SMD)
        const smd = (m1 - m2) / pooledSD;

        // 标准误
        const se = Math.sqrt((n1 + n2) / (n1 * n2) + smd * smd / (2 * (n1 + n2)));

        // 95% CI
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
        const a = study.events_treatment;
        const b = study.sample_size_treatment - a;
        const c = study.events_control;
        const d = study.sample_size_control - c;

        const correction = (a === 0 || b === 0 || c === 0 || d === 0) ? 0.5 : 0;
        const aAdj = a + correction;
        const bAdj = b + correction;
        const cAdj = c + correction;
        const dAdj = d + correction;

        const logOR = Math.log((aAdj * dAdj) / (bAdj * cAdj));
        const se = Math.sqrt(1/aAdj + 1/bAdj + 1/cAdj + 1/dAdj);
        const z = 1.96;
        const ciLower = logOR - z * se;
        const ciUpper = logOR + z * se;

        if (!processed.effect_size) {
          processed.effect_size = logOR;
          processed.standard_error = se;
          processed.ci_lower = ciLower;
          processed.ci_upper = ciUpper;
        }
      }

      return processed;
    });

    // 保存提取的数据到数据库
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
        outcome_type: study.outcome_type,
        confidence: study.confidence,
        notes: study.notes,
      }));

      await client.from('extracted_data').insert(dataToInsert);
    }

    // 更新文献状态为完成
    await client
      .from('literature')
      .update({
        status: 'completed',
        raw_content: content.substring(0, 50000), // 限制存储大小
        updated_at: new Date().toISOString(),
      })
      .eq('id', literatureId);

    return NextResponse.json({
      success: true,
      data: {
        studies: processedStudies,
        reasoning: reasoning,
        rawResponse: responseContent,
      },
    });
  } catch (error) {
    console.error('Extraction error:', error);

    // 更新文献状态为失败
    try {
      const clonedRequest = request.clone();
      const body = await clonedRequest.json();
      const { literatureId } = body;
      if (literatureId) {
        const client = getSupabaseClient();
        await client
          .from('literature')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : '提取失败',
            updated_at: new Date().toISOString(),
          })
          .eq('id', literatureId);
      }
    } catch {
      // 忽略解析错误
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : '提取失败' },
      { status: 500 }
    );
  }
}
