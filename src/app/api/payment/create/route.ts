import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 定价配置
const PRICING = {
  domestic: {
    amount: 990, // 9.9元，单位：分
    currency: 'CNY',
    displayAmount: '¥9.9',
  },
  international: {
    amount: 300, // $3.00，单位：分
    currency: 'USD',
    displayAmount: '$3.00',
  },
};

// 生成订单号
function generateOrderNo(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MA${timestamp}${random}`;
}

// 创建支付订单
export async function POST(request: NextRequest) {
  try {
    const { deviceFingerprint, paymentMethod, paymentType, email } = await request.json();

    if (!deviceFingerprint || !paymentMethod || !paymentType) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证支付类型
    if (!['domestic', 'international'].includes(paymentType)) {
      return NextResponse.json(
        { error: '无效的支付类型' },
        { status: 400 }
      );
    }

    // 验证支付方式
    if (paymentType === 'domestic' && !['wechat', 'alipay'].includes(paymentMethod)) {
      return NextResponse.json(
        { error: '国内支付仅支持微信或支付宝' },
        { status: 400 }
      );
    }
    if (paymentType === 'international' && paymentMethod !== 'stripe') {
      return NextResponse.json(
        { error: '国际支付仅支持Stripe' },
        { status: 400 }
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
          email: email || null,
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

    // 如果提供了邮箱，更新用户邮箱
    if (email && email !== user.email) {
      await client
        .from('users')
        .update({ email })
        .eq('id', user.id);
    }

    const pricing = PRICING[paymentType as keyof typeof PRICING];
    const orderNo = generateOrderNo();

    // 创建订单
    const { data: order, error: orderError } = await client
      .from('payment_orders')
      .insert({
        user_id: user.id,
        order_no: orderNo,
        payment_method: paymentMethod,
        payment_type: paymentType,
        amount: pricing.amount,
        currency: pricing.currency,
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

    // 根据支付方式返回不同的支付信息
    let paymentInfo: Record<string, unknown> = {};

    if (paymentMethod === 'stripe') {
      // Stripe 支付需要在前端使用 Stripe.js
      paymentInfo = {
        stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
        // 实际项目中这里应该调用 Stripe API 创建 PaymentIntent
        clientSecret: `pi_${orderNo}_secret_${Date.now()}`,
      };
    } else {
      // 微信/支付宝支付
      // 实际项目中这里应该调用对应的支付 API 获取支付二维码或跳转链接
      // 这里返回模拟的支付信息，前端显示二维码
      paymentInfo = {
        // 实际项目中替换为真实的支付二维码链接
        qrCodeUrl: `/api/payment/qrcode/${orderNo}`,
        redirectUrl: `/api/payment/redirect/${orderNo}`,
      };
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNo: order.order_no,
        amount: pricing.amount,
        currency: pricing.currency,
        displayAmount: pricing.displayAmount,
        paymentMethod,
        paymentType,
        status: order.status,
        createdAt: order.created_at,
      },
      paymentInfo,
    });
  } catch (error) {
    console.error('创建支付订单失败:', error);
    return NextResponse.json(
      { error: '创建支付订单失败' },
      { status: 500 }
    );
  }
}
