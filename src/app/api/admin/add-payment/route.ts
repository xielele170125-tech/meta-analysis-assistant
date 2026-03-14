/**
 * 管理员添加收款记录
 * 添加后自动匹配待支付订单
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const ADMIN_KEY = process.env.ADMIN_KEY || 'your-admin-key';

export async function POST(request: NextRequest) {
  try {
    const { 
      adminKey, 
      amount, 
      orderId, 
      paymentMethod,
      rawContent 
    } = await request.json();

    // 验证管理员密钥
    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json(
        { error: '无权限' },
        { status: 403 }
      );
    }

    if (!amount) {
      return NextResponse.json(
        { error: '缺少金额' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 添加收款记录
    const { data: notification, error } = await client
      .from('payment_notifications')
      .insert({
        source: 'manual',
        amount: Number(amount),
        order_id: orderId || null,
        payment_method: paymentMethod || 'wechat',
        raw_content: rawContent || '',
        processed: false,
      })
      .select()
      .single();

    if (error) {
      console.error('添加收款记录失败:', error);
      return NextResponse.json(
        { error: '添加失败' },
        { status: 500 }
      );
    }

    // 尝试自动匹配订单
    let matched = false;
    let matchedOrderNo = null;

    // 如果有订单号，直接匹配
    if (orderId) {
      const { data: order } = await client
        .from('payment_orders')
        .select('*')
        .eq('order_no', orderId)
        .eq('status', 'pending')
        .single();

      if (order) {
        await confirmOrder(client, order, notification.id);
        matched = true;
        matchedOrderNo = order.order_no;
      }
    }

    // 如果没有订单号，通过金额匹配
    if (!matched) {
      const oneHourAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      
      const { data: orders } = await client
        .from('payment_orders')
        .select('*')
        .eq('status', 'pending')
        .eq('amount', Math.round(Number(amount) * 100))
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (orders && orders.length > 0) {
        await confirmOrder(client, orders[0], notification.id);
        matched = true;
        matchedOrderNo = orders[0].order_no;
      }
    }

    console.log('[管理员添加收款] 记录已添加:', {
      amount,
      orderId,
      matched,
      matchedOrderNo
    });

    return NextResponse.json({
      success: true,
      message: matched 
        ? `收款记录已添加，订单 ${matchedOrderNo} 已自动确认` 
        : '收款记录已添加，暂未找到匹配订单',
      matched,
      matchedOrderNo,
    });

  } catch (error) {
    console.error('添加收款记录失败:', error);
    return NextResponse.json(
      { error: '添加失败' },
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
  notificationId: string
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
  await client
    .from('payment_notifications')
    .update({
      processed: true,
      matched_order: order.order_no as string,
      processed_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  console.log('[自动审核] 订单已确认:', order.order_no);
}
