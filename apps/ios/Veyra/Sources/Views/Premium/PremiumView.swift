import SwiftUI
import StoreKit

public struct PremiumView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var entitlementStore: EntitlementStore
    @EnvironmentObject var subscriptionManager: SubscriptionManager

    @State private var selectedPlan: SubscriptionPlan = .yearly
    @State private var isLoading = false

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                VStack(spacing: 12) {
                    Spacer()

                    ZStack {
                        RoundedRectangle(cornerRadius: 20)
                            .fill(
                                LinearGradient(
                                    colors: [Color(hex: "7c5cff"), Color(hex: "ff3d81")],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 64, height: 64)
                            .shadow(color: Color(hex: "7c5cff").opacity(0.4), radius: 20, x: 0, y: 8)

                        Image(systemName: "sparkles")
                            .font(.system(size: 28))
                            .foregroundStyle(.white)
                    }

                    Text("Veyra Premium")
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text("Unlock the full AI effects library, premium backgrounds, voice presets and more.")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color(hex: "888899"))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)

                    Spacer()
                }
                .padding(.top, 20)

                // Active premium state
                if entitlementStore.tier == .premium {
                    VStack(spacing: 12) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 36))
                            .foregroundStyle(Color(hex: "14f195"))

                        Text("You're premium 🎉")
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)

                        if let plan = entitlementStore.plan, let expiresAt = entitlementStore.expiresAt {
                            Text("\(plan.rawValue.capitalized) plan · expires \(expiresAt)")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Color(hex: "888899"))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color(hex: "0f0f18"))
                    )
                    .padding(.horizontal, 20)
                }

                // Billing toggle
                HStack(spacing: 0) {
                    Button(action: { selectedPlan = .monthly }) {
                        Text("Monthly")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(selectedPlan == .monthly ? Color(hex: "05241a") : Color(hex: "888899"))
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(selectedPlan == .monthly ? Color(hex: "14f195") : Color.clear)
                            )
                    }

                    Button(action: { selectedPlan = .yearly }) {
                        HStack(spacing: 6) {
                            Text("Yearly")
                            Text("Save 17%")
                                .font(.system(size: 10, weight: .bold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    RoundedRectangle(cornerRadius: 6)
                                        .fill(selectedPlan == .yearly ? Color(hex: "05241a").opacity(0.2) : Color(hex: "14f195").opacity(0.15))
                                )
                                .foregroundStyle(selectedPlan == .yearly ? Color(hex: "05241a") : Color(hex: "14f195"))
                        }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(selectedPlan == .yearly ? Color(hex: "05241a") : Color(hex: "888899"))
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(selectedPlan == .yearly ? Color(hex: "14f195") : Color.clear)
                        )
                    }
                }
                .padding(.horizontal, 20)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(Color(hex: "333344").opacity(0.3))
                )
                .padding(.horizontal, 20)

                // Pricing cards
                HStack(spacing: 12) {
                    // Monthly
                    VStack(spacing: 12) {
                        Text("Monthly")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)

                        Text("₦6,000")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)

                        Text("/month")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color(hex: "888899"))

                        Text("Cancel anytime")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Color(hex: "888899"))

                        Button(action: { subscribe(to: .monthly) }) {
                            Text("Pay ₦6,000")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Color(hex: "05241a"))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(Color(hex: "14f195"))
                                )
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color(hex: "0f0f18"))
                    )

                    // Yearly
                    VStack(spacing: 12) {
                        Text("Yearly")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)

                        Text("₦60,000")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [Color(hex: "14f195"), Color(hex: "0dcbc0")],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )

                        Text("/year")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color(hex: "888899"))

                        Text("≈ ₦5,000/month")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(Color(hex: "888899"))

                        Button(action: { subscribe(to: .yearly) }) {
                            HStack {
                                Text("Pay ₦60,000")
                                Image(systemName: "arrow.right")
                            }
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(
                                        LinearGradient(
                                            colors: [Color(hex: "7c5cff"), Color(hex: "ff3d81")],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                            )
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color(hex: "0f0f18"))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(Color(hex: "7c5cff").opacity(0.4), lineWidth: 1.5)
                            )
                    )
                }
                .padding(.horizontal, 20)

                // Benefits
                VStack(alignment: .leading, spacing: 12) {
                    Text("Benefits")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)

                    HStack(spacing: 12) {
                        BenefitCard(icon: "bolt.fill", title: "Full effects library", description: "All premium face, character and glitch effects.")
                        BenefitCard(icon: "photo.fill", title: "Premium backgrounds", description: "Cinematic built-in scenes and unlimited uploads.")
                        BenefitCard(icon: "checkmark.shield.fill", title: "Honest & private", description: "Local processing, clear AI labels, no hidden fees.")
                    }
                    .padding(.horizontal, 20)
                }

                // Note
                Text("Prices are configured server-side. Premium activates instantly via Apple In-App Purchase. Cancel anytime from Settings.")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color(hex: "888899"))
                    .padding(.horizontal, 20)
                    .padding(.bottom, 20)
            }
        }
        .background(Color(hex: "07070d").ignoresSafeArea())
        .onAppear {
            Task { await subscriptionManager.loadProducts() }
        }
    }

    private func subscribe(to plan: SubscriptionPlan) {
        guard let product = subscriptionManager.products.first(where: { $0.id == productID(for: plan) }) else {
            return
        }

        Task {
            isLoading = true
            let success = try? await subscriptionManager.purchase(product)
            if success == true {
                await entitlementStore.refreshEntitlement()
            }
            isLoading = false
        }
    }

    private func productID(for plan: SubscriptionPlan) -> String {
        switch plan {
        case .monthly: return "veyra.premium.monthly"
        case .yearly: return "veyra.premium.yearly"
        }
    }
}

struct BenefitCard: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(Color(hex: "14f195"))

            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)

            Text(description)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color(hex: "888899"))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color(hex: "0f0f18"))
        )
    }
}

#Preview {
    PremiumView()
        .environmentObject(AppState())
        .environmentObject(EntitlementStore())
        .environmentObject(SubscriptionManager.shared)
}
