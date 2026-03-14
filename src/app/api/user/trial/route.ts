import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 检查和记录功能体验
export async function POST(request: NextRequest) {
  try {
    const { deviceFingerprint, featureKey, action } = await request.json();

    if (!deviceFingerprint || !featureKey) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 获取用户
    const { data: user, error: userError } = await client
      .from('users')
      .select('*')
      .eq('device_fingerprint', deviceFingerprint)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 已付费用户直接返回可用
    if (user.payment_status === 'paid') {
      return NextResponse.json({
        success: true,
        canUse: true,
        isPaid: true,
        remaining: -1, // 无限制
      });
    }

    // 查询体验记录
    let { data: trial, error: trialError } = await client
      .from('feature_trials')
      .select('*')
      .eq('user_id', user.id)
      .eq('feature_key', featureKey)
      .single();

    // 如果不存在，创建记录
    if (trialError && trialError.code === 'PGRST116') {
      const { data: newTrial, error: createError } = await client
        .from('feature_trials')
        .insert({
          user_id: user.id,
          feature_key: featureKey,
          used_count: 0,
          max_free_count: 1,
        })
        .select()
        .single();

      if (createError) {
        console.error('创建体验记录失败:', createError);
        return NextResponse.json(
          { error: '创建体验记录失败' },
          { status: 500 }
        );
      }
      trial = newTrial;
    } else if (trialError) {
      console.error('查询体验记录失败:', trialError);
      return NextResponse.json(
        { error: '查询体验记录失败' },
        { status: 500 }
      );
    }

    // 检查模式
    if (action === 'check') {
      const canUse = trial.used_count < trial.max_free_count;
      return NextResponse.json({
        success: true,
        canUse,
        isPaid: false,
        usedCount: trial.used_count,
        maxFreeCount: trial.max_free_count,
        remaining: trial.max_free_count - trial.used_count,
      });
    }

    // 使用模式
    if (action === 'use') {
      // 检查是否还有次数
      if (trial.used_count >= trial.max_free_count) {
        return NextResponse.json({
          success: false,
          canUse: false,
          isPaid: false,
          usedCount: trial.used_count,
          maxFreeCount: trial.max_free_count,
          remaining: 0,
          message: '体验次数已用完，请购买解锁完整功能',
        });
      }

      // 增加使用次数
      const { error: updateError } = await client
        .from('feature_trials')
        .update({
          used_count: trial.used_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trial.id);

      if (updateError) {
        console.error('更新体验次数失败:', updateError);
        return NextResponse.json(
          { error: '更新体验次数失败' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        canUse: true,
        isPaid: false,
        usedCount: trial.used_count + 1,
        maxFreeCount: trial.max_free_count,
        remaining: trial.max_free_count - trial.used_count - 1,
        message: '体验次数已使用，剩余 ' + (trial.max_free_count - trial.used_count - 1) + ' 次',
      });
    }

    return NextResponse.json(
      { error: '无效的操作类型' },
      { status: 400 }
    );
  } catch (error) {
    console.error('处理体验请求失败:', error);
    return NextResponse.json(
      { error: '处理体验请求失败' },
      { status: 500 }
    );
  }
}
