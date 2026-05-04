import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { IOSClient } from "./client.js";
import { discoverOCRServer, OCRServer } from "./discovery/index.js";
import { OCRConfig } from "./discovery/config.js";
import { ocrWithTesseract } from "./fallback/tesseract.js";
import { captureScreen, Region } from "./screenshot.js";
import { captureUrl, downloadUrlText } from "./webcapture.js";
import { captureClipboard } from "./screenshot.js";
import { batchOCR } from "./batch.js";
import { detectAndExtractTable } from "./table.js";
import { compareOCR, formatDiffResult } from "./compare.js";
import { startHttpServer } from "./http-server.js";
import { detectBarcodes, formatBarcodes } from "./barcode.js";
import { categorizeOCRText, formatCategorization } from "./categorize.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// 扩展参数类型
interface OCRExtendedArgs {
  input?: string;
  files?: string[];
  url?: string;
  screenshot?: boolean;
  clipboard?: boolean;
  region?: Region;
  pages?: string;
  lang?: string;
  mode?: "auto" | "printed" | "handwritten";
  table?: boolean;
  tableFormat?: "csv" | "json";
  detectCodes?: boolean;
  json?: boolean;
  category?: boolean;
  compare?: {
    before: string;
    after: string;
  };
  fallback?: boolean;
  httpServer?: boolean;
  httpPort?: number;
}

const server = new Server(
  { name: "gstack-ocr", version: "0.3.0" },
  { capabilities: { tools: {} } }
);

const OCR_TOOL = {
  name: "ocr",
  description: "OCR 图片、PDF、网页或屏幕截图，支持中文识别、多语言、批量处理、表格提取、对比模式",
  inputSchema: {
    type: "object",
    properties: {
      input: { type: "string", description: "本地文件路径 (png/jpg/jpeg/pdf)" },
      files: {
        type: "array",
        items: { type: "string" },
        description: "批量文件路径 ['a.png', 'b.pdf', 'c.jpg']"
      },
      url: { type: "string", description: "网页 URL，截图后 OCR" },
      screenshot: { type: "boolean", description: "截取屏幕并 OCR" },
      clipboard: { type: "boolean", description: "从剪贴板获取图片并 OCR" },
      region: {
        type: "object",
        description: "截图区域 {x, y, width, height}",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" }
        }
      },
      pages: { type: "string", description: "PDF 页码范围，如 '1-5'" },
      lang: {
        type: "string",
        description: "识别语言: eng/chi_sim/chi_tra/jpn/kor/fra/deu/spa 等"
      },
      mode: {
        type: "string",
        enum: ["auto", "printed", "handwritten"],
        description: "识别模式: auto(自动)/printed(印刷体)/handwritten(手写体)"
      },
      table: {
        type: "boolean",
        description: "提取表格结构 (CSV 或 JSON)"
      },
      tableFormat: {
        type: "string",
        description: "表格格式: csv 或 json (默认 json)"
      },
      detectCodes: {
        type: "boolean",
        description: "检测二维码和条形码"
      },
      json: {
        type: "boolean",
        description: "输出 JSON 格式结果 (用于 AI agent 结构化处理)"
      },
      category: {
        type: "boolean",
        description: "自动识别内容类型 (receipt/business_card/document/etc)"
      },
      compare: {
        type: "object",
        description: "对比模式，比较两张图片的 OCR 差异",
        properties: {
          before: { type: "string", description: "修改前的图片路径" },
          after: { type: "string", description: "修改后的图片路径" }
        }
      },
      fallback: { type: "boolean", description: "iOS OCR 不可用时降级到 Tesseract" },
      httpServer: { type: "boolean", description: "启动 HTTP API 服务器" },
      httpPort: { type: "number", description: "HTTP 服务器端口 (默认 8080)" }
    }
  }
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [OCR_TOOL]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== "ocr") {
    return { content: [{ type: "text", text: `未知工具: ${name}` }], isError: true };
  }

  const parsedArgs = args as OCRExtendedArgs;

  // HTTP 服务器模式
  if (parsedArgs.httpServer) {
    const port = parsedArgs.httpPort || 8080;
    try {
      await startHttpServer({ port });
      return {
        content: [{ type: "text", text: `[gstack-ocr] HTTP 服务器已启动于 http://localhost:${port}` }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `HTTP 服务器启动失败: ${err}` }],
        isError: true
      };
    }
  }

  // 对比模式
  if (parsedArgs.compare) {
    return handleCompareMode(parsedArgs);
  }

  // 批量处理模式
  if (parsedArgs.files && parsedArgs.files.length > 0) {
    return handleBatchMode(parsedArgs);
  }

  // 单文件/截图/剪贴板/URL 模式
  return handleSingleMode(parsedArgs);
});

