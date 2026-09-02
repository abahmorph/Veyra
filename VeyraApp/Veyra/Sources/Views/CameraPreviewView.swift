import SwiftUI
import AVFoundation
import MetalKit
import CoreImage

/// A thread-safe holder for the latest transformed frame so the Metal view
/// render delegate (which runs on a background render thread) can read it
/// without tripping Swift 6 strict-concurrency checks against the MainActor engine.
final class PreviewFrameStore: @unchecked Sendable {
    private let lock = NSLock()
    private var image: CIImage?

    func update(_ newImage: CIImage?) {
        lock.lock()
        image = newImage
        lock.unlock()
    }

    func current() -> CIImage? {
        lock.lock()
        defer { lock.unlock() }
        return image
    }
}

struct CameraPreviewView: UIViewRepresentable {
    @EnvironmentObject var engine: VeyraEngine

    func makeUIView(context: Context) -> CameraPreviewMTKView {
        let view = CameraPreviewMTKView()
        view.backgroundColor = .black
        view.delegate = context.coordinator
        view.enableSetNeedsDisplay = true
        view.isPaused = false
        view.preferredFramesPerSecond = 60
        context.coordinator.view = view
        return view
    }

    func updateUIView(_ uiView: CameraPreviewMTKView, context: Context) {
        // Push the latest engine preview frame into the coordinator's store.
        context.coordinator.store.update(engine.previewImage)
        uiView.isPaused = false
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator: NSObject, MTKViewDelegate {
        private let ciContext: CIContext
        let store = PreviewFrameStore()
        weak var view: CameraPreviewMTKView?

        override init() {
            if let device = MTLCreateSystemDefaultDevice() {
                self.ciContext = CIContext(mtlDevice: device)
            } else {
                self.ciContext = CIContext()
            }
            super.init()
        }

        func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

        func draw(in view: MTKView) {
            guard let drawable = view.currentDrawable,
                  let device = view.device,
                  let commandQueue = device.makeCommandQueue(),
                  let image = store.current() else {
                view.currentDrawable?.present()
                return
            }

            let targetSize = CGSize(width: view.drawableSize.width, height: view.drawableSize.height)
            guard image.extent.width > 0, image.extent.height > 0 else {
                view.currentDrawable?.present()
                return
            }

            let scale = min(targetSize.width / image.extent.width,
                            targetSize.height / image.extent.height)
            let scaledW = image.extent.width * scale
            let scaledH = image.extent.height * scale
            let offsetX = (targetSize.width - scaledW) / 2
            let offsetY = (targetSize.height - scaledH) / 2

            let transform = CGAffineTransform(translationX: offsetX, y: offsetY)
                .scaledBy(x: scale, y: scale)
            let boundImage = image.transformed(by: transform)

            guard let commandBuffer = commandQueue.makeCommandBuffer() else { return }
            ciContext.render(
                boundImage,
                to: drawable.texture,
                commandBuffer: commandBuffer,
                bounds: CGRect(x: 0, y: 0, width: targetSize.width, height: targetSize.height),
                colorSpace: CGColorSpaceCreateDeviceRGB()
            )
            commandBuffer.present(drawable)
            commandBuffer.commit()
        }
    }
}

final class CameraPreviewMTKView: MTKView {}
