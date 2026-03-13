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
    pdfSearchLinks?: Array<{ name: string; url: string }>;
  }>;
}

/**
 * 通过 Unpaywall API 获取开放获取 PDF 链接
 */
async function getPDFByUnpaywall(doi: string): Promise<{ url: string; source: string } | null> {
  try {
    const email = 'meta-analysis-research@academic-tool.org';
    const apiUrl = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${email}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Meta-Analysis-Tool/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    
    if (data.is_oa && data.best_oa_location?.url_for_pdf) {
      return { 
        url: data.best_oa_location.url_for_pdf, 
        source: 'unpaywall' 
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[Unpaywall] Error:`, error);
    return null;
  }
}

/**
 * 通过 Semantic Scholar API 获取 PDF 链接
 */
async function getPDFBySemanticScholar(doi: string): Promise<{ url: string; source: string } | null> {
  try {
    const apiUrl = `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=openAccessPdf`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Meta-Analysis-Tool/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    
    if (data.openAccessPdf?.url) {
      return { 
        url: data.openAccessPdf.url, 
        source: 'semantic_scholar' 
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[Semantic Scholar] Error:`, error);
    return null;
  }
}

/**
 * 通过 PubMed Central API 获取 PDF 链接
 */
async function getPDFByPMC(doi: string): Promise<{ url: string; source: string } | null> {
  try {
    // 先通过 DOI 查找 PMID
    const searchUrl = `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(doi)}&format=json`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const searchResponse = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Meta-Analysis-Tool/1.0' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json();
    const pmid = searchData.result?.uids?.[0];

    if (!pmid) return null;

    // 检查是否有 PMC 全文
    const pmcUrl = `https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi?id=${pmid}`;
    const pmcController = new AbortController();
    const pmcTimeoutId = setTimeout(() => pmcController.abort(), 15000);

    const pmcResponse = await fetch(pmcUrl, {
      headers: { 'User-Agent': 'Meta-Analysis-Tool/1.0' },
      signal: pmcController.signal,
    });

    clearTimeout(pmcTimeoutId);

    if (!pmcResponse.ok) return null;

    const pmcText = await pmcResponse.text();
    
    // 解析 XML 找到 PDF 链接
    const pdfMatch = pmcText.match(/<link[^>]*format="pdf"[^>]*href="([^"]+)"/i);
    if (pdfMatch) {
      return { 
        url: pdfMatch[1], 
        source: 'pmc' 
      };
    }

    return null;
  } catch (error) {
    console.error(`[PMC] Error:`, error);
    return null;
  }
}

/**
 * 通过 CORE API 获取 PDF 链接
 */
