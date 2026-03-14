import { NextResponse } from 'next/server';

export async function GET() {
  const diagnostics: Record<string, unknown> = {};

  // 检查环境变量
  diagnostics.env = {
    COZE_SUPABASE_URL: process.env.COZE_SUPABASE_URL ? '已设置' : '❌ 未设置',
    COZE_SUPABASE_ANON_KEY: process.env.COZE_SUPABASE_ANON_KEY ? '已设置' : '❌ 未设置',
    YIPAY_API_URL: process.env.YIPAY_API_URL ? '已设置' : '❌ 未设置',
    YIPAY_PID: process.env.YIPAY_PID ? '已设置' : '❌ 未设置',
    YIPAY_KEY: process.env.YIPAY_KEY ? '已设置' : '❌ 未设置',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ? '已设置' : '❌ 未设置',
  };

  // 测试 Supabase 连接
  try {
    const { getSupabaseClient } = await import('@/storage/database/supabase-client');
    const client = getSupabaseClient();
    
    // 简单查询测试
    const { error } = await client.from('users').select('id').limit(1);
    
    if (error) {
      diagnostics.supabase = {
        status: '❌ 连接失败',
        error: error.message,
        code: error.code,
      };
    } else {
      diagnostics.supabase = {
        status: '✅ 连接成功',
      };
    }
  } catch (e) {
    diagnostics.supabase = {
      status: '❌ 连接异常',
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    diagnostics,
  });
}

