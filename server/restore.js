/* 从备份恢复团队数据（先停服务器再运行）。
   用法：node server/restore.js <备份文件> --yes
     备份文件可以是 data/backups/state-YYYY-MM-DD.json（每日自动备份），也可以是「导出全部数据」下载的文件。
   恢复前会把当前数据另存为 data/backups/before-restore-<时间>.json；账号和密码不受影响。
   环境变量 DATA_DIR 同服务器（默认 server/data）。 */
'use strict';
const fs = require('fs'), path = require('path');
const { DatabaseSync } = require('node:sqlite');
const TM = require('../engine.js');

const file = process.argv[2], yes = process.argv.includes('--yes');
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
if (!file) { console.error('用法：node server/restore.js <备份文件> --yes'); process.exit(1); }
let raw; try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('读不了备份文件：' + e.message); process.exit(1); }
const state = raw && raw.state && raw.state.users ? raw.state : raw; // 导出文件里数据在 state 字段
if (!state || state.v !== 3 || !Array.isArray(state.users) || !state.users.some(u => TM.hasRole(state, u.id, 'owner'))) { console.error('这不是有效的团队数据备份（缺少版本号或老板）'); process.exit(1); }
const dbf = path.join(DATA, 'team.db');
if (!fs.existsSync(dbf)) { console.error('数据目录里没有 team.db：' + DATA); process.exit(1); }
console.log(`备份里有：${state.users.length} 位成员、${state.ideas.length} 个想法、${state.workItems.length} 个项目、${state.tasks.length} 个任务`);
if (!yes) { console.log('确认要用它覆盖当前数据，请在命令最后加 --yes（请先停掉服务器）'); process.exit(0); }
const db = new DatabaseSync(dbf);
const cur = db.prepare("SELECT v FROM meta WHERE k='state'").get();
fs.mkdirSync(path.join(DATA, 'backups'), { recursive: true });
if (cur) { const f = path.join(DATA, 'backups', 'before-restore-' + Date.now() + '.json'); fs.writeFileSync(f, cur.v); console.log('当前数据已另存：' + f); }
const ver = (+(db.prepare("SELECT v FROM meta WHERE k='version'").get() || {}).v || 1) + 1; // 版本号往前走，在线的手机会自动拉取新数据
const up = db.prepare('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v');
up.run('state', JSON.stringify(TM.migrate(state))); up.run('version', String(ver));
console.log('已恢复。重新启动服务器即可。');
