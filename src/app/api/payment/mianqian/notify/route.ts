/**
 * 免签支付回调接口
 * 接收免签支付平台的异步通知
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyMianqianNotify, MianqianNotify } from '@/lib/payment/mianqian';

export async function POST(request: NextRequest) {
  try {
    // 免签支付通常使用 form 表单提交
    const formData = await request.formData();
    const body: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });
    
    console.log('[免签支付回调] 收到通知:', body);
    
    // 获取配置
    const key = process.env.MIANQIAN_KEY;
    if (!key) {
      console.error('[免签支付回调] 未配置 MIANQIAN_KEY');
      return new NextResponse('fail', { status: 500 });
    }
    
    const notify: MianqianNotify = {
      trade_no: body.trade_no || '',
      out_trade_no: body.out_trade_no || '',
      type: body.type || '',
      name: body.name || '',
      money: body.money || '',
      trade_status: body.trade_status || '',
      sign: body.sign || '',
      sign_type: body.sign_type,
    };
    
    // 验证签名
    if (!verifyMianqianNotify(notify, key)) {
      console.error('[免签支付回调] 签名验证失败');
      return new NextResponse('sign error', { status: 400 });
    }
    
    // 验证交易状态
    if (notify.trade_status !== 'TRADE_SUCCESS') {
      console.log('[免签支付回调] 交易状态非成功:', notify.trade_status);
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
      console.error('[免签支付回调] 订单不存在:', notify.out_trade_no);
      return new NextResponse('order not found', { status: 404 });
    }
    
    // 检查订单状态
    if (order.status === 'paid') {
      console.log('[免签支付回调] 订单已处理:', notify.out_trade_no);
      return new NextResponse('success', { status: 200 });
    }
    
    // 验证金额
    const paidAmount = parseFloat(notify.money);
    const expectedAmount = order.amount / 100; // 数据库存储的是分
    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
      console.error('[免签支付回调] 金额不匹配:', { paid: paidAmount, expected: expectedAmount });
      return new NextResponse('amount error', { status: 400 });
    }
    
    // 更新订单状态
    const { error: updateError } = await supabase
      .from('payment_orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        transaction_id: notify.trade_no,
        payment_method: notify.type === 'wxpay' ? 'wechat' : 'alipay',
      })
      .eq('order_no', notify.out_trade_no);
    
    if (updateError) {
      console.error('[免签支付回调] 更新订单失败:', updateError);
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
      console.error('[免签支付回调] 更新用户状态失败:', userUpdateError);
      // 不返回错误，因为订单已更新
    }
    
    console.log('[免签支付回调] 支付成功:', notify.out_trade_no);
    
    return new NextResponse('success', { status: 200 });
    
  } catch (error) {
    console.error('[免签支付回调] 处理失败:', error);
    return new NextResponse('error', { status: 500 });
  }
}

// 也支持 GET 请求（部分平台使用 GET）
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const body: Record<string, string> = {};
  
  searchParams.forEach((value, key) => {
    body[key] = value;
  });
  
  // 复用 POST 逻辑
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
