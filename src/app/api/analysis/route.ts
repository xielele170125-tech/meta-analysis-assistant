import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 有效研究数据类型（确保非null）
interface ValidStudy {
  id: string;
  study_name: string;
  effect_size: number;
  standard_error: number;
  sample_size_treatment: number | null;
  sample_size_control: number | null;
}

interface MetaAnalysisResult {
  combinedEffect: number;
  combinedSe: number;
  combinedCiLower: number;
  combinedCiUpper: number;
  combinedPValue: number;
  heterogeneityQ: number;
  heterogeneityI2: number;
  heterogeneityTau2: number;
  heterogeneityPValue: number;
  modelType: 'fixed' | 'random';
  studies: Array<{
    id: string;
    studyName: string;
    effectSize: number;
    se: number;
    weight: number;
    ciLower: number;
    ciUpper: number;
  }>;
}

// 固定效应模型
function fixedEffectModel(studies: ValidStudy[]): MetaAnalysisResult {
  if (studies.length === 0) {
    throw new Error('没有有效的研究数据');
  }

  // 计算权重 (w = 1/SE^2)
  const weights = studies.map((s) => 1 / (s.standard_error * s.standard_error));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // 加权平均效应量
  const combinedEffect =
    studies.reduce((sum, s, i) => sum + weights[i] * s.effect_size, 0) / totalWeight;

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
  const Q = studies.reduce(
    (sum, s, i) => sum + weights[i] * Math.pow(s.effect_size - combinedEffect, 2),
    0
  );

  // I² 统计量
  const df = studies.length - 1;
  const I2 = Q > 0 ? Math.max(0, ((Q - df) / Q)) : 0;

  // 异质性P值
  const heterogeneityPValue = 1 - chiSquareCDF(Q, df);

  // 构建结果
  return {
    combinedEffect,
    combinedSe,
    combinedCiLower,
    combinedCiUpper,
    combinedPValue,
    heterogeneityQ: Q,
    heterogeneityI2: I2,
    heterogeneityTau2: 0,
    heterogeneityPValue,
    modelType: 'fixed',
    studies: studies.map((s, i) => ({
      id: s.id,
      studyName: s.study_name,
      effectSize: s.effect_size,
      se: s.standard_error,
      weight: (weights[i] / totalWeight) * 100,
      ciLower: s.effect_size - 1.96 * s.standard_error,
      ciUpper: s.effect_size + 1.96 * s.standard_error,
    })),
  };
}

