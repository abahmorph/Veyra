import Foundation
import AVFoundation
import CoreMedia
import Vision

/// Performs person/body segmentation and body landmark estimation
/// using Vision's on-device APIs.
public actor BodyTracker {
    private var segmentationRequest: VNGeneratePersonSegmentationRequest?
    private var detectBodyRequest: VNDetectHumanBodyPoseRequest?
    private var lastProcessingMs: Double = 0
    private var lastRun = CFAbsoluteTime(0)

    public init() {}

    public func configure() {
        let seg = VNGeneratePersonSegmentationRequest()
        seg.qualityLevel = .balanced
        seg.outputPixelFormat = kCVPixelFormatType_OneComponent8
        segmentationRequest = seg

        let body = VNDetectHumanBodyPoseRequest()
        body.revision = VNDetectHumanBodyPoseRequestRevision1
        detectBodyRequest = body
    }

    /// Returns a segmentation mask pixel buffer plus estimated body landmarks.
    public func track(_ pixelBuffer: CVPixelBuffer, throttleMs: Double = 66) async -> (mask: CVPixelBuffer?, body: BodyLandmarkData?) {
        let now = CFAbsoluteTimeGetCurrent()
        if now - lastRun < throttleMs / 1000.0 {
            return (nil, nil)
        }
        lastRun = now
        let start = CFAbsoluteTimeGetCurrent()

        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])
        var requests: [VNRequest] = []
        if let seg = segmentationRequest { requests.append(seg) }
        if let body = detectBodyRequest { requests.append(body) }

        do {
            try handler.perform(requests)
        } catch {
            print("[BodyTracker] detection failed: \(error)")
            lastProcessingMs = (CFAbsoluteTimeGetCurrent() - start) * 1000
            return (nil, nil)
        }

        let mask = (segmentationRequest?.results?.first as? VNPixelBufferObservation)?.pixelBuffer

        let bodyData: BodyLandmarkData?
        if let observation = detectBodyRequest?.results?.first {
            bodyData = extractBody(from: observation)
        } else {
            bodyData = nil
        }

        lastProcessingMs = (CFAbsoluteTimeGetCurrent() - start) * 1000
        return (mask, bodyData)
    }

    public func getLastProcessingMs() -> Double {
        return lastProcessingMs
    }

    private func extractBody(from observation: VNHumanBodyPoseObservation) -> BodyLandmarkData {
        // Extract key body joints (normalized to 0-1 coordinates)
        let jointNames: [VNHumanBodyPoseObservation.JointName] = [
            .neck,
            .rightShoulder, .leftShoulder,
            .rightElbow, .leftElbow,
            .rightWrist, .leftWrist,
            .root, .rightHip, .leftHip,
            .rightKnee, .leftKnee,
            .rightAnkle, .leftAnkle
        ]

        var points: [VNHumanBodyPoseObservation.JointName: CGPoint] = [:]
        for jn in jointNames {
            if let point = try? observation.recognizedPoint(jn), point.confidence > 0.1 {
                points[jn] = CGPoint(x: point.location.x, y: point.location.y)
            }
        }

        let shoulderL = points[.leftShoulder] ?? .zero
        let shoulderR = points[.rightShoulder] ?? .zero
        let hipL = points[.leftHip] ?? .zero
        let hipR = points[.rightHip] ?? .zero

        let shoulderCenter = CGPoint(x: (shoulderL.x + shoulderR.x) / 2,
                                     y: (shoulderL.y + shoulderR.y) / 2)
        let hipCenter = CGPoint(x: (hipL.x + hipR.x) / 2,
                                y: (hipL.y + hipR.y) / 2)

        var torsoPoints: [CGPoint] = []
        if shoulderL != .zero { torsoPoints.append(shoulderL) }
        if shoulderR != .zero { torsoPoints.append(shoulderR) }
        if hipL != .zero { torsoPoints.append(hipL) }
        if hipR != .zero { torsoPoints.append(hipR) }

        let shoulderWidth = hypot(shoulderL.x - shoulderR.x, shoulderL.y - shoulderR.y)
        let torsoHeight = hypot(shoulderCenter.x - hipCenter.x, shoulderCenter.y - hipCenter.y)

        return BodyLandmarkData(
            torsoLandmarks: torsoPoints,
            shoulderCenter: shoulderCenter,
            hipCenter: hipCenter,
            shoulderWidth: shoulderWidth,
            torsoHeight: torsoHeight,
            confidence: Float(observation.confidence),
            timestamp: CFAbsoluteTimeGetCurrent()
        )
    }
}
