package com.teamops.app;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognitionService;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.ArrayList;
import java.util.List;

/**
 * 原生语音识别（Android SpeechRecognizer），接口与 iOS 版 SpeechPlugin.swift 相同。
 * JS 端由 native.js 包装成浏览器 SpeechRecognition 接口。
 * 事件：partial {text: 本次会话到目前为止的全文}、end {}、error {error, code, tried, service, device}
 * Android 的识别器说完一句就停：这里把每句的结果累加起来，并在会话没结束时自动接着听。
 *
 * 国产手机上系统默认的识别服务经常不让第三方 App 用、连不上它的服务器、或不认 zh-CN：
 * 一启动就出错时，自动换下一个候选（上次能用的 → 默认服务 → 离线识别 → 手机上其他识别服务），
 * 每个候选再试一种中文写法；能出结果的那个记下来，下次直接用。全部失败才报错（带上错误代码，方便排查）。
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
    private static final String PREF = "speech", PREF_KEY = "works";
    private static final String DEFAULT = "default", ON_DEVICE = "ondevice";
    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer rec;
    private boolean running = false;
    private String lang = "zh-CN";
    private boolean offline = false;
    private String done = ""; // 已经说完的句子
    private int busyRetry = 0;
    // 候选识别器与当前进度
    private final List<String> cands = new ArrayList<>();
    private int ci = 0;
    private int li = 0;            // 当前候选用的第几种中文写法
    private boolean gotResult = false; // 当前候选出过结果（之后出错就不再换候选）
    private final JSArray tried = new JSArray();
    private int lastCode = 0;

    private static final String[] LANG_ALT = { "zh-CN", "cmn-Hans-CN", "zh" };

    @PluginMethod
    public void available(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()) || onDeviceAvailable());
        call.resolve(r);
    }

    /** 诊断：默认识别服务、手机上所有识别服务、离线识别是否可用、上次能用的是哪个 */
    @PluginMethod
    public void diagnose(PluginCall call) {
        JSObject r = new JSObject();
        r.put("device", device());
        r.put("defaultService", defaultService());
        JSArray all = new JSArray();
        for (String s : services()) all.put(s);
        r.put("services", all);
        r.put("onDevice", onDeviceAvailable());
        r.put("works", prefs().getString(PREF_KEY, ""));
        call.resolve(r);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) { call.reject("没有麦克风权限", "not-allowed"); return; }
        lang = call.getString("lang", "zh-CN");
        offline = Boolean.TRUE.equals(call.getBoolean("onDevice", false));
        main.post(() -> {
            teardown();
            done = "";
            busyRetry = 0;
            buildCandidates();
            if (cands.isEmpty()) { call.reject("这台手机没有可用的语音识别服务", "unavailable"); return; }
            ci = 0; li = 0; gotResult = false; lastCode = 0;
            while (tried.length() > 0) tried.remove(0);
            running = true;
            try {
                listen();
                call.resolve();
            } catch (Exception e) {
                if (!next()) { running = false; call.reject("无法启动语音识别：" + e.getMessage(), "audio-capture"); }
                else call.resolve();
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> { teardown(); call.resolve(); });
    }

    private void buildCandidates() {
        cands.clear();
        String works = prefs().getString(PREF_KEY, "");
        List<String> order = new ArrayList<>();
        if (offline && onDeviceAvailable()) order.add(ON_DEVICE);
        if (!works.isEmpty()) order.add(works);
        if (SpeechRecognizer.isRecognitionAvailable(getContext())) order.add(DEFAULT);
        if (onDeviceAvailable()) order.add(ON_DEVICE);
        for (String s : services()) order.add(s);
        for (String s : order) if (!cands.contains(s)) cands.add(s);
    }

    private SpeechRecognizer create(String cand) {
        Context ctx = getContext();
        if (ON_DEVICE.equals(cand) && Build.VERSION.SDK_INT >= 31) return SpeechRecognizer.createOnDeviceSpeechRecognizer(ctx);
        if (DEFAULT.equals(cand) || ON_DEVICE.equals(cand)) return SpeechRecognizer.createSpeechRecognizer(ctx);
        ComponentName cn = ComponentName.unflattenFromString(cand);
        return cn != null ? SpeechRecognizer.createSpeechRecognizer(ctx, cn) : SpeechRecognizer.createSpeechRecognizer(ctx);
    }

    private void listen() {
        if (rec == null) {
            rec = create(cands.get(ci));
            rec.setRecognitionListener(listener);
        }
        String l = li == 0 ? lang : LANG_ALT[Math.min(li, LANG_ALT.length - 1)];
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, l);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, l);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, offline || ON_DEVICE.equals(cands.get(ci)));
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        rec.startListening(i);
    }

    /** 当前候选一启动就失败：先换一种中文写法，再换下一个识别器。没有可换的了返回 false */
    private boolean next() {
        destroyRec();
        if (li < 1) { li++; } else { li = 0; ci++; }
        if (ci >= cands.size()) return false;
        try { listen(); return true; } catch (Exception e) { return next(); }
    }

    private void destroyRec() {
        if (rec != null) {
            try { rec.cancel(); rec.destroy(); } catch (Exception ignored) {}
            rec = null;
        }
    }

    private void teardown() {
        running = false;
        destroyRec();
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

    private void markWorks() {
        if (gotResult) return;
        gotResult = true;
        try { prefs().edit().putString(PREF_KEY, cands.get(ci)).apply(); } catch (Exception ignored) {}
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
                if (!t.isEmpty()) { markWorks(); emitPartial(join(t)); }
            } catch (Exception e) { fail("aborted"); }
        }

        @Override public void onResults(Bundle b) {
            try {
                if (!running) return;
                String t = best(b);
                if (!t.isEmpty()) { markWorks(); done = join(t); emitPartial(done); }
                restart();
            } catch (Exception e) { fail("aborted"); }
        }

        @Override public void onError(int error) {
            if (!running) return;
            lastCode = error;
            // 没听到声音、没识别出内容：会话还没结束就接着听
            if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) { restart(); return; }
            // 识别器忙（上一次还没释放）：换一个新的识别器再试
            if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY && busyRetry++ < 2) {
                main.postDelayed(() -> {
                    if (!running) return;
                    try { destroyRec(); listen(); } catch (Exception e) { fail("aborted"); }
                }, 300);
                return;
            }
            // 当前识别器一次结果都没出过就失败（服务不让用 / 连不上 / 不认语言）：自动换下一个
            if (!gotResult && error != SpeechRecognizer.ERROR_AUDIO) {
                tried.put(cands.get(ci) + "#" + error);
                if (cands.get(ci).equals(prefs().getString(PREF_KEY, ""))) prefs().edit().remove(PREF_KEY).apply();
                if (next()) return;
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

    // 出错：停掉识别器并通知页面（页面会提示，录音本身不受影响）。带上错误代码和试过的识别器，方便排查
    private void fail(String code) {
        try { teardown(); } catch (Exception ignored) {}
        try {
            JSObject d = new JSObject();
            d.put("error", code);
            d.put("code", lastCode);
            d.put("tried", tried);
            d.put("service", defaultService());
            d.put("device", device());
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

    private SharedPreferences prefs() { return getContext().getSharedPreferences(PREF, Context.MODE_PRIVATE); }

    private boolean onDeviceAvailable() {
        try { return Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext()); } catch (Exception e) { return false; }
    }

    private String defaultService() {
        try { String s = Settings.Secure.getString(getContext().getContentResolver(), "voice_recognition_service"); return s == null ? "" : s; } catch (Exception e) { return ""; }
    }

    private List<String> services() {
        List<String> out = new ArrayList<>();
        try {
            List<ResolveInfo> l = getContext().getPackageManager().queryIntentServices(new Intent(RecognitionService.SERVICE_INTERFACE), 0);
            for (ResolveInfo ri : l) if (ri.serviceInfo != null) out.add(new ComponentName(ri.serviceInfo.packageName, ri.serviceInfo.name).flattenToString());
        } catch (Exception ignored) {}
        return out;
    }

    private static String device() {
        return Build.MANUFACTURER + " " + Build.MODEL + " · Android " + Build.VERSION.RELEASE + "（API " + Build.VERSION.SDK_INT + "）";
    }

    @Override
    protected void handleOnDestroy() { teardown(); }
}
