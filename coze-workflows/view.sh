#!/bin/bash

# 简单的分段查看工具
# 用法: bash view.sh [1-5]
# 1=检索式生成, 2=文献初筛, 3=数据提取, 4=质量评估, 5=Meta分析

WORKFLOW=$1

if [ -z "$WORKFLOW" ]; then
    echo "========================================="
    echo "📚 PROMPTS.md 分段查看工具"
    echo "========================================="
    echo ""
    echo "用法: bash view.sh [选项]"
    echo ""
    echo "选项："
    echo "  1  - 文献检索式生成"
    echo "  2  - 文献AI初筛"
    echo "  3  - 文献数据提取"
    echo "  4  - 文献质量评估"
    echo "  5  - Meta分析计算"
    echo "  all - 查看完整文件"
    echo ""
    echo "示例: bash view.sh 1"
    echo ""
    exit 0
fi

case $WORKFLOW in
    1)
        echo ""
        echo "=== 1. 文献检索式生成 ==="
        echo ""
        sed -n '1,200p' PROMPTS.md
        ;;
    2)
        echo ""
        echo "=== 2. 文献AI初筛 ==="
        echo ""
        sed -n '201,270p' PROMPTS.md
        ;;
    3)
        echo ""
        echo "=== 3. 文献数据提取 ==="
        echo ""
        sed -n '271,400p' PROMPTS.md
        ;;
    4)
        echo ""
        echo "=== 4. 文献质量评估 ==="
        echo ""
        sed -n '401,600p' PROMPTS.md
        ;;
    5)
        echo ""
        echo "=== 5. Meta分析计算 ==="
        echo ""
        sed -n '601,$p' PROMPTS.md
        ;;
    all)
        echo ""
        echo "=== 完整PROMPTS.md文件 ==="
        echo ""
        cat PROMPTS.md
        ;;
    *)
        echo "无效选项: $WORKFLOW"
        echo "请使用 1-5 或 all"
        ;;
esac

echo ""
echo "========================================="
echo "✅ 查看完成"
echo "========================================="
