//
//  Utilities.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/10.
//

import Foundation


// MARK: - Utilities

extension UInt64 {
    var bytesHumanReadable: String {
        let units: [String] = ["B","KB","MB","GB","TB"]
        var value = Double(self)
        var idx = 0
        while value >= 1024 && idx < units.count - 1 { value /= 1024; idx += 1 }
        let fmt = value >= 10 ? String(format: "%.0f", value) : String(format: "%.1f", value)
        return "\(fmt) \(units[idx])"
    }
}

extension Double { var percentString: String { String(format: "%.0f%%", self * 100) } }
