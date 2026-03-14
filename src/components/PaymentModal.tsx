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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Crown, 
  Check, 
  Loader2, 
  CreditCard, 
  Globe, 
  Copy,
  CheckCircle
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
  const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [step, setStep] = useState<'select' | 'pay' | 'confirm'>('select');
  const [loading, setLoading] = useState(false);
  const [orderNo, setOrderNo] = useState<string>('');
  const [paymentProof, setPaymentProof] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [copied, setCopied] = useState(false);

  // 收款码图片路径
  const qrCodeUrl = paymentMethod === 'wechat' 
    ? '/payment/wechat-qr.png'
    : '/payment/alipay-qr.png';

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
      alert('请填写支付信息（如转账金额、时间等）');
      return;
    }

    setLoading(true);
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
        setStep('select');
        setPaymentProof('');
        setContactInfo('');
      } else {
        alert(data.error || '提交失败');
      }
    } catch (error) {
      console.error('提交失败:', error);
      alert('提交失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 关闭时重置
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep('select');
      setPaymentProof('');
      setContactInfo('');
    }
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

        {step === 'select' ? (
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

                <Button className="w-full" onClick={handleStartPayment}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  立即购买
                </Button>
              </TabsContent>

              <TabsContent value="international" className="space-y-4 mt-4">
                <div className="text-center py-8 text-muted-foreground">
                  <p>国际支付即将上线</p>
                  <p className="text-sm mt-2">请联系管理员：your-email@example.com</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 二维码展示 */}
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-white rounded-lg border">
                <img 
                  src={qrCodeUrl}
                  alt={paymentMethod === 'wechat' ? '微信收款码' : '支付宝收款码'}
                  className="w-44 h-44"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f3f4f6" width="200" height="200"/><text x="100" y="100" text-anchor="middle" dy=".3em" fill="%236b7280">收款码</text></svg>';
                  }}
                />
              </div>
              
              <p className="text-center text-sm text-muted-foreground">
                请使用{paymentMethod === 'wechat' ? '微信' : '支付宝'}扫码支付 ¥9.9
              </p>

              {/* 订单号 */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">订单号：</span>
                <code className="bg-muted px-2 py-1 rounded">{orderNo}</code>
                <Button variant="ghost" size="sm" onClick={copyOrderNo}>
                  {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* 支付确认表单 */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="paymentProof">支付信息 *</Label>
                <Textarea
                  id="paymentProof"
                  placeholder="请填写支付金额、时间等信息，例如：已支付9.9元，15:30"
                  value={paymentProof}
                  onChange={(e) => setPaymentProof(e.target.value)}
                  rows={2}
                />
              </div>
              
              <div>
                <Label htmlFor="contactInfo">联系方式（可选）</Label>
                <Input
                  id="contactInfo"
                  placeholder="邮箱或微信，用于通知您审核结果"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('select')} className="flex-1">
                返回
              </Button>
              <Button onClick={handleSubmitConfirm} disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    提交中...
                  </>
                ) : (
                  '我已支付，提交确认'
                )}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              提交后我们会在24小时内确认收款并解锁功能
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
