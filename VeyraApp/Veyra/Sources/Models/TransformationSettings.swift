import Foundation
import SwiftUI

public struct FaceTransformSettings: Codable, Sendable {
    public var faceWidth: Float = 1.0
    public var faceHeight: Float = 1.0
    public var jawWidth: Float = 1.0
    public var jawShape: Float = 1.0
    public var chin: Float = 1.0
    public var cheekWidth: Float = 1.0
    public var eyeSize: Float = 1.0
    public var eyeSpacing: Float = 1.0
    public var noseWidth: Float = 1.0
    public var noseHeight: Float = 1.0
    public var mouthSize: Float = 1.0
    
    public init() {}
    
    public var hasModifications: Bool {
        faceWidth != 1.0 || faceHeight != 1.0 || jawWidth != 1.0 || jawShape != 1.0 ||
        chin != 1.0 || cheekWidth != 1.0 || eyeSize != 1.0 || eyeSpacing != 1.0 ||
        noseWidth != 1.0 || noseHeight != 1.0 || mouthSize != 1.0
    }
}

public struct BodyTransformSettings: Codable, Sendable {
    public var shoulderWidth: Float = 1.0
    public var torsoWidth: Float = 1.0
    public var waist: Float = 1.0
    public var hipWidth: Float = 1.0
    public var armProportions: Float = 1.0
    public var legProportions: Float = 1.0
    public var overallBody: Float = 1.0
    
    public init() {}
    
    public var hasModifications: Bool {
        shoulderWidth != 1.0 || torsoWidth != 1.0 || waist != 1.0 || hipWidth != 1.0 ||
        armProportions != 1.0 || legProportions != 1.0 || overallBody != 1.0
    }
}

public struct PerformanceStats: Sendable {
    public let fps: Double
    public let processingMs: Double
    public let droppedFrames: Int
    
    public init(fps: Double = 0, processingMs: Double = 0, droppedFrames: Int = 0) {
        self.fps = fps
        self.processingMs = processingMs
        self.droppedFrames = droppedFrames
    }
}
