/* 从备份恢复团队数据（先停服务器再运行）。
   用法：node server/restore.js <备份文件> --yes
     备份文件可以是：
       - data/backups/state-YYYY-MM-DD.json（每日自动备份，只有团队数据）
       - 「导出全部数据」下载的 .json（只有团队数据）
       - 「完整备份」下载的 .tar.gz（团队数据 + 全部附件）：附件会放回 data/files，已有的不覆盖
   恢复前会把当前数据另存为 data/backups/before-restore-<时间>.json；账号和密码不受影响。
   环境变量 DATA_DIR 同服务器（默认 server/data）。 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { DatabaseSync } = require('node:sqlite');
const TM = require('../engine.js');

const file = process.argv[2], yes = process.argv.includes('--yes');
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const FILE_ID = /^[A-Za-z0-9_-]{4,64}$/;
if (!file) { console.error('用法：node server/restore.js <备份文件> --yes'); process.exit(1); }

/* 流式读 .tar.gz：onEntry(name, size) 返回一个可写流（或 null 跳过），读完调用 done */
function readTgz(f, onEntry) {
  return new Promise((ok, bad) => {
    let buf = Buffer.alloc(0), cur = null, left = 0, padLeft = 0, ended = false;
    const src = fs.createReadStream(f).pipe(zlib.createGunzip());
    src.on('error', bad);
    src.on('data', (ch) => {
      buf = Buffer.concat([buf, ch]);
      for (;;) {
        if (ended) return;
        if (left > 0) { const n = Math.min(left, buf.length); if (!n) return; if (cur) cur.write(buf.subarray(0, n)); buf = buf.subarray(n); left -= n; if (!left && cur) { cur.end(); cur = null; } continue; }
        if (padLeft > 0) { const n = Math.min(padLeft, buf.length); if (!n) return; buf = buf.subarray(n); padLeft -= n; continue; }
        if (buf.length < 512) return;
        const h = buf.subarray(0, 512); buf = buf.subarray(512);
        if (h.every(b => b === 0)) { ended = true; return; }
        const name = h.subarray(0, 100).toString('utf8').replace(/\0.*$/s, ''), size = parseInt(h.subarray(124, 136).toString('utf8').replace(/\0.*$/s, '').trim() || '0', 8);
        cur = onEntry(name, size); left = size; padLeft = size % 512 ? 512 - size % 512 : 0;
        if (!left && cur) { cur.end(); cur = null; }
      }
    });
    src.on('end', () => ok());
  });
}

(async () => {
  const isTgz = /\.(tar\.gz|tgz)$/i.test(file);
  let raw, fileCount = 0; const tmpFiles = path.join(DATA, 'restore-tmp-' + Date.now());
  try {
    if (isTgz) {
      let json = [];
      fs.mkdirSync(tmpFiles, { recursive: true });
      await readTgz(file, (name, size) => {
        if (name === 'team-export.json') { return { write: (b) => json.push(Buffer.from(b)), end: () => {} }; }
        const m = /^files\/([A-Za-z0-9_-]{4,64})$/.exec(name); if (!m) return null;
        fileCount++; return fs.createWriteStream(path.join(tmpFiles, m[1]));
      });
      raw = JSON.parse(Buffer.concat(json).toString('utf8'));
    } else raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { console.error('读不了备份文件：' + e.message); fs.rmSync(tmpFiles, { recursive: true, force: true }); process.exit(1); }
  const state = raw && raw.state && raw.state.users ? raw.state : raw; // 导出文件里数据在 state 字段
  if (!state || state.v !== 3 || !Array.isArray(state.users) || !state.users.some(u => TM.hasRole(state, u.id, 'owner'))) { console.error('这不是有效的团队数据备份（缺少版本号或老板）'); fs.rmSync(tmpFiles, { recursive: true, force: true }); process.exit(1); }
  const dbf = path.join(DATA, 'team.db');
  if (!fs.existsSync(dbf)) { console.error('数据目录里没有 team.db：' + DATA); fs.rmSync(tmpFiles, { recursive: true, force: true }); process.exit(1); }
  console.log(`备份里有：${state.users.length} 位成员、${state.ideas.length} 个想法、${state.workItems.length} 个项目、${state.tasks.length} 个任务` + (isTgz ? `、${fileCount} 个附件` : ''));
  if (!yes) { console.log('确认要用它覆盖当前数据，请在命令最后加 --yes（请先停掉服务器）'); fs.rmSync(tmpFiles, { recursive: true, force: true }); process.exit(0); }
  const db = new DatabaseSync(dbf);
  const cur = db.prepare("SELECT v FROM meta WHERE k='state'").get();
  fs.mkdirSync(path.join(DATA, 'backups'), { recursive: true });
  if (cur) { const f = path.join(DATA, 'backups', 'before-restore-' + Date.now() + '.json'); fs.writeFileSync(f, cur.v); console.log('当前数据已另存：' + f); }
  const ver = (+(db.prepare("SELECT v FROM meta WHERE k='version'").get() || {}).v || 1) + 1; // 版本号往前走，在线的手机会自动拉取新数据
  const up = db.prepare('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v');
  up.run('state', JSON.stringify(TM.migrate(state))); up.run('version', String(ver));
  if (isTgz) {
    // 附件放回 data/files（已有的不覆盖），并补上附件记录
    const FILES = path.join(DATA, 'files'); fs.mkdirSync(FILES, { recursive: true });
    const ins = db.prepare('INSERT OR IGNORE INTO files(id,uid,name,type,size,created) VALUES(?,?,?,?,?,?)');
    let n = 0;
    for (const id of fs.readdirSync(tmpFiles)) { if (!FILE_ID.test(id)) continue; const dst = path.join(FILES, id); if (!fs.existsSync(dst)) { fs.renameSync(path.join(tmpFiles, id), dst); n++; } }
    (Array.isArray(raw.files) ? raw.files : []).forEach(f => { if (f && FILE_ID.test(String(f.id)) && fs.existsSync(path.join(FILES, f.id))) ins.run(f.id, String(f.uid || ''), String(f.name || ''), String(f.type || ''), +f.size || 0, +f.created || Date.now()); });
    console.log('附件已放回：' + n + ' 个（已有的没有覆盖）');
  }
  fs.rmSync(tmpFiles, { recursive: true, force: true });
  console.log('已恢复。重新启动服务器即可。');
})();
