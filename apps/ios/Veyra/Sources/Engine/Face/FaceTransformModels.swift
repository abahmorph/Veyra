import Foundation
import CoreML
import Vision
import CoreImage
import Metal

/// Protocol for AI face transformation models.
/// Any Core ML model that conforms to this interface can be used.
public protocol FaceTransformModel {
    /// Generate a face image from identity embedding and expression parameters.
    func generateFace(
        identityEmbedding: MLMultiArray,
        expressionParameters: ExpressionParameters,
        headPose: HeadPose,
        targetSize: CGSize
    ) async throws -> CIImage?
}

/// Expression parameters extracted from live face landmarks.
public struct ExpressionParameters: Codable, Sendable {
    public var mouthOpen: Float
    public var smile: Float
    public var leftEyeOpen: Float
    public var rightEyeOpen: Float
    public var eyebrowRaise: Float
    public var jawOpen: Float
    public var lipPucker: Float
    public var noseWrinkle: Float

    public init(
        mouthOpen: Float = 0,
        smile: Float = 0,
        leftEyeOpen: Float = 1,
        rightEyeOpen: Float = 1,
        eyebrowRaise: Float = 0,
        jawOpen: Float = 0,
        lipPucker: Float = 0,
        noseWrinkle: Float = 0
    ) {
        self.mouthOpen = mouthOpen
        self.smile = smile
        self.leftEyeOpen = leftEyeOpen
        self.rightEyeOpen = rightEyeOpen
        self.eyebrowRaise = eyebrowRaise
        self.jawOpen = jawOpen
        self.lipPucker = lipPucker
        self.noseWrinkle = noseWrinkle
    }

    public var asArray: [Float] {
        [
            mouthOpen, smile, leftEyeOpen, rightEyeOpen,
            eyebrowRaise, jawOpen, lipPucker, noseWrinkle
        ]
    }
}

/// Head pose parameters.
public struct HeadPose: Codable, Sendable {
    public var pitch: Float  // up/down
    public var yaw: Float    // left/right
    public var roll: Float   // tilt

    public init(pitch: Float = 0, yaw: Float = 0, roll: Float = 0) {
        self.pitch = pitch
        self.yaw = yaw
        self.roll = roll
    }
}

/// Identity embedding extracted from a source face.
public struct IdentityEmbedding: Sendable, Equatable {
    public let vector: [Float]
    public let sourceImage: CIImage?
    public let sourceLandmarks: [CGPoint]?

    public init(vector: [Float], sourceImage: CIImage? = nil, sourceLandmarks: [CGPoint]? = nil) {
        self.vector = vector
        self.sourceImage = sourceImage
        self.sourceLandmarks = sourceLandmarks
    }
}

/// Face detection result with expression parameters.
public struct LiveFaceData: Sendable {
    public let boundingBox: CGRect
    public let landmarks: [CGPoint]
    public let expression: ExpressionParameters
    public let headPose: HeadPose
    public let confidence: Float
    public let timestamp: Double

    public init(
        boundingBox: CGRect,
        landmarks: [CGPoint],
        expression: ExpressionParameters,
        headPose: HeadPose,
        confidence: Float,
        timestamp: Double
    ) {
        self.boundingBox = boundingBox
        self.landmarks = landmarks
        self.expression = expression
        self.headPose = headPose
        self.confidence = confidence
        self.timestamp = timestamp
    }
}

/// Configuration for the AI face transformation pipeline.
public struct FaceTransformConfig: Sendable {
    public let modelURL: URL?
    public let identityStrength: Float  // 0-1, how strongly to apply identity
    public let smoothingFactor: Float   // 0-1, temporal smoothing
    public let faceCropMargin: CGFloat  // extra margin around face crop
    public let outputResolution: CGSize

    public init(
        modelURL: URL? = nil,
        identityStrength: Float = 0.8,
        smoothingFactor: Float = 0.3,
        faceCropMargin: CGFloat = 0.2,
        outputResolution: CGSize = CGSize(width: 512, height: 512)
    ) {
        self.modelURL = modelURL
        self.identityStrength = identityStrength
        self.smoothingFactor = smoothingFactor
        self.faceCropMargin = faceCropMargin
        self.outputResolution = outputResolution
    }
}

/// Errors specific to AI face transformation.
public enum FaceTransformError: Error, LocalizedError {
    case modelNotLoaded
    case modelLoadFailed(Error)
    case inferenceFailed(Error)
    case noFaceDetected
    case multipleFacesDetected
    case invalidIdentityEmbedding
    case unsupportedModelConfiguration
    case noSourceMedia

    public var errorDescription: String? {
        switch self {
        case .modelNotLoaded:
            return "AI face transformation model is not loaded."
        case .modelLoadFailed(let error):
            return "Failed to load AI model: \(error.localizedDescription)"
        case .inferenceFailed(let error):
            return "Face transformation inference failed: \(error.localizedDescription)"
        case .noFaceDetected:
            return "No face detected. Please ensure your face is visible."
        case .multipleFacesDetected:
            return "Multiple faces detected. Please ensure only one face is visible."
        case .invalidIdentityEmbedding:
            return "Invalid identity embedding. Please reselect your source photo or video."
        case .unsupportedModelConfiguration:
            return "The AI model configuration is not supported on this device."
        case .noSourceMedia:
            return "No source photo or video selected. Please select a source first."
        }
    }
}
