//
//  VaporServerManager.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/21.
//

import SwiftUI
import Combine
import Vision

@MainActor
final class VaporServerManager: ObservableObject {
    private let server = VaporServer()
    private var cancellables = Set<AnyCancellable>()
    
    var port: Int = Settings.shared.httpPort

    @Published var status: String = ""
    @Published var networkAddresses: [String: String] = [:]
    @Published var isRestarting = false

    let networkInterfaces = ["en0", "en1", "en2", "en3", "en4", "en5"]

    init() {
        NotificationCenter.default.publisher(for: .vaporServerShouldRestart)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                guard let self else { return }
                Task {
                    self.status = String(localized: "server stopped - restarting...")
                    try? await Task.sleep(nanoseconds: 1_000_000_000)
                    self.startServer()
                }
            }
            .store(in: &cancellables)
        startServer()
    }
    
    func startServer() {
        Task {
            isRestarting = true
            await setupParameters()
            
            // 開啟 Server 啟動失敗自動重啟
            await server.setAutoRestart(true)
            
            // Server 停止時更新 status 文字
            await server.setOnStopped { [weak self] in
                guard let self else { return }
                Task { @MainActor in
                    self.status = String(localized:"server stopped")
                }
            }
            
            do {
                try await server.start()
                status = String(localized: "server is running")
                refreshNetworkAddresses()
            } catch {
                status = String(localized: "unable to start the server")
            }
            isRestarting = false
        }
    }

    func stopServer() {
        Task {
            isRestarting = true
            await server.stop()
            status = String(localized: "server stopped")
            isRestarting = false
        }
    }

    func restartServer() {
        self.status = String(localized: "server restarting...")
        Task {
            isRestarting = true
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            await setupParameters()
            do {
                try await server.restart()
                status = String(localized: "server is running")
                refreshNetworkAddresses()
            } catch {
                status = String(localized: "unable to start the server")
            }
            isRestarting = false
        }
    }

    // 從 Settings 套用參數
    private func setupParameters() async {
        port = Settings.shared.httpPort
        
        let level: RecognizeTextRequest.RecognitionLevel =
                (Settings.shared.recognitionLevel == "Fast") ? .fast : .accurate
        
        await server.configure(
            port: port,
            recognitionLevel: level,
            usesLanguageCorrection: Settings.shared.languageCorrection,
            automaticallyDetectsLanguage: Settings.shared.automaticallyDetectsLanguage,
        )
    }

    func refreshNetworkAddresses() {
        networkAddresses.removeAll()
        for interface in networkInterfaces {
            if let ip = getIP(for: interface) {
                networkAddresses[interface] = ip
            }
        }
        //print("\(networkAddresses)")
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
