# 免签支付集成指南

## 一、什么是免签支付？

```
传统支付：申请商户号 → 审核资质 → 接入API
免签支付：上传收款码 → 平台监控到账 → 自动通知你

优势：
✅ 零保证金
✅ 无需营业执照
✅ 个人即可申请
✅ 立即可用
```

---

## 二、选择平台

### 推荐平台

| 平台 | 官网 | 手续费 | 稳定性 | 推荐 |
|------|------|--------|--------|------|
| **MFK免签** | pay.mfk.today | 2% | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **易支付** | 搜索"易支付" | 1-2% | 看代理商 | ⭐⭐⭐ |

### 如何选择

```
选 MFK：
- 官方平台，稳定可靠
- 手续费 2%
- 支持微信、支付宝

选易支付：
- 找信誉好的代理商
- 手续费可能更低
- 注意平台跑路风险
```

---

## 三、MFK 免签注册流程

### Step 1：注册账号

1. 访问 https://pay.mfk.today
2. 点击「注册」
3. 填写信息：
   ```
   用户名：自定义
   密码：自定义
   邮箱：你的邮箱（用于接收通知）
   ```

### Step 2：实名认证

1. 登录后台
2. 点击「实名认证」
3. 填写真实姓名和身份证号
4. 等待审核（通常几分钟）

### Step 3：配置收款方式

#### 微信收款码
1. 打开微信 → 我 → 服务 → 钱包
2. 点击「收付款」→「二维码收款」
3. 保存收款码图片
4. 在 MFK 后台上传微信收款码

#### 支付宝收款码
1. 打开支付宝 → 首页 → 收钱
2. 保存个人收款码图片
3. 在 MFK 后台上传支付宝收款码

### Step 4：创建应用

1. 进入「应用管理」
2. 点击「创建应用」
3. 填写信息：
   ```
   应用名称：Meta分析工具
   应用类型：网站
   回调地址：https://你的域名/api/payment/mianqian/notify
   ```
4. 提交后获得：
   - **PID**（商户ID）
   - **Key**（商户密钥）

### Step 5：测试支付

1. 进入「测试支付」
2. 扫码支付 ¥0.01
3. 确认能否正常回调

---

## 四、配置环境变量

### 本地开发（.env.local）

```bash
# 免签支付配置
MIANQIAN_PID=你的商户ID
MIANQIAN_KEY=你的商户密钥
MIANQIAN_PLATFORM=mfk

# 应用域名
NEXT_PUBLIC_APP_URL=http://localhost:5000
```

### Vercel 部署

在 Vercel 项目设置 → Environment Variables 中添加：

```
MIANQIAN_PID = 你的商户ID
MIANQIAN_KEY = 你的商户密钥
MIANQIAN_PLATFORM = mfk
NEXT_PUBLIC_APP_URL = https://你的域名
```

---

## 五、数据库准备

确保已创建付费相关表（如果还没有）：

```sql
-- 用户表
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
CREATE INDEX IF NOT EXISTS idx_orders_device ON payment_orders(device_fingerprint);
```

---

## 六、测试流程

### 本地测试

```bash
# 1. 启动开发服务器
pnpm dev

# 2. 使用 ngrok 暴露本地服务
ngrok http 5000

# 3. 将 ngrok 地址配置到 MFK 回调地址
# 例如：https://xxx.ngrok.io/api/payment/mianqian/notify
```

### 创建测试订单

```bash
curl -X POST http://localhost:5000/api/payment/mianqian/create \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceFingerprint": "test-device-123",
    "paymentMethod": "wxpay"
  }'
```

### 预期响应

```json
{
  "success": true,
  "order": {
    "orderNo": "MQXXXXXX",
    "amount": "9.90",
    "displayAmount": "¥9.9",
    "paymentMethod": "wechat",
    "status": "pending"
  },
  "payment": {
    "qrCode": "https://pay.mfk.today/qrcode/xxx.png",
    "payUrl": "https://pay.mfk.today/pay/xxx",
    "tradeNo": "xxx"
  }
}
```

