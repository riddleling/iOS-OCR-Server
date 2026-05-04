/**
 * PDF Processor
 *
 * Extracts images from PDF files for OCR processing.
 * Supports specific page selection and full PDF processing.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

export class PDFProcessor {
  async extractImages(
    pdfPath: string,
    pages?: number[]
  ): Promise<string[]> {
    const pdfData = await readFile(pdfPath);

    // Use pdf-parse to extract page count and content
    const pdfParse = await import("pdf-parse");
    const pdfInfo = await pdfParse.default(pdfData);

    const totalPages = pdfInfo.numpages;
    const targetPages = pages || Array.from({ length: totalPages }, (_, i) => i + 1);

    const tempFiles: string[] = [];

    // For each target page, we'll convert to image using a temporary approach
    // Note: Full PDF-to-image conversion would require additional dependencies
    // like pdf2pic or node-canvas. For now, we'll try to extract any embedded images.
    for (const pageNum of targetPages) {
      if (pageNum < 1 || pageNum > totalPages) {
        continue;
      }

      try {
        // Try to find images in the page
        const images = await this.extractPageImages(pdfData, pageNum);

        if (images.length > 0) {
          tempFiles.push(...images);
        } else {
          // If no images found, create a placeholder for OCR on text
          // This would need a PDF renderer - mark as needing manual processing
          console.warn(`Page ${pageNum}: No images found, requires PDF rendering`);
        }
      } catch (error) {
        console.error(`Failed to extract images from page ${pageNum}:`, error);
      }
    }

    return tempFiles;
  }

  private async extractPageImages(pdfData: Buffer, pageNum: number): Promise<string[]> {
    // Basic PDF image extraction - looks for JPEG/PNG streams
    // This is a simplified implementation
    const content = pdfData.toString("binary");
    const images: string[] = [];

    // Find stream objects that might be images
    const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
    let match;

    while ((match = streamRegex.exec(content)) !== null) {
      const streamContent = match[1];

      // Check for JPEG marker (FFD8FF)
      if (streamContent.includes("\xFF\xD8\xFF")) {
        const startIndex = streamContent.indexOf("\xFF\xD8\xFF");
        const jpegData = streamContent.slice(startIndex);

        if (jpegData.length > 1000) {
          // Likely a real image
          const tempPath = join(tmpdir(), `pdf_page_${pageNum}_${randomUUID()}.jpg`);
          await writeFile(tempPath, Buffer.from(jpegData, "binary"));
          images.push(tempPath);
        }
      }
    }

    return images;
  }

  async getPageCount(pdfPath: string): Promise<number> {
    const pdfData = await readFile(pdfPath);
    const pdfParse = await import("pdf-parse");
    const pdfInfo = await pdfParse.default(pdfData);
    return pdfInfo.numpages;
  }
}
