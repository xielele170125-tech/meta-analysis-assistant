/**
 * 网状Meta分析API
 * 
 * 支持：
 * - 创建分析项目
 * - 获取分析列表
 * - 执行分析计算
 * - 获取分析结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  extractDirectComparisons,
  poolDirectComparisons,
  buildNetworkStructure,
  calculateNetworkComparisons,
  calculateSUCRA,
  performConsistencyTests,
  generateLeagueTable,
  type StudyData,
  type AnalysisConfig,
} from '@/lib/network-meta-analysis';

// ==================== GET: 获取网状分析列表或详情 ====================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const analysisId = searchParams.get('analysisId');
    const action = searchParams.get('action');

    const supabase = getSupabaseClient();

    // 支持两种参数名：id 或 analysisId
    const targetId = id || analysisId;

    if (targetId) {
      // 获取特定分析详情
      const { data: analysis, error } = await supabase
        .from('network_meta_analysis')
        .select('*')
        .eq('id', targetId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // 获取干预措施列表
      const { data: interventionsData } = await supabase
        .from('interventions')
        .select('*');

      // 获取直接比较数据
      const { data: directComparisonsData } = await supabase
        .from('direct_comparisons')
        .select('*')
        .eq('network_meta_analysis_id', targetId);

      // 获取排名数据
      const { data: rankingsData } = await supabase
        .from('treatment_rankings')
        .select('*')
        .eq('network_meta_analysis_id', targetId);

      // 获取网状结构
      const { data: structureData } = await supabase
        .from('network_structure')
        .select('*')
        .eq('network_meta_analysis_id', targetId)
        .single();

      // 获取一致性检验结果
      const { data: consistencyData } = await supabase
        .from('consistency_results')
        .select('*')
        .eq('network_meta_analysis_id', targetId);

      // 构建结果对象
      const result = {
        analysis,
        interventions: interventionsData || [],
        comparisons: (directComparisonsData || []).map(dc => ({
          id: dc.id,
          intervention_a_id: dc.intervention_a,
          intervention_b_id: dc.intervention_b,
          intervention_a: interventionsData?.find(i => i.id === dc.intervention_a || i.name === dc.intervention_a),
          intervention_b: interventionsData?.find(i => i.id === dc.intervention_b || i.name === dc.intervention_b),
          study_count: dc.study_count,
          total_sample_a: dc.sample_size_a,
          total_sample_b: dc.sample_size_b,
          total_events_a: dc.events_a,
          total_events_b: dc.events_b,
          direct_effect: dc.effect_size,
          direct_se: dc.standard_error,
          direct_ci_lower: dc.ci_lower,
          direct_ci_upper: dc.ci_upper,
          direct_p_value: dc.standard_error > 0 ? 2 * (1 - normalCDF(Math.abs(dc.effect_size || 0) / dc.standard_error)) : null,
        })),
        sucraResults: (rankingsData || []).map((r) => ({
          intervention_id: r.intervention,
          intervention: interventionsData?.find(i => i.id === r.intervention || i.name === r.intervention),
          sucra: r.sucra,
          rank_probability: r.rank_probabilities || [],
          mean_rank: r.mean_rank,
          median_rank: r.mean_rank,
        })),
        networkStructure: structureData ? {
          nodeCount: structureData.number_of_interventions,
          edgeCount: structureData.number_of_comparisons,
          density: structureData.number_of_interventions > 1 
            ? (2 * structureData.number_of_comparisons) / (structureData.number_of_interventions * (structureData.number_of_interventions - 1))
            : 0,
          hasClosedLoops: structureData.has_loops,
          connectedComponents: structureData.connectivity === 'connected' ? [[...new Set((structureData.nodes as any[]).map((n: any) => n.name))]] : [],
        } : null,
        consistencyResults: (consistencyData || []).map((cr) => ({
          testMethod: cr.test_method,
          loop: cr.loop_interventions,
          directEffect: cr.direct_effect,
          indirectEffect: cr.indirect_effect,
          difference: cr.difference,
          differenceSe: cr.difference_se,
          consistencyPValue: cr.p_value,
          isConsistent: cr.is_consistent,
          conclusion: cr.conclusion,
        })),
        leagueTable: null,
      };

      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'structure') {
      // 获取网状结构数据（用于可视化）
      const analysisId = searchParams.get('analysisId');
      if (!analysisId) {
        return NextResponse.json({ error: 'Missing analysisId' }, { status: 400 });
      }

      const { data: structure, error } = await supabase
        .from('network_structure')
        .select('*')
        .eq('network_meta_analysis_id', analysisId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: structure });
    }

    if (action === 'rankings') {
      // 获取排名数据
      const analysisId = searchParams.get('analysisId');
      if (!analysisId) {
        return NextResponse.json({ error: 'Missing analysisId' }, { status: 400 });
      }

      const { data: rankings, error } = await supabase
        .from('treatment_rankings')
        .select('*')
        .eq('network_meta_analysis_id', analysisId)
        .order('sucra', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: rankings });
    }

    if (action === 'league-table') {
      // 获取联盟表数据
      const analysisId = searchParams.get('analysisId');
      if (!analysisId) {
        return NextResponse.json({ error: 'Missing analysisId' }, { status: 400 });
      }

      // 获取干预列表和比较结果
      const [structureRes, comparisonsRes] = await Promise.all([
        supabase.from('network_structure').select('nodes').eq('network_meta_analysis_id', analysisId).single(),
        supabase.from('network_comparisons').select('*').eq('network_meta_analysis_id', analysisId),
      ]);

      if (structureRes.error || comparisonsRes.error) {
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
      }

      const nodes = structureRes.data.nodes as Array<{ id: string; name: string }>;
      const interventions = nodes.map(n => n.name);

      // 获取分析配置
      const { data: analysis } = await supabase
        .from('network_meta_analysis')
        .select('effectMeasure')
        .eq('id', analysisId)
        .single();

      const leagueTable = generateLeagueTable(
        comparisonsRes.data.map(c => ({
          interventionA: c.intervention_a,
          interventionB: c.intervention_b,
          networkEffectSize: c.network_effect_size,
          networkStandardError: c.network_standard_error,
          networkCiLower: c.network_ci_lower,
          networkCiUpper: c.network_ci_upper,
          pValue: c.p_value,
          comparisonType: c.comparison_type,
        })),
        interventions,
        analysis?.effectMeasure || 'OR'
      );

      return NextResponse.json({
        success: true,
        data: {
          interventions,
          table: leagueTable,
          effectMeasure: analysis?.effectMeasure || 'OR',
        },
      });
    }

    // 获取所有分析列表
    const { data: analyses, error } = await supabase
      .from('network_meta_analysis')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: analyses });
  } catch (error) {
    console.error('Network meta-analysis GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ==================== POST: 创建或执行分析 ====================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const supabase = getSupabaseClient();

    if (action === 'create') {
      // 创建新的网状分析项目
      const {
        name,
        description,
        outcomeType = 'binary',
        effectMeasure = 'OR',
        modelType = 'random',
        referenceIntervention,
      } = body;

      const { data, error } = await supabase
        .from('network_meta_analysis')
        .insert({
          name,
          description,
          outcome_type: outcomeType,
          effect_measure: effectMeasure,
          model_type: modelType,
          reference_intervention: referenceIntervention,
          status: 'draft',
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }

    if (action === 'add-data') {
      // 添加多臂试验数据
      const { analysisId, studies } = body as {
        analysisId: string;
        studies: StudyData[];
      };

      if (!analysisId || !studies || studies.length === 0) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // 插入多臂数据
      const multiArmData = studies.map(study => ({
        network_meta_analysis_id: analysisId,
        study_name: study.studyName,
        year: study.year,
        arms: study.arms,
        outcome_type: study.outcomeType,
      }));

      const { error } = await supabase
        .from('multi_arm_data')
        .insert(multiArmData);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: `Added ${studies.length} studies` });
    }

    if (action === 'run') {
      // 执行网状分析
      const { analysisId } = body;

      if (!analysisId) {
        return NextResponse.json({ error: 'Missing analysisId' }, { status: 400 });
      }

      // 更新状态为运行中
      await supabase
        .from('network_meta_analysis')
        .update({ status: 'running' })
        .eq('id', analysisId);

      try {
        // 获取分析配置
        const { data: analysis } = await supabase
          .from('network_meta_analysis')
          .select('*')
          .eq('id', analysisId)
          .single();

        if (!analysis) {
          throw new Error('Analysis not found');
        }

        // 获取多臂数据
        const { data: multiArmData } = await supabase
          .from('multi_arm_data')
          .select('*')
          .eq('network_meta_analysis_id', analysisId);

        if (!multiArmData || multiArmData.length === 0) {
          throw new Error('No data available for analysis');
        }

        // 转换为StudyData格式
        const studies: StudyData[] = multiArmData.map(d => ({
          studyName: d.study_name,
          year: d.year,
          arms: d.arms as StudyData['arms'],
          outcomeType: d.outcome_type,
        }));

        const config: AnalysisConfig = {
          effectMeasure: analysis.effect_measure as AnalysisConfig['effectMeasure'],
          modelType: analysis.model_type as AnalysisConfig['modelType'],
          referenceIntervention: analysis.reference_intervention,
          confidenceLevel: 0.95,
        };

        // 1. 提取直接比较
        const directComparisons = extractDirectComparisons(studies, config);

        // 保存直接比较结果
        if (directComparisons.length > 0) {
          await supabase.from('direct_comparisons').insert(
            directComparisons.map(dc => ({
              network_meta_analysis_id: analysisId,
              intervention_a: dc.interventionA,
              intervention_b: dc.interventionB,
              study_name: dc.studyName,
              effect_size: dc.effectSize,
              standard_error: dc.standardError,
              ci_lower: dc.ciLower,
              ci_upper: dc.ciUpper,
              sample_size_a: dc.sampleSizeA,
              sample_size_b: dc.sampleSizeB,
              events_a: dc.eventsA,
              events_b: dc.eventsB,
            }))
          );
        }

        // 2. 合并直接比较
        const pooledComparisons = poolDirectComparisons(directComparisons, config.modelType);

        // 3. 构建网状结构
        const networkStructure = buildNetworkStructure(studies, directComparisons);

        // 保存网状结构
        await supabase.from('network_structure').insert({
          network_meta_analysis_id: analysisId,
          number_of_interventions: networkStructure.numberOfInterventions,
          number_of_comparisons: networkStructure.numberOfComparisons,
          number_of_studies: networkStructure.numberOfStudies,
          has_loops: networkStructure.hasLoops,
          connectivity: networkStructure.connectivity,
          nodes: networkStructure.nodes,
          edges: networkStructure.edges,
        });

        // 4. 计算网状比较
        const interventions = networkStructure.nodes.map(n => n.name);
        const networkComparisons = calculateNetworkComparisons(
          pooledComparisons,
          interventions,
          config
        );

        // 保存网状比较结果
        if (networkComparisons.length > 0) {
          await supabase.from('network_comparisons').insert(
            networkComparisons.map(nc => ({
              network_meta_analysis_id: analysisId,
              intervention_a: nc.interventionA,
              intervention_b: nc.interventionB,
              network_effect_size: nc.networkEffectSize,
              network_standard_error: nc.networkStandardError,
              network_ci_lower: nc.networkCiLower,
              network_ci_upper: nc.networkCiUpper,
              p_value: nc.pValue,
              comparison_type: nc.comparisonType,
              direct_effect_size: nc.directEffectSize,
              direct_standard_error: nc.directStandardError,
              indirect_effect_size: nc.indirectEffectSize,
              indirect_standard_error: nc.indirectStandardError,
            }))
          );
        }

        // 5. 计算SUCRA排名
        const rankings = calculateSUCRA(
          networkComparisons,
          interventions,
          config.referenceIntervention
        );

        // 保存排名结果
        if (rankings.length > 0) {
          await supabase.from('treatment_rankings').insert(
            rankings.map(r => ({
              network_meta_analysis_id: analysisId,
              intervention: r.intervention,
              sucra: r.sucra,
              mean_rank: r.meanRank,
              rank_probabilities: r.rankProbabilities,
              number_of_studies: r.numberOfStudies,
            }))
          );
        }

        // 6. 执行一致性检验
        const consistencyTests = performConsistencyTests(pooledComparisons, networkComparisons);

        // 保存一致性检验结果
        if (consistencyTests.length > 0) {
          await supabase.from('consistency_results').insert(
            consistencyTests.map(ct => ({
              network_meta_analysis_id: analysisId,
              test_method: ct.testMethod,
              loop: ct.loop,
              direct_effect: ct.directEffect,
              indirect_effect: ct.indirectEffect,
              difference: ct.difference,
              difference_se: ct.differenceSe,
              consistency_p_value: ct.consistencyPValue,
              is_consistent: ct.isConsistent,
              conclusion: ct.conclusion,
            }))
          );
        }

        // 更新分析状态为完成
        await supabase
          .from('network_meta_analysis')
          .update({ status: 'completed' })
          .eq('id', analysisId);

        return NextResponse.json({
          success: true,
          data: {
            networkStructure,
            networkComparisons,
            rankings,
            consistencyTests,
          },
        });
      } catch (error) {
        // 更新状态为失败
        await supabase
          .from('network_meta_analysis')
          .update({ status: 'failed' })
          .eq('id', analysisId);

        throw error;
      }
    }

    if (action === 'import-from-extracted') {
      // 从已提取的数据导入到网状分析
      const { analysisId, extractedDataIds } = body;

      if (!analysisId || !extractedDataIds || extractedDataIds.length === 0) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // 获取已提取的数据
      const { data: extractedData, error } = await supabase
        .from('extracted_data')
        .select(`
          *,
          literature:literature_id (title, year)
        `)
        .in('id', extractedDataIds);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!extractedData || extractedData.length === 0) {
        return NextResponse.json({ error: 'No data found' }, { status: 400 });
      }

      // 转换为多臂数据格式
      // 注意：传统提取数据是两臂，需要转换
      const multiArmData = extractedData.map(d => ({
        network_meta_analysis_id: analysisId,
        literature_id: d.literature_id,
        study_name: d.study_name || (d.literature as any)?.title || 'Unknown Study',
        year: d.year || (d.literature as any)?.year,
        arms: [
          {
            interventionId: 'control',
            interventionName: 'Control', // 需要从分类或手动指定
            sampleSize: d.sample_size_control,
            events: d.events_control,
            mean: d.mean_control,
            sd: d.sd_control,
          },
          {
            interventionId: 'treatment',
            interventionName: 'Treatment', // 需要从分类或手动指定
            sampleSize: d.sample_size_treatment,
            events: d.events_treatment,
            mean: d.mean_treatment,
            sd: d.sd_treatment,
          },
        ],
        outcome_type: d.outcome_type,
      }));

      const { error: insertError } = await supabase
        .from('multi_arm_data')
        .insert(multiArmData);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Imported ${extractedData.length} studies`,
      });
    }

    // ==================== 干预措施管理 ====================
    
    if (action === 'add_intervention') {
      // 添加干预措施到分析项目
      const { analysisId, name, description } = body;

      if (!analysisId || !name) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // 检查是否已存在该干预措施
      const { data: existing } = await supabase
        .from('interventions')
        .select('*')
        .eq('name', name)
        .single();

      if (existing) {
        return NextResponse.json({ success: true, data: existing });
      }

      // 创建新的干预措施
      const { data, error } = await supabase
        .from('interventions')
        .insert({
          name,
          description,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }

    if (action === 'add_comparison') {
      // 添加直接比较数据
      const { analysisId, interventionA, interventionB, studyCount, sampleA, sampleB, eventsA, eventsB } = body;

      if (!analysisId || !interventionA || !interventionB) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // 计算效应量（OR）
      let effectSize = 0;
      let standardError = 0;
      let ciLower = 0;
      let ciUpper = 0;

      if (eventsA > 0 && eventsB > 0 && sampleA > 0 && sampleB > 0) {
        // 使用Mantel-Haenszel方法计算OR
        const a = eventsA;
        const b = eventsB;
        const c = sampleA - eventsA;
        const d = sampleB - eventsB;
        
        // 添加0.5校正避免除零
        const or = ((a + 0.5) * (d + 0.5)) / ((b + 0.5) * (c + 0.5));
        effectSize = Math.log(or);
        
        // 标准误
        standardError = Math.sqrt(1/(a + 0.5) + 1/(b + 0.5) + 1/(c + 0.5) + 1/(d + 0.5));
        
        // 95% CI
        ciLower = effectSize - 1.96 * standardError;
        ciUpper = effectSize + 1.96 * standardError;
      }

      // 保存直接比较结果
      const { data, error } = await supabase
        .from('direct_comparisons')
        .insert({
          network_meta_analysis_id: analysisId,
          intervention_a: interventionA,
          intervention_b: interventionB,
          study_count: studyCount || 1,
          effect_size: effectSize,
          standard_error: standardError,
          ci_lower: ciLower,
          ci_upper: ciUpper,
          sample_size_a: sampleA,
          sample_size_b: sampleB,
          events_a: eventsA,
          events_b: eventsB,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }

    if (action === 'calculate') {
      // 执行简化的网状分析计算（基于已有的直接比较数据）
      const { analysisId } = body;

      if (!analysisId) {
        return NextResponse.json({ error: 'Missing analysisId' }, { status: 400 });
      }

      // 获取分析配置
      const { data: analysis } = await supabase
        .from('network_meta_analysis')
        .select('*')
        .eq('id', analysisId)
        .single();

      if (!analysis) {
        return NextResponse.json({ error: 'Analysis not found' }, { status: 400 });
      }

      // 获取所有直接比较数据
      const { data: directComparisonsData, error: dcError } = await supabase
        .from('direct_comparisons')
        .select('*')
        .eq('network_meta_analysis_id', analysisId);

      if (dcError) {
        return NextResponse.json({ error: dcError.message }, { status: 500 });
      }

      if (!directComparisonsData || directComparisonsData.length < 2) {
        return NextResponse.json({ error: '需要至少2个比较对才能进行分析' }, { status: 400 });
      }

      // 获取干预措施列表
      const interventionSet = new Set<string>();
      directComparisonsData.forEach(dc => {
        interventionSet.add(dc.intervention_a);
        interventionSet.add(dc.intervention_b);
      });
      const interventions = Array.from(interventionSet);

      // 构建网状结构
      const nodes = interventions.map((id, idx) => ({
        id,
        name: id,
        numberOfStudies: directComparisonsData.filter(
          dc => dc.intervention_a === id || dc.intervention_b === id
        ).length,
        sampleSize: directComparisonsData
          .filter(dc => dc.intervention_a === id || dc.intervention_b === id)
          .reduce((sum, dc) => sum + (dc.sample_size_a || 0) + (dc.sample_size_b || 0), 0),
      }));

      const edges = directComparisonsData.map(dc => ({
        source: dc.intervention_a,
        target: dc.intervention_b,
        numberOfStudies: dc.study_count || 1,
        totalSampleSize: (dc.sample_size_a || 0) + (dc.sample_size_b || 0),
      }));

      // 保存网状结构
      await supabase.from('network_structure').insert({
        network_meta_analysis_id: analysisId,
        number_of_interventions: interventions.length,
        number_of_comparisons: directComparisonsData.length,
        number_of_studies: directComparisonsData.reduce((sum, dc) => sum + (dc.study_count || 1), 0),
        has_loops: false, // 简化处理
        connectivity: 'connected',
        nodes,
        edges,
      });

      // 计算网状比较（简化：直接使用直接比较结果）
      const networkComparisons = directComparisonsData.map(dc => ({
        network_meta_analysis_id: analysisId,
        intervention_a: dc.intervention_a,
        intervention_b: dc.intervention_b,
        network_effect_size: dc.effect_size,
        network_standard_error: dc.standard_error,
        network_ci_lower: dc.ci_lower,
        network_ci_upper: dc.ci_upper,
        p_value: dc.standard_error > 0 ? 2 * (1 - normalCDF(Math.abs(dc.effect_size) / dc.standard_error)) : null,
        comparison_type: 'direct',
        direct_effect_size: dc.effect_size,
        direct_standard_error: dc.standard_error,
      }));

      // 保存网状比较结果
      if (networkComparisons.length > 0) {
        await supabase.from('network_comparisons').insert(networkComparisons);
      }

      // 计算SUCRA排名（简化版）
      const sucraResults = calculateSimpleSUCRA(directComparisonsData, interventions);

      // 保存排名结果
      if (sucraResults.length > 0) {
        await supabase.from('treatment_rankings').insert(
          sucraResults.map(r => ({
            network_meta_analysis_id: analysisId,
            intervention: r.intervention,
            sucra: r.sucra,
            mean_rank: r.meanRank,
            rank_probabilities: r.rankProbabilities,
            number_of_studies: r.numberOfStudies,
          }))
        );
      }

      // 更新分析状态
      await supabase
        .from('network_meta_analysis')
        .update({ status: 'completed' })
        .eq('id', analysisId);

      return NextResponse.json({
        success: true,
        data: {
          interventions,
          comparisons: networkComparisons,
          sucraResults,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Network meta-analysis POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ==================== DELETE: 删除分析 ====================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 删除关联数据
    await Promise.all([
      supabase.from('multi_arm_data').delete().eq('network_meta_analysis_id', id),
      supabase.from('network_structure').delete().eq('network_meta_analysis_id', id),
      supabase.from('treatment_rankings').delete().eq('network_meta_analysis_id', id),
      supabase.from('network_comparisons').delete().eq('network_meta_analysis_id', id),
      supabase.from('direct_comparisons').delete().eq('network_meta_analysis_id', id),
      supabase.from('consistency_results').delete().eq('network_meta_analysis_id', id),
    ]);

    // 删除分析记录
    const { error } = await supabase
      .from('network_meta_analysis')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Network meta-analysis DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ==================== 辅助函数 ====================

/**
 * 标准正态分布累积分布函数
 */
