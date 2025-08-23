//
//  OcrTestView.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/12.
//

import SwiftUI

struct OcrTestView: View {
    let url : String
    @Environment(\.dismiss) private var dismiss
    @State private var isLoading = false
    @State private var progress: Double = 0.0
    @StateObject private var controller = WebViewController()
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // 進度條
                if isLoading {
                    ProgressView(value: progress, total: 1.0)
                        .progressViewStyle(LinearProgressViewStyle())
                        .animation(.easeInOut(duration: 0.3), value: progress)
                }
                
                // WebView
                WebView(url: URL(string: url)!,
                        isLoading: $isLoading,
                        progress: $progress,
                        controller: controller
                )
            }
            .navigationTitle(url)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .navigationBarLeading) {
                    Button {
                        controller.goBack()
                    } label: {
                        Image(systemName: "chevron.backward.circle")
                    }
                    .opacity(controller.canGoBack ? 1 : 0)
                    .disabled(!controller.canGoBack)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.title2)
                            .foregroundColor(.primary)
                    }
                }
            }
        }
    }
}
