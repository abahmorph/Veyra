import Foundation

public struct EffectDefinition: Codable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let category: EffectCategory
    public let description: String
    public let premium: Bool
    public let cost: String
    public let requiresFace: Bool
    public let kind: EffectKind
    public let preview: String
}

public struct BackgroundDefinition: Codable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let mode: BackgroundMode
    public let premium: Bool
    public let kind: String
    public var src: String?
    public var gradient: [GradientStop]?
    public var blurStrength: Double?
}

public struct GradientStop: Codable, Equatable {
    public let offset: Double
    public let color: String
}

public struct VoiceEffectDefinition: Codable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let description: String
    public let premium: Bool
    public let chain: VoiceChain
    public let intensityRange: ClosedRange<Double>
}

public struct PersonAsset: Codable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let kind: String
    public let src: String
    public var thumbnail: String?
    public var durationSec: Double?
    public let premium: Bool
    public let source: String
    public let transformAvailable: Bool
    public var transformReason: String?
}

public struct ScenePreset: Codable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public var effectId: String?
    public var person: PersonAsset?
    public var background: BackgroundDefinition?
    public var voiceEffectId: String?
    public var voiceIntensity: Double
    public let premium: Bool
    public let createdAt: TimeInterval
}

public struct PerformanceStats: Codable, Equatable {
    public var fps: Double = 0
    public var captureFps: Double = 0
    public var processingMs: Double = 0
    public var pipelineMs: Double = 0
    public var backgroundMs: Double = 0
    public var faceMs: Double = 0
    public var droppedFrames: Int = 0
    public var qualityScale: Double = 1
    public var gpuBackend: String?
    public var gpuRenderer: String?
}

public struct PipelineState: Codable, Equatable {
    public var running: Bool = false
    public var effectId: String = "none"
    public var effectQuality: Double = 1
    public var background: BackgroundDefinition?
    public var mirror: Bool = true
    public var resolution: Resolution
    public var fps: Int = 30
    public var stats: PerformanceStats
}
