import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';
import { parseEndNoteXML, parseRIS } from '@/lib/ris-parser';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

/**
 * 解析粘贴的内容并导入文献
 * POST /api/literature/paste
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contentType, content, fileName, apiKey, autoProcess } = body;

    if (!content) {
      return NextResponse.json({ error: '请提供内容' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 根据内容类型处理
    if (contentType === 'pdf') {
      // PDF文件的base64内容
      return await handlePdfPaste(client, content, fileName, apiKey, autoProcess);
    } else if (contentType === 'ris') {
      // EndNote RIS格式文本
      return await handleRisPaste(client, content, apiKey, autoProcess);
    } else if (contentType === 'xml') {
      // EndNote XML格式文本
      return await handleXmlPaste(client, content, apiKey, autoProcess);
    } else {
      // 自动检测格式
      return await handleAutoDetect(client, content, apiKey, autoProcess);
    }
  } catch (error) {
    console.error('Paste import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导入失败' },
      { status: 500 }
    );
  }
}

/**
 * 处理PDF粘贴（base64编码）
 */
async function handlePdfPaste(
  client: any,
  base64Content: string,
  fileName: string,
  apiKey?: string,
  autoProcess?: boolean
) {
  try {
    // 将base64转为buffer
    const buffer = Buffer.from(base64Content, 'base64');
    
    // 上传到对象存储
    const timestamp = Date.now();
    const storageKey = `literature/${timestamp}_${fileName || 'pasted.pdf'}`;
    
    const key = await storage.uploadFile({
      fileContent: buffer,
      fileName: storageKey,
      contentType: 'application/pdf',
    });

    // 创建文献记录
    const { data: literature, error: createError } = await client
      .from('literature')
      .insert({
        title: fileName?.replace(/\.pdf$/i, '') || 'Pasted PDF',
        file_key: key,
        file_name: fileName || 'pasted.pdf',
        status: 'pending',
      })
      .select()
      .single();

    if (createError) throw createError;

    // 如果需要自动处理
    if (autoProcess && apiKey && literature) {
      // 异步触发处理
      const fileUrl = await storage.generatePresignedUrl({
        key,
        expireTime: 86400,
      });

      fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/literature/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          literatureId: literature.id,
          fileUrl,
          apiKey,
        }),
      }).catch(err => console.error('Auto process error:', err));
    }

    return NextResponse.json({
      success: true,
      data: {
        literatureId: literature.id,
        title: literature.title,
        message: 'PDF已成功导入',
      },
    });
  } catch (error) {
    console.error('PDF paste error:', error);
    return NextResponse.json({ error: 'PDF导入失败' }, { status: 500 });
  }
}

/**
 * 处理RIS格式粘贴（批量优化版）
 */
async function handleRisPaste(
  client: any,
  risContent: string,
  apiKey?: string,
  autoProcess?: boolean
) {
  try {
    // 使用增强版RIS解析器
    const records = parseRIS(risContent);
    
    if (records.length === 0) {
      return NextResponse.json({ error: '未识别到有效的文献记录' }, { status: 400 });
    }

    console.log(`[Paste Import] RIS: Parsed ${records.length} records`);

    // 批量准备插入数据
    const insertData = records.map(record => ({
      title: record.title || 'Untitled',
      authors: record.authors?.join(', ') || '',
      year: record.year,
      doi: record.doi || '',
      journal: record.journal || '',
      raw_content: JSON.stringify({
        title: record.title || 'Untitled',
        authors: record.authors?.join(', '),
        year: record.year,
        doi: record.doi,
        journal: record.journal,
        volume: record.volume,
        issue: record.issue,
        pages: record.pages,
        abstract: record.abstract,
        keywords: record.keywords,
      }),
      status: 'completed' as const,
    }));

    // 批量插入数据库
    const { data: insertedRecords, error: insertError } = await client
      .from('literature')
      .insert(insertData)
      .select();

    if (insertError) {
      console.error('[Paste Import] RIS batch insert error:', insertError);
      return NextResponse.json({ error: '数据库插入失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        total: records.length,
        imported: insertedRecords?.length || 0,
        records: insertedRecords || [],
      },
    });
  } catch (error) {
    console.error('RIS paste error:', error);
    return NextResponse.json({ error: 'RIS内容解析失败' }, { status: 500 });
  }
}

/**
 * 处理XML格式粘贴（批量优化版）
 */
async function handleXmlPaste(
  client: any,
  xmlContent: string,
  apiKey?: string,
  autoProcess?: boolean
) {
  try {
    // 使用增强版XML解析器
    const records = parseEndNoteXML(xmlContent);
    
    if (records.length === 0) {
      return NextResponse.json({ error: '未识别到有效的文献记录' }, { status: 400 });
    }

    console.log(`[Paste Import] XML: Parsed ${records.length} records`);

    // 批量准备插入数据
    const insertData = records.map(record => ({
      title: record.title || 'Untitled',
      authors: record.authors?.join(', ') || '',
      year: record.year,
      doi: record.doi || '',
      journal: record.journal || '',
      raw_content: JSON.stringify({
        title: record.title || 'Untitled',
        authors: record.authors?.join(', '),
        year: record.year,
        doi: record.doi,
        journal: record.journal,
        volume: record.volume,
        issue: record.issue,
        pages: record.pages,
        abstract: record.abstract,
        keywords: record.keywords,
      }),
      status: 'completed' as const,
    }));

    // 批量插入数据库
    const { data: insertedRecords, error: insertError } = await client
      .from('literature')
      .insert(insertData)
      .select();

    if (insertError) {
      console.error('[Paste Import] XML batch insert error:', insertError);
      return NextResponse.json({ error: '数据库插入失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        total: records.length,
        imported: insertedRecords?.length || 0,
        records: insertedRecords || [],
      },
    });
  } catch (error) {
    console.error('XML paste error:', error);
    return NextResponse.json({ error: 'XML内容解析失败' }, { status: 500 });
  }
}

/**
 * 自动检测内容格式
 */
async function handleAutoDetect(
  client: any,
  content: string,
  apiKey?: string,
  autoProcess?: boolean
) {
  // 检测是否为base64编码的PDF
  if (content.startsWith('JVBERi0') || content.startsWith('data:application/pdf')) {
    // 移除data URL前缀
    const base64 = content.replace(/^data:application\/pdf;base64,/, '');
    return handlePdfPaste(client, base64, 'auto_detected.pdf', apiKey, autoProcess);
  }

  // 检测是否为RIS格式
  if (content.includes('TY  -') || content.includes('TY  -')) {
    return handleRisPaste(client, content, apiKey, autoProcess);
  }

  // 检测是否为XML格式
  if (content.trim().startsWith('<?xml') || content.trim().startsWith('<xml>')) {
    return handleXmlPaste(client, content, apiKey, autoProcess);
  }

  // 尝试作为RIS解析
  if (content.includes('TI  -') || content.includes('AU  -') || content.includes('T1  -')) {
    return handleRisPaste(client, content, apiKey, autoProcess);
  }

  return NextResponse.json({ 
    error: '无法识别内容格式，请粘贴PDF文件、RIS格式或EndNote XML格式的文本' 
  }, { status: 400 });
}
