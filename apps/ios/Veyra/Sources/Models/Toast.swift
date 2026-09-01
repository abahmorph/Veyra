import Foundation
import SwiftUI

public struct Toast: Identifiable, Equatable {
    public let id: Int
    public let kind: ToastKind
    public let message: String
}

public enum ToastKind: String, Codable {
    case info
    case success
    case error
    case warn
}
