// 依次运行 e2e/*.js（Playwright 端到端测试），汇总结果。用法：npm run e2e [-- 关键字]
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..'), dir = path.join(root, 'e2e'), shots = path.join(dir, 'shots');
if (!fs.existsSync(path.join(root, 'dist', 'team-ops.html'))) { console.error('请先运行 npm run build'); process.exit(1); }
fs.mkdirSync(shots, { recursive: true });
const filter = process.argv[2] || '';
const files = fs.readdirSync(dir).filter(f => /^e2e.*\.js$/.test(f) && f.includes(filter)).sort();
let bad = [];
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, f)], { cwd: shots, encoding: 'utf8', timeout: 180000 });
  const out = (r.stdout || '') + (r.stderr || ''), last = out.trim().split('\n').pop() || '';
  const ok = r.status === 0 && /失败\s*0/.test(last) && !/✗/.test(out);
  console.log((ok ? '✓ ' : '✗ ') + f.padEnd(16) + ' ' + last.slice(0, 60) + '  (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
  if (!ok) { bad.push(f); out.split('\n').filter(l => /✗|Error|error/.test(l)).slice(0, 8).forEach(l => console.log('    ' + l)); }
}
console.log(`\n端到端：${files.length - bad.length}/${files.length} 组通过` + (bad.length ? '，失败：' + bad.join('、') : ''));
process.exit(bad.length ? 1 : 0);
