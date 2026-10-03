import UIKit
import Capacitor

/// App 主界面：注册本地插件，开启 iOS 右滑返回。
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SpeechPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        #if DEBUG
        if #available(iOS 16.4, *) { webView?.isInspectable = true }
        #endif
    }
}
