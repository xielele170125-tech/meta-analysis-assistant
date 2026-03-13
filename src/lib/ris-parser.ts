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
 * 从XML记录内容中提取字段值
 */
function extractXMLField(recordContent: string, tag: string): string {
  // 尝试多种标签匹配方式
  const patterns = [
    // CDATA格式: <tag><![CDATA[value]]></tag>
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([^\\]]*(?:\\][^\\]]*)*(?:\\]\\][^\\]]*)*)\\]\\]><\\/${tag}>`, 'i'),
    // 普通格式: <tag>value</tag>
    new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'),
    // 自闭合或带属性的标签
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = recordContent.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
}

/**
 * 从XML记录内容中提取作者列表
 */
function extractXMLAuthors(recordContent: string): string[] {
  const authors: string[] = [];
  
  // 尝试多种作者标签格式
  const authorPatterns = [
    /<author[^>]*>([\s\S]*?)<\/author>/gi,
    /<authors[^>]*>[\s\S]*?<author[^>]*>([\s\S]*?)<\/author>[\s\S]*?<\/authors>/gi,
    /<name[^>]*>([\s\S]*?)<\/name>/gi,
    /<AU[^>]*>([\s\S]*?)<\/AU>/gi,
  ];
  
  for (const pattern of authorPatterns) {
    const matches = recordContent.matchAll(pattern);
    for (const m of matches) {
      const name = m[1]
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/<[^>]+>/g, '') // 移除内部标签
        .trim();
      if (name && name.length > 1) {
        authors.push(name);
      }
    }
    if (authors.length > 0) break; // 如果已经找到作者，不需要尝试其他模式
  }
  
  return authors;
}

/**
 * 从XML记录内容中提取年份
 */
function extractXMLYear(recordContent: string): number | null {
  const yearFields = ['year', 'dates', 'pub-dates', 'pub_date', 'publication_year', 'PY'];
  
  for (const field of yearFields) {
    const yearStr = extractXMLField(recordContent, field);
    const match = yearStr.match(/(\d{4})/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  // 尝试提取PubMed格式的年份
  const pubmedYearMatch = recordContent.match(/<PubDate[^>]*>[\s\S]*?<Year[^>]*>(\d{4})<\/Year>/i);
  if (pubmedYearMatch) {
    return parseInt(pubmedYearMatch[1], 10);
  }
  
  // 尝试提取 MedlinePgn 中的年份
  const medlineDateMatch = recordContent.match(/<MedlineDate[^>]*>(\d{4})/i);
  if (medlineDateMatch) {
    return parseInt(medlineDateMatch[1], 10);
  }
  
  return null;
}

/**
 * 解析PubMed格式的XML记录
 */
function parsePubMedRecord(recordContent: string): RISRecord {
  // 提取标题
  const titleMatch = recordContent.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/i);
  const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
  
  // 提取作者
  const authors: string[] = [];
  const authorMatches = recordContent.matchAll(/<Author[^>]*>[\s\S]*?<LastName[^>]*>([\s\S]*?)<\/LastName>[\s\S]*?<ForeName[^>]*>([\s\S]*?)<\/ForeName>[\s\S]*?<\/Author>/gi);
  for (const m of authorMatches) {
    const lastName = m[1].trim();
    const foreName = m[2].trim();
    authors.push(`${foreName} ${lastName}`);
  }
  
  // 如果没有找到完整格式，尝试简单格式
  if (authors.length === 0) {
    const simpleAuthorMatches = recordContent.matchAll(/<Author[^>]*>([\s\S]*?)<\/Author>/gi);
    for (const m of simpleAuthorMatches) {
      const lastNameMatch = m[1].match(/<LastName[^>]*>([\s\S]*?)<\/LastName>/i);
      const foreNameMatch = m[1].match(/<ForeName[^>]*>([\s\S]*?)<\/ForeName>/i);
      if (lastNameMatch && foreNameMatch) {
        authors.push(`${foreNameMatch[1].trim()} ${lastNameMatch[1].trim()}`);
      }
    }
  }
  
  // 提取期刊名
  const journalMatch = recordContent.match(/<Journal[^>]*>[\s\S]*?<Title[^>]*>([\s\S]*?)<\/Title>/i);
  const journal = journalMatch ? journalMatch[1].trim() : '';
  
  // 提取年份
  let year: number | null = null;
  const yearMatch = recordContent.match(/<PubDate[^>]*>[\s\S]*?<Year[^>]*>(\d{4})<\/Year>/i);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }
  
  // 提取DOI
  const doiMatch = recordContent.match(/<ArticleId[^>]*IdType="doi"[^>]*>([\s\S]*?)<\/ArticleId>/i);
  const doi = doiMatch ? doiMatch[1].trim() : '';
  
  // 提取卷期
  const volumeMatch = recordContent.match(/<JournalIssue[^>]*>[\s\S]*?<Volume[^>]*>([\s\S]*?)<\/Volume>/i);
  const volume = volumeMatch ? volumeMatch[1].trim() : '';
  
  const issueMatch = recordContent.match(/<JournalIssue[^>]*>[\s\S]*?<Issue[^>]*>([\s\S]*?)<\/Issue>/i);
  const issue = issueMatch ? issueMatch[1].trim() : '';
  
  // 提取页码
  const pagesMatch = recordContent.match(/<MedlinePgn[^>]*>([\s\S]*?)<\/MedlinePgn>/i);
  const pages = pagesMatch ? pagesMatch[1].trim() : '';
  
  // 提取摘要
  const abstractMatch = recordContent.match(/<Abstract[^>]*>[\s\S]*?<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>[\s\S]*?<\/Abstract>/i);
  const abstract = abstractMatch ? abstractMatch[1].replace(/<[^>]+>/g, '').trim() : '';
  
  // 提取关键词
  const keywords: string[] = [];
  const keywordMatches = recordContent.matchAll(/<Keyword[^>]*>([\s\S]*?)<\/Keyword>/gi);
  for (const m of keywordMatches) {
    keywords.push(m[1].trim());
  }

  return {
    type: 'JOUR',
    title,
    authors,
    year,
    journal,
    volume,
    issue,
    pages,
    doi,
    url: '',
    abstract,
    keywords,
    issn: '',
    publisher: '',
    notes: '',
  };
}

/**
 * 解析单个XML记录（通用格式）
 */
function parseSingleXMLRecord(recordContent: string): RISRecord {
  // 提取期刊名（尝试多种字段名）
  const journalFields = ['periodical', 'journal', 'full-title', 'secondary-title', 'source', 'journal-title', 'T2'];
  let journal = '';
  for (const field of journalFields) {
    journal = extractXMLField(recordContent, field);
    if (journal) break;
  }
  
  // 提取DOI（尝试多种字段名）
  const doiFields = ['doi', 'electronic-resource-num', 'DOI', 'article-id'];
  let doi = '';
  for (const field of doiFields) {
    doi = extractXMLField(recordContent, field);
    if (doi) break;
  }
  
  // 提取关键词
  const keywordsStr = extractXMLField(recordContent, 'keywords');
  const keywords = keywordsStr
    .split(/[;,]/)
    .map(k => k.trim())
    .filter(Boolean);
  
  // 如果keywords标签没有内容，尝试提取多个keyword标签
  if (keywords.length === 0) {
    const keywordMatches = recordContent.matchAll(/<keyword[^>]*>([\s\S]*?)<\/keyword>/gi);
    for (const m of keywordMatches) {
      const kw = m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      if (kw) keywords.push(kw);
    }
  }

  const record: RISRecord = {
    type: extractXMLField(recordContent, 'ref-type') || 
          extractXMLField(recordContent, 'publication-type') || 
          'JOUR',
    title: extractXMLField(recordContent, 'title') || 
           extractXMLField(recordContent, 'article-title') ||
           extractXMLField(recordContent, 'TI'),
    authors: extractXMLAuthors(recordContent),
    year: extractXMLYear(recordContent),
    journal: journal,
    volume: extractXMLField(recordContent, 'volume') || extractXMLField(recordContent, 'VL'),
    issue: extractXMLField(recordContent, 'issue') || extractXMLField(recordContent, 'IS'),
    pages: extractXMLField(recordContent, 'pages') || 
           extractXMLField(recordContent, 'page-range') ||
           extractXMLField(recordContent, 'SP'),
    doi: doi,
    url: extractXMLField(recordContent, 'urls') || 
         extractXMLField(recordContent, 'web-urls') ||
         extractXMLField(recordContent, 'url') ||
         extractXMLField(recordContent, 'UR'),
    abstract: extractXMLField(recordContent, 'abstract') || extractXMLField(recordContent, 'AB'),
    keywords: keywords,
    issn: extractXMLField(recordContent, 'isbn') || 
          extractXMLField(recordContent, 'issn') ||
          extractXMLField(recordContent, 'SN'),
    publisher: extractXMLField(recordContent, 'publisher') || extractXMLField(recordContent, 'PB'),
    notes: extractXMLField(recordContent, 'notes') || extractXMLField(recordContent, 'N1'),
  };

  return record;
}

/**
 * 解析 EndNote XML 文件
 * 支持多种XML格式：
 * 1. 标准EndNote XML: <record>...</record>
 * 2. EndNote带外层: <xml><records><record>...</record></records></xml>
 * 3. PubMed XML: <PubmedArticle>...</PubmedArticle>
 * 4. 其他格式: 自动检测record/article标签
 */
export function parseEndNoteXML(content: string): RISRecord[] {
  const records: RISRecord[] = [];
  
  console.log('[XML Parser] Starting XML parsing, content length:', content.length);
  
  // 清理XML声明和注释
  let cleanContent = content
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  // 检测是否为PubMed格式
  if (cleanContent.includes('<PubmedArticle') || cleanContent.includes('<PubmedArticleSet')) {
    console.log('[XML Parser] Detected PubMed XML format');
    const pubmedMatches = cleanContent.matchAll(/<PubmedArticle[^>]*>([\s\S]*?)<\/PubmedArticle>/gi);
    
    for (const match of pubmedMatches) {
      const record = parsePubMedRecord(match[1]);
      if (record.title || record.doi) {
        records.push(record);
      }
    }
    
    console.log(`[XML Parser] PubMed format parsed ${records.length} records`);
    return records;
  }

  // 尝试多种记录标签模式（EndNote等）
  const recordPatterns = [
    // 标准EndNote XML
    /<record[^>]*>([\s\S]*?)<\/record>/gi,
    // 通用article标签
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    // 通用entry标签
    /<entry[^>]*>([\s\S]*?)<\/entry>/gi,
  ];

  let parsedCount = 0;
  
  for (const pattern of recordPatterns) {
    const matches = cleanContent.matchAll(pattern);
    
    for (const match of matches) {
      const recordContent = match[1];
      const record = parseSingleXMLRecord(recordContent);
      
      if (record.title || record.doi) {
        records.push(record);
        parsedCount++;
      }
    }
    
    if (parsedCount > 0) {
      console.log(`[XML Parser] Pattern ${pattern.source.substring(0, 30)}... matched ${parsedCount} records`);
      break; // 如果已经找到记录，不需要尝试其他模式
    }
  }

  // 如果上述模式都没有匹配到，尝试更宽松的提取
  if (records.length === 0) {
    console.log('[XML Parser] Standard patterns not matched, trying alternative extraction...');
    
    // 尝试查找包含title标签的任何结构
    const titleMatches = cleanContent.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi);
    for (const match of titleMatches) {
      const title = match[1]
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim();
      
      if (title && title.length > 5) {
        // 尝试提取周围上下文作为记录
        const contextStart = Math.max(0, match.index! - 2000);
        const contextEnd = Math.min(cleanContent.length, match.index! + match[0].length + 2000);
        const recordContent = cleanContent.substring(contextStart, contextEnd);
        
        const record = parseSingleXMLRecord(recordContent);
        if (record.title || record.doi) {
          records.push(record);
        }
      }
    }
  }

  console.log(`[XML Parser] Total parsed ${records.length} records`);
  
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
