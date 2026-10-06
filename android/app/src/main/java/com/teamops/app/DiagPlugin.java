package com.teamops.app;

import android.content.Context;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * 诊断：记录 App 闪退的原因（Java 异常、网页渲染进程崩溃），下次打开时由 JS 读取并提示用户。
 * lastCrash() → {text}（没有记录时 text 为空），读取后删除。
 */
@CapacitorPlugin(
    name = "Diag",
    permissions = {
        // Android 16 起的「本地网络保护」：连同一 Wi-Fi 里的团队服务器需要这个权限（Android 17 起强制；16 上测试时用「附近 Wi-Fi 设备」权限）
        @com.getcapacitor.annotation.Permission(alias = "localnet", strings = { "android.permission.ACCESS_LOCAL_NETWORK" }),
        @com.getcapacitor.annotation.Permission(alias = "nearby", strings = { "android.permission.NEARBY_WIFI_DEVICES" })
    }
)
public class DiagPlugin extends Plugin {
    private static final String FILE = "last_crash.txt";

    static void installCrashHandler(Context ctx) {
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        if (prev instanceof Marker) return;
        Thread.setDefaultUncaughtExceptionHandler(new Marker() {
            @Override
            public void uncaughtException(Thread t, Throwable e) {
                try { record(ctx, "App 异常（线程 " + t.getName() + "）", e); } catch (Throwable ignored) {}
                if (prev != null) prev.uncaughtException(t, e);
            }
        });
    }

    private abstract static class Marker implements Thread.UncaughtExceptionHandler {}

    static void record(Context ctx, String what, Throwable e) {
        StringBuilder sb = new StringBuilder();
        sb.append(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.CHINA).format(new Date())).append('\n');
        sb.append(what).append('\n');
        sb.append("手机：").append(Build.MANUFACTURER).append(' ').append(Build.MODEL)
          .append("，Android ").append(Build.VERSION.RELEASE).append("（API ").append(Build.VERSION.SDK_INT).append("）\n");
        try {
            android.content.pm.PackageInfo pi = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            sb.append("版本：").append(pi.versionName).append('\n');
        } catch (Exception ignored) {}
        if (e != null) {
            StringWriter sw = new StringWriter();
            e.printStackTrace(new PrintWriter(sw));
            String s = sw.toString();
            sb.append(s.length() > 6000 ? s.substring(0, 6000) : s);
        }
        try (FileOutputStream out = new FileOutputStream(new File(ctx.getFilesDir(), FILE))) {
            out.write(sb.toString().getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void lastCrash(PluginCall call) {
        File f = new File(getContext().getFilesDir(), FILE);
        String text = "";
        if (f.exists()) {
            try (FileInputStream in = new FileInputStream(f)) {
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                byte[] buf = new byte[4096]; int n;
                while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                text = new String(bo.toByteArray(), StandardCharsets.UTF_8);
            } catch (Exception ignored) {}
            //noinspection ResultOfMethodCallIgnored
            f.delete();
        }
        JSObject r = new JSObject();
        r.put("text", text);
        call.resolve(r);
    }

    /** 手机当前的局域网 IPv4 地址（用来在同一个 Wi-Fi 里自动查找团队服务器；不需要任何权限） */
    @PluginMethod
    public void netInfo(PluginCall call) {
        com.getcapacitor.JSArray ips = new com.getcapacitor.JSArray();
        try {
            java.util.Enumeration<java.net.NetworkInterface> it = java.net.NetworkInterface.getNetworkInterfaces();
            while (it != null && it.hasMoreElements()) {
                java.net.NetworkInterface ni = it.nextElement();
                if (!ni.isUp() || ni.isLoopback()) continue;
                java.util.Enumeration<java.net.InetAddress> as = ni.getInetAddresses();
                while (as.hasMoreElements()) {
                    java.net.InetAddress a = as.nextElement();
                    if (a instanceof java.net.Inet4Address && a.isSiteLocalAddress()) ips.put(a.getHostAddress());
                }
            }
        } catch (Exception ignored) {}
        JSObject r = new JSObject();
        r.put("ips", ips);
        call.resolve(r);
    }

    /** 用系统原生网络访问一个地址（不经过 App 里的浏览器内核）：用来判断连不上服务器是网络问题还是浏览器内核的限制 */
    @PluginMethod
    public void httpGet(PluginCall call) {
        final String u = call.getString("url", "");
        new Thread(() -> {
            JSObject r = new JSObject();
            java.net.HttpURLConnection c = null;
            try {
                c = (java.net.HttpURLConnection) new java.net.URL(u).openConnection();
                c.setConnectTimeout(4000); c.setReadTimeout(4000);
                int code = c.getResponseCode();
                java.io.InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
                ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] buf = new byte[2048]; int n;
                while (in != null && (n = in.read(buf)) > 0 && bo.size() < 8192) bo.write(buf, 0, n);
                r.put("ok", true); r.put("status", code); r.put("body", new String(bo.toByteArray(), StandardCharsets.UTF_8));
            } catch (Exception e) {
                r.put("ok", false); r.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
            } finally { if (c != null) c.disconnect(); }
            call.resolve(r);
        }).start();
    }

    /** 本机系统版本和本地网络相关权限状态 */
    @PluginMethod
    public void netState(PluginCall call) {
        JSObject r = new JSObject();
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("device", Build.MANUFACTURER + " " + Build.MODEL + " · Android " + Build.VERSION.RELEASE);
        r.put("localnet", getPermissionState("localnet").toString());
        r.put("nearby", getPermissionState("nearby").toString());
        call.resolve(r);
    }

    /** 测试用：模拟一次闪退记录（不会真的让 App 崩溃） */
    @PluginMethod
    public void simulate(PluginCall call) {
        record(getContext(), "测试记录", new RuntimeException("模拟的异常"));
        call.resolve();
    }
}