// 单文件处理
async function handleSingleMode(args: OCRExtendedArgs): Promise<{
  content: { type: "text"; text: string }[];
  isError?: boolean;
}> {
  const { input, url, screenshot, clipboard, region, pages, lang, mode, table, tableFormat, detectCodes, json, category, fallback } = args;

  // 优先级: clipboard > screenshot > url > input
  if (clipboard) {
    const imgPath = await captureClipboard();
    if (!imgPath) {
      return { content: [{ type: "text", text: "剪贴板无图片或读取失败" }], isError: true };
    }
    const ocrResult = await performOCR(imgPath, pages, lang, mode, fallback);
    try { fs.unlinkSync(imgPath); } catch { /* ignore */ }
    return formatOCRResult(ocrResult, table, tableFormat, detectCodes, json, category, imgPath);
  }

  if (screenshot) {
    const imgPath = await captureScreen(region);
    if (!imgPath) {
      return { content: [{ type: "text", text: "截图失败，请检查系统权限" }], isError: true };
    }
    const ocrResult = await performOCR(imgPath, pages, lang, mode, fallback);
    try { fs.unlinkSync(imgPath); } catch { /* ignore */ }
    return formatOCRResult(ocrResult, table, tableFormat, detectCodes, json, category, imgPath);
  }

  if (url) {
    const imgPath = await captureUrl(url);
    if (imgPath && imgPath.endsWith(".png")) {
      const ocrResult = await performOCR(imgPath, pages, lang, mode, fallback);
      try { fs.unlinkSync(imgPath); } catch { /* ignore */ }
      return formatOCRResult(ocrResult, table, tableFormat, detectCodes, json, category, imgPath);
    }
    const textPath = await downloadUrlText(url);
    if (textPath && fs.existsSync(textPath)) {
      const text = fs.readFileSync(textPath, "utf-8").trim();
      try { fs.unlinkSync(textPath); } catch { /* ignore */ }
      return { content: [{ type: "text", text: text || "[网页无文本内容]" }] };
    }
    return {
      content: [{ type: "text", text: "网页截图失败，尝试安装 wkhtmltoimage 或 cutycapt" }],
      isError: true
    };
  }

  // 传统模式：本地文件
  if (!input) {
    return {
      content: [{ type: "text", text: "请提供 input、files、url、screenshot、clipboard 或 compare 参数" }],
      isError: true
    };
  }

  if (!fs.existsSync(input)) {
    return { content: [{ type: "text", text: `文件不存在: ${input}` }], isError: true };
  }

  const ocrResult = await performOCR(input, pages, lang, mode, fallback);
  return formatOCRResult(ocrResult, table, tableFormat, detectCodes, json, category, input);
}

// 批量处理
async function handleBatchMode(args: OCRExtendedArgs): Promise<{
  content: { type: "text"; text: string }[];
  isError?: boolean;
}> {
  const { files, lang, pages, fallback } = args;

  if (!files || files.length === 0) {
    return { content: [{ type: "text", text: "请提供 files 数组" }], isError: true };
  }

  const results = await batchOCR(files, { lang, pages, fallback });

  // 格式化输出
  const lines: string[] = [`## 批量 OCR 结果 (${results.length} 个文件)`];
  lines.push("");

  let successCount = 0;
  let failCount = 0;

  for (const result of results) {
    const status = result.success ? "OK" : "FAIL";
    if (result.success) successCount++;
    else failCount++;

    lines.push(`### ${result.file} [${status}]`);

    if (result.page) {
      lines.push(`Page: ${result.page}`);
    }

    if (result.success && result.text) {
      const preview = result.text.length > 200 ? result.text.slice(0, 200) + "..." : result.text;
      lines.push("```");
      lines.push(preview);
      lines.push("```");
    } else if (result.error) {
      lines.push(`Error: ${result.error}`);
    }

    lines.push("");
  }

  lines.push(`**Summary**: ${successCount} success, ${failCount} failed`);

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

// 对比模式
async function handleCompareMode(args: OCRExtendedArgs): Promise<{
  content: { type: "text"; text: string }[];
  isError?: boolean;
}> {
  const { compare, lang, fallback } = args;

  if (!compare || !compare.before || !compare.after) {
    return {
      content: [{ type: "text", text: "请提供 compare.before 和 compare.after 参数" }],
      isError: true
    };
  }

  if (!fs.existsSync(compare.before)) {
    return { content: [{ type: "text", text: `文件不存在: ${compare.before}` }], isError: true };
  }

  if (!fs.existsSync(compare.after)) {
    return { content: [{ type: "text", text: `文件不存在: ${compare.after}` }], isError: true };
  }

  try {
    const diff = await compareOCR(compare.before, compare.after, { lang });
    const formatted = formatDiffResult(diff);

    return {
      content: [
        { type: "text", text: formatted },
        { type: "text", text: "## Full OCR Text\n\n### Before\n```\n" + diff.before + "\n```\n\n### After\n```\n" + diff.after + "\n```" }
      ]
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `对比失败: ${err}` }],
      isError: true
    };
  }
}

