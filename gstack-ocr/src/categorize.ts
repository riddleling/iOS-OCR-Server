export type ContentCategory =
  | "receipt"
  | "business_card"
  | "document"
  | "screenshot"
  | "handwritten"
  | "mixed"
  | "unknown";

export interface ExtractedFields {
  dates?: string[];
  amounts?: string[];
  names?: string[];
  addresses?: string[];
  phoneNumbers?: string[];
  emails?: string[];
  urls?: string[];
}

export interface CategorizedResult {
  category: ContentCategory;
  confidence: number;
  extractedFields?: ExtractedFields;
}

/**
 * Categorize OCR text content into types like receipt, business card, etc.
 * Uses pattern matching to identify common document types.
 */
export function categorizeOCRText(text: string): CategorizedResult {
  const lower = text.toLowerCase();
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  // Receipt detection - has currency/total keywords
  const receiptPatterns = [
    /[¥￥\$]/, // currency symbols
    /价格|金额|合计|小计|税|总计|subtotal|total|cash|change|paid|payment|receipt|invoice/i,
    /\d+\.?\d*\s*[元圆]|amount/i,
    /小票|收据|发票/,
  ];

  const receiptMatches = receiptPatterns.filter((p) => p.test(text)).length;
  if (receiptMatches >= 2 || (receiptMatches >= 1 && /[¥￥\$]/.test(text))) {
    return {
      category: "receipt",
      confidence: 0.8,
      extractedFields: extractReceiptFields(text),
    };
  }

  // Business card detection - has title/contact patterns
  const titlePatterns =
    /经理|总监|部长|课长|代表取缔役|president|ceo|director|manager|engineer|consultant|specialist/i;
  const phonePattern = /[\d]{3,4}[-．.]?[\d]{3,4}[-．.]?[\d]{4}/;
  const hasTitle = titlePatterns.test(text);
  const hasPhone = phonePattern.test(text);

  if (hasTitle && hasPhone) {
    return {
      category: "business_card",
      confidence: 0.85,
      extractedFields: extractBusinessCardFields(text),
    };
  }

  // Long document - many lines without specific patterns
  if (lines.length > 15) {
    // Check for handwritten mixed with printed
    if (hasChineseAndLatin(text)) {
      return {
        category: "mixed",
        confidence: 0.6,
        extractedFields: extractGenericFields(text),
      };
    }
    return {
      category: "document",
      confidence: 0.7,
      extractedFields: extractGenericFields(text),
    };
  }

  // Screenshot detection - common UI text patterns
  const screenshotPatterns = [
    /menu|settings|profile|account|notification|permission|cancel|confirm|ok|apply/i,
    /^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/, // Title case words
    /copyright|\©|\(c\)/i,
  ];

  const screenshotMatches = screenshotPatterns.filter((p) => p.test(text)).length;
  if (screenshotMatches >= 2 && lines.length < 10) {
    return {
      category: "screenshot",
      confidence: 0.65,
      extractedFields: extractGenericFields(text),
    };
  }

  // Handwritten detection - mixed character types
  if (hasChineseAndLatin(text)) {
    return {
      category: "handwritten",
      confidence: 0.55,
      extractedFields: extractGenericFields(text),
    };
  }

  return {
    category: "unknown",
    confidence: 0.3,
    extractedFields: extractGenericFields(text),
  };
}

/**
 * Check if text contains both Chinese and Latin characters.
 */
function hasChineseAndLatin(text: string): boolean {
  const hasChinese = /[一-龥]/.test(text); // CJK Unified Ideographs
  const hasLatin = /[A-Za-z]/.test(text);
  return hasChinese && hasLatin;
}

/**
 * Extract fields commonly found in receipts.
 */
function extractReceiptFields(text: string): ExtractedFields {
  const fields: ExtractedFields = {};

  // Amounts with currency
  const amountPattern = /[¥￥\$]?\s*\d+\.?\d*/g;
  fields.amounts = text.match(amountPattern)?.slice(0, 20) || [];

  // Date patterns
  const datePatterns = [
    /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?/,
    /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/,
    /\d{4}\.\d{2}\.\d{2}/,
  ];
  const dates: string[] = [];
  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      dates.push(...matches);
    }
  }
  if (dates.length > 0) {
    fields.dates = dates;
  }

  // Phone numbers
  const phonePattern = /1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/g;
  const phones = text.match(phonePattern);
  if (phones) {
    fields.phoneNumbers = phones;
  }

  return fields;
}

