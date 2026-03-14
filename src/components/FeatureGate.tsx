'use client';

import { useState, useEffect, useCallback } from 'react';
import { PaymentModal } from './PaymentModal';

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
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onAccess?: () => void;
  onDenied?: () => void;
}

interface UserStatus {
  isPaid: boolean;
  trials: Record<string, { used: number; max: number }>;
}

export function FeatureGate({
  featureKey,
  deviceFingerprint,
  children,
  fallback,
  onAccess,
  onDenied,
}: FeatureGateProps) {
  const [loading, setLoading] = useState(true);
  const [canAccess, setCanAccess] = useState(false);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [usedTrial, setUsedTrial] = useState(false);

  // 检查访问权限
  const checkAccess = useCallback(async () => {
    try {
      const response = await fetch('/api/user/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceFingerprint }),
      });

      const data = await response.json();
      if (data.success) {
        setUserStatus(data);
        setCanAccess(data.isPaid || (data.trials[featureKey]?.used ?? 0) < (data.trials[featureKey]?.max ?? 1));
      }
    } catch (error) {
      console.error('检查访问权限失败:', error);
    } finally {
      setLoading(false);
    }
  }, [deviceFingerprint, featureKey]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  // 使用体验次数
  const useTrial = async (): Promise<boolean> => {
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
        setUsedTrial(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('使用体验次数失败:', error);
      return false;
    }
  };

  // 请求访问
  const requestAccess = async () => {
    if (userStatus?.isPaid) {
      onAccess?.();
      return true;
    }

    const canUseTrial = await useTrial();
    if (canUseTrial) {
      onAccess?.();
      return true;
    }

    setShowPayment(true);
    onDenied?.();
    return false;
  };

  // 支付成功回调
  const handlePaymentSuccess = () => {
    setShowPayment(false);
    checkAccess();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      {userStatus?.isPaid ? (
        // 已付费用户，直接显示内容
        <>{children}</>
      ) : canAccess ? (
        // 免费用户，有体验次数
        <div className="relative">
          {children}
          {!usedTrial && (
            <div className="absolute top-2 right-2 z-10">
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                体验模式
              </span>
            </div>
          )}
        </div>
      ) : (
        // 次数用完，显示提示
        fallback || (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/50 rounded-lg">
            <p className="text-muted-foreground mb-4">
              「{FEATURE_NAMES[featureKey]}」体验次数已用完
            </p>
            <button
              onClick={() => setShowPayment(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              解锁完整功能
            </button>
          </div>
        )
      )}

      <PaymentModal
        open={showPayment}
        onOpenChange={setShowPayment}
        featureName={FEATURE_NAMES[featureKey]}
        deviceFingerprint={deviceFingerprint}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </>
  );
}

// 便捷 Hook：用于功能访问控制
export function useFeatureAccess(deviceFingerprint: string, featureKey: FeatureKey) {
  const [isPaid, setIsPaid] = useState(false);
  const [hasTrial, setHasTrial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);

  const checkAccess = useCallback(async () => {
    try {
      const response = await fetch('/api/user/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceFingerprint }),
      });

      const data = await response.json();
      if (data.success) {
        setIsPaid(data.isPaid);
        setHasTrial((data.trials[featureKey]?.used ?? 0) < (data.trials[featureKey]?.max ?? 1));
      }
    } catch (error) {
      console.error('检查访问权限失败:', error);
    } finally {
      setLoading(false);
    }
  }, [deviceFingerprint, featureKey]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  const useFeature = async () => {
    if (isPaid) {
      return true;
    }

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
      setHasTrial(false);
      return true;
    }

    setShowPayment(true);
    return false;
  };

  return {
    isPaid,
    hasTrial,
    loading,
    canAccess: isPaid || hasTrial,
    useFeature,
    showPayment,
    setShowPayment,
    refresh: checkAccess,
  };
}
