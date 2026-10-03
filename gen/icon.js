// 生成 App 图标（1024）和启动屏（2732），写入 iOS 工程。用法：node gen/icon.js
// 设计：深蓝渐变底 + 白色粗体「协同」+ 右上角暖色日出光弧（呼应首页日出背景）
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..'), XC = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets');
const mark = (size, radius) => `
<div style="width:${size}px;height:${size}px;border-radius:${radius}px;position:relative;overflow:hidden;
  background:radial-gradient(120% 90% at 85% 8%, rgba(255,186,102,.95) 0%, rgba(255,140,90,.55) 18%, rgba(70,110,220,0) 46%),
             linear-gradient(160deg,#2A55D4 0%,#1B347F 55%,#121C3A 100%)">
  <svg viewBox="0 0 1024 1024" width="${size}" height="${size}" style="position:absolute;inset:0">
    <circle cx="872" cy="150" r="78" fill="#FFE2B0" opacity=".95"/>
    <path d="M120 905 C 380 800, 650 770, 910 810" stroke="rgba(255,255,255,.22)" stroke-width="10" fill="none" stroke-linecap="round"/>
  </svg>
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    font:900 ${size * 0.3}px/1 'PingFang SC','Hiragino Sans GB','Heiti SC',sans-serif;color:#fff;letter-spacing:${size * -0.01}px;
    text-shadow:0 ${size * 0.012}px ${size * 0.04}px rgba(10,20,50,.35);padding-top:${size * 0.02}px">协同</div>
</div>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 1 });
  // 图标：不透明、无圆角（系统自动裁圆角）
  await p.setViewportSize({ width: 1024, height: 1024 });
  await p.setContent(`<body style="margin:0">${mark(1024, 0)}</body>`); await p.waitForTimeout(200);
  const icon = path.join(XC, 'AppIcon.appiconset', 'AppIcon-512@2x.png');
  await p.screenshot({ path: icon, omitBackground: false });
  fs.copyFileSync(icon, path.join(ROOT, 'img', 'app-icon.png'));
  // 启动屏：白底，中间小图标 + 名称（系统按 aspectFill 缩放，内容放中间安全区）
  await p.setViewportSize({ width: 2732, height: 2732 });
  await p.setContent(`<body style="margin:0;width:2732px;height:2732px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px">
    ${mark(360, 82)}<div style="font:700 92px 'PingFang SC',sans-serif;color:#141B2D;letter-spacing:6px">团队协同</div></body>`);
  await p.waitForTimeout(200);
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await p.screenshot({ path: path.join(XC, 'Splash.imageset', f) });
  await b.close(); console.log('已生成图标和启动屏');
})();
