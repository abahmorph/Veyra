import Foundation
import StoreKit

@MainActor
public final class SubscriptionManager: ObservableObject {
    public static let shared = SubscriptionManager()

    @Published public private(set) var products: [Product] = []
    @Published public private(set) var purchasedProductIDs: Set<String> = []
    @Published public private(set) var isPurchasing: Bool = false

    private let monthlyProductID = "veyra.premium.monthly"
    private let yearlyProductID = "veyra.premium.yearly"

    private init() {
        Task {
            await listenForTransactions()
            await updatePurchasedProducts()
        }
    }

    public func loadProducts() async {
        do {
            let storeProducts = try await Product.products(for: [monthlyProductID, yearlyProductID])
            products = storeProducts
        } catch {
            print("[SubscriptionManager] failed to load products: \(error)")
        }
    }

    public func purchase(_ product: Product) async throws -> Bool {
        isPurchasing = true
        defer { isPurchasing = false }

        let result = try await product.purchase()

        switch result {
        case .success(let verification):
            let transaction = try verification.payloadValue
            await transaction.finish()
            await updatePurchasedProducts()
            return true
        case .userCancelled:
            return false
        case .pending:
            return false
        default:
            return false
        }
    }

    public func restorePurchases() async {
        do {
            try await AppStore.sync()
            await updatePurchasedProducts()
        } catch {
            print("[SubscriptionManager] restore failed: \(error)")
        }
    }

    private func updatePurchasedProducts() async {
        var purchased: Set<String> = []

        for await result in Transaction.currentEntitlements {
            guard let transaction = try? result.payloadValue else { continue }
            purchased.insert(transaction.productID)
        }

        purchasedProductIDs = purchased
    }

    private func listenForTransactions() async {
        for await _ in Transaction.updates {
            await updatePurchasedProducts()
        }
    }

    public func isPremium() -> Bool {
        return purchasedProductIDs.contains(monthlyProductID) || purchasedProductIDs.contains(yearlyProductID)
    }
}
