'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  QrCode, 
  Upload, 
  Check, 
  Copy, 
  CheckCircle,
  MessageCircle,
  CreditCard
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';

interface ManualPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceFingerprint: string;
  onPaymentSuccess?: () => void;
}

export function ManualPaymentModal({
  open,
  onOpenChange,
  deviceFingerprint,
  onPaymentSuccess,
}: ManualPaymentModalProps) {
  const { t } = useTranslation();
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [step, setStep] = useState<'pay' | 'confirm'>('pay');
  const [orderNo, setOrderNo] = useState<string>('');
  const [paymentProof, setPaymentProof] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // 生成订单号
  const generateOrderNo = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `MP${timestamp}${random}`;
  };

  // 复制订单号
  const copyOrderNo = () => {
    navigator.clipboard.writeText(orderNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 开始支付
  const handleStartPayment = () => {
    const newOrderNo = generateOrderNo();
    setOrderNo(newOrderNo);
    setStep('confirm');
  };

  // 提交支付确认
  const handleSubmitConfirm = async () => {
    if (!paymentProof.trim()) {
      alert('请填写支付信息');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/payment/manual/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceFingerprint,
          orderNo,
          paymentMethod,
          paymentProof,
          contactInfo,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('提交成功！我们会尽快确认收款并解锁功能。');
        onOpenChange(false);
        setStep('pay');
        setPaymentProof('');
        setContactInfo('');
      } else {
        alert(data.error || '提交失败');
      }
    } catch (error) {
      console.error('提交失败:', error);
      alert('提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 收款码图片（优先使用 PNG，如果不存在则使用 SVG 占位图）
  const qrCodeUrl = paymentMethod === 'wechat' 
    ? '/payment/wechat-qr.svg'  // 替换为 wechat-qr.png
    : '/payment/alipay-qr.svg';  // 替换为 alipay-qr.png

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {t('payment.unlock')}
          </DialogTitle>
          <DialogDescription>
            {t('payment.manual.desc')}
          </DialogDescription>
        </DialogHeader>

        {step === 'pay' ? (
          <div className="space-y-4">
            {/* 价格展示 */}
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-primary">¥9.9</div>
              <p className="text-muted-foreground text-sm mt-1">{t('payment.lifetime')}</p>
            </div>

            {/* 支付方式选择 */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={paymentMethod === 'wechat' ? 'default' : 'outline'}
                className="h-16 flex flex-col gap-1"
                onClick={() => setPaymentMethod('wechat')}
              >
                <span className="text-xl">💚</span>
                <span className="text-xs">{t('payment.wechat')}</span>
              </Button>
              <Button
                variant={paymentMethod === 'alipay' ? 'default' : 'outline'}
                className="h-16 flex flex-col gap-1"
                onClick={() => setPaymentMethod('alipay')}
              >
                <span className="text-xl">💙</span>
                <span className="text-xs">{t('payment.alipay')}</span>
              </Button>
            </div>

            {/* 功能列表 */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>{t('payment.features.extraction')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>{t('payment.features.quality')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>{t('payment.features.export')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>{t('payment.features.network')}</span>
              </div>
            </div>

            <Button className="w-full" onClick={handleStartPayment}>
              {t('payment.buyNow')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 二维码展示 */}
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-white rounded-lg border">
                {/* 使用实际的收款码图片 */}
                <img 
                  src={qrCodeUrl}
                  alt={paymentMethod === 'wechat' ? '微信收款码' : '支付宝收款码'}
                  className="w-48 h-48"
                  onError={(e) => {
                    // 如果图片加载失败，显示占位符
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f3f4f6" width="200" height="200"/><text x="100" y="100" text-anchor="middle" dy=".3em" fill="%236b7280">收款码</text></svg>';
                  }}
                />
              </div>
              
              <p className="text-center text-sm text-muted-foreground">
                请使用{paymentMethod === 'wechat' ? '微信' : '支付宝'}扫码支付
              </p>

              {/* 订单号 */}
              <div className="w-full p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('payment.orderNo')}</p>
                    <p className="font-mono font-bold">{orderNo}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={copyOrderNo}
                  >
                    {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ⚠️ 请在转账备注中填写此订单号
                </p>
              </div>

              {/* 金额提示 */}
              <div className="w-full p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  💰 请转账 <span className="font-bold">¥9.9</span> 元
                </p>
              </div>
            </div>

            {/* 支付确认表单 */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="paymentProof">{t('payment.manual.paymentInfo')} *</Label>
                <Textarea
                  id="paymentProof"
                  placeholder={t('payment.manual.paymentInfoPlaceholder')}
                  value={paymentProof}
                  onChange={(e) => setPaymentProof(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactInfo">{t('payment.manual.contact')}</Label>
                <Input
                  id="contactInfo"
                  placeholder={t('payment.manual.contactPlaceholder')}
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setStep('pay')}
              >
                {t('common.back')}
              </Button>
              <Button 
                className="flex-1"
                onClick={handleSubmitConfirm}
                disabled={submitting}
              >
                {submitting ? t('common.loading') : t('payment.manual.submit')}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              提交后我们会在 24 小时内确认收款并解锁功能
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
