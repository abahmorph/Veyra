import SwiftUI
import AVFoundation

public struct StudioView: View {
    @EnvironmentObject var studioStore: StudioStore
    @EnvironmentObject var entitlementStore: EntitlementStore
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var pipeline: CameraPipeline

    @State private var showPanel: StudioPanel?
    @State private var showError = false
    @State private var isStarting = false

    public init() {}

    public var body: some View {
        ZStack {
            // Camera preview background
            cameraPreview
                .ignoresSafeArea()

            // HUD overlay when running
            if studioStore.running {
                VStack {
                    Spacer()
                    VStack(spacing: 12) {
                        // Stats bar
                        if let stats = studioStore.stats {
                            HStack(spacing: 12) {
                                StatBadge(label: "FPS", value: String(format: "%.0f", stats.fps))
                                StatBadge(label: "Latency", value: String(format: "%.1f ms", stats.pipelineMs))
                                StatBadge(label: "Capture", value: String(format: "%.0f fps", stats.captureFps))
                                StatBadge(label: "Quality", value: "\(Int(stats.qualityScale * 100))%")
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(.black.opacity(0.5))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }

                        // Control bar
                        HStack(spacing: 12) {
                            Button(action: toggleCamera) {
                                HStack {
                                    Image(systemName: studioStore.running ? "stop.circle.fill" : "play.circle.fill")
                                    Text(studioStore.running ? "Stop Camera" : "Start Camera")
                                }
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 12)
                                .background(
                                    RoundedRectangle(cornerRadius: 14)
                                        .fill(studioStore.running ? Color.red.opacity(0.8) : Color(hex: "14f195"))
                                )
                            }
                            .disabled(isStarting)

                            Button(action: toggleVcam) {
                                HStack {
                                    Image(systemName: "video.fill")
                                    Text(vcamButtonText)
                                }
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(vcamButtonColor)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 12)
                                .background(
                                    RoundedRectangle(cornerRadius: 14)
                                        .stroke(vcamButtonColor, lineWidth: 1.5)
                                )
                            }
                        }
                    }
                    .padding(.bottom, 40)
                }
            } else {
                // Start screen
                VStack(spacing: 20) {
                    Spacer()

                    Image(systemName: "video.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(Color(hex: "14f195").opacity(0.6))

                    Text("Your camera preview will appear here")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(Color(hex: "888899"))

                    Button(action: toggleCamera) {
                        HStack {
                            Image(systemName: "play.fill")
                            Text("Start Camera")
                        }
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Color(hex: "05241a"))
                        .padding(.horizontal, 32)
                        .padding(.vertical, 14)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color(hex: "14f195"))
                        )
                    }
                    .disabled(isStarting)

                    Spacer()
                }
            }

            // Error banner
            if let error = studioStore.errorMessage {
                ErrorBanner(message: error, onDismiss: { studioStore.setErrorMessage(nil) })
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .sheet(item: $showPanel) { panel in
            PanelView(panel: panel)
        }
        .onAppear {
            enumerateDevices()
        }
    }

    @ViewBuilder
    private var cameraPreview: some View {
        if #available(iOS 17.0, *) {
            CameraPreviewView()
                .ignoresSafeArea()
        } else {
            Color.black.ignoresSafeArea()
        }
    }

    private var vcamButtonText: String {
        switch studioStore.vcamStatus {
        case "available": return "Camera On"
        case "starting": return "Starting..."
        default: return "Veyra Camera"
        }
    }

    private var vcamButtonColor: Color {
        switch studioStore.vcamStatus {
        case "available": return Color(hex: "14f195")
        case "starting": return Color(hex: "ffaa00")
        default: return Color(hex: "888899")
        }
    }

    private func toggleCamera() {
        isStarting = true

        Task {
            do {
                if studioStore.running {
                    await pipeline.stop()
                    studioStore.setRunning(false)
                    studioStore.setStatus(.stopped)
                } else {
                    studioStore.setStatus(.starting)
                    try await pipeline.start(
                        cameraId: studioStore.selectedCamera.isEmpty ? nil : studioStore.selectedCamera,
                        micId: studioStore.selectedMic.isEmpty ? nil : studioStore.selectedMic
                    )
                    studioStore.setRunning(true)
                    studioStore.setStatus(.running)
                }
            } catch {
                studioStore.setErrorMessage(error.localizedDescription)
                studioStore.setStatus(.error)
            }
            isStarting = false
        }
    }

    private func toggleVcam() {
        // Toggle virtual camera
    }

    private func enumerateDevices() {
        let devices = pipeline.getCameraDevices().map { device in
            CameraDevice(
                deviceId: device.uniqueID,
                label: device.localizedName,
                kind: .videoinput
            )
        }
        let audioDevices = pipeline.getAudioDevices().map { device in
            CameraDevice(
                deviceId: device.uniqueID,
                label: device.localizedName,
                kind: .audioinput
            )
        }
        studioStore.setDevices(devices + audioDevices)
    }
}

struct StatBadge: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                .foregroundStyle(Color(hex: "14f195"))
            Text(label)
                .font(.system(size: 8, weight: .medium))
                .tracking(1)
                .foregroundStyle(Color(hex: "888899"))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.black.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct ErrorBanner: View {
    let message: String
    let onDismiss: () -> Void

    var body: some View {
        HStack {
            Text(message)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color(hex: "ffc2cc"))
            Spacer()
            Button(action: onDismiss) {
                Text("Dismiss")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.red)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(hex: "1a0a10").opacity(0.9))
        )
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }
}

enum StudioPanel: String, Identifiable {
    case person
    case effect
    case background
    case voice
    case app

    var id: String { rawValue }
}

struct PanelView: View {
    let panel: StudioPanel

    var body: some View {
        NavigationStack {
            Text("\(panel.rawValue) panel")
                .font(.largeTitle)
                .navigationTitle(panel.rawValue.capitalized)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Close") { }
                    }
                }
        }
    }
}

#Preview {
    StudioView()
        .environmentObject(StudioStore())
        .environmentObject(AppState())
        .environmentObject(EntitlementStore())
        .environmentObject(CameraPipeline())
}
