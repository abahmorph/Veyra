# Veyra iOS

Real-time AI video transformation for iOS.

## Architecture

```
Veyra/
├── Veyra/                          # Main app target
│   ├── Sources/
│   │   ├── Engine/                 # Core processing pipeline
│   │   │   ├── CameraPipeline.swift       # AVCaptureSession + frame processing
│   │   │   ├── Face/
│   │   │   │   ├── FaceTracker.swift      # Vision framework face landmarks
│   │   │   │   ├── FaceReplaceManager.swift  # Reference face preparation
│   │   │   │   └── DelaunayTriangulation.swift  # Triangle-based warping
│   │   │   ├── Background/
│   │   │   │   └── BackgroundProcessor.swift  # VNGeneratePersonSegmentation
│   │   │   ├── Audio/
│   │   │   │   └── AudioEngine.swift      # AVAudioEngine voice effects
│   │   │   └── Renderer/
│   │   │       └── MetalRenderer.swift    # Metal + Core Image effects
│   │   ├── Models/                 # Data models
│   │   ├── Services/               # API client, subscription manager
│   │   ├── Views/                  # SwiftUI screens
│   │   └── VeyraApp.swift          # App entry point
│   └── Resources/
│       └── Info.plist
├── VeyraBroadcast/                 # ReplayKit broadcast extension
│   └── Sources/
│       └── SampleHandler.swift
└── Package.swift
```

## Requirements

- iOS 17.0+
- Xcode 15.0+
- Apple Silicon Mac (for building)

## Building

1. Open `Package.swift` in Xcode
2. Select the Veyra scheme
3. Build and run on a physical iOS device

## Features

- Real-time camera capture via AVFoundation
- Face tracking via Vision framework (478 landmarks)
- AI face replacement via Delaunay triangulation warping
- Background segmentation via Vision framework
- Real-time GPU effects via Metal + Core Image
- Voice effects via AVAudioEngine
- Virtual camera output via ReplayKit Broadcast Upload Extension
- Subscription management via StoreKit 2
- Backend communication via REST API

## Notes

- Virtual camera output requires the ReplayKit broadcast extension
- Face replacement uses geometric warping (Delaunay triangulation), not a generative AI model
- For true AI face synthesis, integrate a Core ML model (e.g., a face-swap GAN or diffusion model)
- All processing runs on-device; no data is uploaded
