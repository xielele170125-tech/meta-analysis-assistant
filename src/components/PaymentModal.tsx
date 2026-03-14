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
  const [paymentType, setPaymentType] = useState<'domestic' | 'international'>('domestic');
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay' | 'stripe'>('wechat');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

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
    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceFingerprint,
          paymentMethod,
          paymentType,
          email: paymentType === 'international' ? email : undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setOrderNo(data.order.orderNo);
        setPolling(true);

        if (paymentMethod === 'stripe') {
          // Stripe 支付 - 实际项目中应该跳转到 Stripe Checkout
          // 这里简化处理，显示模拟的支付页面
        }
      } else {
        alert(data.message || '创建订单失败');
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
            解锁完整功能
          </DialogTitle>
          <DialogDescription>
            {featureName 
              ? `「${featureName}」体验次数已用完，购买解锁全部功能`
              : '购买解锁所有高级功能，终身使用'
            }
          </DialogDescription>
        </DialogHeader>

        <Tabs value={paymentType} onValueChange={(v) => setPaymentType(v as 'domestic' | 'international')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="domestic" className="flex items-center gap-1">
              <span>🇨🇳</span> 国内支付
            </TabsTrigger>
            <TabsTrigger value="international" className="flex items-center gap-1">
              <Globe className="h-4 w-4" /> 国际支付
            </TabsTrigger>
          </TabsList>

          <TabsContent value="domestic" className="space-y-4">
            {/* 价格展示 */}
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-primary">¥9.9</div>
              <p className="text-muted-foreground text-sm mt-1">终身使用，一次购买永久有效</p>
            </div>

            {/* 支付方式选择 */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={paymentMethod === 'wechat' ? 'default' : 'outline'}
                className="h-16 flex flex-col gap-1"
                onClick={() => setPaymentMethod('wechat')}
              >
                <span className="text-xl">💚</span>
                <span className="text-xs">微信支付</span>
              </Button>
              <Button
                variant={paymentMethod === 'alipay' ? 'default' : 'outline'}
                className="h-16 flex flex-col gap-1"
                onClick={() => setPaymentMethod('alipay')}
              >
                <span className="text-xl">💙</span>
                <span className="text-xs">支付宝</span>
              </Button>
            </div>

            {/* 功能列表 */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>无限次 AI 数据提取</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>无限次质量评分评估</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>导出 Excel 和图片</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>网状 Meta 分析</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>AI 智能分类</span>
              </div>
            </div>

            {!orderNo ? (
              <Button 
                className="w-full" 
                onClick={handlePayment}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '立即购买'}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center p-4 bg-muted rounded-lg">
                  <QrCode className="h-32 w-32 text-muted-foreground" />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  请使用{paymentMethod === 'wechat' ? '微信' : '支付宝'}扫码支付
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  订单号: {orderNo}
                </p>
                {polling && (
                  <p className="text-center text-sm text-blue-500">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                    等待支付中...
                  </p>
                )}
                {/* 测试按钮 - 生产环境删除 */}
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleTestPayment}
                  disabled={loading}
                >
                  [测试] 模拟支付成功
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="international" className="space-y-4">
            {/* 价格展示 */}
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-primary">$3.00</div>
              <p className="text-muted-foreground text-sm mt-1">One-time purchase, lifetime access</p>
            </div>

            {/* 邮箱输入 */}
            <div className="space-y-2">
              <Label htmlFor="email">Email (for receipt)</Label>
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
