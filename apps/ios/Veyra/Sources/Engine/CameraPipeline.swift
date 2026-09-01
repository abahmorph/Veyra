import Foundation
import AVFoundation
import CoreImage
import CoreMedia
import Vision
import Metal
import MetalKit

public actor CameraPipeline {
    public static let shared = CameraPipeline()

    private var captureSession: AVCaptureSession?
    private var videoOutput: AVCaptureVideoDataOutput?
    private var audioOutput: AVCaptureAudioDataOutput?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var processingQueue = DispatchQueue(label: "veyra.processing", qos: .userInteractive)
    private var renderer: MetalRenderer?
    private var ciContext: CIContext?
    private var currentBuffer: CVPixelBuffer?

    private let faceTracker = FaceTracker()
    private let backgroundProcessor = BackgroundProcessor()
    private var effectId: String = "none"
    private var background: BackgroundDefinition?
    private var mirror: Bool = true
    private var resolution: Resolution = Resolution(label: "1280 × 720", width: 1280, height: 720)
    private var fps: Int = 30
    private var effectQuality: Double = 1.0
    private var running: Bool = false
    private var frameIndex: UInt64 = 0
    private var lastProcessed = CFAbsoluteTime(0)
    private var lastStatsUpdate = CFAbsoluteTime(0)
    private var droppedFrames: Int = 0
    private var goodFrames: Int = 0
    private var adaptCounter: Int = 0

    public var stats: PerformanceStats {
        get async {
            let faceMs = await faceTracker.lastProcessingMs
            let bgMs = await backgroundProcessor.lastProcessingMs
            return PerformanceStats(
                fps: 0,
                captureFps: 0,
                processingMs: faceMs + bgMs,
                pipelineMs: faceMs + bgMs,
                backgroundMs: bgMs,
                faceMs: faceMs,
                droppedFrames: droppedFrames,
                qualityScale: effectQuality
            )
        }
    }

    private init() {
        let device = MTLCreateSystemDefaultDevice()
        guard let device else {
            print("[CameraPipeline] Metal not available")
            return
        }
        renderer = MetalRenderer(device: device)
        ciContext = CIContext(mtlDevice: device)
    }

    public func configure() {
        guard renderer != nil else { return }
    }

    public func start(
        cameraId: String? = nil,
        micId: String? = nil
    ) async throws {
        guard !running else { return }
        running = true

        let session = AVCaptureSession()
        session.beginConfiguration()
        session.sessionPreset = .high

        // Camera
        let camera: AVCaptureDevice
        if let cameraId, let device = AVCaptureDevice(uniqueID: cameraId) {
            camera = device
        } else {
            camera = try await AVCaptureDevice.DiscoverySession(
                deviceTypes: [.builtInWideAngleCamera],
                mediaType: .video,
                position: .front
            ).devices.first ?? AVCaptureDevice.default(for: .video)!
        }

        guard let videoInput = try? AVCaptureDeviceInput(device: camera) else {
            throw NSError(domain: "CameraPipeline", code: -1, userInfo: [NSLocalizedDescriptionKey: "Cannot create video input"])
        }
        guard session.canAddInput(videoInput) else {
            throw NSError(domain: "CameraPipeline", code: -2, userInfo: [NSLocalizedDescriptionKey: "Cannot add video input"])
        }
        session.addInput(videoInput)

        // Video output
        let videoOutput = AVCaptureVideoDataOutput()
        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        videoOutput.setSampleBufferDelegate(self, queue: processingQueue)
        videoOutput.alwaysDiscardsLateVideoFrames = true
        guard session.canAddOutput(videoOutput) else {
            throw NSError(domain: "CameraPipeline", code: -3, userInfo: [NSLocalizedDescriptionKey: "Cannot add video output"])
        }
        session.addOutput(videoOutput)
        self.videoOutput = videoOutput

        // Audio output
        if let micId {
            let audioDevice = AVCaptureDevice(uniqueID: micId) ?? AVCaptureDevice.default(for: .audio)
            if let audioDevice, let audioInput = try? AVCaptureDeviceInput(device: audioDevice) {
                if session.canAddInput(audioInput) {
                    session.addInput(audioInput)
                }
            }
        }

        if let audioDevice = AVCaptureDevice.default(for: .audio),
           let audioInput = try? AVCaptureDeviceInput(device: audioDevice),
           session.canAddInput(audioInput) {
            session.addInput(audioInput)
        }

        let audioOutput = AVCaptureAudioDataOutput()
        audioOutput.setSampleBufferDelegate(self, queue: processingQueue)
        if session.canAddOutput(audioOutput) {
            session.addOutput(audioOutput)
        }
        self.audioOutput = audioOutput

        session.commitConfiguration()
        session.startRunning()
        self.captureSession = session

        await faceTracker.configure()
        await backgroundProcessor.configure()
    }

    public func stop() {
        running = false
        captureSession?.stopRunning()
        captureSession = nil
        videoOutput = nil
        audioOutput = nil
        frameIndex = 0
        droppedFrames = 0
    }

    public func setEffect(_ id: String) {
        effectId = id
        effectQuality = 1.0
    }

    public func setBackground(_ bg: BackgroundDefinition?) {
        background = bg
    }

    public func setResolution(_ res: Resolution) {
        resolution = res
    }

    public func setFps(_ newFps: Int) {
        fps = newFps
    }

    public func setMirror(_ m: Bool) {
        mirror = m
    }

    public var captureSession: AVCaptureSession? {
        return captureSession
    }
        AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera, .builtInUltraWideCamera],
            mediaType: .video,
            position: .unspecified
        ).devices
    }

    public func getAudioDevices() -> [AVCaptureDevice] {
        AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInMicrophone],
            mediaType: .audio,
            position: .unspecified
        ).devices
    }
}

