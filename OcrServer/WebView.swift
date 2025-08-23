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
    @ObservedObject var controller: WebViewController
    
    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.navigationDelegate = context.coordinator
        
        // 設置 coordinator 的 webView 引用
        context.coordinator.setWebView(webView)
        
        controller.webView = webView
        
        // 觀察進度
        webView.addObserver(context.coordinator, forKeyPath: "estimatedProgress", options: .new, context: nil)
        webView.addObserver(context.coordinator, forKeyPath: "loading", options: .new, context: nil)
        
        // 載入頁面
        let request = URLRequest(url: url)
        webView.load(request)
        
        return webView
    }
    
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        // 正確移除 KVO
        uiView.removeObserver(coordinator, forKeyPath: "estimatedProgress")
        uiView.removeObserver(coordinator, forKeyPath: "loading")
        uiView.navigationDelegate = nil
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
                        self.parent.controller.canGoBack = webView.canGoBack
                        self.parent.controller.canGoForward = webView.canGoForward
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
                self.parent.controller.canGoBack = webView.canGoBack
                self.parent.controller.canGoForward = webView.canGoForward
            }
        }
    }
}

final class WebViewController: ObservableObject {
    fileprivate weak var webView: WKWebView?

    @Published var canGoBack = false
    @Published var canGoForward = false

    func goBack() { webView?.goBack() }
    func goForward() { webView?.goForward() }
}
