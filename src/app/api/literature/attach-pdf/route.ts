import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';

// 初始化存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

interface AttachResult {
  total: number;
  attached: number;
  notFound: number;
  failed: number;
  records: Array<{
    fileName: string;
    literatureId: string | null;
    title: string | null;
    status: 'attached' | 'not_found' | 'failed';
    message: string;
  }>;
}

/**
 * 从文件名中提取可能的标题或 DOI
 */
function extractSearchTerms(fileName: string): { title?: string; doi?: string } {
  // 移除扩展名
  let name = fileName.replace(/\.pdf$/i, '').replace(/\.docx?$/i, '');
  
  // 尝试提取 DOI
  const doiMatch = name.match(/10\.\d{4,}\/[^\s]+/i);
  if (doiMatch) {
    return { doi: doiMatch[0].replace(/[)\]>}.,;:]$/, '') };
  }
  
  // 清理文件名中的常见前缀和后缀
  name = name
    .replace(/^\d+[\.\-\s]+/, '') // 移除数字前缀，如 "1.", "2-", "3 "
    .replace(/[\._]/g, ' ') // 下划线和点转空格
    .replace(/\s+/g, ' ') // 多个空格合并
    .trim();
  
  return { title: name };
}

/**
 * 批量上传 PDF 并关联到已有文献
 * POST /api/literature/attach-pdf
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const literatureId = formData.get('literatureId') as string | null; // 可选：指定文献ID

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const result: AttachResult = {
      total: files.length,
      attached: 0,
      notFound: 0,
      failed: 0,
      records: [],
    };

    for (const file of files) {
      try {
        const fileName = file.name;
        console.log(`[Attach PDF] Processing: ${fileName}`);

        let targetLiterature = null;

        // 1. 如果指定了文献ID，直接使用
        if (literatureId) {
          const { data } = await client
            .from('literature')
            .select('*')
            .eq('id', literatureId)
            .single();
          targetLiterature = data;
        }
        
        // 2. 否则尝试从文件名匹配文献
        if (!targetLiterature) {
          const searchTerms = extractSearchTerms(fileName);
          
          if (searchTerms.doi) {
            // 通过 DOI 精确匹配
            const { data } = await client
              .from('literature')
              .select('*')
              .eq('doi', searchTerms.doi)
              .maybeSingle();
            targetLiterature = data;
          }
          
          if (!targetLiterature && searchTerms.title) {
            // 通过标题模糊匹配
            const { data } = await client
              .from('literature')
              .select('*')
              .ilike('title', `%${searchTerms.title.substring(0, 50)}%`)
              .is('file_key', null) // 优先匹配没有 PDF 的
              .limit(1);
            
            if (data && data.length > 0) {
              targetLiterature = data[0];
            }
          }
          
          // 如果还没找到，尝试匹配已有 PDF 的文献（覆盖更新）
          if (!targetLiterature && searchTerms.title) {
            const { data } = await client
              .from('literature')
              .select('*')
              .ilike('title', `%${searchTerms.title.substring(0, 50)}%`)
              .limit(1);
            
            if (data && data.length > 0) {
              targetLiterature = data[0];
            }
          }
        }

        if (!targetLiterature) {
          // 没有找到匹配的文献，创建新文献记录
          const searchTerms = extractSearchTerms(fileName);
          const { data: newLiterature, error: createError } = await client
            .from('literature')
            .insert({
              title: searchTerms.title || fileName.replace(/\.pdf$/i, ''),
              status: 'pending',
            })
            .select()
            .single();
          
          if (createError || !newLiterature) {
            result.notFound++;
            result.records.push({
              fileName,
              literatureId: null,
              title: null,
              status: 'not_found',
              message: '无法匹配到已有文献，且创建新文献失败',
            });
            continue;
          }
          
          targetLiterature = newLiterature;
        }

        // 上传 PDF 到对象存储
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const timestamp = Date.now();
        const storageKey = `literature/${timestamp}_${fileName}`;
        
        const key = await storage.uploadFile({
          fileContent: buffer,
          fileName: storageKey,
          contentType: file.type || 'application/pdf',
        });

        const fileUrl = await storage.generatePresignedUrl({
          key,
          expireTime: 86400 * 7,
        });

        // 更新文献记录
        const { error: updateError } = await client
          .from('literature')
          .update({
            file_key: key,
            file_name: fileName,
            status: 'pending', // 重置状态，等待处理
          })
          .eq('id', targetLiterature.id);

        if (updateError) {
          result.failed++;
          result.records.push({
            fileName,
            literatureId: targetLiterature.id,
            title: targetLiterature.title,
            status: 'failed',
            message: '更新文献记录失败',
          });
          continue;
        }

        result.attached++;
        result.records.push({
          fileName,
          literatureId: targetLiterature.id,
          title: targetLiterature.title,
          status: 'attached',
          message: targetLiterature.file_key 
            ? '已覆盖原有 PDF' 
            : '已关联到文献',
        });

      } catch (fileError) {
        console.error(`[Attach PDF] Error processing file:`, fileError);
        result.failed++;
        result.records.push({
          fileName: file.name,
          literatureId: null,
          title: null,
          status: 'failed',
          message: fileError instanceof Error ? fileError.message : '处理失败',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Attach PDF error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '关联失败' },
      { status: 500 }
    );
  }
}
