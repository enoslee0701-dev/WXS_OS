package com.teamops.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 闪退时把原因记下来，下次打开 App 时显示给用户（可复制发给开发者）
        DiagPlugin.installCrashHandler(getApplicationContext());
        // 本地插件要在 super.onCreate 之前注册
        registerPlugin(SpeechPlugin.class);
        registerPlugin(DiagPlugin.class);
        super.onCreate(savedInstanceState);
        // 网页渲染进程被系统杀掉或崩溃（内存不足、内核问题）：系统默认会让整个 App 闪退。
        // 这里记下原因并重建页面，用户最多看到页面重新加载一次
        if (bridge != null && bridge.getWebView() != null) {
            // 手机系统字体调大时 WebView 会按同样比例放大文字；页面是按固定尺寸设计的，最多跟随到 115%，避免卡片重叠
            float scale = getResources().getConfiguration().fontScale;
            bridge.getWebView().getSettings().setTextZoom(Math.round(Math.min(scale, 1.15f) * 100));
        }
        if (bridge != null) {
            bridge.addWebViewListener(new WebViewListener() {
                @Override
                public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                    boolean crashed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && detail != null && detail.didCrash();
                    DiagPlugin.record(getApplicationContext(), crashed ? "网页渲染进程崩溃" : "网页渲染进程被系统回收（内存不足）", null);
                    runOnUiThread(MainActivity.this::recreate);
                    return true;
                }
            });
        }
    }
}
