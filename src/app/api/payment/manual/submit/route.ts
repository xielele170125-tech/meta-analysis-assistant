/**
 * 手动支付提交接口
 * 用户提交支付凭证，管理员后台审核
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const { 
      deviceFingerprint, 
      orderNo, 
      paymentMethod, 
      paymentProof, 
      contactInfo 
    } = await request.json();

    if (!deviceFingerprint || !orderNo || !paymentProof) {
      return NextResponse.json(
        { error: '缺少必要参数' },
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

    // 创建待审核订单
    const { error: orderError } = await client
      .from('payment_orders')
      .insert({
        user_id: user.id,
        device_fingerprint: deviceFingerprint,
        order_no: orderNo,
        payment_method: paymentMethod,
        payment_type: 'manual',
        amount: 990, // ¥9.9，单位分
        currency: 'CNY',
        status: 'pending',
        // 存储支付凭证和联系方式
        metadata: {
          payment_proof: paymentProof,
          contact_info: contactInfo || '',
          submitted_at: new Date().toISOString(),
        },
      });

    if (orderError) {
      console.error('创建订单失败:', orderError);
      return NextResponse.json(
        { error: '创建订单失败' },
        { status: 500 }
      );
    }

    console.log('[手动支付] 新订单提交:', {
      orderNo,
      deviceFingerprint,
      paymentMethod,
    });

    return NextResponse.json({
      success: true,
      message: '提交成功，请等待审核',
      orderNo,
    });

  } catch (error) {
    console.error('提交支付凭证失败:', error);
    return NextResponse.json(
      { error: '提交失败' },
      { status: 500 }
    );
  }
}
