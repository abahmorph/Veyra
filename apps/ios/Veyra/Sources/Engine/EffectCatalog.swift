import Foundation

public struct EffectCatalog {
    public static let shared = EffectCatalog()

    public let effects: [EffectDefinition] = [
        EffectDefinition(id: "none", name: "None", category: .face, description: "Raw feed", premium: false, cost: "low", requiresFace: false, kind: .shader, preview: "Raw"),
        EffectDefinition(id: "beauty", name: "Beauty", category: .face, description: "Subtle skin smoothing and tone enhancement.", premium: false, cost: "medium", requiresFace: true, kind: .shader, preview: "Polished"),
        EffectDefinition(id: "cartoon", name: "Cartoon", category: .face, description: "Flat-shaded cartoon look with bold edges.", premium: true, cost: "medium", requiresFace: true, kind: .shader, preview: "Toon"),
        EffectDefinition(id: "anime", name: "Anime Inspired", category: .face, description: "Anime-inspired cel shading with vibrant highlights.", premium: true, cost: "medium", requiresFace: true, kind: .shader, preview: "Cel"),
        EffectDefinition(id: "cyberpunk", name: "Cyberpunk", category: .face, description: "Neon-drenched color grade with scanlines.", premium: true, cost: "low", requiresFace: false, kind: .shader, preview: "Neon"),
        EffectDefinition(id: "robot", name: "Robot", category: .face, description: "Metallic faceplate with glowing eyes.", premium: true, cost: "high", requiresFace: true, kind: .faceMask, preview: "Cyborg"),
        EffectDefinition(id: "fantasy", name: "Fantasy", category: .face, description: "Soft ethereal glow with fairy lights.", premium: true, cost: "low", requiresFace: false, kind: .shader, preview: "Fae"),
        EffectDefinition(id: "horror", name: "Horror", category: .face, description: "Cold, desaturated look with flicker and vignette.", premium: true, cost: "low", requiresFace: false, kind: .shader, preview: "Dread"),
        EffectDefinition(id: "pixel", name: "Pixel", category: .face, description: "Downsampled retro pixel aesthetic.", premium: true, cost: "low", requiresFace: false, kind: .pixel, preview: "8-bit"),
        EffectDefinition(id: "glitch", name: "Glitch", category: .face, description: "Chromatic-aberration glitch distortion.", premium: true, cost: "medium", requiresFace: false, kind: .glitch, preview: "Corrupt"),
        EffectDefinition(id: "avatar", name: "Veyra Avatar", category: .character, description: "Synthetic character driven by face tracking.", premium: true, cost: "medium", requiresFace: true, kind: .avatar, preview: "Character"),
        EffectDefinition(id: "privacy-blur", name: "Privacy Blur", category: .privacy, description: "Blur your face for privacy.", premium: false, cost: "medium", requiresFace: true, kind: .privacyBlur, preview: "Private"),
        EffectDefinition(id: "face-replace", name: "Face Swap", category: .face, description: "Swap using a reference photo you have rights to.", premium: true, cost: "high", requiresFace: true, kind: .faceReplace, preview: "Swap"),
    ]

    public func effect(for id: String) -> EffectDefinition? {
        effects.first { $0.id == id }
    }

    public func effects(by category: EffectCategory) -> [EffectDefinition] {
        effects.filter { $0.category == category && $0.id != "none" }
    }

    public func premiumEffects() -> [EffectDefinition] {
        effects.filter { $0.premium && $0.id != "none" }
    }
}
