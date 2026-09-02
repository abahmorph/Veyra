import Foundation
import CoreGraphics
import CoreImage

public struct BodyWarpEngine {
    
    public init() {}
    
    public func applyBodyTransform(
        to image: CIImage,
        segmentationMask: CVPixelBuffer?,
        settings: BodyTransformSettings,
        faceData: FaceLandmarkData?
    ) -> CIImage {
        guard settings.hasModifications, let mask = segmentationMask else { return image }
        
        let extent = image.extent
        let maskImage = CIImage(cvPixelBuffer: mask).scale(to: extent.size)
        
        // Create body region from segmentation mask
        guard let bodyRegion = createBodyRegion(mask: maskImage, extent: extent) else { return image }
        
        // Compute body transformation
        var transformed = image
        
        // Apply shoulder width
        if settings.shoulderWidth != 1.0 {
            transformed = applyHorizontalWarp(
                to: transformed,
                region: bodyRegion,
                center: CGPoint(x: extent.midX, y: extent.height * 0.3),
                scale: CGFloat(settings.shoulderWidth),
                radius: extent.width * 0.4,
                extent: extent
            )
        }
        
        // Apply torso width
        if settings.torsoWidth != 1.0 {
            transformed = applyHorizontalWarp(
                to: transformed,
                region: bodyRegion,
                center: CGPoint(x: extent.midX, y: extent.height * 0.5),
                scale: CGFloat(settings.torsoWidth),
                radius: extent.width * 0.35,
                extent: extent
            )
        }
        
        // Apply waist
        if settings.waist != 1.0 {
            transformed = applyHorizontalWarp(
                to: transformed,
                region: bodyRegion,
                center: CGPoint(x: extent.midX, y: extent.height * 0.65),
                scale: CGFloat(settings.waist),
                radius: extent.width * 0.25,
                extent: extent
            )
        }
        
        // Apply hip width
        if settings.hipWidth != 1.0 {
            transformed = applyHorizontalWarp(
                to: transformed,
                region: bodyRegion,
                center: CGPoint(x: extent.midX, y: extent.height * 0.75),
                scale: CGFloat(settings.hipWidth),
                radius: extent.width * 0.35,
                extent: extent
            )
        }
        
        // Apply overall body scaling
        if settings.overallBody != 1.0 {
            transformed = applyVerticalWarp(
                to: transformed,
                region: bodyRegion,
                center: CGPoint(x: extent.midX, y: extent.height * 0.5),
                scale: CGFloat(settings.overallBody),
                extent: extent
            )
        }
        
        return transformed
    }
    
    private func createBodyRegion(mask: CIImage, extent: CGRect) -> CIImage? {
        guard let blendFilter = CIFilter(name: "CIBlendWithMask") else { return nil }
        blendFilter.setValue(
            CIImage(color: CIColor(red: 1, green: 1, blue: 1, alpha: 1)).cropped(to: extent),
            forKey: kCIInputImageKey
        )
        blendFilter.setValue(
            CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 1)).cropped(to: extent),
            forKey: kCIInputBackgroundImageKey
        )
        blendFilter.setValue(mask, forKey: kCIInputMaskImageKey)
        return blendFilter.outputImage
    }
    
    private func applyHorizontalWarp(
        to image: CIImage,
        region: CIImage,
        center: CGPoint,
        scale: CGFloat,
        radius: CGFloat,
        extent: CGRect
    ) -> CIImage {
        guard scale != 1.0, let displacementFilter = CIFilter(name: "CIDisplacementDistortion") else { return image }
        
        // Displacement-based warp: shift pixels horizontally based on distance from center
        displacementFilter.setValue(image, forKey: kCIInputImageKey)
        displacementFilter.setValue(region, forKey: kCIInputDisplacementImageKey)
        
        let strength = (scale - 1.0) * 20.0
        displacementFilter.setValue(strength, forKey: kCIInputScaleKey)
        
        return displacementFilter.outputImage ?? image
    }
    
    private func applyVerticalWarp(
        to image: CIImage,
        region: CIImage,
        center: CGPoint,
        scale: CGFloat,
        extent: CGRect
    ) -> CIImage {
        guard scale != 1.0, let displacementFilter = CIFilter(name: "CIDisplacementDistortion") else { return image }
        
        displacementFilter.setValue(image, forKey: kCIInputImageKey)
        displacementFilter.setValue(region, forKey: kCIInputDisplacementImageKey)
        
        let strength = (scale - 1.0) * 15.0
        displacementFilter.setValue(strength, forKey: kCIInputScaleKey)
        
        return displacementFilter.outputImage ?? image
    }
    
    public func extractBodyLandmarks(
        from pixelBuffer: CVPixelBuffer,
        faceData: FaceLandmarkData?
    ) -> BodyLandmarkData {
        guard let face = faceData else {
            return BodyLandmarkData()
        }
        
        let faceWidth = face.boundingBox.width
        let faceHeight = face.boundingBox.height
        
        // Estimate body proportions from face position
        let shoulderWidth = faceWidth * 3.5
        let torsoHeight = faceHeight * 4.0
        let shoulderCenter = CGPoint(
            x: face.boundingBox.midX,
            y: face.boundingBox.maxY + faceHeight * 1.5
        )
        let hipCenter = CGPoint(
            x: face.boundingBox.midX,
            y: face.boundingBox.maxY + torsoHeight
        )
        
        return BodyLandmarkData(
            torsoLandmarks: [shoulderCenter, hipCenter],
            shoulderCenter: shoulderCenter,
            hipCenter: hipCenter,
            shoulderWidth: shoulderWidth,
            torsoHeight: torsoHeight,
            confidence: face.confidence,
            timestamp: CFAbsoluteTimeGetCurrent()
        )
    }
}

extension CIImage {
    func scale(to size: CGSize) -> CIImage {
        let scaleX = size.width / extent.width
        let scaleY = size.height / extent.height
        return self.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))
    }
}
