import UIKit
import WebKit
import Capacitor

/// App 主界面：注册本地插件，开启 iOS 右滑返回。
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SpeechPlugin())
        #if DEBUG
        // 开发辅助（仅调试版）：模拟器启动时用环境变量预设服务器、自动登录，方便自动化测试
        //   SIMCTL_CHILD_TM_SERVER=http://localhost:8787  SIMCTL_CHILD_TM_AUTOLOGIN=账号:密码  SIMCTL_CHILD_TM_HASH=ideas
        // 注意：必须在这里注入——Capacitor 会替换 webViewConfiguration 里的 userContentController
        guard let ucc = webView?.configuration.userContentController else { return }
        let env = ProcessInfo.processInfo.environment
        func js(_ s: String) -> String { s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'") }
        if let server = env["TM_SERVER"] {
            let src = "try{if(!localStorage.getItem('tm_server'))localStorage.setItem('tm_server','\(js(server))')}catch(e){}"
            ucc.addUserScript(WKUserScript(source: src, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        if let hash = env["TM_HASH"] {
            let src = "if(location.hash!=='#/\(js(hash))')location.hash='#/\(js(hash))'"
            ucc.addUserScript(WKUserScript(source: src, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        // 自动化测试：页面加载完后载入一段测试脚本（e2e/crawl_ios.js 用它在 App 里逐个点按钮）
        if let script = env["TM_SCRIPT"] {
            let src = "(function(){var s=document.createElement('script');s.crossOrigin='anonymous';s.src='\(js(script))';document.body.appendChild(s)})()"
            ucc.addUserScript(WKUserScript(source: src, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        if let auto = env["TM_AUTOLOGIN"], let i = auto.firstIndex(of: ":") {
            let login = js(String(auto[..<i])), pw = js(String(auto[auto.index(after: i)...]))
            let src = "setTimeout(function(){if(window.TMS&&TMS.server&&!TMS.token)TMS.login(TMS.base,'\(login)','\(pw)').catch(function(e){console.log('autologin',JSON.stringify(e))})},800)"
            ucc.addUserScript(WKUserScript(source: src, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        #endif
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
