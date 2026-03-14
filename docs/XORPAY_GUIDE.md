# 码支付（XorPay）集成指南

## 一、XorPay 注册流程

### 步骤 1：注册账号

1. 访问 [XorPay 官网](https://xorpay.com)
2. 点击右上角「注册」
3. 填写基本信息：
   - 手机号（用于登录）
   - 密码
   - 验证码

### 步骤 2：实名认证

1. 登录后进入「个人中心」
2. 点击「实名认证」
3. 上传身份证正反面照片
4. 等待审核（通常 1-2 小时）

### 步骤 3：创建应用

1. 进入「应用管理」
2. 点击「创建应用」
3. 填写应用信息：
   ```
   应用名称：Meta分析工具
   应用类型：网站
   应用网址：你的网站地址
   回调地址：https://你的域名/api/payment/xorpay/notify
   ```
4. 提交后获得：
   - **AppID**（应用ID）
   - **AppSecret**（应用密钥）

### 步骤 4：配置收款账户

1. 进入「收款设置」
2. 选择支付方式：
   - 微信支付：上传微信收款码
   - 支付宝：上传支付宝收款码
3. 系统会自动识别收款码信息

### 步骤 5：充值保证金

- 首次使用需充值 ¥10 保证金
- 保证金可随时申请退还
- 用于保证交易安全

---

## 二、环境变量配置

在 `.env.local` 或 Vercel 环境变量中添加：

```bash
# XorPay 配置
XORPAY_APP_ID=你的AppID
XORPAY_APP_SECRET=你的AppSecret

# 应用域名（用于回调地址）
NEXT_PUBLIC_APP_URL=https://你的域名
```

---

## 三、数据库准备

确保已执行付费相关迁移：

```sql
-- 见 src/db/migrations/add_payment_tables.sql

-- 主要表结构
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint VARCHAR(64) UNIQUE NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'free',
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE payment_orders (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 四、前端调用示例

### 创建支付订单

```typescript
// 用户点击支付按钮
async function handleXorPayPayment() {
  const response = await fetch('/api/payment/xorpay/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceFingerprint: deviceFingerprint,
      paymentMethod: 'wechat', // 或 'alipay'
    }),
  });

  const data = await response.json();

  if (data.success) {
    // 方式1：跳转到支付页面
    window.open(data.payment.url, '_blank');

    // 方式2：显示二维码
    // <QRCode value={data.payment.qrcode} />

    // 开始轮询订单状态
    pollOrderStatus(data.order.orderNo);
  }
}

// 轮询订单状态
async function pollOrderStatus(orderNo: string) {
  const maxAttempts = 60; // 最多轮询 5 分钟
  let attempts = 0;

  const interval = setInterval(async () => {
    attempts++;

    const response = await fetch(`/api/payment/verify?orderNo=${orderNo}`);
    const data = await response.json();

    if (data.paid) {
      clearInterval(interval);
      // 支付成功，刷新用户状态
      onPaymentSuccess();
    }

    if (attempts >= maxAttempts) {
      clearInterval(interval);
      // 超时提示
    }
  }, 5000); // 每 5 秒查询一次
}
```

---

## 五、测试流程

### 本地测试

1. **配置回调地址**：
   - 使用 ngrok 暴露本地服务：
     ```bash
     ngrok http 5000
     ```
   - 将 ngrok 地址填入 XorPay 回调设置

2. **创建测试订单**：
   ```bash
   curl -X POST http://localhost:5000/api/payment/xorpay/create \
     -H 'Content-Type: application/json' \
     -d '{
       "deviceFingerprint": "test-device-123",
       "paymentMethod": "wechat"
     }'
   ```

3. **模拟支付成功**：
   - 在 XorPay 控制台找到订单
   - 手动标记为已支付（测试环境）

---

## 六、生产部署

### Vercel 部署

1. **配置环境变量**：
   ```
   XORPAY_APP_ID=xxx
   XORPAY_APP_SECRET=xxx
   NEXT_PUBLIC_APP_URL=https://你的域名
   ```

2. **更新回调地址**：
   - 在 XorPay 控制台修改回调地址为：
     `https://你的域名/api/payment/xorpay/notify`

3. **验证部署**：
   ```bash
   # 测试回调接口
   curl -X POST https://你的域名/api/payment/xorpay/notify \
     -H 'Content-Type: application/json' \
     -d '{"order_id":"test","sign":"test"}'
   ```

---

## 七、费用说明

| 项目 | 说明 |
|------|------|
| 开户费 | 免费 |
| 保证金 | ¥10（可退） |
| 交易手续费 | 1% |
| 提现费用 | 免费 |
| 结算周期 | T+1 |

### 示例计算

```
订单金额：¥9.9
手续费：¥9.9 × 1% = ¥0.099
实际到账：¥9.9 - ¥0.099 = ¥9.80

月收入 ¥1000 时：
手续费：¥10
实际到账：¥990
```

---

## 八、常见问题

### Q1：收款码有金额限制吗？

```
微信个人收款码：
- 单笔限额：¥500
- 单日限额：¥5000

支付宝个人收款码：
- 单笔限额：¥1000
- 单日限额：¥10000

你的产品定价 ¥9.9，完全在限额内。
```

### Q2：如何避免风控？

```
✅ 建议：
- 单日订单不超过 100 笔
- 避免同一用户频繁下单
- 收款金额与商品定价一致

❌ 避免：
- 大额频繁收款
- 异常时间段的密集交易
- 收款码多平台共用
```

### Q3：用户支付后多久到账？

```
用户扫码支付 → 平台检测到账 → 回调通知 → 解锁功能
整个过程通常 10-30 秒
```

### Q4：平台会不会跑路？

```
风险提示：
- 码支付平台属于第三方服务
- 建议定期提现，不要留大量余额
- 关注平台公告和用户反馈
- 收入增长后建议升级正规支付
```

---

## 九、升级建议

当年收入达到一定规模后，建议升级：

| 年收入 | 建议方案 |
|--------|----------|
| < ¥5000 | 码支付即可 |
| ¥5000-¥30000 | 考虑注册个体户 + 正规支付 |
| > ¥30000 | 建议注册公司 + 完整财务系统 |

---

## 十、替代方案对比

如果 XorPay 不满足需求，可以考虑：

| 平台 | 特点 | 链接 |
|------|------|------|
| 虎皮椒 | 老牌码支付 | xunhupay.com |
| 易支付 | 多代理商 | 搜索"易支付" |
| 爱发电 | 赞助模式 | afdian.com |
| Lemon Squeezy | 国际支付 | lemonsqueezy.com |

---

**下一步**：注册 XorPay 账号后，将 AppID 和 AppSecret 告诉我，我帮你完成最终集成！
