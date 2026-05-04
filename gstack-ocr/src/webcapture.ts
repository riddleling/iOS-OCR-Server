import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const execAsync = promisify(exec);

export async function captureUrl(url: string): Promise<string | null> {
  const outputPath = path.join(os.tmpdir(), `webcapture_${Date.now()}.png`);

  try {
    const platform = process.platform;

    if (platform === "darwin") {
      // macOS: 优先用 wkhtmltopdf 或 Safari WebDriver
      try {
        await execAsync(`wkhtmltoimage "${url}" "${outputPath}"`);
      } catch {
        // 降级：下载 HTML 提取文本
        return null;
      }
    } else if (platform === "linux") {
      try {
        await execAsync(`cutycapt --url="${url}" --out="${outputPath}"`);
      } catch {
        try {
          await execAsync(`wkhtmltoimage "${url}" "${outputPath}"`);
        } catch {
          return null;
        }
      }
    } else {
      // Windows: PowerShell 下载并转文本
      const textPath = path.join(os.tmpdir(), `page_${Date.now()}.txt`);
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms
        $client = New-Object System.Net.WebClient
        try {
          $html = $client.DownloadString("${url}")
          # 简单处理：提取纯文本
          $text = $html -replace '<[^>]+>', ' '
          $text = $text -replace '\\s+', ' '
          $text | Out-File "${textPath.replace(/\\/g, "\\\\")}" -Encoding UTF8
        } catch {
          exit 1
        }
      `;
      const scriptPath = path.join(os.tmpdir(), `download_${Date.now()}.ps1`);
      fs.writeFileSync(scriptPath, ps);
      try {
        await execAsync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`);
      } catch {
        fs.unlinkSync(scriptPath);
        return null;
      }
      fs.unlinkSync(scriptPath);
      // Windows 降级返回文本文件路径（OCR 工具会处理）
      if (fs.existsSync(textPath)) {
        return textPath;
      }
      return null;
    }

    if (fs.existsSync(outputPath)) {
      return outputPath;
    }
    return null;
  } catch (err) {
    console.error("[WebCapture] Failed:", err);
    return null;
  }
}

export async function downloadUrlText(url: string): Promise<string | null> {
  const outputPath = path.join(os.tmpdir(), `page_${Date.now()}.txt`);

  try {
    const platform = process.platform;

    if (platform === "darwin" || platform === "linux") {
      await execAsync(`curl -sL "${url}" -o "${outputPath}"`);
    } else {
      // Windows: PowerShell
      const ps = `
        $client = New-Object System.Net.WebClient
        try {
          $html = $client.DownloadString("${url}")
          $text = $html -replace '<[^>]+>', ' '
          $text = $text -replace '\\s+', ' '
          $text | Out-File "${outputPath.replace(/\\/g, "\\\\")}" -Encoding UTF8
        } catch {
          exit 1
        }
      `;
      const scriptPath = path.join(os.tmpdir(), `download_${Date.now()}.ps1`);
      fs.writeFileSync(scriptPath, ps);
      await execAsync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`);
      fs.unlinkSync(scriptPath);
    }

    if (fs.existsSync(outputPath)) {
      return outputPath;
    }
    return null;
  } catch (err) {
    console.error("[DownloadUrlText] Failed:", err);
    return null;
  }
}
