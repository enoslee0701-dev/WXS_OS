package com.teamops.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.ArrayList;

/**
 * 原生语音识别（Android SpeechRecognizer），接口与 iOS 版 SpeechPlugin.swift 相同。
 * JS 端由 native.js 包装成浏览器 SpeechRecognition 接口。
 * 事件：partial {text: 本次会话到目前为止的全文}、end {}、error {error}
 * Android 的识别器说完一句就停：这里把每句的结果累加起来，并在会话没结束时自动接着听。
 */
@CapacitorPlugin(
    name = "Speech",
    permissions = {
        // iOS 有「语音识别」和「麦克风」两项权限；Android 只需要麦克风，两个名字指向同一权限，JS 端不用区分平台
        @Permission(alias = "speech", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class SpeechPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer rec;
    private boolean running = false;
    private String lang = "zh-CN";
    private boolean offline = false;
    private String done = ""; // 已经说完的句子
    private int busyRetry = 0;

    @PluginMethod
    public void available(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) { call.reject("没有麦克风权限", "not-allowed"); return; }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) { call.reject("这台手机没有可用的语音识别服务", "unavailable"); return; }
        lang = call.getString("lang", "zh-CN");
        offline = Boolean.TRUE.equals(call.getBoolean("onDevice", false));
        main.post(() -> {
            teardown();
            done = "";
            busyRetry = 0;
            running = true;
            try {
                listen();
                call.resolve();
            } catch (Exception e) {
                running = false;
                call.reject("无法启动录音：" + e.getMessage(), "audio-capture");
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> { teardown(); call.resolve(); });
    }

    private void listen() {
        if (rec == null) {
            rec = SpeechRecognizer.createSpeechRecognizer(getContext());
            rec.setRecognitionListener(listener);
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, offline);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        rec.startListening(i);
    }

    private void teardown() {
        running = false;
        if (rec != null) {
            try { rec.cancel(); rec.destroy(); } catch (Exception ignored) {}
            rec = null;
        }
    }

    private String join(String cur) {
        if (cur == null || cur.isEmpty()) return done;
        return done.isEmpty() ? cur : done + "，" + cur;
    }

    private void emitPartial(String text) {
        JSObject d = new JSObject();
        d.put("text", text);
        notifyListeners("partial", d);
    }

    private static String best(Bundle b) {
        ArrayList<String> r = b == null ? null : b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return r == null || r.isEmpty() ? "" : r.get(0);
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) {}
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onEvent(int eventType, Bundle params) {}

        @Override public void onPartialResults(Bundle b) {
            try {
                if (!running) return;
                String t = best(b);
                if (!t.isEmpty()) emitPartial(join(t));
            } catch (Exception e) { fail("aborted"); }
        }

        @Override public void onResults(Bundle b) {
            try {
                if (!running) return;
                String t = best(b);
                if (!t.isEmpty()) { done = join(t); emitPartial(done); }
                restart();
            } catch (Exception e) { fail("aborted"); }
        }

        @Override public void onError(int error) {
            if (!running) return;
            // 没听到声音、没识别出内容：会话还没结束就接着听
            if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) { restart(); return; }
            // 识别器忙（上一次还没释放）：换一个新的识别器再试
            if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY && busyRetry++ < 2) {
                main.postDelayed(() -> {
                    if (!running) return;
                    try { if (rec != null) { rec.destroy(); rec = null; } listen(); } catch (Exception e) { fail("aborted"); }
                }, 300);
                return;
            }
            String code;
            switch (error) {
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: code = "not-allowed"; break;
                case SpeechRecognizer.ERROR_AUDIO: code = "audio-capture"; break;
                case SpeechRecognizer.ERROR_NETWORK:
                case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                case SpeechRecognizer.ERROR_SERVER: code = "network"; break;
                default: code = "aborted";
            }
            fail(code);
        }
    };

    // 出错：停掉识别器并通知页面（页面会提示，录音本身不受影响）
    private void fail(String code) {
        try { teardown(); } catch (Exception ignored) {}
        try {
            JSObject d = new JSObject();
            d.put("error", code);
            notifyListeners("error", d);
            notifyListeners("end", new JSObject());
        } catch (Exception ignored) {}
    }

    private void restart() {
        main.post(() -> {
            if (!running) return;
            try { listen(); } catch (Exception e) { fail("aborted"); }
        });
    }

    @Override
    protected void handleOnDestroy() { teardown(); }
}
