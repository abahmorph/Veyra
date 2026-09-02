import SwiftUI

struct ContentView: View {
    @EnvironmentObject var engine: VeyraEngine
    @State private var selectedTab: Tab = .studio
    @State private var showControls = false
    
    enum Tab: String {
        case studio, effects, body, settings
    }
    
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Camera preview
                CameraPreviewView()
                    .environmentObject(engine)
                    .ignoresSafeArea(edges: .top)
                
                // Bottom navigation
                bottomBar
            }
            
            // Overlay controls
            if showControls {
                ControlsOverlay()
                    .environmentObject(engine)
                    .transition(.move(edge: .trailing))
            }
        }
        .onAppear {
            Task { await engine.start() }
        }
        .onDisappear {
            engine.stop()
        }
    }
    
    private var bottomBar: some View {
        HStack(spacing: 0) {
            tabButton(.studio, icon: "camera.fill", label: "Studio")
            tabButton(.effects, icon: "wand.and.stars", label: "Effects")
            tabButton(.body, icon: "figure.stand", label: "Body")
            tabButton(.settings, icon: "gearshape", label: "Settings")
        }
        .background(.ultraThinMaterial)
        .frame(height: 80)
    }
    
    private func tabButton(_ tab: Tab, icon: String, label: String) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                selectedTab = tab
                if tab == .studio {
                    showControls.toggle()
                } else {
                    showControls = true
                }
            }
        } label: {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 22, weight: .medium))
                Text(label)
                    .font(.caption2)
            }
            .foregroundColor(selectedTab == tab ? .blue : .gray)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
    }
}

struct ControlsOverlay: View {
    @EnvironmentObject var engine: VeyraEngine
    @State private var selectedPanel: Panel = .face
    
    enum Panel: String {
        case face, body, effects
    }
    
    var body: some View {
        VStack {
            Spacer()
            
            HStack {
                Spacer()
                
                VStack(spacing: 12) {
                    // Panel selector
                    HStack(spacing: 8) {
                        panelButton(.face, label: "Face")
                        panelButton(.body, label: "Body")
                        panelButton(.effects, label: "FX")
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    
                    // Controls
                    ScrollView {
                        VStack(spacing: 12) {
                            switch selectedPanel {
                            case .face:
                                FaceControlsPanel()
                            case .body:
                                BodyControlsPanel()
                            case .effects:
                                EffectsPanel()
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 16)
                    }
                    .frame(maxHeight: 350)
                }
                .frame(width: 300)
                .background(.ultraThinMaterial)
                .cornerRadius(20)
                .padding(.trailing, 12)
            }
            .padding(.bottom, 90)
        }
    }
    
    private func panelButton(_ panel: Panel, label: String) -> some View {
        Button {
            selectedPanel = panel
        } label: {
            Text(label)
                .font(.caption)
                .fontWeight(selectedPanel == panel ? .bold : .regular)
                .foregroundColor(selectedPanel == panel ? .white : .gray)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(selectedPanel == panel ? Color.blue : Color.clear)
                .cornerRadius(12)
        }
    }
}
