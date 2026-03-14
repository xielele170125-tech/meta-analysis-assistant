/**
 * 管理员审核支付订单
 * 确认收款后解锁用户功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 管理员密钥（从环境变量获取）
const ADMIN_KEY = process.env.ADMIN_KEY || 'your-admin-key';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const adminKey = searchParams.get('adminKey');
    const status = searchParams.get('status') || 'pending';

    // 验证管理员密钥
    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json(
        { error: '无权限访问' },
        { status: 403 }
      );
    }

    const client = getSupabaseClient();

    // 查询订单列表
    const { data: orders, error } = await client
      .from('payment_orders')
      .select(`
        *,
        users!inner(device_fingerprint, email)
      `)
      .eq('payment_type', 'manual')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('查询订单失败:', error);
      return NextResponse.json(
        { error: '查询订单失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orders,
    });

  } catch (error) {
    console.error('查询订单失败:', error);
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { adminKey, orderNo, action } = await request.json();

    // 验证管理员密钥
    if (adminKey !== ADMIN_KEY) {
      return NextResponse.json(
        { error: '无权限访问' },
        { status: 403 }
      );
    }

    if (!orderNo || !action) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查询订单
    const { data: order, error: orderError } = await client
      .from('payment_orders')
      .select('*')
      .eq('order_no', orderNo)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      );
    }

    if (action === 'approve') {
      // 批准订单
      const { error: updateError } = await client
        .from('payment_orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('order_no', orderNo);

      if (updateError) {
        console.error('更新订单失败:', updateError);
        return NextResponse.json(
          { error: '更新订单失败' },
          { status: 500 }
        );
      }

      // 更新用户状态
      const { error: userError } = await client
        .from('users')
        .update({
          payment_status: 'paid',
          is_paid: true,
          paid_at: new Date().toISOString(),
        })
        .eq('device_fingerprint', order.device_fingerprint);

      if (userError) {
        console.error('更新用户状态失败:', userError);
      }

      console.log('[管理员审核] 订单已批准:', orderNo);

      return NextResponse.json({
        success: true,
        message: '订单已批准，用户功能已解锁',
      });

    } else if (action === 'reject') {
      // 拒绝订单
      const { error: updateError } = await client
        .from('payment_orders')
        .update({
          status: 'rejected',
        })
        .eq('order_no', orderNo);

      if (updateError) {
        console.error('更新订单失败:', updateError);
        return NextResponse.json(
          { error: '更新订单失败' },
          { status: 500 }
        );
      }

      console.log('[管理员审核] 订单已拒绝:', orderNo);

      return NextResponse.json({
        success: true,
        message: '订单已拒绝',
      });

    } else {
      return NextResponse.json(
        { error: '无效的操作' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('审核订单失败:', error);
    return NextResponse.json(
      { error: '审核失败' },
      { status: 500 }
    );
  }
}
