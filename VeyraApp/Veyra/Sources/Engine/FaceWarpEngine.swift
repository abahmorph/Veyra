import Foundation
import CoreGraphics
import CoreImage
import Vision

public struct FaceWarpEngine {

    private let ciContext = CIContext(options: [.cacheIntermediates: false])

    public init() {}

    // MARK: - Landmark Coordinate Computation

    /// Computes the warped (transformed) landmark positions in pixel coordinates.
    public func computeWarpedLandmarks(
        originalLandmarks: [CGPoint],
        settings: FaceTransformSettings,
        imageWidth: CGFloat,
        imageHeight: CGFloat
    ) -> [CGPoint] {
        guard originalLandmarks.count >= 3 else { return originalLandmarks }

        var warped = originalLandmarks
        let faceCenter = computeFaceCenter(landmarks: originalLandmarks)

        // Face width scaling about the face center.
        if settings.faceWidth != 1.0 {
            for i in warped.indices {
                let dx = warped[i].x - faceCenter.x
                warped[i].x = faceCenter.x + dx * CGFloat(settings.faceWidth)
            }
        }

        // Face height scaling about the face center.
        if settings.faceHeight != 1.0 {
            for i in warped.indices {
                let dy = warped[i].y - faceCenter.y
                warped[i].y = faceCenter.y + dy * CGFloat(settings.faceHeight)
            }
        }

        // Jaw width: widen/narrow the lower face region.
        if settings.jawWidth != 1.0 {
            let jawCenter = findJawCenter(landmarks: originalLandmarks, faceCenter: faceCenter)
            for i in warped.indices {
                if warped[i].y > jawCenter.y {
                    let dx = warped[i].x - jawCenter.x
                    warped[i].x = jawCenter.x + dx * CGFloat(settings.jawWidth)
                }
            }
        }

        // Jaw shape: expands/contracts around the jaw center axis.
        if settings.jawShape != 1.0 {
            let jawCenter = findJawCenter(landmarks: originalLandmarks, faceCenter: faceCenter)
            for i in warped.indices {
                let dy = warped[i].y - jawCenter.y
                if dy > 0 {
                    let dx = warped[i].x - jawCenter.x
                    let influence = min(1.0, dy / (max(jawCenter.y, 1) * 0.6))
                    warped[i].x = jawCenter.x + dx * (1.0 + CGFloat(settings.jawShape - 1.0) * influence)
                }
            }
        }

        // Chin: push/pull the bottom of the face.
        if settings.chin != 1.0 {
            let chinPoint = findChinPoint(landmarks: originalLandmarks, faceCenter: faceCenter)
            for i in warped.indices {
                let distToChin = warped[i].y - chinPoint.y
                if distToChin > 0 {
                    warped[i].y = chinPoint.y + distToChin * CGFloat(settings.chin)
                }
            }
        }

        // Cheek width: widen/narrow cheeks region.
        if settings.cheekWidth != 1.0 {
            let cheekY = faceCenter.y * 0.95
            for i in warped.indices {
                let influence = max(0.0, 1.0 - abs(warped[i].y - cheekY) / (faceCenter.y * 0.5))
                if influence > 0.1 {
                    let dx = warped[i].x - faceCenter.x
                    warped[i].x = faceCenter.x + dx * (1.0 + (CGFloat(settings.cheekWidth) - 1.0) * influence)
                }
            }
        }

        // Eye size: scale landmarks around each eye center.
        if settings.eyeSize != 1.0 {
            applyEyeTransform(to: &warped, settings: settings, transform: .size)
        }

        // Eye spacing: spread/squeeze eyes about the midpoint.
        if settings.eyeSpacing != 1.0 {
            applyEyeTransform(to: &warped, settings: settings, transform: .spacing)
        }

        // Nose width: widen/narrow nose region.
        if settings.noseWidth != 1.0 {
            applyNoseTransform(to: &warped, settings: settings, axis: .width)
        }

        // Nose height: lengthen/shorten nose.
        if settings.noseHeight != 1.0 {
            applyNoseTransform(to: &warped, settings: settings, axis: .height)
        }

        // Mouth size: scale landmarks about the mouth center.
        if settings.mouthSize != 1.0 {
            applyMouthTransform(to: &warped, settings: settings)
        }

        return warped
    }

