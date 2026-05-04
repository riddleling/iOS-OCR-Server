/**
 * Tesseract CLI Fallback
 *
 * Provides OCR capability using tesseract CLI when iOS OCR Server is unavailable.
 * Supports multiple languages and automatic language detection.
 */

export class TesseractFallback {
  private readonly langMap: Record<string, string> = {
    en: "eng",
    "zh-CN": "chi_sim+eng",
    auto: "eng+chi_sim",
  };

  async ocrImage(imagePath: string, language: string = "auto"): Promise<string> {
    const lang = this.langMap[language] || this.langMap.auto;

    try {
      const proc = Bun.spawn({
        cmd: [
          "tesseract",
          imagePath,
          "stdout",
          "-l",
          lang,
          "--psm",
          "3",
          "tsv",
        ],
        stdout: "pipe",
        stderr: "pipe",
      });

      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);

      const exitCode = proc.exitCode;

      if (exitCode !== 0) {
        throw new Error(`Tesseract failed: ${stderr}`);
      }

      return this.parseTSV(stdout);
    } catch (error) {
      throw new Error(`Tesseract OCR failed: ${error}`);
    }
  }

  private parseTSV(tsvOutput: string): string {
    const lines = tsvOutput.trim().split("\n");
    if (lines.length <= 1) {
      return "";
    }

    // Skip header line, extract text from each row
    const texts: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i].split("\t");
      if (fields.length >= 3) {
        const text = fields[3]?.trim();
        if (text) {
          texts.push(text);
        }
      }
    }

    return texts.join(" ").trim();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const proc = Bun.spawn({
        cmd: ["tesseract", "--version"],
        stdout: "pipe",
        stderr: "pipe",
      });

      await proc.exited;
      return proc.exitCode === 0;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const proc = Bun.spawn({
        cmd: ["tesseract", "--version"],
        stdout: "pipe",
        stderr: "pipe",
      });

      const output = await new Response(proc.stdout).text();
      const match = output.match(/tesseract\s+v?([\d.]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
