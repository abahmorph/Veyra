import SwiftUI

@main
struct VeyraApp: App {
    @StateObject private var engine = VeyraEngine()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(engine)
                .preferredColorScheme(.dark)
        }
    }
}
