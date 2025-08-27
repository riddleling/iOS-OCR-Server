//
//  VaporServer.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/21.
//

import Vapor
import Vision

struct OCRBoxItem: Content {
    let text: String
    let x: Double
    let y: Double
    let w: Double
    let h: Double
}

struct OCRResult: Content {
    let text: String
    let image_width: Int
    let image_height: Int
    let boxes: [OCRBoxItem]
}

struct UploadResponse: Content {
    let success: Bool
    let message: String
    let ocr_result: String
    let image_width: Int
    let image_height: Int
    let ocr_boxes: [OCRBoxItem]
}

actor VaporServer {
    private var app: Application?
    private var runTask: Task<Void, Never>?
    
    // 自動重啟設定
    private var shouldAutoRestart = true
    
    // 當伺服器停止時發通知
    private var onStopped: (@Sendable () -> Void)?

    let host: String = "0.0.0.0"
    let environment: Environment = .production
    
    // 可由外部設置
    var port: Int = 8000

    // OCR 參數
    var recognitionLevel: RecognizeTextRequest.RecognitionLevel = .accurate
    var usesLanguageCorrection: Bool = true
    var automaticallyDetectsLanguage: Bool = true

    private(set) var isRunning: Bool = false

    // MARK: - Public API

    // 設定停止時回呼
    func setOnStopped(_ handler: @escaping @Sendable () -> Void) {
        self.onStopped = handler
    }
    
    // 開關自動重啟
    func setAutoRestart(_ enabled: Bool) {
        self.shouldAutoRestart = enabled
    }

    func start() async throws {
        guard runTask == nil else { return } // 已在跑就不重複啟動

        let app = try await Application.make(environment)
        app.http.server.configuration.hostname = host
        app.http.server.configuration.port = port

        try routes(app)

        self.app = app
        isRunning = true

        // 用 Task 背景執行事件迴圈
        runTask = Task { [weak app, weak self] in
            guard let self = self else { return }
            var hadError = false
            do {
                try await app?.execute()
            } catch {
                hadError = true
            }
            
            // 通知外界「已停止」
            if let cb = await self.onStopped { cb() }
            
            // 依設定自動重啟
            if await self.shouldAutoRestart && hadError {
                await self.cleanupAfterStop()
                NotificationCenter.default.post(
                    name: .vaporServerShouldRestart,
                    object: nil,
                    userInfo: ["reason": "crash"]
                )
            }
        }
    }

    func stop() async {
        guard let app = app else { return }
        try? await app.asyncShutdown()   // 非同步關閉
        self.cleanupAfterStop()
    }

    func restart() async throws {
        await stop()
        try await start()
    }
    
    func running() -> Bool { isRunning }
    
    func configure(
        port: Int? = nil,
        recognitionLevel: RecognizeTextRequest.RecognitionLevel? = nil,
        usesLanguageCorrection: Bool? = nil,
        automaticallyDetectsLanguage: Bool? = nil,
    ) {
        if let v = port { self.port = v }
        if let v = recognitionLevel { self.recognitionLevel = v }
        if let v = usesLanguageCorrection { self.usesLanguageCorrection = v }
        if let v = automaticallyDetectsLanguage { self.automaticallyDetectsLanguage = v }
    }
    
    // MARK: - Cleanup After Stop
    
    private func cleanupAfterStop() {
        //runTask?.cancel()
        runTask = nil
        app = nil
        isRunning = false
    }

    // MARK: - Routes

    private func routes(_ app: Application) throws {
        // GET /
        app.get { [weak self] req async throws -> Response in
            guard let self else { throw Abort(.internalServerError) }

            // 從 actor 讀取屬性要 await
            let port = await self.port

            let html = """
            <!doctype html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>OCR Server</title>
                <style>
                    code {
                        background: #dadada;
                        padding: 2px 6px;
                        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
                        font-size: 0.85em;
                        font-weight: 600;
                        border-radius: 5px;
                    }
                    pre {
                        background: #dadada;
                        padding: 16px;
                        overflow: auto;
                        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
                        font-size: 0.85em;
                        line-height: 1.45;
                        border-radius: 5px;
                    }
                    pre code {
                        background: transparent;
                        padding: 0;
                        font-size: inherit;
                        color: inherit;
                        font-weight: normal;
                    }
                </style>
            </head>
            <body>
                <h1>OCR Server</h1>
                <h3>Upload an image via <code>upload</code> API:</h3>
                <pre><code>curl -H "Accept: application/json" \\
              -X POST http://&lt;YOUR IP&gt;:\(port)/upload \\
              -F "file=@01.png"</code></pre>
                <hr>
                <h3>OCR Test:</h3>
                <form action="/upload" method="post" enctype="multipart/form-data">
                    <label>
                        Choose file:
                        <input type="file" name="file" required>
                    </label>
                    <br><br>
                    <input type="submit" value="Upload file">
                </form>
            </body>
            </html>
            """
            return Self.htmlResponse(html)
        }

        // POST /upload（限制收集本文大小，可自行調整）
        app.on(.POST, "upload", body: .collect(maxSize: "100mb")) { [weak self] req async throws -> Response in
            guard let self else { throw Abort(.internalServerError) }

            struct Upload: Content { var file: File }

            let upload: Upload
            do {
                upload = try req.content.decode(Upload.self)
            } catch {
                return try Self.jsonResponse(
                    .badRequest,
                    UploadResponse(
                        success: false,
                        message: "Missing or empty 'file' part",
                        ocr_result: "",
                        image_width: 0,
                        image_height: 0,
                        ocr_boxes: []
                    )
                )
            }

            guard upload.file.data.readableBytes > 0 else {
                return try Self.jsonResponse(
                    .badRequest,
                    UploadResponse(
                        success: false,
                        message: "Missing or empty 'file' part",
                        ocr_result: "",
                        image_width: 0,
                        image_height: 0,
                        ocr_boxes: []
                    )
                )
            }

            // 取得 actor 內的參數（需 await）
            let recognitionLevel = await self.recognitionLevel
            let usesLanguageCorrection = await self.usesLanguageCorrection
            let automaticallyDetectsLanguage = await self.automaticallyDetectsLanguage

            // ByteBuffer -> Data
            let data = Self.byteBufferToData(upload.file.data)

            // OCR
            let textRecognizer = TextRecognizer(
                recognitionLevel: recognitionLevel,
                usesLanguageCorrection: usesLanguageCorrection,
                automaticallyDetectsLanguage: automaticallyDetectsLanguage
            )
            //let rawText = await textRecognizer.getOcrResult(data: data) ?? ""

            guard let result = await textRecognizer.getOcrResult(data: data) else {
                return try Self.jsonResponse(.internalServerError, UploadResponse(success: false,
                                                                                  message: "OCR failed",
                                                                                  ocr_result: "",
                                                                                  image_width: 0,
                                                                                  image_height: 0,
                                                                                  ocr_boxes: []))
            }
            
            let accept = (req.headers.first(name: .accept) ?? "").lowercased()
            if accept.contains("application/json") {
                return try Self.jsonResponse(
                    .ok,
                    UploadResponse(
                        success: true,
                        message: "File uploaded successfully",
                        ocr_result: result.text,
                        image_width: result.image_width,
                        image_height: result.image_height,
                        ocr_boxes: result.boxes
                    )
                )
            } else {
                let escaped = Self.htmlEscape(result.text)
                let html = """
                <!doctype html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>OCR Server</title>
                </head>
                <body>
                    <h2>OCR Result:</h2>
                    <pre>\(escaped)</pre>
                </body>
                </html>
                """
                return Self.htmlResponse(html)
            }
        }
    }

    // MARK: - Helpers

    private static func byteBufferToData(_ buffer: ByteBuffer) -> Data {
        var tmp = buffer
        if let bytes = tmp.readBytes(length: tmp.readableBytes) {
            return Data(bytes)
        }
        return Data()
    }

    private static func htmlEscape(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;")
         .replacingOccurrences(of: "<", with: "&lt;")
         .replacingOccurrences(of: ">", with: "&gt;")
    }

    private static func htmlResponse(_ html: String, status: HTTPResponseStatus = .ok) -> Response {
        var headers = HTTPHeaders()
        headers.add(name: .contentType, value: "text/html; charset=utf-8")
        return Response(status: status, headers: headers, body: .init(string: html))
    }

    private static func jsonResponse<T: Content>(_ status: HTTPResponseStatus, _ payload: T) throws -> Response {
        let res = Response(status: status)
        try res.content.encode(payload, as: .json)
        return res
    }
}

extension Notification.Name {
    static let vaporServerShouldRestart = Notification.Name("vaporServerShouldRestart")
}
