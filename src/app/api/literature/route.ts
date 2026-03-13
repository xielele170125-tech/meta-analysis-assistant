import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 获取文献列表
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = client
      .from('literature')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get literature error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}

// 创建文献记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('literature')
      .insert({
        title: body.title,
        authors: body.authors,
        year: body.year,
        journal: body.journal,
        doi: body.doi,
        file_key: body.fileKey,
        file_name: body.fileName,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Create literature error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建失败' },
      { status: 500 }
    );
  }
}

// 删除文献
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少文献ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 先删除关联的提取数据
    await client.from('extracted_data').delete().eq('literature_id', id);

    // 删除文献记录
    const { error } = await client.from('literature').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete literature error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}

// 更新文献记录（如添加PDF）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, fileKey, fileName, status } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少文献ID' }, { status: 400 });
    }

    const client = getSupabaseClient();

    const updateData: Record<string, unknown> = {};
    if (fileKey !== undefined) updateData.file_key = fileKey;
    if (fileName !== undefined) updateData.file_name = fileName;
    if (status !== undefined) updateData.status = status;

    const { data, error } = await client
      .from('literature')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Update literature error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}
