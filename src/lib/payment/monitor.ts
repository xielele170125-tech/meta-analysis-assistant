/**
 * 支付监控服务
 * 自动监控收款通知并解锁用户权限
 * 
 * 支持方式：
 * 1. 邮件监控：监控支付宝/微信收款邮件通知
 * 2. Webhook：接收 Bark/Server酱 等推送通知
 * 3. 定时轮询：定期检查收款记录
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

// 收款通知接口
export interface PaymentNotification {
  amount: number;           // 收款金额
  orderId?: string;         // 订单号（从备注解析）
  paymentMethod: 'wechat' | 'alipay';
  timestamp: Date;
  rawContent: string;       // 原始通知内容
}

/**
 * 从收款备注中解析订单号
 * 用户在转账时会填写订单号作为备注
 */
export function parseOrderIdFromNote(note: string): string | null {
  // 支持多种格式：
  // MPXXXXXX
  // 订单号:MPXXXXXX
  // 订单MPXXXXXX
  const patterns = [
    /MP[A-Z0-9]{8,12}/i,           // 直接匹配订单号
    /订单[号:]?\s*([A-Z0-9]+)/i,    // 订单号:XXX
    /\b([A-Z]{2}[A-Z0-9]{6,10})\b/i, // 通用格式
  ];

  for (const pattern of patterns) {
    const match = note.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  return null;
}

/**
 * 从支付宝邮件通知中解析信息
 */
export function parseAlipayEmail(emailContent: string): PaymentNotification | null {
  // 支付宝收款通知邮件格式示例：
  // "您收到一笔转账，金额0.10元，备注：MPXXXXXX"
  
  const amountMatch = emailContent.match(/金额[：:]\s*(\d+\.?\d*)\s*元/);
  const noteMatch = emailContent.match(/备注[：:]\s*([^\n]+)/);
  
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1]);
  const note = noteMatch ? noteMatch[1].trim() : '';
  const orderId = parseOrderIdFromNote(note);

  return {
    amount,
    orderId: orderId || undefined,
    paymentMethod: 'alipay',
    timestamp: new Date(),
    rawContent: emailContent,
  };
}

/**
 * 从微信支付通知中解析信息
 */
export function parseWechatNotification(content: string): PaymentNotification | null {
  // 微信收款通知格式示例：
  // "微信支付：收到转账0.10元，备注：MPXXXXXX"
  
  const amountMatch = content.match(/[收到收款]\s*(\d+\.?\d*)\s*元/);
  const noteMatch = content.match(/备注[：:]\s*([^\n]+)/);
  
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1]);
  const note = noteMatch ? noteMatch[1].trim() : '';
  const orderId = parseOrderIdFromNote(note);

  return {
    amount,
    orderId: orderId || undefined,
    paymentMethod: 'wechat',
    timestamp: new Date(),
    rawContent: content,
  };
}

/**
 * 处理收款通知
 * 自动匹配订单并解锁用户
 */
export async function processPaymentNotification(
  notification: PaymentNotification
): Promise<{ success: boolean; message: string; orderNo?: string }> {
  const client = getSupabaseClient();

  // 如果有订单号，直接匹配
  if (notification.orderId) {
    const result = await matchAndConfirmOrder(
      client,
      notification.orderId,
      notification.amount
    );
    return result;
  }

  // 没有订单号，尝试通过金额匹配最近的待支付订单
  const result = await matchOrderByAmount(
    client,
    notification.amount,
    notification.paymentMethod
  );
  return result;
}

/**
 * 通过订单号匹配并确认订单
 */
async function matchAndConfirmOrder(
  client: ReturnType<typeof getSupabaseClient>,
  orderNo: string,
  paidAmount: number
): Promise<{ success: boolean; message: string; orderNo?: string }> {
  // 查询订单
  const { data: order, error } = await client
    .from('payment_orders')
    .select('*')
    .eq('order_no', orderNo)
    .eq('status', 'pending')
    .single();

  if (error || !order) {
    console.log('[支付监控] 未找到匹配订单:', orderNo);
    return { success: false, message: '未找到匹配的待支付订单' };
  }

  // 验证金额（允许误差 0.01 元）
  const expectedAmount = order.amount / 100;
  if (Math.abs(paidAmount - expectedAmount) > 0.01) {
    console.log('[支付监控] 金额不匹配:', { expected: expectedAmount, paid: paidAmount });
    return { success: false, message: '金额不匹配' };
  }

  // 确认订单
  await confirmOrder(client, order);

  return {
    success: true,
    message: '订单已自动确认',
    orderNo: order.order_no,
  };
}

/**
 * 通过金额匹配最近的订单
 * 用于用户忘记填写订单号的情况
 */
async function matchOrderByAmount(
  client: ReturnType<typeof getSupabaseClient>,
  amount: number,
  paymentMethod: string
): Promise<{ success: boolean; message: string; orderNo?: string }> {
  // 查找最近 1 小时内相同金额、相同支付方式的待支付订单
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: orders, error } = await client
    .from('payment_orders')
    .select('*')
    .eq('status', 'pending')
    .eq('amount', Math.round(amount * 100))
    .eq('payment_method', paymentMethod)
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !orders || orders.length === 0) {
    console.log('[支付监控] 未找到匹配金额的订单:', amount);
    return { success: false, message: '未找到匹配的订单，请确认是否填写了订单号' };
  }

  const order = orders[0];

  // 确认订单
  await confirmOrder(client, order);

  return {
    success: true,
    message: '订单已自动确认（通过金额匹配）',
    orderNo: order.order_no,
  };
}

/**
 * 确认订单并解锁用户
 */
async function confirmOrder(
  client: ReturnType<typeof getSupabaseClient>,
  order: Record<string, unknown>
): Promise<void> {
  // 更新订单状态
  await client
    .from('payment_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  // 更新用户状态
  await client
    .from('users')
    .update({
      payment_status: 'paid',
      is_paid: true,
      paid_at: new Date().toISOString(),
    })
    .eq('device_fingerprint', order.device_fingerprint);

  console.log('[支付监控] 订单已确认:', order.order_no);
}

/**
 * 批量处理收款通知
 */
export async function processBatchNotifications(
  notifications: PaymentNotification[]
): Promise<{ success: number; failed: number; results: Array<{ success: boolean; message: string }> }> {
  const results = [];
  let success = 0;
  let failed = 0;

  for (const notification of notifications) {
    try {
      const result = await processPaymentNotification(notification);
      results.push(result);
      
      if (result.success) {
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error('[支付监控] 处理失败:', error);
      results.push({ success: false, message: '处理异常' });
      failed++;
    }
  }

  return { success, failed, results };
}