// 格式化 OCR 结果
function formatOCRResult(
  result: { content: { type: "text"; text: string }[]; isError?: boolean },
  extractTable?: boolean,
  tableFormat?: "csv" | "json",
  detectCodes?: boolean,
  jsonOutput?: boolean,
  categorize?: boolean,
  imagePath?: string
): { content: { type: "text"; text: string }[]; isError?: boolean } {
  if (result.isError) {
    return result;
  }

  // JSON 模式输出
  if (jsonOutput) {
    return formatJSONResult(result, extractTable, tableFormat, detectCodes, categorize, imagePath);
  }

  // 默认文本模式
  let output = result.content[0]?.text || "";

  // 表格提取
  if (extractTable) {
    const ocrText = result.content[0]?.text || "";
    const tableResult = detectAndExtractTable(ocrText, tableFormat || "json");

    if (tableResult.rows.length > 0) {
      const formatLabel = tableResult.format.toUpperCase();
      output += `\n\n## Extracted Table (${formatLabel})\n\n\`\`\`${tableResult.format}\n${tableResult.text}\n\`\`\``;
    }
  }

  // 条码检测
  if (detectCodes && imagePath) {
    detectBarcodes(imagePath).then((barcodeResult) => {
      if (barcodeResult.success && barcodeResult.barcodes.length > 0) {
        output += `\n\n## Barcode Detection\n${formatBarcodes(barcodeResult.barcodes)}`;
      }
    }).catch(() => {/* ignore */});
  }

  // 内容分类
  if (categorize) {
    const text = result.content[0]?.text || "";
    const catResult = categorizeOCRText(text);
    output += `\n\n## Content Categorization\n${formatCategorization(catResult)}`;
  }

  return { content: [{ type: "text", text: output }] };
}

/**
 * Format OCR result as structured JSON for AI agents.
 */
function formatJSONResult(
  result: { content: { type: "text"; text: string }[]; isError?: boolean },
  extractTable?: boolean,
  tableFormat?: "csv" | "json",
  detectCodes?: boolean,
  categorize?: boolean,
  imagePath?: string
): { content: { type: "text"; text: string }[]; isError?: boolean } {
  const text = result.content[0]?.text || "";
  const jsonResult: any = {
    success: true,
    text: text,
  };

  // 表格提取
  if (extractTable) {
    const tableResult = detectAndExtractTable(text, tableFormat || "json");
    if (tableResult.rows.length > 0) {
      jsonResult.table = {
        format: tableResult.format,
        rows: tableResult.rows,
      };
    }
  }

  // 内容分类
  if (categorize) {
    jsonResult.category = categorizeOCRText(text);
  }

  // 条码检测 (异步)
  if (detectCodes && imagePath) {
    detectBarcodes(imagePath).then((barcodeResult) => {
      if (barcodeResult.success && barcodeResult.barcodes.length > 0) {
        jsonResult.barcodes = barcodeResult.barcodes;
      }
    }).catch(() => {/* ignore */});
  }

  return {
    content: [{ type: "text", text: JSON.stringify(jsonResult, null, 2) }],
  };
}

