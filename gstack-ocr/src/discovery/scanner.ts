import * as net from "net";

const DEFAULT_PORT = 8150;
const SCAN_TIMEOUT = 200; // ms

export async function scanNetwork(
  subnets: string[] = ["192.168.50", "192.168.1", "192.168.0"]
): Promise<{ host: string; port: number } | null> {
  for (const subnet of subnets) {
    console.debug(`[OCR Scan] Scanning subnet ${subnet}.0/24...`);
    const host = await scanSubnet(subnet);
    if (host) {
      return { host, port: DEFAULT_PORT };
    }
  }
  return null;
}

async function scanSubnet(subnet: string): Promise<string | null> {
  // 分批扫描，避免同时 254 个连接
  const BATCH_SIZE = 50;
  const hosts: string[] = [];

  for (let i = 1; i < 255; i++) {
    hosts.push(`${subnet}.${i}`);
  }

  for (let i = 0; i < hosts.length; i += BATCH_SIZE) {
    const batch = hosts.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(checkHost));

    const found = results.find(h => h !== null);
    if (found) {
      return found;
    }
  }

  return null;
}

async function checkHost(host: string): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(null);
      }
    };

    socket.setTimeout(SCAN_TIMEOUT);

    socket.on("connect", () => cleanup());
    socket.on("timeout", cleanup);
    socket.on("error", cleanup);

    socket.connect(DEFAULT_PORT, host);
  });
}
