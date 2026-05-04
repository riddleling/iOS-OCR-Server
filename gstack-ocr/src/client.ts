import * as fs from "fs";
import * as http from "http";
import FormData from "form-data";

export interface OCRResult {
  success: boolean;
  text?: string;
  pages?: { page: number; text: string }[];
  error?: string;
}

export class IOSClient {
  constructor(
    private host: string,
    private port: number
  ) {}

  async ocrImage(imagePath: string): Promise<OCRResult> {
    // 检查文件存在
    try {
      fs.accessSync(imagePath, fs.constants.R_OK);
    } catch {
      return { success: false, error: `文件不存在: ${imagePath}` };
    }

    let stream: fs.ReadStream | undefined;

    try {
      stream = fs.createReadStream(imagePath);

      const form = new FormData();
      form.append("file", stream);

      const result = await this.postForm(form);

      // 解析 HTML 中的 <pre> 标签
      const match = result.match(/<pre>(.*?)<\/pre>/s);
      if (!match) {
        return { success: false, error: "OCR 结果解析失败" };
      }

      return { success: true, text: match[1].trim() };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `OCR 请求失败: ${message}` };
    } finally {
      stream?.destroy();
    }
  }

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.request(
        { method: "GET", host: this.host, port: this.port, path: "/" },
        () => resolve(true)
      );
      req.on("error", () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  }

  private postForm(form: FormData): Promise<string> {
    return new Promise((resolve, reject) => {
      const headers = form.getHeaders();
      const req = http.request(
        { method: "POST", host: this.host, port: this.port, path: "/upload", headers },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }

          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        }
      );

      req.on("error", reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error("请求超时"));
      });

      form.pipe(req);
    });
  }
}
