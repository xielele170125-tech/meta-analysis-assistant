# 支付自动监控系统指南

## 一、系统概述

这个系统可以**自动监控收款通知**，当收到微信/支付宝转账时，自动匹配订单并解锁用户功能。

### 工作流程

```
用户扫码付款（备注订单号）
        ↓
收款通知推送到系统
        ↓
系统自动解析金额和订单号
        ↓
匹配数据库中的待支付订单
        ↓
自动确认订单 + 解锁用户 ✅
```

---

## 二、通知方式选择

| 方式 | 推荐度 | 费用 | 配置难度 | 响应速度 |
|------|--------|------|----------|----------|
| **Bark 推送** | ⭐⭐⭐⭐⭐ | 免费 | 简单 | 秒级 |
| **Server酱** | ⭐⭐⭐⭐ | 免费 | 简单 | 秒级 |
| **邮件转发** | ⭐⭐⭐ | 免费 | 中等 | 分钟级 |
| **定时轮询** | ⭐⭐ | 免费 | 简单 | 5分钟 |

---

## 三、方式一：Bark 推送（推荐）

### 什么是 Bark？

Bark 是 iOS 上的免费推送工具，可以将任何通知推送到你的 iPhone。

### 配置步骤

#### 1. 安装 Bark

在 App Store 搜索「Bark」并安装

#### 2. 获取推送地址

打开 Bark → 复制你的推送地址，格式类似：
```
https://api.day.app/你的KEY/
```

#### 3. 配置支付宝收款通知

1. 打开支付宝 App
2. 搜索「收款助手」或「商家服务」
3. 找到「收款通知」设置
4. 开启「收款语音播报」和「通知提醒」
5. 如果支持 Webhook，填入：
   ```
   https://你的域名/api/payment/webhook?key=你的密钥&source=bark
   ```

#### 4. 配置 Bark 自动转发（iOS 快捷指令）

创建一个 iOS 快捷指令，当收到支付宝/微信收款通知时，自动转发到你的 Webhook：

```
触发：当收到通知包含"收款"或"转账"
动作：发送 HTTP POST 到你的 Webhook
```

#### 5. 测试

```bash
curl -X POST https://你的域名/api/payment/webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "key": "你的webhook密钥",
    "source": "bark",
    "title": "支付宝收款通知",
    "body": "您收到一笔转账，金额9.90元，备注：MPXXXXXX"
  }'
```

---

## 四、方式二：Server酱

### 什么是 Server酱？

Server酱可以将消息推送到微信，免费版每天可发 5 条。

### 配置步骤

#### 1. 注册 Server酱

访问：https://sct.ftqq.com/

微信扫码登录，获取 SendKey

#### 2. 配置推送

在支付宝/微信收款时，通过某种方式触发 Server酱推送：

```
URL: https://你的域名/api/payment/webhook
Method: POST
Body: {
  "key": "你的webhook密钥",
  "source": "serverchan",
  "title": "收款通知",
  "desp": "金额9.90元，订单号MPXXXXXX"
}
```

#### 3. 测试

```bash
curl -X POST https://你的域名/api/payment/webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "key": "你的webhook密钥",
    "source": "serverchan",
    "title": "支付宝收款",
    "desp": "收到转账9.90元，备注：MPTEST001"
  }'
```

---

## 五、方式三：邮件转发

### 原理

支付宝收款时会发送邮件通知，通过邮件转发规则自动转发到你的系统。

### 配置步骤

#### 1. 开启支付宝邮件通知

支付宝 App → 设置 → 通知设置 → 开启邮件通知

#### 2. 配置邮件转发

使用 Gmail 或其他邮箱的转发规则，将支付宝邮件转发到：

```
方案A：使用 Zapier/Make 自动化
- 连接邮箱和 Webhook
- 新邮件 → POST 到你的 API

方案B：使用邮件解析服务
- 如 CloudMailin、Mailgun
- 邮件 → 自动 POST
```

---

## 六、方式四：定时轮询

### 原理

定期检查收款通知表，匹配订单。

### 配置步骤

#### 1. 创建通知表

```sql
-- 执行 src/db/migrations/add_payment_notifications.sql
```

#### 2. 配置 Vercel Cron Jobs

