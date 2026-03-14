/**
 * 免签支付集成
 * 支持多个免签支付平台
 * 
 * 原理：上传收款码 → 平台监控到账 → 回调通知
 * 
 * 支持平台：
 * - MFK免签: https://pay.mfk.today
 * - 易支付: 搜索"易支付"找代理商
 * - 其他免签平台
 */

import { createHash } from 'crypto';

// 免签支付配置
export interface MianqianPayConfig {
  pid: string;           // 商户ID
  key: string;           // 商户密钥
  apiUrl: string;        // API地址
  notifyUrl: string;     // 异步通知地址
  returnUrl?: string;    // 同步跳转地址
}

// 支付订单请求
export interface MianqianOrderRequest {
  type: 'alipay' | 'wxpay';  // 支付方式
  out_trade_no: string;       // 商户订单号
  name: string;               // 商品名称
  money: string;              // 金额（元，字符串格式）
  device?: string;            // 设备标识
}

// 支付订单响应
export interface MianqianOrderResponse {
  code: number;           // 1=成功，0=失败
  msg?: string;           // 错误信息
  trade_no?: string;      // 平台订单号
  out_trade_no?: string;  // 商户订单号
  qr_code?: string;       // 二维码链接
  pay_url?: string;       // 支付页面链接
  money?: string;         // 订单金额
}

// 支付回调通知
export interface MianqianNotify {
  trade_no: string;       // 平台订单号
  out_trade_no: string;   // 商户订单号
  type: string;           // 支付类型
  name: string;           // 商品名称
  money: string;          // 订单金额
  trade_status: string;   // 交易状态 TRADE_SUCCESS
  sign: string;           // 签名
  sign_type?: string;     // 签名类型
}

/**
 * 创建免签支付订单
 */
export async function createMianqianOrder(
  config: MianqianPayConfig,
  order: MianqianOrderRequest
): Promise<MianqianOrderResponse> {
  const params: Record<string, string> = {
    pid: config.pid,
    type: order.type,
    out_trade_no: order.out_trade_no,
    notify_url: config.notifyUrl,
    return_url: config.returnUrl || '',
    name: order.name,
    money: order.money,
    device: order.device || '',
  };

  // 生成签名
  const sign = generateMianqianSign(params, config.key);
  params.sign = sign;
  params.sign_type = 'MD5';

  try {
    const response = await fetch(`${config.apiUrl}/mapi.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('免签支付创建订单失败:', error);
    return {
      code: 0,
      msg: '网络错误，请稍后重试',
    };
  }
}

/**
 * 验证免签支付回调签名
 */
export function verifyMianqianNotify(
  notify: MianqianNotify,
  key: string
): boolean {
  const { sign, sign_type, ...params } = notify;
  
  // 过滤空值
  const filteredParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) {
      filteredParams[k] = String(v);
    }
  }
  
  // 计算签名
  const expectedSign = generateMianqianSign(filteredParams, key);
  
  return sign === expectedSign;
}

/**
 * 生成免签支付签名
 * 签名规则：参数按键名排序，拼接成 a=1&b=2 格式，最后加上 &key=密钥，MD5加密
 */
function generateMianqianSign(
  params: Record<string, string>,
  key: string
): string {
  // 按键名排序
  const sortedKeys = Object.keys(params).sort();
  
  // 拼接字符串
  const signStr = sortedKeys
    .filter(k => params[k] !== '' && params[k] !== undefined)
    .map(k => `${k}=${params[k]}`)
    .join('&') + `&key=${key}`;
  
  // MD5 加密
  return createHash('md5').update(signStr).digest('hex').toUpperCase();
}

/**
 * 查询订单状态
 */
export async function queryMianqianOrder(
  config: MianqianPayConfig,
  orderNo: string
): Promise<{ paid: boolean; info?: string }> {
  const params: Record<string, string> = {
    pid: config.pid,
    out_trade_no: orderNo,
  };
  
  const sign = generateMianqianSign(params, config.key);
  params.sign = sign;
  params.sign_type = 'MD5';

  try {
    const response = await fetch(`${config.apiUrl}/api.php?act=order&${new URLSearchParams(params).toString()}`);
    const data = await response.json();
    
    return {
      paid: data.trade_status === 'TRADE_SUCCESS',
      info: data.msg || data.trade_status,
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
 * 不同平台的 API 地址配置
 */
export const MIANQIAN_PLATFORMS = {
  // MFK 免签
  mfk: {
    name: 'MFK免签',
    apiUrl: 'https://pay.mfk.today',
    website: 'https://pay.mfk.today',
  },
  // 易支付（需要替换为实际代理商地址）
  epay: {
    name: '易支付',
    apiUrl: 'https://你的易支付域名',
    website: '搜索"易支付"找到代理商',
  },
  // 可以添加更多平台
};
