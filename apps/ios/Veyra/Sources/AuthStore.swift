import Foundation
import SwiftUI

@MainActor
public final class AuthStore: ObservableObject {
    @Published public private(set) var currentUser: User?
    @Published public private(set) var isAuthenticated: Bool = false

    private let api = APIClient.shared

    public init() {
        if let token = api.authToken {
            isAuthenticated = true
        }
    }

    public func login(email: String, password: String) async throws {
        try await AppState.shared.login(email: email, password: password)
        isAuthenticated = true
    }

    public func signup(email: String, password: String, name: String) async throws {
        try await AppState.shared.signup(email: email, password: password, name: name)
        isAuthenticated = true
    }

    public func logout() async {
        await AppState.shared.logout()
        isAuthenticated = false
        currentUser = nil
    }

    public func deleteAccount() async throws {
        _ = try await api.request("/user/account", method: "DELETE", authenticated: true)
        await logout()
    }
}
