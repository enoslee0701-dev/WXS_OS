// 开发模式：改动源码后自动重新构建 dist/team-ops.html。用法：npm run dev
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const watch = ['app.js', 'engine.js', 'style.css', 'shell.html', 'img'];
let timer = null;
function build() { const r = spawnSync(process.execPath, [path.join(root, 'build.js')], { encoding: 'utf8' }); const msg = (r.stdout || r.stderr || '').trim(); console.log(new Date().toLocaleTimeString() + (r.status === 0 ? '  ✓ ' : '  ✗ ') + msg); }
build();
watch.forEach(w => fs.watch(path.join(root, w), () => { clearTimeout(timer); timer = setTimeout(build, 150); }));
console.log('监听中：' + watch.join('、') + '。浏览器打开 dist/team-ops.html，改完刷新即可。Ctrl+C 退出');