---

## 七、费用说明

### MFK 手续费计算

```
订单金额：¥9.9
手续费：¥9.9 × 2% = ¥0.198
实际到账：¥9.9 - ¥0.198 ≈ ¥9.70

对比虎皮椒（¥30保证金，1.5%手续费）：
- 首月 50 单：免签到账 ¥485，虎皮椒到账 ¥488.25（扣保证金后 ¥458.25）
- 结论：首月免签更划算，后续虎皮椒略优

对比爱发电（¥0保证金，6%手续费）：
- 每单到账：¥9.31 vs ¥9.70
- 免签多赚 ¥0.39/单
```

### 收益对比表

| 月订单数 | 免签支付 | 虎皮椒 | 爱发电 |
|----------|----------|--------|--------|
| 10 单 | ¥97 | ¥68.5* | ¥93.1 |
| 50 单 | ¥485 | ¥458.5* | ¥465.5 |
| 100 单 | ¥970 | ¥943.5* | ¥931 |

*虎皮椒已扣除 ¥30 保证金

---

## 八、常见问题

### Q1：收款码有金额限制吗？

```
微信个人收款码：
- 单笔：¥500
- 单日：¥5000

支付宝个人收款码：
- 单笔：¥1000
- 单日：¥10000

你的产品 ¥9.9，完全没问题！
```

### Q2：会不会被风控？

```
✅ 安全做法：
- 单日订单 < 100 笔
- 避免同一用户频繁下单
- 收款码专码专用

❌ 危险做法：
- 大额频繁收款
- 异常时间段密集交易
- 收款码多平台共用
```

### Q3：用户付款后多久解锁？

```
用户扫码 → 付款成功 → 平台检测（3-10秒）→ 回调通知 → 自动解锁
整个过程 10-30 秒
```

### Q4：平台会不会跑路？

```
建议：
- 定期提现，不留余额
- 关注平台公告
- 收入增长后考虑正规支付

免签支付适合：
- 月收入 < ¥5000
- 初创项目
- 测试市场
```

### Q5：能开发票吗？

```
免签支付 = 个人收款
无法开具正规发票

如需发票：
- 注册个体户
- 申请微信/支付宝商户号
```

---

## 九、迁移到正规支付

当年收入达到一定规模，建议升级：

```
年收入 < ¥5000：免签支付即可
年收入 ¥5000-¥30000：考虑虎皮椒（¥30保证金）
年收入 > ¥30000：注册个体户 + 正规支付
```

迁移步骤：
1. 保留现有免签支付代码
2. 新增微信/支付宝商户支付
3. 根据配置切换支付方式
4. 历史用户不受影响

---

## 十、故障排查

### 订单创建失败

```bash
# 检查环境变量
echo $MIANQIAN_PID
echo $MIANQIAN_KEY

# 查看日志
tail -f /app/work/logs/bypass/app.log | grep "免签支付"
```

### 回调未触发

```bash
# 1. 检查回调地址是否可访问
curl https://你的域名/api/payment/mianqian/notify

# 2. 检查 MFK 后台的回调日志

# 3. 确认回调地址配置正确
```

### 签名验证失败

```bash
# 检查密钥是否正确
# 注意：密钥区分大小写

# 在 MFK 后台重新获取密钥
```

---

## 十一、下一步

1. **注册 MFK 账号**
   - 访问 pay.mfk.today
   - 完成实名认证
   - 上传收款码

2. **创建应用获取密钥**
   - 创建应用
   - 配置回调地址
   - 复制 PID 和 Key

3. **配置环境变量**
   - 本地：`.env.local`
   - Vercel：Environment Variables

4. **测试支付流程**
   - 创建测试订单
   - 扫码支付
   - 确认自动解锁

---

**准备好后告诉我你的 PID 和 Key，我帮你确认配置是否正确！**
