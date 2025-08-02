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
    
    @Published var status: String = ""
    @Published var wifiAddress: String = "No available IP found"
    @Published var ethernetAddress: String = "No available IP found"
    
    init() {
        setupServer()
        
        if let ipEn0 = getIP(for: "en0") {
            wifiAddress = "http://\(ipEn0):\(port)"
        }

        if let ipEn1 = getIP(for: "en1") {
            ethernetAddress = "http://\(ipEn1):\(port)"
        }
    }
    
    private func setupServer() {
        server["/"] = { _ in
            let html = """
            <!doctype html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>OCR Server</title>
            </head>
            <body>
                <h1>File Upload</h1>
                <form action="/upload" method="post" enctype="multipart/form-data">
                    <input type="file" name="file" required>
                    <br><br>
                    <input type="submit" value="Upload">
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
                    <h1>OCR Result:</h1>
                    <p>\(result)</p>
                </body>
                </html>
                """
                return .ok(.html(html))
            }
        }
        
        do {
            try server.start(in_port_t(port))
            print("Server started at port \(port)")
            status = "server is running"
        } catch {
            print("Unable to start server: \(error)")
            status = "unable to start the server"
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

            // Only handle en0 / en1
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
