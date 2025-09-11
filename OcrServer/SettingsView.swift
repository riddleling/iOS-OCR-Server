//
//  SettingsView.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/8.
//

import SwiftUI

struct SettingsView: View {
    @ObservedObject var serverManager: VaporServerManager
    @Environment(\.dismiss) private var dismiss
    @State var recognitionLevel = Settings.shared.recognitionLevel
    @State var languageCorrection = Settings.shared.languageCorrection
    @State var autoDetectLanguage = Settings.shared.automaticallyDetectsLanguage
    @State var httpPort: String = String(Settings.shared.httpPort)
    @State private var showingPortSheet = false
    @State private var inputPortText: String = String(Settings.shared.httpPort)
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                List {
                    Section("Text Recognition") {
                        ZStack {
                            SettingsRow(icon: "text.viewfinder",
                                        title: String(localized:"Recognition Level"),
                                        value: $recognitionLevel)
                            NavigationLink(destination: RecognitionLevelView(recognitionLevel: $recognitionLevel)) {
                                EmptyView()
                            }
                            .opacity(0)
                        }
                        SettingsRow2(icon: "text.badge.checkmark",
                                     title: String(localized:"Language Correction"),
                                     isOn: $languageCorrection)
                        SettingsRow2(icon: "globe",
                                     title: String(localized:"Auto Detects Language"),
                                     isOn: $autoDetectLanguage)
                    }
                    Section("Server") {
                        SettingsRow(icon: "server.rack", title: "HTTP Port", value: $httpPort)
                            .onTapGesture {
                                showingPortSheet = true
                            }
                    }
                    
                    Button(action: apply) {
                        HStack(spacing: 8) {
                            if serverManager.isRestarting {
                                ProgressView()
                                    .scaleEffect(0.8)
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            }
                            Text("Apply & Restart server")
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(serverManager.isRestarting ? Color.gray : Color(hex: "EA7500"))
                        .cornerRadius(8)
                    }
                    .listRowInsets(EdgeInsets()) // 移除預設的邊距
                    .buttonStyle(PlainButtonStyle()) // 移除按鈕的預設樣式
                    .disabled(serverManager.isRestarting)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .foregroundColor(.primary)
                    }
                }
            }
            .onChange(of: languageCorrection) { oldValue, newValue in
                Settings.shared.languageCorrection = newValue
            }
            .onChange(of: autoDetectLanguage) { oldValue, newValue in
                Settings.shared.automaticallyDetectsLanguage = newValue
            }
            .sheet(isPresented: $showingPortSheet) {
                VStack {
                    HStack {
                        Text("Set HTTP Port: ")
                            .padding(.trailing, 8)
                        TextField("HTTP Port", text: $inputPortText)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.roundedBorder)
                    }
                    Spacer()
                        .frame(height: 40)
                    HStack {
                        Button("Cancel") { showingPortSheet = false }
                            .fontWeight(.medium)
                        Spacer()
                        Button("Confirm") {
                            Settings.shared.httpPort = Int(inputPortText) ?? 8000
                            httpPort = inputPortText
                            showingPortSheet = false
                        }
                    }
                }
                .padding()
                .presentationDetents([.height(200)])
            }
        }
    }
    
    private func apply() {
        serverManager.restartServer()
    }
    
    
}
    
struct SettingsRow: View {
    let icon: String
    let title: String
    @Binding var value: String
    
    var body: some View {
        HStack(spacing: 12) {
            // 圖示
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.accentColor)
                .frame(width: 28, height: 28)
            
            // 文字內容
            Text(title)
                .font(.body)
                .fontWeight(.medium)
        
            Spacer()
            
            Text(getValueString(value))
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            // 箭頭指示
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
    
    private func getValueString(_ level: String) -> String {
        switch level {
        case "Accurate":
            return String(localized:"Accurate")
        case "Fast":
            return String(localized:"Fast")
        default:
            return level
        }
    }
}

struct SettingsRow2: View {
    let icon: String
    let title: String
    @Binding var isOn: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            // 圖示
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.accentColor)
                .frame(width: 28, height: 28)
            
            // 文字內容
            Text(title)
                .font(.body)
                .fontWeight(.medium)
            
            Spacer()
            
            Toggle("", isOn: $isOn)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
