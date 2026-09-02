import SwiftUI

struct BodyControlsPanel: View {
    @EnvironmentObject var engine: VeyraEngine
    
    var body: some View {
        VStack(spacing: 8) {
            Text("Body Transform")
                .font(.headline)
                .foregroundColor(.white)
            
            TransformSlider(label: "Shoulder Width", value: $engine.bodySettings.shoulderWidth)
            TransformSlider(label: "Torso Width", value: $engine.bodySettings.torsoWidth)
            TransformSlider(label: "Waist", value: $engine.bodySettings.waist)
            TransformSlider(label: "Hip Width", value: $engine.bodySettings.hipWidth)
            TransformSlider(label: "Arm Proportions", value: $engine.bodySettings.armProportions)
            TransformSlider(label: "Leg Proportions", value: $engine.bodySettings.legProportions)
            TransformSlider(label: "Overall Body", value: $engine.bodySettings.overallBody)
            
            Button("Reset") {
                engine.bodySettings = BodyTransformSettings()
            }
            .foregroundColor(.red)
            .font(.caption)
            .padding(.top, 4)
        }
    }
}
