import Foundation
import ReplayKit
import AVFoundation

public actor VirtualCameraManager {
    public static let shared = VirtualCameraManager()

    private var broadcast: RPBroadcastController?
    private var isBroadcasting = false
    private var pendingHandler: ((Bool) -> Void)?

    private init() {}

    public func start() async -> Bool {
        return await withCheckedContinuation { continuation in
            pendingHandler = { success in
                continuation.resume(returning: success)
            }

            let picker = RPBroadcastActivityViewController()
            // Present from root view controller
            if let rootVC = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first?.windows
                .first?.rootViewController {
                picker.delegate = self
                rootVC.present(picker, animated: true)
            } else {
                continuation.resume(returning: false)
            }
        }
    }

    public func stop() async {
        broadcast?.stopBroadcast()
        isBroadcasting = false
        broadcast = nil
    }

    public func getStatus() async -> VirtualCameraStatus {
        if isBroadcasting {
            return .available
        }
        return .unavailable
    }
}

extension VirtualCameraManager: RPBroadcastActivityViewControllerDelegate {
    public func broadcastActivityViewController(_ broadcastActivityViewController: RPBroadcastActivityViewController, didFinishWith broadcastController: RPBroadcastController?, error: Error?) {
        broadcastActivityViewController.dismiss(animated: true)

        if let controller = broadcastController {
            self.broadcast = controller
            controller.startBroadcast { error in
                if error == nil {
                    self.isBroadcasting = true
                }
                self.pendingHandler?(error == nil)
                self.pendingHandler = nil
            }
        } else {
            self.pendingHandler?(false)
            self.pendingHandler = nil
        }
    }
}

public enum VirtualCameraStatus: String, Codable {
    case available
    case starting
    case unavailable
    case error
    case moduleMissing
}
