import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { parseRIS, parseEndNoteXML, RISRecord } from '@/lib/ris-parser';
import { S3Storage } from 'coze-coding-dev-sdk';

// 初始化存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

interface ImportResult {
  total: number;
  imported: number;
  withPdf: number;
  withoutPdf: number;
  failed: number;
  records: Array<{
    title: string;
    doi: string | null;
    status: 'imported' | 'no_pdf' | 'failed';
    message: string;
    literatureId?: string;
  }>;
}

/**
 * 通过 DOI 获取开放获取 PDF 链接
 */
async function getPDFByDOI(doi: string): Promise<string | null> {
  try {
    const email = 'meta-analysis-tool@example.com';
    const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${email}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.best_oa_location?.url_for_pdf || data.best_oa_location?.url || null;
  } catch {
    return null;
  }
}

/**
 * 下载 PDF 并上传到对象存储
 */
async function downloadAndUploadPDF(pdfUrl: string, doi: string): Promise<{ key: string; url: string } | null> {
  try {
    const response = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Meta-Analysis-Tool/1.0)',
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'application/pdf';
    
    // 检查是否为 PDF
    if (!contentType.includes('pdf') && !pdfUrl.toLowerCase().endsWith('.pdf')) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 生成文件名
    const safeDoi = doi.replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = `literature/${safeDoi}.pdf`;

    // 上传到对象存储
    const key = await storage.uploadFile({
      fileContent: buffer,
      fileName,
      contentType: 'application/pdf',
    });

    // 生成访问 URL
    const url = await storage.generatePresignedUrl({
      key,
      expireTime: 86400 * 7, // 7天
    });

    return { key, url };
  } catch (error) {
    console.error('Download PDF error:', error);
    return null;
  }
}

/**
 * 批量导入文献
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const autoDownloadPdf = formData.get('autoDownloadPdf') === 'true';

    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }

    // 读取文件内容
    const content = await file.text();

    // 解析文件
    let records: RISRecord[] = [];
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.ris') || fileName.endsWith('.txt')) {
      records = parseRIS(content);
    } else if (fileName.endsWith('.xml')) {
      records = parseEndNoteXML(content);
    } else {
      return NextResponse.json(
        { error: '不支持的文件格式，请上传 .ris、.txt 或 .xml 文件' },
        { status: 400 }
      );
    }

    console.log(`[Import] Parsed ${records.length} records`);

    if (records.length === 0) {
      return NextResponse.json({ 
        error: '未能从文件中解析出文献记录。请确保文件格式正确：RIS文件应以"TY -"开头，XML文件应包含<record>标签。' 
      }, { status: 400 });
    }

    const client = getSupabaseClient();
    const result: ImportResult = {
      total: records.length,
      imported: 0,
      withPdf: 0,
      withoutPdf: 0,
      failed: 0,
      records: [],
    };

    // 处理每条记录
    for (const record of records) {
      try {
        let fileKey: string | null = null;
        let fileUrl: string | null = null;
        let pdfDownloaded = false;

        // 尝试通过 DOI 获取 PDF
        if (autoDownloadPdf && record.doi) {
          const pdfUrl = await getPDFByDOI(record.doi);
          if (pdfUrl) {
            const uploadResult = await downloadAndUploadPDF(pdfUrl, record.doi);
            if (uploadResult) {
              fileKey = uploadResult.key;
              fileUrl = uploadResult.url;
              pdfDownloaded = true;
              result.withPdf++;
            }
          }
        }

        // 创建文献记录
        const { data: literature, error } = await client
          .from('literature')
          .insert({
            title: record.title || '未命名文献',
            authors: record.authors.join('; '),
            year: record.year,
            journal: record.journal,
            doi: record.doi,
            file_key: fileKey,
            file_name: fileKey ? `${record.doi || record.title}.pdf` : null,
            status: pdfDownloaded ? 'pending' : 'pending',
          })
          .select()
          .single();

        if (error) {
          result.failed++;
          result.records.push({
            title: record.title || '未命名文献',
            doi: record.doi || null,
            status: 'failed',
            message: error.message,
          });
          continue;
        }

        if (!pdfDownloaded) {
          result.withoutPdf++;
        }

        result.imported++;
        result.records.push({
          title: record.title || '未命名文献',
          doi: record.doi || null,
          status: pdfDownloaded ? 'imported' : 'no_pdf',
          message: pdfDownloaded
            ? '已导入并下载 PDF'
            : record.doi
            ? '已导入，但未找到开放获取 PDF'
            : '已导入，需要手动上传 PDF',
          literatureId: literature.id,
        });
      } catch (recordError) {
        result.failed++;
        result.records.push({
          title: record.title || '未命名文献',
          doi: record.doi || null,
          status: 'failed',
          message: recordError instanceof Error ? recordError.message : '处理失败',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导入失败' },
      { status: 500 }
    );
  }
}
