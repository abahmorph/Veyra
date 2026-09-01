import SwiftUI

public struct TopBarView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var studioStore: StudioStore
    @EnvironmentObject var authStore: AuthStore
    @Binding var selectedTab: Tab

    @State private var showDevMode = false

    public init(selectedTab: Binding<Tab>) {
        self._selectedTab = selectedTab
    }

    public var body: some View {
        VStack(spacing: 0) {
            HStack {
                // Logo
                HStack(spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(
                                LinearGradient(
                                    colors: [Color(hex: "14f195"), Color(hex: "0dcbc0")],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 36, height: 36)
                        Text("V")
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .foregroundStyle(Color(hex: "05241a"))
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("Veyra")
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                        Text("AI Video Studio")
                            .font(.system(size: 9, weight: .medium, design: .rounded))
                            .tracking(1.8)
                            .foregroundStyle(Color(hex: "888899"))
                    }
                }

                Spacer()

                // Dev mode toggle
                Button(action: {
                    showDevMode.toggle()
                    appState.setDevMode(showDevMode)
                }) {
                    Text(showDevMode ? "Dev: On" : "Dev: Off")
                        .font(.system(size: 9, weight: .medium))
                        .tracking(1)
                        .foregroundStyle(showDevMode ? Color(hex: "14f195") : Color(hex: "555566"))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(showDevMode ? Color(hex: "14f195").opacity(0.4) : Color(hex: "333344"), lineWidth: 1)
                        )
                }

                // Premium button
                Button(action: { selectedTab = .premium }) {
                    Text("Unlock Premium")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color(hex: "b9a7ff"))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color(hex: "7c5cff").opacity(0.15))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color(hex: "7c5cff").opacity(0.4), lineWidth: 1)
                                )
                        )
                }

                // User avatar / sign in
                if let session = authStore.currentUser ?? appState.session?.user {
                    HStack(spacing: 8) {
                        ZStack {
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [Color(hex: "7c5cff"), Color(hex: "ff3d81")],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 28, height: 28)
                            Text(String(session.name.prefix(1)).uppercased())
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        VStack(alignment: .leading, spacing: 1) {
                            Text(session.name)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(.white)
                            Text(session.subscription.tier == "premium" ? "PRO" : "Free")
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(Color(hex: "888899"))
                        }
                    }
                } else {
                    Button(action: {
                        // Show auth panel
                    }) {
                        Text("Sign in")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color(hex: "888899"))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color(hex: "333344"), lineWidth: 1)
                            )
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 10)
            .background(
                Rectangle()
                    .fill(Color(hex: "07070d").opacity(0.9))
                    .ignoresSafeArea(edges: .top)
            )
        }
    }
}

#Preview {
    TopBarView(selectedTab: .constant(.studio))
        .environmentObject(AppState())
        .environmentObject(StudioStore())
        .environmentObject(AuthStore())
        .environmentObject(EntitlementStore())
}
