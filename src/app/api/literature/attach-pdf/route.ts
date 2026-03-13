import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { S3Storage } from 'coze-coding-dev-sdk';

// 动态导入 pdfjs-dist（webpack 配置已忽略 canvas 依赖）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

// 初始化存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

/**
 * 从PDF内容中提取元数据（DOI、标题、作者）
 */
async function extractPdfMetadata(buffer: Buffer): Promise<{
  doi?: string;
  title?: string;
  authors?: string[];
  abstract?: string;
}> {
  try {
    // 使用 pdfjs-dist 解析 PDF
    const loadingTask = (pdfjs as any).getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    
    const pdfDocument = await loadingTask.promise;
    
    // 只读取前3页
    const maxPages = Math.min(3, pdfDocument.numPages);
    let text = '';
    
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      text += pageText + '\n';
    }
    
    // 使用全部提取的文本（前3页），而不是只取第一行
    console.log('[PDF Metadata] Total text length:', text.length);
    
    const result: { doi?: string; title?: string; authors?: string[] } = {};
    
    // 1. 提取 DOI（支持多种格式）
    const doiPatterns = [
      /doi[:\s]*([10]\.\d{4,}\/[^\s\n\r]+)/i,
      /https?:\/\/(?:dx\.)?doi\.org\/([10]\.\d{4,}\/[^\s\n\r]+)/i,
      /\b(10\.\d{4,}\/[^\s\n\r]+)\b/i,
    ];
    
    for (const pattern of doiPatterns) {
      const match = text.match(pattern);
      if (match) {
        let doi = match[1].replace(/[)\]>}.,;:]+$/, ''); // 清理尾部标点
        console.log('[PDF Metadata] Found DOI:', doi);
        result.doi = doi;
        break;
      }
    }
    
    // 2. 提取标题和作者（从第一页的前面部分）
    const firstPageText = text.split('\n')[0] || text;
    const lines = firstPageText.split(/\s+/).filter((l: string) => l.trim().length > 5);
    
    // 标题通常在前几行
    if (lines.length > 0) {
      // 合并前几行作为可能的标题（PDF文本提取可能分行）
      let title = lines.slice(0, Math.min(3, lines.length)).join(' ');
      // 清理标题
      title = title.replace(/^\d+[\.\-\s]*/, '').trim();
      // 截取合理长度
      if (title.length > 20) {
        result.title = title.substring(0, 200);
        console.log('[PDF Metadata] Extracted title:', result.title.substring(0, 100));
      }
    }
    
    // 3. 提取作者（在标题后面，通常有特殊格式）
    const authors: string[] = [];
    const authorSection = text.substring(0, 3000); // 前3000字符
    
    // 常见作者格式匹配
    const authorPatterns = [
      // 带数字上标的作者列表
      /(?:Authors?[:\s]*|By\s+)([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s*[†¹²³⁴⁵*]?\s*,\s*[A-Z][a-z]+\s+[A-Z][a-z]+)*)/i,
      // 中文章节后的作者
      /(?:作者|Author)[：:\s]*([^\n]+)/,
    ];
    
    for (const pattern of authorPatterns) {
      const match = authorSection.match(pattern);
      if (match) {
        const authorStr = match[1]
          .replace(/[†¹²³⁴⁵*]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        const authorList = authorStr.split(/,|;|and|&/i)
          .map((a: string) => a.trim())
          .filter((a: string) => a.length > 2 && a.length < 50);
        if (authorList.length > 0) {
          authors.push(...authorList);
          break;
        }
      }
    }
    
    if (authors.length > 0) {
      result.authors = authors;
      console.log('[PDF Metadata] Extracted authors:', authors.slice(0, 3).join(', '));
    }
    
    return result;
  } catch (error) {
    console.error('[PDF Metadata] Extract error:', error);
    return {};
  }
}

