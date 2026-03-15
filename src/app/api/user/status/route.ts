import { NextRequest, NextResponse } from 'next/server';

// 获取用户状态 - 所有功能免费开放
export async function POST(request: NextRequest) {
  try {
    const { deviceFingerprint } = await request.json();

    if (!deviceFingerprint) {
      return NextResponse.json(
        { error: '缺少设备指纹' },
        { status: 400 }
      );
    }

    // 所有用户都视为已付费用户
    return NextResponse.json({
      success: true,
      user: {
        paymentStatus: 'paid',
        paymentType: 'opensource',
        paidAt: new Date().toISOString(),
      },
      trials: {},
      isPaid: true,
      message: '本项目已完全开源免费，欢迎使用所有功能！',
    });
  } catch (error) {
    console.error('获取用户状态失败:', error);
    return NextResponse.json(
      { error: '获取用户状态失败' },
      { status: 500 }
    );
  }
}
