import Foundation
import AVFoundation
import CoreImage
import CoreMedia
import Metal
import SwiftUI
import Combine

/// A background processor that performs heavy per-frame work
/// (tracking, warping, effects) off the main actor.
actor FrameProcessor {
    private let faceTracker = FaceTracker()
    private let bodyTracker = BodyTracker()
    private let smoother = TemporalSmoother(smoothingFactor: 0.35)
    private let faceWarpEngine = FaceWarpEngine()
    private let bodyWarpEngine = BodyWarpEngine()
    private var metalRenderer: MetalRenderer?

    private var lastFrameTime: CFAbsoluteTime = 0
    private var frameCount: Int = 0
    private var lastProcessingMs: Double = 0
    private var pipelineRun: UInt64 = 0

    private var frameHandler: (@Sendable (CIImage, Bool, Double) -> Void)?

    func setFrameHandler(_ handler: @escaping @Sendable (CIImage, Bool, Double) -> Void) {
        frameHandler = handler
    }

    init() {
        self.metalRenderer = MetalRenderer()
    }

    func configure() async {
        await faceTracker.configure()
        await bodyTracker.configure()
    }

    func process(
        pixelBuffer: CVPixelBuffer,
        mirrored: Bool,
        faceSettings: FaceTransformSettings,
        bodySettings: BodyTransformSettings,
        effect: String
    ) async {
        let now = CFAbsoluteTimeGetCurrent()
        let interval = now - lastFrameTime
        guard interval >= 1.0 / 30.0 else { return }
        lastFrameTime = now
        frameCount += 1

        let startMs = CFAbsoluteTimeGetCurrent()
        let thisRun = pipelineRun &+ 1
        pipelineRun = thisRun

        // 1. Face tracking (Vision, off main thread)
        let trackResult = await faceTracker.track(pixelBuffer, timestamp: CFAbsoluteTimeGetCurrent())

        // 2. Temporal smoothing
        var smoothedResult: FaceTrackingResult?
        if let result = trackResult {
            smoothedResult = await smoother.smooth(result: result)
        } else {
            await smoother.reset()
        }

        var hasFace = false
        var sourceLandmarks: [CGPoint] = []
        var faceLandmarkData: FaceLandmarkData?
        if let result = smoothedResult {
            hasFace = true
            sourceLandmarks = result.landmarks.allPoints
            faceLandmarkData = result.landmarks
        }

        // 3. Body tracking (throttled) used when body transform is active
        var bodyMask: CVPixelBuffer?
        if bodySettings.hasModifications {
            let body = await bodyTracker.track(pixelBuffer, throttleMs: 100)
            bodyMask = body.mask
        }

        // 4. Build the working image
        let sourceImage = CIImage(cvPixelBuffer: pixelBuffer)
        let width = sourceImage.extent.width
        let height = sourceImage.extent.height

        var outputImage = sourceImage
        if mirrored {
            outputImage = outputImage.oriented(.upMirrored)
        }

        // 5. Face geometric transformation
        if hasFace, faceSettings.hasModifications, !sourceLandmarks.isEmpty {
            let sourcePts = sourceLandmarks.map { CGPoint(x: $0.x * width, y: $0.y * height) }
            let targetPts = faceWarpEngine.computeWarpedLandmarks(
                originalLandmarks: sourcePts,
                settings: faceSettings,
                imageWidth: width,
                imageHeight: height
            )
            outputImage = faceWarpEngine.warpImage(
                outputImage,
                sourceLandmarks: sourcePts,
                targetLandmarks: targetPts
            )
        }

        // 6. Body geometric transformation (localized to person region)
        if bodySettings.hasModifications {
            outputImage = bodyWarpEngine.applyBodyTransform(
                to: outputImage,
                segmentationMask: bodyMask,
                settings: bodySettings,
                faceData: faceLandmarkData
            )
        }

        // 7. Apply visual effect
        if effect != "none" {
            if let renderer = metalRenderer {
                outputImage = await renderer.applyShaderEffect(effect, to: outputImage, time: CFAbsoluteTimeGetCurrent())
            }
        }

        lastProcessingMs = (CFAbsoluteTimeGetCurrent() - startMs) * 1000

        // Publish the latest frame only
        guard thisRun == pipelineRun else { return }
        let finalImage = outputImage
        let finalHasFace = hasFace
        let finalMs = lastProcessingMs
        frameHandler?(finalImage, finalHasFace, finalMs)
    }
}