    // MARK: - Image Warping

    public func warpImage(
        _ source: CIImage,
        sourceLandmarks: [CGPoint],
        targetLandmarks: [CGPoint]
    ) -> CIImage {
        return warpImage(
            source,
            sourceLandmarks: sourceLandmarks,
            targetLandmarks: targetLandmarks,
            outputSize: source.extent.size,
            drawBase: true
        )
    }

    /// Warps `source` through the triangle mesh that maps `sourceLandmarks` to
    /// `targetLandmarks`, into an output of `outputSize`. When `drawBase` is
    /// false only the warped triangles are drawn (used when the result is later
    /// composited through a mask, e.g. face replacement).
    public func warpImage(
        _ source: CIImage,
        sourceLandmarks: [CGPoint],
        targetLandmarks: [CGPoint],
        outputSize: CGSize,
        drawBase: Bool
    ) -> CIImage {
        let triangles = MeshGenerator.triangulateKeyLandmarks(source: sourceLandmarks, target: targetLandmarks)
        guard !triangles.isEmpty else { return source }

        return applyWarp(source: source, triangles: triangles, targetSize: outputSize, drawBase: drawBase)
    }

    // MARK: - Feature-Specific Helpers

    private enum EyeTransform {
        case size
        case spacing
    }

    private enum NoseAxis {
        case width
        case height
    }

    private func applyEyeTransform(to warped: inout [CGPoint], settings: FaceTransformSettings, transform: EyeTransform) {
        guard warped.count >= 3 else { return }

        // Approximate horizontal thirds of the face for left/right eye regions.
        let faceCenter = computeFaceCenter(landmarks: warped)
        let leftEyeCenter = CGPoint(x: faceCenter.x * 0.72, y: faceCenter.y * 0.72)
        let rightEyeCenter = CGPoint(x: faceCenter.x * 1.28, y: faceCenter.y * 0.72)

        let leftDist = hypot(leftEyeCenter.x - faceCenter.x, leftEyeCenter.y - faceCenter.y)
        let rightDist = hypot(rightEyeCenter.x - faceCenter.x, rightEyeCenter.y - faceCenter.y)
        let eyeRadius = max(leftDist, rightDist) * 1.2

        for i in warped.indices {
            let pt = warped[i]

            // Using distance in normalized-ish space; the region is a fraction of the image
            let dl = hypot(pt.x - leftEyeCenter.x, pt.y - leftEyeCenter.y)
            let dr = hypot(pt.x - rightEyeCenter.x, pt.y - rightEyeCenter.y)

            switch transform {
            case .size:
                let scale = CGFloat(settings.eyeSize)
                if dl < eyeRadius && dl < dr {
                    let dx = pt.x - leftEyeCenter.x
                    let dy = pt.y - leftEyeCenter.y
                    warped[i].x = leftEyeCenter.x + dx * scale
                    warped[i].y = leftEyeCenter.y + dy * scale
                } else if dr < eyeRadius {
                    let dx = pt.x - rightEyeCenter.x
                    let dy = pt.y - rightEyeCenter.y
                    warped[i].x = rightEyeCenter.x + dx * scale
                    warped[i].y = rightEyeCenter.y + dy * scale
                }
            case .spacing:
                // Pivot around midpoint between eyes
                let eyeMid = (leftEyeCenter.x + rightEyeCenter.x) / 2
                let dx = pt.x - eyeMid
                warped[i].x = eyeMid + dx * CGFloat(settings.eyeSpacing)
            }
        }
    }

    private func applyNoseTransform(to warped: inout [CGPoint], settings: FaceTransformSettings, axis: NoseAxis) {
        guard warped.count >= 3 else { return }
        let faceCenter = computeFaceCenter(landmarks: warped)
        // Nose is roughly at the vertical center of the face
        let noseCenter = CGPoint(x: faceCenter.x, y: faceCenter.y * 1.02)
        let noseRadius = faceCenter.y * 0.25

        for i in warped.indices {
            let pt = warped[i]
            let dist = hypot(pt.x - noseCenter.x, pt.y - noseCenter.y)
            guard dist < noseRadius else { continue }

            switch axis {
            case .width:
                let dx = pt.x - noseCenter.x
                warped[i].x = noseCenter.x + dx * CGFloat(settings.noseWidth)
            case .height:
                let dy = pt.y - noseCenter.y
                warped[i].y = noseCenter.y + dy * CGFloat(settings.noseHeight)
            }
        }
    }

