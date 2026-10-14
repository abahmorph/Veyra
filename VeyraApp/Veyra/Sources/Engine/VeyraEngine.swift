import Foundation
import AVFoundation
import CoreImage
import CoreMedia
import Metal
import SwiftUI
import Combine
import UIKit

/// A background processor that performs heavy per-frame work
/// (tracking, warping, effects) off the main actor.
actor FrameProcessor {
    private let faceTracker = FaceTracker()
    private let bodyTracker = BodyTracker()
    private let smoother = TemporalSmoother(smoothingFactor: 0.35)
    private let faceWarpEngine = FaceWarpEngine()
    private let bodyWarpEngine = BodyWarpEngine()
    private let faceReplaceEngine = FaceReplaceEngine()
    private var metalRenderer: MetalRenderer?

    private var lastFrameTime: CFAbsoluteTime = 0
    private var frameCount: Int = 0
    private var lastProcessingMs: Double = 0
    private var pipelineRun: UInt64 = 0
    private var lastBodyMask: CVPixelBuffer?
    private var droppedFrames: Int = 0

    private var frameHandler: (@Sendable (CIImage, Bool, Double, Int) -> Void)?

    func setFrameHandler(_ handler: @escaping @Sendable (CIImage, Bool, Double, Int) -> Void) {
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
        effect: String,
        referenceFace: ReferenceFace?,
        faceReplaceEnabled: Bool,
        faceReplaceBlend: Double
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
            // Vision face-landmark points are normalized to the face bounding
            // box; combine with the box to get pixel coordinates.
            let bb = result.landmarks.boundingBox
            let pixelWidth = CGFloat(CVPixelBufferGetWidth(pixelBuffer))
            let pixelHeight = CGFloat(CVPixelBufferGetHeight(pixelBuffer))
            sourceLandmarks = result.landmarks.allPoints.map { point in
                CGPoint(x: (point.x * bb.width + bb.minX) * pixelWidth,
                        y: (point.y * bb.height + bb.minY) * pixelHeight)
            }
            faceLandmarkData = result.landmarks
        }

        // 3. Body tracking (throttled) used when body transform is active.
        // Keep the most recent mask so throttled frames still apply the body
        // transform instead of silently dropping it.
        var bodyMask: CVPixelBuffer?
        if bodySettings.hasModifications {
            let body = await bodyTracker.track(pixelBuffer, throttleMs: 100)
            if let newMask = body.mask {
                lastBodyMask = newMask
            }
            bodyMask = body.mask ?? lastBodyMask
        } else {
            lastBodyMask = nil
        }

        // 4. Build the working image
        let sourceImage = CIImage(cvPixelBuffer: pixelBuffer)
        let width = sourceImage.extent.width
        let height = sourceImage.extent.height

        var outputImage = sourceImage
        if mirrored {
            outputImage = outputImage.oriented(.upMirrored)
        }

        // 5. Reference-face replacement (applied before reshaping so the
        // geometric reshape also affects the swapped face).
        if faceReplaceEnabled, let reference = referenceFace, hasFace, sourceLandmarks.count >= 3 {
            outputImage = faceReplaceEngine.replaceFace(
                in: outputImage,
                liveLandmarks: sourceLandmarks,
                reference: reference,
                blend: faceReplaceBlend
            )
        }

        // 6. Face geometric transformation
        if hasFace, faceSettings.hasModifications, !sourceLandmarks.isEmpty {
            let targetPts = faceWarpEngine.computeWarpedLandmarks(
                originalLandmarks: sourceLandmarks,
                settings: faceSettings,
                imageWidth: width,
                imageHeight: height
            )
            outputImage = faceWarpEngine.warpImage(
                outputImage,
                sourceLandmarks: sourceLandmarks,
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

        // Publish the latest frame only. Frames superseded by a newer one were
        // effectively dropped by the pipeline, so surface that honestly.
        guard thisRun == pipelineRun else {
            droppedFrames += 1
            return
        }
        let finalImage = outputImage
        let finalHasFace = hasFace
        let finalMs = lastProcessingMs
        let finalDropped = droppedFrames
        frameHandler?(finalImage, finalHasFace, finalMs, finalDropped)
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

    @Published public var referenceFace: ReferenceFace?
    @Published public var faceReplaceEnabled = false
    @Published public var faceReplaceBlend: Double = 1.0
    @Published public var referenceError: String?

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
            await proc.setFrameHandler { [weak self] image, hasFace, ms, dropped in
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
                        droppedFrames: dropped
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
            let reference = self.referenceFace
            let replaceEnabled = self.faceReplaceEnabled && self.referenceFace != nil
            let replaceBlend = self.faceReplaceBlend
            let captured = self.processor
            Task {
                await captured?.process(
                    pixelBuffer: buffer,
                    mirrored: mirrored,
                    faceSettings: fSettings,
                    bodySettings: bSettings,
                    effect: effect,
                    referenceFace: reference,
                    faceReplaceEnabled: replaceEnabled,
                    faceReplaceBlend: replaceBlend
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

    /// Decodes a picked photo, detects its face and prepares it as the swap
    /// reference. Runs the Vision detection off the main actor.
    public func loadReferenceFace(from data: Data) async {
        guard let uiImage = UIImage(data: data), let ciImage = CIImage(image: uiImage) else {
            referenceError = "Could not read that photo."
            return
        }
        let prepared = await Task.detached(priority: .userInitiated) {
            FaceReplaceEngine().prepareReferenceFace(from: ciImage)
        }.value

        if let prepared = prepared {
            referenceFace = prepared
            referenceError = nil
            faceReplaceEnabled = true
        } else {
            referenceFace = nil
            referenceError = "No face detected in that photo."
        }
    }

    public func clearReferenceFace() {
        referenceFace = nil
        referenceError = nil
        faceReplaceEnabled = false
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
