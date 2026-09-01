import SwiftUI

public struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var authStore: AuthStore
    @EnvironmentObject var studioStore: StudioStore
    @EnvironmentObject var entitlementStore: EntitlementStore

    @State private var name: String = ""
    @State private var showDeleteAlert = false

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                Text("Settings")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 20)
                    .padding(.top, 20)

                // Account
                VStack(alignment: .leading, spacing: 16) {
                    Text("Account")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)

                    if let session = appState.session ?? authStore.currentUser {
                        VStack(spacing: 12) {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Display name")
                                        .font(.system(size: 10, weight: .medium))
                                        .tracking(1)
                                        .foregroundStyle(Color(hex: "888899"))

                                    TextField("Your name", text: $name)
                                        .font(.system(size: 14))
                                        .foregroundStyle(.white)
                                        .disableAutocorrection(true)
                                }

                                Spacer()

                                Button("Save") {
                                    Task {
                                        try? await APIClient.shared.request(
                                            "/user/me",
                                            method: "PATCH",
                                            body: try? JSONEncoder().encode(["name": name]),
                                            authenticated: true
                                        )
                                        await appState.refreshUser()
                                    }
                                }
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color(hex: "14f195"))
                                .disabled(name.isEmpty)
                            }
                            .padding(12)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color(hex: "0f0f18"))
                            )

                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Email")
                                        .font(.system(size: 10, weight: .medium))
                                        .tracking(1)
                                        .foregroundStyle(Color(hex: "888899"))
                                    Text(session.email)
                                        .font(.system(size: 14))
                                        .foregroundStyle(Color(hex: "888899"))
                                }

                                Spacer()

                                HStack(spacing: 8) {
                                    Text(entitlementStore.tier == .premium ? "Premium" : "Free")
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(entitlementStore.tier == .premium ? Color(hex: "7c5cff") : Color(hex: "888899"))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 4)
                                        .background(
                                            RoundedRectangle(cornerRadius: 8)
                                                .fill(entitlementStore.tier == .premium ? Color(hex: "7c5cff").opacity(0.15) : Color(hex: "333344").opacity(0.5))
                                        )

                                    Button(action: {}) {
                                        Text("Sign out")
                                            .font(.system(size: 12, weight: .medium))
                                            .foregroundStyle(Color(hex: "888899"))
                                    }
                                }
                            }
                            .padding(12)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(Color(hex: "0f0f18"))
                            )
                        }
                        .padding(.horizontal, 20)
                    } else {
                        // Guest state
                        VStack(spacing: 12) {
                            Text("You're using Veyra without an account.")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Color(hex: "888899"))

                            HStack(spacing: 8) {
                                Text("Backend: \(appState.backendReachable ? "Connected" : "Offline")")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(appState.backendReachable ? Color(hex: "14f195") : .red)

                                Button("Continue as guest") {
                                    appState.setOnboarded(true)
                                }
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color(hex: "14f195"))
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                }
                .padding(.vertical, 8)

                // Privacy
                VStack(alignment: .leading, spacing: 12) {
                    Text("Privacy")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Camera access")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.white)

                        Text("Face tracking and background segmentation run on-device. Uploaded backgrounds and face assets are stored only on your machine.")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color(hex: "888899"))
                            .fixedSize(horizontal: false, vertical: true)

                        Button(action: {
                            // Clear local data
                            UserDefaults.standard.removePersistentDomain(forName: Bundle.main.bundleIdentifier ?? "")
                            appState.showToast(.success, message: "Local data cleared.")
                        }) {
                            Text("Delete local assets & data")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(.red)
                        }
                    }
                    .padding(14)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color(hex: "0f0f18"))
                    )
                    .padding(.horizontal, 20)
                }

                // Subscription
                VStack(alignment: .leading, spacing: 12) {
                    Text("Subscription")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)

                    HStack {
                        Text("Server-verified entitlement status:")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color(hex: "888899"))

                        Spacer()

                        Text(entitlementStore.tier == .premium ? "Premium active" : "Free (1 trial included)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(entitlementStore.tier == .premium ? Color(hex: "14f195") : Color(hex: "888899"))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(entitlementStore.tier == .premium ? Color(hex: "14f195").opacity(0.15) : Color(hex: "333344").opacity(0.5))
                            )
                    }
                    .padding(.horizontal, 20)

                    Button("Manage plan") {
                        // Navigate to premium
                    }
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color(hex: "7c5cff"))
                    .padding(.horizontal, 20)
                }

                // Advanced
                VStack(alignment: .leading, spacing: 12) {
                    Text("Advanced")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)

                    VStack(spacing: 10) {
                        ToggleRow(label: "Developer mode (diagnostics)", isOn: $appState.devMode)
                    }
                    .padding(.horizontal, 20)
                }

                // Danger zone
                VStack(alignment: .leading, spacing: 12) {
                    Text("Danger zone")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.red)
                        .padding(.horizontal, 20)

                    HStack {
                        Text("Permanently delete your account and all server-side data.")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color(hex: "888899"))

                        Spacer()

                        Button("Delete account") {
                            showDeleteAlert = true
                        }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.red)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.red.opacity(0.4), lineWidth: 1)
                        )
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.red.opacity(0.05))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.red.opacity(0.2), lineWidth: 1)
                            )
                    )
                    .padding(.horizontal, 20)
                    .alert("Delete account", isPresented: $showDeleteAlert) {
                        Button("Cancel", role: .cancel) {}
                        Button("Delete", role: .destructive) {
                            Task {
                                try? await authStore.deleteAccount()
                            }
                        }
                    } message: {
                        Text("This cannot be undone.")
                    }
                }
                .padding(.bottom, 20)
            }
        }
        .background(Color(hex: "07070d").ignoresSafeArea())
        .onAppear {
            name = appState.session?.user.name ?? ""
        }
    }
}

struct ToggleRow: View {
    let label: String
    @Binding var isOn: Bool

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white)

            Spacer()

            Toggle("", isOn: $isOn)
                .labelsHidden()
                .tint(Color(hex: "14f195"))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(hex: "0f0f18"))
        )
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppState())
        .environmentObject(StudioStore())
        .environmentObject(AuthStore())
        .environmentObject(EntitlementStore())
}