    private func applyMouthTransform(to warped: inout [CGPoint], settings: FaceTransformSettings) {
        guard warped.count >= 3 else { return }
        let faceCenter = computeFaceCenter(landmarks: warped)
        // Mouth is below the nose, roughly at 70% of face height
        let mouthCenter = CGPoint(x: faceCenter.x, y: faceCenter.y * 1.18)
        let mouthRadius = faceCenter.y * 0.25

        for i in warped.indices {
            let pt = warped[i]
            let dist = hypot(pt.x - mouthCenter.x, pt.y - mouthCenter.y)
            if dist < mouthRadius {
                let dx = pt.x - mouthCenter.x
                let dy = pt.y - mouthCenter.y
                warped[i].x = mouthCenter.x + dx * CGFloat(settings.mouthSize)
                warped[i].y = mouthCenter.y + dy * CGFloat(settings.mouthSize)
            }
        }
    }

    private func computeFaceCenter(landmarks: [CGPoint]) -> CGPoint {
        landmarks.average
    }

    private func findJawCenter(landmarks: [CGPoint], faceCenter: CGPoint) -> CGPoint {
        var maxY: CGFloat = -CGFloat.greatestFiniteMagnitude
        for pt in landmarks where pt.y > maxY {
            maxY = pt.y
        }
        return CGPoint(x: faceCenter.x, y: faceCenter.y + (maxY - faceCenter.y) * 0.6)
    }

    private func findChinPoint(landmarks: [CGPoint], faceCenter: CGPoint) -> CGPoint {
        var maxY: CGFloat = -CGFloat.greatestFiniteMagnitude
        var chin = faceCenter
        for pt in landmarks {
            if pt.y > maxY {
                maxY = pt.y
                chin = pt
            }
        }
        return chin
    }

    // MARK: - Affine Transform per Triangle

    private func applyWarp(source: CIImage, triangles: [Triangle], targetSize: CGSize, drawBase: Bool = true) -> CIImage {
        guard let context = CGContext(
            data: nil,
            width: Int(targetSize.width),
            height: Int(targetSize.height),
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return source }

        guard let cgImage = ciContext.createCGImage(source, from: source.extent) else { return source }

        context.clear(CGRect(origin: .zero, size: targetSize))

        // Draw the untouched frame first so regions outside the face mesh are
        // preserved instead of dropping to transparent.
        if drawBase {
            context.saveGState()
            context.translateBy(x: 0, y: targetSize.height)
            context.scaleBy(x: 1.0, y: -1.0)
            context.draw(cgImage, in: CGRect(origin: .zero, size: targetSize))
            context.restoreGState()
        }

        for triangle in triangles {
            guard triangle.src.count >= 3, triangle.dst.count >= 3 else { continue }

            context.saveGState()
            context.beginPath()
            context.move(to: triangle.dst[0])
            context.addLine(to: triangle.dst[1])
            context.addLine(to: triangle.dst[2])
            context.closePath()
            context.clip()

            let affine = computeAffineTransform(from: triangle.src, to: triangle.dst)
            context.concatenate(affine)
            context.translateBy(x: 0, y: targetSize.height)
            context.scaleBy(x: 1.0, y: -1.0)
            context.draw(cgImage, in: CGRect(origin: .zero, size: targetSize))
            context.restoreGState()
        }

        guard let warpedCGImage = context.makeImage() else { return source }
        return CIImage(cgImage: warpedCGImage)
    }

