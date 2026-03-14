/**
 * 创建 XorPay 支付订单
 * 支持微信、支付宝扫码支付
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createXorPayOrder } from '@/lib/payment/xorpay';

// 定价配置（国内支付）
const PRICING = {
  wechat: {
    amount: 9.9,
    name: 'Meta分析工具完整版',
    display: '¥9.9',
  },
  alipay: {
    amount: 9.9,
    name: 'Meta分析工具完整版',
    display: '¥9.9',
  },
};

// 生成订单号
function generateOrderNo(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `XP${timestamp}${random}`;
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

    // 验证支付方式
    if (!['wechat', 'alipay'].includes(paymentMethod)) {
      return NextResponse.json(
        { error: '仅支持微信或支付宝' },
        { status: 400 }
      );
    }

    // 获取 XorPay 配置
    const appId = process.env.XORPAY_APP_ID;
    const appSecret = process.env.XORPAY_APP_SECRET;
    
    if (!appId || !appSecret) {
      console.error('XorPay 配置缺失');
      return NextResponse.json(
        { error: '支付服务暂不可用，请联系管理员' },
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

    const pricing = PRICING[paymentMethod as keyof typeof PRICING];
    const orderNo = generateOrderNo();

    // 创建本地订单
    const { data: order, error: orderError } = await client
      .from('payment_orders')
      .insert({
        user_id: user.id,
        device_fingerprint: deviceFingerprint,
        order_no: orderNo,
        payment_method: paymentMethod,
        payment_type: 'domestic',
        amount: pricing.amount * 100, // 转换为分
        currency: 'CNY',
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('创建订单失败:', orderError);
      return NextResponse.json(
        { error: '创建订单失败' },
        { status: 500 }
      );
    }

    // 调用 XorPay 创建支付订单
    const notifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/payment/xorpay/notify`;
    
    const xorpayResult = await createXorPayOrder(
      {
        appId,
        appSecret,
        notifyUrl,
      },
      {
        name: pricing.name,
        price: pricing.amount,
        order_id: orderNo,
        order_uid: deviceFingerprint,
      }
    );

    if (!xorpayResult.success) {
      // 标记订单为失败
      await client
        .from('payment_orders')
        .update({ status: 'failed' })
        .eq('order_no', orderNo);
      
      return NextResponse.json(
        { error: xorpayResult.message || '创建支付订单失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order: {
        orderNo,
        amount: pricing.amount,
        displayAmount: pricing.display,
        paymentMethod,
        status: 'pending',
      },
      payment: {
        url: xorpayResult.url,
        qrcode: xorpayResult.qrcode,
      },
    });

  } catch (error) {
    console.error('创建支付订单失败:', error);
    return NextResponse.json(
      { error: '创建支付订单失败' },
      { status: 500 }
    );
  }
}
