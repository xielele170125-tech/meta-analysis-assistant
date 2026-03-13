import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  serial,
  real,
} from "drizzle-orm/pg-core";

// 系统表 - 必须保留
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 文献表
export const literature = pgTable(
  "literature",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 500 }),
    authors: text("authors"),
    year: integer("year"),
    journal: varchar("journal", { length: 255 }),
    doi: varchar("doi", { length: 255 }),
    fileKey: varchar("file_key", { length: 255 }),
    fileName: varchar("file_name", { length: 255 }),
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, extracting, completed, failed
    rawContent: text("raw_content"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("literature_status_idx").on(table.status),
    index("literature_year_idx").on(table.year),
  ]
);

// 提取的数据表
export const extractedData = pgTable(
  "extracted_data",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    literatureId: varchar("literature_id", { length: 36 }).notNull(),
    studyName: varchar("study_name", { length: 255 }),
    // 连续型变量
    sampleSizeTreatment: integer("sample_size_treatment"),
    sampleSizeControl: integer("sample_size_control"),
    // 样本量名称（保留原始描述，如"非整倍体数/胚胎总个数"）
    sampleSizeTreatmentName: varchar("sample_size_treatment_name", { length: 255 }),
    sampleSizeControlName: varchar("sample_size_control_name", { length: 255 }),
    meanTreatment: real("mean_treatment"),
    meanControl: real("mean_control"),
    sdTreatment: real("sd_treatment"),
    sdControl: real("sd_control"),
    // 计算后的效应量
    effectSize: real("effect_size"),
    standardError: real("standard_error"),
    ciLower: real("ci_lower"),
    ciUpper: real("ci_upper"),
    // 二分类变量
    eventsTreatment: integer("events_treatment"),
    eventsControl: integer("events_control"),
    // 事件名称（保留原始描述，如"非整倍体胚胎数"）
    eventsTreatmentName: varchar("events_treatment_name", { length: 255 }),
    eventsControlName: varchar("events_control_name", { length: 255 }),
    // 元信息
    outcomeType: varchar("outcome_type", { length: 100 }), // 结局类型（保留原始）
    outcomeTypeRaw: varchar("outcome_type_raw", { length: 255 }), // 原始结局指标名称
    outcomeTypeStandardized: varchar("outcome_type_standardized", { length: 100 }), // 标准化结局指标名称
    subgroup: varchar("subgroup", { length: 255 }), // 亚组名称（如"高龄组"、"年轻组"）
    subgroupDetail: text("subgroup_detail"), // 亚组详细描述
    notes: text("notes"),
    confidence: real("confidence"), // AI 提取置信度
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("extracted_data_literature_idx").on(table.literatureId),
  ]
);

// Meta分析项目表
export const metaAnalysis = pgTable(
  "meta_analysis",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    analysisType: varchar("analysis_type", { length: 20 }).default("continuous"), // continuous, binary
    effectMeasure: varchar("effect_measure", { length: 20 }).default("SMD"), // SMD, MD, OR, RR, HR
    modelType: varchar("model_type", { length: 20 }).default("random"), // fixed, random
    status: varchar("status", { length: 20 }).default("draft").notNull(), // draft, running, completed
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("meta_analysis_status_idx").on(table.status),
  ]
);

// Meta分析结果表
export const analysisResult = pgTable(
  "analysis_result",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    metaAnalysisId: varchar("meta_analysis_id", { length: 36 }).notNull(),
    // 合并效应量
    combinedEffect: real("combined_effect"),
    combinedSe: real("combined_se"),
    combinedCiLower: real("combined_ci_lower"),
    combinedCiUpper: real("combined_ci_upper"),
    combinedPValue: real("combined_p_value"),
    // 异质性检验
    heterogeneityQ: real("heterogeneity_q"),
    heterogeneityI2: real("heterogeneity_i2"),
    heterogeneityTau2: real("heterogeneity_tau2"),
    heterogeneityPValue: real("heterogeneity_p_value"),
    // 森林图数据
    forestPlotData: jsonb("forest_plot_data"),
    // 发表偏倚
    eggerTest: jsonb("egger_test"),
    beggTest: jsonb("begg_test"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("analysis_result_meta_idx").on(table.metaAnalysisId),
  ]
);

