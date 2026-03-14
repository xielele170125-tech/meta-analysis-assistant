/**
 * 支付通知 Webhook 接收接口
 * 
 * 支持多种通知来源：
 * 1. Bark 推送（iOS）
 * 2. Server酱推送
 * 3. 企业微信机器人
 * 4. 钉钉机器人
 * 5. 自定义 Webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  processPaymentNotification, 
  parseAlipayEmail, 
  parseWechatNotification,
  PaymentNotification 
} from '@/lib/payment/monitor';

// Webhook 密钥验证
const WEBHOOK_KEY = process.env.PAYMENT_WEBHOOK_KEY || 'your-webhook-key';

/**
 * 通用 Webhook 接口
 * 
 * POST /api/payment/webhook
 * 
 * Body:
 * {
 *   "key": "your-webhook-key",
 *   "source": "bark" | "serverchan" | "wechat" | "dingtalk" | "custom",
 *   "content": "通知内容",
 *   "amount": 9.9,  // 可选，如果没有会自动解析
 *   "orderId": "MPXXXXXX"  // 可选
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证密钥
    if (body.key !== WEBHOOK_KEY) {
      return NextResponse.json(
        { error: 'Invalid webhook key' },
        { status: 403 }
      );
    }

    console.log('[Webhook] 收到支付通知:', body);

    let notification: PaymentNotification | null = null;

    // 根据来源解析通知
    switch (body.source) {
      case 'bark':
        // Bark 推送格式
        notification = parseBarkNotification(body);
        break;
      
      case 'serverchan':
        // Server酱推送格式
        notification = parseServerChanNotification(body);
        break;
      
      case 'wechat_robot':
        // 企业微信机器人
        notification = parseWechatRobotNotification(body);
        break;
      
      case 'dingtalk_robot':
        // 钉钉机器人
        notification = parseDingTalkRobotNotification(body);
        break;
      
      case 'alipay_email':
        // 支付宝邮件通知
        notification = parseAlipayEmail(String(body.content || ''));
        break;
      
      case 'wechat':
        // 微信支付通知
        notification = parseWechatNotification(String(body.content || ''));
        break;
      
      case 'custom':
      default:
        // 自定义格式
        notification = {
          amount: Number(body.amount) || 0,
          orderId: body.orderId ? String(body.orderId) : undefined,
          paymentMethod: String(body.paymentMethod || 'wechat') as 'wechat' | 'alipay',
          timestamp: new Date(),
          rawContent: String(body.content || ''),
        };
        break;
    }

    if (!notification) {
      return NextResponse.json(
        { error: 'Failed to parse notification' },
        { status: 400 }
      );
    }

    // 处理通知
    const result = await processPaymentNotification(notification);

    console.log('[Webhook] 处理结果:', result);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      orderNo: result.orderNo,
    });

  } catch (error) {
    console.error('[Webhook] 处理失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 解析 Bark 通知
 * Bark 是 iOS 上的推送工具
 */
function parseBarkNotification(body: Record<string, unknown>): PaymentNotification {
  // Bark 推送格式: { title, body, ... }
  const title = String(body.title || '');
  const content = String(body.body || '');
  const fullContent = `${title} ${content}`;

  // 尝试解析支付宝或微信格式
  let notification = parseAlipayEmail(fullContent);
  if (!notification) {
    notification = parseWechatNotification(fullContent);
  }

  return notification || {
    amount: 0,
    paymentMethod: 'wechat',
    timestamp: new Date(),
    rawContent: fullContent,
  };
}

/**
 * 解析 Server酱 通知
 * Server酱是将消息推送到微信的工具
 */
function parseServerChanNotification(body: Record<string, unknown>): PaymentNotification {
  const title = String(body.title || '');
  const desp = String(body.desp || '');
  const fullContent = `${title}\n${desp}`;

  let notification = parseAlipayEmail(fullContent);
  if (!notification) {
    notification = parseWechatNotification(fullContent);
  }

  return notification || {
    amount: 0,
    paymentMethod: 'wechat',
    timestamp: new Date(),
    rawContent: fullContent,
  };
}

/**
 * 解析企业微信机器人通知
 */
function parseWechatRobotNotification(body: Record<string, unknown>): PaymentNotification {
  const text = body.text as Record<string, unknown> | undefined;
  const content = body.content || (text?.content as string) || '';
  const strContent = String(content);

  let notification = parseAlipayEmail(strContent);
  if (!notification) {
    notification = parseWechatNotification(strContent);
  }

  return notification || {
    amount: 0,
    paymentMethod: 'wechat',
    timestamp: new Date(),
    rawContent: strContent,
  };
}

/**
 * 解析钉钉机器人通知
 */
function parseDingTalkRobotNotification(body: Record<string, unknown>): PaymentNotification {
  const text = body.text as Record<string, unknown> | undefined;
  const content = body.content || (text?.content as string) || '';
  const strContent = String(content);

  let notification = parseAlipayEmail(strContent);
  if (!notification) {
    notification = parseWechatNotification(strContent);
  }

  return notification || {
    amount: 0,
    paymentMethod: 'wechat',
    timestamp: new Date(),
    rawContent: strContent,
  };
}

/**
 * GET 请求用于测试
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const test = searchParams.get('test');

  if (test === '1') {
    // 测试模式
    return NextResponse.json({
      message: 'Webhook 接口正常',
      usage: {
        method: 'POST',
        url: '/api/payment/webhook',
        headers: { 'Content-Type': 'application/json' },
        body: {
          key: 'your-webhook-key',
          source: 'custom',
          amount: 9.9,
          orderId: 'MPXXXXXX',
          paymentMethod: 'wechat',
        },
      },
    });
  }

  return NextResponse.json({ status: 'ok' });
}
