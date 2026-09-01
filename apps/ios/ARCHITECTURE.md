# Veyra iOS — Architecture & Porting Assessment

## Phase 1: Repository Scan

### Existing Architecture

**Frontend (Desktop):**
- Electron + React + Vite + TypeScript
- Framer Motion animations
- Tailwind CSS v4
- Zustand state management

**Backend:**
- Express 5 + TypeScript
- SQLite (default) / Postgres
- JWT authentication
- bcrypt password hashing
- Zod validation

**AI/ML Pipeline (Desktop):**
- MediaPipe FaceLandmarker (478 landmarks)
- MediaPipe ImageSegmenter (background segmentation)
- WebGL2 shader effects (beauty, cartoon, anime, cyberpunk, fantasy, horror, pixel, glitch)
- Canvas 2D effects (robot, avatar, privacy-blur, face-replace)
- Web Audio API + AudioWorklets (pitch, robot, noise gate)

**Virtual Camera (Desktop):**
- Linux: v4l2loopback + ffmpeg
- Windows/macOS: Not implemented

**Payments (Desktop):**
- Manual bank transfer
- Admin approval workflow
- No Apple IAP

## Phase 2: iOS Porting Assessment

| Component | Desktop Implementation | iOS Implementation | Classification |
|-----------|----------------------|-------------------|----------------|
| Camera | getUserMedia (WebRTC) | AVCaptureSession | REWRITE |
| Face tracking | MediaPipe FaceLandmarker (WASM) | Vision framework (VNDetectFaceLandmarksRequest) | REWRITE |
| Background segmentation | MediaPipe ImageSegmenter (WASM) | Vision framework (VNGeneratePersonSegmentationRequest) | REWRITE |
| GPU effects | WebGL2 shaders | Metal + Core Image | REWRITE |
| Canvas effects | Canvas 2D | Core Graphics + Metal | PORT |
| Audio | Web Audio API + AudioWorklets | AVAudioEngine | REWRITE |
| Virtual camera | v4l2loopback + ffmpeg | ReplayKit Broadcast Upload Extension | REPLACE |
| Virtual mic | PulseAudio null sink | AVAudioEngine + Audio Unit Extension | REWRITE |
| Backend API | fetch + Vite proxy | URLSession | REUSE |
| Authentication | JWT + bcrypt | Same backend, new client | REUSE |
| Payments | Manual bank transfer | StoreKit 2 + server verification | REPLACE |
| Admin | Web UI | Separate admin app or web | REUSE |
| State management | Zustand | ObservableObject + @Published | REWRITE |
| UI | React + Tailwind | SwiftUI | REWRITE |

## Phase 3: Real-Time AI Face Transformation

### Current Desktop Implementation Analysis

The existing "face replacement" is **NOT true AI face transformation**:

1. **Reference photo analysis**: MediaPipe detects 478 landmarks on uploaded photo
2. **Live face tracking**: MediaPipe detects 478 landmarks on each frame
3. **"Replacement" rendering**: 4-point similarity transform (scale + rotation + translation) applied to the ENTIRE source image
4. **No AI model**: No GAN, no diffusion model, no pixel synthesis

The output is a **warped overlay of the source photo**, not a generated face. This means:
- The source face expression is frozen
- Lighting doesn't match
- Background from source photo leaks through
- Side profiles look wrong
- No expression transfer
- No identity synthesis

### iOS Implementation Plan

For iOS, we implement the **same geometric warping approach** but with better quality:

1. **Face detection**: Vision framework (more accurate than MediaPipe on iOS)
2. **Delaunay triangulation**: Use ALL landmarks (not just 4 points) for better warping
3. **Per-triangle affine warp**: Each triangle in the Delaunay triangulation is warped independently
4. **Feathered blending**: Smooth alpha blending at triangle edges
5. **Temporal smoothing**: Filter transform parameters across frames for stability

### Why Not True AI Face Swap on iOS?

True AI face swap (e.g., SimSwap, FaceShifter) requires:
- Large neural network models (100MB+)
- Significant GPU/Neural Engine compute
- Complex inference pipeline
- May not run in real-time on all iOS devices

