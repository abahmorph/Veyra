import SwiftUI

public struct VoiceView: View {
    @EnvironmentObject var studioStore: StudioStore
    @EnvironmentObject var entitlementStore: EntitlementStore
    @EnvironmentObject var pipeline: CameraPipeline

    @State private var inputLevel: Double = 0

    private let voiceEffects: [VoiceEffectDefinition] = [
        VoiceEffectDefinition(id: "none", name: "None", description: "Original voice", premium: false, chain: .none, intensityRange: 0...1),
        VoiceEffectDefinition(id: "pitch", name: "Pitch Shift", description: "Shift your voice pitch up or down", premium: true, chain: .pitch, intensityRange: 0...1),
        VoiceEffectDefinition(id: "robot", name: "Robot", description: "Metallic synthesized voice", premium: true, chain: .robot, intensityRange: 0...1),
        VoiceEffectDefinition(id: "radio", name: "Radio", description: "AM/FM radio effect", premium: true, chain: .radio, intensityRange: 0...1),
        VoiceEffectDefinition(id: "echo", name: "Echo", description: "Delay and reverb effect", premium: true, chain: .echo, intensityRange: 0...1),
        VoiceEffectDefinition(id: "alien", name: "Alien", description: "Otherworldly modulation", premium: true, chain: .alien, intensityRange: 0...1),
    ]

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text("Voice")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)

                    Text("Real-time voice effects with local processing.")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color(hex: "888899"))
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)

                // Microphone selector
                VStack(alignment: .leading, spacing: 8) {
                    Text("Microphone")
                        .font(.system(size: 12, weight: .semibold))
                        .tracking(1)
                        .foregroundStyle(Color(hex: "888899"))
                        .padding(.horizontal, 20)

                    Picker("Microphone", selection: $studioStore.selectedMic) {
                        ForEach(studioStore.audioDevices, id: \.deviceId) { device in
                            Text(device.label).tag(device.deviceId)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding(.horizontal, 20)
                }

                // Effects grid
                VStack(alignment: .leading, spacing: 12) {
                    Text("Effects")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
                        ForEach(voiceEffects) { effect in
                            VoiceEffectCard(effect: effect)
                                .onTapGesture {
                                    Task {
                                        if effect.premium {
                                            let allowed = await entitlementStore.consumePremium()
                                            if !allowed { return }
                                        }
                                        studioStore.setVoiceEffect(effect.id)
                                    }
                                }
                        }
                    }
                    .padding(.horizontal, 20)
                }

                // Mix controls
                VStack(alignment: .leading, spacing: 14) {
                    Text("Mix")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)

                    VStack(spacing: 12) {
                        SliderView(label: "Intensity", value: $studioStore.voiceIntensity)
                        SliderView(label: "Input", value: $studioStore.inputVolume)
                        SliderView(label: "Output", value: $studioStore.outputVolume)
                    }
                    .padding(.horizontal, 20)
                }

                // Processing toggles
                VStack(alignment: .leading, spacing: 12) {
                    Text("Processing")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)

                    VStack(spacing: 10) {
                        ToggleRow(label: "Noise suppression", isOn: $studioStore.noiseSuppression)
                        ToggleRow(label: "Echo cancellation", isOn: $studioStore.echoCancellation)
                        ToggleRow(label: "Monitor", isOn: $studioStore.monitor)
                    }
                    .padding(.horizontal, 20)
                }

                // Virtual mic
                VStack(alignment: .leading, spacing: 10) {
                    Text("Veyra Microphone")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 20)

                    HStack {
                        Text(studioStore.vmicStatus.capitalized)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(vmicStatusColor)

                        Spacer()

                        if studioStore.vmicStatus != "available" {
                            Button("Create") {
                                // Create virtual mic
                            }
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color(hex: "14f195"))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color(hex: "14f195"), lineWidth: 1)
                            )
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color(hex: "0f0f18"))
                    )
                    .padding(.horizontal, 20)

                    Text("Select Veyra Microphone in your call app to receive processed voice.")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color(hex: "888899"))
                        .padding(.horizontal, 20)
                        .padding(.top, 4)
                }
                .padding(.bottom, 20)
            }
        }
        .background(Color(hex: "07070d").ignoresSafeArea())
    }

    private var vmicStatusColor: Color {
        switch studioStore.vmicStatus {
        case "available": return Color(hex: "14f195")
        case "error": return .red
        default: return Color(hex: "888899")
        }
    }
}

struct VoiceEffectCard: View {
    let effect: VoiceEffectDefinition
    @EnvironmentObject var studioStore: StudioStore

    var isActive: Bool {
        studioStore.voiceEffectId == effect.id
    }

    var body: some View {
        Button(action: {}) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(effect.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(isActive ? Color(hex: "14f195") : .white)

                    if effect.premium {
                        Image(systemName: "sparkles")
                            .font(.system(size: 10))
                            .foregroundStyle(Color(hex: "b9a7ff"))
                    }

                    Spacer()

                    if isActive {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Color(hex: "14f195"))
                    }
                }

                Text(effect.description)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color(hex: "888899"))
                    .lineLimit(2)

                Text(isActive ? "Active" : "Tap to use")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(isActive ? Color(hex: "14f195") : Color(hex: "555566"))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(isActive ? Color(hex: "14f195").opacity(0.15) : Color(hex: "333344").opacity(0.5))
                    )
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(Color(hex: "0f0f18").opacity(0.8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(isActive ? Color(hex: "14f195").opacity(0.5) : Color(hex: "333344"), lineWidth: 1)
                    )
            )
        }
    }
}

struct SliderView: View {
    let label: String
    @Binding var value: Double

    var body: some View {
        HStack(spacing: 12) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color(hex: "888899"))
                .frame(width: 60, alignment: .leading)

            Slider(value: $value, in: 0...1, step: 0.01)
                .tint(Color(hex: "14f195"))

            Text("\(Int(value * 100))%")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(Color(hex: "888899"))
                .frame(width: 40, alignment: .trailing)
        }
    }
}

struct ToggleRow: View {
    let label: String
    @Binding var isOn: Bool

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white)

            Spacer()

            Toggle("", isOn: $isOn)
                .labelsHidden()
                .tint(Color(hex: "14f195"))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(hex: "0f0f18"))
        )
    }
}

#Preview {
    VoiceView()
        .environmentObject(StudioStore())
        .environmentObject(EntitlementStore())
        .environmentObject(CameraPipeline())
}