function normalCDF(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * 计算简化版SUCRA排名
 */
function calculateSimpleSUCRA(
  directComparisons: any[],
  interventions: string[]
): Array<{
  intervention: string;
  sucra: number;
  meanRank: number;
  rankProbabilities: number[];
  numberOfStudies: number;
}> {
  const n = interventions.length;
  
  // 简化计算：基于每个干预在比较中的"获胜"次数
  const winCounts: Record<string, number> = {};
  const totalComparisons: Record<string, number> = {};
  
  interventions.forEach(int => {
    winCounts[int] = 0;
    totalComparisons[int] = 0;
  });
  
  directComparisons.forEach(dc => {
    const intA = dc.intervention_a;
    const intB = dc.intervention_b;
    const effectSize = dc.effect_size || 0;
    
    // effectSize > 0 表示B更好，effectSize < 0 表示A更好
    if (effectSize > 0) {
      winCounts[intB] = (winCounts[intB] || 0) + 1;
    } else if (effectSize < 0) {
      winCounts[intA] = (winCounts[intA] || 0) + 1;
    }
    
    totalComparisons[intA] = (totalComparisons[intA] || 0) + 1;
    totalComparisons[intB] = (totalComparisons[intB] || 0) + 1;
  });
  
  // 计算SUCRA
  return interventions.map(intervention => {
    const wins = winCounts[intervention] || 0;
    const total = totalComparisons[intervention] || 1;
    const winRate = total > 0 ? wins / total : 0.5;
    
    // SUCRA简化计算
    const sucra = 0.5 + (winRate - 0.5) * (n - 1) / n;
    
    // 平均排名
    const meanRank = n - sucra * (n - 1);
    
    // 简化的排名概率分布
    const rankProbabilities = Array(n).fill(0);
    const estimatedRank = Math.round(meanRank) - 1;
    if (estimatedRank >= 0 && estimatedRank < n) {
      rankProbabilities[estimatedRank] = 0.4;
      if (estimatedRank > 0) rankProbabilities[estimatedRank - 1] = 0.3;
      if (estimatedRank < n - 1) rankProbabilities[estimatedRank + 1] = 0.3;
    }
    
    return {
      intervention,
      sucra,
      meanRank,
      rankProbabilities,
      numberOfStudies: total,
    };
  }).sort((a, b) => b.sucra - a.sucra);
}