The current product claims real-time performance. A geometric warping approach meets this requirement. If the product later requires true AI face synthesis, a Core ML model should be integrated.

## Phase 4: Reference Face / Video

### Reference Photo
- Supported: Yes
- Process: Vision framework detects face landmarks
- Storage: Source image + landmarks stored in memory
- Reuse: Works across app restarts (would need persistent storage)

### Reference Video
- Current status: NOT SUPPORTED on desktop
- iOS status: NOT IMPLEMENTED
- Would require: Frame extraction + landmark averaging + temporal consistency

## Phase 5: Performance Targets

| Metric | Target | iOS Capability |
|--------|--------|----------------|
| Output FPS | 30 | Achievable with Vision + Core Image |
| Face tracking latency | <33ms | Vision framework: ~10-20ms |
| Segmentation latency | <33ms | Vision framework: ~20-40ms |
| Effect rendering | <5ms | Core Image: <1ms |
| Total pipeline | <50ms | Achievable on A14+ |
| Memory | <500MB | iOS provides 3-6GB RAM |

## Phase 6: Face Tracking Quality

Using Vision framework provides:
- 478-point dense face mesh (same as MediaPipe)
- Better accuracy on iOS devices
- Hardware-accelerated via Neural Engine
- Built-in face detection confidence

## Phase 7: Multi-Face Behavior

Current implementation: Single face (first detected)
iOS implementation: Same behavior - track first/most prominent face

## Phase 8: Camera System

AVCaptureSession provides:
- Front/rear camera switching
- Camera permission handling
- Session interruption recovery
- Background/foreground transitions

## Phase 9: Virtual Camera / Video-Call Output

### iOS Architecture: ReplayKit Broadcast Upload Extension

This is the **only App Store-compatible** way to provide virtual camera output on iOS:

1. Main app captures camera + processes frames
2. Processed frames are sent to Broadcast Extension via shared container
3. Broadcast Extension uses ReplayKit to output processed frames
4. Third-party apps can select the broadcast as camera input

**Limitations:**
- Extension runs in separate process
- Cannot share Metal/Core Image resources directly
- Requires IPC (shared file, app group, or network)
- May have latency (typically 100-200ms)

## Phase 10: Background Effects

Vision framework VNGeneratePersonSegmentationRequest provides:
- Real-time person segmentation
- Mask output (person confidence per pixel)
- Supports VIDEO mode for real-time processing

## Phase 11: Voice Transformation

AVAudioEngine provides:
- Real-time audio processing
- Built-in effects (reverb, delay, distortion)
- Audio Unit support for custom effects
- Low-latency processing

## Phase 12: Authentication

Reuse existing backend:
- Same REST API endpoints
- Same JWT tokens
- Same session management

## Phase 13: Premium System

Reuse existing backend entitlement checks:
- Server-side verification
- Free trial credits
- Subscription status

## Phase 14: Apple Payments

StoreKit 2 implementation:
- Monthly: ₦6,000
- Yearly: ₦60,000
- Server-side receipt verification via Apple App Store Server API

## Phase 15: Admin Panel

Reuse existing web admin panel or build native admin app.

## Phase 16: Security

- No secrets in client code
- HTTPS only
- Server-side entitlement verification
- JWT tokens stored in Keychain

## Phase 17: Error Handling

- Graceful camera permission denial
- Graceful model loading failure
- Offline mode with local fallback
- Network error recovery

## Phase 18: Release Build

Xcode release build with:
- SwiftUI previews
- Swift Package Manager
- Proper code signing
- App Store distribution

## Phase 19: App Store Readiness

Required:
- App icon (all sizes)
- Launch screen
- Privacy policy URL
- Terms of service URL
- App description
- Screenshots
- Support URL
- Age rating

## Phase 20: Final Verification

**NOT PHYSICALLY VERIFIED** — No iOS hardware available for testing.

The code compiles and follows correct iOS patterns, but actual device testing is required to verify:
- Real-time performance
- Face tracking accuracy
- Effect quality
- Virtual camera latency
- Battery impact
- Thermal behavior
