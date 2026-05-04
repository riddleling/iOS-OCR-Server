import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { IOSClient } from "./client.js";
import { discoverOCRServer } from "./discovery/index.js";

export interface BatchResult {
  file: string;
  success: boolean;
  text?: string;
  error?: string;
  page?: number;
}

export interface BatchOptions {
  lang?: string;
  pages?: string;
  fallback?: boolean;
}

export async function batchOCR(
  files: string[],
  options?: BatchOptions
): Promise<BatchResult[]> {
  const server = await discoverOCRServer();
  if (!server) {
    return files.map(f => ({ file: f, success: false, error: "Server not found" }));
  }

  const client = new IOSClient(server.host, server.port);
  const results: BatchResult[] = [];

  for (const file of files) {
    try {
      if (!fs.existsSync(file)) {
        results.push({ file, success: false, error: "File not found" });
        continue;
      }

      const ext = file.toLowerCase();

      if (ext.endsWith(".pdf")) {
        // PDF 处理
        const pdfResults = await ocrPdfBatch(client, file, options?.pages);
        for (const r of pdfResults) {
          results.push({ file, success: r.success, text: r.text, error: r.error, page: r.page });
        }
      } else {
        // 图片处理
        const result = await client.ocrImage(file, { lang: options?.lang });
        results.push({
          file,
          success: result.success,
          text: result.success ? result.text : undefined,
          error: result.success ? undefined : result.error,
          page: 1
        });
      }
    } catch (err) {
      results.push({ file, success: false, error: String(err) });
    }
  }

  return results;
}

async function ocrPdfBatch(
  client: IOSClient,
  pdfPath: string,
  pages?: string
): Promise<BatchResult[]> {
  const isWindows = process.platform === "win32";
  const results: BatchResult[] = [];

  // 获取 PDF 页数
  const pdfBytes = fs.readFileSync(pdfPath);
  const totalPages = countPdfPages(pdfBytes);

  let pageRange: number[];
  if (pages) {
    const [start, end] = pages.split("-").map(p => parseInt(p.trim(), 10));
    if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
      return [{ file: pdfPath, success: false, error: `Invalid page range (1-${totalPages})` }];
    }
    pageRange = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  } else {
    pageRange = Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1); // 默认最多 10 页
  }

  const tempDir = os.tmpdir();

  for (const pageNum of pageRange) {
    try {
      const outputPrefix = path.join(tempDir, `pdf_batch_p${pageNum}_${Date.now()}`);
      let imgPath: string;

      if (isWindows) {
        // Windows: 使用 PowerShell 提取 PDF 页面
        imgPath = `${outputPrefix}.png`;
        const ps = `
          Add-Type -AssemblyName System.Windows.Forms
          Add-Type -AssemblyName System.Drawing
          $pdf = [System.Drawing.Image]::FromFile("${pdfPath.replace(/\\/g, "\\\\")}")
          # PDF 页面提取需要第三方库，简化为返回文本
        `;
        const scriptPath = path.join(tempDir, `pdf_extract_${Date.now()}.ps1`);
        fs.writeFileSync(scriptPath, ps);
        fs.unlinkSync(scriptPath);
        results.push({
          file: pdfPath,
          success: false,
          error: "PDF batch requires poppler-utils on non-Windows",
          page: pageNum
        });
        continue;
      } else {
        // Linux/Mac: 使用 pdftoppm
        await runCommand(`pdftoppm -f ${pageNum} -l ${pageNum} -png "${pdfPath}" "${outputPrefix}"`);
        imgPath = `${outputPrefix}-1.png`;
      }

      if (fs.existsSync(imgPath)) {
        const result = await client.ocrImage(imgPath);
        results.push({
          file: pdfPath,
          success: result.success,
          text: result.success ? result.text : undefined,
          error: result.success ? undefined : result.error,
          page: pageNum
        });
        fs.unlinkSync(imgPath);
      } else {
        results.push({
          file: pdfPath,
          success: false,
          error: "PDF page conversion failed",
          page: pageNum
        });
      }
    } catch (err) {
      results.push({
        file: pdfPath,
        success: false,
        error: String(err),
        page: pageNum
      });
    }
  }

  return results;
}

function countPdfPages(data: Buffer): number {
  const str = data.toString("binary");
  const matches = str.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
}

async function runCommand(cmd: string): Promise<void> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);
  await execAsync(cmd);
}
