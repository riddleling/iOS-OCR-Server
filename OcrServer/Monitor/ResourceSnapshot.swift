//
//  ResourceSnapshot.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/10.
//

import Foundation
import Network
import UIKit


// MARK: - Snapshot Model

struct ResourceSnapshot: Identifiable {
    let id = UUID()
    let timestamp: Date
    // System aggregates
    let cpuTotal: Double // 0.0 - 1.0
    let memoryUsed: UInt64
    let memoryFree: UInt64
    let memoryTotal: UInt64
    let thermalState: ProcessInfo.ThermalState
    let batteryLevel: Float? // 0.0 - 1.0
    let batteryState: UIDevice.BatteryState
    let diskAvailable: Int64?
    let diskTotal: Int64?
    let networkStatus: NWPath.Status
    // App-specific
    let appMemoryFootprint: UInt64
    let appThreadCount: Int
    // Per Core CPU
    let perCoreCPU: [Double]
}