// 分析-数据关联表
export const analysisDataRelation = pgTable(
  "analysis_data_relation",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    metaAnalysisId: varchar("meta_analysis_id", { length: 36 }).notNull(),
    extractedDataId: varchar("extracted_data_id", { length: 36 }).notNull(),
    included: boolean("included").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("analysis_relation_meta_idx").on(table.metaAnalysisId),
    index("analysis_relation_data_idx").on(table.extractedDataId),
  ]
);

// 质量评分表
export const qualityAssessment = pgTable(
  "quality_assessment",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    literatureId: varchar("literature_id", { length: 36 }).notNull(),
    // 量表类型: rob2 (Cochrane RoB 2.0), nos (Newcastle-Ottawa), quadas2 (QUADAS-2)
    scaleType: varchar("scale_type", { length: 20 }).notNull(),
    // 研究类型: rct, cohort, case_control, diagnostic
    studyType: varchar("study_type", { length: 20 }),
    // 总分（NOS量表使用）
    totalScore: integer("total_score"),
    maxScore: integer("max_score"),
    // 各条目评分详情 (JSON格式)
    domainScores: jsonb("domain_scores"),
    // 总体偏倚风险: low, some_concerns, high
    overallRisk: varchar("overall_risk", { length: 20 }),
    // AI评估理由
    reasoning: text("reasoning"),
    // 评估置信度
    confidence: real("confidence"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("quality_literature_idx").on(table.literatureId),
    index("quality_scale_idx").on(table.scaleType),
  ]
);

// 分类维度表
export const classificationDimensions = pgTable(
  "classification_dimensions",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    // 分类类别 (JSON数组)
    categories: jsonb("categories").notNull().$type<string[]>(),
    // AI推荐来源
    isAiRecommended: boolean("is_ai_recommended").default(false),
    // 研究问题（用于AI推荐）
    researchQuestion: text("research_question"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  }
);

// 文献分类结果表
export const literatureClassifications = pgTable(
  "literature_classifications",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    literatureId: varchar("literature_id", { length: 36 }).notNull(),
    dimensionId: varchar("dimension_id", { length: 36 }).notNull(),
    // 分类结果
    category: varchar("category", { length: 255 }).notNull(),
    // AI置信度
    confidence: real("confidence"),
    // 分类依据
    evidence: text("evidence"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("classification_literature_idx").on(table.literatureId),
    index("classification_dimension_idx").on(table.dimensionId),
  ]
);

// ==================== 网状Meta分析相关表 ====================

// 干预措施表
export const interventions = pgTable(
  "interventions",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // 干预措施名称
    name: varchar("name", { length: 255 }).notNull(),
    // 标准化名称（用于合并同类干预）
    standardizedName: varchar("standardized_name", { length: 255 }),
    // 干预类型: drug, procedure, behavior, control, etc.
    interventionType: varchar("intervention_type", { length: 50 }),
    // 描述
    description: text("description"),
    // 别名（JSON数组）
    aliases: jsonb("aliases").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("interventions_name_idx").on(table.name),
    index("interventions_standardized_idx").on(table.standardizedName),
  ]
);

// 网状分析项目表
export const networkMetaAnalysis = pgTable(
  "network_meta_analysis",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    // 结局类型: continuous, binary, time_to_event
    outcomeType: varchar("outcome_type", { length: 20 }).default("binary").notNull(),
    // 效应量指标: OR, RR, RD, MD, SMD, HR
    effectMeasure: varchar("effect_measure", { length: 20 }).default("OR").notNull(),
    // 模型类型: fixed, random
    modelType: varchar("model_type", { length: 20 }).default("random").notNull(),
    // 分析方法: bucher (频率学派), bayesian (贝叶斯)
    analysisMethod: varchar("analysis_method", { length: 20 }).default("bucher").notNull(),
    // 状态: draft, running, completed, failed
    status: varchar("status", { length: 20 }).default("draft").notNull(),
    // 参照干预（用于计算效应量）
    referenceIntervention: varchar("reference_intervention", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("network_meta_status_idx").on(table.status),
  ]
);