extension CameraPipeline: @retroactive AVCaptureVideoDataOutputSampleBufferDelegate {
    public func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        guard running else { return }
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        let now = CFAbsoluteTimeGetCurrent()
        let interval = 1.0 / Double(fps)
        if now - lastProcessed < interval {
            droppedFrames += 1
            return
        }
        lastProcessed = now
        frameIndex += 1

        processingQueue.async { [weak self] in
            self?.processFrame(pixelBuffer, timestamp: now)
        }

        // Stats update every 500ms
        if now - lastStatsUpdate >= 0.5 {
            lastStatsUpdate = now
            Task { @MainActor in
                // Stats will be published via notification
            }
        }
    }

    private func processFrame(_ pixelBuffer: CVPixelBuffer, timestamp: Double) {
        guard let ciContext, let renderer else { return }

        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)

        // Mirror if needed
        var processedImage = ciImage
        if mirror {
            processedImage = ciImage.oriented(.upMirrored)
        }

        // Face tracking
        let facePose = Task { @Sendable in
            await faceTracker.track(pixelBuffer, timestamp: timestamp)
        }.value

        // Background segmentation
        let bgMask = Task { @Sendable in
            await backgroundProcessor.segment(pixelBuffer, throttleMs: 66, timestamp: timestamp)
        }.value

        // Apply effect
        var outputImage = processedImage
        let effect = effectId

        if effect != "none" {
            if let shaderEffect = ShaderEffect.allCases.first(where: { $0.rawValue == effect }) {
                outputImage = renderer.applyShader(shaderEffect, to: processedImage, time: timestamp)
            } else if let canvasEffect = CanvasEffect(rawValue: effect) {
                outputImage = applyCanvasEffect(canvasEffect, to: processedImage, facePose: facePose)
            }
        }

        // Background compositing
        if let bg = background, let mask = bgMask {
            outputImage = compositeBackground(outputImage, background: bg, mask: mask)
        }

        // Render to Metal surface
        renderer.render(outputImage, to: pixelBuffer)

        // Virtual camera sampling
        if frameIndex % 30 == 0 {
            sampleVirtualCamera(pixelBuffer)
        }
    }

    private func applyCanvasEffect(_ effect: CanvasEffect, to image: CIImage, facePose: FacePose?) -> CIImage {
        guard let facePose else { return image }

        let context = CIContext()
        let extent = image.extent

        switch effect {
        case .robot:
            return applyRobotMask(to: image, facePose: facePose, extent: extent)
        case .avatar:
            return applyAvatar(to: image, facePose: facePose, extent: extent)
        case .privacyBlur:
            return applyPrivacyBlur(to: image, facePose: facePose, extent: extent)
        case .faceReplace:
            return await applyAIFaceReplace(to: image, facePose: facePose, extent: extent)
        default:
            return image
        }
    }

    private func applyRobotMask(to image: CIImage, facePose: FacePose, extent: CGRect) -> CIImage {
        // Robot mask overlay using face landmarks
        let maskImage = createRobotMask(facePose: facePose, extent: extent)
        return image.composited(over: maskImage)
    }

    private func createRobotMask(facePose: FacePose, extent: CGRect) -> CIImage {
        let width = extent.width
        let height = extent.height
        let bbox = facePose.boundingBox

        guard let bbox else { return CIImage() }

        let cx = (bbox.centerX + bbox.width / 2) * width
        let cy = (bbox.centerY + bbox.height / 2) * height
        let w = bbox.width * width * 1.25
        let h = bbox.height * height * 1.3

        let renderer = UIGraphicsImageRenderer(size: extent.size)
        let maskImage = renderer.image { ctx in
            UIColor.clear.setFill()
            ctx.fill(extent)

            let gradient = CGGradient(
                colorsSpace: CGColorSpaceCreateDeviceRGB(),
                colors: [
                    UIColor(white: 0.85, alpha: 1).cgColor,
                    UIColor(white: 0.55, alpha: 1).cgColor,
                    UIColor(white: 0.24, alpha: 1).cgColor
                ] as CFArray,
                locations: [0, 0.5, 1]
            )!

            ctx.cgContext.translateBy(x: cx, y: cy)
            ctx.cgContext.rotate(by: facePose.headTilt)
            let rect = CGRect(x: -w/2, y: -h/2, width: w, height: h)
            ctx.cgContext.addPath(UIBezierPath(roundedRect: rect, cornerRadius: w * 0.24).cgPath)
            ctx.cgContext.clip()
            ctx.cgContext.drawLinearGradient(gradient, start: CGPoint(x: 0, y: -h/2), end: CGPoint(x: 0, y: h/2), options: [])

            // Eye visor glow
            let eyeY = ((facePose.landmarks[33].y + facePose.landmarks[263].y) / 2 * height) - cy
            ctx.cgContext.setShadow(offset: .zero, radius: 18, color: UIColor(red: 0, green: 0.9, blue: 1, alpha: 0.8).cgColor)
            ctx.cgContext.setFillColor(UIColor(red: 0.01, green: 0.13, blue: 0.18, alpha: 1).cgColor)
            ctx.cgContext.fill(CGRect(x: -w*0.42, y: eyeY - h*0.05, width: w*0.84, height: h*0.1))
        }

        return CIImage(image: maskImage) ?? CIImage()
    }

    private func applyAvatar(to image: CIImage, facePose: FacePose, extent: CGRect) -> CIImage {
        // Avatar effect - would need proper rendering
        return image
    }

    private func applyPrivacyBlur(to image: CIImage, facePose: FacePose, extent: CGRect) -> CIImage {
        guard let bbox = facePose.boundingBox else { return image }

        let width = extent.width
        let height = extent.height
        let cx = (bbox.centerX + bbox.width / 2) * width
        let cy = (bbox.centerY + bbox.height / 2) * height
        let rx = bbox.width * width * 0.62
        let ry = bbox.height * height * 0.78

        let blurFilter = CIFilter.gaussianBlur()
        blurFilter.radius = max(14, ry * 0.22)

        let maskImage = CIImage { (rect, info) -> Void in
            guard let ctx = CGContext(data: info?.destinationContext,
                                      width: Int(rect.width),
                                      height: Int(rect.height),
                                      bitsPerComponent: 8,
                                      bytesPerRow: 0,
                                      space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue) else { return }
            ctx.setFillColor(UIColor.clear.cgColor)
            ctx.fill(rect)
            ctx.setBlendMode(.copy)
            ctx.setFillColor(UIColor.white.cgColor)
            ctx.addEllipse(in: CGRect(x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2))
            ctx.fillPath()
        }

        guard let mask = maskImage else { return image }
        blurFilter.mask = mask
        return blurFilter.outputImage?.cropped(to: extent) ?? image
    }

    private func applyFaceReplace(to image: CIImage, facePose: FacePose, extent: CGRect) -> CIImage {
        // Face replacement using source image warp
        guard let sourceImage = FaceReplaceManager.shared.sourceImage,
              let sourceLandmarks = FaceReplaceManager.shared.sourceLandmarks else {
            return image
        }

        let width = extent.width
        let height = extent.height

        // Use Delaunay triangulation for better face warping
        let triangles = DelaunayTriangulation.triangulate(
            source: sourceLandmarks,
            target: facePose.landmarks.map { CGPoint(x: $0.x * width, y: $0.y * height) },
            imageSize: extent.size
        )

        return warpImage(sourceImage, using: triangles, targetSize: extent.size)
    }

    private func warpImage(_ source: UIImage, using triangles: [Triangle], targetSize: CGSize) -> CIImage {
        let renderer = UIGraphicsImageRenderer(size: targetSize)
        let resultImage = renderer.image { ctx in
            UIColor.clear.setFill()
            ctx.fill(CGRect(origin: .zero, size: targetSize))

            for triangle in triangles {
                ctx.cgContext.beginPath()
                ctx.cgContext.move(to: triangle.dst[0])
                ctx.cgContext.addLine(to: triangle.dst[1])
                ctx.cgContext.addLine(to: triangle.dst[2])
                ctx.cgContext.closePath()
                ctx.cgContext.clip()

                let affine = affineTransform(
                    from: triangle.src,
                    to: triangle.dst
                )
                ctx.cgContext.concatenate(affine)
                ctx.cgContext.draw(source.cgImage!, in: CGRect(origin: .zero, size: targetSize))
            }
        }

        return CIImage(image: resultImage) ?? CIImage()
    }

    private func affineTransform(from src: [CGPoint], to dst: [CGPoint]) -> CGAffineTransform {
        // Compute affine transform mapping triangle src -> dst
        let x1 = src[0].x, y1 = src[0].y
        let x2 = src[1].x, y2 = src[1].y
        let x3 = src[2].x, y3 = src[2].y

        let u1 = dst[0].x, v1 = dst[0].y
        let u2 = dst[1].x, v2 = dst[1].y
        let u3 = dst[2].x, v3 = dst[2].y

        let det = (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2))

        guard abs(det) > 1e-6 else { return .identity }

        let a = (u1 * (y2 - y3) + u2 * (y3 - y1) + u3 * (y1 - y2)) / det
        let b = (v1 * (y2 - y3) + v2 * (y3 - y1) + v3 * (y1 - y2)) / det
        let c = (x1 * (u2 - u3) + x2 * (u3 - u1) + x3 * (u1 - u2)) / det
        let d = (x1 * (v2 - v3) + x2 * (v3 - v1) + x3 * (v1 - v2)) / det
        let tx = (x1 * (y2*u3 - y3*u2) + x2 * (y3*u1 - y1*u3) + x3 * (y1*u2 - y2*u1)) / det
        let ty = (x1 * (y2*v3 - y3*v2) + x2 * (y3*v1 - y1*v3) + x3 * (y1*v2 - y2*v1)) / det

        return CGAffineTransform(a: CGFloat(a), b: CGFloat(b), c: CGFloat(c), d: CGFloat(d), tx: CGFloat(tx), ty: CGFloat(ty))
    }

    private func compositeBackground(_ foreground: CIImage, background: BackgroundDefinition, mask: SegmentMask) -> CIImage {
        // Background compositing with segmentation mask
        return foreground
    }

    private func sampleVirtualCamera(_ pixelBuffer: CVPixelBuffer) {
        // Push frame to ReplayKit broadcast
    }

    public func getCameraDevices() -> [AVCaptureDevice] {
        return AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera, .builtInUltraWideCamera],
            mediaType: .video,
            position: .unspecified
        ).devices
    }

    public func getAudioDevices() -> [AVCaptureDevice] {
        return AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInMicrophone],
            mediaType: .audio,
            position: .unspecified
        ).devices
    }
}

// MARK: - Supporting Types

struct Triangle {
    let src: [CGPoint]
    let dst: [CGPoint]
}

enum CanvasEffect: String, CaseIterable {
    case robot
    case avatar
    case privacyBlur
    case faceReplace
}

enum ShaderEffect: String, CaseIterable {
    case none
    case beauty
    case cartoon
    case anime
    case cyberpunk
    case fantasy
    case horror
    case pixel
    case glitch
}

struct FacePose {
    let landmarks: [CGPoint]
    let headTilt: Double
    let headYaw: Double
    let mouthOpen: Double
    let blink: Double
    let boundingBox: CGRect?
    let timestamp: Double
}

struct SegmentMask {
    let data: [Float]
    let width: Int
    let height: Int
}
