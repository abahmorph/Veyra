// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Veyra",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(name: "Veyra", targets: ["Veyra"]),
    ],
    targets: [
        .target(
            name: "Veyra",
            path: "Veyra/Sources",
            resources: [
                .process("Resources"),
            ]
        ),
        .target(
            name: "VeyraTests",
            dependencies: ["Veyra"],
            path: "Tests"
        ),
    ]
)
