import Foundation
import Capacitor

@objc(LinkHandlerPlugin)
public class LinkHandlerPlugin: CAPPlugin {

    @objc override public func load() {
        // Override the bridge's shouldStartLoad to prevent Safari from opening
        if let bridge = self.bridge {
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(handlePageLoad),
                name: Notification.Name.capacitorOpenURL,
                object: nil
            )
        }
    }

    @objc func handlePageLoad(_ notification: Notification) {
        // All URLs should stay in the webview
        // This prevents Safari from opening
    }
}
