/**
 * 支付自动确认定时任务
 * 
 * 定期检查：
 * 1. 待支付订单
 * 2. 收款通知记录
 * 3. 自动匹配并确认
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 定时任务密钥
const CRON_KEY = process.env.CRON_KEY || 'your-cron-key';

/*
 * 定时任务接口
 * 
 * Vercel Cron Jobs 配置示例 (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/payment/cron?cronKey=your-cron-key",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 * 
 * 或使用外部定时服务（如 cron-job.org）每小时调用一次
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cronKey = searchParams.get('cronKey');

  // 验证密钥
  if (cronKey !== CRON_KEY) {
    return NextResponse.json(
      { error: 'Invalid cron key' },
      { status: 403 }
    );
  }

  console.log('[定时任务] 开始检查待支付订单...');

  try {
    const client = getSupabaseClient();
    const results: {
      checked: number;
      confirmed: number;
      expired: number;
      errors: Array<{ orderNo: string; error: string }>;
    } = {
      checked: 0,
      confirmed: 0,
      expired: 0,
      errors: [],
    };

    // 1. 检查待支付订单
    const { data: pendingOrders, error } = await client
      .from('payment_orders')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[定时任务] 查询订单失败:', error);
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    results.checked = pendingOrders?.length || 0;

    // 2. 检查每个订单
    for (const order of (pendingOrders || [])) {
      try {
        // 检查是否超时（24小时）
        const createdAt = new Date(order.created_at);
        const hoursPassed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

        if (hoursPassed > 24) {
          // 标记为过期
          await client
            .from('payment_orders')
            .update({ status: 'expired' })
            .eq('id', order.id);
          
          results.expired++;
          continue;
        }

        // 这里可以添加额外的检查逻辑
        // 比如检查收款通知表、第三方支付平台等

      } catch (err) {
        console.error('[定时任务] 处理订单失败:', err);
        results.errors.push({
          orderNo: order.order_no,
          error: String(err),
        });
      }
    }

    // 3. 检查收款通知表（如果有的话）
    // 这个表用于存储收到的收款通知
    const { data: notifications } = await client
      .from('payment_notifications')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(50);

    if (notifications && notifications.length > 0) {
      for (const notification of notifications) {
        try {
          // 尝试匹配订单
          const matched = await matchNotificationToOrder(client, notification);
          
          if (matched) {
            results.confirmed++;
          }

          // 标记通知为已处理
          await client
            .from('payment_notifications')
            .update({ processed: true })
            .eq('id', notification.id);

        } catch (err) {
          console.error('[定时任务] 处理通知失败:', err);
        }
      }
    }

    console.log('[定时任务] 完成:', results);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });

  } catch (error) {
    console.error('[定时任务] 执行失败:', error);
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    );
  }
}

/**
 * 将收款通知匹配到订单
 */
async function matchNotificationToOrder(
  client: ReturnType<typeof getSupabaseClient>,
  notification: Record<string, unknown>
): Promise<boolean> {
  const amount = notification.amount as number;
  const orderId = notification.order_id as string;
  const paymentMethod = notification.payment_method as string;

  // 如果有订单号，直接匹配
  if (orderId) {
    const { data: order } = await client
      .from('payment_orders')
      .select('*')
      .eq('order_no', orderId)
      .eq('status', 'pending')
      .single();

    if (order) {
      await confirmOrder(client, order);
      return true;
    }
  }

  // 通过金额匹配
  const { data: orders } = await client
    .from('payment_orders')
    .select('*')
    .eq('status', 'pending')
    .eq('amount', Math.round(amount * 100))
    .eq('payment_method', paymentMethod)
    .order('created_at', { ascending: true })
    .limit(1);

  if (orders && orders.length > 0) {
    await confirmOrder(client, orders[0]);
    return true;
  }

  return false;
}

/**
 * 确认订单
 */
async function confirmOrder(
  client: ReturnType<typeof getSupabaseClient>,
  order: Record<string, unknown>
): Promise<void> {
  // 更新订单
  await client
    .from('payment_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  // 更新用户
  await client
    .from('users')
    .update({
      payment_status: 'paid',
      is_paid: true,
      paid_at: new Date().toISOString(),
    })
    .eq('device_fingerprint', order.device_fingerprint);

  console.log('[定时任务] 订单已确认:', order.order_no);
}
