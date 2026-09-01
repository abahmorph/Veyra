import Foundation
import SwiftUI

@MainActor
public final class AppState: ObservableObject {
    @Published public var session: Session?
    @Published public var backendReachable: Bool = false
    @Published public var onboarded: Bool = false
    @Published public var qualityMode: String = "auto"
    @Published public var devMode: Bool = false
    @Published public var toasts: [Toast] = []
    @Published public var toastId: Int = 0

    private let api = APIClient.shared

    public init() {
        // Load from UserDefaults
        if let savedOnboarded = UserDefaults.standard.object(forKey: "veyra_onboarded") as? Bool {
            onboarded = savedOnboarded
        }
        if let savedDevMode = UserDefaults.standard.object(forKey: "veyra_dev_mode") as? Bool {
            devMode = savedDevMode
        }
        if let savedQuality = UserDefaults.standard.string(forKey: "veyra_quality_mode") {
            qualityMode = savedQuality
        }
    }

    public func checkBackend() async {
        await api.checkReachability()
        backendReachable = api.isReachable

        if backendReachable, let token = api.authToken {
            do {
                let user: User = try await api.request("/user/me", authenticated: true)
                session = Session(token: token, user: user)
            } catch {
                if case APIError.unauthorized = error {
                    logout()
                }
            }
        }
    }

    public func login(email: String, password: String) async throws {
        let body = try JSONEncoder().encode(["email": email, "password": password])
        let session: Session = try await api.request("/auth/login", method: "POST", body: body, authenticated: false)
        self.session = session
        api.setAuthToken(session.token)
    }

    public func signup(email: String, password: String, name: String) async throws {
        let body = try JSONEncoder().encode(["email": email, "password": password, "name": name])
        let session: Session = try await api.request("/auth/signup", method: "POST", body: body, authenticated: false)
        self.session = session
        api.setAuthToken(session.token)
    }

    public func logout() async {
        _ = try? await api.request("/auth/logout", method: "POST", authenticated: true)
        api.setAuthToken(nil)
        session = nil
    }

    public func refreshUser() async {
        guard let token = api.authToken else { return }
        do {
            let user: User = try await api.request("/user/me", authenticated: true)
            session = Session(token: token, user: user)
        } catch {
            if case APIError.unauthorized = error {
                logout()
            }
        }
    }

    public func setOnboarded(_ value: Bool) {
        onboarded = value
        UserDefaults.standard.set(value, forKey: "veyra_onboarded")
    }

    public func setDevMode(_ value: Bool) {
        devMode = value
        UserDefaults.standard.set(value, forKey: "veyra_dev_mode")
    }

    public func setQualityMode(_ mode: String) {
        qualityMode = mode
        UserDefaults.standard.set(mode, forKey: "veyra_quality_mode")
    }

    public func showToast(_ kind: ToastKind, message: String) {
        let id = toastId + 1
        toastId = id
        toasts.append(Toast(id: id, kind: kind, message: message))

        Task {
            try? await Task.sleep(nanoseconds: 5_200_000_000)
            await dismissToast(id)
        }
    }

    public func dismissToast(_ id: Int) {
        toasts.removeAll { $0.id == id }
    }
}
