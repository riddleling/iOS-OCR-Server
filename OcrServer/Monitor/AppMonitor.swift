//
//  AppMonitor.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/10.
//

import Foundation


// MARK: - App Monitor (footprint, threads)

final class AppMonitor {
    struct AppInfo { let footprint: UInt64; let threadCount: Int }

    func read() -> AppInfo {
        let footprint = readTaskFootprint()
        let threadCount = readThreadCount()
        return AppInfo(footprint: footprint, threadCount: threadCount)
    }

    private func readThreadCount() -> Int {
        var count: mach_msg_type_number_t = 0
        var threadList: thread_act_array_t?
        let kr = task_threads(mach_task_self_, &threadList, &count)
        if kr == KERN_SUCCESS, let list = threadList {
            // Must deallocate the array returned by task_threads
            let size = vm_size_t(MemoryLayout<thread_t>.stride * Int(count))
            vm_deallocate(mach_task_self_, vm_address_t(bitPattern: list), size)
            return Int(count)
        }
        return 0
    }

    private func readTaskFootprint() -> UInt64 {
        var infoCount = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.stride / MemoryLayout<natural_t>.stride)
        var info = task_vm_info()
        let kr = withUnsafeMutablePointer(to: &info) { ptr -> kern_return_t in
            ptr.withMemoryRebound(to: integer_t.self, capacity: Int(infoCount)) { intPtr in
                task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), intPtr, &infoCount)
            }
        }
        guard kr == KERN_SUCCESS else { return 0 }
        return info.phys_footprint
    }
}
