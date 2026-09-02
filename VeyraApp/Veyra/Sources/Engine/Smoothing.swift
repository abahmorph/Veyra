import Foundation
import CoreGraphics

public actor TemporalSmoother {
    private let smoothingFactor: Float
    private let landmarkSmoothingFactor: Float
    private var smoothedExpressions: ExpressionParameters?
    private var smoothedPose: HeadPose?
    private var smoothedBoundingBox: CGRect?
    private var smoothedLandmarks: [CGPoint]?
    private var lastValidTimestamp: Double = 0
    private let maxTrackingGap: Double = 0.5

    public init(smoothingFactor: Float = 0.35, landmarkSmoothingFactor: Float = 0.4) {
        self.smoothingFactor = smoothingFactor
        self.landmarkSmoothingFactor = landmarkSmoothingFactor
    }

    public func smooth(result: FaceTrackingResult) -> FaceTrackingResult {
        let now = result.timestamp
        let gap = now - lastValidTimestamp

        if !result.isTracking || gap > maxTrackingGap {
            reset()
            return result
        }

        lastValidTimestamp = now

        let smoothedExpr = smoothExpressions(result.expressions)
        let smoothedHead = smoothPose(result.headPose)
        let smoothedBB = smoothBoundingBox(result.landmarks.boundingBox)
        let smoothedPts = smoothLandmarks(result.landmarks.allPoints)

        return FaceTrackingResult(
            landmarks: FaceLandmarkData(
                boundingBox: smoothedBB,
                allPoints: smoothedPts,
                leftEye: result.landmarks.leftEye,
                rightEye: result.landmarks.rightEye,
                leftEyebrow: result.landmarks.leftEyebrow,
                rightEyebrow: result.landmarks.rightEyebrow,
                nose: result.landmarks.nose,
                outerLips: result.landmarks.outerLips,
                innerLips: result.landmarks.innerLips,
                faceContour: result.landmarks.faceContour,
                confidence: result.landmarks.confidence,
                yaw: result.landmarks.yaw,
                pitch: result.landmarks.pitch,
                roll: result.landmarks.roll
            ),
            expressions: smoothedExpr,
            headPose: smoothedHead,
            timestamp: result.timestamp,
            isTracking: true
        )
    }

    public func reset() {
        smoothedExpressions = nil
        smoothedPose = nil
        smoothedBoundingBox = nil
        smoothedLandmarks = nil
    }

    private func smoothExpressions(_ current: ExpressionParameters) -> ExpressionParameters {
        guard let prev = smoothedExpressions else {
            smoothedExpressions = current
            return current
        }
        let f = smoothingFactor
        let result = ExpressionParameters(
            mouthOpen: lerp(prev.mouthOpen, current.mouthOpen, factor: f),
            smile: lerp(prev.smile, current.smile, factor: f),
            leftEyeOpen: lerp(prev.leftEyeOpen, current.leftEyeOpen, factor: f),
            rightEyeOpen: lerp(prev.rightEyeOpen, current.rightEyeOpen, factor: f),
            eyebrowRaise: lerp(prev.eyebrowRaise, current.eyebrowRaise, factor: f),
            jawOpen: lerp(prev.jawOpen, current.jawOpen, factor: f),
            lipPucker: lerp(prev.lipPucker, current.lipPucker, factor: f),
            noseWrinkle: lerp(prev.noseWrinkle, current.noseWrinkle, factor: f)
        )
        smoothedExpressions = result
        return result
    }

    private func smoothPose(_ current: HeadPose) -> HeadPose {
        guard let prev = smoothedPose else {
            smoothedPose = current
            return current
        }
        let f = smoothingFactor
        let result = HeadPose(
            pitch: lerp(prev.pitch, current.pitch, factor: f),
            yaw: lerp(prev.yaw, current.yaw, factor: f),
            roll: lerp(prev.roll, current.roll, factor: f)
        )
        smoothedPose = result
        return result
    }

    private func smoothBoundingBox(_ current: CGRect) -> CGRect {
        guard let prev = smoothedBoundingBox else {
            smoothedBoundingBox = current
            return current
        }
        let f = smoothingFactor
        let result = CGRect(
            x: lerpCGFloat(prev.origin.x, current.origin.x, factor: f),
            y: lerpCGFloat(prev.origin.y, current.origin.y, factor: f),
            width: lerpCGFloat(prev.width, current.width, factor: f),
            height: lerpCGFloat(prev.height, current.height, factor: f)
        )
        smoothedBoundingBox = result
        return result
    }

    private func smoothLandmarks(_ current: [CGPoint]) -> [CGPoint] {
        guard let prev = smoothedLandmarks, prev.count == current.count else {
            smoothedLandmarks = current
            return current
        }
        let f = landmarkSmoothingFactor
        let result = zip(prev, current).map { lerpCGPoint($0, $1, factor: f) }
        smoothedLandmarks = result
        return result
    }

    private func lerp(_ a: Float, _ b: Float, factor: Float) -> Float {
        return a + (b - a) * factor
    }

    private func lerpCGFloat(_ a: CGFloat, _ b: CGFloat, factor: Float) -> CGFloat {
        return a + (b - a) * CGFloat(factor)
    }

    private func lerpCGPoint(_ a: CGPoint, _ b: CGPoint, factor: Float) -> CGPoint {
        return CGPoint(
            x: lerpCGFloat(a.x, b.x, factor: factor),
            y: lerpCGFloat(a.y, b.y, factor: factor)
        )
    }
}
