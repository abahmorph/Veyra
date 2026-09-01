import SwiftUI

public struct EffectsView: View {
    @EnvironmentObject var studioStore: StudioStore
    @EnvironmentObject var entitlementStore: EntitlementStore
    @EnvironmentObject var pipeline: CameraPipeline

    @State private var selectedCategory: EffectCategory = .all
    @State private var selectedEffect: EffectDefinition?

    private let categories: [(id: EffectCategory, label: String)] = [
        (.all, "All"),
        (.face, "Face"),
        (.character, "Character"),
        (.privacy, "Privacy"),
    ]

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text("Effects")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text(entitlementStore.tier == .premium
                         ? "All premium effects unlocked."
                         : "\(entitlementStore.creditsRemaining) free premium effect\(entitlementStore.creditsRemaining == 1 ? "" : "s") remaining.")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color(hex: "888899"))
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)

                // Categories
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(categories, id: \.id) { category in
                            Button(action: { selectedCategory = category.id }) {
                                Text(category.label)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(selectedCategory == category.id ? Color(hex: "05241a") : Color(hex: "888899"))
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(
                                        RoundedRectangle(cornerRadius: 20)
                                            .fill(selectedCategory == category.id ? Color(hex: "14f195") : Color(hex: "333344").opacity(0.5))
                                    )
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }

                // Effects grid
                let filteredEffects = filteredEffects()
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 12)], spacing: 12) {
                    ForEach(filteredEffects) { effect in
                        EffectCard(effect: effect)
                            .onTapGesture {
                                Task {
                                    let allowed = await entitlementStore.activate(effect.id)
                                    if allowed {
                                        pipeline.setEffect(effect.id)
                                        studioStore.setEffect(effect.id)
                                    }
                                }
                            }
                    }
                }
                .padding(.horizontal, 20)

                // Trust disclosure
                Text("Face effects that transform or replace a face are clearly synthetic. Veyra never markets face-swap for impersonation. Use only media you own or have permission to use.")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color(hex: "888899"))
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(
                                LinearGradient(
                                    colors: [Color(hex: "120f2b").opacity(0.6), Color(hex: "0c1f1a").opacity(0.6)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                    )
                    .padding(.horizontal, 20)
                    .padding(.bottom, 20)
            }
        }
        .background(Color(hex: "07070d").ignoresSafeArea())
    }

    private func filteredEffects() -> [EffectDefinition] {
        let all = EffectCatalog.shared.effects.filter { $0.id != "none" }
        guard selectedCategory != .all else { return all }
        return all.filter { $0.category == selectedCategory }
    }
}

struct EffectCard: View {
    let effect: EffectDefinition
    @EnvironmentObject var studioStore: StudioStore
    @EnvironmentObject var entitlementStore: EntitlementStore

    var isActive: Bool {
        studioStore.effectId == effect.id
    }

    var isLocked: Bool {
        entitlementStore.isLocked(effect.id)
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            VStack(alignment: .leading, spacing: 10) {
                // Thumbnail
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            LinearGradient(
                                colors: [Color(hex: "1a1a2e"), Color(hex: "0d0d17")],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(height: 120)

                    // Preview dots
                    HStack(spacing: 4) {
                        ForEach(0..<effect.id.count, id: \.self) { _ in
                            Circle()
                                .fill(isActive ? Color(hex: "14f195").opacity(0.5) : Color(hex: "7c5cff").opacity(0.35))
                                .frame(width: 4, height: 4)
                        }
                    }
                    .padding(.bottom, 8)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text(effect.name)
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white)

                    Text(effect.description)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color(hex: "888899"))
                        .lineLimit(2)

                    HStack {
                        Text(effect.preview)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(isActive ? Color(hex: "14f195") : Color(hex: "555566"))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(isActive ? Color(hex: "14f195").opacity(0.15) : Color(hex: "333344").opacity(0.5))
                            )

                        if effect.requiresFace {
                            Text("face")
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(Color(hex: "888899"))
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
            }
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(hex: "0f0f18").opacity(0.8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(isActive ? Color(hex: "14f195").opacity(0.5) : Color(hex: "333344"), lineWidth: 1)
                    )
            )

            // Lock overlay
            if isLocked {
                LockOverlay()
                    .allowsHitTesting(false)
            }

            // Active checkmark
            if isActive {
                ZStack {
                    Circle()
                        .fill(Color(hex: "14f195"))
                        .frame(width: 24, height: 24)
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color(hex: "05241a"))
                }
                .padding(8)
            }

            // Premium badge
            if effect.premium {
                HStack(spacing: 4) {
                    Image(systemName: "sparkles")
                    Text("PREMIUM")
                }
                .font(.system(size: 8, weight: .bold))
                .foregroundStyle(Color(hex: "b9a7ff"))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(
                            LinearGradient(
                                colors: [Color(hex: "7c5cff").opacity(0.3), Color(hex: "ff3d81").opacity(0.3)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(hex: "7c5cff").opacity(0.4), lineWidth: 1)
                        )
                )
                .padding(8)
            }
        }
    }
}

struct LockOverlay: View {
    var body: some View {
        Rectangle()
            .fill(Color(hex: "05050b").opacity(0.72))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                VStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(Color(hex: "7c5cff").opacity(0.15))
                            .frame(width: 48, height: 48)
                            .overlay(
                                Circle()
                                    .stroke(Color(hex: "7c5cff").opacity(0.4), lineWidth: 1.5)
                            )
                        Image(systemName: "sparkles")
                            .font(.system(size: 22))
                            .foregroundStyle(Color(hex: "b9a7ff"))
                    }

                    VStack(spacing: 4) {
                        Text("Premium Effect")
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                            .foregroundStyle(.white)
                    }

                    Button(action: {}) {
                        Text("Unlock Premium")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color(hex: "05241a"))
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
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
            )
    }
}

#Preview {
    EffectsView()
        .environmentObject(StudioStore())
        .environmentObject(EntitlementStore())
        .environmentObject(AppState())
        .environmentObject(CameraPipeline())
}
