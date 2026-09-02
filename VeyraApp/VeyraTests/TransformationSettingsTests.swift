import XCTest
@testable import Veyra

final class TransformationSettingsTests: XCTestCase {

    func testDefaultFaceSettingsHaveNoModifications() {
        let settings = FaceTransformSettings()
        XCTAssertFalse(settings.hasModifications)
    }

    func testFaceSettingsDetectModifications() {
        var settings = FaceTransformSettings()
        settings.faceWidth = 1.3
        XCTAssertTrue(settings.hasModifications)
    }

    func testFaceSettingsReset() {
        var settings = FaceTransformSettings()
        settings.eyeSize = 1.4
        settings.cheekWidth = 0.8
        XCTAssertTrue(settings.hasModifications)

        settings = FaceTransformSettings()
        XCTAssertFalse(settings.hasModifications)
    }

    func testDefaultBodySettingsHaveNoModifications() {
        let settings = BodyTransformSettings()
        XCTAssertFalse(settings.hasModifications)
    }

    func testBodySettingsDetectModifications() {
        var settings = BodyTransformSettings()
        settings.shoulderWidth = 1.2
        XCTAssertTrue(settings.hasModifications)
    }

    func testFaceSettingsCodableRoundTrip() throws {
        var settings = FaceTransformSettings()
        settings.faceWidth = 1.25
        settings.mouthSize = 0.75
        settings.noseHeight = 1.1

        let data = try JSONEncoder().encode(settings)
        let decoded = try JSONDecoder().decode(FaceTransformSettings.self, from: data)

        XCTAssertEqual(decoded.faceWidth, 1.25)
        XCTAssertEqual(decoded.mouthSize, 0.75)
        XCTAssertEqual(decoded.noseHeight, 1.1)
    }

    func testBodySettingsCodableRoundTrip() throws {
        var settings = BodyTransformSettings()
        settings.shoulderWidth = 1.3
        settings.waist = 0.8

        let data = try JSONEncoder().encode(settings)
        let decoded = try JSONDecoder().decode(BodyTransformSettings.self, from: data)

        XCTAssertEqual(decoded.shoulderWidth, 1.3)
        XCTAssertEqual(decoded.waist, 0.8)
    }
}
