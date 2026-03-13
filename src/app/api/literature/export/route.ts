import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const client = getSupabaseClient();

/**
 * 从 raw_content 提取 abstract 和 keywords
 */
function extractFromRawContent(rawContent: string | null): { abstract: string; keywords: string[] } {
  if (!rawContent) {
    return { abstract: '', keywords: [] };
  }
  
  try {
    const parsed = JSON.parse(rawContent);
    const abstract = parsed.abstract || '';
    const keywords = Array.isArray(parsed.keywords) 
      ? parsed.keywords 
      : (parsed.keywords ? parsed.keywords.split(/[,;]/) : []);
    return { abstract, keywords };
  } catch {
    // 如果不是 JSON，可能是纯文本摘要
    return { abstract: rawContent.substring(0, 5000), keywords: [] };
  }
}

/**
 * 导出文献为 EndNote (RIS) 格式
 * GET /api/literature/export
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'ris'; // ris 或 xml
    const literatureIds = searchParams.get('ids')?.split(',') || [];
    const dimensionId = searchParams.get('dimensionId');
    const category = searchParams.get('category');

    // 构建查询（使用 raw_content 替代 abstract/keywords）
    let query = client
      .from('literature')
      .select('id, title, authors, year, doi, journal, volume, issue, pages, raw_content');

    // 按ID筛选
    if (literatureIds.length > 0) {
      query = query.in('id', literatureIds);
    }

    // 按分类筛选
    if (dimensionId && category) {
      const { data: classifications, error: classError } = await client
        .from('literature_classifications')
        .select('literature_id')
        .eq('dimension_id', dimensionId)
        .eq('category', category);

      if (classError) throw classError;

      const classifiedIds = (classifications || []).map((c) => c.literature_id);
      if (classifiedIds.length > 0) {
        query = query.in('id', classifiedIds);
      } else {
        // 没有匹配的分类结果，返回空
        return new NextResponse(format === 'xml' ? getEmptyXml() : '', {
          headers: {
            'Content-Type': format === 'xml' ? 'application/xml' : 'application/x-research-info-systems',
            'Content-Disposition': `attachment; filename="literature_export.${format}"`,
          },
        });
      }
    }

    const { data: literature, error } = await query;

    if (error) throw error;

    // 根据格式生成导出内容
    let content: string;
    let contentType: string;
    let filename: string;

    if (format === 'xml') {
      content = generateXml(literature || []);
      contentType = 'application/xml';
      filename = 'literature_export.xml';
    } else {
      content = generateRis(literature || []);
      contentType = 'application/x-research-info-systems';
      filename = 'literature_export.ris';
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导出失败' },
      { status: 500 }
    );
  }
}

/**
 * 生成 RIS 格式
 */
function generateRis(literature: any[]): string {
  const risEntries = literature.map((lit) => {
    // 从 raw_content 提取摘要和关键词
    const { abstract, keywords } = extractFromRawContent(lit.raw_content);
    
    const lines: string[] = [];

    // 类型
    lines.push('TY  - JOUR');

    // 标题
    if (lit.title) {
      lines.push(`TI  - ${lit.title}`);
      lines.push(`T1  - ${lit.title}`);
    }

    // 作者
    if (lit.authors) {
      const authorList = lit.authors.split(/[,;]|\s+and\s+/i);
      authorList.forEach((author: string) => {
        const trimmed = author.trim();
        if (trimmed) {
          lines.push(`AU  - ${trimmed}`);
        }
      });
    }

    // 年份
    if (lit.year) {
      lines.push(`PY  - ${lit.year}`);
      lines.push(`Y1  - ${lit.year}`);
    }

    // 期刊
    if (lit.journal) {
      lines.push(`JO  - ${lit.journal}`);
      lines.push(`JF  - ${lit.journal}`);
    }

    // 卷
    if (lit.volume) {
      lines.push(`VL  - ${lit.volume}`);
    }

    // 期
    if (lit.issue) {
      lines.push(`IS  - ${lit.issue}`);
    }

    // 页码
    if (lit.pages) {
      lines.push(`SP  - ${lit.pages}`);
    }

    // DOI
    if (lit.doi) {
      lines.push(`DO  - ${lit.doi}`);
    }

    // 摘要
    if (abstract) {
      lines.push(`AB  - ${abstract.substring(0, 5000)}`);
    }

    // 关键词
    if (keywords && keywords.length > 0) {
      keywords.forEach((kw: string) => {
        const trimmed = kw.trim();
        if (trimmed) {
          lines.push(`KW  - ${trimmed}`);
        }
      });
    }

    // 结束标记
    lines.push('ER  - ');

    return lines.join('\n');
  });

  return risEntries.join('\n\n');
}

/**
 * 生成 XML 格式（EndNote XML）
 */
function generateXml(literature: any[]): string {
  const xmlRecords = literature.map((lit) => {
    // 从 raw_content 提取摘要和关键词
    const { abstract, keywords } = extractFromRawContent(lit.raw_content);
    
    const authorsXml = lit.authors
      ? lit.authors
          .split(/[,;]|\s+and\s+/i)
          .filter((a: string) => a.trim())
          .map((author: string) => `    <author>${escapeXml(author.trim())}</author>`)
          .join('\n')
      : '';

    const keywordsXml = keywords && keywords.length > 0
      ? keywords
          .filter((kw: string) => kw.trim())
          .map((kw: string) => `    <keyword>${escapeXml(kw.trim())}</keyword>`)
          .join('\n')
      : '';

    return `  <record>
    <rec-type>Journal Article</rec-type>
    <title>${escapeXml(lit.title || '')}</title>
${authorsXml}
    <year>${lit.year || ''}</year>
    <journal>${escapeXml(lit.journal || '')}</journal>
    <volume>${lit.volume || ''}</volume>
    <issue>${lit.issue || ''}</issue>
    <pages>${lit.pages || ''}</pages>
    <doi>${escapeXml(lit.doi || '')}</doi>
    <abstract>${escapeXml(abstract.substring(0, 5000) || '')}</abstract>
${keywordsXml}
  </record>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<xml>
${xmlRecords.join('\n')}
</xml>`;
}

/**
 * 空 XML 模板
 */
function getEmptyXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xml>
</xml>`;
}

/**
 * XML 转义
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
