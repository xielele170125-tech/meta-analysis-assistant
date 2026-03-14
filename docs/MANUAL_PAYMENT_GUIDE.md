# 个人收款码支付方案

## 零成本、零手续费！

这个方案不需要任何第三方支付平台，直接使用你的个人微信/支付宝收款码收款。

---

## 一、方案对比

| 项目 | 个人收款码 | 虎皮椒 | MFK免签 |
|------|-----------|--------|---------|
| 保证金 | ✅ **¥0** | ¥30 | ¥0 |
| 手续费 | ✅ **0%** | 1.5% | 2% |
| 自动化 | ❌ 需手动确认 | ✅ 自动 | ✅ 自动 |
| 到账速度 | ✅ 实时 | 实时 | 实时 |
| 适合场景 | 订单少、初期 | 订单多 | 订单多 |

**个人收款码 = 完全免费 + 稍微麻烦一点**

---

## 二、你需要做的

### Step 1：准备收款码图片

#### 微信收款码
```
1. 打开微信
2. 我 → 服务 → 钱包
3. 收付款 → 二维码收款
4. 保存图片
```

#### 支付宝收款码
```
1. 打开支付宝
2. 首页 → 收钱
3. 保存个人收款码图片
```

### Step 2：放置收款码图片

将收款码图片放到项目的 `public/payment/` 目录：

```
public/
  payment/
    wechat-qr.png    # 微信收款码
    alipay-qr.png    # 支付宝收款码
```

### Step 3：设置管理员密钥

在 `.env.local` 或 Vercel 环境变量中设置：

```bash
ADMIN_KEY=你的管理密钥（自己设定一个复杂密码）
```

---

## 三、使用流程

### 用户端流程

```
1. 用户点击「立即购买」
       ↓
2. 弹出支付窗口，显示收款码
       ↓
3. 用户扫码支付（备注订单号）
       ↓
4. 用户填写支付信息提交
       ↓
5. 等待管理员确认
       ↓
6. 功能解锁 ✅
```

### 管理员端流程

```
1. 收到微信/支付宝收款通知
       ↓
2. 访问管理后台：https://你的域名/admin/orders
       ↓
3. 输入管理员密钥登录
       ↓
4. 查看待审核订单列表
       ↓
5. 核对金额和订单号
       ↓
6. 点击「确认收款」
       ↓
7. 用户功能自动解锁 ✅
```

---

## 四、管理后台

### 访问地址

```
https://你的域名/admin/orders
```

### 登录

输入你设置的 `ADMIN_KEY` 即可登录

### 功能

- 查看所有待审核订单
- 查看用户提交的支付凭证
- 确认收款（自动解锁用户功能）
- 拒绝订单

---

## 五、数据库准备

确保已创建以下表：

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

-- 订单表（需要 metadata 字段存储支付凭证）
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
  metadata JSONB,  -- 存储支付凭证等信息
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

如果 `payment_orders` 表已存在但没有 `metadata` 字段：

```sql
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS metadata JSONB;
```

---

## 六、常见问题

### Q1：用户付款后多久能使用？

```
取决于你审核的速度
通常：几分钟到几小时
建议：每天定时查看并审核
```

### Q2：如何防止用户虚假提交？

```
1. 要求用户在转账备注中填写订单号
2. 核对金额是否正确
3. 核对支付时间是否合理
4. 如有疑问，可通过联系方式确认
```

### Q3：订单太多处理不过来怎么办？

```
升级到自动化方案：
- 虎皮椒（¥30保证金，1.5%手续费）
- 免签支付（¥0保证金，2%手续费）
```

### Q4：能同时支持多个管理员吗？

```
当前方案：单一管理员密钥
如需多管理员：可以扩展为用户表管理权限
```

---

## 七、收益计算

### 与其他方案对比

| 月订单数 | 个人收款码 | 虎皮椒(1.5%) | 免签(2%) |
|----------|-----------|--------------|----------|
| 10 单 | **¥99** | ¥97.5 | ¥97 |
| 50 单 | **¥495** | ¥487.5 | ¥485 |
| 100 单 | **¥990** | ¥975 | ¥970 |

**个人收款码每年比虎皮椒多赚约 ¥180（100单/月）**

---

## 八、升级路径

```
阶段一：个人收款码（当前）
  - 月订单 < 30
  - 初期验证市场
  - 不介意手动处理
       ↓
阶段二：虎皮椒/免签支付
  - 月订单 > 30
  - 需要自动化
  - 愿意支付少量费用
       ↓
阶段三：正规商户支付
  - 月订单 > 200
  - 需要开发票
  - 注册个体户/公司
```

---

## 九、文件清单

### 已创建的文件

| 文件 | 说明 |
|------|------|
| `src/components/ManualPaymentModal.tsx` | 手动支付弹窗组件 |
| `src/app/api/payment/manual/submit/route.ts` | 提交支付凭证API |
| `src/app/api/admin/orders/route.ts` | 管理员审核API |
| `src/app/admin/orders/page.tsx` | 管理后台页面 |

### 你需要创建的文件

```
public/payment/wechat-qr.png   # 你的微信收款码
public/payment/alipay-qr.png   # 你的支付宝收款码
```

---

## 十、测试流程

### 1. 本地测试

```bash
# 启动开发服务器
pnpm dev

# 访问管理后台
open http://localhost:5000/admin/orders
```

### 2. 模拟用户提交

```bash
curl -X POST http://localhost:5000/api/payment/manual/submit \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceFingerprint": "test-device",
    "orderNo": "MPTEST001",
    "paymentMethod": "wechat",
    "paymentProof": "测试支付凭证",
    "contactInfo": "test@example.com"
  }'
```

### 3. 管理员审核

```bash
curl -X POST http://localhost:5000/api/admin/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "adminKey": "你的管理密钥",
    "orderNo": "MPTEST001",
    "action": "approve"
  }'
```

---

## 十一、下一步

1. **准备收款码图片**
   - 保存微信收款码为 `public/payment/wechat-qr.png`
   - 保存支付宝收款码为 `public/payment/alipay-qr.png`

2. **设置管理员密钥**
   ```bash
   # .env.local
   ADMIN_KEY=你的复杂密码
   ```

3. **更新代码使用手动支付组件**
   - 在需要付费的地方使用 `ManualPaymentModal` 组件

4. **部署后测试**
   - 访问 `/admin/orders` 测试管理后台

---

**完全免费，立即可用！准备好收款码图片后告诉我，我帮你完成最后配置！**
