import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import * as XLSX from 'xlsx';

// 标准Meta分析数据提取表模板
const EXTRACTION_TEMPLATE = {
  headers: [
    'Study ID',
    'First Author',
    'Year',
    'Journal',
    'Country',
    'Study Design',
    'Population',
    'Intervention',
    'Control',
    'Sample Size (I)',
    'Sample Size (C)',
    'Mean (I)',
    'SD (I)',
    'Mean (C)',
    'SD (C)',
    'Events (I)',
    'Events (C)',
    'Outcome Type',
    'Follow-up Period',
    'Quality Score',
    'Notes',
  ],
  descriptions: [
    '研究唯一标识符',
    '第一作者',
    '发表年份',
    '期刊名称',
    '研究国家',
    '研究设计类型',
    '研究人群描述',
    '干预组描述',
    '对照组描述',
    '干预组样本量',
    '对照组样本量',
    '干预组均值(连续变量)',
    '干预组标准差(连续变量)',
    '对照组均值(连续变量)',
    '对照组标准差(连续变量)',
    '干预组事件数(二分类变量)',
    '对照组事件数(二分类变量)',
    '结局类型(主要/次要)',
    '随访时间',
    '文献质量评分',
    '备注',
  ],
};

/**
 * 导出数据提取表为Excel
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('analysisId');
    const format = searchParams.get('format') || 'xlsx'; // xlsx 或 csv

    const client = getSupabaseClient();

    // 获取提取的数据
    let query = client
      .from('extracted_data')
      .select('*')
      .order('created_at', { ascending: true });

    // 如果指定了分析ID，只导出该分析包含的研究
    if (analysisId) {
      const { data: relations } = await client
        .from('analysis_data_relation')
        .select('extracted_data_id')
        .eq('meta_analysis_id', analysisId)
        .eq('included', true);

      if (relations && relations.length > 0) {
        const ids = relations.map((r) => r.extracted_data_id);
        query = query.in('id', ids);
      }
    }

    const { data: studies, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!studies || studies.length === 0) {
      return NextResponse.json({ error: '没有数据可导出' }, { status: 400 });
    }

    // 获取关联的文献信息
    const literatureIds = [...new Set(studies.map((s) => s.literature_id))];
    const { data: literature } = await client
      .from('literature')
      .select('*')
      .in('id', literatureIds);

    const literatureMap = new Map(
      (literature || []).map((l) => [l.id, l])
    );

    // 构建数据行
    const rows: Record<string, unknown>[] = [];

    // 添加说明行
    rows.push({
      'Study ID': '字段说明',
      'First Author': EXTRACTION_TEMPLATE.descriptions[1],
      'Year': EXTRACTION_TEMPLATE.descriptions[2],
      'Journal': EXTRACTION_TEMPLATE.descriptions[3],
      'Country': EXTRACTION_TEMPLATE.descriptions[4],
      'Study Design': EXTRACTION_TEMPLATE.descriptions[5],
      'Population': EXTRACTION_TEMPLATE.descriptions[6],
      'Intervention': EXTRACTION_TEMPLATE.descriptions[7],
      'Control': EXTRACTION_TEMPLATE.descriptions[8],
      'Sample Size (I)': EXTRACTION_TEMPLATE.descriptions[9],
      'Sample Size (C)': EXTRACTION_TEMPLATE.descriptions[10],
      'Mean (I)': EXTRACTION_TEMPLATE.descriptions[11],
      'SD (I)': EXTRACTION_TEMPLATE.descriptions[12],
      'Mean (C)': EXTRACTION_TEMPLATE.descriptions[13],
      'SD (C)': EXTRACTION_TEMPLATE.descriptions[14],
      'Events (I)': EXTRACTION_TEMPLATE.descriptions[15],
      'Events (C)': EXTRACTION_TEMPLATE.descriptions[16],
      'Outcome Type': EXTRACTION_TEMPLATE.descriptions[17],
      'Follow-up Period': EXTRACTION_TEMPLATE.descriptions[18],
      'Quality Score': EXTRACTION_TEMPLATE.descriptions[19],
      'Notes': EXTRACTION_TEMPLATE.descriptions[20],
    });

    // 空行
    rows.push({});

    // 添加数据行
    studies.forEach((study, index) => {
      const lit = literatureMap.get(study.literature_id);
      const authors = lit?.authors?.split(';') || [];
      const firstAuthor = authors[0]?.split(',').reverse().join(' ').trim() || 'Unknown';

      rows.push({
        'Study ID': `S${String(index + 1).padStart(2, '0')}`,
        'First Author': firstAuthor,
        'Year': lit?.year || '',
        'Journal': lit?.journal || '',
        'Country': '',
        'Study Design': '',
        'Population': '',
        'Intervention': '',
        'Control': '',
        'Sample Size (I)': study.sample_size_treatment || '',
        'Sample Size (C)': study.sample_size_control || '',
        'Mean (I)': study.mean_treatment || '',
        'SD (I)': study.sd_treatment || '',
        'Mean (C)': study.mean_control || '',
        'SD (C)': study.sd_control || '',
        'Events (I)': study.events_treatment || '',
        'Events (C)': study.events_control || '',
        'Outcome Type': study.outcome_type || '',
        'Follow-up Period': '',
        'Quality Score': '',
        'Notes': study.notes || '',
      });
    });

    if (format === 'csv') {
      // CSV格式
      const headers = EXTRACTION_TEMPLATE.headers;
      const csvRows = [
        headers.join(','),
        ...rows.map((row) =>
          headers.map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',')
        ),
      ];

      const csv = csvRows.join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="meta_analysis_data.csv"',
        },
      });
    }

    // Excel格式
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: EXTRACTION_TEMPLATE.headers,
    });

    // 设置列宽
    worksheet['!cols'] = [
      { wch: 10 }, // Study ID
      { wch: 15 }, // First Author
      { wch: 8 },  // Year
      { wch: 20 }, // Journal
      { wch: 12 }, // Country
      { wch: 15 }, // Study Design
      { wch: 20 }, // Population
      { wch: 20 }, // Intervention
      { wch: 20 }, // Control
      { wch: 12 }, // Sample Size (I)
      { wch: 12 }, // Sample Size (C)
      { wch: 10 }, // Mean (I)
      { wch: 10 }, // SD (I)
      { wch: 10 }, // Mean (C)
      { wch: 10 }, // SD (C)
      { wch: 10 }, // Events (I)
      { wch: 10 }, // Events (C)
      { wch: 15 }, // Outcome Type
      { wch: 12 }, // Follow-up Period
      { wch: 12 }, // Quality Score
      { wch: 30 }, // Notes
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Extraction');

    // 添加说明页
    const infoSheet = XLSX.utils.aoa_to_sheet([
      ['Meta分析数据提取表'],
      [''],
      ['导出时间', new Date().toLocaleString()],
      ['研究数量', studies.length],
      [''],
      ['使用说明'],
      ['1. 请根据字段说明填写缺失的数据'],
      ['2. 连续变量填写 Mean 和 SD'],
      ['3. 二分类变量填写 Events'],
      ['4. 此表可直接导入R语言进行Meta分析'],
    ]);
    XLSX.utils.book_append_sheet(workbook, infoSheet, 'Instructions');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="meta_analysis_data.xlsx"',
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
