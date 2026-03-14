'use client';

import { PaymentProvider } from '@/contexts/PaymentContext';

export function PaymentWrapper({ children }: { children: React.ReactNode }) {
  return <PaymentProvider>{children}</PaymentProvider>;
}
