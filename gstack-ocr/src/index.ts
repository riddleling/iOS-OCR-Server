#!/usr/bin/env node

/**
 * gstack-ocr MCP Server
 *
 * An MCP server that provides OCR capabilities by connecting to iOS OCR Server
 * (192.168.50.225:8150) with automatic fallback to tesseract CLI.
 *
 * Features:
 * - Three-level service discovery (iOS OCR -> localhost -> tesseract CLI)
 * - Image OCR with language detection
 * - PDF OCR support
 * - Automatic fallback mechanism
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { IOSOCRClient } from "./ios-ocr-client.js";
import { TesseractFallback } from "./tesseract-fallback.js";
import { ServiceDiscovery } from "./service-discovery.js";
import { PDFProcessor } from "./pdf-processor.js";

// Tool schemas
const OCRImageSchema = z.object({
  imagePath: z.string().describe("Path to the image file to OCR"),
  language: z.enum(["en", "zh-CN", "auto"]).default("auto").describe("Language for OCR"),
  enhance: z.boolean().default(true).describe("Enhance image before OCR"),
});

const OCRPDFSchema = z.object({
  pdfPath: z.string().describe("Path to the PDF file to OCR"),
  language: z.enum(["en", "zh-CN", "auto"]).default("auto").describe("Language for OCR"),
  pages: z.array(z.number()).optional().describe("Specific pages to OCR (1-indexed)"),
});

const OCRUrlSchema = z.object({
  url: z.string().url().describe("URL of the image to OCR"),
  language: z.enum(["en", "zh-CN", "auto"]).default("auto").describe("Language for OCR"),
});

const HealthCheckSchema = z.object({
  detailed: z.boolean().default(false).describe("Show detailed status"),
});

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "ocr_image",
    description: "Perform OCR on an image file. Supports PNG, JPG, JPEG, BMP, TIFF formats. Uses iOS OCR Server by default with automatic fallback to tesseract CLI.",
    inputSchema: {
      type: "object",
      properties: {
        imagePath: {
          type: "string",
          description: "Path to the image file to OCR",
        },
        language: {
          type: "string",
          enum: ["en", "zh-CN", "auto"],
          default: "auto",
          description: "Language for OCR. 'auto' detects language automatically.",
        },
        enhance: {
          type: "boolean",
          default: true,
          description: "Enhance image before OCR for better results",
        },
      },
      required: ["imagePath"],
    },
  },
  {
    name: "ocr_pdf",
    description: "Perform OCR on a PDF file. Extracts text from scanned PDFs by converting pages to images first.",
    inputSchema: {
      type: "object",
      properties: {
        pdfPath: {
          type: "string",
          description: "Path to the PDF file to OCR",
        },
        language: {
          type: "string",
          enum: ["en", "zh-CN", "auto"],
          default: "auto",
          description: "Language for OCR. 'auto' detects language automatically.",
        },
        pages: {
          type: "array",
          items: { type: "number" },
          description: "Specific pages to OCR (1-indexed). If not specified, all pages are processed.",
        },
      },
      required: ["pdfPath"],
    },
  },
  {
    name: "ocr_url",
    description: "Perform OCR on an image from a URL. Downloads the image and extracts text.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          format: "uri",
          description: "URL of the image to OCR",
        },
        language: {
          type: "string",
          enum: ["en", "zh-CN", "auto"],
          default: "auto",
          description: "Language for OCR. 'auto' detects language automatically.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "ocr_health",
    description: "Check the health status of OCR services. Shows which services are available and their response times.",
    inputSchema: {
      type: "object",
      properties: {
        detailed: {
          type: "boolean",
          default: false,
          description: "Show detailed status including latency and capabilities",
        },
      },
    },
  },
];

class GStackOCRServer {
  private server: Server;
  private iosClient: IOSOCRClient;
  private tesseractFallback: TesseractFallback;
  private serviceDiscovery: ServiceDiscovery;
  private pdfProcessor: PDFProcessor;
  private primaryService: "ios" | "tesseract" = "ios";

  constructor() {
    this.server = new Server(
      {
        name: "gstack-ocr",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.serviceDiscovery = new ServiceDiscovery();
    this.iosClient = new IOSOCRClient();
    this.tesseractFallback = new TesseractFallback();
    this.pdfProcessor = new PDFProcessor();

    this.setupHandlers();
  }

  private setupHandlers() {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOLS };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "ocr_image":
            return await this.handleOCRImage(args as z.infer<typeof OCRImageSchema>);

          case "ocr_pdf":
            return await this.handleOCRPDF(args as z.infer<typeof OCRPDFSchema>);

          case "ocr_url":
            return await this.handleOCRUrl(args as z.infer<typeof OCRUrlSchema>);

          case "ocr_health":
            return await this.handleHealthCheck(args as z.infer<typeof HealthCheckSchema>);

          default:
            return {
              content: [
                {
                  type: "text",
                  text: `Unknown tool: ${name}`,
                },
              ],
              isError: true,
            };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error: ${message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleOCRImage(args: z.infer<typeof OCRImageSchema>) {
    const { imagePath, language, enhance } = args;

    // Try iOS OCR Server first
    const discoveryResult = await this.serviceDiscovery.discover();

    if (discoveryResult.iosAvailable) {
      this.primaryService = "ios";
      try {
        const result = await this.iosClient.ocrImage(imagePath, language, enhance);
        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      } catch (error) {
        console.error("iOS OCR failed, falling back to tesseract:", error);
      }
    }

    // Fallback to tesseract CLI
    this.primaryService = "tesseract";
    if (discoveryResult.tesseractAvailable) {
      const result = await this.tesseractFallback.ocrImage(imagePath, language);
      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    }

    // Both services unavailable
    return {
      content: [
        {
          type: "text",
          text: "Error: No OCR service available. iOS OCR Server unreachable and tesseract CLI not found. Please ensure either service is running.",
        },
      ],
      isError: true,
    };
  }

  private async handleOCRPDF(args: z.infer<typeof OCRPDFSchema>) {
    const { pdfPath, language, pages } = args;

    // Extract images from PDF
    const images = await this.pdfProcessor.extractImages(pdfPath, pages);

    const results: string[] = [];
    const pageNumbers = pages || Array.from({ length: images.length }, (_, i) => i + 1);

    for (let i = 0; i < images.length; i++) {
      const pageNum = pageNumbers[i];
      try {
        const text = await this.handleOCRImage({
          imagePath: images[i],
          language,
          enhance: true,
        });
        results.push(`--- Page ${pageNum} ---\n${(text.content[0] as { text: string }).text}`);
      } catch (error) {
        results.push(`--- Page ${pageNum} ---\nOCR failed: ${error}`);
      }
    }

    return {
      content: [
        {
          type: "text",
          text: results.join("\n\n"),
        },
      ],
    };
  }

  private async handleOCRUrl(args: z.infer<typeof OCRUrlSchema>) {
    const { url, language } = args;

    // Download image first
    const tempPath = await this.iosClient.downloadImage(url);
    try {
      return await this.handleOCRImage({
        imagePath: tempPath,
        language,
        enhance: true,
      });
    } finally {
      // Clean up temp file
      try {
        await import("fs").then((fs) => fs.promises.unlink(tempPath));
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async handleHealthCheck(args: z.infer<typeof HealthCheckSchema>) {
    const { detailed } = args;
    const discoveryResult = await this.serviceDiscovery.discover();

    const status = {
      primaryService: this.primaryService,
      services: {
        ios: {
          available: discoveryResult.iosAvailable,
          latency: discoveryResult.iosLatency,
          url: discoveryResult.iosUrl,
        },
        tesseract: {
          available: discoveryResult.tesseractAvailable,
          version: discoveryResult.tesseractVersion,
        },
      },
    };

    if (detailed) {
      return {
        content: [
          {
            type: "text",
            text: `OCR Service Health Status\n\nPrimary: ${status.primaryService}\n\niOS OCR Server:\n  Available: ${status.services.ios.available}\n  URL: ${status.services.ios.url}\n  Latency: ${status.services.ios.latency ? `${status.services.ios.latency}ms` : "N/A"}\n\nTesseract CLI:\n  Available: ${status.services.tesseract.available}\n  Version: ${status.services.tesseract.version || "N/A"}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `OCR Service: ${status.primaryService === "ios" ? "iOS OCR Server" : "Tesseract"} (${status.services.ios.available || status.services.tesseract.available ? "operational" : "degraded"})`,
        },
      ],
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("gstack-ocr MCP server started");
  }
}

// Start server
const server = new GStackOCRServer();
server.start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
