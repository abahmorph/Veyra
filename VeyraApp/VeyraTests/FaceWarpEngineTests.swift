import XCTest
import CoreImage
@testable import Veyra

final class FaceWarpEngineTests: XCTestCase {

    private var engine: FaceWarpEngine!

    override func setUp() {
        super.setUp()
        engine = FaceWarpEngine()
    }

    func testIdentitySettingsPreserveLandmarks() {
        let landmarks = makeTestLandmarks()
        let settings = FaceTransformSettings()

        let result = engine.computeWarpedLandmarks(
            originalLandmarks: landmarks,
            settings: settings,
            imageWidth: 320,
            imageHeight: 480
        )

        XCTAssertEqual(result.count, landmarks.count)
        for (original, warped) in zip(landmarks, result) {
            XCTAssertEqual(original.x, warped.x, accuracy: 0.01)
            XCTAssertEqual(original.y, warped.y, accuracy: 0.01)
        }
    }

    func testFaceWidthModification() {
        let landmarks = makeTestLandmarks()
        var settings = FaceTransformSettings()
        settings.faceWidth = 1.2

        let result = engine.computeWarpedLandmarks(
            originalLandmarks: landmarks,
            settings: settings,
            imageWidth: 320,
            imageHeight: 480
        )

        XCTAssertEqual(result.count, landmarks.count)
        // Landmarks to the left of center should move left, right should move right
        let center = landmarks.average
        let leftLandmark = landmarks.first { $0.x < center.x }!
        let leftIdx = landmarks.firstIndex(of: leftLandmark)!
        XCTAssertLessThan(result[leftIdx].x, leftLandmark.x, "Left landmark should move further left")
    }

    func testNoLandmarksReturnsEmpty() {
        var settings = FaceTransformSettings()
        settings.faceWidth = 1.5

        let result = engine.computeWarpedLandmarks(
            originalLandmarks: [],
            settings: settings,
            imageWidth: 320,
            imageHeight: 480
        )

        XCTAssertTrue(result.isEmpty)
    }

    func testWarpImageProducesDifferentSizes() {
        // Create a solid color CIImage
        let color = CIImage(color: .red).cropped(to: CGRect(x: 0, y: 0, width: 320, height: 480))
        let landmarks = makeTestLandmarks()
        var settings = FaceTransformSettings()
        settings.faceWidth = 1.3
        settings.faceHeight = 1.2

        let warped = engine.computeWarpedLandmarks(
            originalLandmarks: landmarks,
            settings: settings,
            imageWidth: 320,
            imageHeight: 480
        )

        let result = engine.warpImage(color, sourceLandmarks: landmarks, targetLandmarks: warped)
        XCTAssertEqual(result.extent.width, color.extent.width, accuracy: 1.0)
        XCTAssertEqual(result.extent.height, color.extent.height, accuracy: 1.0)
    }

    private func makeTestLandmarks() -> [CGPoint] {
        // Landmarks in a face-like pattern
        return [
            CGPoint(x: 160, y: 140),  // nose tip
            CGPoint(x: 160, y: 180),  // nose bottom
            CGPoint(x: 160, y: 280),  // chin
            CGPoint(x: 160, y: 80),   // forehead
            CGPoint(x: 110, y: 150),  // left eye outer
            CGPoint(x: 140, y: 152),  // left eye inner
            CGPoint(x: 180, y: 152),  // right eye inner
            CGPoint(x: 210, y: 150),  // right eye outer
            CGPoint(x: 90, y: 200),   // left cheek
            CGPoint(x: 230, y: 200),  // right cheek
            CGPoint(x: 160, y: 220),  // mouth center
        ]
    }
}
