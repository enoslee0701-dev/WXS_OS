// 安卓设备测试共用：重启 App，并按新进程号找到它的 WebView 页面（旧进程的 WebView 记录可能还在，直接拿会卡住）
const PKG = 'com.teamops.app';
async function restartApp(d) {
  await d.shell(`am force-stop ${PKG}`); await d.shell(`am start -n ${PKG}/.MainActivity`);
  let pid = ''; for (let i = 0; i < 60 && !pid; i++) { await new Promise(r => setTimeout(r, 250)); pid = String(await d.shell(`pidof ${PKG}`)).trim(); }
  for (let i = 0; i < 120; i++) {
    const w = d.webViews().find(x => x.pkg() === PKG && String(x.pid()) === pid);
    if (w) { const p = await w.page(); await p.waitForFunction(() => window.__tm, null, { timeout: 30000 }); return p; }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('找不到 App 的 WebView（App 是否是调试版？）');
}
module.exports = { PKG, restartApp };
