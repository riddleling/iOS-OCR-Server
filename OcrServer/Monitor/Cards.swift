//
//  Cards.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/10.
//

import SwiftUI
import Network


// MARK: - Cards

struct CPUCard: View {
    let snapshots: [ResourceSnapshot]
    var current: ResourceSnapshot? { snapshots.last }

    var body: some View {
        Card {
            HStack(alignment: .center, spacing: 16) {
                Image(systemName: "cpu")
                    .symbolRenderingMode(.hierarchical)
                    .font(.system(size: 36, weight: .semibold))
                VStack(alignment: .leading) {
                    Text("CPU Usage")
                        .font(.headline)
                    Text(current?.cpuTotal.percentString ?? "--")
                        .font(.system(size: 28, weight: .bold))
                }
                Spacer()
                Gauge(value: current?.cpuTotal ?? 0) { Text("") }
                    .gaugeStyle(.accessoryCircularCapacity)
                    .frame(width: 60, height: 60)
            }
            if snapshots.count > 2 {
                LineChart(values: snapshots.suffix(120).map { $0.cpuTotal })
                    .frame(height: 56)
            }
        }
    }
}

struct MemoryCard: View {
    let snapshots: [ResourceSnapshot]
    var current: ResourceSnapshot? { snapshots.last }

    var body: some View {
        Card {
            HStack(spacing: 16) {
                Image(systemName: "memorychip")
                    .symbolRenderingMode(.hierarchical)
                    .font(.system(size: 32, weight: .semibold))
                VStack(alignment: .leading, spacing: 6) {
                    Text("Memory")
                        .font(.headline)
                    if let s = current {
                        let used = s.memoryUsed.bytesHumanReadable
                        let total = s.memoryTotal.bytesHumanReadable
                        ProgressView(value: Double(s.memoryUsed), total: Double(s.memoryTotal))
                        HStack {
                            Text("Used: \(used)")
                            Spacer()
                            Text("Total: \(total)")
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    } else { Text("--") }
                }
            }
        }
    }
}

struct ThermalCard: View {
    let snapshots: [ResourceSnapshot]
    var current: ResourceSnapshot? { snapshots.last }

    var body: some View {
        Card {
            HStack { Image(systemName: "thermometer.sun"); Text("Thermal") }
                .font(.headline)
            Text(label(for: current?.thermalState ?? .nominal))
                .font(.title3.bold())
                .foregroundStyle(color(for: current?.thermalState ?? .nominal))
        }
    }

    private func label(for s: ProcessInfo.ThermalState) -> String {
        switch s { case .nominal: return "Nominal"; case .fair: return "Fair"; case .serious: return "Serious"; case .critical: return "Critical"; @unknown default: return "Unknown" }
    }
    private func color(for s: ProcessInfo.ThermalState) -> Color {
        switch s { case .nominal: return .green; case .fair: return .yellow; case .serious: return .orange; case .critical: return .red; @unknown default: return .gray }
    }
}

struct BatteryCard: View {
    let snapshots: [ResourceSnapshot]
    var current: ResourceSnapshot? { snapshots.last }

    var body: some View {
        Card {
            HStack { Image(systemName: "battery.100"); Text("Battery") }
                .font(.headline)
            if let level = current?.batteryLevel {
                HStack {
                    ProgressView(value: Double(level))
                    Text("\(Int(level * 100))%")
                        .font(.subheadline)
                        .monospacedDigit()
                }
                Text("State: \(batteryStateName(current?.batteryState ?? .unknown))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else { Text("--") }
        }
    }

    private func batteryStateName(_ s: UIDevice.BatteryState) -> String {
        switch s { case .charging: return "Charging"; case .full: return "Full"; case .unplugged: return "Unplugged"; default: return "Unknown" }
    }
}

struct DiskNetworkCard: View {
    let snapshots: [ResourceSnapshot]
    var current: ResourceSnapshot? { snapshots.last }

    var body: some View {
        Card {
            HStack(alignment: .top) {
                VStack(alignment: .leading) {
                    Text("Disk")
                        .font(.headline)
                    if let a = current?.diskAvailable, let t = current?.diskTotal {
                        Text("Available: \(UInt64(a).bytesHumanReadable)")
                        Text("Total: \(UInt64(t).bytesHumanReadable)")
                    } else { Text("--") }
                }
                Spacer()
                VStack(alignment: .trailing) {
                    Text("Network")
                        .font(.headline)
                    Text("Status: \(statusName(current?.networkStatus ?? .requiresConnection))")
                }
            }
        }
    }

    private func statusName(_ s: NWPath.Status) -> String {
        switch s { case .satisfied: return "Online"; case .requiresConnection: return "Requires Connection"; case .unsatisfied: return "Offline"; @unknown default: return "Unknown" }
    }
}

struct AppCard: View {
    let snapshots: [ResourceSnapshot]
    var current: ResourceSnapshot? { snapshots.last }

    var body: some View {
        Card {
            HStack(spacing: 16) {
                Image(systemName: "app.badge")
                    .symbolRenderingMode(.hierarchical)
                    .font(.system(size: 28, weight: .semibold))
                VStack(alignment: .leading) {
                    Text("This App")
                        .font(.headline)
                    if let s = current {
                        Text("Memory Footprint: \(s.appMemoryFootprint.bytesHumanReadable)")
                        Text("Threads: \(s.appThreadCount)")
                    } else { Text("--") }
                }
                Spacer()
            }
        }
    }
}


// MARK: - Reusable UI

struct Card<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .center, spacing: 12) {
            content
                .frame(maxWidth: .infinity) // 讓內部內容撐滿
        }
        .padding(16)
        .frame(minHeight: 120) // 統一高度
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(.separator.opacity(0.2))
        )
    }
}
