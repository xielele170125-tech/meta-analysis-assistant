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
  pendingSelection: number;
  records: Array<{
    fileName: string;
    literatureId: string | null;
    title: string | null;
    status: 'attached' | 'not_found' | 'failed' | 'pending_selection';
    message: string;
    candidates?: Array<{ id: string; title: string; authors: string | null; year: number | null }>;
    fileData?: string; // base64 encoded file data for later upload
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
    const autoCreate = formData.get('autoCreate') !== 'false'; // 默认自动创建新文献

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const result: AttachResult = {
      total: files.length,
      attached: 0,
      notFound: 0,
      failed: 0,
      pendingSelection: 0,
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
              .select('id, title, authors, year')
              .eq('doi', searchTerms.doi)
              .maybeSingle();
            targetLiterature = data;
          }
          
          if (!targetLiterature && searchTerms.title) {
            // 通过标题模糊匹配，获取候选列表
            const { data: candidates } = await client
              .from('literature')
              .select('id, title, authors, year')
              .ilike('title', `%${searchTerms.title.substring(0, 50)}%`)
              .limit(5);
            
            if (candidates && candidates.length === 1) {
              // 只有一个候选，直接使用
              targetLiterature = candidates[0];
            } else if (candidates && candidates.length > 1) {
              // 多个候选，需要用户选择
              // 读取文件内容为 base64，以便稍后上传
              const arrayBuffer = await file.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              
              result.pendingSelection++;
              result.records.push({
                fileName,
                literatureId: null,
                title: null,
                status: 'pending_selection',
                message: `找到 ${candidates.length} 个可能的匹配，请手动选择`,
                candidates: candidates,
                fileData: base64,
              });
              continue;
            }
          }
        }

        if (!targetLiterature) {
          // 没有找到匹配的文献
          if (autoCreate) {
            // 自动创建新文献记录
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
          } else {
            // 不自动创建，返回待选择状态
            // 读取文件内容为 base64
            const arrayBuffer = await file.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            
            // 获取所有文献作为候选
            const { data: allLiterature } = await client
              .from('literature')
              .select('id, title, authors, year')
              .order('created_at', { ascending: false })
              .limit(50);
            
            result.pendingSelection++;
            result.records.push({
              fileName,
              literatureId: null,
              title: null,
              status: 'pending_selection',
              message: '未找到匹配文献，请手动选择或创建新文献',
              candidates: allLiterature || [],
              fileData: base64,
            });
            continue;
          }
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

/**
 * 确认关联 PDF 到指定文献（用于手动选择后）
 * POST /api/literature/attach-pdf/confirm
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { literatureId, fileName, fileData, createNew } = body;

    if (!fileData || !fileName) {
      return NextResponse.json({ error: '缺少文件数据' }, { status: 400 });
    }

    const client = getSupabaseClient();
    let targetId = literatureId;

    // 如果需要创建新文献
    if (createNew || !literatureId) {
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
        return NextResponse.json({ error: '创建新文献失败' }, { status: 500 });
      }
      
      targetId = newLiterature.id;
    }

    // 将 base64 转回 buffer
    const buffer = Buffer.from(fileData, 'base64');
    
    const timestamp = Date.now();
    const storageKey = `literature/${timestamp}_${fileName}`;
    
    const key = await storage.uploadFile({
      fileContent: buffer,
      fileName: storageKey,
      contentType: 'application/pdf',
    });

    // 更新文献记录
    const { data: updatedLiterature, error: updateError } = await client
      .from('literature')
      .update({
        file_key: key,
        file_name: fileName,
        status: 'pending',
      })
      .eq('id', targetId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: '更新文献记录失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        literatureId: targetId,
        title: updatedLiterature?.title,
        message: 'PDF关联成功',
      },
    });
  } catch (error) {
    console.error('Confirm attach PDF error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '关联失败' },
      { status: 500 }
    );
  }
}
