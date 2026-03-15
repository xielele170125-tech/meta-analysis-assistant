'use client';

import { Button } from '@/components/ui/button';
import { Heart, Coffee } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function PaymentStatusBadge() {
  const [showSupport, setShowSupport] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm">
          <span>✨ 开源免费</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-gradient-to-r from-pink-50 to-red-50 dark:from-pink-900/20 dark:to-red-900/20 border-pink-200 dark:border-pink-800 hover:from-pink-100 hover:to-red-100"
          onClick={() => setShowSupport(true)}
        >
          <Heart className="h-4 w-4 text-pink-500" />
          <span className="text-sm">支持作者</span>
        </Button>
      </div>

      <SupportModal open={showSupport} onOpenChange={setShowSupport} />
    </>
  );
}

// 支持作者弹窗
function SupportModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-amber-500" />
            感谢您的支持！
          </DialogTitle>
          <DialogDescription>
            如果这个项目对您有帮助，欢迎请作者喝杯咖啡 ☕
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 微信赞赏码 */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">微信赞赏</p>
            <div className="bg-white p-4 rounded-lg inline-block">
              <img 
                src="/support/wechat-pay.png" 
                alt="微信赞赏码" 
                className="w-48 h-48 object-contain"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f3f4f6" width="200" height="200"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%236b7280" font-size="14">请添加赞赏码</text></svg>';
                }}
              />
            </div>
          </div>

          {/* 支付宝收款码 */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">支付宝</p>
            <div className="bg-white p-4 rounded-lg inline-block">
              <img 
                src="/support/alipay.png" 
                alt="支付宝收款码" 
                className="w-48 h-48 object-contain"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f3f4f6" width="200" height="200"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%236b7280" font-size="14">请添加收款码</text></svg>';
                }}
              />
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground pt-2 border-t">
            <p>您的支持是我持续更新的动力！</p>
            <p className="mt-1">⭐ 如果觉得项目不错，也欢迎在 GitHub 给个 Star</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
