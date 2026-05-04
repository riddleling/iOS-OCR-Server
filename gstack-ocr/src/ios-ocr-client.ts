/**
 * iOS OCR HTTP Client
 *
 * Client for connecting to iOS OCR Server (192.168.50.225:8150)
 * Supports image upload, URL-based OCR, and health checks.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

export interface OCRResult {
  text: string;
  confidence: number;
  language?: string;
  bounds?: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export class IOSOCRClient {
  private baseUrl: string;
  private discoveredUrl: string | null = null;

  constructor(baseUrl = "http://192.168.50.225:8150") {
    this.baseUrl = baseUrl;
  }

  private async discoverServer(): Promise<string> {
    if (this.discoveredUrl) {
      return this.discoveredUrl;
    }

    const urls = [
      this.baseUrl,
      "http://localhost:8150",
    ];

    for (const url of urls) {
      try {
        const response = await fetch(`${url}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          this.discoveredUrl = url;
          return url;
        }
      } catch {
        // Try next URL
      }
    }

    throw new Error("iOS OCR Server unavailable at all configured addresses");
  }

  async ocrImage(
    imagePath: string,
    language: string = "auto",
    enhance: boolean = true
  ): Promise<string> {
    const serverUrl = await this.discoverServer();
    const fileBuffer = await readFile(imagePath);
    const fileName = `ocr_${Date.now()}_${randomUUID()}${getExtension(imagePath)}`;

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([fileBuffer]),
      fileName
    );

    if (language !== "auto") {
      formData.append("lang", language);
    }
    formData.append("enhance", String(enhance));

    try {
      const response = await fetch(`${serverUrl}/ocr`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        throw new Error(`OCR failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as OCRResult;
      return result.text || result.bounds?.map((b) => b.text).join("\n") || "";
    } catch (error) {
      throw new Error(`iOS OCR request failed: ${error}`);
    }
  }

  async downloadImage(url: string): Promise<string> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const tempPath = join(tmpdir(), `ocr_${randomUUID()}.tmp`);

    await Bun.write(tempPath, buffer);
    return tempPath;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const serverUrl = await this.discoverServer();
      const response = await fetch(`${serverUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

function getExtension(path: string): string {
  const ext = path.toLowerCase().split(".").pop();
  return `.${ext || "png"}`;
}