/**
 * 计算两个字符串的相似度（0-1）
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;
  
  // 使用简单的词重叠率计算
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }
  
  const union = words1.size + words2.size - intersection;
  return intersection / union;
}

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

    // 获取所有文献，用于匹配（优先匹配没有PDF的文献）
    const { data: allLiterature } = await client
      .from('literature')
      .select('id, title, authors, year, doi, file_key')
      .order('created_at', { ascending: false });

    // 分离有无PDF的文献，优先匹配无PDF的
    const literatureWithoutPdf = allLiterature?.filter(lit => !lit.file_key) || [];
    const literatureWithPdf = allLiterature?.filter(lit => lit.file_key) || [];

    for (const file of files) {
      try {
        const fileName = file.name;
        console.log(`[Attach PDF] Processing: ${fileName}`);

        let targetLiterature = null;
        let pdfMetadata: { doi?: string; title?: string; authors?: string[] } = {};

        // 1. 如果指定了文献ID，直接使用
        if (literatureId) {
          const { data } = await client
            .from('literature')
            .select('*')
            .eq('id', literatureId)
            .single();
          targetLiterature = data;
        }
        
        // 2. 尝试从PDF内容提取元数据进行匹配
        if (!targetLiterature) {
          // 读取PDF内容
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // 提取PDF元数据
          pdfMetadata = await extractPdfMetadata(buffer);
          console.log(`[Attach PDF] Metadata for ${fileName}:`, JSON.stringify(pdfMetadata));
          
          // 优先在没有PDF的文献中匹配
          const matchPool = literatureWithoutPdf.length > 0 ? literatureWithoutPdf : literatureWithPdf;
          console.log(`[Attach PDF] Match pool size: ${matchPool.length} (without PDF: ${literatureWithoutPdf.length})`);
          
          // 2.1 优先用DOI精确匹配
          if (pdfMetadata.doi && matchPool.length > 0) {
            const doiLower = pdfMetadata.doi.toLowerCase();
            targetLiterature = matchPool.find(lit => 
              lit.doi && lit.doi.toLowerCase() === doiLower
            );
            if (targetLiterature) {
              console.log(`[Attach PDF] Matched by DOI: ${pdfMetadata.doi}`);
            }
          }
          
          // 2.2 用作者名匹配（至少一个作者名在文献作者字段中）
          if (!targetLiterature && pdfMetadata.authors && pdfMetadata.authors.length > 0 && matchPool.length > 0) {
            const candidates: Array<{ lit: any; score: number }> = [];
            
            for (const lit of matchPool) {
              if (!lit.authors) continue;
              const litAuthors = lit.authors.toLowerCase();
              let matchCount = 0;
              
              // 检查每个PDF作者是否在文献作者字段中
              for (const pdfAuthor of pdfMetadata.authors) {
                const lastName = pdfAuthor.split(/\s+/).pop()?.toLowerCase() || '';
                
                // 匹配姓氏（更可靠）
                if (lastName && lastName.length > 2 && litAuthors.includes(lastName)) {
                  matchCount++;
                }
              }
              
              if (matchCount > 0) {
                // 检查标题相似度作为辅助
                if (pdfMetadata.title && lit.title) {
                  const titleSimilarity = calculateSimilarity(pdfMetadata.title, lit.title);
                  candidates.push({ lit, score: matchCount * 10 + titleSimilarity * 5 });
                } else {
                  candidates.push({ lit, score: matchCount * 10 });
                }
              }
            }
            
            // 排序并选择最佳匹配
            candidates.sort((a, b) => b.score - a.score);
            console.log(`[Attach PDF] Author match candidates: ${candidates.length}`);
            
            if (candidates.length === 1 && candidates[0].score >= 10) {
              // 只有一个匹配，直接使用
              targetLiterature = candidates[0].lit;
              console.log(`[Attach PDF] Matched by authors: ${pdfMetadata.authors.join(', ')}`);
            } else if (candidates.length > 1) {
              // 多个候选，检查分数差距
              const topScore = candidates[0].score;
              const secondScore = candidates[1].score;
              
              if (topScore - secondScore >= 5) {
                // 分数差距足够大，使用最佳匹配
                targetLiterature = candidates[0].lit;
                console.log(`[Attach PDF] Matched by authors (best score): ${topScore}`);
              } else {
                // 分数接近，需要用户选择
                const base64 = buffer.toString('base64');
                result.pendingSelection++;
                result.records.push({
                  fileName,
                  literatureId: null,
                  title: pdfMetadata.title || null,
                  status: 'pending_selection',
                  message: `找到 ${candidates.length} 个可能的匹配（作者匹配），请手动选择`,
                  candidates: candidates.slice(0, 5).map(c => ({
                    id: c.lit.id,
                    title: c.lit.title,
                    authors: c.lit.authors,
                    year: c.lit.year,
                  })),
                  fileData: base64,
                });
                continue;
              }
            }
          }
          
          // 2.3 用标题匹配（降低阈值到0.3）
          if (!targetLiterature && pdfMetadata.title && matchPool.length > 0) {
            const candidates: Array<{ lit: any; score: number }> = [];
            
            for (const lit of matchPool) {
              if (!lit.title) continue;
              const similarity = calculateSimilarity(pdfMetadata.title, lit.title);
              if (similarity >= 0.3) { // 降低阈值
                candidates.push({ lit, score: similarity });
              }
            }
            
            candidates.sort((a, b) => b.score - a.score);
            console.log(`[Attach PDF] Title match candidates: ${candidates.length}, best score: ${candidates[0]?.score || 0}`);
            
            if (candidates.length === 1 && candidates[0].score >= 0.6) { // 降低阈值
              targetLiterature = candidates[0].lit;
              console.log(`[Attach PDF] Matched by title: ${pdfMetadata.title.substring(0, 50)}`);
            } else if (candidates.length > 1) {
              const topScore = candidates[0].score;
              const secondScore = candidates[1].score;
              
              if (topScore >= 0.7 && topScore - secondScore >= 0.1) { // 降低阈值
                targetLiterature = candidates[0].lit;
              } else {
                // 多候选，需要用户选择
                const base64 = buffer.toString('base64');
                result.pendingSelection++;
                result.records.push({
                  fileName,
                  literatureId: null,
                  title: pdfMetadata.title || null,
                  status: 'pending_selection',
                  message: `找到 ${candidates.length} 个可能的匹配（标题匹配），请手动选择`,
                  candidates: candidates.slice(0, 5).map(c => ({
                    id: c.lit.id,
                    title: c.lit.title,
                    authors: c.lit.authors,
                    year: c.lit.year,
                  })),
                  fileData: base64,
                });
                continue;
              }
            }
          }
          
          // 2.4 最后尝试从文件名匹配
          if (!targetLiterature) {
            const searchTerms = extractSearchTerms(fileName);
            console.log(`[Attach PDF] Search terms from filename:`, searchTerms);
            
            if (searchTerms.doi && matchPool.length > 0) {
              const doiLower = searchTerms.doi.toLowerCase();
              targetLiterature = matchPool.find(lit => 
                lit.doi && lit.doi.toLowerCase() === doiLower
              );
            }
            
            if (!targetLiterature && searchTerms.title && matchPool.length > 0) {
              // 使用更宽松的模糊匹配
              const searchTitle = searchTerms.title.substring(0, 50);
              const candidates = matchPool.filter(lit => 
                lit.title && lit.title.toLowerCase().includes(searchTitle.toLowerCase())
              );
              
              if (candidates.length === 1) {
                targetLiterature = candidates[0];
              } else if (candidates.length > 1) {
                const arrayBuffer2 = await file.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer2).toString('base64');
                
                result.pendingSelection++;
                result.records.push({
                  fileName,
                  literatureId: null,
                  title: null,
                  status: 'pending_selection',
                  message: `找到 ${candidates.length} 个可能的匹配，请手动选择`,
                  candidates: candidates.slice(0, 5),
                  fileData: base64,
                });
                continue;
              }
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
        // 注意：如果已经提取过元数据，buffer 已存在；否则需要重新读取
        let uploadBuffer: Buffer;
        if (literatureId && !pdfMetadata.doi && !pdfMetadata.title) {
          // 指定了文献ID但未提取PDF元数据的情况
          const arrayBuffer = await file.arrayBuffer();
          uploadBuffer = Buffer.from(arrayBuffer);
        } else {
          // 已经读取过buffer（用于元数据提取）
          uploadBuffer = Buffer.from(await file.arrayBuffer());
        }
        
        const timestamp = Date.now();
        const storageKey = `literature/${timestamp}_${fileName}`;
        
        const key = await storage.uploadFile({
          fileContent: uploadBuffer,
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
