//
//  RecognitionLevelView.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/9.
//

import SwiftUI

struct RecognitionLevelView: View {
    @Binding var recognitionLevel: String
    let levels = ["Accurate", "Fast"]
    
    var body: some View {
        List {
            ForEach(levels, id: \.self) { level in
                HStack {
                    Text(level)
                    Spacer()
                    if level == recognitionLevel {
                        Image(systemName: "checkmark")
                            .foregroundColor(.blue)
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    Settings.shared.recognitionLevel = level
                    recognitionLevel = level
                }
            }
        }
        .navigationTitle("Recognition Level")
        .navigationBarTitleDisplayMode(.inline)
    }
}
