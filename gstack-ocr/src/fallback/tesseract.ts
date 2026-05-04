import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

export async function ocrWithTesseract(
  imagePath: string,
  _pages?: string
): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  try {
    // 检查 tesseract
    try {
      await execAsync("tesseract --version");
    } catch {
      return {
        content: [{ type: "text", text: "tesseract 未安装: apt install tesseract-ocr tesseract-ocr-chi-sim" }],
        isError: true
      };
    }

    if (!fs.existsSync(imagePath)) {
      return { content: [{ type: "text", text: `文件不存在: ${imagePath}` }], isError: true };
    }

    if (imagePath.toLowerCase().endsWith(".pdf")) {
      return {
        content: [{ type: "text", text: "tesseract 不支持 PDF，请使用 pdftoppm 转换或启用 iOS OCR" }],
        isError: true
      };
    }

    const outputPath = path.join(os.tmpdir(), `tesseract_${Date.now()}`);
    await execAsync(`tesseract "${imagePath}" "${outputPath}" -l chi_sim+eng`);

    const txtPath = `${outputPath}.txt`;
    if (!fs.existsSync(txtPath)) {
      return { content: [{ type: "text", text: "tesseract 执行失败" }], isError: true };
    }

    const text = fs.readFileSync(txtPath, "utf-8");
    try { fs.unlinkSync(txtPath); } catch { /* ignore */ }

    return { content: [{ type: "text", text: text.trim() }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `tesseract 失败: ${msg}` }], isError: true };
  }
}
