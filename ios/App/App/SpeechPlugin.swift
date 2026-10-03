import Foundation
import AVFoundation
import Speech
import Capacitor

/// 原生语音识别（SFSpeechRecognizer）。JS 端由 native.js 包装成浏览器 SpeechRecognition 接口。
/// 事件：partial {text: 本次会话到目前为止的全文}、end {}、error {error}
@objc(SpeechPlugin)
public class SpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechPlugin"
    public let jsName = "Speech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var running = false

    private func speechState() -> String {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: return "granted"
        case .notDetermined: return "prompt"
        default: return "denied"
        }
    }
    private func micState() -> String {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted: return "granted"
        case .undetermined: return "prompt"
        default: return "denied"
        }
    }

    @objc func available(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "zh-CN"
        call.resolve(["available": SFSpeechRecognizer(locale: Locale(identifier: lang))?.isAvailable ?? false])
    }

    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(["speech": speechState(), "microphone": micState()])
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { _ in
            AVAudioSession.sharedInstance().requestRecordPermission { _ in
                call.resolve(["speech": self.speechState(), "microphone": self.micState()])
            }
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "zh-CN"
        DispatchQueue.main.async {
            self.teardown()
            guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: lang)), recognizer.isAvailable else {
                call.reject("语音识别暂不可用", "unavailable"); return
            }
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playAndRecord, mode: .default, options: [.mixWithOthers, .defaultToSpeaker, .allowBluetoothHFP])
                try session.setActive(true, options: .notifyOthersOnDeactivation)
                let req = SFSpeechAudioBufferRecognitionRequest()
                req.shouldReportPartialResults = true
                // 没网时用手机本地识别（iPhone 支持离线中文识别）；有网时用苹果在线识别，更准
                if call.getBool("onDevice") ?? false, recognizer.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true }
                if #available(iOS 16.0, *) { req.addsPunctuation = true }
                self.request = req
                let input = self.engine.inputNode
                let format = input.outputFormat(forBus: 0)
                input.removeTap(onBus: 0)
                input.installTap(onBus: 0, bufferSize: 1024, format: format) { buf, _ in req.append(buf) }
                self.engine.prepare()
                try self.engine.start()
                self.running = true
                self.task = recognizer.recognitionTask(with: req) { result, error in
                    if let r = result {
                        self.notifyListeners("partial", data: ["text": r.bestTranscription.formattedString])
                    }
                    if error != nil || (result?.isFinal ?? false) {
                        DispatchQueue.main.async {
                            let wasRunning = self.running
                            self.teardown()
                            if wasRunning { self.notifyListeners("end", data: [:]) }
                        }
                    }
                }
                call.resolve()
            } catch {
                self.teardown()
                call.reject("无法启动录音：\(error.localizedDescription)", "audio-capture")
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.teardown()
            call.resolve()
        }
    }

    private func teardown() {
        running = false
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
    }
}
