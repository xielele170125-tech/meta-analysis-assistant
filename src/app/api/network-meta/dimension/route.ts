/**
 * 网状Meta分析与分类维度关联API
 * 
 * 支持：
 * - 根据分类维度获取相关数据
 * - AI推荐分析参数（效应量、模型类型）
 * - 批量导入数据到网状分析
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// ==================== GET: 获取分类维度相关数据 ====================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const dimensionId = searchParams.get('dimensionId');
    const category = searchParams.get('category');

    const supabase = getSupabaseClient();

    if (action === 'dimension-data') {
      // 获取特定分类维度下的数据
      if (!dimensionId) {
        return NextResponse.json({ error: 'Missing dimensionId' }, { status: 400 });
      }

      // 1. 获取分类维度信息
      const { data: dimension, error: dimError } = await supabase
        .from('classification_dimensions')
        .select('*')
        .eq('id', dimensionId)
        .single();

      if (dimError) {
        return NextResponse.json({ error: dimError.message }, { status: 500 });
      }

      // 2. 获取分类结果
      let query = supabase
        .from('literature_classifications')
        .select(`
          *,
          literature:literature_id (
            id,
            title,
            authors,
            year
          )
        `)
        .eq('dimension_id', dimensionId);

      if (category) {
        query = query.eq('category', category);
      }

      const { data: classifications, error: classError } = await query;

      if (classError) {
        return NextResponse.json({ error: classError.message }, { status: 500 });
      }

      // 3. 获取相关文献的提取数据
      const literatureIds = classifications?.map(c => c.literature_id) || [];
      
      const { data: extractedData, error: dataError } = await supabase
        .from('extracted_data')
        .select(`
          *,
          literature:literature_id (
            id,
            title,
            authors,
            year
          )
        `)
        .in('literature_id', literatureIds);

      if (dataError) {
        return NextResponse.json({ error: dataError.message }, { status: 500 });
      }

      // 4. 按分类聚合数据
      const groupedData: Record<string, {
        category: string;
        count: number;
        studies: any[];
        extractedData: any[];
      }> = {};

      classifications?.forEach(c => {
        const cat = c.category;
        if (!groupedData[cat]) {
          groupedData[cat] = {
            category: cat,
            count: 0,
            studies: [],
            extractedData: [],
          };
        }
        groupedData[cat].count++;
        groupedData[cat].studies.push(c);
      });

      // 关联提取数据
      extractedData?.forEach(d => {
        const classification = classifications?.find(c => c.literature_id === d.literature_id);
        if (classification) {
          const cat = classification.category;
          if (groupedData[cat]) {
            groupedData[cat].extractedData.push({
              ...d,
              classification: classification,
            });
          }
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          dimension,
          classifications,
          groupedData: Object.values(groupedData),
          extractedData,
        },
      });
    }

    if (action === 'recommend-params') {
      // AI推荐分析参数
      const extractedDataIds = searchParams.get('extractedDataIds')?.split(',') || [];
      const researchQuestion = searchParams.get('researchQuestion') || '';

      if (extractedDataIds.length === 0) {
        return NextResponse.json({ error: 'No data provided' }, { status: 400 });
      }

      // 获取数据样本
      const { data: sampleData, error } = await supabase
        .from('extracted_data')
        .select('*')
        .in('id', extractedDataIds.slice(0, 5));

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // 分析数据特征
      const hasBinaryOutcome = sampleData?.some(d => 
        d.events_treatment !== null && d.events_control !== null
      );
      const hasContinuousOutcome = sampleData?.some(d => 
        d.mean_treatment !== null && d.mean_control !== null
      );

      // 推荐参数
      const recommendations = {
        outcomeType: hasBinaryOutcome ? 'dichotomous' : 'continuous',
        effectMeasure: hasBinaryOutcome ? 'OR' : 'SMD',
        modelType: 'random', // 默认随机效应模型
        interventions: [] as string[],
        confidence: 0.8,
        reasoning: '',
      };

      // 提取干预措施名称
      const interventionNames = new Set<string>();
      sampleData?.forEach(d => {
        if (d.sample_size_treatment_name) {
          interventionNames.add(d.sample_size_treatment_name);
        }
        if (d.sample_size_control_name) {
          interventionNames.add(d.sample_size_control_name);
        }
      });
      recommendations.interventions = Array.from(interventionNames);

      // 生成推荐理由
      if (hasBinaryOutcome && hasContinuousOutcome) {
        recommendations.reasoning = '数据包含二分类和连续型结局指标，建议分别进行分析或确认主要结局类型后选择合适的效应量。';
        recommendations.confidence = 0.6;
      } else if (hasBinaryOutcome) {
        recommendations.reasoning = '数据为二分类结局指标（事件数/总人数），推荐使用比值比(OR)作为效应量。随机效应模型可处理研究间异质性。';
        recommendations.confidence = 0.9;
      } else if (hasContinuousOutcome) {
        recommendations.reasoning = '数据为连续型结局指标（均值±标准差），推荐使用标准化均差(SMD)作为效应量，便于不同量纲的结果合并。';
        recommendations.confidence = 0.9;
      } else {
        recommendations.reasoning = '数据类型不明确，请检查数据提取是否完整。';
        recommendations.confidence = 0.3;
      }

      return NextResponse.json({
        success: true,
        data: recommendations,
      });
    }

    if (action === 'network-from-dimension') {
      // 从分类维度创建网状分析数据
      if (!dimensionId) {
        return NextResponse.json({ error: 'Missing dimensionId' }, { status: 400 });
      }

      // 获取该维度下所有分类的数据
      const { data: classifications, error: classError } = await supabase
        .from('literature_classifications')
        .select(`
          *,
          literature:literature_id (
            id,
            title,
            authors,
            year
          )
        `)
        .eq('dimension_id', dimensionId);

      if (classError) {
        return NextResponse.json({ error: classError.message }, { status: 500 });
      }

      if (!classifications || classifications.length === 0) {
        return NextResponse.json({ error: 'No classifications found' }, { status: 400 });
      }

      // 获取提取数据
      const literatureIds = classifications.map(c => c.literature_id);
      const { data: extractedData, error: dataError } = await supabase
        .from('extracted_data')
        .select('*')
        .in('literature_id', literatureIds);

      if (dataError) {
        return NextResponse.json({ error: dataError.message }, { status: 500 });
      }

      // 获取分类维度信息
      const { data: dimension } = await supabase
        .from('classification_dimensions')
        .select('*')
        .eq('id', dimensionId)
        .single();

      // 按分类组织数据（用于网状分析）
      const categoryInterventions = new Map<string, Set<string>>();
      const networkData: Array<{
        studyId: string;
        studyName: string;
        category: string;
        sampleSizeTreatment: number | null;
        sampleSizeControl: number | null;
        eventsTreatment: number | null;
        eventsControl: number | null;
        interventionTreatment: string | null;
        interventionControl: string | null;
      }> = [];

      extractedData?.forEach(d => {
        const classification = classifications.find(c => c.literature_id === d.literature_id);
        if (classification) {
          networkData.push({
            studyId: d.id,
            studyName: d.study_name || `Study ${d.literature_id.slice(0, 8)}`,
            category: classification.category,
            sampleSizeTreatment: d.sample_size_treatment,
            sampleSizeControl: d.sample_size_control,
            eventsTreatment: d.events_treatment,
            eventsControl: d.events_control,
            interventionTreatment: d.sample_size_treatment_name,
            interventionControl: d.sample_size_control_name,
          });

          // 记录干预措施
          if (d.sample_size_treatment_name) {
            if (!categoryInterventions.has(classification.category)) {
              categoryInterventions.set(classification.category, new Set());
            }
            categoryInterventions.get(classification.category)!.add(d.sample_size_treatment_name);
          }
          if (d.sample_size_control_name) {
            if (!categoryInterventions.has(classification.category)) {
              categoryInterventions.set(classification.category, new Set());
            }
            categoryInterventions.get(classification.category)!.add(d.sample_size_control_name);
          }
        }
      });

      // 分析参数推荐
      const hasBinaryOutcome = extractedData?.some(d => 
        d.events_treatment !== null && d.events_control !== null
      );

      return NextResponse.json({
        success: true,
        data: {
          dimension,
          classifications,
          extractedData,
          networkData,
          categories: Array.from(new Set(classifications.map(c => c.category))),
          interventions: Array.from(categoryInterventions.values()).flatMap(s => Array.from(s)),
          recommendation: {
            outcomeType: hasBinaryOutcome ? 'dichotomous' : 'continuous',
            effectMeasure: hasBinaryOutcome ? 'OR' : 'SMD',
            modelType: 'random',
          },
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Network dimension API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ==================== POST: 创建网状分析并导入数据 ====================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const supabase = getSupabaseClient();

    if (action === 'create-from-dimension') {
      // 从分类维度创建网状分析
      const { dimensionId, name, description, outcomeType, effectMeasure, modelType, apiKey } = body;

      if (!dimensionId || !name) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // 1. 获取分类维度数据
      const { data: classifications } = await supabase
        .from('literature_classifications')
        .select(`
          *,
          literature:literature_id (id, title, year)
        `)
        .eq('dimension_id', dimensionId);

      if (!classifications || classifications.length === 0) {
        return NextResponse.json({ error: 'No data found for this dimension' }, { status: 400 });
      }

      // 2. 获取提取数据
      const literatureIds = classifications.map(c => c.literature_id);
      const { data: extractedData } = await supabase
        .from('extracted_data')
        .select('*')
        .in('literature_id', literatureIds);

      if (!extractedData || extractedData.length === 0) {
        return NextResponse.json({ error: 'No extracted data found' }, { status: 400 });
      }

      // 3. 分析数据类型（如果未指定）
      let finalOutcomeType = outcomeType;
      let finalEffectMeasure = effectMeasure;

      if (!finalOutcomeType) {
        const hasBinary = extractedData.some(d => 
          d.events_treatment !== null && d.events_control !== null
        );
        finalOutcomeType = hasBinary ? 'dichotomous' : 'continuous';
        finalEffectMeasure = hasBinary ? 'OR' : 'SMD';
      }

      // 4. 创建网状分析项目
      const { data: analysis, error: analysisError } = await supabase
        .from('network_meta_analysis')
        .insert({
          name,
          description: description || `基于分类维度创建 - ${new Date().toLocaleDateString()}`,
          outcome_type: finalOutcomeType,
          effect_measure: finalEffectMeasure || 'OR',
          model_type: modelType || 'random',
          status: 'draft',
        })
        .select()
        .single();

      if (analysisError) {
        return NextResponse.json({ error: analysisError.message }, { status: 500 });
      }

      // 5. 提取并创建干预措施
      const interventionMap = new Map<string, string>();
      const interventionNames = new Set<string>();

      extractedData.forEach(d => {
        if (d.sample_size_treatment_name) {
          interventionNames.add(d.sample_size_treatment_name);
        }
        if (d.sample_size_control_name) {
          interventionNames.add(d.sample_size_control_name);
        }
      });

      for (const name of interventionNames) {
        // 检查是否已存在
        const { data: existing } = await supabase
          .from('interventions')
          .select('*')
          .eq('name', name)
          .single();

        if (existing) {
          interventionMap.set(name, existing.id);
        } else {
          const { data: newIntervention, error } = await supabase
            .from('interventions')
            .insert({ name })
            .select()
            .single();

          if (!error && newIntervention) {
            interventionMap.set(name, newIntervention.id);
          }
        }
      }

      // 6. 创建直接比较数据
      const comparisons = [];
      for (const data of extractedData) {
        const interventionA = data.sample_size_control_name;
        const interventionB = data.sample_size_treatment_name;

        if (!interventionA || !interventionB) continue;

        // 计算效应量
        let effectSize = 0;
        let standardError = 0;
        let ciLower = 0;
        let ciUpper = 0;

        if (finalOutcomeType === 'dichotomous' && 
            data.events_control && data.events_treatment &&
            data.sample_size_control && data.sample_size_treatment) {
          const a = data.events_control;
          const b = data.events_treatment;
          const c = data.sample_size_control - data.events_control;
          const d = data.sample_size_treatment - data.events_treatment;

          const or = ((a + 0.5) * (d + 0.5)) / ((b + 0.5) * (c + 0.5));
          effectSize = Math.log(or);
          standardError = Math.sqrt(1/(a + 0.5) + 1/(b + 0.5) + 1/(c + 0.5) + 1/(d + 0.5));
          ciLower = effectSize - 1.96 * standardError;
          ciUpper = effectSize + 1.96 * standardError;
        }

        comparisons.push({
          network_meta_analysis_id: analysis.id,
          intervention_a: interventionA,
          intervention_b: interventionB,
          study_name: data.study_name,
          effect_size: effectSize,
          standard_error: standardError,
          ci_lower: ciLower,
          ci_upper: ciUpper,
          sample_size_a: data.sample_size_control,
          sample_size_b: data.sample_size_treatment,
          events_a: data.events_control,
          events_b: data.events_treatment,
          study_count: 1,
        });
      }

      if (comparisons.length > 0) {
        const { error: compError } = await supabase
          .from('direct_comparisons')
          .insert(comparisons);

        if (compError) {
          console.error('Insert comparisons error:', compError);
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          analysis,
          interventionsCount: interventionMap.size,
          comparisonsCount: comparisons.length,
          interventionMap: Object.fromEntries(interventionMap),
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Network dimension API POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
