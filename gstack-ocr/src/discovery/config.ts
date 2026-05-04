import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface OCRConfig {
  enabled?: boolean;
  host?: string;
  port?: number;
  fallback?: boolean;
  scanSubnets?: string[]; // 新增：可配置的扫描子网
}

const DEFAULT_PORT = 8150;

export function readOCRConfig(config?: OCRConfig): { host: string; port: number } | null {
  // 1. 直接传入的配置
  if (config?.host) {
    return {
      host: config.host,
      port: config.port || DEFAULT_PORT
    };
  }

  // 2. 从 ~/.gstack/config.yaml 读取
  const configPath = path.join(os.homedir(), ".gstack", "config.yaml");

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");

    // 匹配 ocr.host
    const hostMatch = content.match(/^\s*host:\s*["']?([^"'\n]+)/m);
    // 匹配 ocr.port
    const portMatch = content.match(/^\s*port:\s*(\d+)/m);
    // 匹配 ocr.scanSubnets (YAML 数组格式)
    const subnetsMatch = content.match(/scanSubnets:\s*\n((?:\s*-\s*.+\n?)+)/);

    if (hostMatch) {
      const host = hostMatch[1].trim();

      // 解析子网配置
      let scanSubnets: string[] | undefined;
      if (subnetsMatch) {
        scanSubnets = subnetsMatch[1]
          .split("\n")
          .map(line => line.match(/-?\s*["']?([^"'\n]+)/)?.[1]?.trim())
          .filter(Boolean) as string[];
      }

      return {
        host,
        port: portMatch ? parseInt(portMatch[1], 10) : DEFAULT_PORT
      };
    }
  } catch (err) {
    console.debug("[OCR Config] Failed to read config:", err);
  }

  return null;
}
