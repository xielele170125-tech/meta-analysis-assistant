/**
 * 虎皮椒支付集成
 * 官网: https://xunhupay.com
 * 
 * 特点：
 * - 保证金：¥30
 * - 手续费：1.5%
 * - 支持微信、支付宝
 * - 个人可申请
 */

import { createHash } from 'crypto';

// 虎皮椒配置
export interface HupijiaoPayConfig {
  appid: string;         // 应用ID
  appsecret: string;     // 应用密钥
  notifyUrl: string;     // 异步通知地址
  returnUrl?: string;    // 同步跳转地址
}

// 支付订单请求
export interface HupijiaoOrderRequest {
  type: 'alipay' | 'wechat';  // 支付方式
  out_trade_no: string;        // 商户订单号
  title: string;               // 商品名称
  total_fee: string;           // 金额（元）
  body?: string;               // 商品描述
}

// 支付订单响应
export interface HupijiaoOrderResponse {
  errcode: number;        // 0=成功
  errmsg?: string;        // 错误信息
  url?: string;           // 收银台地址
  url_qrcode?: string;    // 二维码图片地址
  order_id?: string;      // 平台订单号
  out_trade_no?: string;  // 商户订单号
}

// 支付回调通知
export interface HupijiaoNotify {
  order_id: string;       // 平台订单号
  out_trade_no: string;   // 商户订单号
  type: string;           // 支付类型
  price: string;          // 订单金额
  time: string;           // 支付时间
  trade_status: string;   // 交易状态 TRADE_SUCCESS
  sign: string;           // 签名
  params?: string;        // 附加参数
}

/**
 * 创建虎皮椒支付订单
 */
export async function createHupijiaoOrder(
  config: HupijiaoPayConfig,
  order: HupijiaoOrderRequest
): Promise<HupijiaoOrderResponse> {
  const apiUrl = 'https://api.xunhupay.com/payment/do.html';
  
  const params: Record<string, string> = {
    version: '1.1',
    appid: config.appid,
    type: order.type,
    out_trade_no: order.out_trade_no,
    notify_url: config.notifyUrl,
    return_url: config.returnUrl || '',
    title: order.title,
    total_fee: order.total_fee,
    body: order.body || order.title,
    time: Math.floor(Date.now() / 1000).toString(),
    nonce_str: Math.random().toString(36).substring(2, 15),
  };

  // 生成签名
  const sign = generateHupijiaoSign(params, config.appsecret);
  params.sign = sign;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('虎皮椒创建订单失败:', error);
    return {
      errcode: -1,
      errmsg: '网络错误，请稍后重试',
    };
  }
}

/**
 * 验证虎皮椒回调签名
 */
export function verifyHupijiaoNotify(
  notify: HupijiaoNotify,
  appsecret: string
): boolean {
  const { sign, ...params } = notify;
  
  // 过滤空值
  const filteredParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) {
      filteredParams[k] = String(v);
    }
  }
  
  // 计算签名
  const expectedSign = generateHupijiaoSign(filteredParams, appsecret);
  
  return sign === expectedSign;
}

/**
 * 生成虎皮椒签名
 * 签名规则：
 * 1. 参数按键名 ASCII 码从小到大排序
 * 2. 拼接成 a=1&b=2 格式
 * 3. 最后拼接 &appsecret=密钥
 * 4. MD5 加密，转大写
 */
function generateHupijiaoSign(
  params: Record<string, string>,
  appsecret: string
): string {
  // 按键名排序
  const sortedKeys = Object.keys(params).sort();
  
  // 拼接字符串
  const signStr = sortedKeys
    .filter(k => params[k] !== '' && params[k] !== undefined && k !== 'sign')
    .map(k => `${k}=${params[k]}`)
    .join('&') + `&appsecret=${appsecret}`;
  
  // MD5 加密并转大写
  return createHash('md5').update(signStr).digest('hex').toUpperCase();
}

/**
 * 查询订单状态
 */
export async function queryHupijiaoOrder(
  config: HupijiaoPayConfig,
  orderNo: string
): Promise<{ paid: boolean; info?: string }> {
  const apiUrl = 'https://api.xunhupay.com/payment/query.html';
  
  const params: Record<string, string> = {
    appid: config.appid,
    out_trade_no: orderNo,
    time: Math.floor(Date.now() / 1000).toString(),
    nonce_str: Math.random().toString(36).substring(2, 15),
  };
  
  const sign = generateHupijiaoSign(params, config.appsecret);
  params.sign = sign;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });
    
    const data = await response.json();
    
    return {
      paid: data.trade_status === 'TRADE_SUCCESS',
      info: data.errmsg || data.trade_status,
    };
  } catch (error) {
    console.error('查询订单失败:', error);
    return {
      paid: false,
      info: '查询失败',
    };
  }
}

/**
 * 生成支付链接（用于跳转支付）
 */
export function generateHupijiaoPayUrl(
  config: HupijiaoPayConfig,
  order: HupijiaoOrderRequest
): string {
  const params: Record<string, string> = {
    version: '1.1',
    appid: config.appid,
    type: order.type,
    out_trade_no: order.out_trade_no,
    notify_url: config.notifyUrl,
    return_url: config.returnUrl || '',
    title: order.title,
    total_fee: order.total_fee,
    time: Math.floor(Date.now() / 1000).toString(),
    nonce_str: Math.random().toString(36).substring(2, 15),
  };

  const sign = generateHupijiaoSign(params, config.appsecret);
  params.sign = sign;

  // 返回收银台 URL
  return `https://api.xunhupay.com/payment/do.html?${new URLSearchParams(params).toString()}`;
}