// 多臂试验数据表（支持网状分析）
export const multiArmData = pgTable(
  "multi_arm_data",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    networkMetaAnalysisId: varchar("network_meta_analysis_id", { length: 36 }).notNull(),
    literatureId: varchar("literature_id", { length: 36 }).notNull(),
    // 研究名称
    studyName: varchar("study_name", { length: 255 }).notNull(),
    // 年份
    year: integer("year"),
    // 臂数据（JSON数组，每个臂包含：干预名称、样本量、事件数/均值/标准差）
    arms: jsonb("arms").notNull().$type<Array<{
      interventionId: string;
      interventionName: string;
      sampleSize: number;
      events?: number;      // 二分类
      mean?: number;        // 连续变量
      sd?: number;          // 连续变量
    }>>(),
    // 结局类型
    outcomeType: varchar("outcome_type", { length: 100 }),
    // 置信度
    confidence: real("confidence"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("multi_arm_analysis_idx").on(table.networkMetaAnalysisId),
    index("multi_arm_literature_idx").on(table.literatureId),
  ]
);

// 直接比较结果表（两两比较）
export const directComparisons = pgTable(
  "direct_comparisons",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    networkMetaAnalysisId: varchar("network_meta_analysis_id", { length: 36 }).notNull(),
    // 干预A（对照）
    interventionA: varchar("intervention_a", { length: 255 }).notNull(),
    // 干预B（试验）
    interventionB: varchar("intervention_b", { length: 255 }).notNull(),
    // 来源研究
    studyName: varchar("study_name", { length: 255 }),
    // 效应量
    effectSize: real("effect_size").notNull(),
    // 标准误
    standardError: real("standard_error").notNull(),
    // 置信区间
    ciLower: real("ci_lower"),
    ciUpper: real("ci_upper"),
    // 样本量
    sampleSizeA: integer("sample_size_a"),
    sampleSizeB: integer("sample_size_b"),
    // 事件数（二分类）
    eventsA: integer("events_a"),
    eventsB: integer("events_b"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("direct_comparison_analysis_idx").on(table.networkMetaAnalysisId),
    index("direct_comparison_pair_idx").on(table.interventionA, table.interventionB),
  ]
);

// 网状比较结果表（包含直接+间接比较）
export const networkComparisons = pgTable(
  "network_comparisons",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    networkMetaAnalysisId: varchar("network_meta_analysis_id", { length: 36 }).notNull(),
    // 干预A（参照）
    interventionA: varchar("intervention_a", { length: 255 }).notNull(),
    // 干预B
    interventionB: varchar("intervention_b", { length: 255 }).notNull(),
    // 网状效应量
    networkEffectSize: real("network_effect_size").notNull(),
    // 网状标准误
    networkStandardError: real("network_standard_error").notNull(),
    // 网状置信区间
    networkCiLower: real("network_ci_lower"),
    networkCiUpper: real("network_ci_upper"),
    // P值
    pValue: real("p_value"),
    // 比较类型: direct, indirect, network
    comparisonType: varchar("comparison_type", { length: 20 }).notNull(),
    // 直接比较效应量（如果有）
    directEffectSize: real("direct_effect_size"),
    directStandardError: real("direct_standard_error"),
    // 间接比较效应量（如果有）
    indirectEffectSize: real("indirect_effect_size"),
    indirectStandardError: real("indirect_standard_error"),
    // 一致性检验结果
    inconsistencyPValue: real("inconsistency_p_value"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("network_comparison_analysis_idx").on(table.networkMetaAnalysisId),
    index("network_comparison_pair_idx").on(table.interventionA, table.interventionB),
  ]
);

