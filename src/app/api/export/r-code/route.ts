import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface StudyForR {
  id: string;
  study_name: string;
  n_treatment: number;
  n_control: number;
  mean_treatment: number | null;
  sd_treatment: number | null;
  mean_control: number | null;
  sd_control: number | null;
  events_treatment: number | null;
  events_control: number | null;
  effect_size: number | null;
  se: number | null;
}

/**
 * 生成R语言Meta分析代码
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

    if (!studies || studies.length === 0) {
      return NextResponse.json({ error: '没有研究数据' }, { status: 400 });
    }

    // 构建研究数据
    const studyData: StudyForR[] = studies.map((s) => ({
      id: s.id,
      study_name: s.study_name || 'Unknown',
      n_treatment: s.sample_size_treatment || 0,
      n_control: s.sample_size_control || 0,
      mean_treatment: s.mean_treatment,
      sd_treatment: s.sd_treatment,
      mean_control: s.mean_control,
      sd_control: s.sd_control,
      events_treatment: s.events_treatment,
      events_control: s.events_control,
      effect_size: s.effect_size,
      se: s.standard_error,
    }));

    // 判断数据类型
    const hasContinuousData = studyData.some(
      (s) => s.mean_treatment !== null && s.sd_treatment !== null
    );
    const hasBinaryData = studyData.some(
      (s) => s.events_treatment !== null
    );

    // 生成R代码
    const rCode = generateRCode(
      analysis,
      studyData,
      hasContinuousData,
      hasBinaryData,
      result
    );

    return NextResponse.json({
      success: true,
      data: {
        rCode,
        studyCount: studies.length,
        analysisName: analysis.name,
        modelType: analysis.model_type,
      },
    });
  } catch (error) {
    console.error('Generate R code error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}

function generateRCode(
  analysis: { name: string; model_type: string; effect_measure: string },
  studies: StudyForR[],
  hasContinuousData: boolean,
  hasBinaryData: boolean,
  result: { forest_plot_data?: unknown } | null
): string {
  const lines: string[] = [];

  lines.push('# ═══════════════════════════════════════════════════════════════');
  lines.push(`# Meta分析: ${analysis.name}`);
  lines.push(`# 生成时间: ${new Date().toLocaleString()}`);
  lines.push('# ═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('# 1. 安装和加载必要的包');
  lines.push('# ─────────────────────────────────────────────────────────────');
  lines.push('if (!require("meta")) install.packages("meta")');
  lines.push('if (!require("metafor")) install.packages("metafor")');
  lines.push('if (!require("ggplot2")) install.packages("ggplot2")');
  lines.push('');
  lines.push('library(meta)');
  lines.push('library(metafor)');
  lines.push('library(ggplot2)');
  lines.push('');

  // 数据导入
  lines.push('# 2. 数据准备');
  lines.push('# ─────────────────────────────────────────────────────────────');
  lines.push('# 方法1: 从导出的Excel文件读取');
  lines.push('# data <- readxl::read_excel("meta_analysis_data.xlsx", sheet = "Data Extraction", skip = 2)');
  lines.push('');
  lines.push('# 方法2: 直接输入数据');

  if (hasContinuousData) {
    // 连续型变量数据
    lines.push('# 连续型变量数据');
    lines.push('data <- data.frame(');
    lines.push('  study = c(');
    studies.forEach((s, i) => {
      lines.push(`    "${s.study_name}"${i < studies.length - 1 ? ',' : ''}`);
    });
    lines.push('  ),');
    lines.push('  n.e = c(');  // 实验组样本量
    studies.forEach((s, i) => {
      lines.push(`    ${s.n_treatment}${i < studies.length - 1 ? ',' : ''}`);
    });
    lines.push('  ),');
    lines.push('  n.c = c(');  // 对照组样本量
    studies.forEach((s, i) => {
      lines.push(`    ${s.n_control}${i < studies.length - 1 ? ',' : ''}`);
    });
    lines.push('  ),');
    lines.push('  mean.e = c(');  // 实验组均值
    studies.forEach((s, i) => {
      lines.push(`    ${s.mean_treatment || 'NA'}${i < studies.length - 1 ? ',' : ''}`);
    });
    lines.push('  ),');
    lines.push('  sd.e = c(');  // 实验组标准差
    studies.forEach((s, i) => {
      lines.push(`    ${s.sd_treatment || 'NA'}${i < studies.length - 1 ? ',' : ''}`);
    });
    lines.push('  ),');
    lines.push('  mean.c = c(');  // 对照组均值
    studies.forEach((s, i) => {
      lines.push(`    ${s.mean_control || 'NA'}${i < studies.length - 1 ? ',' : ''}`);
    });
    lines.push('  ),');
    lines.push('  sd.c = c(');  // 对照组标准差
    studies.forEach((s, i) => {
      lines.push(`    ${s.sd_control || 'NA'}${i < studies.length - 1 ? ',' : ''}`);
    });
    lines.push('  )');
    lines.push(')');
  } else if (hasBinaryData) {
    // 二分类变量数据
    lines.push('# 二分类变量数据');
    lines.push('data <- data.frame(');
    lines.push('  study = c(');
    studies.forEach((s, i) => {
      lines.push(`    "${s.study_name}"${i < studies.length - 1 ? ',' : ''}`);
    });
    lines.push('  ),');
    lines.push('  n.e = c(');  // 实验组总数
    studies.forEach((s, i) => {
      lines.push(`    ${s.n_treatment}${i < studies.length - 1 ? ',' : ''}`);
    });
    lines.push('  ),');
    lines.push('  n.c = c(');  // 对照组总数
    studies.forEach((s, i) => {
      lines.push(`    ${s.n_control}${i < studies.length - 1 ? ',' : ''}`);
    });
    lines.push('  ),');
    lines.push('  event.e = c(');  // 实验组事件数
    studies.forEach((s, i) => {
      lines.push(`    ${s.events_treatment || 'NA'}${i < studies.length - 1 ? ',' : ''}`);
    });
    lines.push('  ),');
    lines.push('  event.c = c(');  // 对照组事件数
    studies.forEach((s, i) => {
      lines.push(`    ${s.events_control || 'NA'}${i < studies.length - 1 ? ',' : ''}`);
    });
    lines.push('  )');
    lines.push(')');
  }
  lines.push('');
  lines.push('# 查看数据');
  lines.push('print(data)');
  lines.push('');

  // Meta分析
  lines.push('# 3. 执行Meta分析');
  lines.push('# ─────────────────────────────────────────────────────────────');

  if (hasContinuousData) {
    lines.push('# 连续型变量: 计算标准化均数差 (SMD)');
    lines.push('# 使用meta包');
    lines.push(`meta_result <- metacont(`);
    lines.push('  n.e = n.e,');
    lines.push('  mean.e = mean.e,');
    lines.push('  sd.e = sd.e,');
    lines.push('  n.c = n.c,');
    lines.push('  mean.c = mean.c,');
    lines.push('  sd.c = sd.c,');
    lines.push('  studlab = study,');
    lines.push('  data = data,');
    lines.push('  sm = "SMD",  # 标准化均数差');
    lines.push(`  comb.${analysis.model_type === 'random' ? 'random' : 'fixed'} = TRUE,`);
    lines.push(`  method.tau = "DL"  # DerSimonian-Laird方法`);
    lines.push(')');
  } else if (hasBinaryData) {
    lines.push('# 二分类变量: 计算比值比 (OR)');
    lines.push(`meta_result <- metabin(`);
    lines.push('  event.e = event.e,');
    lines.push('  n.e = n.e,');
    lines.push('  event.c = event.c,');
    lines.push('  n.c = n.c,');
    lines.push('  studlab = study,');
    lines.push('  data = data,');
    lines.push('  sm = "OR",  # 比值比，也可以用 "RR" (相对风险)');
    lines.push(`  comb.${analysis.model_type === 'random' ? 'random' : 'fixed'} = TRUE,`);
    lines.push(`  method.tau = "DL"`);
    lines.push(')');
  }
  lines.push('');
  lines.push('# 打印结果');
  lines.push('print(meta_result)');
  lines.push('');

  // 森林图
  lines.push('# 4. 森林图 (Forest Plot)');
  lines.push('# ─────────────────────────────────────────────────────────────');
  lines.push('# 使用meta包的forest函数');
  lines.push('forest(meta_result,');
  lines.push('  leftcols = c("studlab", "n.e", "n.c"),');
  lines.push('  leftlabs = c("Study", "N (Exp)", "N (Ctrl)"),');
  lines.push(`  main = "${analysis.name} - 森林图"`);
  lines.push(')');
  lines.push('');
  lines.push('# 使用metafor包(更多自定义选项)');
  lines.push('library(metafor)');
  if (hasContinuousData) {
    lines.push('# 计算效应量');
    lines.push('dat <- escalc(measure = "SMD", ');
    lines.push('  m1i = mean.e, sd1i = sd.e, n1i = n.e,');
    lines.push('  m2i = mean.c, sd2i = sd.c, n2i = n.c,');
    lines.push('  data = data)');
  } else {
    lines.push('# 计算效应量');
    lines.push('dat <- escalc(measure = "OR", ');
    lines.push('  ai = event.e, ci = event.c,');
    lines.push('  n1i = n.e, n2i = n.c,');
    lines.push('  data = data)');
  }
  lines.push('');
  lines.push(`# ${analysis.model_type === 'random' ? '随机' : '固定'}效应模型`);
  lines.push(`res <- rma(yi, vi, data = dat, method = "${analysis.model_type === 'random' ? 'DL' : 'FE'}")`);
  lines.push('print(res)');
  lines.push('');
  lines.push('# 森林图(metafor版本)');
  lines.push('forest(res, ');
  lines.push('  slab = dat$study,');
  lines.push(`  main = "${analysis.name}"`);
  lines.push(')');
  lines.push('');

  // 漏斗图
  lines.push('# 5. 漏斗图 (Funnel Plot) - 发表偏倚检验');
  lines.push('# ─────────────────────────────────────────────────────────────');
  lines.push('# 使用metafor包');
  lines.push('funnel(res, ');
  lines.push('  main = "漏斗图 - 检验发表偏倚",');
  lines.push('  xlab = "效应量",');
  lines.push('  ylab = "标准误 (SE)"');
  lines.push(')');
  lines.push('');
  lines.push('# 添加伪置信区间');
  lines.push('funnel(res, level = c(90, 95, 99),');
  lines.push('  shade = c("white", "gray55", "gray75"),');
  lines.push('  main = "漏斗图 (带置信区域)"');
  lines.push(')');
  lines.push('');

  // 发表偏倚检验
  lines.push('# 6. 发表偏倚检验');
  lines.push('# ─────────────────────────────────────────────────────────────');
  lines.push('# Egger回归检验');
  lines.push('egger_test <- regtest(res)');
  lines.push('print(egger_test)');
  lines.push('');
  lines.push('# Begg秩相关检验');
  lines.push('ranktest(res)');
  lines.push('');
  lines.push('# Trim and Fill方法');
  lines.push('taf <- trimfill(res)');
  lines.push('funnel(taf, main = "Trim and Fill调整后的漏斗图")');
  lines.push('');

  // 异质性分析
  lines.push('# 7. 异质性分析');
  lines.push('# ─────────────────────────────────────────────────────────────');
  lines.push('cat("异质性统计量:\\n")');
  lines.push('cat("Q统计量:", res$QE, "\\n")');
  lines.push('cat("I²:", res$I2, "%\\n")');
  lines.push('cat("τ²:", res$tau2, "\\n")');
  lines.push('');
  lines.push('# Q检验P值');
  lines.push('cat("Q检验P值:", res$QEp, "\\n")');
  lines.push('');

  // 敏感性分析
  lines.push('# 8. 敏感性分析 (留一法)');
  lines.push('# ─────────────────────────────────────────────────────────────');
  lines.push('leave1out(res)');
  lines.push('');
  lines.push('# 绘制敏感性分析图');
  lines.push('inf <- influence(res)');
  lines.push('print(inf)');
  lines.push('');
  lines.push('# 绘制影响图');
  lines.push('plot(inf)');
  lines.push('');

  // 亚组分析（示例）
  lines.push('# 9. 亚组分析 (示例 - 需要根据实际情况修改)');
  lines.push('# ─────────────────────────────────────────────────────────────');
  lines.push('# 添加亚组变量 (示例)');
  lines.push('# data$subgroup <- c("A", "A", "B", "B", ...)  # 根据实际情况设置');
  lines.push('# dat$subgroup <- data$subgroup');
  lines.push('');
  lines.push('# 亚组分析');
  lines.push('# res_sub <- rma(yi, vi, mods = ~ subgroup, data = dat)');
  lines.push('# print(res_sub)');
  lines.push('');

  // 导出结果
  lines.push('# 10. 导出结果');
  lines.push('# ─────────────────────────────────────────────────────────────');
  lines.push('# 保存森林图');
  lines.push(`png("${analysis.name.replace(/[^a-zA-Z0-9]/g, '_')}_forest.png", width = 1200, height = 800)`);
  lines.push('forest(res, slab = dat$study)');
  lines.push('dev.off()');
  lines.push('');
  lines.push('# 保存漏斗图');
  lines.push(`png("${analysis.name.replace(/[^a-zA-Z0-9]/g, '_')}_funnel.png", width = 800, height = 600)`);
  lines.push('funnel(res)');
  lines.push('dev.off()');
  lines.push('');
  lines.push('# 导出结果表格');
  lines.push('result_df <- data.frame(');
  lines.push('  Study = dat$study,');
  lines.push('  Effect_Size = dat$yi,');
  lines.push('  SE = sqrt(dat$vi),');
  lines.push('  CI_Lower = dat$yi - 1.96 * sqrt(dat$vi),');
  lines.push('  CI_Upper = dat$yi + 1.96 * sqrt(dat$vi)');
  lines.push(')');
  lines.push(`write.csv(result_df, "${analysis.name.replace(/[^a-zA-Z0-9]/g, '_')}_results.csv", row.names = FALSE)`);
  lines.push('');
  lines.push('# ═══════════════════════════════════════════════════════════════');
  lines.push('# 分析完成！');
  lines.push('# ═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
