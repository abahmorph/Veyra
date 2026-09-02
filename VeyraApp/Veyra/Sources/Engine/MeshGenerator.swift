import Foundation
import CoreGraphics

public struct MeshGenerator {
    
    public static func triangulateKeyLandmarks(source: [CGPoint], target: [CGPoint]) -> [Triangle] {
        guard source.count >= 3, target.count >= 3, source.count == target.count else { return [] }
        
        let triangles = bowyerWatson(points: target)
        
        return triangles.map { indices in
            let src = indices.map { source[$0] }
            let dst = indices.map { target[$0] }
            return Triangle(src: src, dst: dst)
        }
    }
    
    public static func buildFaceMesh(from landmarks: [CGPoint], faceWidth: CGFloat, faceHeight: CGFloat) -> [Triangle] {
        guard landmarks.count >= 3 else { return [] }
        
        let pixelLandmarks = landmarks.map { CGPoint(x: $0.x * faceWidth, y: $0.y * faceHeight) }
        
        return bowyerWatson(points: pixelLandmarks).map { indices in
            let pts = indices.map { pixelLandmarks[$0] }
            return Triangle(src: pts, dst: pts)
        }
    }
    
    private static func bowyerWatson(points: [CGPoint]) -> [[Int]] {
        guard points.count >= 3 else { return [] }
        
        var vertices = points
        
        var minX = CGFloat.greatestFiniteMagnitude
        var minY = CGFloat.greatestFiniteMagnitude
        var maxX = -CGFloat.greatestFiniteMagnitude
        var maxY = -CGFloat.greatestFiniteMagnitude
        
        for p in vertices {
            minX = min(minX, p.x)
            minY = min(minY, p.y)
            maxX = max(maxX, p.x)
            maxY = max(maxY, p.y)
        }
        
        let dx = maxX - minX
        let dy = maxY - minY
        let deltaMax = max(dx, dy)
        let midX = (minX + maxX) / 2
        let midY = (minY + maxY) / 2
        
        let p1 = CGPoint(x: midX - 20 * deltaMax, y: midY - deltaMax)
        let p2 = CGPoint(x: midX, y: midY + 20 * deltaMax)
        let p3 = CGPoint(x: midX + 20 * deltaMax, y: midY - deltaMax)
        
        vertices.append(contentsOf: [p1, p2, p3])
        let n = points.count
        
        var triangleList = [[0, n, n + 1], [n + 1, n, n + 2]]
        
        for i in 0..<n {
            let point = vertices[i]
            var edges: [CGPoint] = []
            var newTriangles: [[Int]] = []
            
            for triangle in triangleList {
                let a = vertices[triangle[0]]
                let b = vertices[triangle[1]]
                let c = vertices[triangle[2]]
                
                if isPointInCircumcircle(point, a, b, c) {
                    edges.append(contentsOf: [a, b, b, c, c, a])
                } else {
                    newTriangles.append(triangle)
                }
            }
            
            let uniqueEdges = deduplicateEdges(edges)
            for edge in uniqueEdges {
                guard let i0 = vertices.firstIndex(where: { isSamePoint($0, edge[0]) }),
                      let i1 = vertices.firstIndex(where: { isSamePoint($0, edge[1]) }) else { continue }
                newTriangles.append([i0, i1, i])
            }
            
            triangleList = newTriangles
        }
        
        return triangleList.filter { triangle in
            !triangle.contains(n) && !triangle.contains(n + 1) && !triangle.contains(n + 2)
        }
    }
    
    private static func isPointInCircumcircle(_ p: CGPoint, _ a: CGPoint, _ b: CGPoint, _ c: CGPoint) -> Bool {
        let ax = a.x - p.x, ay = a.y - p.y
        let bx = b.x - p.x, by = b.y - p.y
        let cx = c.x - p.x, cy = c.y - p.y
        
        let det = (ax * ax + ay * ay) * (bx * cy - cx * by)
                - (bx * bx + by * by) * (ax * cy - cx * ay)
                + (cx * cx + cy * cy) * (ax * by - bx * ay)
        
        let a1 = atan2(b.y - a.y, b.x - a.x)
        let a2 = atan2(c.y - b.y, c.x - b.x)
        let ccw = ((a2 - a1).truncatingRemainder(dividingBy: 2 * .pi) + 2 * .pi).truncatingRemainder(dividingBy: 2 * .pi) < .pi
        
        return ccw ? det > 0 : det < 0
    }
    
    private static func deduplicateEdges(_ edges: [CGPoint]) -> [[CGPoint]] {
        var pairs: [[CGPoint]] = []
        var i = 0
        while i < edges.count - 1 {
            pairs.append([edges[i], edges[i + 1]])
            i += 2
        }

        // Key each undirected edge canonically and count how often it appears.
        var counts: [String: Int] = [:]
        let keys = pairs.map { pair -> String in
            let k1 = edgeCoordKey(pair[0])
            let k2 = edgeCoordKey(pair[1])
            return k1 < k2 ? "\(k1)-\(k2)" : "\(k2)-\(k1)"
        }
        for k in keys { counts[k, default: 0] += 1 }

        // In Bowyer-Watson, an edge shared by two removed triangles is interior
        // and must be discarded; only edges appearing exactly once (the boundary
        // of the hole polygon) are kept.
        var unique: [[CGPoint]] = []
        for (index, pair) in pairs.enumerated() where counts[keys[index]] == 1 {
            unique.append(pair)
        }
        return unique
    }

    private static func edgeCoordKey(_ p: CGPoint) -> String {
        return "\(Int(p.x * 1000)),\(Int(p.y * 1000))"
    }
    
    private static func isSamePoint(_ a: CGPoint, _ b: CGPoint) -> Bool {
        return abs(a.x - b.x) < 0.001 && abs(a.y - b.y) < 0.001
    }
}
