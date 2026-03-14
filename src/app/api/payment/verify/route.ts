/**
 * 支付状态验证
 * 支持两种方式：
 * 1. 主动查询易支付订单状态
 * 2. 检查本地数据库订单状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { queryYiPayOrder } from '@/lib/payment/yipay';

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

    // 查询本地订单
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

    // 如果已经是支付状态，直接返回
    if (order.status === 'paid') {
      return NextResponse.json({
        success: true,
        isPaid: true,
        message: '订单已支付',
      });
    }

    // 如果是易支付订单，主动查询支付状态
    if (order.payment_type === 'yipay') {
      const config = {
        apiUrl: process.env.YIPAY_API_URL || '',
        pid: process.env.YIPAY_PID || '',
        key: process.env.YIPAY_KEY || '',
        notifyUrl: '',
        returnUrl: '',
      };

      if (config.apiUrl && config.pid && config.key) {
        const paymentType = order.payment_method === 'wechat' ? 'wxpay' : 'alipay';
        const queryResult = await queryYiPayOrder(config, orderNo, paymentType);

        if (queryResult.success && queryResult.status === 'paid') {
          // 更新订单状态
          await client
            .from('payment_orders')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              transaction_id: queryResult.tradeNo,
            })
            .eq('order_no', orderNo);

          // 更新用户状态
          await client
            .from('users')
            .update({
              payment_status: 'paid',
              is_paid: true,
              paid_at: new Date().toISOString(),
            })
            .eq('device_fingerprint', order.device_fingerprint);

          console.log('[支付验证] 订单已支付:', orderNo);

          return NextResponse.json({
            success: true,
            isPaid: true,
            message: '支付成功，功能已解锁！',
          });
        }
      }
    }

    return NextResponse.json({
      success: false,
      isPaid: false,
      message: '订单尚未支付',
    });

  } catch (error) {
    console.error('[支付验证] 失败:', error);
    return NextResponse.json(
      { error: '验证失败' },
      { status: 500 }
    );
  }
}

// PUT 方法用于测试模式手动确认
export async function PUT(request: NextRequest) {
  try {
    const { orderNo, adminKey } = await request.json();

    // 验证管理员密钥
    if (adminKey !== process.env.ADMIN_KEY) {
      return NextResponse.json(
        { error: '无权限' },
        { status: 403 }
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

    // 更新订单状态
    await client
      .from('payment_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('order_no', orderNo);

    // 更新用户状态
    await client
      .from('users')
      .update({
        payment_status: 'paid',
        is_paid: true,
        paid_at: new Date().toISOString(),
      })
      .eq('device_fingerprint', order.device_fingerprint);

    return NextResponse.json({
      success: true,
      message: '订单已确认',
    });

  } catch (error) {
    console.error('[手动确认] 失败:', error);
    return NextResponse.json(
      { error: '确认失败' },
      { status: 500 }
    );
  }
}
