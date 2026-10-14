import SwiftUI
import PhotosUI

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

struct FaceSwapPanel: View {
    @EnvironmentObject var engine: VeyraEngine
    @State private var pickedItem: PhotosPickerItem?

    var body: some View {
        VStack(spacing: 10) {
            Text("Face Replacement")
                .font(.headline)
                .foregroundColor(.white)
            Text("Warps a photo's face onto yours")
                .font(.caption2)
                .foregroundColor(.gray)

            PhotosPicker(selection: $pickedItem, matching: .images) {
                Label(engine.referenceFace == nil ? "Choose Reference Face" : "Change Reference Face",
                      systemImage: "person.crop.square")
                    .font(.caption)
            }
            .onChange(of: pickedItem) { newItem in
                guard let newItem = newItem else { return }
                Task {
                    if let data = try? await newItem.loadTransferable(type: Data.self) {
                        await engine.loadReferenceFace(from: data)
                    } else {
                        engine.referenceError = "Could not load that photo."
                    }
                }
            }

            if let error = engine.referenceError {
                Text(error)
                    .font(.caption2)
                    .foregroundColor(.orange)
                    .multilineTextAlignment(.center)
            }

            Toggle("Enable Swap", isOn: $engine.faceReplaceEnabled)
                .font(.caption)
                .foregroundColor(.white)
                .tint(.blue)
                .disabled(engine.referenceFace == nil)

            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text("Blend")
                        .font(.caption)
                        .foregroundColor(.gray)
                    Spacer()
                    Text(String(format: "%.2f", engine.faceReplaceBlend))
                        .font(.caption2)
                        .foregroundColor(.blue)
                }
                Slider(value: $engine.faceReplaceBlend, in: 0...1, step: 0.01)
                    .tint(.blue)
            }

            Button("Clear Reference") {
                engine.clearReferenceFace()
                pickedItem = nil
            }
            .foregroundColor(.red)
            .font(.caption)
            .padding(.top, 4)
            .disabled(engine.referenceFace == nil)
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
