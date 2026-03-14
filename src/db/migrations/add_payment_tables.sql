-- 用户和付费相关表
-- 运行此脚本创建必要的数据库表

-- 用户表（基于设备指纹识别）
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(255),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'free',
  payment_type VARCHAR(20),
  paid_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS users_fingerprint_idx ON users(device_fingerprint);
CREATE INDEX IF NOT EXISTS users_payment_status_idx ON users(payment_status);

-- 功能体验次数表
CREATE TABLE IF NOT EXISTS feature_trials (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key VARCHAR(50) NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  max_free_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS feature_trials_user_idx ON feature_trials(user_id);
CREATE INDEX IF NOT EXISTS feature_trials_feature_idx ON feature_trials(feature_key);
CREATE INDEX IF NOT EXISTS feature_trials_user_feature_idx ON feature_trials(user_id, feature_key);

-- 支付订单表
CREATE TABLE IF NOT EXISTS payment_orders (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS payment_orders_user_idx ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS payment_orders_order_no_idx ON payment_orders(order_no);
CREATE INDEX IF NOT EXISTS payment_orders_status_idx ON payment_orders(status);
CREATE INDEX IF NOT EXISTS payment_orders_transaction_idx ON payment_orders(transaction_id);

-- 注释
COMMENT ON TABLE users IS '用户表，基于设备指纹识别';
COMMENT ON TABLE feature_trials IS '功能体验次数表';
COMMENT ON TABLE payment_orders IS '支付订单表';
