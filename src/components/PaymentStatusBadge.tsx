'use client';

import { Button } from '@/components/ui/button';
import { Crown, Check } from 'lucide-react';
import { usePayment } from '@/contexts/PaymentContext';

export function PaymentStatusBadge() {
  const { isPaid, loading, showPaymentModal } = usePayment();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
        <span>加载中...</span>
      </div>
    );
  }

  if (isPaid) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm">
        <Check className="h-4 w-4" />
        <span>已解锁</span>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-200 dark:border-yellow-800"
      onClick={() => showPaymentModal()}
    >
      <Crown className="h-4 w-4 text-yellow-500" />
      <span className="text-sm">解锁完整功能 ¥9.9</span>
    </Button>
  );
}
