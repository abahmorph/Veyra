//
//  VeyraTests.swift
//  VeyraTests
//

import XCTest
import CoreImage
@testable import Veyra

final class FaceReplaceEngineTests: XCTestCase {

    private func makeReference() -> ReferenceFace {
        let patch = CIImage(color: .red).cropped(to: CGRect(x: 0, y: 0, width: 100, height: 100))
        let landmarks = [
            CGPoint(x: 30, y: 30),
            CGPoint(x: 70, y: 30),
            CGPoint(x: 70, y: 70),
            CGPoint(x: 30, y: 70)
        ]
        return ReferenceFace(patch: patch, landmarks: landmarks, patchRect: patch.extent)
    }

    func testReplaceFacePreservesExtent() {
        let engine = FaceReplaceEngine()
        let image = CIImage(color: .blue).cropped(to: CGRect(x: 0, y: 0, width: 320, height: 480))
        let live = [
            CGPoint(x: 120, y: 150),
            CGPoint(x: 200, y: 150),
            CGPoint(x: 200, y: 260),
            CGPoint(x: 120, y: 260)
        ]

        let result = engine.replaceFace(in: image, liveLandmarks: live, reference: makeReference(), blend: 1.0)

        XCTAssertEqual(result.extent.width, image.extent.width, accuracy: 1.0)
        XCTAssertEqual(result.extent.height, image.extent.height, accuracy: 1.0)
    }

    func testZeroBlendReturnsOriginal() {
        let engine = FaceReplaceEngine()
        let image = CIImage(color: .blue).cropped(to: CGRect(x: 0, y: 0, width: 320, height: 480))
        let live = [
            CGPoint(x: 120, y: 150),
            CGPoint(x: 200, y: 150),
            CGPoint(x: 160, y: 260)
        ]

        let result = engine.replaceFace(in: image, liveLandmarks: live, reference: makeReference(), blend: 0.0)

        XCTAssertEqual(result.extent, image.extent)
    }

    func testConvexHullDropsInteriorPoint() {
        let points = [
            CGPoint(x: 0, y: 0),
            CGPoint(x: 10, y: 0),
            CGPoint(x: 10, y: 10),
            CGPoint(x: 0, y: 10),
            CGPoint(x: 5, y: 5)
        ]

        let hull = FaceReplaceEngine.convexHull(points)

        XCTAssertEqual(hull.count, 4)
        XCTAssertFalse(hull.contains(CGPoint(x: 5, y: 5)))
    }
}

final class VeyraTests: XCTestCase {

    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.
    }

    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }

    func testExample() throws {
        // This is a basic test to verify the test target runs
        XCTAssertTrue(true)
    }
}
