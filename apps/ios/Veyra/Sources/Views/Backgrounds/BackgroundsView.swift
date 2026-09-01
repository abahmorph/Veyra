import SwiftUI

public struct BackgroundsView: View {
    @EnvironmentObject var studioStore: StudioStore
    @EnvironmentObject var entitlementStore: EntitlementStore
    @EnvironmentObject var pipeline: CameraPipeline

    @State private var selectedMode: BackgroundMode = .none

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text("Backgrounds")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text("Remove, blur or replace your background in real time.")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color(hex: "888899"))
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)

                // Modes
                VStack(alignment: .leading, spacing: 10) {
                    Text("Mode")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach([BackgroundMode.none, .blur, .remove, .image], id: \.rawValue) { mode in
                                Button(action: {
                                    selectedMode = mode
                                    applyBackgroundMode(mode)
                                }) {
                                    Text(modeLabel(mode))
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundStyle(selectedMode == mode ? Color(hex: "05241a") : Color(hex: "888899"))
                                        .padding(.horizontal, 18)
                                        .padding(.vertical, 10)
                                        .background(
                                            RoundedRectangle(cornerRadius: 12)
                                                .fill(selectedMode == mode ? Color(hex: "14f195") : Color(hex: "333344").opacity(0.5))
                                        )
                                }
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                }

                // Built-in backgrounds
                VStack(alignment: .leading, spacing: 12) {
                    Text("Built-in")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(builtinBackgrounds) { bg in
                                BackgroundCard(background: bg) {
                                    applyBackground(bg)
                                }
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                }

                // Upload
                VStack(alignment: .leading, spacing: 10) {
                    Text("Your backgrounds")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)

                    Button(action: {}) {
                        HStack {
                            Image(systemName: "plus")
                            Text("Upload background")
                        }
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color(hex: "14f195"))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color(hex: "333344"), lineWidth: 1)
                        )
                    }
                    .padding(.horizontal, 20)
                }

                // Green screen
                VStack(alignment: .leading, spacing: 10) {
                    Text("Green screen")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)

                    HStack(spacing: 10) {
                        Button(action: { applyGreenScreen() }) {
                            Text("Enable Green Screen")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                                .background(
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(Color(hex: "14f195"))
                                )
                        }

                        if studioStore.background?.mode == .green {
                            Button(action: { applyBackground(nil) }) {
                                Text("Disable")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(Color(hex: "888899"))
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 10)
                                    .background(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color(hex: "333344"), lineWidth: 1)
                                    )
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .padding(.bottom, 20)
            }
        }
        .background(Color(hex: "07070d").ignoresSafeArea())
    }

    private func modeLabel(_ mode: BackgroundMode) -> String {
        switch mode {
        case .none: return "Original"
        case .blur: return "Blur"
        case .remove: return "Transparent"
        case .image: return "Replace"
        default: return mode.rawValue.capitalized
        }
    }

    private func applyBackgroundMode(_ mode: BackgroundMode) {
        switch mode {
        case .none:
            applyBackground(nil)
        case .blur:
            applyBackground(BackgroundDefinition(id: "bg-blur", name: "Blur", mode: .blur, premium: false, kind: "builtin", blurStrength: 0.6))
        case .remove:
            applyBackground(BackgroundDefinition(id: "bg-remove", name: "Transparent", mode: .remove, premium: false, kind: "builtin"))
        default:
            break
        }
    }

    private func applyBackground(_ bg: BackgroundDefinition?) {
        studioStore.setBackground(bg)
        pipeline.setBackground(bg)
    }

    private func applyGreenScreen() {
        let bg = BackgroundDefinition(id: "bg-green", name: "Green Screen", mode: .green, premium: false, kind: "builtin")
        applyBackground(bg)
    }

    private var builtinBackgrounds: [BackgroundDefinition] {
        [
            BackgroundDefinition(id: "bg-gradient-1", name: "Sunset", mode: .gradient, premium: false, kind: "builtin", gradient: [
                GradientStop(offset: 0, color: "#1a1a2e"),
                GradientStop(offset: 1, color: "#e94560")
            ]),
            BackgroundDefinition(id: "bg-gradient-2", name: "Ocean", mode: .gradient, premium: false, kind: "builtin", gradient: [
                GradientStop(offset: 0, color: "#0f2027"),
                GradientStop(offset: 1, color: "#2c5364")
            ]),
            BackgroundDefinition(id: "bg-gradient-3", name: "Forest", mode: .gradient, premium: false, kind: "builtin", gradient: [
                GradientStop(offset: 0, color: "#0f2027"),
                GradientStop(offset: 1, color: "#203a43")
            ]),
            BackgroundDefinition(id: "bg-blur", name: "Blur", mode: .blur, premium: false, kind: "builtin", blurStrength: 0.6),
            BackgroundDefinition(id: "bg-remove", name: "Transparent", mode: .remove, premium: false, kind: "builtin"),
        ]
    }
}

struct BackgroundCard: View {
    let background: BackgroundDefinition
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(hex: "1a1a2e"))

                if let gradient = background.gradient, gradient.count >= 2 {
                    LinearGradient(
                        colors: gradient.map { Color(hex: $0.color) },
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                } else if background.mode == .blur {
                    Text("Blur")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.7))
                } else if background.mode == .remove {
                    Text("Transparent")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.7))
                } else if background.mode == .green {
                    Color(hex: "#00b140")
                }

                VStack {
                    Spacer()
                    Text(background.name)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                        .background(.black.opacity(0.5))
                }
                .padding(8)
            }
            .frame(width: 140, height: 100)
        }
    }
}

#Preview {
    BackgroundsView()
        .environmentObject(StudioStore())
        .environmentObject(EntitlementStore())
        .environmentObject(CameraPipeline())
}
