export interface TableRow {
  [key: string]: string;
}

export interface TableResult {
  headers: string[];
  rows: TableRow[];
  format: "csv" | "json";
  text: string;
}

/**
 * 从 OCR 文本中提取表格结构
 * 支持多种分隔符: Tab, 管道符, 逗号
 */
export function extractTable(ocrText: string): TableResult {
  const lines = ocrText.split("\n").filter(l => l.trim());
  if (lines.length < 2) {
    return { headers: [], rows: [], format: "json", text: "" };
  }

  // 检测分隔符
  const separators = [
    { char: "\t", name: "tab" },
    { char: " | ", name: "pipe" },
    { char: ",", name: "comma" },
    { char: "，", name: "chinese-comma" },
    { char: "  ", name: "spaces" }
  ];

  let separator = " ";
  let separatorName = "spaces";

  for (const sep of separators) {
    // 检查第一行是否包含此分隔符
    if (lines[0].includes(sep.char) && sep.char !== " ") {
      separator = sep.char;
      separatorName = sep.name;
      break;
    }
  }

  // 如果没有找到标准分隔符，尝试按空格分割但需要均匀分布
  if (separator === " ") {
    const firstLineCells = lines[0].trim().split(/\s{2,}/);
    if (firstLineCells.length >= 2) {
      separator = "  ";
      separatorName = "multiple-spaces";
    }
  }

  // 解析表头
  const headerLine = lines[0].trim();
  let headers: string[];

  if (separator === "  ") {
    headers = headerLine.split(/\s{2,}/).map(h => h.trim()).filter(h => h);
  } else {
    headers = headerLine.split(separator).map(h => h.trim()).filter(h => h);
  }

  // 解析数据行
  const rows: TableRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let cells: string[];
    if (separator === "  ") {
      cells = line.split(/\s{2,}/).map(c => c.trim());
    } else {
      cells = line.split(separator).map(c => c.trim());
    }

    // 对齐到表头数量
    const row: TableRow = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] || "";
    });
    rows.push(row);
  }

  return {
    headers,
    rows,
    format: "json",
    text: JSON.stringify(rows, null, 2)
  };
}

/**
 * 将表格转换为 CSV 格式
 */
export function tableToCSV(headers: string[], rows: TableRow[]): string {
  if (headers.length === 0 || rows.length === 0) return "";

  const escapeCSV = (val: string): string => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines: string[] = [headers.map(escapeCSV).join(",")];
  for (const row of rows) {
    lines.push(headers.map(h => escapeCSV(row[h] || "")).join(","));
  }
  return lines.join("\n");
}

/**
 * 将表格转换为 JSON 格式
 */
export function tableToJSON(rows: TableRow[]): string {
  return JSON.stringify(rows, null, 2);
}

/**
 * 尝试自动检测并提取表格
 */
export function detectAndExtractTable(ocrText: string, format: "csv" | "json" = "json"): TableResult {
  const result = extractTable(ocrText);

  if (result.rows.length === 0) {
    return {
      headers: [],
      rows: [],
      format,
      text: format === "csv" ? "" : "[]"
    };
  }

  return {
    ...result,
    format,
    text: format === "csv" ? tableToCSV(result.headers, result.rows) : tableToJSON(result.rows)
  };
}
