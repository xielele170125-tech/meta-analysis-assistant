import { NextRequest, NextResponse } from 'next/server';

interface UnpaywallResponse {
  doi: string;
  year?: number;
  title?: string;
  journal_name?: string;
  is_oa: boolean;
  oa_status?: string;
  best_oa_location?: {
    endpoint_id?: string;
    evidence?: string;
    host_type?: string;
    is_best?: boolean;
    license?: string;
    pmh_id?: string;
    repository_institution?: string;
    updated_date?: string;
    url?: string;
    url_for_landing_page?: string;
    url_for_pdf?: string;
    version?: string;
  };
}

/**
 * 通过 DOI 获取开放获取 PDF 链接
 * 使用 Unpaywall API (免费)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const doi = searchParams.get('doi');

    if (!doi) {
      return NextResponse.json({ error: '请提供 DOI' }, { status: 400 });
    }

    // 清理 DOI
    const cleanDoi = doi.trim().replace(/^doi:/i, '').replace(/^https?:\/\/doi\.org\//i, '');

    // 使用 Unpaywall API
    const email = 'meta-analysis-tool@example.com';
    const unpaywallUrl = `https://api.unpaywall.org/v2/${encodeURIComponent(cleanDoi)}?email=${email}`;

    const response = await fetch(unpaywallUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({
          success: false,
          error: '未找到该 DOI 对应的文献',
        });
      }
      throw new Error(`Unpaywall API 错误: ${response.status}`);
    }

    const data: UnpaywallResponse = await response.json();

    // 提取 PDF 链接
    const pdfUrl = data.best_oa_location?.url_for_pdf || data.best_oa_location?.url;
    const landingPageUrl = data.best_oa_location?.url_for_landing_page;

    if (!data.is_oa || !pdfUrl) {
      return NextResponse.json({
        success: false,
        isOa: false,
        data: {
          doi: cleanDoi,
          title: data.title,
          journal: data.journal_name,
          year: data.year,
          oaStatus: data.oa_status,
          landingPageUrl: landingPageUrl,
          message: '该文献暂无开放获取版本',
        },
      });
    }

    return NextResponse.json({
      success: true,
      isOa: true,
      data: {
        doi: cleanDoi,
        title: data.title,
        journal: data.journal_name,
        year: data.year,
        pdfUrl: pdfUrl,
        oaStatus: data.oa_status,
        evidence: data.best_oa_location?.evidence,
        license: data.best_oa_location?.license,
        hostType: data.best_oa_location?.host_type, // 'publisher' 或 'repository'
      },
    });
  } catch (error) {
    console.error('DOI lookup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}
