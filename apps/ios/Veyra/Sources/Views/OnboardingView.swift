import SwiftUI

public struct OnboardingView: View {
    @EnvironmentObject var appState: AppState

    @State private var currentStep = 0

    public init() {}

    public var body: some View {
        ZStack {
            // Ambient background
            AmbientBackgroundView()

            VStack(spacing: 40) {
                Spacer()

                // Logo
                VStack(spacing: 16) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 24)
                            .fill(
                                LinearGradient(
                                    colors: [Color(hex: "14f195"), Color(hex: "0dcbc0")],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 80, height: 80)
                            .shadow(color: Color(hex: "14f195").opacity(0.4), radius: 30, x: 0, y: 10)

                        Text("V")
                            .font(.system(size: 42, weight: .bold, design: .rounded))
                            .foregroundStyle(Color(hex: "05241a"))
                    }

                    VStack(spacing: 8) {
                        Text("Veyra")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)

                        Text("AI Video Studio")
                            .font(.system(size: 14, weight: .medium))
                            .tracking(2)
                            .foregroundStyle(Color(hex: "888899"))
                    }
                }

                Spacer()

                // Get started button
                Button(action: {
                    appState.setOnboarded(true)
                }) {
                    Text("Get Started")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Color(hex: "05241a"))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(
                                    LinearGradient(
                                        colors: [Color(hex: "14f195"), Color(hex: "0dcbc0")],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .shadow(color: Color(hex: "14f195").opacity(0.4), radius: 20, x: 0, y: 8)
                        )
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 40)
            }
        }
        .ignoresSafeArea()
    }
}

public struct AmbientBackgroundView: View {
    @State private var animateGradient = false

    public init() {}

    public var body: some View {
        ZStack {
            Color(hex: "07070d").ignoresSafeArea()

            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color(hex: "14f195").opacity(0.08), Color.clear],
                        center: .center,
                        startRadius: 0,
                        endRadius: 300
                    )
                )
                .blur(radius: 60)
                .offset(x: animateGradient ? 100 : -100, y: animateGradient ? -50 : 50)

            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color(hex: "7c5cff").opacity(0.06), Color.clear],
                        center: .center,
                        startRadius: 0,
                        endRadius: 250
                    )
                )
                .blur(radius: 60)
                .offset(x: animateGradient ? -80 : 80, y: animateGradient ? 60 : -60)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 8).repeatForever(autoreverses: true)) {
                animateGradient = true
            }
        }
    }
}

#Preview {
    OnboardingView()
        .environmentObject(AppState())
}
