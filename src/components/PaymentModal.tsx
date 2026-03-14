'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Crown, 
  Check, 
  Loader2, 
  CreditCard, 
  QrCode, 
  Globe, 
  Mail,
  Shield,
  Zap,
  Sparkles
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string;
  deviceFingerprint: string;
  onPaymentSuccess?: () => void;
}

export function PaymentModal({
  open,
  onOpenChange,
  featureName,
  deviceFingerprint,
  onPaymentSuccess,
}: PaymentModalProps) {
  const { t } = useTranslation();
  const [paymentType, setPaymentType] = useState<'domestic' | 'international'>('domestic');
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay' | 'stripe'>('wechat');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [payUrl, setPayUrl] = useState<string | null>(null);

  // 根据支付类型自动选择支付方式
  useEffect(() => {
    if (paymentType === 'domestic') {
      setPaymentMethod('wechat');
    } else {
      setPaymentMethod('stripe');
    }
  }, [paymentType]);

  // 轮询支付状态
  useEffect(() => {
    if (!polling || !orderNo) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNo,
            deviceFingerprint,
          }),
        });

        const data = await response.json();
        if (data.success && data.isPaid) {
          setPolling(false);
          onPaymentSuccess?.();
          onOpenChange(false);
        }
      } catch (error) {
        console.error('轮询支付状态失败:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [polling, orderNo, deviceFingerprint, onPaymentSuccess, onOpenChange]);

  const handlePayment = async () => {
    setLoading(true);
    setQrCodeUrl(null);
    setPayUrl(null);
    
    try {
      // 国内支付使用免签支付
      if (paymentType === 'domestic') {
        const response = await fetch('/api/payment/mianqian/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceFingerprint,
            paymentMethod: paymentMethod === 'wechat' ? 'wxpay' : 'alipay',
          }),
        });

        const data = await response.json();
        if (data.success) {
          setOrderNo(data.order.orderNo);
          setQrCodeUrl(data.payment.qrCode);
          setPayUrl(data.payment.payUrl);
          setPolling(true);
        } else {
          alert(data.error || data.message || '创建订单失败');
        }
      } else {
        // 国际支付使用 Stripe（待实现）
        const response = await fetch('/api/payment/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceFingerprint,
            paymentMethod: 'stripe',
            paymentType,
            email,
          }),
        });

        const data = await response.json();
        if (data.success) {
          setOrderNo(data.order.orderNo);
          setPayUrl(data.paymentInfo?.redirectUrl);
          setPolling(true);
        } else {
          alert(data.message || '创建订单失败');
        }
      }
    } catch (error) {
      console.error('创建支付订单失败:', error);
      alert('创建支付订单失败');
    } finally {
      setLoading(false);
    }
  };

  // 测试模式：模拟支付成功
  const handleTestPayment = async () => {
    if (!orderNo) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/payment/verify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNo,
          adminKey: 'test_admin_key',
        }),
      });

      const data = await response.json();
      if (data.success) {
        setPolling(false);
        onPaymentSuccess?.();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('模拟支付失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            {t('payment.unlock')}
          </DialogTitle>
          <DialogDescription>
            {featureName 
              ? `「${featureName}」${t('payment.trial.exhausted')}，${t('payment.unlock')}`
              : t('payment.oneTime')
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={paymentType} onValueChange={(v) => setPaymentType(v as 'domestic' | 'international')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="domestic" className="flex items-center gap-1">
              <span>🇨🇳</span> {t('payment.domestic')}
            </TabsTrigger>
            <TabsTrigger value="international" className="flex items-center gap-1">
              <Globe className="h-4 w-4" /> {t('payment.international')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="domestic" className="space-y-4">
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
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>{t('payment.features.ai')}</span>
              </div>
            </div>

            {!orderNo ? (
              <Button 
                className="w-full" 
                onClick={handlePayment}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('payment.buyNow')}
              </Button>
            ) : (
              <div className="space-y-3">
                {/* 支付二维码 */}
                <div className="flex flex-col items-center gap-3">
                  {qrCodeUrl ? (
                    <div className="p-4 bg-white rounded-lg">
                      <img 
                        src={qrCodeUrl} 
                        alt="支付二维码" 
                        className="w-48 h-48"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-4 bg-muted rounded-lg">
                      <QrCode className="h-32 w-32 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-center text-sm text-muted-foreground">
                    {t('payment.scanQR', { method: paymentMethod === 'wechat' ? t('payment.wechat') : t('payment.alipay') })}
                  </p>
                </div>
                
                {/* 或点击跳转支付 */}
                {payUrl && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => window.open(payUrl, '_blank')}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {t('payment.openInNew')}
                  </Button>
                )}
                
                <p className="text-center text-xs text-muted-foreground">
                  {t('payment.orderNo')}: {orderNo}
                </p>
                {polling && (
                  <p className="text-center text-sm text-blue-500">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                    {t('payment.waiting')}
                  </p>
                )}
                {/* 测试按钮 - 生产环境删除 */}
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleTestPayment}
                  disabled={loading}
                >
                  [测试] {t('payment.testSuccess')}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="international" className="space-y-4">
            {/* 价格展示 */}
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-primary">$3.00</div>
              <p className="text-muted-foreground text-sm mt-1">{t('payment.internationalDesc')}</p>
            </div>

            {/* 邮箱输入 */}
            <div className="space-y-2">
              <Label htmlFor="email">{t('payment.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* 功能列表 */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Unlimited AI data extraction</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Unlimited quality assessment</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Export to Excel and images</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Network Meta-Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>AI-powered classification</span>
              </div>
            </div>

            {!orderNo ? (
              <Button 
                className="w-full" 
                onClick={handlePayment}
                disabled={loading || !email}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pay with Stripe
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm">Stripe Checkout</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    In production, this would redirect to Stripe
                  </p>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Order: {orderNo}
                </p>
                {/* 测试按钮 - 生产环境删除 */}
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleTestPayment}
                  disabled={loading}
                >
                  [Test] Simulate Payment Success
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* 保障说明 */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            <span>安全支付</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <span>即时生效</span>
          </div>
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            <span>终身有效</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
