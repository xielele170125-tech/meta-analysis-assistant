import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';

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
 * 处理RIS格式粘贴
 */
async function handleRisPaste(
  client: any,
  risContent: string,
  apiKey?: string,
  autoProcess?: boolean
) {
  try {
    // 解析RIS内容
    const records = parseRisContent(risContent);
    
    if (records.length === 0) {
      return NextResponse.json({ error: '未识别到有效的文献记录' }, { status: 400 });
    }

    const importedRecords = [];
    
    for (const record of records) {
      // 创建文献记录
      const { data: literature, error } = await client
        .from('literature')
        .insert({
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
          status: 'completed', // RIS导入的文献已有元数据，标记为完成
        })
        .select()
        .single();

      if (!error && literature) {
        importedRecords.push(literature);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total: records.length,
        imported: importedRecords.length,
        records: importedRecords,
      },
    });
  } catch (error) {
    console.error('RIS paste error:', error);
    return NextResponse.json({ error: 'RIS内容解析失败' }, { status: 500 });
  }
}

/**
 * 处理XML格式粘贴
 */
async function handleXmlPaste(
  client: any,
  xmlContent: string,
  apiKey?: string,
  autoProcess?: boolean
) {
  try {
    // 解析XML内容
    const records = parseXmlContent(xmlContent);
    
    if (records.length === 0) {
      return NextResponse.json({ error: '未识别到有效的文献记录' }, { status: 400 });
    }

    const importedRecords = [];
    
    for (const record of records) {
      const { data: literature, error } = await client
        .from('literature')
        .insert({
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
          status: 'completed',
        })
        .select()
        .single();

      if (!error && literature) {
        importedRecords.push(literature);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total: records.length,
        imported: importedRecords.length,
        records: importedRecords,
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

/**
 * 解析RIS格式内容
 */
function parseRisContent(content: string): Array<Record<string, any>> {
  const records: Array<Record<string, any>> = [];
  const lines = content.split(/\r?\n/);
  
  let currentRecord: Record<string, any> = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 检测记录开始
    if (trimmed.match(/^TY\s*-\s*/i)) {
      currentRecord = { type: 'JOUR' };
    }
    
    // 检测记录结束
    if (trimmed.match(/^ER\s*-\s*/i)) {
      if (currentRecord.title) {
        records.push(currentRecord);
      }
      currentRecord = {};
      continue;
    }

    // 解析字段
    const match = trimmed.match(/^([A-Z0-9]{2})\s*-\s*(.*)$/i);
    if (match && currentRecord.type) {
      const [, tag, value] = match;
      
      switch (tag.toUpperCase()) {
        case 'TI':
        case 'T1':
          currentRecord.title = value;
          break;
        case 'AU':
        case 'A1':
          if (!currentRecord.authors) currentRecord.authors = [];
          currentRecord.authors.push(value);
          break;
        case 'PY':
        case 'Y1':
          const yearMatch = value.match(/\d{4}/);
          if (yearMatch) currentRecord.year = parseInt(yearMatch[0]);
          break;
        case 'DO':
          currentRecord.doi = value;
          break;
        case 'JO':
        case 'JF':
        case 'T2':
          currentRecord.journal = value;
          break;
        case 'VL':
          currentRecord.volume = value;
          break;
        case 'IS':
          currentRecord.issue = value;
          break;
        case 'SP':
        case 'EP':
          if (!currentRecord.pages) {
            currentRecord.pages = value;
          } else {
            currentRecord.pages += '-' + value;
          }
          break;
        case 'AB':
        case 'N2':
          currentRecord.abstract = value;
          break;
        case 'KW':
          if (!currentRecord.keywords) currentRecord.keywords = [];
          currentRecord.keywords.push(value);
          break;
      }
    }
  }

  return records;
}

/**
 * 解析EndNote XML格式内容
 */
function parseXmlContent(content: string): Array<Record<string, any>> {
  const records: Array<Record<string, any>> = [];
  
  // 简单的XML解析（不依赖xml2js）
  const recordMatches = content.matchAll(/<record>([\s\S]*?)<\/record>/gi);
  
  for (const recordMatch of recordMatches) {
    const recordContent = recordMatch[1];
    const record: Record<string, any> = {};
    
    // 提取标题
    const titleMatch = recordContent.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
    if (titleMatch) record.title = titleMatch[1];
    
    // 提取作者
    const authorMatches = recordContent.matchAll(/<author>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/author>/gi);
    record.authors = [];
    for (const authorMatch of authorMatches) {
      record.authors.push(authorMatch[1]);
    }
    
    // 提取年份
    const yearMatch = recordContent.match(/<year>(\d{4})<\/year>/i);
    if (yearMatch) record.year = parseInt(yearMatch[1]);
    
    // 提取DOI
    const doiMatch = recordContent.match(/<doi>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/doi>/i);
    if (doiMatch) record.doi = doiMatch[1];
    
    // 提取期刊
    const journalMatch = recordContent.match(/<journal>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/journal>/i);
    if (journalMatch) record.journal = journalMatch[1];
    
    // 提取卷期页
    const volumeMatch = recordContent.match(/<volume>(.*?)<\/volume>/i);
    if (volumeMatch) record.volume = volumeMatch[1];
    
    const issueMatch = recordContent.match(/<issue>(.*?)<\/issue>/i);
    if (issueMatch) record.issue = issueMatch[1];
    
    const pagesMatch = recordContent.match(/<pages>(.*?)<\/pages>/i);
    if (pagesMatch) record.pages = pagesMatch[1];
    
    // 提取摘要
    const abstractMatch = recordContent.match(/<abstract>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/abstract>/i);
    if (abstractMatch) record.abstract = abstractMatch[1];
    
    // 提取关键词
    const keywordMatches = recordContent.matchAll(/<keyword>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/keyword>/gi);
    record.keywords = [];
    for (const kwMatch of keywordMatches) {
      record.keywords.push(kwMatch[1]);
    }
    
    if (record.title) {
      records.push(record);
    }
  }
  
  return records;
}
