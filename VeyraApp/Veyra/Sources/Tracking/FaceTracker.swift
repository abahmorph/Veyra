import Foundation
import AVFoundation
import Vision

public actor FaceTracker {
    private var sequenceHandler: VNSequenceRequestHandler?
    private var lastResult: FaceTrackingResult?
    private var lastProcessingMs: Double = 0
    private var lastDetection = CFAbsoluteTime(0)
    private let throttleMs: Double = 33
    private var frameCount: Int = 0

    public init() {}

    public func configure() {
        sequenceHandler = VNSequenceRequestHandler()
    }

    public func track(_ pixelBuffer: CVPixelBuffer, timestamp: Double) async -> FaceTrackingResult? {
        let now = CFAbsoluteTimeGetCurrent()
        if now - lastDetection < throttleMs / 1000.0 {
            return lastResult
        }
        lastDetection = now
        frameCount += 1

        let start = CFAbsoluteTimeGetCurrent()

        let request = VNDetectFaceLandmarksRequest()
        request.revision = VNDetectFaceLandmarksRequestRevision3

        do {
            try sequenceHandler?.perform([request], on: pixelBuffer, orientation: .up)
        } catch {
            lastResult = nil
            return nil
        }

        guard let results = request.results as? [VNFaceObservation], let face = results.first else {
            lastResult = nil
            return nil
        }

        let landmarkData = FaceLandmarkData(from: face)
        let expressions = extractExpressions(from: landmarkData)
        let headPose = HeadPose(
            pitch: landmarkData.pitch,
            yaw: landmarkData.yaw,
            roll: landmarkData.roll
        )

        let result = FaceTrackingResult(
            landmarks: landmarkData,
            expressions: expressions,
            headPose: headPose,
            timestamp: timestamp,
            isTracking: true
        )

        lastResult = result
        lastProcessingMs = (CFAbsoluteTimeGetCurrent() - start) * 1000

        return result
    }

    public func getLastProcessingMs() -> Double {
        return lastProcessingMs
    }

    private func extractExpressions(from landmarks: FaceLandmarkData) -> ExpressionParameters {
        return ExpressionParameters(
            mouthOpen: extractMouthOpenness(landmarks),
            smile: extractSmile(landmarks),
            leftEyeOpen: extractEyeOpenness(landmarks.leftEye),
            rightEyeOpen: extractEyeOpenness(landmarks.rightEye),
            eyebrowRaise: extractEyebrowRaise(landmarks),
            jawOpen: extractJawOpenness(landmarks),
            lipPucker: extractLipPucker(landmarks),
            noseWrinkle: 0
        )
    }

    private func extractMouthOpenness(_ landmarks: FaceLandmarkData) -> Float {
        guard landmarks.innerLips.count >= 4 else { return 0 }
        let upper = Array(landmarks.innerLips.prefix(landmarks.innerLips.count / 2))
        let lower = Array(landmarks.innerLips.suffix(landmarks.innerLips.count / 2))
        let upperCenter = upper.average
        let lowerCenter = lower.average
        let dist = hypot(upperCenter.x - lowerCenter.x, upperCenter.y - lowerCenter.y)
        return min(1.0, Float(dist * 8.0))
    }

    private func extractSmile(_ landmarks: FaceLandmarkData) -> Float {
        guard landmarks.outerLips.count >= 6 else { return 0 }
        let leftCorner = landmarks.outerLips.first ?? .zero
        let rightCorner = landmarks.outerLips.last ?? .zero
        let mouthWidth = hypot(leftCorner.x - rightCorner.x, leftCorner.y - rightCorner.y)
        return min(1.0, max(0, Float(mouthWidth * 3.0 - 0.3)))
    }

    private func extractEyeOpenness(_ eyePoints: [CGPoint]) -> Float {
        guard eyePoints.count >= 6 else { return 0.5 }
        let v1 = hypot(eyePoints[1].x - eyePoints[5].x, eyePoints[1].y - eyePoints[5].y)
        let v2 = hypot(eyePoints[2].x - eyePoints[4].x, eyePoints[2].y - eyePoints[4].y)
        let h = hypot(eyePoints[0].x - eyePoints[3].x, eyePoints[0].y - eyePoints[3].y)
        guard h > 0 else { return 0.5 }
        let ear = Float((v1 + v2) / (2.0 * h))
        return max(0, min(1, (ear - 0.15) / 0.2))
    }

    private func extractEyebrowRaise(_ landmarks: FaceLandmarkData) -> Float {
        guard !landmarks.leftEyebrow.isEmpty, !landmarks.rightEyebrow.isEmpty else { return 0 }
        let leftCenter = landmarks.leftEyebrow.average
        let rightCenter = landmarks.rightEyebrow.average
        let avgY = (leftCenter.y + rightCenter.y) / 2
        return min(1, max(0, Float(1.0 - avgY * 2.5)))
    }

    private func extractJawOpenness(_ landmarks: FaceLandmarkData) -> Float {
        return extractMouthOpenness(landmarks)
    }

    private func extractLipPucker(_ landmarks: FaceLandmarkData) -> Float {
        guard landmarks.outerLips.count >= 4 else { return 0 }
        let leftCorner = landmarks.outerLips.first ?? .zero
        let rightCorner = landmarks.outerLips.last ?? .zero
        let topCenter = landmarks.outerLips[landmarks.outerLips.count / 2]
        let mouthWidth = hypot(leftCorner.x - rightCorner.x, leftCorner.y - rightCorner.y)
        let midX = (leftCorner.x + rightCorner.x) / 2
        let midY = (leftCorner.y + rightCorner.y) / 2
        let mouthHeight = hypot(topCenter.x - midX, topCenter.y - midY)
        guard mouthHeight > 0 else { return 0 }
        let ratio = Float(mouthWidth / mouthHeight)
        return min(1, max(0, (3.5 - ratio) / 2.0))
    }
}
