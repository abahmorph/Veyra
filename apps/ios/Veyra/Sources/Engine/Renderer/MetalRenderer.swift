import Foundation
import Metal
import MetalKit
import CoreImage

public actor MetalRenderer {
    private let device: MTLDevice
    private var commandQueue: MTLCommandQueue?
    private var library: MTLLibrary?
    private var pipelineState: MTLRenderPipelineState?

    public init(device: MTLDevice) {
        self.device = device
        commandQueue = device.makeCommandQueue()
        library = try? device.makeDefaultLibrary()

        if let library = library,
           let vertexFunction = library.makeFunction(name: "vertexPassthrough"),
           let fragmentFunction = library.makeFunction(name: "fragmentPassthrough") {
            let descriptor = MTLRenderPipelineDescriptor()
            descriptor.vertexFunction = vertexFunction
            descriptor.fragmentFunction = fragmentFunction
            descriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
            pipelineState = try? device.makeRenderPipelineState(descriptor: descriptor)
        }
    }

    public func applyShader(_ effect: ShaderEffect, to image: CIImage, time: Double) -> CIImage {
        var output = image

        switch effect {
        case .beauty:
            output = applyBeautyFilter(to: output)
        case .cartoon:
            output = applyCartoonFilter(to: output)
        case .anime:
            output = applyAnimeFilter(to: output)
        case .cyberpunk:
            output = applyCyberpunkFilter(to: output)
        case .fantasy:
            output = applyFantasyFilter(to: output)
        case .horror:
            output = applyHorrorFilter(to: output)
        case .pixel:
            output = applyPixelFilter(to: output)
        case .glitch:
            output = applyGlitchFilter(to: output)
        default:
            break
        }

        return output
    }

    private func applyBeautyFilter(to image: CIImage) -> CIImage {
        let blur = CIFilter.gaussianBlur()
        blur.inputImage = image
        blur.radius = 1.5

        let sharpen = CIFilter.ciColorControls()
        sharpen.inputImage = blur.outputImage
        sharpen.saturation = 1.15

        return sharpen.outputImage ?? image
    }

    private func applyCartoonFilter(to image: CIImage) -> CIImage {
        let posterize = CIFilter.colorPosterize()
        posterize.inputImage = image
        posterize.levels = 6

        let edge = CIFilter.edgePreservingUpscaler() // Simplified
        return posterize.outputImage ?? image
    }

    private func applyAnimeFilter(to image: CIImage) -> CIImage {
        let posterize = CIFilter.colorPosterize()
        posterize.inputImage = image
        posterize.levels = 4

        let vibrance = CIFilter.vibrance()
        vibrance.inputImage = posterize.outputImage
        vibrance.amount = 1.35

        return vibrance.outputImage ?? image
    }

    private func applyCyberpunkFilter(to image: CIImage) -> CIImage {
        let colorControls = CIFilter.ciColorControls()
        colorControls.inputImage = image
        colorControls.contrast = 1.2
        colorControls.saturation = 1.3

        let scanlines = CIFilter.linearGradient() // Simplified
        return colorControls.outputImage ?? image
    }

    private func applyFantasyFilter(to image: CIImage) -> CIImage {
        let colorControls = CIFilter.ciColorControls()
        colorControls.inputImage = image
        colorControls.saturation = 1.2

        let exposure = CIFilter.exposureAdjust()
        exposure.inputImage = colorControls.outputImage
        exposure.ev = 0.1

        return exposure.outputImage ?? image
    }

    private func applyHorrorFilter(to image: CIImage) -> CIImage {
        let colorControls = CIFilter.ciColorControls()
        colorControls.inputImage = image
        colorControls.saturation = 0.25
        colorControls.brightness = -0.1

        let vignette = CIFilter.vignette()
        vignette.inputImage = colorControls.outputImage
        vignette.intensity = 0.55

        return vignette.outputImage ?? image
    }

    private func applyPixelFilter(to image: CIImage) -> CIImage {
        let pixelate = CIFilter.pixellate()
        pixelate.inputImage = image
        pixelate.center = CGPoint(x: 0.5, y: 0.5)
        pixelate.scale = 90

        return pixelate.outputImage ?? image
    }

    private func applyGlitchFilter(to image: CIImage) -> CIImage {
        // Simplified glitch effect
        let colorControls = CIFilter.ciColorControls()
        colorControls.inputImage = image
        colorControls.contrast = 1.1

        return colorControls.outputImage ?? image
    }

    public func render(_ image: CIImage, to pixelBuffer: CVPixelBuffer) {
        guard let ciContext else { return }
        ciContext.render(image, to: pixelBuffer)
    }
}
