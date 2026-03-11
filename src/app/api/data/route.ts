import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取提取数据列表
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const literatureId = searchParams.get('literatureId');

    let query = client
      .from('extracted_data')
      .select('*')
      .order('created_at', { ascending: false });

    if (literatureId) {
      query = query.eq('literature_id', literatureId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get extracted data error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}

// 更新提取数据
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const client = getSupabaseClient();

    const { id, ...updates } = body;

    // 重新计算效应量（如果需要）
    if (
      updates.mean_treatment !== undefined &&
      updates.sd_treatment !== undefined &&
      updates.mean_control !== undefined &&
      updates.sd_control !== undefined &&
      updates.sample_size_treatment &&
      updates.sample_size_control
    ) {
      const n1 = updates.sample_size_treatment;
      const n2 = updates.sample_size_control;
      const m1 = updates.mean_treatment;
      const m2 = updates.mean_control;
      const s1 = updates.sd_treatment;
      const s2 = updates.sd_control;

      const pooledSD = Math.sqrt(
        ((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2)
      );
      const smd = (m1 - m2) / pooledSD;
      const se = Math.sqrt((n1 + n2) / (n1 * n2) + smd * smd / (2 * (n1 + n2)));

      updates.effect_size = smd;
      updates.standard_error = se;
      updates.ci_lower = smd - 1.96 * se;
      updates.ci_upper = smd + 1.96 * se;
    }

    const { data, error } = await client
      .from('extracted_data')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Update extracted data error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}

// 删除提取数据
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少数据ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { error } = await client.from('extracted_data').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete extracted data error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
