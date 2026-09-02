import Foundation
import CoreGraphics
import Vision

public struct FaceLandmarkData: Sendable {
    public let boundingBox: CGRect
    public let allPoints: [CGPoint]
    public let leftEye: [CGPoint]
    public let rightEye: [CGPoint]
    public let leftEyebrow: [CGPoint]
    public let rightEyebrow: [CGPoint]
    public let nose: [CGPoint]
    public let outerLips: [CGPoint]
    public let innerLips: [CGPoint]
    public let faceContour: [CGPoint]
    public let confidence: Float
    public let yaw: Float
    public let pitch: Float
    public let roll: Float
    
    public init(
        boundingBox: CGRect,
        allPoints: [CGPoint],
        leftEye: [CGPoint],
        rightEye: [CGPoint],
        leftEyebrow: [CGPoint],
        rightEyebrow: [CGPoint],
        nose: [CGPoint],
        outerLips: [CGPoint],
        innerLips: [CGPoint],
        faceContour: [CGPoint],
        confidence: Float,
        yaw: Float,
        pitch: Float,
        roll: Float
    ) {
        self.boundingBox = boundingBox
        self.allPoints = allPoints
        self.leftEye = leftEye
        self.rightEye = rightEye
        self.leftEyebrow = leftEyebrow
        self.rightEyebrow = rightEyebrow
        self.nose = nose
        self.outerLips = outerLips
        self.innerLips = innerLips
        self.faceContour = faceContour
        self.confidence = confidence
        self.yaw = yaw
        self.pitch = pitch
        self.roll = roll
    }

    public init(from observation: VNFaceObservation) {
        self.boundingBox = observation.boundingBox
        self.confidence = observation.confidence
        self.allPoints = observation.landmarks?.allPoints?.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) } ?? []
        self.leftEye = observation.landmarks?.leftEye?.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) } ?? []
        self.rightEye = observation.landmarks?.rightEye?.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) } ?? []
        self.leftEyebrow = observation.landmarks?.leftEyebrow?.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) } ?? []
        self.rightEyebrow = observation.landmarks?.rightEyebrow?.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) } ?? []
        self.nose = observation.landmarks?.nose?.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) } ?? []
        self.outerLips = observation.landmarks?.outerLips?.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) } ?? []
        self.innerLips = observation.landmarks?.innerLips?.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) } ?? []
        self.faceContour = observation.landmarks?.faceContour?.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) } ?? []
        
        // Estimate head pose from landmarks
        var rollVal: Float = 0
        var yawVal: Float = 0
        var pitchVal: Float = 0
        
        if let leftEye = observation.landmarks?.leftEye,
           let rightEye = observation.landmarks?.rightEye {
            let lc = leftEye.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) }.average
            let rc = rightEye.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) }.average
            rollVal = Float(atan2(rc.y - lc.y, rc.x - lc.x))
        }
        
        if let noseTip = observation.landmarks?.nose?.normalizedPoints.first {
            yawVal = Float((noseTip.x - 0.5) * 2.0)
            pitchVal = Float((noseTip.y - 0.45) * 2.0)
        }
        
        self.roll = rollVal
        self.yaw = yawVal
        self.pitch = pitchVal
    }
}

public struct ExpressionParameters: Codable, Sendable {
    public var mouthOpen: Float
    public var smile: Float
    public var leftEyeOpen: Float
    public var rightEyeOpen: Float
    public var eyebrowRaise: Float
    public var jawOpen: Float
    public var lipPucker: Float
    public var noseWrinkle: Float

    public init(mouthOpen: Float = 0, smile: Float = 0, leftEyeOpen: Float = 1, rightEyeOpen: Float = 1, eyebrowRaise: Float = 0, jawOpen: Float = 0, lipPucker: Float = 0, noseWrinkle: Float = 0) {
        self.mouthOpen = mouthOpen
        self.smile = smile
        self.leftEyeOpen = leftEyeOpen
        self.rightEyeOpen = rightEyeOpen
        self.eyebrowRaise = eyebrowRaise
        self.jawOpen = jawOpen
        self.lipPucker = lipPucker
        self.noseWrinkle = noseWrinkle
    }
}

public struct HeadPose: Codable, Sendable {
    public var pitch: Float
    public var yaw: Float
    public var roll: Float
    
    public init(pitch: Float = 0, yaw: Float = 0, roll: Float = 0) {
        self.pitch = pitch
        self.yaw = yaw
        self.roll = roll
    }
}

public struct FaceTrackingResult: Sendable {
    public let landmarks: FaceLandmarkData
    public let expressions: ExpressionParameters
    public let headPose: HeadPose
    public let timestamp: Double
    public let isTracking: Bool

    public init(
        landmarks: FaceLandmarkData,
        expressions: ExpressionParameters,
        headPose: HeadPose,
        timestamp: Double,
        isTracking: Bool
    ) {
        self.landmarks = landmarks
        self.expressions = expressions
        self.headPose = headPose
        self.timestamp = timestamp
        self.isTracking = isTracking
    }
}

extension Array where Element == CGPoint {
    var average: CGPoint {
        guard !isEmpty else { return .zero }
        let sum = reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x, y: $0.y + $1.y) }
        return CGPoint(x: sum.x / CGFloat(count), y: sum.y / CGFloat(count))
    }
}
