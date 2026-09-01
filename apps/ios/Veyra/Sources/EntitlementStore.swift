import Foundation
import SwiftUI

@MainActor
public final class EntitlementStore: ObservableObject {
    @Published public private(set) var tier: PremiumTier = .free
    @Published public private(set) var plan: SubscriptionPlan?
    @Published public private(set) var status: String = "none"
    @Published public private(set) var expiresAt: String?
    @Published public private(set) var autoRenew: Bool = false
    @Published public private(set) var creditsRemaining: Int = 1
    @Published public private(set) var backendReachable: Bool = false

    private let api = APIClient.shared

    public init() {
        loadGuestCredit()
    }

    public func updateBackendReachability(_ reachable: Bool) {
        backendReachable = reachable
    }

    public func refreshEntitlement() async {
        guard backendReachable else { return }

        do {
            let response: SubscriptionStatusResponse = try await api.request("/subscription/status", authenticated: true)
            tier = response.tier
            plan = response.plan
            status = response.status
            expiresAt = response.expiresAt
            autoRenew = response.autoRenew

            let credits: EntitlementResponse = try await api.request("/entitlement/status", authenticated: true)
            creditsRemaining = credits.creditsRemaining
        } catch {
            print("[EntitlementStore] refresh failed: \(error)")
        }
    }

    public func isLocked(_ effectId: String) -> Bool {
        guard let effect = EffectCatalog.shared.effect(for: effectId) else { return false }
        guard effect.premium else { return false }
        if tier == .premium { return false }
        return creditsRemaining <= 0
    }

    public func canUse(_ effectId: String) -> Bool {
        guard let effect = EffectCatalog.shared.effect(for: effectId) else { return true }
        guard effect.premium else { return true }
        if tier == .premium { return true }
        return creditsRemaining > 0
    }

    public func activate(_ effectId: String) async -> Bool {
        guard let effect = EffectCatalog.shared.effect(for: effectId) else {
            return true // Non-premium, allow
        }

        if !effect.premium {
            return true
        }

        if tier == .premium {
            return true
        }

        if creditsRemaining <= 0 {
            return false
        }

        let consumed = await consumePremiumCredit()
        return consumed
    }

    public func consumePremium() async -> Bool {
        if tier == .premium {
            return true
        }

        if creditsRemaining <= 0 {
            return false
        }

        return await consumePremiumCredit()
    }

    private func consumePremiumCredit() async -> Bool {
        do {
            struct ConsumeResponse: Codable {
                let allowed: Bool
                let reason: String
                let creditsRemaining: Int?
            }
            let response: ConsumeResponse = try await api.request(
                "/entitlement/consume-premium-effect",
                method: "POST",
                body: try JSONEncoder().encode([:]),
                authenticated: true
            )

            if response.allowed, let remaining = response.creditsRemaining {
                creditsRemaining = remaining
                saveGuestCredit()
                return true
            }

            return false
        } catch {
            // Offline fallback: use guest credit
            if !backendReachable {
                let next = max(0, creditsRemaining - 1)
                creditsRemaining = next
                saveGuestCredit()
                return next > 0
            }
            return false
        }
    }

    private func loadGuestCredit() {
        if let saved = UserDefaults.standard.object(forKey: "veyra_guest_credit") as? Int {
            creditsRemaining = saved
        }
    }

    private func saveGuestCredit() {
        UserDefaults.standard.set(creditsRemaining, forKey: "veyra_guest_credit")
    }
}

struct SubscriptionStatusResponse: Codable {
    let tier: PremiumTier
    let plan: SubscriptionPlan?
    let status: String
    let expiresAt: String?
    let autoRenew: Bool
}

struct EntitlementResponse: Codable {
    let tier: PremiumTier
    let creditsRemaining: Int
}
