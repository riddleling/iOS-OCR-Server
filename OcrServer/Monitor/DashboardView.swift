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
    let showsCloseButton: Bool
    let onOpenDonation: (() -> Void)?
    let onOpenSettings: (() -> Void)?
    
    init(
        showsCloseButton: Bool = true,
        onOpenDonation: (() -> Void)? = nil,
        onOpenSettings: (() -> Void)? = nil
    ) {
        self.showsCloseButton = showsCloseButton
        self.onOpenDonation = onOpenDonation
        self.onOpenSettings = onOpenSettings
    }

    var body: some View {
        NavigationStack {
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
                ToolbarItemGroup(placement: .topBarLeading) {
                    if let onOpenDonation {
                        Button(action: onOpenDonation) {
                            Image(systemName: "cup.and.saucer")
                        }
                        .accessibilityLabel("Donation")
                    }
                    if let onOpenSettings {
                        Button(action: onOpenSettings) {
                            Image(systemName: "gearshape")
                        }
                        .accessibilityLabel("Settings")
                    }
                    Button(action: { sampler.clear() }) {
                        Image(systemName: "arrow.clockwise.circle")
                    }
                    Button(action: toggleSampling) {
                        Image(systemName: sampler.isRunning ? "pause.circle" : "play.circle")
                    }
                }
                if showsCloseButton {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "xmark")
                                .foregroundColor(.primary)
                        }
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
