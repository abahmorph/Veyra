import SwiftUI
import AVFoundation

public struct CameraPreviewView: UIViewRepresentable {
    @EnvironmentObject var pipeline: CameraPipeline

    public init() {}

    public func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: UIScreen.main.bounds)
        view.backgroundColor = .black

        guard let session = pipeline.captureSession else {
            return view
        }

        let previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        previewLayer.connection?.videoOrientation = .portrait
        previewLayer.frame = view.bounds
        previewLayer.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.layer.addSublayer(previewLayer)

        return view
    }

    public func updateUIView(_ uiView: UIView, context: Context) {
        // Update preview layer if needed
    }
}
