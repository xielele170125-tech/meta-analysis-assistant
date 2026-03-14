import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 验证支付状态
export async function POST(request: NextRequest) {
  try {
    const { orderNo, deviceFingerprint } = await request.json();

    if (!orderNo || !deviceFingerprint) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查询订单
    const { data: order, error: orderError } = await client
      .from('payment_orders')
      .select(`
        *,
        users!inner(device_fingerprint)
      `)
      .eq('order_no', orderNo)
      .single();

    if (orderError) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }

    // 验证设备指纹
    if (order.users.device_fingerprint !== deviceFingerprint) {
      return NextResponse.json(
        { error: '订单与当前设备不匹配' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNo: order.order_no,
        amount: order.amount,
        currency: order.currency,
        paymentMethod: order.payment_method,
        paymentType: order.payment_type,
        status: order.status,
        paidAt: order.paid_at,
        createdAt: order.created_at,
      },
      isPaid: order.status === 'paid',
    });
  } catch (error) {
    console.error('验证支付状态失败:', error);
    return NextResponse.json(
      { error: '验证支付状态失败' },
      { status: 500 }
    );
  }
}

// 模拟支付成功（仅用于测试，生产环境应删除或通过webhook回调）
export async function PUT(request: NextRequest) {
  try {
    const { orderNo, adminKey } = await request.json();

    // 简单的管理密钥验证（生产环境应使用更安全的方式）
    if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'test_admin_key') {
      return NextResponse.json(
        { error: '无权限' },
        { status: 403 }
      );
    }

    const client = getSupabaseClient();

    // 查询订单
    const { data: order, error: orderError } = await client
      .from('payment_orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (orderError) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }

    if (order.status === 'paid') {
      return NextResponse.json({
        success: true,
        message: '订单已支付',
        order,
      });
    }

    // 更新订单状态
    const { error: updateOrderError } = await client
      .from('payment_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        transaction_id: `MOCK_${Date.now()}`,
      })
      .eq('id', order.id);

    if (updateOrderError) {
      console.error('更新订单状态失败:', updateOrderError);
      return NextResponse.json(
        { error: '更新订单状态失败' },
        { status: 500 }
      );
    }

    // 更新用户付费状态
    const { error: updateUserError } = await client
      .from('users')
      .update({
        payment_status: 'paid',
        payment_type: order.payment_type,
        paid_at: new Date().toISOString(),
      })
      .eq('id', order.user_id);

    if (updateUserError) {
      console.error('更新用户状态失败:', updateUserError);
      return NextResponse.json(
        { error: '更新用户状态失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '支付成功',
      order: {
        ...order,
        status: 'paid',
        paid_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('模拟支付失败:', error);
    return NextResponse.json(
      { error: '模拟支付失败' },
      { status: 500 }
    );
  }
}
