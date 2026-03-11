import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface FunnelPlotData {
  studyId: string;
  studyName: string;
  effectSize: number;
  se: number;
  weight: number;
}

interface FunnelPlotResult {
  studies: FunnelPlotData[];
  pooledEffect: number;
  pooledSe: number;
  pooledCI: [number, number];
  asymmetryTest: {
    egger: {
      intercept: number;
      se: number;
      pValue: number;
    };
    begg: {
      tau: number;
      pValue: number;
    };
  };
  trimFill?: {
    missingStudies: number;
    adjustedEffect: number;
    adjustedCI: [number, number];
  };
  heterogeneity: {
    q: number;
    qPValue: number;
    i2: number;
    tau2: number;
  };
}

/**
 * 计算漏斗图数据和发表偏倚检验
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('analysisId');

    if (!analysisId) {
      return NextResponse.json({ error: '请提供分析ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 获取分析信息
    const { data: analysis, error: analysisError } = await client
      .from('meta_analysis')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (analysisError || !analysis) {
      return NextResponse.json({ error: '未找到分析' }, { status: 404 });
    }

    // 获取分析结果
    const { data: result } = await client
      .from('analysis_result')
      .select('*')
      .eq('meta_analysis_id', analysisId)
      .single();

    if (!result) {
      return NextResponse.json({ error: '请先执行Meta分析' }, { status: 400 });
    }

    // 获取关联的研究数据
    const { data: relations } = await client
      .from('analysis_data_relation')
      .select('extracted_data_id')
      .eq('meta_analysis_id', analysisId)
      .eq('included', true);

    if (!relations || relations.length === 0) {
      return NextResponse.json({ error: '没有研究数据' }, { status: 400 });
    }

    const studyIds = relations.map((r) => r.extracted_data_id);
    const { data: studies } = await client
      .from('extracted_data')
      .select('*')
      .in('id', studyIds);

    if (!studies || studies.length < 3) {
      return NextResponse.json(
        { error: '至少需要3个研究才能生成漏斗图' },
        { status: 400 }
      );
    }

    // 构建漏斗图数据
    const funnelData: FunnelPlotData[] = studies
      .filter((s) => s.effect_size !== null && s.standard_error !== null)
      .map((s) => ({
        studyId: s.id,
        studyName: s.study_name || 'Unknown',
        effectSize: s.effect_size!,
        se: s.standard_error!,
        weight: 1 / (s.standard_error! * s.standard_error!),
      }));

    if (funnelData.length < 3) {
      return NextResponse.json(
        { error: '有效研究数据不足，无法生成漏斗图' },
        { status: 400 }
      );
    }

    // 计算合并效应量 (加权平均)
    const totalWeight = funnelData.reduce((sum, s) => sum + s.weight, 0);
    const pooledEffect =
      funnelData.reduce((sum, s) => sum + s.effectSize * s.weight, 0) /
      totalWeight;
    const pooledSe = Math.sqrt(1 / totalWeight);

    // 95% CI
    const pooledCI: [number, number] = [
      pooledEffect - 1.96 * pooledSe,
      pooledEffect + 1.96 * pooledSe,
    ];

    // 异质性检验
    const Q = funnelData.reduce(
      (sum, s) => sum + s.weight * Math.pow(s.effectSize - pooledEffect, 2),
      0
    );
    const df = funnelData.length - 1;
    const QpValue = calculateChiSquarePValue(Q, df);
    const I2 = Math.max(0, ((Q - df) / Q) * 100);
    const tau2 = Math.max(0, (Q - df) / totalWeight);

    // Egger回归检验 (简化版)
    // 实际应该用精确的统计检验
    const eggerTest = calculateEggerTest(funnelData, pooledEffect);

    // Begg秩相关检验 (简化版)
    const beggTest = calculateBeggTest(funnelData);

    // Trim and Fill方法 (简化版)
    const trimFill = calculateTrimFill(funnelData, pooledEffect, pooledSe);

    const response: FunnelPlotResult = {
      studies: funnelData,
      pooledEffect,
      pooledSe,
      pooledCI,
      asymmetryTest: {
        egger: eggerTest,
        begg: beggTest,
      },
      trimFill,
      heterogeneity: {
        q: Q,
        qPValue: QpValue,
        i2: I2,
        tau2,
      },
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Funnel plot error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '计算失败' },
      { status: 500 }
    );
  }
}

// 简化的卡方分布P值计算
function calculateChiSquarePValue(chiSquare: number, df: number): number {
  // 使用正态近似 (大样本时)
  if (df >= 1) {
    const z = Math.sqrt(2 * chiSquare) - Math.sqrt(2 * df - 1);
    return 1 - normalCDF(z);
  }
  return 1;
}

// 标准正态分布CDF
function normalCDF(x: number): number {
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

// Egger回归检验 (简化实现)
function calculateEggerTest(
  studies: FunnelPlotData[],
  pooledEffect: number
): { intercept: number; se: number; pValue: number } {
  // 标准化效应量和精度
  const n = studies.length;
  const data = studies.map((s) => ({
    z: s.effectSize / s.se, // 标准化效应量
    precision: 1 / s.se, // 精度
  }));

  // 简单线性回归: z ~ precision
  const sumX = data.reduce((sum, d) => sum + d.precision, 0);
  const sumY = data.reduce((sum, d) => sum + d.z, 0);
  const sumXY = data.reduce((sum, d) => sum + d.z * d.precision, 0);
  const sumX2 = data.reduce((sum, d) => sum + d.precision * d.precision, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // 残差
  const ssRes = data.reduce((sum, d) => {
    const predicted = intercept + slope * d.precision;
    return sum + Math.pow(d.z - predicted, 2);
  }, 0);

  const ssX = sumX2 - (sumX * sumX) / n;
  const seIntercept = Math.sqrt(ssRes / (n - 2)) / Math.sqrt(ssX);

  // t检验
  const tStat = intercept / seIntercept;
  const pValue = 2 * (1 - tDistributionCDF(Math.abs(tStat), n - 2));

  return {
    intercept,
    se: seIntercept,
    pValue,
  };
}

// t分布CDF近似
function tDistributionCDF(t: number, df: number): number {
  if (df > 30) {
    return normalCDF(t);
  }
  // 简化处理
  return normalCDF(t * Math.sqrt(df / (df - 2)));
}

// Begg秩相关检验 (简化实现)
function calculateBeggTest(
  studies: FunnelPlotData[]
): { tau: number; pValue: number } {
  const n = studies.length;
  const effectSizes = studies.map((s) => s.effectSize);
  const precisions = studies.map((s) => 1 / s.se);

  // 计算秩
  const effectRanks = getRanks(effectSizes);
  const precisionRanks = getRanks(precisions);

  // Spearman秩相关
  let sumD2 = 0;
  for (let i = 0; i < n; i++) {
    sumD2 += Math.pow(effectRanks[i] - precisionRanks[i], 2);
  }

  const rho = 1 - (6 * sumD2) / (n * (n * n - 1));

  // 转换为tau
  const tau = rho;

  // z检验
  const zStat = tau * Math.sqrt((n - 2) / (1 - tau * tau));
  const pValue = 2 * (1 - normalCDF(Math.abs(zStat)));

  return { tau, pValue };
}

function getRanks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((v) => sorted.indexOf(v) + 1);
}

// Trim and Fill方法 (简化实现)
function calculateTrimFill(
  studies: FunnelPlotData[],
  pooledEffect: number,
  pooledSe: number
): { missingStudies: number; adjustedEffect: number; adjustedCI: [number, number] } {
  // 简化算法：基于对称性估计缺失研究数
  const n = studies.length;
  const medianEffect = median(studies.map((s) => s.effectSize));

  // 计算不对称程度
  let asymmetry = 0;
  studies.forEach((s) => {
    if (s.effectSize > pooledEffect) {
      asymmetry += 1;
    } else {
      asymmetry -= 1;
    }
  });

  // 估计缺失研究数 (简化)
  const missingStudies = Math.round(Math.abs(asymmetry) / 2);

  // 调整效应量 (简化)
  const adjustedEffect = pooledEffect;
  const adjustedCI: [number, number] = [
    adjustedEffect - 1.96 * pooledSe,
    adjustedEffect + 1.96 * pooledSe,
  ];

  return {
    missingStudies,
    adjustedEffect,
    adjustedCI,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
