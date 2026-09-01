import Foundation
import AVFoundation

public actor VirtualMicManager {
    public static let shared = VirtualMicManager()

    private var audioEngine: AVAudioEngine?
    private var isActive = false

    private init() {}

    public func ensureVirtualMic() async -> VirtualMicStatus {
        if isActive {
            return .available
        }

        do {
            let engine = AVAudioEngine()
            let input = engine.inputNode
            let format = input.inputFormat(forBus: 0)

            // Create a mixer node
            let mixer = AVAudioMixerNode()
            engine.attach(mixer)

            engine.connect(input, to: mixer, format: format)

            try engine.start()
            self.audioEngine = engine
            self.isActive = true

            return .available
        } catch {
            return .unavailable
        }
    }

    public func getStatus() async -> VirtualMicStatus {
        if isActive {
            return .available
        }
        return .unavailable
    }
}

public enum VirtualMicStatus: String, Codable {
    case available
    case unavailable
    case starting
    case error
}
