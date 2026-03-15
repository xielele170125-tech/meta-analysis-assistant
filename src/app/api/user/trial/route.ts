import { NextRequest, NextResponse } from 'next/server';

// 检查和记录功能体验 - 所有功能免费开放
export async function POST(request: NextRequest) {
  try {
    const { deviceFingerprint, featureKey, action } = await request.json();

    if (!deviceFingerprint || !featureKey) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 所有用户都视为已付费用户，无限制使用所有功能
    return NextResponse.json({
      success: true,
      canUse: true,
      isPaid: true,
      remaining: -1, // 无限制
      message: '本项目已完全开源免费，欢迎体验所有功能！',
    });
  } catch (error) {
    console.error('处理请求失败:', error);
    return NextResponse.json(
      { error: '处理请求失败' },
      { status: 500 }
    );
  }
}
