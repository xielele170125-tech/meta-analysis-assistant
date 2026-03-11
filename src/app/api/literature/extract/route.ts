import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// DeepSeek 数据提取提示词
const EXTRACTION_PROMPT = `你是一位专业的Meta分析数据提取专家。请从以下文献内容中提取Meta分析所需的数据。

请仔细阅读文献，提取以下信息（如果文献中包含多个研究，请分别提取）：

1. **研究名称/标识**：通常是作者名+年份
2. **样本量**：
   - 治疗组样本量 (n_treatment)
   - 对照组样本量 (n_control)
3. **连续型结局指标**（如果适用）：
   - 治疗组均值 (mean_treatment)
   - 治疗组标准差 (sd_treatment)
   - 对照组均值 (mean_control)
   - 对照组标准差 (sd_control)
4. **二分类结局指标**（如果适用）：
   - 治疗组事件数 (events_treatment)
   - 对照组事件数 (events_control)
5. **结局类型**：主要结局还是次要结局
6. **置信度评分**：你对提取结果的确信程度 (0-1)

请以JSON格式返回提取的数据，格式如下：
{
  "studies": [
    {
      "study_name": "作者(年份)",
      "sample_size_treatment": 数字,
      "sample_size_control": 数字,
      "mean_treatment": 数字或null,
      "sd_treatment": 数字或null,
      "mean_control": 数字或null,
      "sd_control": 数字或null,
      "events_treatment": 数字或null,
      "events_control": 数字或null,
      "outcome_type": "结局描述",
      "confidence": 0.0-1.0,
      "notes": "任何需要注意的问题"
    }
  ]
}

如果文献中包含多个不同的结局指标，请在studies数组中分别列出。

重要提示：
- 只提取明确报告的数据，不要推测或计算
- 如果数据不完整，请如实记录并说明
- 注意区分干预组和对照组
- 对于表格中的数据，请仔细核对行列对应关系

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
      sample_size_control: number | null;
      mean_treatment: number | null;
      sd_treatment: number | null;
      mean_control: number | null;
      sd_control: number | null;
      events_treatment: number | null;
      events_control: number | null;
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

      return processed;
    });

    // 保存提取的数据到数据库
    if (processedStudies.length > 0) {
      const dataToInsert = processedStudies.map((study) => ({
        literature_id: literatureId,
        study_name: study.study_name,
        sample_size_treatment: study.sample_size_treatment,
        sample_size_control: study.sample_size_control,
        mean_treatment: study.mean_treatment,
        mean_control: study.mean_control,
        sd_treatment: study.sd_treatment,
        sd_control: study.sd_control,
        events_treatment: study.events_treatment,
        events_control: study.events_control,
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
