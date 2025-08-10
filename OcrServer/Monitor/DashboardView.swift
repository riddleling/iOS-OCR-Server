//
//  DashboardView.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/10.
//

import SwiftUI


// MARK: - SwiftUI Views

struct DashboardView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var sampler = Sampler()

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    CPUCard(snapshots: sampler.snapshots)
                    MemoryCard(snapshots: sampler.snapshots)
                    HStack(spacing: 16) {
                        ThermalCard(snapshots: sampler.snapshots)
                                .frame(maxWidth: .infinity)
                            BatteryCard(snapshots: sampler.snapshots)
                                .frame(maxWidth: .infinity)
                    }
                    DiskNetworkCard(snapshots: sampler.snapshots)
                    AppCard(snapshots: sampler.snapshots)
                }
                .padding()
            }
            .navigationTitle("Monitor")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { sampler.clear() }) {
                        Image(systemName: "trash")
                    }
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: toggleSampling) {
                        Image(systemName: sampler.isRunning ? "pause.circle" : "play.circle")
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.title2)
                            .foregroundColor(.primary)
                    }
                }
            }
        }
        .onAppear { sampler.start() }
        .onDisappear { sampler.stop() }
    }

    private var samplerRunning: Bool { sampler.snapshots.count > 0 }
    private func toggleSampling() {
        sampler.isRunning ? sampler.stop() : sampler.start()
    }
}
