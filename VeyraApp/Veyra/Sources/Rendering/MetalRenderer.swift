import Foundation
import Metal
import MetalKit
import CoreImage

public actor MetalRenderer {
    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue?
    private let ciContext: CIContext
    
    public init?(device: MTLDevice? = nil) {
        guard let dev = device ?? MTLCreateSystemDefaultDevice() else { return nil }
        self.device = dev
        self.commandQueue = dev.makeCommandQueue()
        self.ciContext = CIContext(mtlDevice: dev, options: [.workingColorSpace: CGColorSpaceCreateDeviceRGB()])
    }
    
    public func render(_ image: CIImage, to pixelBuffer: CVPixelBuffer) {
        let drawableSize = CGSize(
            width: CVPixelBufferGetWidth(pixelBuffer),
            height: CVPixelBufferGetHeight(pixelBuffer)
        )

        // Flip vertically (Core Image uses bottom-left origin)
        // and scale to the target pixel buffer size.
        let scaledImage = image
            .transformed(by: CGAffineTransform(scaleX: drawableSize.width / image.extent.width,
                                               y: drawableSize.height / image.extent.height))
            .transformed(by: CGAffineTransform(scaleX: 1, y: -1)
                .translatedBy(x: 0, y: -drawableSize.height))

        ciContext.render(scaledImage, to: pixelBuffer)
    }
    
    public func renderToTexture(_ image: CIImage, width: Int, height: Int) -> MTLTexture? {
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .bgra8Unorm,
            width: width,
            height: height,
            mipmapped: false
        )
        descriptor.usage = [.shaderRead, .shaderWrite, .renderTarget]
        
        guard let texture = device.makeTexture(descriptor: descriptor) else { return nil }
        
        ciContext.render(
            image.transformed(by: CGAffineTransform(scaleX: CGFloat(width) / image.extent.width, y: CGFloat(height) / image.extent.height)),
            to: texture,
            commandBuffer: nil,
            bounds: CGRect(x: 0, y: 0, width: width, height: height),
            colorSpace: CGColorSpaceCreateDeviceRGB()
        )
        
        return texture
    }
    
    public func applyShaderEffect(_ effect: String, to image: CIImage, time: Double) -> CIImage {
        switch effect {
        case "beauty":
            return applyBeauty(to: image)
        case "cartoon":
            return applyCartoon(to: image)
        case "anime":
            return applyAnime(to: image)
        case "cyberpunk":
            return applyCyberpunk(to: image, time: time)
        case "horror":
            return applyHorror(to: image)
        case "pixel":
            return applyPixel(to: image)
        case "glitch":
            return applyGlitch(to: image, time: time)
        default:
            return image
        }
    }
    
    private func applyBeauty(to image: CIImage) -> CIImage {
        guard let blur = CIFilter(name: "CIGaussianBlur") else { return image }
        blur.setValue(image, forKey: kCIInputImageKey)
        blur.setValue(2.0, forKey: kCIInputRadiusKey)
        guard let blurred = blur.outputImage else { return image }
        
        guard let colorControls = CIFilter(name: "CIColorControls") else { return image }
        colorControls.setValue(blurred, forKey: kCIInputImageKey)
        colorControls.setValue(1.15, forKey: "inputSaturation")
        return colorControls.outputImage ?? image
    }
    
    private func applyCartoon(to image: CIImage) -> CIImage {
        guard let posterize = CIFilter(name: "CIColorPosterize") else { return image }
        posterize.setValue(image, forKey: kCIInputImageKey)
        posterize.setValue(6.0, forKey: "inputLevels")
        return posterize.outputImage ?? image
    }
    
    private func applyAnime(to image: CIImage) -> CIImage {
        guard let posterize = CIFilter(name: "CIColorPosterize") else { return image }
        posterize.setValue(image, forKey: kCIInputImageKey)
        posterize.setValue(4.0, forKey: "inputLevels")
        guard let posterized = posterize.outputImage else { return image }
        
        guard let vibrance = CIFilter(name: "CIVibrance") else { return image }
        vibrance.setValue(posterized, forKey: kCIInputImageKey)
        vibrance.setValue(1.35, forKey: "inputAmount")
        return vibrance.outputImage ?? image
    }
    
    private func applyCyberpunk(to image: CIImage, time: Double) -> CIImage {
        guard let colorControls = CIFilter(name: "CIColorControls") else { return image }
        colorControls.setValue(image, forKey: kCIInputImageKey)
        colorControls.setValue(1.2, forKey: kCIInputContrastKey)
        colorControls.setValue(1.3, forKey: kCIInputSaturationKey)
        return colorControls.outputImage ?? image
    }
    
    private func applyHorror(to image: CIImage) -> CIImage {
        guard let colorControls = CIFilter(name: "CIColorControls") else { return image }
        colorControls.setValue(image, forKey: kCIInputImageKey)
        colorControls.setValue(0.25, forKey: kCIInputSaturationKey)
        colorControls.setValue(-0.1, forKey: kCIInputBrightnessKey)
        guard let desaturated = colorControls.outputImage else { return image }
        
        guard let vignette = CIFilter(name: "CIVignette") else { return image }
        vignette.setValue(desaturated, forKey: kCIInputImageKey)
        vignette.setValue(0.55, forKey: "inputIntensity")
        return vignette.outputImage ?? image
    }
    
    private func applyPixel(to image: CIImage) -> CIImage {
        guard let pixelate = CIFilter(name: "CIPixellate") else { return image }
        pixelate.setValue(image, forKey: kCIInputImageKey)
        pixelate.setValue(90.0, forKey: kCIInputScaleKey)
        return pixelate.outputImage ?? image
    }
    
    private func applyGlitch(to image: CIImage, time: Double) -> CIImage {
        guard let colorControls = CIFilter(name: "CIColorControls") else { return image }
        colorControls.setValue(image, forKey: kCIInputImageKey)
        colorControls.setValue(1.1, forKey: kCIInputContrastKey)
        return colorControls.outputImage ?? image
    }
}
