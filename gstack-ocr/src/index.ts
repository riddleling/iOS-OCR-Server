import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { IOSClient } from "./client.js";
import { discoverOCRServer, OCRServer } from "./discovery/index.js";
import { OCRConfig } from "./discovery/config.js";
import { ocrWithTesseract } from "./fallback/tesseract.js";
import { captureScreen } from "./screenshot.js";
import { captureUrl, downloadUrlText } from "./webcapture.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const server = new Server(
  { name: "gstack-ocr", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

const OCR_TOOL = {
  name: "ocr",
  description: "OCR 图片、PDF、网页或屏幕截图，支持中文识别",
  inputSchema: {
    type: "object",
    properties: {
      input: { type: "string", description: "本地文件路径 (png/jpg/jpeg/pdf)" },
      url: { type: "string", description: "网页 URL，截图后 OCR" },
      screenshot: { type: "boolean", description: "截取屏幕并 OCR" },
      pages: { type: "string", description: "PDF 页码范围，如 '1-5'" },
      fallback: { type: "boolean", description: "iOS OCR 不可用时降级" }
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

  const { input, url, screenshot, pages, fallback } = args as {
    input?: string;
    url?: string;
    screenshot?: boolean;
    pages?: string;
    fallback?: boolean;
  };

  // 优先级: screenshot > url > input
  if (screenshot) {
    const imgPath = await captureScreen();
    if (!imgPath) {
      return { content: [{ type: "text", text: "截图失败，请检查系统权限" }], isError: true };
    }
    // 使用截图进行 OCR
    const ocrResult = await performOCR(imgPath, pages, fallback);
    // 清理临时截图
    try { fs.unlinkSync(imgPath); } catch { /* ignore */ }
    return ocrResult;
  }

  if (url) {
    // 尝试网页截图
    const imgPath = await captureUrl(url);
    if (imgPath && imgPath.endsWith(".png")) {
      const ocrResult = await performOCR(imgPath, pages, fallback);
      try { fs.unlinkSync(imgPath); } catch { /* ignore */ }
      return ocrResult;
    }
    // 降级：下载纯文本
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
      content: [{ type: "text", text: "请提供 input、url 或 screenshot 参数" }],
      isError: true
    };
  }

  // 验证文件
  if (!fs.existsSync(input)) {
    return { content: [{ type: "text", text: `文件不存在: ${input}` }], isError: true };
  }

  return performOCR(input, pages, fallback);
});

// 统一的 OCR 处理函数
async function performOCR(
  filePath: string,
  pages?: string,
  fallback?: boolean
): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  // 发现 OCR server
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

  // PDF 或图片
  if (filePath.toLowerCase().endsWith(".pdf")) {
    return ocrPdf(client, filePath, pages);
  }

  const result = await client.ocrImage(filePath);
  if (!result.success) {
    return { content: [{ type: "text", text: result.error || "OCR 失败" }], isError: true };
  }

  return { content: [{ type: "text", text: result.text || "" }] };
}

type OCRResponse = { content: { type: "text"; text: string }[]; isError?: boolean };

async function ocrPdf(client: IOSClient, pdfPath: string, pages?: string): Promise<OCRResponse> {
  // 检查 pdftoppm (Linux/Mac) 或使用 Node.js 库 (Windows)
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
        const result = await client.ocrImage(imgPath);
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
  // Windows: 使用 pdf-lib (纯 Node.js，无需外部依赖)
  try {
    // 动态导入，因为这是可选的
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
  // 简单计算 PDF 页数：统计 /Type /Page 出现次数
  const str = data.toString("binary");
  const matches = str.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
