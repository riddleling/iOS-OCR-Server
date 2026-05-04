import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { IOSClient } from "./client.js";
import { discoverOCRServer } from "./discovery/index.js";
import { detectAndExtractTable } from "./table.js";
import { batchOCR } from "./batch.js";

export interface HttpServerOptions {
  port?: number;
  host?: string;
}

interface MultipartPart {
  name: string;
  filename?: string;
  data: Buffer;
  contentType?: string;
}

/**
 * 简单的 HTTP 服务器，支持 OCR API
 */
export async function startHttpServer(options: HttpServerOptions = {}): Promise<http.Server> {
  const port = options.port || 8080;
  const host = options.host || "0.0.0.0";

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const reqUrl = new URL(req.url || "/", `http://${req.headers.host}`);

    try {
      if (req.method === "GET" && reqUrl.pathname === "/health") {
        await handleHealth(res, reqUrl);
      } else if (req.method === "GET" && reqUrl.pathname === "/") {
        await handleIndex(res);
      } else if (req.method === "POST" && reqUrl.pathname === "/ocr") {
        await handleOcr(req, res, reqUrl);
      } else if (req.method === "POST" && reqUrl.pathname === "/ocr/batch") {
        await handleOcrBatch(req, res, reqUrl);
      } else if (req.method === "POST" && reqUrl.pathname === "/ocr/table") {
        await handleOcrTable(req, res, reqUrl);
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
    } catch (err) {
      console.error("[HTTP Server] Error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      console.log(`[gstack-ocr] HTTP server running on http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
    });
    resolve(server);
  });
}

async function handleHealth(res: http.ServerResponse, _url: URL): Promise<void> {
  const ocrServer = await discoverOCRServer();
  const status = ocrServer ? "ready" : "no_server";

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    status,
    ocrServer,
    timestamp: new Date().toISOString()
  }));
}