// 治疗排名表（SUCRA）
export const treatmentRankings = pgTable(
  "treatment_rankings",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    networkMetaAnalysisId: varchar("network_meta_analysis_id", { length: 36 }).notNull(),
    // 干预措施
    intervention: varchar("intervention", { length: 255 }).notNull(),
    // SUCRA值（0-1）
    sucra: real("sucra").notNull(),
    // 平均排名
    meanRank: real("mean_rank"),
    // 各排名概率（JSON数组，如[0.1, 0.3, 0.4, 0.2]表示排名第1-4的概率）
    rankProbabilities: jsonb("rank_probabilities").$type<number[]>(),
    // 总研究数
    numberOfStudies: integer("number_of_studies"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("treatment_ranking_analysis_idx").on(table.networkMetaAnalysisId),
    index("treatment_ranking_sucra_idx").on(table.sucra),
  ]
);

// 网状结构信息表
export const networkStructure = pgTable(
  "network_structure",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    networkMetaAnalysisId: varchar("network_meta_analysis_id", { length: 36 }).notNull(),
    // 干预措施数量
    numberOfInterventions: integer("number_of_interventions").notNull(),
    // 直接比较数量
    numberOfComparisons: integer("number_of_comparisons").notNull(),
    // 研究总数
    numberOfStudies: integer("number_of_studies").notNull(),
    // 是否存在闭合环
    hasLoops: boolean("has_loops").default(false),
    // 连通性: connected, disconnected
    connectivity: varchar("connectivity", { length: 20 }).default("connected"),
    // 节点信息（JSON）
    nodes: jsonb("nodes").notNull().$type<Array<{
      id: string;
      name: string;
      numberOfStudies: number;
      sampleSize: number;
    }>>(),
    // 边信息（JSON）
    edges: jsonb("edges").notNull().$type<Array<{
      source: string;
      target: string;
      numberOfStudies: number;
      totalSampleSize: number;
    }>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("network_structure_analysis_idx").on(table.networkMetaAnalysisId),
  ]
);

// 一致性检验结果表
export const consistencyResults = pgTable(
  "consistency_results",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    networkMetaAnalysisId: varchar("network_meta_analysis_id", { length: 36 }).notNull(),
    // 检验方法: bucher, nodesplit, designbytreatment
    testMethod: varchar("test_method", { length: 50 }).notNull(),
    // 检验的闭合环
    loop: jsonb("loop").$type<string[]>(),
    // 直接效应量
    directEffect: real("direct_effect"),
    // 间接效应量
    indirectEffect: real("indirect_effect"),
    // 差异
    difference: real("difference"),
    // 差异标准误
    differenceSe: real("difference_se"),
    // 一致性P值
    consistencyPValue: real("consistency_p_value"),
    // 是否一致
    isConsistent: boolean("is_consistent"),
    // 结论
    conclusion: text("conclusion"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("consistency_results_analysis_idx").on(table.networkMetaAnalysisId),
  ]
);

// TypeScript types
export type Literature = typeof literature.$inferSelect;
export type ExtractedData = typeof extractedData.$inferSelect;
export type MetaAnalysis = typeof metaAnalysis.$inferSelect;
export type AnalysisResult = typeof analysisResult.$inferSelect;
export type AnalysisDataRelation = typeof analysisDataRelation.$inferSelect;
export type QualityAssessment = typeof qualityAssessment.$inferSelect;
export type ClassificationDimension = typeof classificationDimensions.$inferSelect;
export type LiteratureClassification = typeof literatureClassifications.$inferSelect;

// 网状Meta分析相关类型
export type Intervention = typeof interventions.$inferSelect;
export type NetworkMetaAnalysisType = typeof networkMetaAnalysis.$inferSelect;
export type MultiArmData = typeof multiArmData.$inferSelect;
export type DirectComparison = typeof directComparisons.$inferSelect;
export type NetworkComparison = typeof networkComparisons.$inferSelect;
export type TreatmentRanking = typeof treatmentRankings.$inferSelect;
export type NetworkStructure = typeof networkStructure.$inferSelect;
export type ConsistencyResult = typeof consistencyResults.$inferSelect;
