//
//  ServerManager.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/1.
//

import Foundation
import Swifter

class ServerManager: ObservableObject {
    let server = HttpServer()
    let port = 8000
    let networkInterfaces = ["en0", "en1", "en2", "en3", "en4", "en5"]
    
    @Published var status: String = ""
    @Published var networkAddresses: [String: String] = [:]
    
    
    init() {
        startServer()
    }
    
    // 啟動伺服器
    private func startServer() {
        setupRoutes()
        do {
            try server.start(in_port_t(port))
            print("Server started at port \(port)")
            status = "server is running"
            refreshNetworkAddresses()
            monitorServer()
        } catch {
            print("Unable to start server: \(error)")
            status = "unable to start the server"
        }
    }
    
    // 監控伺服器狀態並自動重啟
    private func monitorServer() {
        DispatchQueue.global().async {
            while true {
                sleep(2)
                if !self.server.operating {
                    DispatchQueue.main.async {
                        self.status = "server stopped - restarting..."
                    }
                    print("Server stopped unexpectedly. Restarting...")
                    self.server.stop()
                    sleep(1) // 等待資源釋放
                    self.startServer()
                    break // 重新啟動後由新的 monitor 負責監控
                }
            }
        }
    }
    
    func refreshNetworkAddresses() {
        networkAddresses.removeAll()
        
        for interface in networkInterfaces {
            if let ip = getIP(for: interface) {
                print("\(interface): \(ip)")
                networkAddresses[interface] = ip
            }
        }
        
        print("Network addresses refreshed: \(networkAddresses)")
    }
    
    private func setupRoutes() {
        server["/"] = { _ in
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
              -X POST http://&lt;YOUR IP&gt;:8000/upload \\
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
            return .ok(.html(html))
        }
        
        server["/upload"] = { req in
            let multipart = req.parseMultiPartFormData()
            
            guard let filePart = multipart.first(where: { $0.name == "file" }),
                !filePart.body.isEmpty else {
                return .badRequest(.text("Missing or empty 'file' part"))
            }
            
            let data = Data(filePart.body)
            
            let textRecognizer = TextRecognizer()
            let rawText = textRecognizer.getOcrResult(data: data) ?? ""
            
            let acceptHeader = req.headers["accept"]?.lowercased() ?? ""
            
            if acceptHeader.contains("application/json") {
                let jsonDict = ["ocr_result": rawText]
                return .ok(.json(jsonDict))
            } else {
                let result = self.htmlEscape(rawText).replacingOccurrences(of: "\n", with: "<br>")
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
                    <p>\(result)</p>
                </body>
                </html>
                """
                return .ok(.html(html))
            }
        }
    }
    
    private func htmlEscape(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;")
         .replacingOccurrences(of: "<", with: "&lt;")
         .replacingOccurrences(of: ">", with: "&gt;")
    }
    
    private func getIP(for interface: String) -> String? {
        var ifaddr: UnsafeMutablePointer<ifaddrs>?

        guard getifaddrs(&ifaddr) == 0, let firstAddr = ifaddr else {
            return nil
        }
        defer { freeifaddrs(ifaddr) }

        for ptr in sequence(first: firstAddr, next: { $0.pointee.ifa_next }) {
            let interfaceName = String(cString: ptr.pointee.ifa_name)

            if interfaceName == interface {
                let flags = Int32(ptr.pointee.ifa_flags)
                var addr = ptr.pointee.ifa_addr.pointee

                // Filter out loopback and inactive interfaces
                let isRunning = (flags & (IFF_UP|IFF_RUNNING)) == (IFF_UP|IFF_RUNNING)
                let isLoopback = (flags & IFF_LOOPBACK) == IFF_LOOPBACK
                if !isRunning || isLoopback {
                    continue
                }

                // IPv4 only
                if addr.sa_family == UInt8(AF_INET) {
                    var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                    if getnameinfo(&addr,
                                   socklen_t(addr.sa_len),
                                   &hostname,
                                   socklen_t(hostname.count),
                                   nil, 0,
                                   NI_NUMERICHOST) == 0 {
                        return String(cString: hostname)
                    }
                }
            }
        }

        return nil
    }
}
