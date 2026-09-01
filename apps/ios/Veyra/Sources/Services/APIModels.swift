import Foundation

public struct User: Codable, Equatable {
    public let id: String
    public let email: String
    public let name: String
    public let username: String?
    public let role: String
    public let createdAt: String
    public var subscription: SubscriptionInfo
    public var premiumEffectCreditsRemaining: Int
    public var latestPayment: PaymentInfo?
}

public struct SubscriptionInfo: Codable, Equatable {
    public let tier: PremiumTier
    public let plan: SubscriptionPlan?
    public let status: String
    public let expiresAt: String?
    public let autoRenew: Bool
}

public struct PaymentInfo: Codable, Equatable {
    public let status: String
    public let plan: SubscriptionPlan?
    public let createdAt: String
}

public struct Session: Codable, Equatable {
    public let token: String
    public let user: User
}

public struct PaymentDetails: Codable, Equatable {
    public let bankName: String
    public let accountName: String
    public let accountNumber: String
    public let paymentInstructions: String
    public let currency: String
    public let monthly: Int
    public let yearly: Int
}

public struct PaymentRecord: Codable, Identifiable, Equatable {
    public let id: String
    public let plan: SubscriptionPlan
    public let amount: Int
    public let currency: String
    public let reference: String
    public let status: String
    public let paymentDate: String?
    public let note: String?
    public let declineReason: String?
    public let reviewedAt: String?
    public let createdAt: String
    public let hasProof: Bool
}
