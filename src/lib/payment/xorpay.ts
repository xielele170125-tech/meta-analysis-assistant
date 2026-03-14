/**
 * XorPay 码支付集成
 * 官网: https://xorpay.com
 * 个人免签约支付，支持微信、支付宝
 */

import { createHash } from 'crypto';

// XorPay 配置
export interface XorPayConfig {
  appId: string;        // 应用ID
  appSecret: string;    // 应用密钥
  notifyUrl: string;    // 异步通知地址
}

// 支付订单请求
export interface XorPayOrderRequest {
  name: string;         // 商品名称
  price: number;        // 金额（元）
  order_id: string;     // 商户订单号
  order_uid?: string;   // 用户标识（可选）
  more?: string;        // 附加信息（可选）
  notify_url: string;   // 异步通知地址
}

// 支付订单响应
export interface XorPayOrderResponse {
  success: boolean;
  url?: string;         // 支付页面URL
  qrcode?: string;      // 二维码链接
  order_id?: string;    // 订单号
  message?: string;     // 错误信息
}

// 支付回调通知
export interface XorPayNotify {
  order_id: string;     // 商户订单号
  pay_id: string;       // 平台订单号
  price: string;        // 支付金额
  pay_price: string;    // 实际支付金额
  more: string;         // 附加信息
  time: string;         // 支付时间
  sign: string;         // 签名
}

/**
 * 创建 XorPay 支付订单
 */
export async function createXorPayOrder(
  config: XorPayConfig,
  order: Omit<XorPayOrderRequest, 'notify_url'>
): Promise<XorPayOrderResponse> {
  const apiUrl = 'https://api.xorpay.com/v1/pay';
  
  const params = {
    ...order,
    notify_url: config.notifyUrl,
  };
  
  // 生成签名
  const sign = generateXorPaySign(params, config.appSecret);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        sign,
      }),
    });
    
    const data = await response.json();
    
    if (data.status === 'ok') {
      return {
        success: true,
        url: data.url,
        qrcode: data.qrcode,
        order_id: order.order_id,
      };
    } else {
      return {
        success: false,
        message: data.info || '创建订单失败',
      };
    }
  } catch (error) {
    console.error('XorPay 创建订单失败:', error);
    return {
      success: false,
      message: '网络错误，请稍后重试',
    };
  }
}

/**
 * 验证 XorPay 回调签名
 */
export function verifyXorPayNotify(
  notify: XorPayNotify,
  appSecret: string
): boolean {
  const { sign, ...params } = notify;
  
  // 按参数名 ASCII 码从小到大排序
  const sortedKeys = Object.keys(params).sort();
  const signStr = sortedKeys
    .map(key => `${key}=${params[key as keyof typeof params]}`)
    .join('&') + `&app_secret=${appSecret}`;
  
  const expectedSign = createHash('md5').update(signStr).digest('hex');
  
  return sign === expectedSign;
}

/**
 * 生成 XorPay 签名
 */
function generateXorPaySign(
  params: Record<string, string | number | undefined>,
  appSecret: string
): string {
  // 过滤空值并排序
  const filteredParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== '')
    .reduce((acc, [key, value]) => {
      acc[key] = value as string | number;
      return acc;
    }, {} as Record<string, string | number>);
  
  const sortedKeys = Object.keys(filteredParams).sort();
  const signStr = sortedKeys
    .map(key => `${key}=${filteredParams[key]}`)
    .join('&') + `&app_secret=${appSecret}`;
  
  return createHash('md5').update(signStr).digest('hex');
}

/**
 * 查询订单状态
 */
export async function queryXorPayOrder(
  config: XorPayConfig,
  orderId: string
): Promise<{ paid: boolean; info?: string }> {
  const apiUrl = 'https://api.xorpay.com/v1/query';
  
  const params = {
    app_id: config.appId,
    order_id: orderId,
  };
  
  const sign = generateXorPaySign(params, config.appSecret);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        sign,
      }),
    });
    
    const data = await response.json();
    
    return {
      paid: data.status === 'paid',
      info: data.info,
    };
  } catch (error) {
    console.error('查询订单失败:', error);
    return {
      paid: false,
      info: '查询失败',
    };
  }
}