// 随机效应模型 (DerSimonian-Laird)
function randomEffectModel(studies: ValidStudy[]): MetaAnalysisResult {
  if (studies.length === 0) {
    throw new Error('没有有效的研究数据');
  }

  // 首先用固定效应模型计算Q统计量
  const fixedWeights = studies.map(
    (s) => 1 / (s.standard_error * s.standard_error)
  );
  const fixedTotalWeight = fixedWeights.reduce((a, b) => a + b, 0);
  const fixedEffect =
    studies.reduce((sum, s, i) => sum + fixedWeights[i] * s.effect_size, 0) /
    fixedTotalWeight;

  const Q = studies.reduce(
    (sum, s, i) => sum + fixedWeights[i] * Math.pow(s.effect_size - fixedEffect, 2),
    0
  );

  // 计算 τ² (DerSimonian-Laird方法)
  const df = studies.length - 1;
  const C = fixedTotalWeight;
  const sumWSquared = fixedWeights.reduce((sum, w) => sum + w * w, 0);
  const tau2 = Math.max(0, (Q - df) / (C - sumWSquared / C));

  // 重新计算权重 (包含τ²)
  const weights = studies.map(
    (s) => 1 / (s.standard_error * s.standard_error + tau2)
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // 加权平均效应量
  const combinedEffect =
    studies.reduce((sum, s, i) => sum + weights[i] * s.effect_size, 0) / totalWeight;

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
  const I2 = Q > 0 ? Math.max(0, ((Q - df) / Q)) : 0;

  // 异质性P值
  const heterogeneityPValue = 1 - chiSquareCDF(Q, df);

  return {
    combinedEffect,
    combinedSe,
    combinedCiLower,
    combinedCiUpper,
    combinedPValue,
    heterogeneityQ: Q,
    heterogeneityI2: I2,
    heterogeneityTau2: tau2,
    heterogeneityPValue,
    modelType: 'random',
    studies: studies.map((s, i) => ({
      id: s.id,
      studyName: s.study_name,
      effectSize: s.effect_size,
      se: s.standard_error,
      weight: (weights[i] / totalWeight) * 100,
      ciLower: s.effect_size - 1.96 * s.standard_error,
      ciUpper: s.effect_size + 1.96 * s.standard_error,
    })),
  };
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

// 卡方分布CDF (使用近似)
function chiSquareCDF(x: number, df: number): number {
  if (x <= 0) return 0;

  // 使用Wilson-Hilferty近似转换为正态分布
  const y = Math.pow(x / df, 1 / 3);
  const mu = 1 - 2 / (9 * df);
  const sigma = Math.sqrt(2 / (9 * df));

  return normalCDF((y - mu) / sigma);
}

// 创建Meta分析项目
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = getSupabaseClient();

    // 创建分析项目
    const { data: analysis, error: analysisError } = await client
      .from('meta_analysis')
      .insert({
        name: body.name,
        description: body.description,
        analysis_type: body.analysisType || 'continuous',
        effect_measure: body.effectMeasure || 'SMD',
        model_type: body.modelType || 'random',
        status: 'running',
      })
      .select()
      .single();

    if (analysisError) {
      return NextResponse.json({ error: analysisError.message }, { status: 500 });
    }

    // 获取要包含的研究数据
    const { data: studies, error: studiesError } = await client
      .from('extracted_data')
      .select('*')
      .in('id', body.studyIds);

    if (studiesError || !studies || studies.length === 0) {
      return NextResponse.json({ error: '没有有效的研究数据' }, { status: 400 });
    }

    // 创建关联
    const relations = body.studyIds.map((studyId: string) => ({
      meta_analysis_id: analysis.id,
      extracted_data_id: studyId,
      included: true,
    }));

    await client.from('analysis_data_relation').insert(relations);

    // 过滤有效数据并转换类型
    const validStudies: ValidStudy[] = studies
      .filter((s) => s.effect_size !== null && s.standard_error !== null)
      .map((s) => ({
        id: s.id,
        study_name: s.study_name || '未命名研究',
        effect_size: s.effect_size as number,
        standard_error: s.standard_error as number,
        sample_size_treatment: s.sample_size_treatment,
        sample_size_control: s.sample_size_control,
      }));

    if (validStudies.length < 2) {
      return NextResponse.json({ error: '需要至少2项有效研究' }, { status: 400 });
    }

    // 执行Meta分析
    const result =
      body.modelType === 'fixed'
        ? fixedEffectModel(validStudies)
        : randomEffectModel(validStudies);

    // 保存结果
    const { data: resultData, error: resultError } = await client
      .from('analysis_result')
      .insert({
        meta_analysis_id: analysis.id,
        combined_effect: result.combinedEffect,
        combined_se: result.combinedSe,
        combined_ci_lower: result.combinedCiLower,
        combined_ci_upper: result.combinedCiUpper,
        combined_p_value: result.combinedPValue,
        heterogeneity_q: result.heterogeneityQ,
        heterogeneity_i2: result.heterogeneityI2,
        heterogeneity_tau2: result.heterogeneityTau2,
        heterogeneity_p_value: result.heterogeneityPValue,
        forest_plot_data: result.studies,
      })
      .select()
      .single();

    if (resultError) {
      console.error('Save result error:', resultError);
    }

    // 更新分析状态
    await client
      .from('meta_analysis')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', analysis.id);

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        result: resultData || result,
      },
    });
  } catch (error) {
    console.error('Meta analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '分析失败' },
      { status: 500 }
    );
  }
}

// 获取分析结果
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // 获取单个分析结果
      const { data: analysis, error: analysisError } = await client
        .from('meta_analysis')
        .select('*')
        .eq('id', id)
        .single();

      if (analysisError) {
        return NextResponse.json({ error: analysisError.message }, { status: 500 });
      }

      // 获取分析结果
      const { data: results } = await client
        .from('analysis_result')
        .select('*')
        .eq('meta_analysis_id', id);

      // 获取关联的研究
      const { data: relations } = await client
        .from('analysis_data_relation')
        .select('extracted_data_id')
        .eq('meta_analysis_id', id);

      let studies: unknown[] = [];
      if (relations && relations.length > 0) {
        const studyIds = relations.map((r) => r.extracted_data_id);
        const { data: studyData } = await client
          .from('extracted_data')
          .select('*')
          .in('id', studyIds);
        studies = studyData || [];
      }

      return NextResponse.json({
        success: true,
        data: { 
          analysis: { ...analysis, analysis_result: results?.[0] || null }, 
          studies 
        },
      });
    } else {
      // 获取所有分析
      const { data: analyses, error } = await client
        .from('meta_analysis')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // 获取所有分析结果
      const analysisIds = analyses?.map((a) => a.id) || [];
      const { data: results } = await client
        .from('analysis_result')
        .select('*')
        .in('meta_analysis_id', analysisIds);

      // 合并数据
      const formattedData = analyses?.map((item) => {
        const result = results?.find((r) => r.meta_analysis_id === item.id);
        return {
          ...item,
          result: result ? {
            combined_effect: result.combined_effect,
            combined_ci_lower: result.combined_ci_lower,
            combined_ci_upper: result.combined_ci_upper,
            combined_p_value: result.combined_p_value,
            heterogeneity_i2: result.heterogeneity_i2,
            forest_plot_data: result.forest_plot_data,
          } : undefined,
        };
      });

      return NextResponse.json({ success: true, data: formattedData });
    }
  } catch (error) {
    console.error('Get analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}
