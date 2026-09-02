import Foundation
import AVFoundation
import Combine
import CoreMedia

@MainActor
public final class CameraManager: NSObject, ObservableObject {
    @Published public var isRunning = false
    @Published public var permissionGranted = false
    @Published public var currentCamera: AVCaptureDevice?
    @Published public var availableCameras: [AVCaptureDevice] = []
    @Published public var mirrored = true
    
    public var onFrameCaptured: ((CVPixelBuffer, CMTime) -> Void)?
    
    private var _captureSession: AVCaptureSession?
    private var videoOutput: AVCaptureVideoDataOutput?
    private var processingQueue = DispatchQueue(label: "com.veyra.camera", qos: .userInteractive)
    private var lastFrameTime: CMTime = .zero
    
    public override init() {
        super.init()
        discoverCameras()
    }
    
    public func discoverCameras() {
        let discoverySession = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera, .builtInUltraWideCamera, .builtInTripleCamera],
            mediaType: .video,
            position: .unspecified
        )
        availableCameras = discoverySession.devices
        
        if let front = availableCameras.first(where: { $0.position == .front }) {
            currentCamera = front
        } else {
            currentCamera = availableCameras.first
        }
    }
    
    public func requestPermission() async -> Bool {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        switch status {
        case .authorized:
            permissionGranted = true
            return true
        case .notDetermined:
            let granted = await AVCaptureDevice.requestAccess(for: .video)
            permissionGranted = granted
            return granted
        case .denied, .restricted:
            permissionGranted = false
            return false
        @unknown default:
            permissionGranted = false
            return false
        }
    }
    
    public func startSession() async throws {
        guard !isRunning else { return }
        
        let session = AVCaptureSession()
        session.beginConfiguration()
        session.sessionPreset = .high
        
        // Add camera input
        let device = currentCamera ?? AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front)
        guard let device = device else {
            throw CameraError.noDevice
        }
        
        let input = try AVCaptureDeviceInput(device: device)
        guard session.canAddInput(input) else {
            throw CameraError.cannotAddInput
        }
        session.addInput(input)
        
        // Configure video output
        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        output.setSampleBufferDelegate(self, queue: processingQueue)
        output.alwaysDiscardsLateVideoFrames = true
        
        guard session.canAddOutput(output) else {
            throw CameraError.cannotAddOutput
        }
        session.addOutput(output)
        self.videoOutput = output
        
        // Configure connection for mirroring
        if let connection = output.connection(with: .video) {
            if connection.isVideoMirroringSupported {
                connection.isVideoMirrored = mirrored
            }
            if connection.isVideoOrientationSupported {
                connection.videoOrientation = .portrait
            }
        }
        
        session.commitConfiguration()
        session.startRunning()
        self._captureSession = session
        self.isRunning = true
    }
    
    public func stopSession() {
        _captureSession?.stopRunning()
        _captureSession = nil
        videoOutput = nil
        isRunning = false
    }
    
    public func switchCamera() {
        guard let current = currentCamera else { return }
        let newPosition: AVCaptureDevice.Position = current.position == .front ? .back : .front
        if let newCamera = availableCameras.first(where: { $0.position == newPosition }) {
            currentCamera = newCamera
            if isRunning {
                Task {
                    stopSession()
                    try? await startSession()
                }
            }
        }
    }
    
    public func toggleMirror() {
        mirrored.toggle()
        if let connection = videoOutput?.connection(with: .video), connection.isVideoMirroringSupported {
            connection.isVideoMirrored = mirrored
        }
    }
    
    public var captureSession: AVCaptureSession? {
        return _captureSession
    }
}

extension CameraManager: AVCaptureVideoDataOutputSampleBufferDelegate {
    nonisolated public func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        
        Task { @MainActor in
            self.onFrameCaptured?(pixelBuffer, timestamp)
        }
    }
}

public enum CameraError: Error, LocalizedError {
    case noDevice
    case cannotAddInput
    case cannotAddOutput
    case permissionDenied
    
    public var errorDescription: String? {
        switch self {
        case .noDevice: return "No camera device found"
        case .cannotAddInput: return "Cannot add camera input"
        case .cannotAddOutput: return "Cannot add video output"
        case .permissionDenied: return "Camera permission denied"
        }
    }
}
