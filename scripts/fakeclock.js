// 假时钟预加载：Date 和 setTimeout / setInterval 都按「真实时间 + 偏移」走，偏移从 CLOCK_FILE 读（毫秒），每 100ms 看一次。
// 用法：CLOCK_FILE=/path/offset node -r ./fakeclock.js server/server.js
const fs = require('fs'), FILE = process.env.CLOCK_FILE;
const RealDate = Date, rNow = RealDate.now.bind(RealDate), rST = global.setTimeout, rSI = global.setInterval, rCT = global.clearTimeout, rCI = global.clearInterval;
let off = 0; const readOff = () => { try { off = +fs.readFileSync(FILE, 'utf8') || 0; } catch (e) {} };
readOff();
const fnow = () => rNow() + off;
class FakeDate extends RealDate { constructor(...a) { if (!a.length) super(fnow()); else super(...a); } static now() { return fnow(); } }
global.Date = FakeDate;
// 定时器：到期时间按假时钟算；真实的 100ms 轮询触发
const timers = new Map(); let seq = 1;
function mk(fn, ms, args, interval) { const id = seq++; const h = { id, unref() { return h; }, ref() { return h; }, hasRef() { return false; }, refresh() { timers.get(id).due = fnow() + ms; return h; }, [Symbol.toPrimitive]() { return id; } }; timers.set(id, { fn, args, due: fnow() + Math.max(0, +ms || 0), ms: Math.max(1, +ms || 1), interval, h }); return h; }
global.setTimeout = (fn, ms, ...args) => mk(fn, ms, args, false);
global.setInterval = (fn, ms, ...args) => mk(fn, ms, args, true);
global.clearTimeout = global.clearInterval = (h) => { if (h && typeof h === 'object' && 'id' in h) timers.delete(h.id); else if (typeof h === 'number') timers.delete(h); };
rSI(() => {
  readOff(); const t = fnow();
  for (const [id, x] of [...timers]) { if (x.due > t) continue; if (x.interval) x.due = t + x.ms; else timers.delete(id); try { x.fn(...x.args); } catch (e) { console.error('timer error', e); } }
}, 100).unref();