    private func computeAffineTransform(from src: [CGPoint], to dst: [CGPoint]) -> CGAffineTransform {
        let x1 = src[0].x, y1 = src[0].y
        let x2 = src[1].x, y2 = src[1].y
        let x3 = src[2].x, y3 = src[2].y

        let u1 = dst[0].x, v1 = dst[0].y
        let u2 = dst[1].x, v2 = dst[1].y
        let u3 = dst[2].x, v3 = dst[2].y

        let det = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)
        guard abs(det) > 1e-6 else { return .identity }

        let a = (u1 * (y2 - y3) + u2 * (y3 - y1) + u3 * (y1 - y2)) / det
        let b = (v1 * (y2 - y3) + v2 * (y3 - y1) + v3 * (y1 - y2)) / det
        let c = (x1 * (u2 - u3) + x2 * (u3 - u1) + x3 * (u1 - u2)) / det
        let d = (x1 * (v2 - v3) + x2 * (v3 - v1) + x3 * (v1 - v2)) / det
        let tx = (x1 * (y2 * u3 - y3 * u2) + x2 * (y3 * u1 - y1 * u3) + x3 * (y1 * u2 - y2 * u1)) / det
        let ty = (x1 * (y2 * v3 - y3 * v2) + x2 * (y3 * v1 - y1 * v3) + x3 * (y1 * v2 - y2 * v1)) / det

        return CGAffineTransform(a: a, b: b, c: c, d: d, tx: tx, ty: ty)
    }
}

// MARK: - Reference Face Replacement

/// A prepared reference face: a cropped patch of a reference photo together
/// with its detected landmarks expressed in the patch's own pixel space.
public struct ReferenceFace: @unchecked Sendable {
    public let patch: CIImage
    /// Landmark points in patch pixel coordinates (origin lower-left).
    public let landmarks: [CGPoint]
    /// The patch rectangle within the original reference image.
    public let patchRect: CGRect

    public init(patch: CIImage, landmarks: [CGPoint], patchRect: CGRect) {
        self.patch = patch
        self.landmarks = landmarks
        self.patchRect = patchRect
    }
}

/// Replaces the live face with a reference photo's face using a real geometric
/// pipeline: the reference patch is warped onto the live face's landmark mesh
/// and composited through a feathered face-region mask. This is a classical
/// alignment/warp swap (no generative model).
public struct FaceReplaceEngine {

    private let ciContext = CIContext(options: [.cacheIntermediates: false])
    private let warpEngine = FaceWarpEngine()

    public init() {}

    /// Detects the most prominent face in `image` and prepares it as a
    /// reference. Returns nil when no usable face is found.
    public func prepareReferenceFace(from image: CIImage, padding: CGFloat = 0.35) -> ReferenceFace? {
        let extent = image.extent
        guard extent.width >= 1, extent.height >= 1 else { return nil }
        guard let cgImage = ciContext.createCGImage(image, from: extent) else { return nil }

        let request = VNDetectFaceLandmarksRequest()
        request.revision = VNDetectFaceLandmarksRequestRevision3
        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return nil
        }
        guard let face = request.results?.first,
              let allPoints = face.landmarks?.allPoints else { return nil }

        // Vision face-landmark points are normalized to the *face bounding box*;
        // combine with the bounding box to obtain image pixel coordinates.
        let bb = face.boundingBox
        let imagePoints = allPoints.normalizedPoints.map { point -> CGPoint in
            CGPoint(x: (CGFloat(point.x) * bb.width + bb.minX) * extent.width,
                    y: (CGFloat(point.y) * bb.height + bb.minY) * extent.height)
        }
        guard imagePoints.count >= 3 else { return nil }

        let faceRect = CGRect(x: bb.minX * extent.width,
                              y: bb.minY * extent.height,
                              width: bb.width * extent.width,
                              height: bb.height * extent.height)
        var crop = faceRect.insetBy(dx: -faceRect.width * padding, dy: -faceRect.height * padding)
        crop = crop.intersection(extent)
        guard crop.width >= 1, crop.height >= 1 else { return nil }

