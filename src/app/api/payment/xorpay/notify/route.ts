/**
 * XorPay 支付回调接口
 * 接收码支付平台的异步通知
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyXorPayNotify, XorPayNotify } from '@/lib/payment/xorpay';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[XorPay Notify] 收到回调:', body);
    
    // 获取配置
    const appSecret = process.env.XORPAY_APP_SECRET;
    if (!appSecret) {
      console.error('[XorPay Notify] 未配置 XORPAY_APP_SECRET');
      return new NextResponse('fail', { status: 500 });
    }
    
    const notify: XorPayNotify = {
      order_id: body.order_id,
      pay_id: body.pay_id,
      price: body.price,
      pay_price: body.pay_price,
      more: body.more || '',
      time: body.time,
      sign: body.sign,
    };
    
    // 验证签名
    if (!verifyXorPayNotify(notify, appSecret)) {
      console.error('[XorPay Notify] 签名验证失败');
      return new NextResponse('sign error', { status: 400 });
    }
    
    const supabase = getSupabaseClient();
    
    // 查询订单
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_no', notify.order_id)
      .single();
    
    if (orderError || !order) {
      console.error('[XorPay Notify] 订单不存在:', notify.order_id);
      return new NextResponse('order not found', { status: 404 });
    }
    
    // 检查订单状态
    if (order.status === 'paid') {
      console.log('[XorPay Notify] 订单已处理:', notify.order_id);
      return new NextResponse('success', { status: 200 });
    }
    
    // 验证金额
    const paidAmount = parseFloat(notify.pay_price);
    const expectedAmount = order.amount;
    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
      console.error('[XorPay Notify] 金额不匹配:', { paid: paidAmount, expected: expectedAmount });
      return new NextResponse('amount error', { status: 400 });
    }
    
    // 更新订单状态
    const { error: updateError } = await supabase
      .from('payment_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        transaction_id: notify.pay_id,
        payment_method: 'xorpay',
      })
      .eq('order_no', notify.order_id);
    
    if (updateError) {
      console.error('[XorPay Notify] 更新订单失败:', updateError);
      return new NextResponse('update error', { status: 500 });
    }
    
    // 更新用户付费状态
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        is_paid: true,
        paid_at: new Date().toISOString(),
      })
      .eq('device_fingerprint', order.device_fingerprint);
    
    if (userUpdateError) {
      console.error('[XorPay Notify] 更新用户状态失败:', userUpdateError);
      // 不返回错误，因为订单已更新
    }
    
    console.log('[XorPay Notify] 支付成功:', notify.order_id);
    
    return new NextResponse('success', { status: 200 });
    
  } catch (error) {
    console.error('[XorPay Notify] 处理回调失败:', error);
    return new NextResponse('error', { status: 500 });
  }
}
