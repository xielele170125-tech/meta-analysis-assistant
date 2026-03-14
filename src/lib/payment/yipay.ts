/**
 * 易支付集成
 * 支持自动回调，完全自动化
 */

import crypto from 'crypto';

// 易支付配置
export interface YiPayConfig {
  apiUrl: string;      // 易支付网关地址，如 https://pay.xxx.com
  pid: string;         // 商户ID
  key: string;         // 商户密钥
  notifyUrl: string;   // 异步通知地址
  returnUrl: string;   // 支付完成跳转地址
}

// 订单参数
export interface YiPayOrder {
  type: 'alipay' | 'wxpay' | 'qqpay';  // 支付类型
  outTradeNo: string;   // 商户订单号
  name: string;         // 商品名称
  money: string;        // 金额，单位元
}

// 支付结果
export interface YiPayResult {
  success: boolean;
  payUrl?: string;      // 支付页面地址
  qrCode?: string;      // 二维码链接
  error?: string;
}

// 订单查询结果
export interface YiPayOrderQueryResult {
  success: boolean;
  status?: 'pending' | 'paid' | 'failed';
  tradeNo?: string;
  money?: string;
  error?: string;
}

/**
 * 生成签名
 */
function generateSign(params: Record<string, string>, key: string): string {
  // 按参数名排序
  const sortedKeys = Object.keys(params).sort();
  
  // 拼接字符串
  const signStr = sortedKeys
    .filter(k => params[k] && k !== 'sign' && k !== 'sign_type')
    .map(k => `${k}=${params[k]}`)
    .join('&');
  
  // MD5加密
  const sign = crypto
    .createHash('md5')
    .update(signStr + key)
    .digest('hex');
  
  return sign;
}

/**
 * 验证回调签名
 */
export function verifyYiPayCallback(
  params: Record<string, string>,
  key: string
): boolean {
  const sign = params.sign;
  if (!sign) return false;
  
  const calculatedSign = generateSign(params, key);
  return sign === calculatedSign;
}

/**
 * 创建支付订单
 * 返回支付页面地址
 */
export function createYiPayOrder(
  config: YiPayConfig,
  order: YiPayOrder
): YiPayResult {
  try {
    // 构建参数
    const params: Record<string, string> = {
      pid: config.pid,
      type: order.type,
      out_trade_no: order.outTradeNo,
      notify_url: config.notifyUrl,
      return_url: config.returnUrl,
      name: order.name,
      money: order.money,
    };
    
    // 生成签名
    const sign = generateSign(params, config.key);
    params.sign = sign;
    params.sign_type = 'MD5';
    
    // 构建支付URL
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    
    const payUrl = `${config.apiUrl}/submit.php?${queryString}`;
    
    return {
      success: true,
      payUrl,
      qrCode: `${config.apiUrl}/qrcode.php?${queryString}`,
    };
    
  } catch (error) {
    console.error('[易支付] 创建订单失败:', error);
    return {
      success: false,
      error: '创建支付订单失败',
    };
  }
}

/**
 * 查询订单状态
 * 主动查询支付结果，不依赖回调通知
 */
export async function queryYiPayOrder(
  config: YiPayConfig,
  orderNo: string,
  paymentType: 'alipay' | 'wxpay' = 'alipay'
): Promise<YiPayOrderQueryResult> {
  try {
    // 构建查询参数
    const params: Record<string, string> = {
      pid: config.pid,
      key: config.key,
      type: paymentType,
      out_trade_no: orderNo,
    };
    
    // 构建查询URL
    const queryString = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    
    const queryUrl = `${config.apiUrl}/api/findorder?${queryString}`;
    
    console.log('[易支付] 查询订单:', queryUrl);
    
    // 发送请求
    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    const text = await response.text();
    console.log('[易支付] 查询结果:', text);
    
    // 尝试解析JSON
    try {
      const data = JSON.parse(text);
      
      // 检查支付状态
      if (data.status === '1' || data.trade_status === 'TRADE_SUCCESS') {
        return {
          success: true,
          status: 'paid',
          tradeNo: data.trade_no,
          money: data.money,
        };
      } else if (data.status === '0') {
        return {
          success: true,
          status: 'pending',
        };
      } else {
        return {
          success: false,
          status: 'pending',
          error: data.msg || '订单未支付',
        };
      }
    } catch {
      // 如果返回的不是JSON，可能是HTML错误页面
      return {
        success: false,
        status: 'pending',
        error: '查询失败',
      };
    }
    
  } catch (error) {
    console.error('[易支付] 查询订单失败:', error);
    return {
      success: false,
      status: 'pending',
      error: '查询失败',
    };
  }
}

/**
 * 解析回调参数
 */
export function parseYiPayCallback(params: Record<string, string>): {
  success: boolean;
  orderNo?: string;
  amount?: string;
  tradeNo?: string;
} {
  // 易支付回调参数
  // trade_no: 平台订单号
  // out_trade_no: 商户订单号
  // money: 金额
  // trade_status: TRADE_SUCCESS 表示成功
  
  if (params.trade_status !== 'TRADE_SUCCESS') {
    return { success: false };
  }
  
  return {
    success: true,
    orderNo: params.out_trade_no,
    amount: params.money,
    tradeNo: params.trade_no,
  };
}