async function getPDFByCORE(doi: string): Promise<{ url: string; source: string } | null> {
  try {
    // CORE API 需要注册获取 API key，这里使用免费的搜索接口
    const searchUrl = `https://api.core.ac.uk/v3/search/works?q=doi:"${encodeURIComponent(doi)}"&limit=1`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(searchUrl, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Meta-Analysis-Tool/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    
    if (data.results?.[0]?.downloadUrl) {
      return { 
        url: data.results[0].downloadUrl, 
        source: 'core' 
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[CORE] Error:`, error);
    return null;
  }
}

/**
 * 通过 bioRxiv/medRxiv API 获取 PDF 链接
 */
async function getPDFByBiorxiv(doi: string): Promise<{ url: string; source: string } | null> {
  try {
    // 检查是否是 bioRxiv/medRxiv 的 DOI
    if (!doi.includes('biorxiv') && !doi.includes('medrxiv')) {
      return null;
    }
    
    const apiUrl = `https://api.biorxiv.org/details/biorxiv/${encodeURIComponent(doi)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl, {
      headers: { 
        'User-Agent': 'Meta-Analysis-Tool/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    
    if (data.collection && data.collection.length > 0) {
      const record = data.collection[0];
      // bioRxiv PDF URL 格式
      const pdfUrl = `https://www.biorxiv.org/content/${record.doi}v${record.version}.full.pdf`;
      return { url: pdfUrl, source: 'biorxiv' };
    }
    
    return null;
  } catch (error) {
    console.error(`[bioRxiv] Error:`, error);
    return null;
  }
}

/**
 * 通过 PubMed 获取 PMC PDF 链接（增强版）
 */
async function getPDFByPubMed(doi: string, pmid?: string): Promise<{ url: string; source: string } | null> {
  try {
    // 如果没有 PMID，先通过 DOI 查找
    if (!pmid) {
      const searchUrl = `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(doi)}&format=json`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const searchResponse = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Meta-Analysis-Tool/1.0' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!searchResponse.ok) return null;

      const searchData = await searchResponse.json();
      pmid = searchData.result?.uids?.[0];
    }

    if (!pmid) return null;

    // 通过 PMC ID 获取 PDF
    const pmcApiUrl = `https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi?id=${pmid}`;
    
    const pmcController = new AbortController();
    const pmcTimeoutId = setTimeout(() => pmcController.abort(), 15000);

    const pmcResponse = await fetch(pmcApiUrl, {
      headers: { 'User-Agent': 'Meta-Analysis-Tool/1.0' },
      signal: pmcController.signal,
    });

    clearTimeout(pmcTimeoutId);

    if (!pmcResponse.ok) return null;

    const pmcText = await pmcResponse.text();
    
    // 解析 XML 找到 PDF 链接
    const pdfMatch = pmcText.match(/<link[^>]*format="pdf"[^>]*href="([^"]+)"/i);
    if (pdfMatch) {
      return { url: pdfMatch[1], source: 'pmc' };
    }

    return null;
  } catch (error) {
    console.error(`[PubMed] Error:`, error);
    return null;
  }
}

/**
 * 综合多个来源获取 PDF
 * 按优先级依次尝试多个数据源
 */
async function getPDFByDOI(doi: string): Promise<{ url: string; source: string } | null> {
  console.log(`[PDF Download] Searching for DOI: ${doi}`);
  
  // 1. Unpaywall - 最全面的开放获取数据库
  const unpaywallResult = await getPDFByUnpaywall(doi);
  if (unpaywallResult) {
    console.log(`[PDF Download] Found via Unpaywall`);
    return unpaywallResult;
  }
  
  // 2. Semantic Scholar - 学术搜索引擎
  const ssResult = await getPDFBySemanticScholar(doi);
  if (ssResult) {
    console.log(`[PDF Download] Found via Semantic Scholar`);
    return ssResult;
  }
  
  // 3. bioRxiv/medRxiv - 预印本服务器
  const biorxivResult = await getPDFByBiorxiv(doi);
  if (biorxivResult) {
    console.log(`[PDF Download] Found via bioRxiv/medRxiv`);
    return biorxivResult;
  }
  
  // 4. PubMed Central - 生物医学文献
  const pmcResult = await getPDFByPubMed(doi);
  if (pmcResult) {
    console.log(`[PDF Download] Found via PMC`);
    return pmcResult;
  }
  
  // 5. CORE - 开放获取论文聚合
  const coreResult = await getPDFByCORE(doi);
  if (coreResult) {
    console.log(`[PDF Download] Found via CORE`);
    return coreResult;
  }
  
  console.log(`[PDF Download] No PDF found from any source`);
  return null;
}

/**
 * 生成 PDF 搜索链接（供用户手动查找）
 */
function generatePDFSearchLinks(title: string, doi: string | null): Array<{ name: string; url: string }> {
  const links: Array<{ name: string; url: string }> = [];
  
  const encodedTitle = encodeURIComponent(title);
  
  // 谷歌学术
  links.push({
    name: '谷歌学术',
    url: `https://scholar.google.com/scholar?q=${encodedTitle}`,
  });
  
  // PubMed
  links.push({
    name: 'PubMed',
    url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodedTitle}`,
  });
  
  // 如果有 DOI
  if (doi) {
    // DOI 直接解析
    links.push({
      name: 'DOI解析',
      url: `https://doi.org/${doi}`,
    });
    
    // Sci-Hub（注意：这可能涉及版权问题，仅供个人研究使用）
    links.push({
      name: 'Sci-Hub',
      url: `https://sci-hub.se/${doi}`,
    });
  }
  
  // ResearchGate
  links.push({
    name: 'ResearchGate',
    url: `https://www.researchgate.net/search?q=${encodedTitle}`,
  });
  
  // bioRxiv/medRxiv 搜索
  links.push({
    name: 'bioRxiv',
    url: `https://www.biorxiv.org/search/${encodedTitle}`,
  });
  
  return links;
}

/**
 * 下载 PDF 并上传到对象存储
 */
async function downloadAndUploadPDF(pdfUrl: string, doi: string): Promise<{ key: string; url: string } | null> {
  try {
    console.log(`[PDF Download] Downloading from: ${pdfUrl}`);
    
    const response = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Meta-Analysis-Tool/1.0)',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.log(`[PDF Download] Download failed: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    console.log(`[PDF Download] Content-Type: ${contentType}`);
    
    // 检查是否为 PDF
    if (!contentType.includes('pdf') && !contentType.includes('octet-stream') && !pdfUrl.toLowerCase().endsWith('.pdf')) {
      console.log(`[PDF Download] Not a PDF file, skipping`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`[PDF Download] Downloaded ${arrayBuffer.byteLength} bytes`);
    
    if (arrayBuffer.byteLength < 1000) {
      console.log(`[PDF Download] File too small, likely not a valid PDF`);
      return null;
    }
    
    const buffer = Buffer.from(arrayBuffer);

    // 生成文件名
    const safeDoi = doi.replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = `literature/${safeDoi}.pdf`;

    // 上传到对象存储
    console.log(`[PDF Download] Uploading to storage: ${fileName}`);
    const key = await storage.uploadFile({
      fileContent: buffer,
      fileName,
      contentType: 'application/pdf',
    });
    
    console.log(`[PDF Download] Upload successful, key: ${key}`);

    // 生成访问 URL
    const url = await storage.generatePresignedUrl({
      key,
      expireTime: 86400 * 7, // 7天
    });

    return { key, url };
  } catch (error) {
    console.error(`[PDF Download] Error downloading/uploading:`, error);
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
        let pdfMessage = '';

        // 尝试通过 DOI 获取 PDF
        if (autoDownloadPdf && record.doi) {
          const pdfResult = await getPDFByDOI(record.doi);
          if (pdfResult) {
            console.log(`[Import] Found PDF for "${record.title}" via ${pdfResult.source}`);
            const uploadResult = await downloadAndUploadPDF(pdfResult.url, record.doi);
            if (uploadResult) {
              fileKey = uploadResult.key;
              fileUrl = uploadResult.url;
              pdfDownloaded = true;
              result.withPdf++;
              pdfMessage = `已自动下载 PDF (来源: ${pdfResult.source})`;
            } else {
              pdfMessage = '找到 PDF 链接但下载失败，请手动下载';
              console.log(`[Import] PDF download failed for ${record.doi}`);
            }
          } else {
            pdfMessage = '该文献无开放获取 PDF，请手动获取';
          }
        } else if (!record.doi) {
          pdfMessage = '无 DOI 信息，无法自动下载，请手动获取';
        } else if (!autoDownloadPdf) {
          pdfMessage = '已导入，可手动上传 PDF';
        }

        // 生成 PDF 搜索链接（当无法自动下载时）
        const pdfSearchLinks = !pdfDownloaded ? generatePDFSearchLinks(record.title || '', record.doi || null) : undefined;

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
            pdfSearchLinks,
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
            ? pdfMessage || '已导入并下载 PDF'
            : pdfMessage || '已导入，点击搜索链接获取 PDF',
          literatureId: literature.id,
          pdfSearchLinks,
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