在项目根目录创建 `vercel.json`：

```json
{
  "crons": [{
    "path": "/api/payment/cron?cronKey=你的密钥",
    "schedule": "*/5 * * * *"
  }]
}
```

表示每 5 分钟执行一次

#### 3. 或者使用外部定时服务

如 cron-job.org，设置每 5 分钟访问：

```
URL: https://你的域名/api/payment/cron?cronKey=你的密钥
```

---

## 七、环境变量配置

在 `.env.local` 或 Vercel 环境变量中设置：

```bash
# Webhook 密钥（自定义，用于验证请求）
PAYMENT_WEBHOOK_KEY=your-secure-key-here

# 定时任务密钥
CRON_KEY=your-cron-key-here

# 管理员密钥（用于管理后台）
ADMIN_KEY=your-admin-key-here
```

---

## 八、API 接口说明

### 1. Webhook 接口

```
POST /api/payment/webhook

Body:
{
  "key": "webhook密钥",
  "source": "bark|serverchan|custom",
  "content": "通知内容",
  "amount": 9.9,          // 可选
  "orderId": "MPXXXXXX",  // 可选
  "paymentMethod": "wechat|alipay"  // 可选
}

Response:
{
  "success": true,
  "message": "订单已自动确认",
  "orderNo": "MPXXXXXX"
}
```

### 2. 定时任务接口

```
GET /api/payment/cron?cronKey=密钥

Response:
{
  "success": true,
  "results": {
    "checked": 10,
    "confirmed": 2,
    "expired": 1
  }
}
```

### 3. 测试接口

```
GET /api/payment/webhook?test=1

Response:
{
  "message": "Webhook 接口正常",
  "usage": { ... }
}
```

---

## 九、测试流程

### 1. 测试 Webhook

```bash
# 测试接口连通性
curl https://你的域名/api/payment/webhook?test=1

# 测试支付通知
curl -X POST https://你的域名/api/payment/webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "key": "你的webhook密钥",
    "source": "custom",
    "amount": 9.9,
    "orderId": "MPTEST001",
    "paymentMethod": "wechat"
  }'
```

### 2. 模拟用户下单

1. 打开网站
2. 点击「立即购买」
3. 获取订单号（如 MPTEST001）

### 3. 模拟支付通知

```bash
curl -X POST https://你的域名/api/payment/webhook \
  -H 'Content-Type': 'application/json' \
  -d '{
    "key": "你的密钥",
    "source": "custom",
    "amount": 9.9,
    "orderId": "MPTEST001"
  }'
```

### 4. 验证结果

刷新页面，确认功能已解锁

---

## 十、推荐方案

### 最佳实践（完全免费）

```
支付宝收款 → 开启邮件通知 → 
使用 Gmail 过滤器 + Zapier → 
自动 POST 到 Webhook → 
系统自动确认
```

### 简单方案（iOS 用户）

```
微信/支付宝收款 → iOS 通知 → 
Bark 自动转发 → 
系统自动确认
```

### 备用方案（通用）

```
用户付款 → 手动触发 Webhook（收藏书签）→ 
系统确认
```

---

## 十一、故障排查

### Webhook 没有响应

```bash
# 检查日志
tail -f /app/work/logs/bypass/app.log | grep Webhook

# 确认环境变量
echo $PAYMENT_WEBHOOK_KEY
```

### 订单没有自动匹配

检查：
1. 订单号是否正确填写在备注中
2. 金额是否一致
3. 订单状态是否为 pending

### 定时任务没有执行

```bash
# 手动触发测试
curl "https://你的域名/api/payment/cron?cronKey=你的密钥"
```

---

## 十二、下一步

1. **选择通知方式**
   - iOS 用户 → Bark
   - Android 用户 → Server酱或定时轮询
   - 通用 → 邮件转发

2. **配置环境变量**
   ```bash
   PAYMENT_WEBHOOK_KEY=xxx
   CRON_KEY=xxx
   ```

3. **执行数据库迁移**
   ```sql
   -- 执行 src/db/migrations/add_payment_notifications.sql
   ```

4. **测试 Webhook**
   ```bash
   curl -X POST https://你的域名/api/payment/webhook ...
   ```

---

**配置完成后，用户付款将自动解锁，无需手动操作！**
