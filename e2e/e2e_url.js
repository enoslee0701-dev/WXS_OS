// 连接团队服务器：地址写法容错（中文键盘的全角冒号、漏写 http:// 和端口）；输入框不会被浏览器的「网址格式」校验拦住
const { chromium, devices } = require('playwright');
const URL = (require('./_env').URL);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
(async () => {
  const b = await chromium.launch(); const c = await b.newContext({ ...devices['Pixel 7'] });
  await c.route('http://192.168.1.108:8787/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"ok":true,"setup":true}' }));
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('[data-do=srvConnect]'); await p.waitForSelector('#layer .sheet input[name=server]');
  ok(await p.getAttribute('#layer .sheet input[name=server]', 'type') === 'text', '地址输入框是普通文本（不会被网址格式校验拦住）');
  await p.fill('#layer .sheet input[name=server]', ' 192.168.1.108：8787 ');
  await Promise.all([p.waitForNavigation({ timeout: 5000 }).catch(() => {}), p.click('#layer .sheet footer button[type=submit]')]);
  await p.waitForTimeout(800);
  ok(await p.evaluate(() => localStorage.getItem('tm_server')) === 'http://192.168.1.108:8787', '全角冒号、空格、漏写 http:// 都能连：' + await p.evaluate(() => localStorage.getItem('tm_server')));
  const bt = await p.textContent('#app'); ok(await p.locator('form[data-form=srvLogin]').count() === 1 && !bt.includes('连不上'), '连上后显示登录 ' + bt.slice(0, 120));
  // 自动查找：同一 Wi-Fi 里只有 192.168.1.108 上有团队服务器，其他地址都不通；以前存了错的地址（示例地址）也能纠正
  await p.evaluate(() => { localStorage.setItem('tm_server', 'http://192.168.1.20:8787'); }); await c.route(/^http:\/\/(192\.168|10\.0)\.\d+\.\d+:8787\//, r => r.request().url().startsWith('http://192.168.1.108:8787/') ? r.fallback() : r.abort());
  await p.reload(); await p.waitForSelector('[data-do=srvScan]');
  ok(await p.evaluate(() => { scrollTo(0, 0); document.documentElement.style.setProperty('--safe-area-inset-top', '40px'); const top = document.querySelector('.login .mark').getBoundingClientRect().top; document.documentElement.style.removeProperty('--safe-area-inset-top'); return top >= 40; }), '登录页标题在状态栏下面（模拟安卓注入的 40px 状态栏）');
  await p.click('[data-do=srvScan]');
  await p.waitForFunction(() => document.querySelector('input[name=server]').value === 'http://192.168.1.108:8787', null, { timeout: 30000 }).catch(() => {});
  ok(await p.inputValue('input[name=server]') === 'http://192.168.1.108:8787', '自动查找：找到同一 Wi-Fi 里的团队服务器并填好 ' + await p.inputValue('input[name=server]'));
  ok(!(await p.textContent('#app')).includes('连不上服务器'), '找到后不再显示「连不上」');
  // 公网地址（临时公网通道等）：漏写协议时补 https，不改端口；局域网主机名 .local 仍是 http
  ok(await p.evaluate(() => [TMS.normUrl('auto-briefly-struct-legacy.trycloudflare.com'), TMS.normUrl('https://team.example.com/'), TMS.normUrl('macpro.local:8787'), TMS.normUrl('localhost:8787')].join(' ')) ===
    'https://auto-briefly-struct-legacy.trycloudflare.com https://team.example.com http://macpro.local:8787 http://localhost:8787', '公网域名默认 https，局域网仍 http');
  ok(errs.length === 0, '无报错 ' + errs.join('|'));
  console.log(`服务器地址 E2E 通过 ${pass}，失败 ${fail}`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
