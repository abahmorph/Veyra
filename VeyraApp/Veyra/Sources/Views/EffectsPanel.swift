import SwiftUI

struct EffectsPanel: View {
    @EnvironmentObject var engine: VeyraEngine
    
    private let effects: [(id: String, name: String, icon: String)] = [
        ("none", "None", "xmark"),
        ("beauty", "Beauty", "sparkles"),
        ("cartoon", "Cartoon", "paintbrush"),
        ("anime", "Anime", "paintpalette"),
        ("cyberpunk", "Cyberpunk", "bolt"),
        ("horror", "Horror", "moon.fill"),
        ("pixel", "Pixel", "squareshape.split.2x2"),
        ("glitch", "Glitch", "antenna.radiowaves.left.and.right")
    ]
    
    var body: some View {
        VStack(spacing: 8) {
            Text("Effects")
                .font(.headline)
                .foregroundColor(.white)
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 8) {
                ForEach(effects, id: \.id) { effect in
                    Button {
                        engine.setEffect(effect.id)
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: effect.icon)
                                .font(.title3)
                            Text(effect.name)
                                .font(.caption2)
                        }
                        .foregroundColor(engine.currentEffect == effect.id ? .white : .gray)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(engine.currentEffect == effect.id ? Color.blue : Color.gray.opacity(0.3))
                        .cornerRadius(12)
                    }
                }
            }
        }
    }
}
