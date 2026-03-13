/**
 * PubMed检索API
 * 使用NCBI E-utilities API进行PubMed检索并获取结果
 */

import { NextRequest, NextResponse } from 'next/server';

const NCBI_API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  year: string;
  doi?: string;
  keywords: string[];
  meshTerms: string[];
}

/**
 * GET /api/literature/search/pubmed
 * 执行PubMed检索
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'search') {
      const query = searchParams.get('query');
      const maxResults = parseInt(searchParams.get('maxResults') || '100');
      const start = parseInt(searchParams.get('start') || '0');

      if (!query) {
        return NextResponse.json({ error: '请提供检索式' }, { status: 400 });
      }

      return await searchPubMed(query, maxResults, start);
    }

    if (action === 'fetch') {
      const pmids = searchParams.get('pmids');
      if (!pmids) {
        return NextResponse.json({ error: '请提供PMID列表' }, { status: 400 });
      }

      return await fetchArticleDetails(pmids.split(','));
    }

    if (action === 'translate') {
      // 将检索式转换为PubMed格式
      const query = searchParams.get('query');
      if (!query) {
        return NextResponse.json({ error: '请提供检索式' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        data: {
          original: query,
          pubmed: translateToPubMed(query),
          url: buildPubMedUrl(query),
        },
      });
    }

    return NextResponse.json({ error: '无效的action参数' }, { status: 400 });
  } catch (error) {
    console.error('PubMed search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '检索失败' },
      { status: 500 }
    );
  }
}

/**
 * 执行PubMed检索
 */
async function searchPubMed(query: string, maxResults: number, start: number) {
  console.log('[PubMed] Searching for:', query.substring(0, 100));

  // 第一步：搜索获取PMID列表
  const searchUrl = new URL(`${NCBI_API_BASE}/esearch.fcgi`);
  searchUrl.searchParams.set('db', 'pubmed');
  searchUrl.searchParams.set('term', query);
  searchUrl.searchParams.set('retmax', String(maxResults));
  searchUrl.searchParams.set('retstart', String(start));
  searchUrl.searchParams.set('retmode', 'json');
  searchUrl.searchParams.set('sort', 'relevance');

  const searchResponse = await fetch(searchUrl.toString(), {
    headers: {
      'User-Agent': 'MetaAnalysisSystem/1.0',
    },
  });

  if (!searchResponse.ok) {
    throw new Error(`PubMed搜索失败: ${searchResponse.status}`);
  }

  const searchData = await searchResponse.json();
  const pmids = searchData.esearchresult?.idlist || [];
  const totalCount = parseInt(searchData.esearchresult?.count || '0');

  console.log(`[PubMed] Found ${totalCount} results, fetching ${pmids.length} articles`);

  if (pmids.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        query,
        totalCount: 0,
        articles: [],
        hasMore: false,
      },
    });
  }

  // 第二步：获取文献详情
  const articlesResponse = await fetchArticleDetails(pmids);
  const articlesData = await articlesResponse.json();

  return NextResponse.json({
    success: true,
    data: {
      query,
      totalCount,
      articles: articlesData.data?.articles || [],
      start,
      hasMore: start + pmids.length < totalCount,
    },
  });
}

/**
 * 获取文献详情
 */
async function fetchArticleDetails(pmids: string[]) {
  if (pmids.length === 0) {
    return NextResponse.json({ success: true, data: { articles: [] } });
  }

  // 批量获取，每批最多200篇
  const batchSize = 200;
  const articles: PubMedArticle[] = [];

  for (let i = 0; i < pmids.length; i += batchSize) {
    const batch = pmids.slice(i, i + batchSize);

    const fetchUrl = new URL(`${NCBI_API_BASE}/efetch.fcgi`);
    fetchUrl.searchParams.set('db', 'pubmed');
    fetchUrl.searchParams.set('id', batch.join(','));
    fetchUrl.searchParams.set('retmode', 'xml');

    const fetchResponse = await fetch(fetchUrl.toString(), {
      headers: {
        'User-Agent': 'MetaAnalysisSystem/1.0',
      },
    });

    if (!fetchResponse.ok) {
      console.error(`[PubMed] Fetch failed for batch ${i}`);
      continue;
    }

    const xmlText = await fetchResponse.text();
    const batchArticles = parsePubMedXML(xmlText);
    articles.push(...batchArticles);

    // NCBI建议每秒不超过3个请求
    if (i + batchSize < pmids.length) {
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      articles,
      count: articles.length,
    },
  });
}

