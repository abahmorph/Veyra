import Foundation
import SwiftUI

@MainActor
public final class StudioStore: ObservableObject {
    @Published public private(set) var devices: [CameraDevice] = []
    @Published public private(set) var videoDevices: [CameraDevice] = []
    @Published public private(set) var audioDevices: [CameraDevice] = []
    @Published public var selectedCamera: String = ""
    @Published public var selectedMic: String = ""
    @Published public var resolution: Resolution = Resolution(label: "1280 × 720", width: 1280, height: 720)
    @Published public var fps: Int = 30
    @Published public var mirror: Bool = true
    @Published public var effectId: String = "none"
    @Published public var person: PersonAsset?
    @Published public var people: [PersonAsset] = []
    @Published public var background: BackgroundDefinition?
    @Published public var customBackgrounds: [BackgroundDefinition] = []
    @Published public var voiceEffectId: String = "none"
    @Published public var voiceIntensity: Double = 0.5
    @Published public var inputVolume: Double = 1.0
    @Published public var outputVolume: Double = 1.0
    @Published public var noiseSuppression: Bool = true
    @Published public var echoCancellation: Bool = false
    @Published public var monitor: Bool = true
    @Published public var running: Bool = false
    @Published public var status: PipelineStatus = .idle
    @Published public var stats: PerformanceStats?
    @Published public var vcamStatus: String = "checking"
    @Published public var vmicStatus: String = "checking"
    @Published public var apps: [AppDetection] = []
    @Published public var selectedApp: String?
    @Published public var compareRaw: Bool = false
    @Published public var faceModelReady: Bool = false
    @Published public var segmentModelReady: Bool = false
    @Published public var errorMessage: String?

    public init() {
        loadSavedState()
    }

    public func setDevices(_ devices: [CameraDevice]) {
        self.devices = devices
        let video = devices.filter { $0.kind == .videoinput }
        let audio = devices.filter { $0.kind == .audioinput }

        videoDevices = video
        audioDevices = audio

        if selectedCamera.isEmpty, let first = video.first {
            selectedCamera = first.deviceId
        }
        if selectedMic.isEmpty, let first = audio.first {
            selectedMic = first.deviceId
        }
    }

    public func setCamera(_ id: String) {
        selectedCamera = id
    }

    public func setMic(_ id: String) {
        selectedMic = id
    }

    public func setResolution(_ res: Resolution) {
        resolution = res
    }

    public func setFps(_ f: Int) {
        fps = max(15, min(60, f))
    }

    public func setMirror(_ m: Bool) {
        mirror = m
    }

    public func setEffect(_ id: String) {
        effectId = id
    }

    public func setPerson(_ p: PersonAsset?) {
        person = p
    }

    public func addPerson(_ p: PersonAsset) {
        people = [p] + people.filter { $0.id != p.id }
    }

    public func removePerson(_ id: String) {
        people = people.filter { $0.id != id }
    }

    public func setBackground(_ b: BackgroundDefinition?) {
        background = b
    }

    public func addCustomBackground(_ b: BackgroundDefinition) {
        customBackgrounds = [b] + customBackgrounds.filter { $0.id != b.id }
    }

    public func removeCustomBackground(_ id: String) {
        customBackgrounds = customBackgrounds.filter { $0.id != id }
        if background?.id == id {
            background = nil
        }
    }

    public func setVoiceEffect(_ id: String) {
        voiceEffectId = id
    }

    public func setVoiceIntensity(_ v: Double) {
        voiceIntensity = max(0, min(1, v))
    }

    public func setInputVolume(_ v: Double) {
        inputVolume = max(0, min(1, v))
    }

    public func setOutputVolume(_ v: Double) {
        outputVolume = max(0, min(1, v))
    }

    public func setNoiseSuppression(_ v: Bool) {
        noiseSuppression = v
    }

    public func setEchoCancellation(_ v: Bool) {
        echoCancellation = v
    }

    public func setMonitor(_ v: Bool) {
        monitor = v
    }

    public func setRunning(_ r: Bool) {
        running = r
    }

    public func setStatus(_ s: PipelineStatus) {
        status = s
    }

    public func setStats(_ s: PerformanceStats) {
        stats = s
    }

    public func setErrorMessage(_ m: String?) {
        errorMessage = m
    }

    private func loadSavedState() {
        // Load persisted settings
        if let savedEffect = UserDefaults.standard.string(forKey: "veyra_effect_id") {
            effectId = savedEffect
        }
        if let savedVoice = UserDefaults.standard.string(forKey: "veyra_voice_effect") {
            voiceEffectId = savedVoice
        }
    }
}

public enum PipelineStatus: String, Codable {
    case idle
    case starting
    case running
    case stopped
    case error
}

public struct CameraDevice: Codable, Identifiable, Equatable {
    public let deviceId: String
    public let label: String
    public let kind: DeviceKind
}

public enum DeviceKind: String, Codable {
    case videoinput
    case audioinput
    case audiooutput
}

public struct AppDetection: Codable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let running: Bool
    public let cameraCompatible: Bool
    public let micCompatible: Bool
    public let notes: String
}
