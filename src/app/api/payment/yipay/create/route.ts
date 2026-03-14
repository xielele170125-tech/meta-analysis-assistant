/**
 * 易支付 - 创建支付订单
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createYiPayOrder, YiPayConfig } from '@/lib/payment/yipay';

// 定价
const PRICING = {
  amount: '9.90',
  name: 'Meta分析工具完整版',
};

// 生成订单号
function generateOrderNo(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `YP${timestamp}${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const { deviceFingerprint, paymentMethod } = await request.json();

    if (!deviceFingerprint || !paymentMethod) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 获取易支付配置
    const config: YiPayConfig = {
      apiUrl: process.env.YIPAY_API_URL || '',
      pid: process.env.YIPAY_PID || '',
      key: process.env.YIPAY_KEY || '',
      notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/yipay/notify`,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
    };

    // 调试日志 - 输出环境变量状态（不输出敏感值）
    console.log('[易支付] 环境变量检查:', {
      YIPAY_API_URL: config.apiUrl ? `✅ 已设置 (${config.apiUrl})` : '❌ 未设置',
      YIPAY_PID: config.pid ? `✅ 已设置 (${config.pid})` : '❌ 未设置',
      YIPAY_KEY: config.key ? '✅ 已设置 (已隐藏)' : '❌ 未设置',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ? `✅ 已设置 (${process.env.NEXT_PUBLIC_APP_URL})` : '❌ 未设置',
    });

    if (!config.apiUrl || !config.pid || !config.key) {
      console.error('[易支付] 配置缺失:', {
        apiUrl: !!config.apiUrl,
        pid: !!config.pid,
        key: !!config.key,
      });
      return NextResponse.json(
        { 
          error: '支付服务暂未配置，请联系管理员',
          debug: {
            apiUrl: !!config.apiUrl,
            pid: !!config.pid,
            key: !!config.key,
          }
        },
        { status: 503 }
      );
    }

    const client = getSupabaseClient();

    // 获取或创建用户
    let { data: user, error: userError } = await client
      .from('users')
      .select('*')
      .eq('device_fingerprint', deviceFingerprint)
      .single();

    if (userError && userError.code === 'PGRST116') {
      const { data: newUser, error: createError } = await client
        .from('users')
        .insert({
          device_fingerprint: deviceFingerprint,
          payment_status: 'free',
        })
        .select()
        .single();

      if (createError) {
        console.error('创建用户失败:', createError);
        return NextResponse.json(
          { error: '创建用户失败' },
          { status: 500 }
        );
      }
      user = newUser;
    } else if (userError) {
      console.error('查询用户失败:', userError);
      return NextResponse.json(
        { error: '查询用户失败' },
        { status: 500 }
      );
    }

    // 检查是否已付费
    if (user.payment_status === 'paid') {
      return NextResponse.json({
        success: false,
        message: '您已购买过，无需重复购买',
      });
    }

    const orderNo = generateOrderNo();

    // 创建本地订单
    const { data: order, error: orderError } = await client
      .from('payment_orders')
      .insert({
        user_id: user.id,
        device_fingerprint: deviceFingerprint,
        order_no: orderNo,
        payment_method: paymentMethod,
        payment_type: 'yipay',
        amount: Math.round(parseFloat(PRICING.amount) * 100),
        currency: 'CNY',
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('创建本地订单失败:', {
        code: orderError.code,
        message: orderError.message,
        details: orderError.details,
        hint: orderError.hint,
      });
      return NextResponse.json(
        { 
          error: '创建订单失败',
          detail: orderError.message,
          code: orderError.code,
        },
        { status: 500 }
      );
    }

    // 调用易支付创建支付订单
    const payResult = createYiPayOrder(config, {
      type: paymentMethod === 'alipay' ? 'alipay' : 'wxpay',
      outTradeNo: orderNo,
      name: PRICING.name,
      money: PRICING.amount,
    });

    if (!payResult.success) {
      await client
        .from('payment_orders')
        .update({ status: 'failed' })
        .eq('order_no', orderNo);
      
      return NextResponse.json(
        { error: payResult.error || '创建支付订单失败' },
        { status: 500 }
      );
    }

    console.log('[易支付] 订单创建成功:', { orderNo });

    return NextResponse.json({
      success: true,
      order: {
        orderNo,
        amount: PRICING.amount,
        displayAmount: `¥${PRICING.amount}`,
        paymentMethod,
        status: 'pending',
      },
      payment: {
        payUrl: payResult.payUrl,
        qrCode: payResult.qrCode,
      },
    });

  } catch (error) {
    console.error('[易支付] 创建支付订单失败:', error);
    return NextResponse.json(
      { error: '创建支付订单失败' },
      { status: 500 }
    );
  }
}
