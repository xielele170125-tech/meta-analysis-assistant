import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取用户付费状态
export async function POST(request: NextRequest) {
  try {
    const { deviceFingerprint } = await request.json();

    if (!deviceFingerprint) {
      return NextResponse.json(
        { error: '缺少设备指纹' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查找或创建用户
    let { data: user, error } = await client
      .from('users')
      .select('*')
      .eq('device_fingerprint', deviceFingerprint)
      .single();

    if (error && error.code === 'PGRST116') {
      // 用户不存在，创建新用户
      const { data: newUser, error: createError } = await client
        .from('users')
        .insert({
          device_fingerprint: deviceFingerprint,
          payment_status: 'free',
        })
        .select()
        .single();

      if (createError) {
        console.error('创建用户失败:', createError);
        return NextResponse.json(
          { error: '创建用户失败' },
          { status: 500 }
        );
      }
      user = newUser;
    } else if (error) {
      console.error('查询用户失败:', error);
      return NextResponse.json(
        { error: '查询用户失败' },
        { status: 500 }
      );
    }

    // 获取各功能的体验次数
    const { data: trials } = await client
      .from('feature_trials')
      .select('*')
      .eq('user_id', user.id);

    // 功能列表
    const features = [
      'meta_analysis',
      'forest_plot',
      'funnel_plot',
      'quality_assessment',
      'export_excel',
      'export_image',
      'network_meta',
      'ai_classification',
      'r_code',
    ];

    // 构建体验次数映射
    const trialMap: Record<string, { used: number; max: number }> = {};
    for (const feature of features) {
      const trial = trials?.find(t => t.feature_key === feature);
      trialMap[feature] = {
        used: trial?.used_count ?? 0,
        max: trial?.max_free_count ?? 1,
      };
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        paymentStatus: user.payment_status,
        paymentType: user.payment_type,
        paidAt: user.paid_at,
      },
      trials: trialMap,
      isPaid: user.payment_status === 'paid',
    });
  } catch (error) {
    console.error('获取用户状态失败:', error);
    return NextResponse.json(
      { error: '获取用户状态失败' },
      { status: 500 }
    );
  }
}
