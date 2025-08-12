//
//  WebView.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/12.
//

import SwiftUI
import WebKit

// MARK: - WebView Wrapper
struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool
    @Binding var progress: Double
    
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.navigationDelegate = context.coordinator
        
        // 設置 coordinator 的 webView 引用
        context.coordinator.setWebView(webView)
        
        // 觀察進度
        webView.addObserver(context.coordinator, forKeyPath: "estimatedProgress", options: .new, context: nil)
        webView.addObserver(context.coordinator, forKeyPath: "loading", options: .new, context: nil)
        
        // 載入頁面
        let request = URLRequest(url: url)
        webView.load(request)
        
        return webView
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {
        // 不在這裡做任何事，避免重複載入
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, WKNavigationDelegate {
        let parent: WebView
        private var webView: WKWebView?
        
        init(_ parent: WebView) {
            self.parent = parent
        }
        
        override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
            if keyPath == "estimatedProgress" {
                if let webView = object as? WKWebView {
                    DispatchQueue.main.async {
                        self.parent.progress = webView.estimatedProgress
                    }
                }
            }
            
            if keyPath == "loading" {
                if let webView = object as? WKWebView {
                    DispatchQueue.main.async {
                        self.parent.isLoading = webView.isLoading
                    }
                }
            }
        }
        
        func setWebView(_ webView: WKWebView) {
            self.webView = webView
        }
        
        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isLoading = true
            }
        }
        
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isLoading = false
                self.parent.progress = 1.0
            }
        }
        
        deinit {
            // 移除觀察者
            if let webView = webView {
                webView.removeObserver(self, forKeyPath: "estimatedProgress")
                webView.removeObserver(self, forKeyPath: "loading")
            }
        }
    }
}
