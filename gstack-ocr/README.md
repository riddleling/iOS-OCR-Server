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

### 基础识别

```javascript
// 识别图片
ocr(input="/path/to/image.png")

// 识别 PDF
ocr(input="/path/to/file.pdf", pages="1-5")

// 截图 OCR
ocr(screenshot=true)

// 区域截图 OCR
ocr(screenshot=true, region={"x": 100, "y": 100, "width": 800, "height": 600})

// 剪贴板图片 OCR
ocr(clipboard=true)

// 网页 OCR
ocr(url="https://example.com")
```

### 多语言识别

```javascript
// 英文
ocr(input="english.png", lang="eng")

// 简体中文
ocr(input="chinese.png", lang="chi_sim")

// 繁体中文
ocr(input="taiwan.png", lang="chi_tra")

// 日文
ocr(input="japanese.png", lang="jpn")

// 韩文
ocr(input="korean.png", lang="kor")

// 德文
ocr(input="german.png", lang="deu")

// 法文
ocr(input="french.png", lang="fra")

// 西班牙文
ocr(input="spanish.png", lang="spa")

// 混合语言
ocr(input="mixed.png", lang="eng+chi_sim")
```

**支持的语言**: eng, chi_sim, chi_tra, jpn, kor, fra, deu, spa, por, ita, rus, dut, pol, vie, tha, ara, tur, gre, heb, hin

### 批量处理

```javascript
// 批量识别多个文件
ocr(files=["a.png", "b.jpg", "c.pdf"])

// 批量识别指定页码
ocr(files=["doc.pdf"], pages="1-3")

// 批量 + 多语言
ocr(files=["eng1.png", "eng2.png"], lang="eng")

// 批量 + 降级
ocr(files=["a.png", "b.png"], fallback=true)
```

### 表格提取

```javascript
// 提取表格 (JSON 格式)
ocr(input="table.png", table=true)

// 提取表格 (CSV 格式)
ocr(input="table.png", table=true, tableFormat="csv")

// 从截图提取表格
ocr(screenshot=true, table=true)
```

**输出示例**:
```json
[
  {"Name": "John", "Age": "30", "City": "NYC"},
  {"Name": "Jane", "Age": "25", "City": "LA"}
]
```

### 对比模式

```javascript
// 对比两张图片的 OCR 差异
ocr(compare={
  before: "before.png",
  after: "after.png"
})

// 对比 + 指定语言
ocr(compare={
  before: "en_before.png",
  after: "en_after.png"
}, lang="eng")
```

**输出**:
- 新增的行 (+)
- 删除的行 (-)
- 修改的行 (~)
- 相似度百分比

### HTTP API 服务器

```javascript
// 启动 HTTP 服务器 (默认端口 8080)
ocr(httpServer=true)

// 自定义端口
ocr(httpServer=true, httpPort=9000)
```

**HTTP API 端点**:

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 检查 OCR 服务状态 |
| `/ocr` | POST | OCR 单个图片 (multipart) |
| `/ocr/batch` | POST | OCR 多个图片 (multipart) |
| `/ocr/table` | POST | OCR 并提取表格 (multipart) |

**curl 示例**:

```bash
# 健康检查
curl http://localhost:8080/health

# OCR 单个图片
curl -X POST -F "file=@image.png" -F "lang=chi_sim" http://localhost:8080/ocr

# OCR 批量文件
curl -X POST -F "files[]=@a.png" -F "files[]=@b.png" http://localhost:8080/ocr/batch

# OCR 表格提取
curl -X POST -F "file=@table.png" -F "format=csv" http://localhost:8080/ocr/table
```

### 降级

当 iOS OCR 不可用且 `fallback: true`:

```javascript
ocr(input="/path/to/image.png", fallback=true)
```

- Linux/Mac: 使用 `tesseract` CLI
- Windows: 需要安装 tesseract

```bash
# Linux/Mac
apt install tesseract-ocr tesseract-ocr-chi-sim poppler-utils

# Windows (使用 chocolatey)
choco install tesseract tesseract-lang
```

## 新功能

