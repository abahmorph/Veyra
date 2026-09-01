import Foundation

public struct DelaunayTriangulation {
    public static func triangulate(source: [CGPoint], target: [CGPoint], imageSize: CGSize) -> [Triangle] {
        guard source.count >= 5, target.count >= 5 else { return [] }

        // Use a subset of key landmarks for triangulation to keep performance high
        let keyIndices = [
            0,   // nose tip
            1,   // between eyes
            2,   // nose bottom
            3,   // chin
            4,   // forehead
            5,   // left eye outer
            6,   // left eye inner
            7,   // right eye inner
            8,   // right eye outer
            9,   // left cheek
            10,  // right cheek
        ]

        let srcPoints = keyIndices.compactMap { source[$0] }
        let dstPoints = keyIndices.compactMap { target[$0] }

        guard srcPoints.count >= 3 else { return [] }

        // Delaunay triangulation (Bowyer-Watson algorithm)
        let triangles = delaunayTriangulate(points: dstPoints)

        // Map back to source points
        return triangles.map { triangleIndices in
            let src = triangleIndices.map { srcPoints[$0] }
            let dst = triangleIndices.map { dstPoints[$0] }
            return Triangle(src: src, dst: dst)
        }
    }

    private static func delaunayTriangulate(points: [CGPoint]) -> [[Int]] {
        guard points.count >= 3 else { return [] }

        // Simplified Delaunay using super-triangle approach
        var vertices = points
        var triangles: [[Int]] = []

        // Find bounding box
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

        // Super-triangle vertices
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
                let p0 = vertices[triangle[0]]
                let p1 = vertices[triangle[1]]
                let p2 = vertices[triangle[2]]

                if isPointInCircumcircle(point, p0, p1, p2) {
                    edges.append(contentsOf: [p0, p1, p1, p2, p2, p0])
                } else {
                    newTriangles.append(triangle)
                }
            }

            // Remove duplicate edges
            let uniqueEdges = removeDuplicateEdges(edges)
            for edge in uniqueEdges {
                let i0 = vertices.firstIndex(of: edge[0])!
                let i1 = vertices.firstIndex(of: edge[1])!
                newTriangles.append([i0, i1, i])
            }

            triangleList = newTriangles
        }

        // Remove triangles that share vertices with super-triangle
        triangles = triangleList.filter { triangle in
            !triangle.contains(n) && !triangle.contains(n + 1) && !triangle.contains(n + 2)
        }

        return triangles
    }

    private static func isPointInCircumcircle(_ p: CGPoint, _ a: CGPoint, _ b: CGPoint, _ c: CGPoint) -> Bool {
        let ax = a.x - p.x
        let ay = a.y - p.y
        let bx = b.x - p.x
        let by = b.y - p.y
        let cx = c.x - p.x
        let cy = c.y - p.y

        let det = (
            (ax * ax + ay * ay) * (bx * cy - cx * by) -
            (bx * bx + by * by) * (ax * cy - cx * ay) +
            (cx * cx + cy * cy) * (ax * by - bx * ay)
        )

        // For counter-clockwise triangle
        let a1 = atan2(b.y - a.y, b.x - a.x)
        let a2 = atan2(c.y - b.y, c.x - b.x)
        let a3 = atan2(a.y - c.y, a.x - c.x)
        let ccw = ((a2 - a1).truncatingRemainder(dividingBy: 2 * .pi) + 2 * .pi).truncatingRemainder(dividingBy: 2 * .pi) < .pi

        return ccw ? det > 0 : det < 0
    }

    private static func removeDuplicateEdges(_ edges: [CGPoint]) -> [[CGPoint]] {
        var unique: [[CGPoint]] = []
        var used: Set<String> = []

        for i in stride(from: 0, to: edges.count, by: 2) {
            let p1 = edges[i]
            let p2 = edges[i + 1]
            let key1 = "\(p1.x),\(p1.y)-\(p2.x),\(p2.y)"
            let key2 = "\(p2.x),\(p2.y)-\(p1.x),\(p1.y)"

            if !used.contains(key1) && !used.contains(key2) {
                used.insert(key1)
                unique.append([p1, p2])
            }
        }

        return unique
    }
}
