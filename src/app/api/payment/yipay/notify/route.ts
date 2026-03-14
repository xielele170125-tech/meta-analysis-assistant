/**
 * 易支付 - 支付回调通知
 * 用户支付成功后，易支付会自动调用此接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyYiPayCallback, parseYiPayCallback } from '@/lib/payment/yipay';

export async function GET(request: NextRequest) {
  return handleCallback(request);
}

export async function POST(request: NextRequest) {
  return handleCallback(request);
}

async function handleCallback(request: NextRequest) {
  try {
    // 获取参数
    const url = new URL(request.url);
    const params: Record<string, string> = {};
    
    // 支持GET和POST两种方式
    if (request.method === 'GET') {
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
    } else {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        params[key] = value.toString();
      });
    }

    console.log('[易支付回调] 收到通知:', params);

    // 验证签名
    const key = process.env.YIPAY_KEY || '';
    if (!verifyYiPayCallback(params, key)) {
      console.error('[易支付回调] 签名验证失败');
      return new NextResponse('fail', { status: 400 });
    }

    // 解析回调参数
    const result = parseYiPayCallback(params);
    if (!result.success || !result.orderNo) {
      console.error('[易支付回调] 解析失败');
      return new NextResponse('fail', { status: 400 });
    }

    const client = getSupabaseClient();

    // 查询订单
    const { data: order, error } = await client
      .from('payment_orders')
      .select('*')
      .eq('order_no', result.orderNo)
      .eq('status', 'pending')
      .single();

    if (error || !order) {
      console.error('[易支付回调] 订单不存在:', result.orderNo);
      return new NextResponse('fail', { status: 400 });
    }

    // 验证金额
    const expectedAmount = order.amount / 100;
    const paidAmount = parseFloat(result.amount || '0');
    if (Math.abs(expectedAmount - paidAmount) > 0.01) {
      console.error('[易支付回调] 金额不匹配:', { expected: expectedAmount, paid: paidAmount });
      return new NextResponse('fail', { status: 400 });
    }

    // 更新订单状态
    await client
      .from('payment_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        transaction_id: result.tradeNo,
      })
      .eq('order_no', result.orderNo);

    // 更新用户状态
    await client
      .from('users')
      .update({
        payment_status: 'paid',
        is_paid: true,
        paid_at: new Date().toISOString(),
      })
      .eq('device_fingerprint', order.device_fingerprint);

    console.log('[易支付回调] 订单已确认:', result.orderNo);

    // 返回成功响应（易支付要求返回 "success"）
    return new NextResponse('success', { status: 200 });

  } catch (error) {
    console.error('[易支付回调] 处理失败:', error);
    return new NextResponse('fail', { status: 500 });
  }
}
