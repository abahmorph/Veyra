import SwiftUI

public struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var studioStore: StudioStore
    @EnvironmentObject var authStore: AuthStore
    @EnvironmentObject var entitlementStore: EntitlementStore
    @EnvironmentObject var pipeline: CameraPipeline

    @State private var selectedTab: Tab = .studio

    public init() {}

    public var body: some View {
        ZStack {
            // Background
            Color.black.ignoresSafeArea()

            // Main content
            Group {
                if !appState.onboarded {
                    OnboardingView()
                } else {
                    mainContent
                }
            }
        }
        .onAppear {
            setupPipeline()
        }
        .toastView(toasts: $appState.toasts)
    }

    @ViewBuilder
    private var mainContent: some View {
        ZStack(alignment: .bottom) {
            // Active screen
            Group {
                switch selectedTab {
                case .studio:
                    StudioView()
                case .effects:
                    EffectsView()
                case .backgrounds:
                    BackgroundsView()
                case .voice:
                    VoiceView()
                case .premium:
                    PremiumView()
                case .settings:
                    SettingsView()
                }
            }
            .ignoresSafeArea(edges: .top)

            // Top bar
            TopBarView(selectedTab: $selectedTab)

            // Bottom nav
            BottomNavBar(selectedTab: $selectedTab)
        }
    }

    private func setupPipeline() {
        Task {
            await pipeline.configure()
        }
    }
}

public enum Tab: String, CaseIterable {
    case studio
    case effects
    case backgrounds
    case voice
    case premium
    case settings

    var icon: String {
        switch self {
        case .studio: "video.fill"
        case .effects: "wand.and.stars"
        case .backgrounds: "photo.fill"
        case .voice: "mic.fill"
        case .premium: "sparkles"
        case .settings: "gear"
        }
    }

    var title: String {
        switch self {
        case .studio: "Studio"
        case .effects: "Effects"
        case .backgrounds: "Backgrounds"
        case .voice: "Voice"
        case .premium: "Premium"
        case .settings: "Settings"
        }
    }
}

// MARK: - Toast Modifier

struct ToastViewModifier: ViewModifier {
    @Binding var toasts: [Toast]

    func body(content: Content) -> some View {
        ZStack {
            content

            VStack {
                Spacer()
                ForEach(toasts) { toast in
                    ToastBubble(kind: toast.kind, message: toast.message)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                Spacer(minLength: 80)
            }
        }
    }
}

extension View {
    public func toastView(toasts: Binding<[Toast]>) -> some View {
        self.modifier(ToastViewModifier(toasts: toasts))
    }
}

struct ToastBubble: View {
    let kind: ToastKind
    let message: String

    var body: some View {
        HStack {
            Text(message)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.black.opacity(0.85))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(kind == .error ? Color.red.opacity(0.5) : Color.white.opacity(0.15), lineWidth: 1)
                )
        )
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
        .environmentObject(StudioStore())
        .environmentObject(AuthStore())
        .environmentObject(EntitlementStore())
        .environmentObject(CameraPipeline())
}
