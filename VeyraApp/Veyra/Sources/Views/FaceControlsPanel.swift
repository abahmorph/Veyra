import SwiftUI

struct FaceControlsPanel: View {
    @EnvironmentObject var engine: VeyraEngine
    
    var body: some View {
        VStack(spacing: 8) {
            Text("Face Transform")
                .font(.headline)
                .foregroundColor(.white)
            
            TransformSlider(label: "Face Width", value: $engine.faceSettings.faceWidth)
            TransformSlider(label: "Face Height", value: $engine.faceSettings.faceHeight)
            TransformSlider(label: "Jaw Width", value: $engine.faceSettings.jawWidth)
            TransformSlider(label: "Jaw Shape", value: $engine.faceSettings.jawShape)
            TransformSlider(label: "Chin", value: $engine.faceSettings.chin)
            TransformSlider(label: "Cheek Width", value: $engine.faceSettings.cheekWidth)
            TransformSlider(label: "Eye Size", value: $engine.faceSettings.eyeSize)
            TransformSlider(label: "Eye Spacing", value: $engine.faceSettings.eyeSpacing)
            TransformSlider(label: "Nose Width", value: $engine.faceSettings.noseWidth)
            TransformSlider(label: "Nose Height", value: $engine.faceSettings.noseHeight)
            TransformSlider(label: "Mouth Size", value: $engine.faceSettings.mouthSize)
            
            Button("Reset") {
                engine.faceSettings = FaceTransformSettings()
            }
            .foregroundColor(.red)
            .font(.caption)
            .padding(.top, 4)
        }
    }
}

struct TransformSlider: View {
    let label: String
    @Binding var value: Float
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(label)
                    .font(.caption)
                    .foregroundColor(.gray)
                Spacer()
                Text(String(format: "%.2f", value))
                    .font(.caption2)
                    .foregroundColor(.blue)
            }
            Slider(value: $value, in: 0.5...1.5, step: 0.01)
                .tint(.blue)
        }
    }
}
