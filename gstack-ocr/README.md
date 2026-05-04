# gstack-ocr

MCP server for OCR integration with AI agents. Provides OCR capabilities by connecting to iOS OCR Server with automatic fallback to Tesseract CLI.

## Features

- **Three-level service discovery**: Automatically discovers available OCR services
  1. iOS OCR Server (192.168.50.225:8150)
  2. Local iOS OCR Server (localhost:8150)
  3. Tesseract CLI (fallback)

- **Multiple OCR methods**:
  - Image OCR (PNG, JPG, JPEG, BMP, TIFF)
  - PDF OCR (extracts images from scanned PDFs)
  - URL-based OCR (download and process remote images)

- **Language support**: English, Chinese (Simplified), and automatic detection

- **Automatic fallback**: Seamlessly switches to Tesseract if iOS OCR is unavailable

## Installation

```bash
npm install
npm run build
```

## Usage

### As MCP Server

Configure in your MCP client:

```json
{
  "mcpServers": {
    "gstack-ocr": {
      "command": "node",
      "args": ["./dist/index.js"]
    }
  }
}
```

### Available Tools

#### ocr_image

Perform OCR on an image file.

```typescript
await server.callTool({
  name: "ocr_image",
  arguments: {
    imagePath: "/path/to/image.png",
    language: "auto",  // "en", "zh-CN", or "auto"
    enhance: true
  }
});
```

#### ocr_pdf

Perform OCR on a PDF file.

```typescript
await server.callTool({
  name: "ocr_pdf",
  arguments: {
    pdfPath: "/path/to/document.pdf",
    language: "auto",
    pages: [1, 2, 3]  // Optional: specific pages
  }
});
```

#### ocr_url

Perform OCR on an image from a URL.

```typescript
await server.callTool({
  name: "ocr_url",
  arguments: {
    url: "https://example.com/image.png",
    language: "auto"
  }
});
```

#### ocr_health

Check OCR service health status.

```typescript
await server.callTool({
  name: "ocr_health",
  arguments: {
    detailed: true
  }
});
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `IOS_OCR_URL` | iOS OCR Server URL | `http://192.168.50.225:8150` |

### Service Discovery

The server automatically discovers available OCR services:

1. **iOS OCR Server** - Primary service at 192.168.50.225:8150
2. **Local iOS OCR** - Fallback to localhost:8150
3. **Tesseract CLI** - Last resort fallback (must be installed)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Requirements

- Node.js >= 18.0.0
- Optional: Tesseract CLI (for fallback)

### Tesseract Installation

**macOS:**
```bash
brew install tesseract
```

**Ubuntu/Debian:**
```bash
sudo apt-get install tesseract-ocr
```

**Windows:**
Download from [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki)

## License

MIT
