//
//  LineChart.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/10.
//

import SwiftUI

/// Lightweight line chart for 0..1 values
struct LineChart: View {
    let values: [Double]

    var body: some View {
        GeometryReader { geo in
            let maxV: Double = max(values.max() ?? 1, 0.0001)
            let stepX = geo.size.width / CGFloat(max(values.count - 1, 1))
            let points: [CGPoint] = values.enumerated().map { idx, v in
                CGPoint(x: CGFloat(idx) * stepX,
                        y: geo.size.height - CGFloat(v / maxV) * geo.size.height)
            }
            Path { path in
                guard let first = points.first else { return }
                path.move(to: first)
                for p in points.dropFirst() { path.addLine(to: p) }
            }
            .stroke(.primary.opacity(0.7), lineWidth: 1.5)
        }
    }
}
