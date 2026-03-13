import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// Cochrane RoB 2.0 评估提示词
const ROB2_PROMPT = `你是一位专业的系统综述方法学专家。请根据Cochrane偏倚风险评估工具2.0版(RoB 2.0)对以下随机对照试验(RCT)进行质量评估。

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

## 输出格式

请严格按照以下JSON格式输出：

\`\`\`json
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
\`\`\`

## 总体风险判断规则
- 低风险(Low): 所有域均为低风险
- 有些担忧(Some concerns): 至少一个域为有些担忧，但没有高风险域
- 高风险(High): 至少一个域为高风险，或多个域为有些担忧

请评估以下文献：

---
文献内容：
`;

// Newcastle-Ottawa量表评估提示词
const NOS_PROMPT = `你是一位专业的系统综述方法学专家。请根据Newcastle-Ottawa量表(NOS)对以下观察性研究进行质量评估。

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

## 输出格式

请严格按照以下JSON格式输出：

\`\`\`json
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
  "total_score": 0-9,
  "max_score": 9,
  "overall_risk": "low/some_concerns/high",
  "overall_reason": "总体质量判断理由",
  "confidence": 0.0-1.0
}
\`\`\`

## 总体风险判断规则
- 低风险(Low): 总分≥7星
- 有些担忧(Some concerns): 总分4-6星
- 高风险(High): 总分≤3星

请评估以下文献：

---
文献内容：
`;

/**
 * 对文献进行质量评分
 * POST /api/quality-assessment
 * Body: { literatureId, scaleType, apiKey }
 */