### 截图 OCR (`screenshot`)
截取当前屏幕并识别文字。自动检测平台:
- macOS: `screencapture`
- Linux: `gnome-screenshot` 或 ImageMagick `import`
- Windows: PowerShell System.Drawing

### 区域截图 OCR (`screenshot` + `region`)
截取屏幕指定区域并识别文字:
```javascript
ocr(screenshot=true, region={"x": 100, "y": 100, "width": 800, "height": 600})
```

### 剪贴板 OCR (`clipboard`)
从剪贴板获取图片并识别文字。适用于截图后直接 OCR:
```javascript
ocr(clipboard=true)
```

### 网页 OCR (`url`)
抓取网页并识别文字。优先截图，失败则降级提取纯文本。

安装截图工具:
```bash
# Linux
sudo apt install wkhtmltoimage cutycapt gnome-screenshot imagemagick

# macOS
brew install wkhtmltopdf

# Windows (使用 chocolatey)
choco install wkhtmltopdf
```

### 多语言 OCR (`lang`)
指定识别语言，支持 20+ 种语言:
```javascript
ocr(input="japanese.png", lang="jpn")
ocr(input="mixed.png", lang="eng+chi_sim")
```

### 批量 OCR (`files`)
一次处理多个文件:
```javascript
ocr(files=["a.png", "b.pdf", "c.jpg"])
```

### 表格提取 (`table`)
从 OCR 结果中提取表格结构:
```javascript
ocr(input="table.png", table=true, tableFormat="csv")
```

### 对比 OCR (`compare`)
比较两张图片的文字差异:
```javascript
ocr(compare={before: "v1.png", after: "v2.png"})
```

### 手写识别模式 (`mode`)
切换识别模式:
```javascript
// 印刷体识别 (默认)
ocr(input="document.png", mode="printed")

// 手写体识别
ocr(input="handwritten.png", mode="handwritten")

// 自动检测
ocr(input="any.png", mode="auto")
```

### 条码检测 (`detectCodes`)
检测图片中的二维码和条形码:
```javascript
// 检测并输出条码
ocr(input="qrcode.png", detectCodes=true)

// JSON 格式输出条码信息
ocr(input="receipt.png", detectCodes=true, json=true)
```

### Agent JSON 模式 (`json`)
输出结构化 JSON 格式，便于 AI agent 处理:
```javascript
// 获取 JSON 格式结果
ocr(input="document.png", json=true)
```

**JSON 输出示例**:
```json
{
  "success": true,
  "text": "识别的文字内容...",
  "table": {
    "format": "json",
    "rows": [...]
  },
  "category": {
    "category": "receipt",
    "confidence": 0.8,
    "extractedFields": {
      "amounts": ["¥25.00", "¥12.50"],
      "dates": ["2024-01-15"]
    }
  },
  "barcodes": [
    { "type": "qr", "value": "https://example.com", "format": "QR" }
  ]
}
```

### 内容分类 (`category`)
自动识别文档类型并提取结构化信息:
```javascript
// 识别内容类型
ocr(input="receipt.png", category=true)

// 获取详细分类和提取字段
ocr(input="business_card.png", category=true, json=true)
```

**支持的类型**:
| 类型 | 识别特征 |
|------|----------|
| `receipt` | 收据/发票 - 金额、日期、合计 |
| `business_card` | 名片 - 职位、电话、邮箱 |
| `document` | 长文档 - 多行文本 |
| `screenshot` | 截图 - UI 文本、按钮文字 |
| `handwritten` | 手写内容 - 中英混合 |
| `mixed` | 混合内容 |
| `unknown` | 未知类型 |

### HTTP API (`httpServer`)
提供 HTTP REST API 接口:
```javascript
ocr(httpServer=true, httpPort=8080)
```

## 自动发现

优先级:
1. 配置文件中的 `ocr.host`
2. mDNS 服务发现 (待实现)
3. 扫描配置的子网

**发现结果缓存 5 分钟**，避免重复扫描。

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

## 启动 HTTP 服务器

```bash
# MCP 模式 (默认)
npm start

# 或直接运行 HTTP 服务器
node dist/http-server.js
node dist/http-server.js --port=9000
```
