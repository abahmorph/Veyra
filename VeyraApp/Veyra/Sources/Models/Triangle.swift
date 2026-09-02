import Foundation
import CoreGraphics

public struct Triangle {
    public let src: [CGPoint]
    public let dst: [CGPoint]
    
    public init(src: [CGPoint], dst: [CGPoint]) {
        self.src = src
        self.dst = dst
    }
}
