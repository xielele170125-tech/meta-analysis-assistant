import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 批量删除文献
 * POST /api/literature/batch-delete
 * Body: { ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '请提供要删除的文献ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 先删除关联的提取数据
    const { error: dataError } = await client
      .from('extracted_data')
      .delete()
      .in('literature_id', ids);

    if (dataError) {
      console.error('Delete extracted data error:', dataError);
      // 继续删除文献记录
    }

    // 批量删除文献记录
    const { error, count } = await client
      .from('literature')
      .delete()
      .in('id', ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedCount: ids.length,
    });
  } catch (error) {
    console.error('Batch delete literature error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量删除失败' },
      { status: 500 }
    );
  }
}
