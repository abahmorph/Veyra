import Foundation
import AVFoundation
import CoreMedia
import Vision

public actor BackgroundProcessor {
    private var segmentationRequest: VNGeneratePersonSegmentationRequest?
    private var lastProcessingMs: Double = 0
    private var lastRun = CFAbsoluteTime(0)

    public func configure() {
        let request = VNGeneratePersonSegmentationRequest()
        request.revision = VNGeneratePersonSegmentationRequestRevision3
        request.qualityLevel = .balanced
        request.outputPixelFormat = kCVPixelFormatType_OneComponent8
        segmentationRequest = request
    }

    public func segment(_ pixelBuffer: CVPixelBuffer, throttleMs: Double = 66, timestamp: Double) async -> SegmentMask? {
        let now = CFAbsoluteTimeGetCurrent()
        if now - lastRun < throttleMs / 1000.0 {
            return nil
        }
        lastRun = now

        let start = CFAbsoluteTimeGetCurrent()

        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])
        guard let request = segmentationRequest else { return nil }

        do {
            try handler.perform([request])
            guard let result = request.result else { return nil }

            let width = result.width
            let height = result.height
            let maskData = result.pixelBuffer

            guard let data = try? maskData.toFloat32Array() else { return nil }

            lastProcessingMs = (CFAbsoluteTimeGetCurrent() - start) * 1000
            return SegmentMask(data: data, width: width, height: height)
        } catch {
            print("[BackgroundProcessor] segmentation failed: \(error)")
            return nil
        }
    }
}

extension CVPixelBuffer {
    func toFloat32Array() throws -> [Float] {
        CVPixelBufferLockBaseAddress(self, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(self, .readOnly) }

        guard let baseAddress = CVPixelBufferGetBaseAddress(self) else {
            throw NSError(domain: "CVPixelBuffer", code: -1, userInfo: [NSLocalizedDescriptionKey: "No base address"])
        }

        let width = CVPixelBufferGetWidth(self)
        let height = CVPixelBufferGetHeight(self)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(self)

        // For OneComponent8 format, convert to Float
        let data = baseAddress.bindMemory(to: UInt8.self, capacity: width * height)
        var floats: [Float] = []
        floats.reserveCapacity(width * height)

        for y in 0..<height {
            for x in 0..<width {
                let offset = y * bytesPerRow + x
                let value = Float(data[offset]) / 255.0
                floats.append(value)
            }
        }

        return floats
    }
}
