#!/bin/bash

# PROMPTS.md 分段查看工具

echo "========================================="
echo "📚 PROMPTS.md 分段查看"
echo "========================================="
echo ""
echo "选择要查看的工作流："
echo ""
echo "1) 文献检索式生成（第1部分）"
echo "2) 文献AI初筛（第2部分）"
echo "3) 文献数据提取（第3部分）"
echo "4) 文献质量评估（第4部分）"
echo "5) Meta分析计算（第5部分）"
echo "6) 查看完整文件"
echo "0) 退出"
echo ""
read -p "请输入选项 (0-6): " choice

case $choice in
    1)
        echo ""
        echo "=== 文献检索式生成 ==="
        echo ""
        sed -n '1,200p' coze-workflows/PROMPTS.md
        ;;
    2)
        echo ""
        echo "=== 文献AI初筛 ==="
        echo ""
        sed -n '201,270p' coze-workflows/PROMPTS.md
        ;;
    3)
        echo ""
        echo "=== 文献数据提取 ==="
        echo ""
        sed -n '271,400p' coze-workflows/PROMPTS.md
        ;;
    4)
        echo ""
        echo "=== 文献质量评估 ==="
        echo ""
        sed -n '401,600p' coze-workflows/PROMPTS.md
        ;;
    5)
        echo ""
        echo "=== Meta分析计算 ==="
        echo ""
        sed -n '601,$p' coze-workflows/PROMPTS.md
        ;;
    6)
        echo ""
        echo "=== 完整文件 ==="
        echo ""
        cat coze-workflows/PROMPTS.md
        ;;
    0)
        echo "退出"
        exit 0
        ;;
    *)
        echo "无效选项"
        ;;
esac

echo ""
echo "========================================="
echo "✅ 查看完成"
echo "========================================="
