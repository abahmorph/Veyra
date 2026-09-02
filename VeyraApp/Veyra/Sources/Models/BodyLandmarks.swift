import Foundation
import CoreGraphics

public struct BodyLandmarkData: Sendable {
    public let torsoLandmarks: [CGPoint]
    public let shoulderCenter: CGPoint
    public let hipCenter: CGPoint
    public let shoulderWidth: CGFloat
    public let torsoHeight: CGFloat
    public let confidence: Float
    public let timestamp: Double
    
    public init(torsoLandmarks: [CGPoint] = [], shoulderCenter: CGPoint = .zero, hipCenter: CGPoint = .zero, shoulderWidth: CGFloat = 0, torsoHeight: CGFloat = 0, confidence: Float = 0, timestamp: Double = 0) {
        self.torsoLandmarks = torsoLandmarks
        self.shoulderCenter = shoulderCenter
        self.hipCenter = hipCenter
        self.shoulderWidth = shoulderWidth
        self.torsoHeight = torsoHeight
        self.confidence = confidence
        self.timestamp = timestamp
    }
}
