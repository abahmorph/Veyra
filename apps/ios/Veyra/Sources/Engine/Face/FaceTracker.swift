import Foundation
import AVFoundation
import CoreMedia
import Vision

public actor FaceTracker {
    private var faceTrackerRequest: VNSequenceRequestHandler?
    private var lastPose: FacePose?
    private var lastProcessingMs: Double = 0
    private var lastDetection = CFAbsoluteTime(0)
    private let throttleMs: Double = 66

    public func configure() {
        faceTrackerRequest = VNSequenceRequestHandler()
    }

    public func track(_ pixelBuffer: CVPixelBuffer, timestamp: Double) async -> FacePose? {
        let now = CFAbsoluteTimeGetCurrent()
        if now - lastDetection < throttleMs / 1000.0 {
            return lastPose
        }
        lastDetection = now

        let start = CFAbsoluteTimeGetCurrent()

        let request = VNDetectFaceLandmarksRequest { [weak self] request, error in
            guard let self, let results = request.results as? [VNFaceObservation], let face = results.first else {
                self?.lastPose = nil
                return
            }

            let landmarks = face.landmarks?.allPoints?.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) } ?? []
            let bbox = face.boundingBox

            // Estimate head tilt from eye landmarks
            let leftEye = face.landmarks?.leftEye?.normalizedPoints
            let rightEye = face.landmarks?.rightEye?.normalizedPoints
            var headTilt: Double = 0
            if let leftEye = leftEye, let rightEye = rightEye {
                let leftCenter = leftEye.average
                let rightCenter = rightEye.average
                headTilt = atan2(rightCenter.y - leftCenter.y, rightCenter.x - leftCenter.x)
            }

            // Estimate mouth openness
            let upperLip = face.landmarks?.nose?.normalizedPoints.first
            let lowerLip = face.landmarks?.nose?.normalizedPoints.last
            var mouthOpen: Double = 0
            if let upper = upperLip, let lower = lowerLip {
                mouthOpen = abs(lower.y - upper.y)
            }

            // Blink estimation from eye aspect ratio
            var blink: Double = 0
            if let leftEye = face.landmarks?.leftEye?.normalizedPoints {
                let ear = eyeAspectRatio(leftEye)
                blink = max(0, 1 - ear / 0.3)
            }

            self.lastPose = FacePose(
                landmarks: landmarks,
                headTilt: headTilt,
                headYaw: 0,
                mouthOpen: mouthOpen,
                blink: blink,
                boundingBox: bbox,
                timestamp: timestamp
            )
        }

        request.revision = VNDetectFaceLandmarksRequestRevision3

        do {
            try faceTrackerRequest?.perform(on: pixelBuffer, orientation: .up)
        } catch {
            print("[FaceTracker] detection failed: \(error)")
            lastPose = nil
        }

        let elapsed = (CFAbsoluteTimeGetCurrent() - start) * 1000
        lastProcessingMs = elapsed

        return lastPose
    }
}

// MARK: - Helpers

extension Array where Element == CGPoint {
    var average: CGPoint {
        guard !isEmpty else { return .zero }
        let sum = reduce(CGPoint.zero) { $0 + $1 }
        return CGPoint(x: sum.x / Double(count), y: sum.y / Double(count))
    }
}

func eyeAspectRatio(_ points: [CGPoint]) -> Double {
    guard points.count >= 6 else { return 0 }
    let vertical1 = distance(points[1], points[5])
    let vertical2 = distance(points[2], points[4])
    let horizontal = distance(points[0], points[3])
    guard horizontal > 0 else { return 0 }
    return (vertical1 + vertical2) / (2.0 * horizontal)
}

func distance(_ a: CGPoint, _ b: CGPoint) -> Double {
    hypot(Double(a.x - b.x), Double(a.y - b.y))
}
