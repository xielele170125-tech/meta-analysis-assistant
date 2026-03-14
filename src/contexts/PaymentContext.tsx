'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';
import { PaymentModal } from '@/components/PaymentModal';

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

// 功能名称
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

interface PaymentContextType {
  // 状态
  deviceFingerprint: string | null;
  isPaid: boolean;
  trials: Record<string, { used: number; max: number }>;
  loading: boolean;
  
  // 方法
  checkFeature: (featureKey: FeatureKey) => Promise<boolean>;
  useFeature: (featureKey: FeatureKey) => Promise<boolean>;
  showPaymentModal: (featureKey?: FeatureKey) => void;
  refresh: () => Promise<void>;
}

const PaymentContext = createContext<PaymentContextType | null>(null);

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [deviceFingerprint, setDeviceFingerprint] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [trials, setTrials] = useState<Record<string, { used: number; max: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [pendingFeature, setPendingFeature] = useState<FeatureKey | undefined>();

  // 初始化设备指纹和用户状态
  useEffect(() => {
    const init = async () => {
      try {
        const fingerprint = await getDeviceFingerprint();
        setDeviceFingerprint(fingerprint);
        
        // 获取用户状态
        const response = await fetch('/api/user/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceFingerprint: fingerprint }),
        });
        
        const data = await response.json();
        if (data.success) {
          setIsPaid(data.isPaid);
          setTrials(data.trials || {});
        }
      } catch (error) {
        console.error('初始化用户状态失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    init();
  }, []);

  // 刷新用户状态
  const refresh = useCallback(async () => {
    if (!deviceFingerprint) return;
    
    try {
      const response = await fetch('/api/user/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceFingerprint }),
      });
      
      const data = await response.json();
      if (data.success) {
        setIsPaid(data.isPaid);
        setTrials(data.trials || {});
      }
    } catch (error) {
      console.error('刷新用户状态失败:', error);
    }
  }, [deviceFingerprint]);

  // 检查功能权限
  const checkFeature = useCallback(async (featureKey: FeatureKey): Promise<boolean> => {
    if (!deviceFingerprint) return false;
    if (isPaid) return true;
    
    const trial = trials[featureKey];
    return (trial?.used ?? 0) < (trial?.max ?? 1);
  }, [deviceFingerprint, isPaid, trials]);

  // 使用功能（消耗体验次数）
  const useFeature = useCallback(async (featureKey: FeatureKey): Promise<boolean> => {
    if (!deviceFingerprint) return false;
    if (isPaid) return true;
    
    try {
      const response = await fetch('/api/user/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceFingerprint,
          featureKey,
          action: 'use',
        }),
      });
      
      const data = await response.json();
      if (data.success && data.canUse) {
        // 更新本地状态
        setTrials(prev => ({
          ...prev,
          [featureKey]: {
            used: (prev[featureKey]?.used ?? 0) + 1,
            max: prev[featureKey]?.max ?? 1,
          },
        }));
        return true;
      }
      
      // 体验次数用完，显示付费弹窗
      setPendingFeature(featureKey);
      setShowPayment(true);
      return false;
    } catch (error) {
      console.error('使用功能失败:', error);
      return false;
    }
  }, [deviceFingerprint, isPaid]);

  // 显示付费弹窗
  const showPaymentModal = useCallback((featureKey?: FeatureKey) => {
    setPendingFeature(featureKey);
    setShowPayment(true);
  }, []);

  // 支付成功回调
  const handlePaymentSuccess = useCallback(() => {
    setShowPayment(false);
    setIsPaid(true);
    refresh();
  }, [refresh]);

  return (
    <PaymentContext.Provider
      value={{
        deviceFingerprint,
        isPaid,
        trials,
        loading,
        checkFeature,
        useFeature,
        showPaymentModal,
        refresh,
      }}
    >
      {children}
      
      {deviceFingerprint && (
        <PaymentModal
          open={showPayment}
          onOpenChange={setShowPayment}
          featureName={pendingFeature ? FEATURE_NAMES[pendingFeature] : undefined}
          deviceFingerprint={deviceFingerprint}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </PaymentContext.Provider>
  );
}

export function usePayment() {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
}

// 便捷 Hook：检查功能访问权限
export function useFeatureAccess(featureKey: FeatureKey) {
  const { isPaid, trials, checkFeature, useFeature, showPaymentModal, loading } = usePayment();
  
  const trial = trials[featureKey];
  const hasTrial = (trial?.used ?? 0) < (trial?.max ?? 1);
  const canAccess = isPaid || hasTrial;
  
  return {
    isPaid,
    hasTrial,
    canAccess,
    loading,
    checkAccess: () => checkFeature(featureKey),
    useAccess: () => useFeature(featureKey),
    showPayment: () => showPaymentModal(featureKey),
    trialInfo: trial,
  };
}
