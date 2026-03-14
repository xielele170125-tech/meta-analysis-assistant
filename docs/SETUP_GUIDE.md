# 🚀 支付系统完整配置指南

按照以下步骤，一步步完成配置。

---

## 第一步：数据库配置

### 1.1 登录 Supabase

访问 https://supabase.com/dashboard

### 1.2 打开 SQL Editor

选择你的项目 → SQL Editor → New Query

### 1.3 执行以下 SQL

```sql
-- ==========================================
-- 用户表
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint VARCHAR(64) UNIQUE NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'free',
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 订单表
-- ==========================================
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  device_fingerprint VARCHAR(64) NOT NULL,
  order_no VARCHAR(64) UNIQUE NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  payment_type VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  status VARCHAR(20) DEFAULT 'pending',
  transaction_id VARCHAR(100),
  paid_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 收款通知表（用于自动监控）
-- ==========================================
CREATE TABLE IF NOT EXISTS payment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2),
  order_id VARCHAR(64),
  payment_method VARCHAR(20),
  raw_content TEXT,
  processed BOOLEAN DEFAULT false,
  matched_order VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- 索引
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_users_fingerprint ON users(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON payment_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_device ON payment_orders(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_processed ON payment_notifications(processed);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_order ON payment_notifications(order_id);

-- ==========================================
-- 体验次数表（可选）
-- ==========================================
CREATE TABLE IF NOT EXISTS trial_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint VARCHAR(64) NOT NULL,
  feature_key VARCHAR(50) NOT NULL,
  used_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(device_fingerprint, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_trial_device ON trial_usage(device_fingerprint);
```

点击 **Run** 执行

---

## 第二步：环境变量配置

### 2.1 复制示例文件

```bash
cp .env.example .env.local
```

### 2.2 编辑 .env.local

修改以下关键配置：

```bash
# 管理员密钥（自己设定一个复杂密码）
ADMIN_KEY=MySecurePassword123!

# Webhook 密钥
PAYMENT_WEBHOOK_KEY=MyWebhookKey456!

# 定时任务密钥
CRON_KEY=MyCronKey789!

# 应用域名（本地开发）
NEXT_PUBLIC_APP_URL=http://localhost:5000

# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

---

## 第三步：收款码配置

### 3.1 获取收款码

#### 微信收款码
1. 打开微信 App
2. 我 → 服务 → 钱包
3. 收付款 → 二维码收款
4. 保存图片

#### 支付宝收款码
1. 打开支付宝 App
2. 首页 → 收钱
3. 保存个人收款码

### 3.2 放置收款码

将图片重命名并放到项目目录：

```
public/payment/
  ├── wechat-qr.png    # 微信收款码（替换占位图）
  └── alipay-qr.png    # 支付宝收款码（替换占位图）
```

### 3.3 更新代码引用

如果使用 PNG 格式，更新 `src/components/ManualPaymentModal.tsx`：

```typescript
const qrCodeUrl = paymentMethod === 'wechat' 
  ? '/payment/wechat-qr.png'  // 改回 png
  : '/payment/alipay-qr.png';
```

---

## 第四步：Vercel 部署配置

### 4.1 环境变量

在 Vercel 项目设置中添加：

```
ADMIN_KEY = 你的管理员密钥
PAYMENT_WEBHOOK_KEY = 你的webhook密钥
CRON_KEY = 你的定时任务密钥
NEXT_PUBLIC_APP_URL = https://你的域名

NEXT_PUBLIC_SUPABASE_URL = 你的Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY = 你的Supabase匿名密钥
SUPABASE_SERVICE_ROLE_KEY = 你的Supabase服务端密钥
```

### 4.2 定时任务（可选）

在项目根目录创建 `vercel.json`：

```json
{
  "crons": [{
    "path": "/api/payment/cron?cronKey=你的CRON_KEY",
    "schedule": "0 * * * *"
  }]
}
```

这会每小时检查一次待处理订单。

---

## 第五步：测试

### 5.1 本地测试

```bash
# 启动开发服务器
pnpm dev

# 测试 Webhook
curl -X POST http://localhost:5000/api/payment/webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "key": "你的PAYMENT_WEBHOOK_KEY",
    "source": "custom",
    "amount": 9.9,
    "orderId": "MPTEST001"
  }'
```

### 5.2 测试管理后台

访问：http://localhost:5000/admin/orders

输入 ADMIN_KEY 登录

### 5.3 测试支付流程

1. 打开网站，点击「立即购买」
2. 选择微信或支付宝
3. 扫码（会显示占位图）
4. 填写支付信息提交
5. 在管理后台审核

---

## 第六步：上线

### 6.1 部署到 Vercel

```bash
git add .
git commit -m "feat: 配置支付系统"
git push
```

Vercel 会自动部署

### 6.2 更新回调地址

部署成功后，更新你的通知推送地址：

```
https://你的域名/api/payment/webhook
```

---

## 快速命令清单

```bash
# 1. 安装依赖
pnpm install

# 2. 创建环境变量文件
cp .env.example .env.local

# 3. 编辑环境变量
nano .env.local  # 或用你喜欢的编辑器

# 4. 放置收款码
# 将微信/支付宝收款码放到 public/payment/

# 5. 执行数据库迁移
# 在 Supabase SQL Editor 中执行上面的 SQL

# 6. 本地测试
pnpm dev

# 7. 部署
git add . && git commit -m "feat: 支付系统" && git push
```

---

## 常见问题

### Q: 收款码图片太大怎么办？

使用图片压缩工具（如 tinypng.com）压缩后再上传

### Q: 本地测试 Webhook 不通？

本地测试时，NEXT_PUBLIC_APP_URL 设为 http://localhost:5000

### Q: 管理后台进不去？

检查 ADMIN_KEY 是否正确设置

### Q: 支付后没有自动解锁？

1. 检查订单号是否正确填写在备注中
2. 手动访问 `/api/payment/cron?cronKey=你的密钥` 触发检查
3. 查看管理后台是否有待审核订单

---

## 下一步优化

1. **配置自动通知**（如 Bark 推送）实现完全自动化
2. **升级支付平台**（如虎皮椒）提升用户体验
3. **添加支付成功通知**邮件或消息推送

---

配置完成后告诉我，我帮你验证！
