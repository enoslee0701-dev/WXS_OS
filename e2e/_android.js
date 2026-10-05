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
// 页面自己刷新后（例如登录后），旧版 WebView 上原来的页面对象会失效：重新找到当前页面，并等到满足条件
async function currentPage(d, until, timeout) {
  const end = Date.now() + (timeout || 20000);
  while (Date.now() < end) {
    const pid = String(await d.shell(`pidof ${PKG}`)).trim();
    const w = d.webViews().find(x => x.pkg() === PKG && String(x.pid()) === pid);
    if (w) { try { const p = await w.page(); if (await p.evaluate(until || (() => !!window.__tm))) return p; } catch (e) {} }
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error('等不到页面就绪');
}
module.exports = { PKG, restartApp, currentPage };
