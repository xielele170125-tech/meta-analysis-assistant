/**
 * 效应模型推荐API
 * 根据文献分类结果自动推荐使用固定效应还是随机效应模型
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const client = getSupabaseClient();

/**
 * GET /api/literature/effect-model-recommendation
 * 获取基于分类结果的效应模型推荐
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dimensionId = searchParams.get('dimensionId');
    const category = searchParams.get('category');

    if (!dimensionId) {
      return NextResponse.json({ error: '请提供维度ID' }, { status: 400 });
    }

    // 获取该维度下的分类结果
    let query = client
      .from('literature_classifications')
      .select(`
        *,
        literature:literature_id (title, authors, year)
      `)
      .eq('dimension_id', dimensionId);

    if (category) {
      query = query.eq('category', category);
    }

    const { data: classifications, error } = await query;

    if (error) throw error;

    if (!classifications || classifications.length === 0) {
      return NextResponse.json({
        recommendation: 'insufficient_data',
        message: '该维度下没有已分类的文献',
        details: null,
      });
    }

    // 分析分类结果，推荐效应模型
    const analysis = analyzeClassifications(classifications);

    return NextResponse.json({
      success: true,
      data: {
        dimensionId,
        category,
        totalLiterature: classifications.length,
        ...analysis,
      },
    });
  } catch (error) {
    console.error('Effect model recommendation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '推荐失败' },
      { status: 500 }
    );
  }
}

/**
 * 分析分类结果，推荐效应模型
 */
function analyzeClassifications(classifications: any[]) {
  // 统计研究类型
  const studyTypes: Record<string, number> = {};
  // 统计有对照组的文献
  let withControlGroup = 0;
  // 统计效应模型推荐
  const modelRecommendations: Record<string, number> = {
    fixed: 0,
    random: 0,
    uncertain: 0,
  };
  // 统计置信度分布
  const confidenceLevels = {
    high: 0, // >= 0.8
    medium: 0, // 0.6-0.8
    low: 0, // < 0.6
  };
  // 对比组信息
  const comparisonGroupsSet = new Set<string>();

  classifications.forEach(c => {
    // 研究类型统计
    const studyType = c.study_type || 'unknown';
    studyTypes[studyType] = (studyTypes[studyType] || 0) + 1;

    // 有对照组的文献
    if (c.has_control_group) {
      withControlGroup++;
      // 收集对比组信息
      if (c.comparison_groups && Array.isArray(c.comparison_groups)) {
        c.comparison_groups.forEach((g: string) => comparisonGroupsSet.add(g));
      }
    }

    // 效应模型推荐统计
    const modelRec = c.effect_model_recommendation || 'uncertain';
    modelRecommendations[modelRec] = (modelRecommendations[modelRec] || 0) + 1;

    // 置信度分布
    const conf = c.confidence || 0;
    if (conf >= 0.8) confidenceLevels.high++;
    else if (conf >= 0.6) confidenceLevels.medium++;
    else confidenceLevels.low++;
  });

  // 综合推荐效应模型
  let finalRecommendation: 'fixed' | 'random' | 'uncertain';
  let recommendationReason: string;

  const totalValid = classifications.filter(c => c.effect_model_recommendation !== 'uncertain').length;
  const fixedRatio = modelRecommendations.fixed / (totalValid || 1);
  const randomRatio = modelRecommendations.random / (totalValid || 1);

  // 判断逻辑
  if (totalValid === 0) {
    finalRecommendation = 'uncertain';
    recommendationReason = '文献数量不足或未识别出研究类型，无法确定效应模型';
  } else if (fixedRatio >= 0.7) {
    finalRecommendation = 'fixed';
    recommendationReason = `${Math.round(fixedRatio * 100)}%的研究设计相似，异质性可能较小，推荐使用固定效应模型`;
  } else if (randomRatio >= 0.5) {
    finalRecommendation = 'random';
    recommendationReason = `${Math.round(randomRatio * 100)}%的研究存在异质性风险，推荐使用随机效应模型`;
  } else {
    finalRecommendation = 'random';
    recommendationReason = '研究设计混合，建议保守使用随机效应模型';
  }

  // 异质性评估
  const heterogeneityAssessment = assessHeterogeneity(classifications, studyTypes, withControlGroup);

  return {
    recommendation: finalRecommendation,
    recommendationReason,
    statistics: {
      total: classifications.length,
      studyTypes,
      withControlGroup,
      controlGroupRatio: Math.round((withControlGroup / classifications.length) * 100) + '%',
      modelRecommendations,
      confidenceLevels,
      comparisonGroups: Array.from(comparisonGroupsSet),
    },
    heterogeneityAssessment,
    suggestedAnalysis: {
      canDoSubgroupAnalysis: Object.keys(studyTypes).length > 1,
      canDoNetworkMeta: withControlGroup >= 3,
      suggestedSubgroups: Object.keys(studyTypes),
    },
  };
}

/**
 * 评估异质性
 */
function assessHeterogeneity(
  classifications: any[],
  studyTypes: Record<string, number>,
  withControlGroup: number
) {
  const factors: string[] = [];
  let heterogeneityLevel: 'low' | 'moderate' | 'high' = 'low';

  // 研究类型多样性
  const typeCount = Object.keys(studyTypes).length;
  if (typeCount > 2) {
    factors.push(`研究类型多样（${typeCount}种）`);
    heterogeneityLevel = 'high';
  } else if (typeCount > 1) {
    factors.push(`研究类型混合（${typeCount}种）`);
    heterogeneityLevel = 'moderate';
  }

  // 对照组设置
  const total = classifications.length;
  if (withControlGroup > 0 && withControlGroup < total) {
    factors.push('部分文献缺乏对照组');
    if (heterogeneityLevel === 'low') heterogeneityLevel = 'moderate';
  }

  // 置信度分布
  const lowConfidence = classifications.filter(c => (c.confidence || 0) < 0.6).length;
  if (lowConfidence > total * 0.3) {
    factors.push('较多文献分类置信度较低');
    heterogeneityLevel = 'high';
  }

  return {
    level: heterogeneityLevel,
    factors,
    suggestion: heterogeneityLevel === 'high' 
      ? '建议进行亚组分析或敏感性分析以探索异质性来源'
      : heterogeneityLevel === 'moderate'
        ? '建议关注异质性，可考虑亚组分析'
        : '研究间异质性可能较小，可直接进行合并分析',
  };
}
