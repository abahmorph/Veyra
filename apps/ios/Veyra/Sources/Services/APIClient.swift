import Foundation

public struct APIResponse<T: Codable>: Codable {
    public let data: T
    public let status: Int
}

public enum APIError: Error, LocalizedError {
    case networkError(Error)
    case invalidResponse
    case serverError(Int, String)
    case unauthorized
    case decodingError(Error)

    public var errorDescription: String? {
        switch self {
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid response from server"
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message)"
        case .unauthorized:
            return "Unauthorized"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        }
    }
}

@MainActor
public final class APIClient: ObservableObject {
    public static let shared = APIClient()

    @Published public private(set) var baseURL: String = "http://localhost:8787"
    @Published public private(set) var authToken: String?
    @Published public private(set) var isReachable: Bool = false

    private var reachabilityTask: Task<Void, Never>?

    private init() {
        // Load from user defaults or environment
        if let savedURL = UserDefaults.standard.string(forKey: "veyra_api_base_url") {
            baseURL = savedURL
        }
        if let savedToken = UserDefaults.standard.string(forKey: "veyra_auth_token") {
            authToken = savedToken
        }
    }

    public func configure(baseURL: String, authToken: String? = nil) {
        self.baseURL = baseURL
        self.authToken = authToken
        UserDefaults.standard.set(baseURL, forKey: "veyra_api_base_url")
        if let token = authToken {
            UserDefaults.standard.set(token, forKey: "veyra_auth_token")
        } else {
            UserDefaults.standard.removeObject(forKey: "veyra_auth_token")
        }
    }

    public func checkReachability() async {
        guard let url = URL(string: "\(baseURL)/health") else {
            isReachable = false
            return
        }

        do {
            let (_, response) = try await URLSession.shared.data(from: url)
            if let httpResponse = response as? HTTPURLResponse {
                isReachable = httpResponse.statusCode == 200
            }
        } catch {
            isReachable = false
        }
    }

    public func request<T: Codable>(
        _ path: String,
        method: String = "GET",
        body: Data? = nil,
        authenticated: Bool = true
    ) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(path.starts(with: "/health") ? path : "/api\(path)")") else {
            throw APIError.invalidResponse
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if authenticated, let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            guard 200..<300 ~= httpResponse.statusCode else {
                if httpResponse.statusCode == 401 {
                    throw APIError.unauthorized
                }
                let message = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw APIError.serverError(httpResponse.statusCode, message)
            }

            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(T.self, from: data)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }

    public func setAuthToken(_ token: String?) {
        authToken = token
        if let token {
            UserDefaults.standard.set(token, forKey: "veyra_auth_token")
        } else {
            UserDefaults.standard.removeObject(forKey: "veyra_auth_token")
        }
    }
}
