/**
 * 自动验证支付状态
 * 用户支付后点击"检测"触发
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 定价（分）
const EXPECTED_AMOUNT = 990; // ¥9.9

export async function POST(request: NextRequest) {
  try {
    const { orderNo, deviceFingerprint } = await request.json();

    if (!orderNo) {
      return NextResponse.json(
        { error: '缺少订单号' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查询订单
    const { data: order, error } = await client
      .from('payment_orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (error || !order) {
      return NextResponse.json({
        success: false,
        message: '订单不存在',
      });
    }

    // 验证设备指纹
    if (order.device_fingerprint !== deviceFingerprint) {
      return NextResponse.json({
        success: false,
        message: '订单不属于当前设备',
      });
    }

    // 已经支付成功
    if (order.status === 'paid') {
      return NextResponse.json({
        success: true,
        message: '订单已支付成功',
        isPaid: true,
      });
    }

    // 检查是否有匹配的收款记录
    // 这里可以扩展：检查 payment_notifications 表
    const { data: notifications } = await client
      .from('payment_notifications')
      .select('*')
      .eq('processed', false)
      .gte('created_at', order.created_at)
      .order('created_at', { ascending: false })
      .limit(10);

    if (notifications && notifications.length > 0) {
      // 尝试匹配
      for (const notification of notifications) {
        // 匹配条件：金额相同 或 订单号匹配
        const amountMatch = Math.abs(Number(notification.amount) - EXPECTED_AMOUNT / 100) < 0.01;
        const orderMatch = notification.order_id === orderNo;

        if (amountMatch || orderMatch) {
          // 找到匹配，确认订单
          await confirmOrder(client, order, notification.id);

          return NextResponse.json({
            success: true,
            message: '支付已确认，功能已解锁！',
            isPaid: true,
          });
        }
      }
    }

    // 没有找到匹配，但可以模拟支付成功（仅测试用）
    // 生产环境请删除此段
    const isTestMode = process.env.NODE_ENV === 'development';
    if (isTestMode && process.env.ENABLE_TEST_PAYMENT === 'true') {
      await confirmOrder(client, order, null);
      return NextResponse.json({
        success: true,
        message: '[测试模式] 支付已确认',
        isPaid: true,
      });
    }

    // 返回待确认状态
    return NextResponse.json({
      success: false,
      message: '暂未检测到支付记录，请稍后再试或联系管理员',
      isPaid: false,
      orderStatus: order.status,
    });

  } catch (error) {
    console.error('自动验证失败:', error);
    return NextResponse.json(
      { error: '验证失败' },
      { status: 500 }
    );
  }
}

/**
 * 确认订单并解锁用户
 */
async function confirmOrder(
  client: ReturnType<typeof getSupabaseClient>,
  order: Record<string, unknown>,
  notificationId: string | null
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

  // 标记通知为已处理
  if (notificationId) {
    await client
      .from('payment_notifications')
      .update({
        processed: true,
        matched_order: order.order_no as string,
        processed_at: new Date().toISOString(),
      })
      .eq('id', notificationId);
  }

  console.log('[自动审核] 订单已确认:', order.order_no);
}
