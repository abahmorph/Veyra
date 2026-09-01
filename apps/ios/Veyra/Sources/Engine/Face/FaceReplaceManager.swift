import Foundation
import UIKit

public actor FaceReplaceManager {
    public static let shared = FaceReplaceManager()

    private var sourceImage: UIImage?
    private var sourceLandmarks: [CGPoint] = []
    private var prepared = false

    public func prepare(image: UIImage) async -> Bool {
        guard let cgImage = image.cgImage else { return false }

        // Detect face landmarks in source image using Vision
        let request = VNDetectFaceLandmarksRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

        do {
            try handler.perform([request])
            guard let face = (request.results as? [VNFaceObservation])?.first else {
                return false
            }

            let landmarks = face.landmarks?.allPoints?.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) } ?? []
            guard landmarks.count >= 5 else { return false }

            // Resize image for processing
            let maxDim: CGFloat = 1024
            let scale = min(1, maxDim / max(CGFloat(cgImage.width), CGFloat(cgImage.height)))
            let newSize = CGSize(width: CGFloat(cgImage.width) * scale, height: CGFloat(cgImage.height) * scale)

            UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
            image.draw(in: CGRect(origin: .zero, size: newSize))
            let resizedImage = UIGraphicsGetImageFromCurrentImageContext()
            UIGraphicsEndImageContext()

            self.sourceImage = resizedImage
            self.sourceLandmarks = landmarks.map { CGPoint(x: $0.x * scale, y: $0.y * scale) }
            self.prepared = true
            return true
        } catch {
            print("[FaceReplaceManager] failed: \(error)")
            return false
        }
    }

    public func isPrepared() -> Bool {
        return prepared && sourceImage != nil && sourceLandmarks.count >= 5
    }

    public func getSourceImage() -> UIImage? {
        return sourceImage
    }

    public func getSourceLandmarks() -> [CGPoint] {
        return sourceLandmarks
    }

    public func clear() {
        sourceImage = nil
        sourceLandmarks = []
        prepared = false
    }
}
