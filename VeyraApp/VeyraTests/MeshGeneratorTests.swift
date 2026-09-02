import XCTest
@testable import Veyra

final class MeshGeneratorTests: XCTestCase {

    func testTriangulateDesktopLandmarks() {
        let source = makeTestLandmarks()
        let target = makeTestLandmarks()

        let triangles = MeshGenerator.triangulateKeyLandmarks(source: source, target: target)
        XCTAssertFalse(triangles.isEmpty, "Triangulation should produce triangles")
        XCTAssertGreaterThanOrEqual(triangles.count, 1, "Should have at least one triangle")
    }

    func testTriangulateWithMovedTargets() {
        let source = makeTestLandmarks()
        // Shift target points right
        let target = source.map { CGPoint(x: $0.x + 20, y: $0.y) }

        let triangles = MeshGenerator.triangulateKeyLandmarks(source: source, target: target)
        XCTAssertFalse(triangles.isEmpty, "Triangulation should succeed even with displaced points")
    }

    func testTriangulateWithFewerThanThreePoints() {
        let points: [CGPoint] = [CGPoint(x: 0, y: 0), CGPoint(x: 10, y: 0)]
        let triangles = MeshGenerator.triangulateKeyLandmarks(source: points, target: points)
        XCTAssertTrue(triangles.isEmpty, "Should return empty for < 3 points")
    }

    func testTriangleCountIsReasonable() {
        let points = makeTestLandmarks()
        let triangles = MeshGenerator.triangulateKeyLandmarks(source: points, target: points)
        // For N points, a Delaunay triangulation of a convex region roughly has 2N-5 triangles
        XCTAssertLessThanOrEqual(triangles.count, points.count * 3, "Triangle count should be reasonable")
    }

    private func makeTestLandmarks() -> [CGPoint] {
        // A spread of points forming a rough face outline
        return [
            CGPoint(x: 100, y: 100),  // nose tip
            CGPoint(x: 110, y: 130),  // between eyes
            CGPoint(x: 105, y: 160),  // nose bottom
            CGPoint(x: 100, y: 200),  // chin
            CGPoint(x: 100, y: 60),   // forehead
            CGPoint(x: 60, y: 110),   // left eye outer
            CGPoint(x: 85, y: 112),   // left eye inner
            CGPoint(x: 115, y: 112),  // right eye inner
            CGPoint(x: 140, y: 110),  // right eye outer
            CGPoint(x: 50, y: 150),   // left cheek
            CGPoint(x: 150, y: 150),  // right cheek
        ]
    }
}
