/**
 * 创建免签支付订单
 * 支持微信、支付宝扫码支付
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createMianqianOrder, MIANQIAN_PLATFORMS } from '@/lib/payment/mianqian';

// 定价配置
const PRICING = {
  wxpay: {
    amount: '9.90',
    name: 'Meta分析工具完整版',
    display: '¥9.9',
  },
  alipay: {
    amount: '9.90',
    name: 'Meta分析工具完整版',
    display: '¥9.9',
  },
};

// 生成订单号
function generateOrderNo(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `MQ${timestamp}${random}`;
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
    if (!['wxpay', 'alipay'].includes(paymentMethod)) {
      return NextResponse.json(
        { error: '仅支持微信或支付宝' },
        { status: 400 }
      );
    }

    // 获取免签支付配置
    const pid = process.env.MIANQIAN_PID;
    const key = process.env.MIANQIAN_KEY;
    const platform = (process.env.MIANQIAN_PLATFORM || 'mfk') as keyof typeof MIANQIAN_PLATFORMS;
    
    if (!pid || !key) {
      console.error('免签支付配置缺失');
      return NextResponse.json(
        { error: '支付服务暂未配置，请联系管理员' },
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
        payment_method: paymentMethod === 'wxpay' ? 'wechat' : 'alipay',
        payment_type: 'domestic',
        amount: Math.round(parseFloat(pricing.amount) * 100), // 转换为分
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

    // 调用免签支付创建订单
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com';
    const platformConfig = MIANQIAN_PLATFORMS[platform];
    
    const payResult = await createMianqianOrder(
      {
        pid,
        key,
        apiUrl: platformConfig.apiUrl,
        notifyUrl: `${appUrl}/api/payment/mianqian/notify`,
        returnUrl: `${appUrl}/payment/success`,
      },
      {
        type: paymentMethod,
        out_trade_no: orderNo,
        name: pricing.name,
        money: pricing.amount,
        device: deviceFingerprint,
      }
    );

    if (payResult.code !== 1) {
      // 标记订单为失败
      await client
        .from('payment_orders')
        .update({ status: 'failed' })
        .eq('order_no', orderNo);
      
      return NextResponse.json(
        { error: payResult.msg || '创建支付订单失败' },
        { status: 500 }
      );
    }

    console.log('[免签支付] 订单创建成功:', {
      orderNo,
      tradeNo: payResult.trade_no,
      money: payResult.money,
    });

    return NextResponse.json({
      success: true,
      order: {
        orderNo,
        amount: pricing.amount,
        displayAmount: pricing.display,
        paymentMethod: paymentMethod === 'wxpay' ? 'wechat' : 'alipay',
        status: 'pending',
      },
      payment: {
        qrCode: payResult.qr_code,      // 二维码图片链接
        payUrl: payResult.pay_url,       // 支付页面链接
        tradeNo: payResult.trade_no,     // 平台订单号
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
