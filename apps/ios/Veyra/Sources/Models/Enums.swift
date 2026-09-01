import Foundation

public enum EffectCategory: String, Codable, CaseIterable {
    case face
    case character
    case privacy
    case background
    case color
}

public enum EffectKind: String, Codable {
    case shader
    case faceMask
    case avatar
    case privacyBlur
    case colorGrade
    case faceReplace
    case pixel
    case glitch
}

public enum BackgroundMode: String, Codable {
    case none
    case blur
    case remove
    case image
    case video
    case gradient
    case green
}

public enum VoiceChain: String, Codable {
    case pitch
    case robot
    case radio
    case echo
    case alien
    case none
}

public enum PremiumTier: String, Codable {
    case free
    case premium
}

public enum SubscriptionPlan: String, Codable {
    case monthly
    case yearly
}
