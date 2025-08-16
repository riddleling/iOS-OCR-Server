//
//  DonationView.swift
//  OcrServer
//
//  Created by Riddle Ling on 2025/8/15.
//

import SwiftUI
import StoreKit

// MARK: - Donation View
struct DonationView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var product: Product?
    @State private var showingThanks = false
    @State private var thanksMsg = ""
    @State private var isBuying = false
    
    let productId = "site.riddleling.app.OcrServer.iap.coffee"
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                Text("OCR Server provides all features for free to everyone. You can support this project by offering coffee.")
                    .font(.body)
                    .padding()
                
                Image(systemName: "cup.and.saucer")
                    .font(.system(size: 80))
                    .foregroundColor(.primary)
                    .padding()
                
                Text("One-time donation")
                    .font(.body)
                    .padding()
                
                
                Button {
                    Task { await buyProduct() }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "cup.and.saucer.fill")
                            .font(.title3)
                        if let p = product {
                            // 顯示商品名稱 + 本地化價格（例如：NT$30、$0.99）
                            Text("\(p.displayName)（\(p.displayPrice)）")
                        } else {
                            Text("Loading...")
                        }
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                }
                .background(product == nil || isBuying ? Color.gray : Color.blue)
                .cornerRadius(8)
                .disabled(product == nil || isBuying)
                
                if let p = product, !p.description.isEmpty {
                    Text("\(p.description)")
                        .font(.subheadline)
                        .foregroundColor(.gray)
                        .padding()
                }
                
                Spacer()
            }
            .navigationTitle("Donation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
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
            .task {
                await loadProduct()
                observeTransactions() // 處理可能遺留的交易
            }
            .alert("Thank you!", isPresented: $showingThanks) {
                Button("OK") { }
            } message: {
                Text(thanksMsg)
            }
        }
    }
    
    private func loadProduct() async {
        do {
            product = try await Product.products(for: [productId]).first
        } catch {
            print("Product loading failed: \(error)")
        }
    }
    
    private func buyProduct() async {
        guard let product = product else { return }
        isBuying = true
        defer { isBuying = false }

        do {
            let result = try await product.purchase()

            switch result {
            case .success(let verification):
                guard case .verified(let transaction) = verification else {
                    print("Unverified transaction")
                    return
                }
                // 成功：顯示感謝並 finish（Consumable 必要）
                print("Purchase successful")
                thanksMsg = "Thanks for buying me a coffee! I really appreciate your support."
                showingThanks = true
                await transaction.finish()

            case .userCancelled:
                // 使用者取消，不需處理
                break

            case .pending:
                // 等待家長同意或其他延遲
                print("Purchase pending")

            @unknown default:
                print("Purchase unknown result")
                break
            }
        } catch {
            print("Purchase failed: \(error)")
        }
    }
    
    private func observeTransactions() {
        Task {
            for await result in Transaction.updates {
                guard case .verified(let transaction) = result else { continue }
                // 對於 Consumable，確保 finish，避免重覆提示
                await transaction.finish()
            }
        }
    }
}
