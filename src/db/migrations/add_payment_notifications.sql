-- 收款通知表（用于存储收到的收款通知）
CREATE TABLE IF NOT EXISTS payment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,           -- 来源：bark, serverchan, wechat, alipay_email 等
  amount DECIMAL(10, 2),                 -- 金额
  order_id VARCHAR(64),                  -- 从备注解析的订单号
  payment_method VARCHAR(20),            -- 支付方式：wechat, alipay
  raw_content TEXT,                      -- 原始通知内容
  processed BOOLEAN DEFAULT false,       -- 是否已处理
  matched_order VARCHAR(64),             -- 匹配到的订单号
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_payment_notifications_processed ON payment_notifications(processed);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_order ON payment_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_created ON payment_notifications(created_at);

-- 添加 metadata 字段到 orders 表（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_orders' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE payment_orders ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- 添加注释
COMMENT ON TABLE payment_notifications IS '收款通知记录表，用于自动匹配支付订单';
