# 虎皮椒支付集成指南

## 一、虎皮椒是什么？

```
虎皮椒（XunhuPay）是一个个人免签约支付平台

优势：
✅ 保证金低（¥30）
✅ 手续费低（1.5%）
✅ 个人可申请
✅ 支持微信、支付宝
✅ 老牌平台，稳定可靠
```

---

## 二、注册流程

### Step 1：访问官网

```
网址：https://xunhupay.com
```

### Step 2：注册账号

1. 点击右上角「注册」
2. 填写信息：
   ```
   用户名：自定义
   密码：自定义
   邮箱：你的邮箱
   手机：你的手机号
   ```
3. 完成邮箱/手机验证

### Step 3：实名认证

1. 登录后进入「个人中心」
2. 点击「实名认证」
3. 填写真实姓名和身份证号
4. 等待审核（通常几分钟）

### Step 4：充值保证金

```
金额：¥30（一次性，可退还）
方式：微信/支付宝扫码充值
```

### Step 5：创建应用

1. 进入「应用管理」
2. 点击「添加应用」
3. 填写信息：

```
应用名称：Meta分析工具
应用类型：网站
应用网址：你的网站地址（可以填 GitHub 地址）
回调地址：https://你的域名/api/payment/hupijiao/notify
```

4. 提交后获得：
   - **AppID**（应用ID）
   - **AppSecret**（应用密钥）

### Step 6：配置收款方式

#### 微信收款码
1. 打开微信 → 我 → 服务 → 钱包
2. 点击「收付款」→「二维码收款」
3. 保存收款码图片
4. 在虎皮椒后台上传

#### 支付宝收款码
1. 打开支付宝 → 首页 → 收钱
2. 保存个人收款码图片
3. 在虎皮椒后台上传

---

## 三、配置环境变量

### 本地开发（.env.local）

```bash
# 虎皮椒配置
HUPIJIAO_APPID=你的AppID
HUPIJIAO_APPSECRET=你的AppSecret

# 应用域名
NEXT_PUBLIC_APP_URL=http://localhost:5000
```

### Vercel 部署

在 Vercel 项目设置 → Environment Variables 中添加：

```
HUPIJIAO_APPID = 你的AppID
HUPIJIAO_APPSECRET = 你的AppSecret
NEXT_PUBLIC_APP_URL = https://你的域名
```

---

## 四、数据库准备

确保已创建付费相关表：

```sql
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint VARCHAR(64) UNIQUE NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'free',
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 订单表
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_fingerprint ON users(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON payment_orders(order_no);
```

---

## 五、测试流程

### 本地测试

```bash
# 1. 启动开发服务器
pnpm dev

# 2. 使用 ngrok 暴露本地服务
ngrok http 5000

# 3. 将 ngrok 地址配置到虎皮椒回调地址
# 例如：https://xxx.ngrok.io/api/payment/hupijiao/notify
```

### 创建测试订单

```bash
curl -X POST http://localhost:5000/api/payment/hupijiao/create \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceFingerprint": "test-device-123",
    "paymentMethod": "wechat"
  }'
```

### 预期响应

```json
{
  "success": true,
  "order": {
    "orderNo": "HPXXXXXX",
    "amount": "9.90",
    "displayAmount": "¥9.9",
    "paymentMethod": "wechat",
    "status": "pending"
  },
  "payment": {
    "url": "https://api.xunhupay.com/payment/...",
    "qrCode": "https://api.xunhupay.com/qrcode/...",
    "orderId": "xxx"
  }
}
```

---

## 六、费用说明

### 手续费计算

```
订单金额：¥9.9
手续费：¥9.9 × 1.5% = ¥0.1485
实际到账：¥9.9 - ¥0.15 = ¥9.75

首月回本计算：
保证金 ¥30 ÷ 每单多赚 ¥0.15 = 需要 200 单回本
```

### 收益对比表

| 月订单数 | 虎皮椒 | 免签支付(2%) | 爱发电(6%) |
|----------|--------|--------------|------------|
| 10 单 | ¥97.5 | ¥97 | ¥93.1 |
| 50 单 | ¥487.5 | ¥485 | ¥465.5 |
| 100 单 | ¥975 | ¥970 | ¥931 |

> 注：虎皮椒首月需扣除 ¥30 保证金

---

## 七、支付流程

```
用户点击「立即购买」
        ↓
前端调用 /api/payment/hupijiao/create
        ↓
虎皮椒返回支付页面 URL 和二维码
        ↓
用户扫码或跳转支付
        ↓
虎皮椒检测到账
        ↓
回调通知 /api/payment/hupijiao/notify
        ↓
更新订单状态 + 解锁用户功能
        ↓
前端轮询检测到支付成功
        ↓
显示成功提示 ✅
```

---

## 八、常见问题

### Q1：保证金能退吗？

```
可以！
申请提现时，保证金会一并退还
前提：所有订单已结算完成
```

### Q2：收款码有金额限制吗？

```
微信个人收款码：
- 单笔限额：¥500
- 单日限额：¥5000

支付宝个人收款码：
- 单笔限额：¥1000
- 单日限额：¥10000

你的产品 ¥9.9，完全没问题！
```

### Q3：用户付款后多久解锁？

```
扫码支付 → 平台检测（3-10秒）→ 回调通知 → 自动解锁
整个过程 10-30 秒
```

### Q4：如何查看订单状态？

```
虎皮椒后台 → 订单管理
可以看到所有订单和状态
```

### Q5：可以开发票吗？

```
虎皮椒 = 个人收款
无法开具正规发票

如需发票：
- 注册个体户
- 申请微信/支付宝商户号
```

### Q6：遇到问题怎么办？

```
1. 虎皮椒后台有在线客服
2. 官方 QQ 群：查看官网底部
3. 邮件支持：support@xunhupay.com
```

---

## 九、故障排查

### 订单创建失败

```bash
# 检查环境变量
echo $HUPIJIAO_APPID
echo $HUPIJIAO_APPSECRET

# 查看日志
tail -f /app/work/logs/bypass/app.log | grep "虎皮椒"
```

### 回调未触发

```bash
# 1. 检查回调地址是否可访问
curl https://你的域名/api/payment/hupijiao/notify

# 2. 检查虎皮椒后台的回调日志

# 3. 确认回调地址配置正确
```

### 签名验证失败

```bash
# 检查密钥是否正确
# 注意：密钥区分大小写

# 在虎皮椒后台重新获取密钥
```

---

## 十、下一步

### 现在就注册

1. **访问官网**：https://xunhupay.com
2. **完成注册和认证**
3. **充值 ¥30 保证金**
4. **创建应用获取密钥**
5. **配置环境变量**
6. **测试支付**

### 获取密钥后

告诉我你的：
- `AppID`
- `AppSecret`

我帮你确认配置是否正确！

---

## 十一、平台对比

| 项目 | 虎皮椒 | MFK免签 | XorPay |
|------|--------|---------|--------|
| 保证金 | **¥30** | ¥0 | ¥100 |
| 手续费 | **1.5%** | 2% | 1% |
| 稳定性 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 推荐度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

**虎皮椒 = 保证金低 + 手续费低 + 稳定可靠**
