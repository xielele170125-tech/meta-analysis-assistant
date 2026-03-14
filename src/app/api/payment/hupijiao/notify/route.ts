/**
 * 虎皮椒支付回调接口
 * 接收虎皮椒的异步通知
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyHupijiaoNotify, HupijiaoNotify } from '@/lib/payment/hupijiao';

export async function POST(request: NextRequest) {
  try {
    // 虎皮椒使用 form 表单提交
    const formData = await request.formData();
    const body: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });
    
    console.log('[虎皮椒回调] 收到通知:', body);
    
    // 获取配置
    const appsecret = process.env.HUPIJIAO_APPSECRET;
    if (!appsecret) {
      console.error('[虎皮椒回调] 未配置 HUPIJIAO_APPSECRET');
      return new NextResponse('fail', { status: 500 });
    }
    
    const notify: HupijiaoNotify = {
      order_id: body.order_id || '',
      out_trade_no: body.out_trade_no || '',
      type: body.type || '',
      price: body.price || '',
      time: body.time || '',
      trade_status: body.trade_status || '',
      sign: body.sign || '',
      params: body.params,
    };
    
    // 验证签名
    if (!verifyHupijiaoNotify(notify, appsecret)) {
      console.error('[虎皮椒回调] 签名验证失败');
      return new NextResponse('sign error', { status: 400 });
    }
    
    // 验证交易状态
    if (notify.trade_status !== 'TRADE_SUCCESS') {
      console.log('[虎皮椒回调] 交易状态非成功:', notify.trade_status);
      return new NextResponse('success', { status: 200 });
    }
    
    const supabase = getSupabaseClient();
    
    // 查询订单
    const { data: order, error: orderError } = await supabase
      .from('payment_orders')
      .select('*')
      .eq('order_no', notify.out_trade_no)
      .single();
    
    if (orderError || !order) {
      console.error('[虎皮椒回调] 订单不存在:', notify.out_trade_no);
      return new NextResponse('order not found', { status: 404 });
    }
    
    // 检查订单状态
    if (order.status === 'paid') {
      console.log('[虎皮椒回调] 订单已处理:', notify.out_trade_no);
      return new NextResponse('success', { status: 200 });
    }
    
    // 验证金额
    const paidAmount = parseFloat(notify.price);
    const expectedAmount = order.amount / 100; // 数据库存储的是分
    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
      console.error('[虎皮椒回调] 金额不匹配:', { paid: paidAmount, expected: expectedAmount });
      return new NextResponse('amount error', { status: 400 });
    }
    
    // 更新订单状态
    const { error: updateError } = await supabase
      .from('payment_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        transaction_id: notify.order_id,
      })
      .eq('order_no', notify.out_trade_no);
    
    if (updateError) {
      console.error('[虎皮椒回调] 更新订单失败:', updateError);
      return new NextResponse('update error', { status: 500 });
    }
    
    // 更新用户付费状态
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        payment_status: 'paid',
        is_paid: true,
        paid_at: new Date().toISOString(),
      })
      .eq('device_fingerprint', order.device_fingerprint);
    
    if (userUpdateError) {
      console.error('[虎皮椒回调] 更新用户状态失败:', userUpdateError);
      // 不返回错误，因为订单已更新
    }
    
    console.log('[虎皮椒回调] 支付成功:', notify.out_trade_no);
    
    return new NextResponse('success', { status: 200 });
    
  } catch (error) {
    console.error('[虎皮椒回调] 处理失败:', error);
    return new NextResponse('error', { status: 500 });
  }
}

// 支持多种请求方式
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const body: Record<string, string> = {};
  
  searchParams.forEach((value, key) => {
    body[key] = value;
  });
  
  // 转换为 POST 处理
  const formData = new FormData();
  Object.entries(body).forEach(([key, value]) => {
    formData.append(key, value);
  });
  
  const fakeRequest = new Request(request.url, {
    method: 'POST',
    body: formData,
  });
  
  return POST(fakeRequest as NextRequest);
}
