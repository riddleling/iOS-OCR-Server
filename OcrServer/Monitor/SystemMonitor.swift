//
//  SystemMonitor.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/10.
//

import Foundation
import Network
import UIKit


// MARK: - System Monitor (CPU, RAM, Disk, Thermal, Battery, Network)

final class SystemMonitor: ObservableObject {
    // CPU state for delta calculation
    private var lastCPUTicks: host_cpu_load_info = host_cpu_load_info(
        cpu_ticks: (0,0,0,0)
    )
    private var lastPerCoreTicks: [(UInt32, UInt32, UInt32, UInt32)] = []
    private var lastCPUSampleTime: CFAbsoluteTime = CFAbsoluteTimeGetCurrent()

    // Network
    private let pathMonitor = NWPathMonitor()
    private let pathQueue = DispatchQueue(label: "hmonitor.path")
    @Published private(set) var currentPathStatus: NWPath.Status = .requiresConnection
    
    // Battery (event-driven)
    @Published private(set) var currentBatteryLevel: Float?
    @Published private(set) var currentBatteryState: UIDevice.BatteryState = .unknown


    init() {
        pathMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async { self?.currentPathStatus = path.status }
        }
        pathMonitor.start(queue: pathQueue)
        
        DispatchQueue.main.async {
            UIDevice.current.isBatteryMonitoringEnabled = true
            let level = UIDevice.current.batteryLevel
            self.currentBatteryLevel = level >= 0 ? level : nil
            self.currentBatteryState = UIDevice.current.batteryState
        }
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(batteryLevelDidChange),
            name: UIDevice.batteryLevelDidChangeNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(batteryStateDidChange),
            name: UIDevice.batteryStateDidChangeNotification,
            object: nil
        )
    }

    deinit {
        pathMonitor.cancel()
        NotificationCenter.default.removeObserver(self)
    }

    func readSnapshot(appInfo: AppMonitor.AppInfo) -> ResourceSnapshot {
        let cpu = readCPUTotalUsage()
        let perCore = readPerCoreUsage()
        let mem = readMemory()
        let thermal = ProcessInfo.processInfo.thermalState
        let (avail, total) = readDisk()
        let net = currentPathStatus
        
        return ResourceSnapshot(
            timestamp: Date(),
            cpuTotal: cpu,
            memoryUsed: mem.used,
            memoryFree: mem.free,
            memoryTotal: mem.total,
            thermalState: thermal,
            batteryLevel: currentBatteryLevel,
            batteryState: currentBatteryState,
            diskAvailable: avail,
            diskTotal: total,
            networkStatus: net,
            appMemoryFootprint: appInfo.footprint,
            appThreadCount: appInfo.threadCount,
            perCoreCPU: perCore
        )
    }
}


// MARK: - SystemMonitor: Low-level readers

extension SystemMonitor {
    struct MemoryInfo {
        let used: UInt64
        let free: UInt64
        let total: UInt64
    }

    /// CPU total usage 0.0 ~ 1.0 using host_cpu_load_info deltas
    func readCPUTotalUsage() -> Double {
        var count = mach_msg_type_number_t(MemoryLayout<host_cpu_load_info_data_t>.size / MemoryLayout<integer_t>.size)
        var info = host_cpu_load_info()
        let result = withUnsafeMutablePointer(to: &info) { ptr -> kern_return_t in
            ptr.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { intPtr in
                host_statistics(mach_host_self(), HOST_CPU_LOAD_INFO, intPtr, &count)
            }
        }
        guard result == KERN_SUCCESS else { return 0 }

        let user = Double(info.cpu_ticks.0 - lastCPUTicks.cpu_ticks.0)
        let sys  = Double(info.cpu_ticks.1 - lastCPUTicks.cpu_ticks.1)
        let idle = Double(info.cpu_ticks.2 - lastCPUTicks.cpu_ticks.2)
        let nice = Double(info.cpu_ticks.3 - lastCPUTicks.cpu_ticks.3)
        let totalTicks = user + sys + idle + nice

        lastCPUTicks = info
        lastCPUSampleTime = CFAbsoluteTimeGetCurrent()

        guard totalTicks > 0 else { return 0 }
        let busy = (user + sys + nice)
        return max(0, min(1, busy / totalTicks))
    }
    
