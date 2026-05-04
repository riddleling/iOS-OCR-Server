import { readOCRConfig, OCRConfig } from "./config";
import { discoverMdns } from "./mdns";
import { scanNetwork } from "./scanner";

export interface OCRServer {
  host: string;
  port: number;
}

// 缓存：server 信息 + 过期时间
interface CacheEntry {
  server: OCRServer;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟缓存

export async function discoverOCRServer(
  config?: OCRConfig
): Promise<OCRServer | null> {
  // 检查缓存
  if (cache && Date.now() < cache.expiresAt) {
    console.debug("[OCR Discovery] Using cached server:", cache.server);
    return cache.server;
  }

  // 1. 配置文件 (最优先)
  const configServer = readOCRConfig(config);
  if (configServer) {
    console.debug("[OCR Discovery] Found in config:", configServer);
    cache = { server: configServer, expiresAt: Date.now() + CACHE_TTL_MS };
    return configServer;
  }

  // 2. mDNS (开发中)
  const mdnsServer = await discoverMdns();
  if (mdnsServer) {
    console.debug("[OCR Discovery] Found via mDNS:", mdnsServer);
    cache = { server: mdnsServer, expiresAt: Date.now() + CACHE_TTL_MS };
    return mdnsServer;
  }

  // 3. 网络扫描 (使用配置的子网)
  const subnets = config?.scanSubnets || ["192.168.50", "192.168.1", "192.168.0"];
  const scanServer = await scanNetwork(subnets);
  if (scanServer) {
    console.debug("[OCR Discovery] Found via scan:", scanServer);
    cache = { server: scanServer, expiresAt: Date.now() + CACHE_TTL_MS };
    return scanServer;
  }

  console.debug("[OCR Discovery] No OCR server found");
  return null;
}

// 清除缓存 (用于测试或强制刷新)
export function clearDiscoveryCache(): void {
  cache = null;
}