/**
 * Extract fields commonly found in business cards.
 */
function extractBusinessCardFields(text: string): ExtractedFields {
  const fields: ExtractedFields = {};

  // Phone numbers
  const phonePattern = /[\d]{3,4}[-．.]?[\d]{3,4}[-．.]?[\d]{4}/g;
  const phones = text.match(phonePattern);
  if (phones) {
    fields.phoneNumbers = phones;
  }

  // Email
  const emailPattern = /[\w.-]+@[\w.-]+\.\w+/gi;
  const emails = text.match(emailPattern);
  if (emails) {
    fields.emails = emails;
  }

  // URLs
  const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
  const urls = text.match(urlPattern);
  if (urls) {
    fields.urls = urls;
  }

  // Company names (simplified - looks for lines that might be company)
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const companyCandidates = lines.filter(
    (l) =>
      l.length > 3 &&
      l.length < 50 &&
      !/[\d]{3,4}[-．.]?[\d]{3,4}/.test(l) &&
      !/@/.test(l) &&
      /[A-Za-z一-龥]/.test(l)
  );
  if (companyCandidates.length > 0) {
    // Assume first non-contact line might be company
    fields.names = [companyCandidates[0]];
  }

  return fields;
}

/**
 * Extract generic fields from any document type.
 */
function extractGenericFields(text: string): ExtractedFields {
  const fields: ExtractedFields = {};

  // Email
  const emailPattern = /[\w.-]+@[\w.-]+\.\w+/gi;
  const emails = text.match(emailPattern);
  if (emails) {
    fields.emails = emails;
  }

  // URLs
  const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
  const urls = text.match(urlPattern);
  if (urls) {
    fields.urls = urls;
  }

  // Phone numbers
  const phonePatterns = [
    /1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/g, // Chinese mobile
    /\d{3,4}[-．.]?\d{3,4}[-．.]?\d{4}/g, // General format
  ];
  const phones: string[] = [];
  for (const pattern of phonePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      phones.push(...matches);
    }
  }
  if (phones.length > 0) {
    fields.phoneNumbers = [...new Set(phones)]; // deduplicate
  }

  // Dates
  const datePatterns = [
    /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?/,
    /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/,
  ];
  const dates: string[] = [];
  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      dates.push(...matches);
    }
  }
  if (dates.length > 0) {
    fields.dates = dates;
  }

  return fields;
}

/**
 * Format categorization result for display.
 */
export function formatCategorization(result: CategorizedResult): string {
  const categoryLabels: Record<ContentCategory, string> = {
    receipt: "收据/发票",
    business_card: "名片",
    document: "文档",
    screenshot: "截图",
    handwritten: "手写内容",
    mixed: "混合内容",
    unknown: "未知",
  };

  const lines: string[] = [];
  lines.push(`**类型**: ${categoryLabels[result.category]}`);
  lines.push(`**置信度**: ${(result.confidence * 100).toFixed(0)}%`);

  if (result.extractedFields) {
    const { dates, amounts, names, phoneNumbers, emails, urls } = result.extractedFields;

    if (amounts && amounts.length > 0) {
      lines.push(`**金额**: ${amounts.slice(0, 5).join(", ")}`);
    }
    if (dates && dates.length > 0) {
      lines.push(`**日期**: ${dates.slice(0, 3).join(", ")}`);
    }
    if (names && names.length > 0) {
      lines.push(`**名称**: ${names.join(", ")}`);
    }
    if (phoneNumbers && phoneNumbers.length > 0) {
      lines.push(`**电话**: ${phoneNumbers.slice(0, 3).join(", ")}`);
    }
    if (emails && emails.length > 0) {
      lines.push(`**邮箱**: ${emails.slice(0, 3).join(", ")}`);
    }
    if (urls && urls.length > 0) {
      lines.push(`**链接**: ${urls.slice(0, 3).join(", ")}`);
    }
  }

  return lines.join("\n");
}
