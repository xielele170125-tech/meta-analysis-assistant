#!/bin/bash

echo "======================================"
echo "  支付系统配置脚本"
echo "======================================"
echo ""

# 检查 .env.local 是否存在
if [ -f ".env.local" ]; then
    echo "✅ .env.local 已存在"
else
    echo "📝 创建 .env.local 文件..."
    cp .env.example .env.local
    echo "✅ 已创建 .env.local"
    echo ""
    echo "⚠️  请编辑 .env.local 填写你的配置："
    echo "   - ADMIN_KEY: 管理员密钥"
    echo "   - PAYMENT_WEBHOOK_KEY: Webhook密钥"
    echo "   - CRON_KEY: 定时任务密钥"
    echo "   - NEXT_PUBLIC_SUPABASE_URL: Supabase URL"
    echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase匿名密钥"
    echo ""
fi

# 创建收款码目录
if [ -d "public/payment" ]; then
    echo "✅ public/payment 目录已存在"
else
    echo "📁 创建 public/payment 目录..."
    mkdir -p public/payment
    echo "✅ 已创建目录"
fi

# 检查收款码
echo ""
echo "📷 收款码检查："
if [ -f "public/payment/wechat-qr.png" ]; then
    echo "✅ 微信收款码已配置"
else
    echo "⚠️  微信收款码未配置 (public/payment/wechat-qr.png)"
fi

if [ -f "public/payment/alipay-qr.png" ]; then
    echo "✅ 支付宝收款码已配置"
else
    echo "⚠️  支付宝收款码未配置 (public/payment/alipay-qr.png)"
fi

echo ""
echo "======================================"
echo "  下一步操作"
echo "======================================"
echo ""
echo "1️⃣  编辑 .env.local 填写配置"
echo "   nano .env.local"
echo ""
echo "2️⃣  在 Supabase 执行数据库迁移"
echo "   查看: src/db/migrations/add_payment_tables.sql"
echo "   和: src/db/migrations/add_payment_notifications.sql"
echo ""
echo "3️⃣  放置收款码图片"
echo "   cp 你的微信收款码.png public/payment/wechat-qr.png"
echo "   cp 你的支付宝收款码.png public/payment/alipay-qr.png"
echo ""
echo "4️⃣  启动开发服务器测试"
echo "   pnpm dev"
echo ""
echo "5️⃣  访问管理后台"
echo "   http://localhost:5000/admin/orders"
echo ""
echo "======================================"
echo "  完成！"
echo "======================================"
