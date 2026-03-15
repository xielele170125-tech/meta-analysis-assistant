'use client';

import { createContext, useContext, ReactNode } from 'react';
import { FeatureKey } from '@/components/FeatureGate';

// 付费上下文 - 所有功能免费开放
interface PaymentContextType {
  isPaid: boolean;
  loading: boolean;
  trials: Record<string, { used: number; max: number }>;
  showPaymentModal: (featureKey?: FeatureKey) => void;
  checkFeature: (featureKey: FeatureKey) => Promise<boolean>;
  useFeature: (featureKey: FeatureKey) => Promise<boolean>;
}

const PaymentContext = createContext<PaymentContextType>({
  isPaid: true,
  loading: false,
  trials: {},
  showPaymentModal: () => {},
  checkFeature: async () => true,
  useFeature: async () => true,
});

export function PaymentProvider({ children }: { children: ReactNode }) {
  // 所有功能免费开放，无需付费
  const showPaymentModal = () => {
    // 不再显示付费弹窗
  };

  const checkFeature = async () => true;
  const useFeature = async () => true;

  return (
    <PaymentContext.Provider
      value={{
        isPaid: true,
        loading: false,
        trials: {},
        showPaymentModal,
        checkFeature,
        useFeature,
      }}
    >
      {children}
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

// Hook: 使用功能
export function useFeature(deviceFingerprint: string, featureKey: FeatureKey) {
  const { isPaid, trials, checkFeature, useFeature, showPaymentModal, loading } = usePayment();

  return {
    isPaid,
    trials,
    canUse: true, // 所有功能直接可用
    check: () => checkFeature(featureKey),
    use: () => useFeature(featureKey),
    showPayment: () => showPaymentModal(featureKey),
    loading,
  };
}
