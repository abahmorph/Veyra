import Foundation
import Vision
import CoreImage

/// Extracts expression parameters from face landmarks.
/// This converts Vision's 478-point face mesh into a compact
/// expression representation suitable for driving an AI face model.
public actor ExpressionExtractor {
    private let faceTracker = FaceTracker()

    public init() {}

    /// Extract expression parameters from a face observation.
    public func extract(from observation: VNFaceObservation) -> ExpressionParameters {
        let landmarks = observation.landmarks

        // Extract key facial feature positions
        let leftEye = landmarks?.leftEye?.normalizedPoints ?? []
        let rightEye = landmarks?.rightEye?.normalizedPoints ?? []
        let leftEyebrow = landmarks?.leftEyebrow?.normalizedPoints ?? []
        let rightEyebrow = landmarks?.rightEyebrow?.normalizedPoints ?? []
        let nose = landmarks?.nose?.normalizedPoints ?? []
        let outerLips = landmarks?.outerLips?.normalizedPoints ?? []
        let innerLips = landmarks?.innerLips?.normalizedPoints ?? []
        let faceContour = landmarks?.faceContour?.normalizedPoints ?? []

        // Calculate expression parameters
        let leftEyeOpen = eyeOpenness(leftEye)
        let rightEyeOpen = eyeOpenness(rightEye)
        let mouthOpen = mouthOpenness(innerLips, outerLips: outerLips)
        let smile = smileAmount(outerLips, faceContour: faceContour)
        let eyebrowRaise = eyebrowRaiseAmount(leftEyebrow, rightEyebrow: rightEyebrow, faceContour: faceContour)
        let jawOpen = jawOpenness(innerLips, outerLips: outerLips, faceContour: faceContour)
        let lipPucker = lipPuckerAmount(outerLips)
        let noseWrinkle = noseWrinkleAmount(nose, faceContour: faceContour)

        return ExpressionParameters(
            mouthOpen: mouthOpen,
            smile: smile,
            leftEyeOpen: leftEyeOpen,
            rightEyeOpen: rightEyeOpen,
            eyebrowRaise: eyebrowRaise,
            jawOpen: jawOpen,
            lipPucker: lipPucker,
            noseWrinkle: noseWrinkle
        )
    }

    // MARK: - Expression Calculations

    private func eyeOpenness(_ eyePoints: [CGPoint]) -> Float {
        guard eyePoints.count >= 6 else { return 0.5 }

        // Eye aspect ratio (EAR)
        let vertical1 = distance(eyePoints[1], eyePoints[5])
        let vertical2 = distance(eyePoints[2], eyePoints[4])
        let horizontal = distance(eyePoints[0], eyePoints[3])

        guard horizontal > 0 else { return 0.5 }

        let ear = Float((vertical1 + vertical2) / (2.0 * horizontal))

        // Normalize to 0-1 range (typical EAR range is 0.15-0.35)
        let normalized = max(0, min(1, (ear - 0.15) / 0.2))
        return normalized
    }

    private func mouthOpenness(_ innerLips: [CGPoint], outerLips: [CGPoint]) -> Float {
        guard innerLips.count >= 4, outerLips.count >= 6 else { return 0 }

        // Distance between inner upper and lower lips
        let upperLip = innerLips.prefix(4).reduce(CGPoint.zero) { $0 + $1 }
        let lowerLip = innerLips.suffix(4).reduce(CGPoint.zero) { $0 + $1 }

        let upperCenter = CGPoint(
            x: upperLip.x / 4,
            y: upperLip.y / 4
        )
        let lowerCenter = CGPoint(
            x: lowerLip.x / 4,
            y: lowerLip.y / 4
        )

        let mouthHeight = distance(upperCenter, lowerCenter)

        // Normalize by face height (approximate)
        let faceHeight: CGFloat = 0.5 // Approximate face height in normalized coordinates
        let normalized = Float(mouthHeight / faceHeight)

        return min(1, normalized * 3)
    }

    private func smileAmount(_ outerLips: [CGPoint], faceContour: [CGPoint]) -> Float {
        guard outerLips.count >= 6 else { return 0 }

        // Smile is detected by the curvature of the lips
        // Compare lip corners to lip center
        let leftCorner = outerLips[0]
        let rightCorner = outerLips[6]
        let center = outerLips[3] // Approximate center

        // Distance from center to corners
        let leftDist = distance(center, leftCorner)
        let rightDist = distance(center, rightCorner)

        // Wider mouth = smile
        let mouthWidth = distance(leftCorner, rightCorner)

        // Normalize based on expected mouth width
        let normalized = Float(mouthWidth * 2) // Scale factor

        return min(1, max(0, normalized))
    }

    private func eyebrowRaiseAmount(_ leftEyebrow: [CGPoint], rightEyebrow: [CGPoint], faceContour: [CGPoint]) -> Float {
        guard leftEyebrow.count >= 3, rightEyebrow.count >= 3 else { return 0 }

        // Eyebrow raise is detected by the vertical position of eyebrows
        // relative to the eyes
        let leftEyebrowCenter = leftEyebrow.reduce(CGPoint.zero) { $0 + $1 }
        let rightEyebrowCenter = rightEyebrow.reduce(CGPoint.zero) { $0 + $1 }

        let leftCenter = CGPoint(x: leftEyebrowCenter.x / CGFloat(leftEyebrow.count), y: leftEyebrowCenter.y / CGFloat(leftEyebrow.count))
        let rightCenter = CGPoint(x: rightEyebrowCenter.x / CGFloat(rightEyebrow.count), y: rightEyebrowCenter.y / CGFloat(rightEyebrow.count))

        // Higher eyebrows = raised (lower y value in normalized coordinates)
        // Typical range: 0.2-0.4 (raised) to 0.4-0.6 (neutral)
        let avgEyebrowY = (leftCenter.y + rightCenter.y) / 2

        // Invert so higher position = higher value
        let raised = Float(1.0 - avgEyebrowY * 2.5)

        return min(1, max(0, raised))
    }

    private func jawOpenness(_ innerLips: [CGPoint], outerLips: [CGPoint], faceContour: [CGPoint]) -> Float {
        // Similar to mouthOpen but includes jaw position
        return mouthOpenness(innerLips, outerLips: outerLips)
    }

    private func lipPuckerAmount(_ outerLips: [CGPoint]) -> Float {
        guard outerLips.count >= 6 else { return 0 }

        // Lip pucker is detected by the width-to-height ratio of the mouth
        let leftCorner = outerLips[0]
        let rightCorner = outerLips[6]
        let topCenter = outerLips[3]

        let mouthWidth = distance(leftCorner, rightCorner)
        let mouthHeight = distance(topCenter, CGPoint(x: (leftCorner.x + rightCorner.x) / 2, y: (leftCorner.y + rightCorner.y) / 2))

        guard mouthHeight > 0 else { return 0 }

        let ratio = Float(mouthWidth / mouthHeight)

        // Narrower mouth = more pucker
        // Typical ratio: 2.5-3.5 (neutral) to 1.5-2.0 (puckered)
        let pucker = max(0, min(1, (3.5 - ratio) / 2.0))

        return pucker
    }

    private func noseWrinkleAmount(_ nose: [CGPoint], faceContour: [CGPoint]) -> Float {
        // Nose wrinkle is subtle and requires detailed nose landmarks
        // This is a simplified version
        guard nose.count >= 3 else { return 0 }

        // Wrinkle is indicated by nose tip position and nostril flaring
        // For now, return a small baseline value
        return 0
    }

    private func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
        return hypot(a.x - b.x, a.y - b.y)
    }
}
