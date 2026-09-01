import Foundation

public struct Resolution: Codable, Equatable {
    public let label: String
    public let width: Int
    public let height: Int

    public init(label: String, width: Int, height: Int) {
        self.label = label
        self.width = width
        self.height = height
    }
}
