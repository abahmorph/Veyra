import Foundation
import CoreML
import Vision
import CoreImage
import Metal

/// AI-powered face transformation pipeline.
/// This replaces the geometric warping approach with a true ML-based pipeline.
///
/// Architecture:
/// 1. Source Identity Encoding: Extract identity embedding from source photo/video
/// 2. Live Face Analysis: Extract expression + pose from live camera frame
/// 3. Face Generation: Generate target face with source identity + live expressions
/// 4. Compositing: Blend generated face into live frame
///
/// Model Requirement:
/// A Core ML face-swap/face-reenactment model that accepts:
/// - Identity embedding (e.g., 512-dim vector from FaceNet)
/// - Expression parameters (8-dim vector)
/// - Head pose (3-dim vector: pitch, yaw, roll)
///
/// And outputs:
/// - Generated face image (RGBA)
///
/// Suggested models:
/// - SimSwap (converted to Core ML)
/// - FaceShifter (converted to Core ML)
/// - Custom face-reenactment model trained on target dataset
public actor AIFaceTransformPipeline {
    public static let shared = AIFaceTransformPipeline()

    // MARK: - Properties

    private var identityEmbedding: IdentityEmbedding?
    private var model: MLModel?
    private var config: FaceTransformConfig
    private let ciContext: CIContext
    private let faceTracker = FaceTracker()
    private let expressionExtractor = ExpressionExtractor()
    private var lastGeneratedFace: CIImage?
    private var temporalSmoother: TemporalSmoother?

    // MARK: - Lifecycle

    public init(config: FaceTransformConfig = FaceTransformConfig()) {
        self.config = config
        self.ciContext = CIContext(mtlDevice: MTLCreateSystemDefaultDevice()!)
        self.temporalSmoother = TemporalSmoother(smoothingFactor: config.smoothingFactor)
    }

    // MARK: - Model Loading

    public func loadModel(from url: URL) async throws {
        let compiledURL = try await compileModelIfNeeded(url)
        let model = try await MLModel.load(contentsOf: compiledURL)
        self.model = model
    }

    private func compileModelIfNeeded(_ url: URL) async throws -> URL {
        if url.pathExtension.lowercased() == "mlmodel" {
            let compiled = URL(fileURLWithPath: NSTemporaryDirectory())
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension("mlmodelc")
            let task = try await MLModel.compileModel(at: url)
            return task
        }
        return url
    }

    public func setConfig(_ newConfig: FaceTransformConfig) {
        config = newConfig
        temporalSmoother = TemporalSmoother(smoothingFactor: newConfig.smoothingFactor)
    }

    // MARK: - Identity Encoding

    /// Extract identity embedding from a source image.
    /// This uses a face recognition model to create a compact representation
    /// of the target person's identity.
    public func encodeIdentity(from image: CIImage) async throws -> IdentityEmbedding {
        guard let faceObservation = try await detectFace(in: image) else {
            throw FaceTransformError.noFaceDetected
        }

        // Extract face crop
        let faceCrop = cropFace(from: image, observation: faceObservation)

        // Use Vision's face landmark quality as a simple identity feature
        // In production, replace with a proper face recognition model (e.g., FaceNet Core ML)
        let landmarks = faceObservation.landmarks
        let featureVector = extractFeatureVector(from: faceObservation, image: faceCrop)

        let normalizedLandmarks = landmarks?.allPoints?.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) } ?? []

        return IdentityEmbedding(
            vector: featureVector,
            sourceImage: faceCrop,
            sourceLandmarks: normalizedLandmarks
        )
    }

    /// Encode identity from a video by averaging embeddings across frames.
    public func encodeIdentity(from videoURL: URL) async throws -> IdentityEmbedding {
        let asset = AVAsset(url: videoURL)
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero

        let duration = asset.duration
        let frameCount = min(30, Int(duration.value) / Int(duration.timescale))
        let interval = CMTime(seconds: duration.seconds / Double(frameCount), preferredTimescale: 600)

        var embeddings: [IdentityEmbedding] = []
        for i in 0..<frameCount {
            let time = CMTimeMultiply(interval, multiplier: Int32(i))
            if let cgImage = try? await generator.image(at: time).cgImage {
                let ciImage = CIImage(cgImage: cgImage)
                let embedding = try await encodeIdentity(from: ciImage)
                embeddings.append(embedding)
            }
        }

        guard !embeddings.isEmpty else {
            throw FaceTransformError.noFaceDetected
        }

        // Average the embeddings
        let averagedVector = averageVectors(embeddings.map { $0.vector })
        let firstEmbedding = embeddings.first!

        return IdentityEmbedding(
            vector: averagedVector,
            sourceImage: firstEmbedding.sourceImage,
            sourceLandmarks: firstEmbedding.sourceLandmarks
        )
    }

    private func averageVectors(_ vectors: [[Float]]) -> [Float] {
        guard let count = vectors.first?.count else { return [] }
        var result = Array(repeating: Float(0), count: count)
        for vector in vectors {
            for i in 0..<count {
                result[i] += vector[i] / Float(vectors.count)
            }
        }
        return result
    }

    // MARK: - Live Face Analysis

    /// Analyze the live camera frame to extract expression and pose.
    public func analyzeLiveFace(_ pixelBuffer: CVPixelBuffer, timestamp: Double) async throws -> LiveFaceData {
        guard let faceObservation = try await detectFace(in: pixelBuffer) else {
            throw FaceTransformError.noFaceDetected
        }

        let landmarks = faceObservation.landmarks
        let expression = expressionExtractor.extract(from: faceObservation)
        let headPose = estimateHeadPose(from: faceObservation)

        let boundingBox = faceObservation.boundingBox
        let normalizedLandmarks = landmarks?.allPoints?.normalizedPoints.map { CGPoint(x: $0.x, y: $0.y) } ?? []

        return LiveFaceData(
            boundingBox: boundingBox,
            landmarks: normalizedLandmarks,
            expression: expression,
            headPose: headPose,
            confidence: Float(faceObservation.faceCaptureQuality ?? 0),
            timestamp: timestamp
        )
    }

    // MARK: - Face Generation (AI Inference)

    /// Generate the transformed face using the AI model.
    /// This is the core AI inference step.
    public func generateTransformedFace(
        identity: IdentityEmbedding,
        liveFace: LiveFaceData,
        sourceImageSize: CGSize
    ) async throws -> CIImage {
        guard let model = model else {
            // If no model is loaded, fall back to a placeholder implementation
            // that demonstrates the correct architecture
            return try await generatePlaceholderFace(identity: identity, liveFace: liveFace, sourceImageSize: sourceImageSize)
        }

        // Prepare model inputs
        let identityMultiArray = try MLMultiArray(identity.vector)
        let expressionArray = liveFace.expression.asArray
        let expressionMultiArray = try MLMultiArray(expressionArray)
        let poseArray: [Float] = [liveFace.headPose.pitch, liveFace.headPose.yaw, liveFace.headPose.roll]
        let poseMultiArray = try MLMultiArray(poseArray)

        // Create model input (adjust based on actual model schema)
        let input = FaceTransformInput(
            identityEmbedding: identityMultiArray,
            expressionParameters: expressionMultiArray,
            headPose: poseMultiArray
        )

        // Run inference
        let output = try await model.prediction(from: input)

        // Extract output image
        guard let outputImage = extractOutputImage(from: output) else {
            throw FaceTransformError.inferenceFailed(NSError(domain: "FaceTransform", code: -1, userInfo: [NSLocalizedDescriptionKey: "No output image from model"]))
        }

        return outputImage
    }

    /// Placeholder implementation that demonstrates the correct pipeline.
    /// This uses the source image with expression-driven warping instead of true AI generation.
    /// Replace this with actual model inference when a Core ML model is available.
    private func generatePlaceholderFace(
        identity: IdentityEmbedding,
        liveFace: LiveFaceData,
        sourceImageSize: CGSize
    ) async throws -> CIImage {
        guard let sourceImage = identity.sourceImage else {
            throw FaceTransformError.noSourceMedia
        }

        // Apply expression-based transformations to the source image
        // This is NOT AI generation - it's a placeholder that demonstrates the pipeline
        let expressionScale: CGFloat = 1.0 + CGFloat(liveFace.expression.mouthOpen) * 0.05
        let rotation = CGFloat(liveFace.headPose.roll)

        let transform = CGAffineTransform.identity
            .scaledBy(x: expressionScale, y: expressionScale)
            .rotated(by: rotation)

        let transformed = sourceImage.transformed(by: transform)

        // Crop to face region
        let faceRect = CGRect(
            x: liveFace.boundingBox.midX * sourceImageSize.width - sourceImageSize.width * 0.25,
            y: liveFace.boundingBox.midY * sourceImageSize.height - sourceImageSize.height * 0.25,
            width: sourceImageSize.width * 0.5,
            height: sourceImageSize.height * 0.5
        )

        return transformed.cropped(to: faceRect)
    }

    // MARK: - Compositing

    /// Blend the generated face into the live camera frame.
    public func compositeGeneratedFace(
        _ generatedFace: CIImage,
        into liveFrame: CIImage,
        faceData: LiveFaceData,
        targetRect: CGRect
    ) -> CIImage {
        // Create a feathered mask for smooth blending
        let mask = createFeatherMask(
            size: targetRect.size,
            faceRect: faceData.boundingBox
        )

        // Resize generated face to target rect
        let resizedFace = generatedFace.transformed(by: CGAffineTransform(
            a: targetRect.width / generatedFace.extent.width,
            b: 0,
            c: 0,
            d: targetRect.height / generatedFace.extent.height,
            tx: targetRect.origin.x,
            ty: targetRect.origin.y
        ))

        // Composite with mask
        let maskedFace = resizedFace.applyingFilter("CIBlendWithMask", parameters: [
            "inputMaskImage": mask
        ])

        return liveFrame.composited(over: maskedFace)
    }

    private func createFeatherMask(size: CGSize, faceRect: CGRect) -> CIImage {
        let mask = CIImage(color: .clear)
            .cropped(to: CGRect(origin: .zero, size: size))

        let faceMask = CIImage(color: .white)
            .cropped(to: faceRect)

        let blur = faceMask.applyingGaussianBlur(sigma: 15)

        return mask.composited(over: blur)
    }

    // MARK: - Helper Methods

    private func detectFace(in image: CIImage) async throws -> VNFaceObservation? {
        let request = VNDetectFaceLandmarksRequest()
        request.revision = VNDetectFaceLandmarksRequestRevision3
        request.maximumFaceCount = 1

        let handler = VNImageRequestHandler(ciImage: image, options: [:])
        try await handler.perform([request])

        guard let results = request.results as? [VNFaceObservation], let face = results.first else {
            return nil
        }

        return face
    }

    private func detectFace(in pixelBuffer: CVPixelBuffer) async throws -> VNFaceObservation? {
        let request = VNDetectFaceLandmarksRequest()
        request.revision = VNDetectFaceLandmarksRequestRevision3
        request.maximumFaceCount = 1

        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])
        try await handler.perform([request])

        guard let results = request.results as? [VNFaceObservation], let face = results.first else {
            return nil
        }

        return face
    }

    private func cropFace(from image: CIImage, observation: VNFaceObservation) -> CIImage {
        let bbox = observation.boundingBox
        let extent = image.extent

        // Convert normalized coordinates to image coordinates
        let x = bbox.origin.x * extent.width
        let y = bbox.origin.y * extent.height
        let w = bbox.width * extent.width
        let h = bbox.height * extent.height

        // Add margin
        let margin: CGFloat = 0.2
        let cropRect = CGRect(
            x: max(0, x - w * margin),
            y: max(0, y - h * margin),
            width: min(extent.width, w * (1 + 2 * margin)),
            height: min(extent.height, h * (1 + 2 * margin))
        )

        return image.cropped(to: cropRect)
    }

    private func extractFeatureVector(from observation: VNFaceObservation, image: CIImage) -> [Float] {
        // Extract a feature vector from face landmarks and image properties
        // In production, replace with a proper face recognition model
        let landmarks = observation.landmarks
        var features: [Float] = []

        // Add landmark-based features (relative positions)
        if let allPoints = landmarks?.allPoints?.normalizedPoints {
            for point in allPoints.prefix(68) {  // Use first 68 points
                features.append(Float(point.x))
                features.append(Float(point.y))
            }
        }

        // Add face bounding box features
        features.append(Float(observation.boundingBox.width))
        features.append(Float(observation.boundingBox.height))
        features.append(Float(observation.boundingBox.origin.x))
        features.append(Float(observation.boundingBox.origin.y))

        // Pad or truncate to fixed size
        let targetSize = 512
        if features.count < targetSize {
            features.append(contentsOf: Array(repeating: 0, count: targetSize - features.count))
        } else if features.count > targetSize {
            features = Array(features.prefix(targetSize))
        }

        return features
    }

    private func estimateHeadPose(from observation: VNFaceObservation) -> HeadPose {
        // Estimate head pose from face landmarks
        // In production, use a dedicated head pose estimation model
        let landmarks = observation.landmarks

        var pitch: Float = 0
        var yaw: Float = 0
        var roll: Float = 0

        if let leftEye = landmarks?.leftEye?.normalizedPoints,
           let rightEye = landmarks?.rightEye?.normalizedPoints {
            // Estimate roll from eye line
            let leftCenter = leftEye.average
            let rightCenter = rightEye.average
            roll = Float(atan2(rightCenter.y - leftCenter.y, rightCenter.x - leftCenter.x))
        }

        if let nose = landmarks?.nose?.normalizedPoints {
            // Estimate yaw from nose position relative to face center
            let noseTip = nose.first ?? .zero
            yaw = Float(noseTip.x - 0.5) * 2
        }

        if let chin = landmarks?.chin?.normalizedPoints {
            // Estimate pitch from chin position
            let chinPoint = chin.first ?? .zero
            pitch = Float(chinPoint.y - 0.5) * 2
        }

        return HeadPose(pitch: pitch, yaw: yaw, roll: roll)
    }

    private func extractOutputImage(from prediction: MLFeatureProvider) -> CIImage? {
        // Extract output image from model prediction
        // Adjust based on actual model output schema
        guard let imageFeature = prediction.featureValue(for: "output") else {
            return nil
        }

        if let imageValue = imageFeature.imageBufferValue {
            return CIImage(cvPixelBuffer: imageValue)
        }

        return nil
    }

    // MARK: - Public API

    public func setIdentity(_ embedding: IdentityEmbedding) {
        identityEmbedding = embedding
        temporalSmoother?.reset()
    }

    public func getIdentity() -> IdentityEmbedding? {
        return identityEmbedding
    }

    public func clearIdentity() {
        identityEmbedding = nil
        lastGeneratedFace = nil
        temporalSmoother?.reset()
    }

    public func isModelLoaded() -> Bool {
        return model != nil
    }
}

// MARK: - Model Input/Output Types

/// Input structure for face transformation model.
/// Adjust field names and types to match your Core ML model schema.
struct FaceTransformInput: MLFeatureProvider {
    let identityEmbedding: MLMultiArray
    let expressionParameters: MLMultiArray
    let headPose: MLMultiArray

    func featureValue(for name: String) -> MLFeatureValue? {
        switch name {
        case "identityEmbedding":
            return MLFeatureValue(multiArray: identityEmbedding)
        case "expressionParameters":
            return MLFeatureValue(multiArray: expressionParameters)
        case "headPose":
            return MLFeatureValue(multiArray: headPose)
        default:
            return nil
        }
    }

    var featureNames: Set<String> {
        return ["identityEmbedding", "expressionParameters", "headPose"]
    }
}

// MARK: - Supporting Types

extension Array where Element == CGPoint {
    var average: CGPoint {
        guard !isEmpty else { return .zero }
        let sum = reduce(CGPoint.zero) { $0 + $1 }
        return CGPoint(x: sum.x / Double(count), y: sum.y / Double(count))
    }
}

extension CIImage {
    func transformed(by transform: CGAffineTransform) -> CIImage {
        return self.transformed(by: transform)
    }
}
