//
//  ContentView.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/1.
//

import SwiftUI

struct ContentView: View {
    @ObservedObject var serverManager: ServerManager
    @State private var isRefreshing = false
    @State private var showingReadme = false
    
    var body: some View {
        VStack {
            HStack {
                Button(action: openReadme) {
                    HStack(spacing: 8) {
                        Image(systemName: "text.page")
                            .font(.title3)
                        Text("README")
                            .font(.headline)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                }
                .background(Color.green.opacity(0.7))
                .cornerRadius(8)
                
                Spacer()
                    .frame(width: 12)
                
                Button(action: refreshNetworkAddresses) {
                    HStack(spacing: 8) {
                        if isRefreshing {
                            ProgressView()
                                .scaleEffect(0.8)
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Image(systemName: "arrow.clockwise")
                                .font(.title3)
                        }
                        Text("Refresh IP")
                            .font(.headline)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                }
                .background(isRefreshing ? Color.gray.opacity(0.7) : Color.blue.opacity(0.7))
                .cornerRadius(8)
                .disabled(isRefreshing)
            }
            .padding(.bottom, 50)
            
            Text("OCR Server v\(Bundle.main.appVersion)")
                .font(.title2)
                .foregroundColor(.white)
            
            Text("Status : \(serverManager.status)")
                .font(.headline)
                .foregroundColor(.white)
                .padding(10)
            
            Spacer()
                .frame(height: 100)
            
            ForEach(Array(serverManager.networkAddresses.keys.sorted()), id: \.self) { interfaceName in
                NetworkInterfaceView(
                    title: getDisplayName(for: interfaceName),
                    address: getAddressString(for: serverManager.networkAddresses[interfaceName])
                )
                
                if interfaceName != Array(serverManager.networkAddresses.keys.sorted()).last {
                    Spacer()
                        .frame(height: 20)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
        .sheet(isPresented: $showingReadme) {
            ReadmeView()
        }
    }
        
    private func openReadme()  {
        showingReadme = true
    }
    
    private func refreshNetworkAddresses() {
        isRefreshing = true
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            serverManager.refreshNetworkAddresses()
            
            withAnimation(.easeInOut(duration: 0.3)) {
                isRefreshing = false
            }
        }
        
    }
    
    private func getAddressString(for address: String?) -> String {
        if let addr = address {
            return "http://\(addr):\(serverManager.port)"
        }
        return "No available IP found"
    }
    
    private func getDisplayName(for interfaceName: String) -> String {
        switch interfaceName {
        case "en0":
            return "Wifi (en0)"
        default:
            return "Ethernet (\(interfaceName))"
        }
    }
}

struct NetworkInterfaceView: View {
    let title: String
    let address: String
    
    var body: some View {
        VStack(spacing: 5) {
            Text(title)
                .font(.headline)
                .foregroundColor(.white)
            
            Text(address)
                .font(.title)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
                .foregroundColor(.white)
                .padding(5)
        }
    }
}

#Preview {
    ContentView(
        serverManager: ServerManager()
    )
}

extension Bundle {
    var appVersion: String {
        return infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown version"
    }
    
    var buildNumber: String {
        return infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
    }
    
    var fullVersion: String {
        return "\(appVersion) (\(buildNumber))"
    }
}
