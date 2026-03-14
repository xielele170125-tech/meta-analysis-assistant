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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Crown, 
  Check, 
  Loader2, 
  CreditCard, 
  Globe, 
  ExternalLink,
  RefreshCw
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
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay'>('alipay');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [orderNo, setOrderNo] = useState<string>('');
  const [payUrl, setPayUrl] = useState<string>('');

  // 开始支付
  const handlePayment = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/payment/yipay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceFingerprint,
          paymentMethod,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setOrderNo(data.order.orderNo);
        setPayUrl(data.payment.payUrl);
        // 直接跳转到支付页面
        window.open(data.payment.payUrl, '_blank');
      } else {
        // 显示详细错误信息
        const errorMsg = data.detail 
          ? `${data.error}: ${data.detail}` 
          : (data.error || data.message || '创建订单失败');
        alert(errorMsg);
        console.error('创建订单失败详情:', data);
      }
    } catch (error) {
      console.error('创建支付订单失败:', error);
      alert('创建支付订单失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 检查支付状态（主动查询易支付）
  const checkPaymentStatus = async () => {
    if (!orderNo) return;
    
    setVerifying(true);
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
        alert('支付成功！功能已解锁！');
        onPaymentSuccess?.();
        onOpenChange(false);
      } else {
        alert(data.message || '暂未检测到支付，请支付后再次检查');
      }
    } catch (error) {
      console.error('检查支付状态失败:', error);
      alert('检查失败，请稍后重试');
    } finally {
      setVerifying(false);
    }
  };

  // 关闭时重置
  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            {t('payment.unlock')}
          </DialogTitle>
          <DialogDescription>
            {featureName 
              ? `「${featureName}」体验次数已用完，解锁完整功能`
              : '一次性付费，永久使用所有功能'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 价格展示 */}
          <div className="text-center py-4">
            <div className="text-4xl font-bold text-primary">
              {paymentType === 'domestic' ? '¥9.9' : '$3.00'}
            </div>
            <p className="text-muted-foreground text-sm mt-1">{t('payment.lifetime')}</p>
          </div>

          {/* 支付区域选择 */}
          <Tabs value={paymentType} onValueChange={(v) => setPaymentType(v as 'domestic' | 'international')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="domestic" className="flex items-center gap-1">
                <span>🇨🇳</span> 国内
              </TabsTrigger>
              <TabsTrigger value="international" className="flex items-center gap-1">
                <Globe className="h-4 w-4" /> 国际
              </TabsTrigger>
            </TabsList>

            <TabsContent value="domestic" className="space-y-4 mt-4">
              {/* 支付方式选择 */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={paymentMethod === 'alipay' ? 'default' : 'outline'}
                  className="h-16 flex flex-col gap-1"
                  onClick={() => setPaymentMethod('alipay')}
                >
                  <span className="text-xl">💙</span>
                  <span className="text-xs">支付宝</span>
                </Button>
                <Button
                  variant={paymentMethod === 'wechat' ? 'default' : 'outline'}
                  className="h-16 flex flex-col gap-1"
                  onClick={() => setPaymentMethod('wechat')}
                >
                  <span className="text-xl">💚</span>
                  <span className="text-xs">微信支付</span>
                </Button>
              </div>

              {/* 功能列表 */}
              <div className="space-y-2 text-sm bg-muted/50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Meta 分析（固定/随机效应模型）</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>森林图、漏斗图可视化</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>文献质量评分（Cochrane/NOS）</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>网状 Meta 分析</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Excel 导出、R 代码生成</span>
                </div>
              </div>

              {/* 支付按钮 */}
              {payUrl ? (
                <div className="space-y-2">
                  <Button className="w-full" asChild>
                    <a href={payUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      前往支付页面
                    </a>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={checkPaymentStatus}
                    disabled={verifying}
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        检查中...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        已支付？点击检查状态
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    支付完成后点击上方按钮，系统会自动查询并解锁
                  </p>
                </div>
              ) : (
                <Button className="w-full" onClick={handlePayment} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      创建订单中...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      立即购买
                    </>
                  )}
                </Button>
              )}
            </TabsContent>

            <TabsContent value="international" className="space-y-4 mt-4">
              <div className="text-center py-8 text-muted-foreground">
                <p>国际支付即将上线</p>
                <p className="text-sm mt-2">请联系管理员：your-email@example.com</p>
              </div>
            </TabsContent>
          </Tabs>

          {/* 自动解锁提示 */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <Check className="h-3 w-3 text-green-500" />
            <span>支付成功后点击检查按钮，自动解锁功能</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