// 统一的 OCR 处理函数
async function performOCR(
  filePath: string,
  pages?: string,
  lang?: string,
  mode?: "auto" | "printed" | "handwritten",
  fallback?: boolean
): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  const serverInfo = await discoverOCRServer();
  if (!serverInfo) {
    if (fallback) {
      return ocrWithTesseract(filePath, pages);
    }
    return {
      content: [{ type: "text", text: "无法发现 iOS OCR Server，请确保设备在同一局域网" }],
      isError: true
    };
  }

  const client = new IOSClient(serverInfo.host, serverInfo.port);

  if (!(await client.isAvailable())) {
    if (fallback) {
      return ocrWithTesseract(filePath, pages);
    }
    return {
      content: [{ type: "text", text: `iOS OCR Server (${serverInfo.host}:${serverInfo.port}) 不可用` }],
      isError: true
    };
  }

  // 确定是否使用手写模式
  const handwriting = mode === "handwritten";

  // PDF 或图片
  if (filePath.toLowerCase().endsWith(".pdf")) {
    return ocrPdf(client, filePath, pages, lang);
  }

  const result = await client.ocrImage(filePath, { lang, handwriting });
  if (!result.success) {
    return { content: [{ type: "text", text: result.error || "OCR 失败" }], isError: true };
  }

  return { content: [{ type: "text", text: result.text || "" }] };
}

type OCRResponse = { content: { type: "text"; text: string }[]; isError?: boolean };

async function ocrPdf(client: IOSClient, pdfPath: string, pages?: string, lang?: string): Promise<OCRResponse> {
  const isWindows = process.platform === "win32";

  if (isWindows) {
    return ocrPdfWithLib(client, pdfPath, pages);
  }

  // Linux/Mac: 使用 pdftoppm
  try {
    await execAsync("pdftoppm -v");
  } catch {
    return {
      content: [{ type: "text", text: "请安装 poppler-utils: apt install poppler-utils" }],
      isError: true
    };
  }

  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfPages = countPdfPages(pdfBytes);

  let pageRange: number[];
  if (pages) {
    const [start, end] = pages.split("-").map(p => parseInt(p.trim(), 10));
    if (isNaN(start) || isNaN(end) || start < 1 || end > pdfPages || start > end) {
      return { content: [{ type: "text", text: `无效的页码范围 (1-${pdfPages})` }], isError: true };
    }
    pageRange = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  } else {
    pageRange = Array.from({ length: pdfPages }, (_, i) => i + 1);
  }

  const results: { page: number; text: string }[] = [];
  const tempDir = os.tmpdir();

  for (const pageNum of pageRange) {
    const outputPrefix = path.join(tempDir, `pdf_ocr_p${pageNum}`);

    try {
      await execAsync(`pdftoppm -f ${pageNum} -l ${pageNum} -png "${pdfPath}" "${outputPrefix}"`);
      const imgPath = `${outputPrefix}-1.png`;

      if (fs.existsSync(imgPath)) {
        const result = await client.ocrImage(imgPath, { lang });
        results.push({ page: pageNum, text: result.success ? result.text || "" : `[${result.error}]` });
        fs.unlinkSync(imgPath);
      } else {
        results.push({ page: pageNum, text: "[转换失败]" });
      }
    } catch {
      results.push({ page: pageNum, text: "[转换失败]" });
    }
  }

  return {
    content: [{ type: "text", text: results.map(r => `=== 第 ${r.page} 页 ===\n${r.text}`).join("\n\n") }]
  };
}

async function ocrPdfWithLib(client: IOSClient, pdfPath: string, pages?: string): Promise<OCRResponse> {
  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs").catch(() => {
      throw new Error("pdfjs-dist not installed");
    });

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await getDocument({ data }).promise;
    const totalPages = pdf.numPages;

    let pageRange: number[];
    if (pages) {
      const [start, end] = pages.split("-").map(p => parseInt(p.trim(), 10));
      if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
        return { content: [{ type: "text", text: `无效的页码范围 (1-${totalPages})` }], isError: true };
      }
      pageRange = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    } else {
      pageRange = Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const results: { page: number; text: string }[] = [];

    for (const pageNum of pageRange) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(" ");
      results.push({ page: pageNum, text: text || "[无文字]" });
    }

    return {
      content: [{ type: "text", text: results.map(r => `=== 第 ${r.page} 页 ===\n${r.text}`).join("\n\n") }]
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Windows PDF OCR 需要安装 pdfjs-dist: npm install pdfjs-dist` }],
      isError: true
    };
  }
}

function countPdfPages(data: Buffer): number {
  const str = data.toString("binary");
  const matches = str.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