        let patch = image.cropped(to: crop)
        let patchPoints = imagePoints.map { CGPoint(x: $0.x - crop.minX, y: $0.y - crop.minY) }
        return ReferenceFace(patch: patch, landmarks: patchPoints, patchRect: crop)
    }

    /// Warps the reference face onto the live face geometry and composites it
    /// over `image` using a feathered mask. `blend` is 0...1.
    public func replaceFace(
        in image: CIImage,
        liveLandmarks: [CGPoint],
        reference: ReferenceFace,
        blend: Double
    ) -> CIImage {
        guard blend > 0.001, liveLandmarks.count >= 3, reference.landmarks.count >= 3 else { return image }
        let count = min(liveLandmarks.count, reference.landmarks.count)
        let src = Array(reference.landmarks[0..<count])
        let dst = Array(liveLandmarks[0..<count])
        let extent = image.extent

        let warped = warpEngine.warpImage(
            reference.patch,
            sourceLandmarks: src,
            targetLandmarks: dst,
            outputSize: extent.size,
            drawBase: false
        )

        let spread = max(dst.map { $0.x }.max()! - dst.map { $0.x }.min()!,
                         dst.map { $0.y }.max()! - dst.map { $0.y }.min()!)
        guard let mask = makeFaceMask(points: dst, extent: extent, blurRadius: max(spread, 20) * 0.06, blend: CGFloat(blend)) else {
            return image
        }

        // Composite the warped patch over the original first so any transparent
        // triangles fall back to the live frame instead of punching a hole, then
        // feather-blend the full-coverage result through the face mask.
        let foreground = warped.composited(over: image)
        let blended = foreground.applyingFilter("CIBlendWithMask", parameters: [
            kCIInputBackgroundImageKey: image,
            kCIInputMaskImageKey: mask
        ])
        return blended.cropped(to: extent)
    }

    // MARK: - Mask

    private func makeFaceMask(points: [CGPoint], extent: CGRect, blurRadius: CGFloat, blend: CGFloat) -> CIImage? {
        let hull = FaceReplaceEngine.convexHull(points)
        guard hull.count >= 3 else { return nil }
        guard let context = CGContext(
            data: nil,
            width: Int(extent.width),
            height: Int(extent.height),
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }

        // Expand the hull slightly beyond the landmark extent so the whole face
        // (including hairline and jaw edges) is covered.
        let center = hull.average
        let expanded = hull.map { CGPoint(x: center.x + ($0.x - center.x) * 1.12,
                                          y: center.y + ($0.y - center.y) * 1.12) }

        context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
        context.beginPath()
        context.move(to: expanded[0])
        for point in expanded.dropFirst() {
            context.addLine(to: point)
        }
        context.closePath()
        context.fillPath()

        guard let cgImage = context.makeImage() else { return nil }
        var mask = CIImage(cgImage: cgImage)
        if blurRadius > 0.5 {
            mask = mask
                .clampedToExtent()
                .applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: blurRadius])
                .cropped(to: extent)
        }
        return mask.applyingFilter("CIColorMatrix", parameters: [
            "inputRVector": CIVector(x: blend, y: 0, z: 0, w: 0),
            "inputGVector": CIVector(x: 0, y: blend, z: 0, w: 0),
            "inputBVector": CIVector(x: 0, y: 0, z: blend, w: 0),
            "inputAVector": CIVector(x: 0, y: 0, z: 0, w: blend)
        ])
    }

    /// Andrew's monotone-chain convex hull.
    static func convexHull(_ points: [CGPoint]) -> [CGPoint] {
        guard points.count >= 3 else { return points }
        let sorted = points.sorted { $0.x == $1.x ? $0.y < $1.y : $0.x < $1.x }

        func cross(_ o: CGPoint, _ a: CGPoint, _ b: CGPoint) -> CGFloat {
            (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
        }

        var lower: [CGPoint] = []
        for point in sorted {
            while lower.count >= 2 && cross(lower[lower.count - 2], lower[lower.count - 1], point) <= 0 {
                lower.removeLast()
            }
            lower.append(point)
        }

        var upper: [CGPoint] = []
        for point in sorted.reversed() {
            while upper.count >= 2 && cross(upper[upper.count - 2], upper[upper.count - 1], point) <= 0 {
                upper.removeLast()
            }
            upper.append(point)
        }

        lower.removeLast()
        upper.removeLast()
        return lower + upper
    }
}
