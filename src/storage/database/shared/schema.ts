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
    outcomeType: varchar("outcome_type", { length: 100 }), // 结局类型
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

// TypeScript types
export type Literature = typeof literature.$inferSelect;
export type ExtractedData = typeof extractedData.$inferSelect;
export type MetaAnalysis = typeof metaAnalysis.$inferSelect;
export type AnalysisResult = typeof analysisResult.$inferSelect;
export type AnalysisDataRelation = typeof analysisDataRelation.$inferSelect;
