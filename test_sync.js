// 同步一致性：客户端是在「按身份裁剪后的数据」上先执行操作，再发给服务器在完整数据上执行。
// 这里把 test.js 的每一步操作都同时做两遍，检查：
//   1. 客户端执行失败、服务器却会成功 → 用户点了没反应（严重）
//   2. 客户端成功、服务器失败 → 会弹「没能同步」（应当没有）
//   3. 两边都成功但生成的 ID 不同 → 页面地址和后续操作要修正（应当没有）
const TM = require('./engine.js');
const orig = TM.act, bad = [], log = console.log;
let n = 0;
TM.act = function (s, uid, name, p) {
  if (uid === 'agent' || !s || !s.users || !TM.user(s, uid)) return orig.apply(this, arguments);
  let rc;
  try { rc = orig(TM.viewFor(s, uid), uid, name, JSON.parse(JSON.stringify(p || {}))); } catch (e) { rc = { ok: false, error: '客户端抛异常：' + e.message }; }
  const rs = orig(s, uid, name, p); n++;
  if (rc.ok !== rs.ok) bad.push(`${name}（${uid}）客户端${rc.ok ? '成功' : '失败：' + rc.error} / 服务器${rs.ok ? '成功' : '失败：' + rs.error}`);
  else if (rs.ok) Object.keys(rs).forEach(k => { if (typeof rs[k] === 'string' && rc[k] !== rs[k]) bad.push(`${name}（${uid}）返回的 ${k} 不一致：客户端 ${rc[k]} / 服务器 ${rs[k]}`); });
  return rs;
};
process.on('exit', (code) => {
  [...new Set(bad)].forEach(x => log('✗ ' + x));
  log(`\n同步一致性：检查 ${n} 次操作，不一致 ${new Set(bad).size}`);
  if (bad.length) process.exitCode = 1;
});
// 不打印 test.js 自己的逐条输出，只关心一致性
console.log = () => {};
require('./test.js');
