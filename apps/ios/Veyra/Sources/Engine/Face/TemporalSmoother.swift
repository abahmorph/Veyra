import Foundation
import CoreImage

/// Temporal smoothing for stable face transformation output.
/// Reduces jitter and flickering by filtering transform parameters across frames.
public actor TemporalSmoother {
    private let smoothingFactor: Float
    private var smoothedExpression: ExpressionParameters?
    private var smoothedPose: HeadPose?
    private var smoothedBoundingBox: CGRect?
    private var frameCount: Int = 0
    private let maxFrameCount = 5

    public init(smoothingFactor: Float = 0.3) {
        self.smoothingFactor = smoothingFactor
    }

    /// Apply temporal smoothing to expression parameters.
    public func smooth(expression: ExpressionParameters) -> ExpressionParameters {
        if let previous = smoothedExpression {
            smoothedExpression = lerp(previous, expression, factor: smoothingFactor)
        } else {
            smoothedExpression = expression
        }

        return smoothedExpression ?? expression
    }

    /// Apply temporal smoothing to head pose.
    public func smooth(pose: HeadPose) -> HeadPose {
        if let previous = smoothedPose {
            smoothedPose = lerp(previous, pose, factor: smoothingFactor)
        } else {
            smoothedPose = pose
        }

        return smoothedPose ?? pose
    }

    /// Apply temporal smoothing to bounding box.
    public func smooth(boundingBox: CGRect) -> CGRect {
        if let previous = smoothedBoundingBox {
            smoothedBoundingBox = lerp(previous, boundingBox, factor: smoothingFactor)
        } else {
            smoothedBoundingBox = boundingBox
        }

        return smoothedBoundingBox ?? boundingBox
    }

    /// Reset smoother state (e.g., when switching sources).
    public func reset() {
        smoothedExpression = nil
        smoothedPose = nil
        smoothedBoundingBox = nil
        frameCount = 0
    }

    // MARK: - Linear Interpolation

    private func lerp(_ a: ExpressionParameters, _ b: ExpressionParameters, factor: Float) -> ExpressionParameters {
        return ExpressionParameters(
            mouthOpen: lerp(a.mouthOpen, b.mouthOpen, factor: factor),
            smile: lerp(a.smile, b.smile, factor: factor),
            leftEyeOpen: lerp(a.leftEyeOpen, b.leftEyeOpen, factor: factor),
            rightEyeOpen: lerp(a.rightEyeOpen, b.rightEyeOpen, factor: factor),
            eyebrowRaise: lerp(a.eyebrowRaise, b.eyebrowRaise, factor: factor),
            jawOpen: lerp(a.jawOpen, b.jawOpen, factor: factor),
            lipPucker: lerp(a.lipPucker, b.lipPucker, factor: factor),
            noseWrinkle: lerp(a.noseWrinkle, b.noseWrinkle, factor: factor)
        )
    }

    private func lerp(_ a: HeadPose, _ b: HeadPose, factor: Float) -> HeadPose {
        return HeadPose(
            pitch: lerp(a.pitch, b.pitch, factor: factor),
            yaw: lerp(a.yaw, b.yaw, factor: factor),
            roll: lerp(a.roll, b.roll, factor: factor)
        )
    }

    private func lerp(_ a: CGRect, _ b: CGRect, factor: Float) -> CGRect {
        return CGRect(
            x: lerp(a.origin.x, b.origin.x, factor: factor),
            y: lerp(a.origin.y, b.origin.y, factor: factor),
            width: lerp(a.width, b.width, factor: factor),
            height: lerp(a.height, b.height, factor: factor)
        )
    }

    private func lerp(_ a: Float, _ b: Float, factor: Float) -> Float {
        return a + (b - a) * factor
    }

    private func lerp(_ a: CGFloat, _ b: CGFloat, factor: Float) -> CGFloat {
        return a + (b - a) * CGFloat(factor)
    }
}
