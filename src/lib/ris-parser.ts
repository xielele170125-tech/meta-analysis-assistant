// RIS 文件解析器

export interface RISRecord {
  type: string;           // TY - 文献类型
  title: string;          // TI - 标题
  authors: string[];      // AU - 作者
  year: number | null;    // PY - 出版年份
  journal: string;        // JO/JF/T2 - 期刊名
  volume: string;         // VL - 卷
  issue: string;          // IS - 期
  pages: string;          // SP/EP - 页码
  doi: string;            // DO - DOI
  url: string;            // UR - URL
  abstract: string;       // AB - 摘要
  keywords: string[];     // KW - 关键词
  issn: string;           // SN - ISSN
  publisher: string;      // PB - 出版社
  notes: string;          // N1/N2 - 备注
}

// RIS 字段映射
const RIS_FIELD_MAP: Record<string, keyof RISRecord> = {
  'TY': 'type',
  'TI': 'title',
  'T1': 'title',
  'AU': 'authors',
  'A1': 'authors',
  'PY': 'year',
  'Y1': 'year',
  'JO': 'journal',
  'JF': 'journal',
  'T2': 'journal',
  'VL': 'volume',
  'IS': 'issue',
  'SP': 'pages',
  'EP': 'pages',
  'DO': 'doi',
  'UR': 'url',
  'AB': 'abstract',
  'KW': 'keywords',
  'SN': 'issn',
  'PB': 'publisher',
  'N1': 'notes',
  'N2': 'notes',
};

/**
 * 解析单个 RIS 记录
 */
function parseSingleRecord(lines: string[]): RISRecord {
  const record: RISRecord = {
    type: '',
    title: '',
    authors: [],
    year: null,
    journal: '',
    volume: '',
    issue: '',
    pages: '',
    doi: '',
    url: '',
    abstract: '',
    keywords: [],
    issn: '',
    publisher: '',
    notes: '',
  };

  let currentPage = '';

  for (const line of lines) {
    // 跳过空行
    if (!line.trim()) continue;

    // 解析字段: 支持多种格式
    // "XX  - value" (两个空格)
    // "XX - value" (一个空格)
    // "XX- value" (无空格)
    // "XX -value" (空格后无空格)
    // 注意: 正则中 (.*) 后面的空格需要在后面 trim
    const match = line.match(/^([A-Z0-9]{2})\s*-\s*(.*)$/i);
    if (!match) continue;

    const [, fieldCode, value] = match;
    const trimmedValue = value.trim();
    const field = RIS_FIELD_MAP[fieldCode.toUpperCase()];

    if (!field) continue;

    switch (field) {
      case 'authors':
      case 'keywords':
        (record[field] as string[]).push(trimmedValue);
        break;
      case 'year':
        // 提取年份（可能是 "2023" 或 "2023/12/31" 格式）
        const yearMatch = trimmedValue.match(/(\d{4})/);
        if (yearMatch) {
          record.year = parseInt(yearMatch[1], 10);
        }
        break;
      case 'pages':
        // SP 是起始页，EP 是结束页
        if (fieldCode.toUpperCase() === 'SP') {
          currentPage = trimmedValue;
        } else if (fieldCode.toUpperCase() === 'EP') {
          record.pages = currentPage ? `${currentPage}-${trimmedValue}` : trimmedValue;
        } else {
          record.pages = trimmedValue;
        }
        break;
      default:
        // 如果字段已有值且非空，追加（处理多行字段如摘要）
        const existingValue = record[field] as string;
        if (existingValue && existingValue.trim()) {
          (record as unknown as Record<string, unknown>)[field] = existingValue + ' ' + trimmedValue;
        } else {
          (record as unknown as Record<string, unknown>)[field] = trimmedValue;
        }
    }
  }

  return record;
}

/**
 * 解析 RIS 文件内容
 */
export function parseRIS(content: string): RISRecord[] {
  const records: RISRecord[] = [];
  
  // 统一换行符
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n');
  let currentRecord: string[] = [];
  let hasTy = false; // 是否遇到了 TY 字段

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 检测 TY 字段（记录开始）
    if (/^TY\s*-?\s*/i.test(trimmedLine)) {
      // 如果当前有记录，先保存
      if (currentRecord.length > 0 && hasTy) {
        records.push(parseSingleRecord(currentRecord));
      }
      currentRecord = [line];
      hasTy = true;
      continue;
    }
    
    // ER 标记记录结束
    if (/^ER\s*-?\s*$/i.test(trimmedLine)) {
      if (currentRecord.length > 0 && hasTy) {
        records.push(parseSingleRecord(currentRecord));
        currentRecord = [];
        hasTy = false;
      }
      continue;
    }

    // 添加到当前记录
    if (hasTy) {
      currentRecord.push(line);
    }
  }

  // 处理最后一条记录（如果没有 ER 结束标记）
  if (currentRecord.length > 0 && hasTy) {
    const record = parseSingleRecord(currentRecord);
    if (record.title || record.doi) {
      records.push(record);
    }
  }

  console.log(`[RIS Parser] Parsed ${records.length} records from ${lines.length} lines`);
  
  return records;
}

/**
 * 解析 EndNote XML 文件
 * 简化版，只提取基本信息
 */
export function parseEndNoteXML(content: string): RISRecord[] {
  const records: RISRecord[] = [];

  // 使用正则提取记录（避免引入 XML 解析库）
  const recordMatches = content.matchAll(/<record>([\s\S]*?)<\/record>/gi);

  for (const recordMatch of recordMatches) {
    const recordContent = recordMatch[1];

    const extractField = (tag: string): string => {
      const match = recordContent.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([^\\]]*)\\]\\]><\\/${tag}>`, 'i'))
        || recordContent.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
      return match ? match[1].trim() : '';
    };

    const extractYear = (): number | null => {
      const yearStr = extractField('year') || extractField('dates');
      const match = yearStr.match(/(\d{4})/);
      return match ? parseInt(match[1], 10) : null;
    };

    const extractAuthors = (): string[] => {
      const authors: string[] = [];
      const authorMatches = recordContent.matchAll(/<author[^>]*>([\s\S]*?)<\/author>/gi);
      for (const m of authorMatches) {
        const name = m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        if (name) authors.push(name);
      }
      return authors;
    };

    const record: RISRecord = {
      type: extractField('ref-type') || 'JOUR',
      title: extractField('title'),
      authors: extractAuthors(),
      year: extractYear(),
      journal: extractField('periodical') || extractField('journal'),
      volume: extractField('volume'),
      issue: extractField('issue'),
      pages: extractField('pages'),
      doi: extractField('doi') || extractField('electronic-resource-num'),
      url: extractField('urls') || extractField('web-urls'),
      abstract: extractField('abstract'),
      keywords: extractField('keywords').split(';').map(k => k.trim()).filter(Boolean),
      issn: extractField('isbn') || extractField('issn'),
      publisher: extractField('publisher'),
      notes: extractField('notes'),
    };

    if (record.title || record.doi) {
      records.push(record);
    }
  }

  console.log(`[XML Parser] Parsed ${records.length} records`);
  
  return records;
}

/**
 * 格式化文献记录用于显示
 */
export function formatRecordForDisplay(record: RISRecord): string {
  const parts: string[] = [];

  if (record.title) parts.push(record.title);
  if (record.authors.length > 0) parts.push(record.authors.slice(0, 3).join(', ') + (record.authors.length > 3 ? ' et al.' : ''));
  if (record.year) parts.push(`(${record.year})`);
  if (record.journal) parts.push(record.journal);
  if (record.doi) parts.push(`DOI: ${record.doi}`);

  return parts.join(' - ');
}
