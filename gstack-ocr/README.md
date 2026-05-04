# gstack-ocr

MCP server for iOS OCR Server integration.

## 安装

```bash
npm install
npm run build
```

## 配置

在 `~/.gstack/config.yaml` 中配置:

```yaml
ocr:
  host: "192.168.50.225"  # 可选，自动发现优先
  port: 8150
  fallback: true           # 降级开关
  scanSubnets:            # 自定义扫描子网
    - "192.168.50"
    - "192.168.1"
    - "10.0.0"
```

## 使用

在 Claude Code 或 gstack 中使用 `ocr` 工具:

```
识别图片:
- ocr(input="/path/to/image.png")

识别 PDF:
- ocr(input="/path/to/file.pdf", pages="1-5")

截图 OCR:
- ocr(screenshot=true)

网页 OCR:
- ocr(url="https://example.com")

启用降级:
- ocr(input="/path/to/image.png", fallback=true)
```

## 新功能

### 截图 OCR (`screenshot`)
截取当前屏幕并识别文字。自动检测平台:
- macOS: `screencapture`
- Linux: `gnome-screenshot` 或 ImageMagick `import`
- Windows: PowerShell System.Drawing

### 网页 OCR (`url`)
抓取网页并识别文字。优先截图，失败则降级提取纯文本。自动检测平台:
- macOS/Linux: `wkhtmltoimage` 或 `cutycapt`
- Windows: PowerShell 下载并提取纯文本

安装截图工具:
```bash
# Linux
sudo apt install wkhtmltoimage cutycapt gnome-screenshot imagemagick

# macOS
brew install wkhtmltopdf

# Windows (使用 chocolatey)
choco install wkhtmltopdf
```

## 自动发现

优先级:
1. 配置文件中的 `ocr.host`
2. mDNS 服务发现 (待实现)
3. 扫描配置的子网

**发现结果缓存 5 分钟**，避免重复扫描。

## 降级

当 iOS OCR 不可用且 `fallback: true`:
- Linux/Mac: 使用 `tesseract` CLI
- Windows: 需要安装 tesseract

```bash
# Linux/Mac
apt install tesseract-ocr tesseract-ocr-chi-sim poppler-utils

# Windows (使用 chocolatey)
choco install tesseract tesseract-lang
```

## Windows PDF 支持

Windows 下 PDF OCR 需要安装 pdfjs-dist:

```bash
npm install pdfjs-dist
```

## 开发

```bash
npm run dev    # 开发模式
npm run build  # 构建
```
