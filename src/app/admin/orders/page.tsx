'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw,
  Shield
} from 'lucide-react';

interface Order {
  id: string;
  order_no: string;
  device_fingerprint: string;
  payment_method: string;
  amount: number;
  status: string;
  created_at: string;
  metadata: {
    payment_proof: string;
    contact_info: string;
    submitted_at: string;
  };
  users: {
    device_fingerprint: string;
    email: string | null;
  };
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminKey, setAdminKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  // 获取订单列表
  const fetchOrders = async () => {
    if (!adminKey) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/orders?adminKey=${adminKey}&status=pending`);
      const data = await response.json();
      
      if (data.success) {
        setOrders(data.orders);
        setAuthenticated(true);
      } else {
        alert(data.error || '获取订单失败');
      }
    } catch (error) {
      console.error('获取订单失败:', error);
      alert('获取订单失败');
    } finally {
      setLoading(false);
    }
  };

  // 审核订单
  const handleReview = async (orderNo: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminKey,
          orderNo,
          action,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(data.message);
        // 刷新订单列表
        fetchOrders();
      } else {
        alert(data.error || '操作失败');
      }
    } catch (error) {
      console.error('审核失败:', error);
      alert('审核失败');
    }
  };

  // 登录验证
  const handleLogin = () => {
    fetchOrders();
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              管理员登录
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">管理员密钥</label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md"
                placeholder="请输入管理员密钥"
              />
            </div>
            <Button className="w-full" onClick={handleLogin}>
              登录
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">支付订单审核</h1>
          <Button variant="outline" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">加载中...</div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无待审核订单</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">{order.order_no}</span>
                        <Badge variant="outline">
                          {order.payment_method === 'wechat' ? '微信' : '支付宝'}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        金额：<span className="font-medium text-foreground">¥{order.amount / 100}</span>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        提交时间：{new Date(order.created_at).toLocaleString()}
                      </div>

                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-1">支付凭证：</p>
                        <p className="text-sm">{order.metadata?.payment_proof || '无'}</p>
                      </div>

                      {order.metadata?.contact_info && (
                        <div className="mt-2 p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium mb-1">联系方式：</p>
                          <p className="text-sm">{order.metadata.contact_info}</p>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground mt-2">
                        设备指纹：{order.device_fingerprint?.substring(0, 16)}...
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-2">
                      <Button
                        variant="default"
                        className="flex-1 md:flex-none"
                        onClick={() => handleReview(order.order_no, 'approve')}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        确认收款
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 md:flex-none"
                        onClick={() => handleReview(order.order_no, 'reject')}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        拒绝
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
