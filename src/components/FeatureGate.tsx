'use client';

import { ReactNode } from 'react';

// 功能标识
export type FeatureKey =
  | 'meta_analysis'
  | 'forest_plot'
  | 'funnel_plot'
  | 'quality_assessment'
  | 'export_excel'
  | 'export_image'
  | 'network_meta'
  | 'ai_classification'
  | 'r_code';

// 功能名称映射
const FEATURE_NAMES: Record<FeatureKey, string> = {
  meta_analysis: 'Meta 分析',
  forest_plot: '森林图',
  funnel_plot: '漏斗图',
  quality_assessment: '质量评分',
  export_excel: '导出 Excel',
  export_image: '导出图片',
  network_meta: '网状 Meta 分析',
  ai_classification: 'AI 智能分类',
  r_code: '生成 R 代码',
};

interface FeatureGateProps {
  featureKey: FeatureKey;
  deviceFingerprint: string;
  children: ReactNode;
  fallback?: ReactNode;
  onAccess?: () => void;
  onDenied?: () => void;
}

/**
 * 功能门控组件 - 所有功能免费开放
 * 本项目已完全开源，无需付费即可使用所有功能
 */
export function FeatureGate({
  children,
  onAccess,
}: FeatureGateProps) {
  // 所有功能直接可用
  onAccess?.();
  return <>{children}</>;
}

// 便捷 Hook - 所有功能直接可用
export function useFeatureAccess() {
  return {
    isPaid: true,
    hasTrial: true,
    loading: false,
    showPayment: false,
    checkAccess: async () => true,
    useFeature: async () => true,
    setShowPayment: () => {},
  };
}
