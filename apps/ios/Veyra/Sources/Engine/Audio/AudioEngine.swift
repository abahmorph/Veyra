import Foundation
import AVFoundation
import CoreAudio

public actor AudioEngine {
    private var engine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var mixerNode: AVAudioMixerNode?
    private var effect: VoiceChain = .none
    private var intensity: Double = 0.5
    private var inputVolume: Double = 1.0
    private var outputVolume: Double = 1.0
    private var noiseSuppressionEnabled: Bool = true
    private var echoCancellationEnabled: Bool = false
    private var monitorEnabled: Bool = true
    private var status: AudioEngineStatus = .idle

    public func start() async throws {
        guard status != .running else { return }

        let engine = AVAudioEngine()
        let playerNode = AVAudioPlayerNode()
        let mixerNode = AVAudioMixerNode()

        engine.attach(playerNode)
        engine.attach(mixerNode)

        // Input node (microphone)
        let inputNode = engine.inputNode
        let inputFormat = inputNode.inputFormat(forBus: 0)

        // Connect nodes
        engine.connect(inputNode, to: mixerNode, format: inputFormat)
        engine.connect(playerNode, to: engine.mainMixerNode, format: inputFormat)
        engine.connect(mixerNode, to: engine.mainMixerNode, format: inputFormat)

        // Configure
        engine.mainMixerNode.outputVolume = Float(outputVolume)
        playerNode.volume = 1.0

        try engine.start()

        self.engine = engine
        self.playerNode = playerNode
        self.mixerNode = mixerNode
        self.status = .running

        playerNode.play()
    }

    public func stop() {
        engine?.stop()
        playerNode?.stop()
        engine = nil
        playerNode = nil
        mixerNode = nil
        status = .idle
    }

    public func applyEffect(_ newEffect: VoiceChain, intensity: Double) {
        effect = newEffect
        self.intensity = intensity
        // Effect application would happen in audio tap or via AVAudioUnit
    }

    public func setInputVolume(_ volume: Double) {
        inputVolume = volume
    }

    public func setOutputVolume(_ volume: Double) {
        outputVolume = volume
        engine?.mainMixerNode.outputVolume = Float(volume)
    }

    public func setNoiseSuppression(_ enabled: Bool) {
        noiseSuppressionEnabled = enabled
    }

    public func setEchoCancellation(_ enabled: Bool) {
        echoCancellationEnabled = enabled
    }

    public func setMonitor(_ enabled: Bool) {
        monitorEnabled = enabled
    }

    public func getStatus() -> AudioEngineStatus {
        return status
    }

    public func readLevel() -> Double {
        guard let engine = engine else { return 0 }
        guard let playerNode = playerNode else { return 0 }

        // Use AVAudioEngine's manual rendering or tap to get levels
        // Simplified: return 0 for now, implement with AVAudioEngine input tap
        return 0
    }
}

public enum AudioEngineStatus: String, Codable {
    case idle
    case running
    case error
}
