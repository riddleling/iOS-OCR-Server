//
//  ContentView.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/1.
//

import SwiftUI

struct ContentView: View {
    let serverStatus: String
    let wifiAddress: String
    let ethernetAddress: String
    
    var body: some View {
        VStack {
            Text("OCR Server v\(Bundle.main.appVersion)")
                .font(.title2)
                .foregroundColor(.white)
                
            
            Text("Status : \(serverStatus)")
                .font(.headline)
                .foregroundColor(.white)
                .padding(10)
            
            Spacer()
                .frame(height: 150)
            
            Text("Wifi (en0) :")
                .font(.headline)
                .foregroundColor(.white)
            Text(wifiAddress)
                .font(.title)
                .foregroundColor(.white)
                .padding(5)
            
            Spacer()
                .frame(height: 80)
            
            Text("Ethernet (en1) :")
                .font(.headline)
                .foregroundColor(.white)
            Text(ethernetAddress)
                .font(.title)
                .foregroundColor(.white)
                .padding(5)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }
}

#Preview {
    ContentView(
        serverStatus: "server is running",
        wifiAddress: "http://127.0.0.1:8080",
        ethernetAddress: "http://127.0.0.1:8080"
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