export async function POST(request: NextRequest) {
  try {
    const { literatureId, scaleType, apiKey } = await request.json();

    if (!literatureId || !scaleType || !apiKey) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证量表类型
    const validScales = ['rob2', 'nos', 'quadas2'];
    if (!validScales.includes(scaleType)) {
      return NextResponse.json({ error: '无效的量表类型，支持: rob2, nos, quadas2' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 获取文献信息
    const { data: literature, error: litError } = await client
      .from('literature')
      .select('*')
      .eq('id', literatureId)
      .single();

    if (litError || !literature) {
      return NextResponse.json({ error: '文献不存在' }, { status: 404 });
    }

    if (!literature.raw_content) {
      // 尝试重新解析文件
      if (!literature.file_key) {
        return NextResponse.json({ error: '文献内容为空且无文件，无法进行评估' }, { status: 400 });
      }
      
      try {
        // 重新获取文件URL
        const { S3Storage, FetchClient, Config } = await import('coze-coding-dev-sdk');
        const storage = new S3Storage({
          endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
          accessKey: '',
          secretKey: '',
          bucketName: process.env.COZE_BUCKET_NAME,
          region: 'cn-beijing',
        });
        
        const fileUrl = await storage.generatePresignedUrl({
          key: literature.file_key,
          expireTime: 3600,
        });
        
        // 使用 FetchClient 重新解析文件
        const config = new Config();
        const fetchClient = new FetchClient(config);
        const fetchResult = await fetchClient.fetch(fileUrl);
        
        const rawContent = fetchResult.content
          .filter((item) => item.type === 'text')
          .map((item) => item.text)
          .join('\n') || '';
        
        if (!rawContent) {
          return NextResponse.json({ error: '无法从文件中提取内容' }, { status: 400 });
        }
        
        // 更新文献的 raw_content
        await client
          .from('literature')
          .update({ raw_content: rawContent })
          .eq('id', literatureId);
        
        literature.raw_content = rawContent;
      } catch (parseError) {
        console.error('Re-parse error:', parseError);
        return NextResponse.json({ error: '文献内容为空，尝试重新解析失败' }, { status: 400 });
      }
    }

    // 选择对应的提示词
    let prompt: string;
    let studyType: string;
    
    switch (scaleType) {
      case 'rob2':
        prompt = ROB2_PROMPT;
        studyType = 'rct';
        break;
      case 'nos':
        prompt = NOS_PROMPT;
        studyType = 'cohort';
        break;
      case 'quadas2':
        // 暂时使用NOS作为诊断试验的简化版本
        prompt = NOS_PROMPT;
        studyType = 'diagnostic';
        break;
      default:
        prompt = ROB2_PROMPT;
        studyType = 'rct';
    }

    try {
      // 调用 DeepSeek API 进行评估
      // 使用 deepseek-chat 模型，配合优化的 prompt 确保评估质量
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://api.deepseek.com',
      });

      // 根据量表类型定制系统提示词
      let systemPrompt = '';
      if (scaleType === 'rob2') {
        systemPrompt = `你是一位资深的系统综述方法学专家，精通Cochrane RoB 2.0偏倚风险评估工具。

## 评估原则
1. **证据导向**：所有判断必须基于文献中的具体描述，不能凭空推测
2. **保守评估**：当信息不明确时，倾向于"有些担忧"而非直接判断"低风险"
3. **详细记录**：为每个判断提供文献中的具体依据
4. **一致性**：总体风险判断需与各域判断相符

## 判断标准详解
- **D1 随机化过程**：
  - 若未描述随机方法 → some_concerns
  - 若明确说明"随机数字表"、"计算机生成"等 → low
  - 若使用"交替分配"、"按入院顺序"等 → high
  
- **D2 偏离预期干预**：
  - 开放性研究（无盲法）需评估是否影响结果
  - 若实施了盲法但未描述破盲情况 → some_concerns
  
- **D3 结局数据缺失**：
  - 失访率<5%且描述了原因 → low
  - 失访率5-20% → some_concerns
  - 失访率>20%或未描述 → high
  
- **D4 结局测量**：
  - 客观指标（如死亡率）可降低盲法要求
  - 主观指标必须有盲法评估
  
- **D5 结果报告选择性**：
  - 有预注册方案且结果一致 → low
  - 未发现预注册方案 → some_concerns
  - 明显的选择性报告 → high

## 总体风险判断
- **Low**：所有域均为low
- **Some concerns**：至少一个域为some concerns，无high
- **High**：至少一个域为high，或多个域为some concerns

请确保每个判断都有文献依据，answer字段需引用文献原文或说明"文献未提及"。`;
      } else if (scaleType === 'nos') {
        systemPrompt = `你是一位资深的系统综述方法学专家，精通Newcastle-Ottawa量表(NOS)用于观察性研究质量评估。

## 评估原则
1. **证据导向**：所有判断必须基于文献中的具体描述
2. **严格评分**：只有明确符合标准的才能获得星星，信息不明确不得分
3. **详细记录**：每个评分需说明文献依据
4. **合理判断**：根据研究设计特点合理评估

## 评分标准详解
**选择组 (Selection) - 最多4星**
- S1: 真正的人群代表性才得满分，医院样本需无选择偏倚才可得星
- S2: 非暴露组必须与暴露组来自同一人群才得星
- S3: 仅安全记录或结构化访谈可得星
- S4: 必须明确说明研究开始时无结局才得星

**可比性组 (Comparability) - 最多2星**
- C1: 必须明确说明控制了年龄等核心混杂因素
- C2: 需说明控制了其他重要混杂因素

**结局组 (Outcome) - 最多3星**
- O1: 盲法评估或记录链接才得星
- O2: 随访时间需足以观察到结局
- O3: 失访率<5%才得星，5-20%得半星，>20%不得分

## 质量等级判定
- **Low risk (高质量)**: ≥7星
- **Some concerns (中等质量)**: 4-6星  
- **High risk (低质量)**: ≤3星

请确保每个评分都有文献依据，answer字段需引用文献原文或说明"文献未提及"。`;
      } else {
        systemPrompt = `你是一位专业的系统综述方法学专家，请严格按照量表要求进行质量评估。所有判断必须基于文献证据，信息不明确时保持保守态度。`;
      }

      const response = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt + literature.raw_content.substring(0, 30000),
          },
        ],
        max_tokens: 4000,
        temperature: 0.1, // 极低温度，确保输出稳定性和一致性
      });

      const content = response.choices[0]?.message?.content || '';
      
      // 解析 JSON
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) {
        throw new Error('无法从响应中提取 JSON 数据');
      }

      const assessment = JSON.parse(jsonMatch[1]);

      // 计算总分（针对NOS量表）
      let totalScore = null;
      let maxScore = null;
      if (scaleType === 'nos' && assessment.domains) {
        totalScore = assessment.total_score || 
          (assessment.domains.selection?.earned_stars || 0) +
          (assessment.domains.comparability?.earned_stars || 0) +
          (assessment.domains.outcome?.earned_stars || 0);
        maxScore = assessment.max_score || 9;
      }

      // 保存评估结果
      const { data: savedAssessment, error: saveError } = await client
        .from('quality_assessment')
        .upsert({
          literature_id: literatureId,
          scale_type: scaleType,
          study_type: assessment.study_type || studyType,
          total_score: totalScore,
          max_score: maxScore,
          domain_scores: assessment.domains,
          overall_risk: assessment.overall_risk,
          reasoning: assessment.overall_reason,
          confidence: assessment.confidence,
        }, { onConflict: 'literature_id,scale_type' })
        .select()
        .single();

      if (saveError) {
        console.error('Save assessment error:', saveError);
        return NextResponse.json({ error: '保存评估结果失败' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: {
          literatureId,
          scaleType,
          assessment: savedAssessment,
          reasoning: (response as any).reasoning_content || null,
        },
      });
    } catch (evalError) {
      console.error('Assessment error:', evalError);
      return NextResponse.json({ 
        error: '评估失败: ' + (evalError instanceof Error ? evalError.message : '未知错误') 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Quality assessment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理失败' },
      { status: 500 }
    );
  }
}

/**
 * 获取质量评估结果
 * GET /api/quality-assessment?literatureId=xxx&scaleType=rob2
 */
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const literatureId = searchParams.get('literatureId');
    const scaleType = searchParams.get('scaleType');

    if (!literatureId) {
      // 获取所有评估结果，关联文献信息
      const { data, error } = await client
        .from('quality_assessment')
        .select(`
          *,
          literature:literature_id (
            id,
            title,
            authors,
            year
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }

    let query = client
      .from('quality_assessment')
      .select(`
        *,
        literature:literature_id (
          id,
          title,
          authors,
          year
        )
      `)
      .eq('literature_id', literatureId);

    if (scaleType) {
      query = query.eq('scale_type', scaleType);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get quality assessment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}

/**
 * 删除质量评估结果
 * DELETE /api/quality-assessment?id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少评估ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { error } = await client.from('quality_assessment').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete quality assessment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
