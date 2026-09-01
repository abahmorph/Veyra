import SwiftUI

@main
struct VeyraApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var studioStore = StudioStore()
    @StateObject private var authStore = AuthStore()
    @StateObject private var entitlementStore = EntitlementStore()
    @StateObject private var pipeline = CameraPipeline()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(studioStore)
                .environmentObject(authStore)
                .environmentObject(entitlementStore)
                .environmentObject(pipeline)
                .preferredColorScheme(.dark)
                .onAppear {
                    pipeline.configure()
                    appState.checkBackend()
                }
        }
    }
}