async function handleIndex(res: http.ServerResponse): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>gstack-ocr HTTP API</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
    h1 { color: #333; }
    h2 { color: #666; margin-top: 30px; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
    pre { background: #f5f5f5; padding: 15px; border-radius: 8px; overflow-x: auto; }
    .endpoint { margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>gstack-ocr HTTP API</h1>

  <div class="endpoint">
    <h2>GET /health</h2>
    <p>Check OCR server status</p>
    <pre>curl http://localhost:8080/health</pre>
  </div>

  <div class="endpoint">
    <h2>POST /ocr</h2>
    <p>OCR an image file (multipart/form-data)</p>
    <p>Parameters:</p>
    <ul>
      <li><code>file</code>: Image file (required)</li>
      <li><code>lang</code>: Language (optional, e.g., "eng", "chi_sim", "jpn")</li>
    </ul>
    <pre>curl -X POST -F "file=@image.png" -F "lang=chi_sim" http://localhost:8080/ocr</pre>
  </div>

  <div class="endpoint">
    <h2>POST /ocr/batch</h2>
    <p>OCR multiple files (multipart/form-data)</p>
    <p>Parameters:</p>
    <ul>
      <li><code>files[]</code>: Multiple files (required)</li>
      <li><code>lang</code>: Language (optional)</li>
    </ul>
  </div>

  <div class="endpoint">
    <h2>POST /ocr/table</h2>
    <p>OCR and extract table (CSV or JSON)</p>
    <p>Parameters:</p>
    <ul>
      <li><code>file</code>: Image file (required)</li>
      <li><code>format</code>: "csv" or "json" (default: "json")</li>
    </ul>
  </div>
</body>
</html>
  `.trim();

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}

async function handleOcr(req: http.IncomingMessage, res: http.ServerResponse, _url: URL): Promise<void> {
  const contentType = req.headers["content-type"] || "";

  if (!contentType.includes("multipart/form-data")) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Content-Type must be multipart/form-data" }));
    return;
  }

  const parts = await parseMultipart(req);
  const filePart = parts.find(p => p.name === "file");
  const lang = parts.find(p => p.name === "lang")?.data.toString("utf-8") || undefined;

  if (!filePart) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No file provided" }));
    return;
  }

  // 保存临时文件
  const tempPath = path.join(os.tmpdir(), `http_ocr_${Date.now()}_${filePart.filename || "image"}`);

  try {
    fs.writeFileSync(tempPath, filePart.data);

    const server = await discoverOCRServer();
    if (!server) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "OCR server not found" }));
      return;
    }

    const client = new IOSClient(server.host, server.port);
    const result = await client.ocrImage(tempPath, lang);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } finally {
    // 清理临时文件
    try {
      fs.unlinkSync(tempPath);
    } catch { /* ignore */ }
  }
}

async function handleOcrBatch(req: http.IncomingMessage, res: http.ServerResponse, _url: URL): Promise<void> {
  const parts = await parseMultipart(req);
  const files = parts.filter(p => p.name === "files[]" || p.name === "file");
  const lang = parts.find(p => p.name === "lang")?.data.toString("utf-8") || undefined;

  if (files.length === 0) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No files provided" }));
    return;
  }

  // 保存临时文件
  const tempPaths: string[] = [];

  try {
    for (const file of files) {
      const tempPath = path.join(os.tmpdir(), `http_batch_${Date.now()}_${file.filename || "file"}`);
      fs.writeFileSync(tempPath, file.data);
      tempPaths.push(tempPath);
    }

    const results = await batchOCR(tempPaths, { lang });

    // 返回结果（不包括临时路径）
    const cleanResults = results.map(r => ({
      file: path.basename(r.file),
      success: r.success,
      text: r.text,
      error: r.error,
      page: r.page
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ results: cleanResults }));
  } finally {
    // 清理临时文件
    for (const tempPath of tempPaths) {
      try {
        fs.unlinkSync(tempPath);
      } catch { /* ignore */ }
    }
  }
}

async function handleOcrTable(req: http.IncomingMessage, res: http.ServerResponse, _url: URL): Promise<void> {
  const parts = await parseMultipart(req);
  const filePart = parts.find(p => p.name === "file");
  const format = parts.find(p => p.name === "format")?.data.toString("utf-8") || "json";

  if (!filePart) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No file provided" }));
    return;
  }

  // 保存临时文件
  const tempPath = path.join(os.tmpdir(), `http_table_${Date.now()}_${filePart.filename || "image"}`);

  try {
    fs.writeFileSync(tempPath, filePart.data);

    const server = await discoverOCRServer();
    if (!server) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "OCR server not found" }));
      return;
    }

    const client = new IOSClient(server.host, server.port);
    const result = await client.ocrImage(tempPath);

    if (!result.success || !result.text) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: result.error || "OCR failed" }));
      return;
    }

    const tableResult = detectAndExtractTable(result.text, format as "csv" | "json");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(tableResult));
  } finally {
    // 清理临时文件
    try {
      fs.unlinkSync(tempPath);
    } catch { /* ignore */ }
  }
}

async function parseMultipart(req: http.IncomingMessage): Promise<MultipartPart[]> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks);
        const contentType = req.headers["content-type"] || "";
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
        const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : null;

        if (!boundary) {
          reject(new Error("No boundary found"));
          return;
        }

        const parts = parseMultipartBody(body, boundary);
        resolve(parts);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function parseMultipartBody(body: Buffer, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const boundaryBuffer = Buffer.from("--" + boundary);
  const endBoundary = Buffer.from("--" + boundary + "--");

  let pos = 0;

  while (pos < body.length) {
    // 找到下一个边界
    const boundaryIndex = indexOf(body, boundaryBuffer, pos);
    if (boundaryIndex === -1) break;

    // 跳过边界和 CRLF
    pos = boundaryIndex + boundaryBuffer.length;
    if (body[pos] === 0x0D) pos++; // \r
    if (body[pos] === 0x0A) pos++; // \n

    // 检查是否是结束边界
    if (pos + 2 <= body.length && body[pos] === 0x2D && body[pos + 1] === 0x2D) {
      break;
    }

    // 解析头部
    const headerEnd = indexOf(body, Buffer.from("\r\n\r\n"), pos);
    if (headerEnd === -1) break;

    const headerStr = body.slice(pos, headerEnd).toString("utf-8");
    pos = headerEnd + 4;

    // 提取字段信息
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

    if (!nameMatch) {
      pos = indexOf(body, boundaryBuffer, pos);
      if (pos === -1) break;
      continue;
    }

    const name = nameMatch[1];
    const filename = filenameMatch ? filenameMatch[1] : undefined;
    const contentType = contentTypeMatch ? contentTypeMatch[1] : undefined;

    // 找到数据结束位置（下一个边界）
    const nextBoundary = indexOf(body, boundaryBuffer, pos);
    const dataEnd = nextBoundary !== -1 ? nextBoundary - 2 : body.length; // 去掉末尾 CRLF

    const data = body.slice(pos, dataEnd);

    parts.push({ name, filename, data, contentType });

    pos = nextBoundary !== -1 ? nextBoundary : body.length;
  }

  return parts;
}

function indexOf(buffer: Buffer, search: Buffer, start: number = 0): number {
  for (let i = start; i <= buffer.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buffer[i + j] !== search[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}

// Standalone HTTP server mode
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const portArg = args.find(a => a.startsWith("--port="));
  const port = portArg ? parseInt(portArg.split("=")[1], 10) : 8080;

  console.log(`[gstack-ocr] Starting HTTP server on port ${port}...`);
  await startHttpServer({ port });
}