    func readPerCoreUsage() -> [Double] {
        var cpuInfo: processor_info_array_t? = nil
        var cpuInfoCount: mach_msg_type_number_t = 0
        var processorCount: natural_t = 0

        let kr = host_processor_info(mach_host_self(),
                                     PROCESSOR_CPU_LOAD_INFO,
                                     &processorCount,
                                     &cpuInfo,
                                     &cpuInfoCount)
        guard kr == KERN_SUCCESS, let info = cpuInfo else { return [] }
        defer {
            let size = vm_size_t(cpuInfoCount) * vm_size_t(MemoryLayout<integer_t>.size)
            vm_deallocate(mach_task_self_, vm_address_t(bitPattern: info), size)
        }

        let stride = Int(CPU_STATE_MAX)
        var usages: [Double] = []
        var newCache: [(UInt32, UInt32, UInt32, UInt32)] = []

        for i in 0..<Int(processorCount) {
            let base = i * stride
            let user = UInt32(info[base + Int(CPU_STATE_USER)])
            let sys  = UInt32(info[base + Int(CPU_STATE_SYSTEM)])
            let idle = UInt32(info[base + Int(CPU_STATE_IDLE)])
            let nice = UInt32(info[base + Int(CPU_STATE_NICE)])
            let curr = (user, sys, idle, nice)

            // 上一次的 ticks（若沒有，就用當前，避免負值）
            let prev = i < lastPerCoreTicks.count ? lastPerCoreTicks[i] : curr

            // 使用無號減法避免 tick 溢位造成負值
            let dUser = Double(curr.0 &- prev.0)
            let dSys  = Double(curr.1 &- prev.1)
            let dIdle = Double(curr.2 &- prev.2)
            let dNice = Double(curr.3 &- prev.3)
            let total = dUser + dSys + dIdle + dNice
            let busy = max(0.0, dUser + dSys + dNice)

            usages.append(total > 0 ? min(1.0, busy / total) : 0.0)
            newCache.append(curr)
        }

        lastPerCoreTicks = newCache
        return usages
    }

    /// Memory (aggregate) using host_statistics64(vm_statistics64)
    func readMemory() -> MemoryInfo {
        var size = mach_msg_type_number_t(MemoryLayout<vm_statistics64_data_t>.stride / MemoryLayout<integer_t>.stride)
        var vmStats = vm_statistics64()
        let result = withUnsafeMutablePointer(to: &vmStats) { ptr -> kern_return_t in
            ptr.withMemoryRebound(to: integer_t.self, capacity: Int(size)) { intPtr in
                host_statistics64(mach_host_self(), HOST_VM_INFO64, intPtr, &size)
            }
        }
        guard result == KERN_SUCCESS else {
            // Fallback to zeroes
            let total = ProcessInfo.processInfo.physicalMemory
            return MemoryInfo(used: 0, free: total, total: total)
        }

        let pageSize = UInt64(vm_kernel_page_size)
        _ = (UInt64(vmStats.free_count) + UInt64(vmStats.speculative_count)) * pageSize
        let active = UInt64(vmStats.active_count) * pageSize
        let inactive = UInt64(vmStats.inactive_count) * pageSize
        let wired = UInt64(vmStats.wire_count) * pageSize
        let compressed = UInt64(vmStats.compressor_page_count) * pageSize
        let used = active + inactive + wired + compressed
        let total = ProcessInfo.processInfo.physicalMemory
        let clampedUsed = min(used, total)
        let clampedFree = total > clampedUsed ? total - clampedUsed : 0
        return MemoryInfo(used: clampedUsed, free: clampedFree, total: total)
    }

    /// Disk (available, total) via URLResourceValues
    func readDisk() -> (Int64?, Int64?) {
        do {
            let url = URL(fileURLWithPath: NSHomeDirectory())
            let resourceKeys: Set<URLResourceKey> = [
                .volumeAvailableCapacityForImportantUsageKey,
                .volumeTotalCapacityKey
            ]
            let values = try url.resourceValues(forKeys: resourceKeys)
            let available = values.volumeAvailableCapacityForImportantUsage
            let total = values.volumeTotalCapacity.map { Int64($0) }
            return (available, total)
        } catch {
            return (nil, nil)
        }
    }
    
    @objc private func batteryLevelDidChange() {
        DispatchQueue.main.async {
            let level = UIDevice.current.batteryLevel
            self.currentBatteryLevel = level >= 0 ? level : nil
        }
    }

    @objc private func batteryStateDidChange() {
        DispatchQueue.main.async {
            self.currentBatteryState = UIDevice.current.batteryState
        }
    }
}
