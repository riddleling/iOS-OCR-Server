//
//  Sampler.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/10.
//

import Foundation
import Combine


// MARK: - Sampler (timer + publishers)

@MainActor
final class Sampler: ObservableObject {
    @Published private(set) var snapshots: [ResourceSnapshot] = []
    @Published private(set) var isRunning: Bool = false

    private let system = SystemMonitor()
    private let appMon = AppMonitor()
    private var timerCancellable: AnyCancellable?

    // Configuration
    var interval: TimeInterval = 1.0
    var maxPoints: Int = 180 // keep last 3 mins @ 1s

    func start() {
        stop()
        timerCancellable = Timer.publish(every: interval, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in self?.tick() }
        isRunning = true
    }

    func stop() {
        timerCancellable?.cancel()
        timerCancellable = nil
        isRunning = false
    }
    
    func clear() {
        snapshots.removeAll()
    }

    private func tick() {
        let appInfo = appMon.read()
        let snap = system.readSnapshot(appInfo: appInfo)
        snapshots.append(snap)
        if snapshots.count > maxPoints { snapshots.removeFirst(snapshots.count - maxPoints) }
    }
}
