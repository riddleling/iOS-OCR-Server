import { discoverOCRServer } from "./discovery/index.js";
import { IOSClient } from "./client.js";
import * as fs from "fs";
import * as http from "http";
import FormData from "form-data";

export interface BarcodeResult {
  type: "qr" | "barcode" | "none";
  value?: string;
  format?: string;
  rawData?: Uint8Array;
}

export interface BarcodeDetectionResult {
  success: boolean;
  barcodes: BarcodeResult[];
  error?: string;
}

/**
 * Detect barcodes and QR codes from an image.
 * Uses iOS OCR Server's barcode detection if available.
 */
export async function detectBarcodes(imagePath: string): Promise<BarcodeDetectionResult> {
  // Check if file exists
  try {
    fs.accessSync(imagePath, fs.constants.R_OK);
  } catch {
    return { success: false, barcodes: [], error: `文件不存在: ${imagePath}` };
  }

  const serverInfo = await discoverOCRServer();
  if (!serverInfo) {
    return { success: false, barcodes: [], error: "无法发现 OCR 服务器" };
  }

  const client = new IOSClient(serverInfo.host, serverInfo.port);

  if (!(await client.isAvailable())) {
    return { success: false, barcodes: [], error: `OCR 服务器 (${serverInfo.host}:${serverInfo.port}) 不可用` };
  }

  try {
    const result = await detectBarcodesFromServer(serverInfo.host, serverInfo.port, imagePath);
    return result;
  } catch (err) {
    // Fallback: return no barcodes if server doesn't support detection
    return { success: true, barcodes: [] };
  }
}

/**
 * Send image to iOS OCR Server for barcode detection.
 * The server should return JSON with detected codes.
 */
async function detectBarcodesFromServer(
  host: string,
  port: number,
  imagePath: string
): Promise<BarcodeDetectionResult> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(imagePath);
    const form = new FormData();
    form.append("file", stream);
    form.append("detectCodes", "true");

    const headers = form.getHeaders();
    const req = http.request(
      { method: "POST", host, port, path: "/barcode", headers },
      (res) => {
        if (res.statusCode !== 200) {
          // Server doesn't support barcode endpoint - return empty result
          resolve({ success: true, barcodes: [] });
          return;
        }

        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            const barcodes: BarcodeResult[] = (parsed.codes || []).map((code: any) => ({
              type: code.type || "barcode",
              value: code.value || code.data || "",
              format: code.format || code.symbology || "",
            }));
            resolve({ success: true, barcodes });
          } catch {
            // Parse error - assume no barcodes
            resolve({ success: true, barcodes: [] });
          }
        });
      }
    );

    req.on("error", () => {
      // Network error - return empty result
      resolve({ success: true, barcodes: [] });
    });

    req.setTimeout(30000, () => {
      req.destroy();
      resolve({ success: true, barcodes: [] });
    });

    form.pipe(req);
  });
}

/**
 * Format barcode results for display.
 */
export function formatBarcodes(barcodes: BarcodeResult[]): string {
  if (barcodes.length === 0) {
    return "未检测到二维码或条形码";
  }

  const lines: string[] = [];
  for (const barcode of barcodes) {
    const typeLabel = barcode.type === "qr" ? "QR 码" : "条形码";
    const formatLabel = barcode.format ? ` (${barcode.format})` : "";
    lines.push(`- ${typeLabel}${formatLabel}: \`${barcode.value}\``);
  }

  return `检测到 ${barcodes.length} 个代码:\n${lines.join("\n")}`;
}
