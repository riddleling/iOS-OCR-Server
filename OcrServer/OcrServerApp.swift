//
//  OcrServerApp.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/1.
//

import SwiftUI

@main
struct OcrServerApp: App {
    @StateObject private var serverManager = ServerManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView(
                serverStatus: serverManager.status,
                wifiAddress: serverManager.wifiAddress,
                ethernetAddress: serverManager.ethernetAddress
            )
            .onAppear {
                UIApplication.shared.isIdleTimerDisabled = true
            }
        }
    }
}