/// The observable engine that coordinates the UI and hands off heavy work
/// to the background `FrameProcessor`.
@MainActor
public final class VeyraEngine: ObservableObject {
    @Published public var isRunning = false
    @Published public var faceDetected = false
    @Published public var performanceStats = PerformanceStats()
    @Published public var faceSettings = FaceTransformSettings() {
        didSet { saveSettings() }
    }
    @Published public var bodySettings = BodyTransformSettings() {
        didSet { saveSettings() }
    }
    @Published public var currentEffect: String = "none"
    @Published public var mirrored = true {
        didSet { cameraManager.mirrored = mirrored }
    }
    @Published public var previewImage: CIImage?

    public let cameraManager = CameraManager()

    private var processor: FrameProcessor?
    private var lastFpsTime: CFAbsoluteTime = 0
    private var fpsCounter: Int = 0
    private var lastProcessingMs: Double = 0
    private var currentFPS: Double = 0

    public init() {
        loadSettings()
        let proc = FrameProcessor()
        processor = proc

        Task { @MainActor in
            await proc.configure()
            await proc.setFrameHandler { [weak self] image, hasFace, ms in
                Task { @MainActor in
                    guard let self else { return }
                    self.fpsCounter += 1
                    let now = CFAbsoluteTimeGetCurrent()
                    if now - self.lastFpsTime >= 1.0 {
                        self.currentFPS = Double(self.fpsCounter)
                        self.fpsCounter = 0
                        self.lastFpsTime = now
                    }
                    self.previewImage = image
                    self.faceDetected = hasFace
                    self.lastProcessingMs = ms
                    self.performanceStats = PerformanceStats(
                        fps: self.currentFPS,
                        processingMs: ms,
                        droppedFrames: 0
                    )
                }
            }
        }

        cameraManager.onFrameCaptured = { [weak self] buffer, _ in
            guard let self else { return }
            // Capture settings synchronously (MainActor-safe)
            let mirrored = self.mirrored
            let fSettings = self.faceSettings
            let bSettings = self.bodySettings
            let effect = self.currentEffect
            let captured = self.processor
            Task {
                await captured?.process(
                    pixelBuffer: buffer,
                    mirrored: mirrored,
                    faceSettings: fSettings,
                    bodySettings: bSettings,
                    effect: effect
                )
            }
        }
    }

    public func start() async {
        guard !isRunning else { return }
        let granted = await cameraManager.requestPermission()
        guard granted else { return }

        do {
            try await cameraManager.startSession()
            if let proc = processor {
                await proc.configure()
            }
            isRunning = true
            lastFpsTime = CFAbsoluteTimeGetCurrent()
        } catch {
            print("[VeyraEngine] Failed to start: \(error)")
        }
    }

    public func stop() {
        cameraManager.stopSession()
        isRunning = false
        faceDetected = false
        previewImage = nil
    }

    public func switchCamera() {
        cameraManager.switchCamera()
    }

    public func setEffect(_ effect: String) {
        currentEffect = effect
    }

    private func saveSettings() {
        if let data = try? JSONEncoder().encode(faceSettings) {
            UserDefaults.standard.set(data, forKey: "veyra.faceSettings")
        }
        if let data = try? JSONEncoder().encode(bodySettings) {
            UserDefaults.standard.set(data, forKey: "veyra.bodySettings")
        }
    }

    private func loadSettings() {
        if let data = UserDefaults.standard.data(forKey: "veyra.faceSettings"),
           let settings = try? JSONDecoder().decode(FaceTransformSettings.self, from: data) {
            faceSettings = settings
        }
        if let data = UserDefaults.standard.data(forKey: "veyra.bodySettings"),
           let settings = try? JSONDecoder().decode(BodyTransformSettings.self, from: data) {
            bodySettings = settings
        }
    }
}
