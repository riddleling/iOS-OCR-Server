/**
 * Three-Level Service Discovery
 *
 * Discovers available OCR services in priority order:
 * 1. iOS OCR Server (192.168.50.225:8150)
 * 2. Local iOS OCR Server (localhost:8150)
 * 3. Tesseract CLI (fallback)
 */

export interface DiscoveryResult {
  iosAvailable: boolean;
  iosUrl: string;
  iosLatency: number | null;
  tesseractAvailable: boolean;
  tesseractVersion: string | null;
}

export class ServiceDiscovery {
  private readonly iosUrls = [
    "http://192.168.50.225:8150",
    "http://localhost:8150",
  ];

  async discover(): Promise<DiscoveryResult> {
    const [iosResult, tesseractResult] = await Promise.all([
      this.discoverIOS(),
      this.discoverTesseract(),
    ]);

    return {
      ...iosResult,
      ...tesseractResult,
    };
  }

  private async discoverIOS(): Promise<{
    iosAvailable: boolean;
    iosUrl: string;
    iosLatency: number | null;
  }> {
    for (const url of this.iosUrls) {
      const result = await this.checkIOSServer(url);
      if (result.available) {
        return {
          iosAvailable: true,
          iosUrl: url,
          iosLatency: result.latency,
        };
      }
    }

    return {
      iosAvailable: false,
      iosUrl: this.iosUrls[0],
      iosLatency: null,
    };
  }

  private async checkIOSServer(
    url: string
  ): Promise<{ available: boolean; latency: number | null }> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${url}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return {
          available: true,
          latency: Date.now() - start,
        };
      }
    } catch {
      // Server not available
    }

    return {
      available: false,
      latency: null,
    };
  }

  private async discoverTesseract(): Promise<{
    tesseractAvailable: boolean;
    tesseractVersion: string | null;
  }> {
    try {
      const proc = Bun.spawn({
        cmd: ["tesseract", "--version"],
        stdout: "pipe",
        stderr: "pipe",
      });

      const output = await new Response(proc.stdout).text();
      const versionMatch = output.match(/tesseract\s+v?([\d.]+)/);

      return {
        tesseractAvailable: true,
        tesseractVersion: versionMatch ? versionMatch[1] : null,
      };
    } catch {
      return {
        tesseractAvailable: false,
        tesseractVersion: null,
      };
    }
  }
}
