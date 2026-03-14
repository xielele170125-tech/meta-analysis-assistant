-- ==========================================
-- 完整的支付系统数据库迁移
-- 在 Supabase SQL Editor 中执行此文件
-- ==========================================

-- ==========================================
-- 1. 用户表
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(255),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'free',
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_fingerprint ON users(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_users_payment_status ON users(payment_status);

-- ==========================================
-- 2. 支付订单表
-- ==========================================
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  device_fingerprint VARCHAR(64) NOT NULL,
  order_no VARCHAR(64) NOT NULL UNIQUE,
  payment_method VARCHAR(20) NOT NULL,
  payment_type VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  transaction_id VARCHAR(128),
  paid_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 订单表索引
CREATE INDEX IF NOT EXISTS idx_orders_user ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON payment_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_device ON payment_orders(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON payment_orders(created_at);

-- ==========================================
-- 3. 体验次数表
-- ==========================================
CREATE TABLE IF NOT EXISTS trial_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint VARCHAR(64) NOT NULL,
  feature_key VARCHAR(50) NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(device_fingerprint, feature_key)
);

-- 体验次数索引
CREATE INDEX IF NOT EXISTS idx_trial_device ON trial_usage(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_trial_feature ON trial_usage(feature_key);

-- ==========================================
-- 4. 收款通知表（用于自动监控）
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- 通知表索引
CREATE INDEX IF NOT EXISTS idx_notifications_processed ON payment_notifications(processed);
CREATE INDEX IF NOT EXISTS idx_notifications_order ON payment_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON payment_notifications(created_at);

-- ==========================================
-- 5. 表注释
-- ==========================================
COMMENT ON TABLE users IS '用户表，基于设备指纹识别';
COMMENT ON TABLE payment_orders IS '支付订单表';
COMMENT ON TABLE trial_usage IS '功能体验次数表';
COMMENT ON TABLE payment_notifications IS '收款通知记录表，用于自动匹配支付订单';

-- ==========================================
-- 完成！
-- ==========================================
-- 执行成功后，你的数据库已准备好接收支付数据