/**
 * 解析PubMed XML
 */
function parsePubMedXML(xml: string): PubMedArticle[] {
  const articles: PubMedArticle[] = [];

  // 简单的XML解析（实际项目应使用xml2js等库）
  const articleMatches = xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g);

  for (const match of articleMatches) {
    const articleXml = match[1];

    try {
      const pmid = extractValue(articleXml, '<PMID[^>]*>(.*?)</PMID>');
      const title = extractValue(articleXml, '<ArticleTitle[^>]*>(.*?)</ArticleTitle>');

      // 提取摘要
      let abstract = '';
      const abstractMatches = articleXml.matchAll(/<AbstractText[^>]*>(.*?)<\/AbstractText>/g);
      for (const absMatch of abstractMatches) {
        abstract += (abstract ? ' ' : '') + cleanXmlTags(absMatch[1]);
      }

      // 提取作者
      const authors: string[] = [];
      const authorMatches = articleXml.matchAll(/<Author[^>]*>[\s\S]*?<LastName[^>]*>(.*?)<\/LastName>[\s\S]*?<ForeName[^>]*>(.*?)<\/ForeName>[\s\S]*?<\/Author>/g);
      for (const authorMatch of authorMatches) {
        authors.push(`${cleanXmlTags(authorMatch[2])} ${cleanXmlTags(authorMatch[1])}`);
      }

      // 提取期刊和年份
      const journal = extractValue(articleXml, '<Journal[^>]*>[\s\S]*?<Title[^>]*>(.*?)</Title>');
      const year = extractValue(articleXml, '<PubDate[^>]*>[\s\S]*?<Year[^>]*>(.*?)</Year>') ||
                   extractValue(articleXml, '<MedlineDate[^>]*>(.*?)</MedlineDate>')?.substring(0, 4);

      // 提取DOI
      const doi = extractValue(articleXml, '<ArticleId IdType="doi"[^>]*>(.*?)</ArticleId>');

      // 提取关键词和MeSH词
      const keywords: string[] = [];
      const keywordMatches = articleXml.matchAll(/<Keyword[^>]*>(.*?)<\/Keyword>/g);
      for (const kwMatch of keywordMatches) {
        keywords.push(cleanXmlTags(kwMatch[1]));
      }

      const meshTerms: string[] = [];
      const meshMatches = articleXml.matchAll(/<DescriptorName[^>]*>(.*?)<\/DescriptorName>/g);
      for (const meshMatch of meshMatches) {
        meshTerms.push(cleanXmlTags(meshMatch[1]));
      }

      articles.push({
        pmid,
        title: cleanXmlTags(title),
        abstract: cleanXmlTags(abstract),
        authors,
        journal,
        year,
        doi,
        keywords,
        meshTerms,
      });
    } catch (err) {
      console.error('[PubMed] Parse error for article:', err);
    }
  }

  return articles;
}

/**
 * 提取XML标签值
 */
function extractValue(xml: string, pattern: string): string {
  const regex = new RegExp(pattern, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

/**
 * 清理XML标签
 */
function cleanXmlTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * 转换为PubMed格式
 */
function translateToPubMed(query: string): string {
  // 基本的检索式转换
  return query
    .replace(/\bAND\b/gi, ' AND ')
    .replace(/\bOR\b/gi, ' OR ')
    .replace(/\bNOT\b/gi, ' NOT ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 构建PubMed URL
 */
function buildPubMedUrl(query: string): string {
  const baseUrl = 'https://pubmed.ncbi.nlm.nih.gov/';
  const params = new URLSearchParams({
    term: query,
  });
  return `${baseUrl}?${params.toString()}`;
}
