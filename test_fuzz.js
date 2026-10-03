// 随机操作测试：多个角色交替做几千次随机操作（参数取自当前数据里真实的 ID），每一步检查不变量
//   1. 引擎不抛意外异常  2. 裁剪不泄漏  3. 客户端（裁剪后）与服务器（完整）结果一致  4. ID 唯一
// 用法：node test_fuzz.js [次数=3000] [种子=7]
const TM = require('./engine.js');
const N = +process.argv[2] || 3000; let seed = +process.argv[3] || 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a.length ? a[Math.floor(rnd() * a.length)] : undefined;
const s = TM.migrate(TM.seed(() => Date.UTC(2026, 9, 1, 3)));
const bad = []; let okN = 0, rejN = 0;
const fail = (m) => { if (bad.length < 30) bad.push(m); };
const TEXT = ['换投影仪', '招两个前端', '预算两万元的年会', '官网改版并对外发布', '每周一开短会', '采购打印纸', '战略方向调整：转型做小程序', ''];
function payload(name) {
  const u = () => pick(s.users).id, i = () => (pick(s.ideas) || {}).id, w = () => (pick(s.workItems) || {}).id, t = () => (pick(s.tasks) || {}).id, d = () => (pick(s.decisions) || {}).id, td = () => (pick(s.todos || []) || {}).id;
  const task = () => ({ title: pick(TEXT) || '任务', ownerId: u(), expected: pick(['照片', '']), criteria: pick(['可用', '']) });
  switch (name) {
    case 'idea.create': return { note: pick(TEXT) };
    case 'idea.submit': return { id: i(), path: pick(['direct', 'cocreate']) };
    case 'idea.update': return { id: i(), note: pick(TEXT) };
    case 'idea.suggest': return { id: i(), body: pick(TEXT) || '同意' };
    case 'idea.close': case 'idea.claim': case 'idea.reanalyze': case 'idea.digest': case 'idea.retryAi': return { id: i() };
    case 'idea.confirm': return { id: i(), direction: pick(TEXT) };
    case 'idea.route': return { id: i(), kind: pick(['admin', 'product', 'other']), leadId: u(), title: pick(TEXT), tasks: [task()] };
    case 'idea.requestDecision': return { id: i(), kind: pick(['over_budget', 'personnel', 'other']), question: '要不要做？' };
    case 'idea.setStatus': return { id: i(), status: pick(['on_hold', 'declined', 'triage']), reason: '原因' };
    case 'idea.delete': return { id: i(), reason: 'x' };
    case 'decision.decide': return { id: d(), status: pick(['approved', 'rejected', 'needs_info']), note: pick(['', '先补充']) };
    case 'project.create': return { title: pick(TEXT) || '项目', ptype: pick(Object.keys(TM.PTYPE)), leadId: pick([u(), undefined]), operatorId: pick([u(), undefined]), tasks: [task(), task()] };
    case 'work.plan': return { id: w(), tasks: [task()] };
    case 'work.stage': return { id: w(), stage: pick(['prototype', 'dev', 'handle', 'verify']) };
    case 'work.close': case 'work.resume': return { id: w() };
    case 'work.pause': return { id: w(), reason: '暂停' };
    case 'work.attach': return { id: w(), media: [{ kind: 'file', name: 'a.pdf', localId: 'f' + Math.floor(rnd() * 1e6) }] };
    case 'task.transition': return { id: t(), action: pick(['accept', 'start', 'submit', 'block', 'unblock', 'cancel']), note: pick(['', '完成了']) };
    case 'task.review': return { id: t(), verdict: pick(['pass', 'return']), note: pick(['', '再改改']) };
    case 'task.ownerReview': return { id: t(), verdict: pick(['owner_pass', 'owner_return']), note: '看过' };
    case 'task.comment': return { id: t(), body: '加油' };
    case 'owner.override': return { id: t(), action: pick(['revoke', 'reassign']), ownerId: u(), reason: pick(['', '纠偏']) };
    case 'todo.create': return { title: pick(TEXT) || '待办', date: '2026-10-0' + (1 + Math.floor(rnd() * 8)), people: [u()] };
    case 'todo.toggle': case 'todo.delete': return { id: td() };
    case 'member.add': return { name: '新人' + Math.floor(rnd() * 1e4), title: '同工', role: pick(['executor', 'lead', 'operator', 'owner']), group: '行政运营' };
    case 'member.update': return { id: u(), motto: '加油', prefs: { notifyImportant: rnd() < 0.5 } };
    case 'settings.update': return pick([{ ownerApprovalMode: pick(['all', 'exceptions_only']) }, { staleDays: pick([3, 5, 'x']) }, { agentDirectRoute: rnd() < 0.5 }]);
    case 'kb.add': return { title: '资料' + Math.floor(rnd() * 100), body: '内容内容内容内容内容', scope: pick(['team', 'ai_only']) };
    case 'data.clearDemo': return {};
  }
  return {};
}
const ACTIONS = ['idea.create', 'idea.submit', 'idea.update', 'idea.suggest', 'idea.close', 'idea.claim', 'idea.reanalyze', 'idea.digest', 'idea.retryAi', 'idea.confirm', 'idea.route', 'idea.requestDecision', 'idea.setStatus', 'idea.delete', 'decision.decide', 'project.create', 'work.plan', 'work.stage', 'work.close', 'work.pause', 'work.resume', 'work.attach', 'task.transition', 'task.review', 'task.ownerReview', 'task.comment', 'owner.override', 'todo.create', 'todo.toggle', 'todo.delete', 'member.add', 'member.update', 'settings.update', 'kb.add', 'data.clearDemo'];
for (let k = 0; k < N; k++) {
  const name = rnd() < 0.003 ? 'data.clearDemo' : pick(ACTIONS.filter(a => a !== 'data.clearDemo')), p = payload(name);
  // 60% 由和这条记录相关的人来做（不然大多数操作都会被拒，走不到深层状态）
  let uid = pick(s.users).id;
  if (rnd() < 0.6 && p && p.id) {
    const d = s.ideas.find(x => x.id === p.id), t = s.tasks.find(x => x.id === p.id), w = s.workItems.find(x => x.id === p.id), dc = s.decisions.find(x => x.id === p.id);
    const owner = TM.usersWith(s, 'owner')[0], ops = TM.usersWith(s, 'operator');
    const cand = d ? [d.creatorId, d.followerId, owner, pick(ops)] : t ? [t.ownerId, t.reviewerId, owner] : w ? [w.leadId, w.operatorId, w.reviewerId, owner] : dc ? [owner] : [];
    uid = pick(cand.filter(x => x && TM.user(s, x))) || uid;
  }
  let rc, rs;
  try { rc = TM.act(TM.viewFor(s, uid), uid, name, JSON.parse(JSON.stringify(p))); } catch (e) { fail(`#${k} 客户端异常 ${name}（${uid}）：${e.message}`); continue; }
  try { rs = TM.act(s, uid, name, p); } catch (e) { fail(`#${k} 服务器异常 ${name}（${uid}）：${e.message}`); continue; }
  rs.ok ? okN++ : rejN++;
  if (rc.ok !== rs.ok) fail(`#${k} 结果不一致 ${name}（${uid}）客户端${rc.ok ? '成功' : '失败：' + rc.error} / 服务器${rs.ok ? '成功' : '失败：' + rs.error}`);
  else if (rs.ok) Object.keys(rs).forEach(x => { if (typeof rs[x] === 'string' && rc[x] !== rs[x]) fail(`#${k} ID 不一致 ${name}：${x} ${rc[x]} / ${rs[x]}`); });
  if (k % 25 === 0 || name === 'data.clearDemo') {
    ['ideas', 'workItems', 'tasks', 'summaries', 'decisions', 'notifications', 'events', 'todos', 'users'].forEach(c => { const ids = (s[c] || []).map(x => x.id), u = new Set(ids); if (u.size !== ids.length) fail(`#${k} ${c} 有重复 ID`); });
    s.users.forEach(u => {
      const v = TM.viewFor(s, u.id);
      if (v.ideas.some(d => d.status === 'draft' && d.creatorId !== u.id)) fail(`#${k} ${u.id} 拿到别人的草稿`);
      if (v.tasks.some(t => !v.workItems.some(w => w.id === t.workId))) fail(`#${k} ${u.id} 的任务找不到项目`);
      if (v.notifications.some(n => n.userId !== u.id)) fail(`#${k} ${u.id} 拿到别人的通知`);
      if ((v.todos || []).some(t => t.ownerId !== u.id && (t.people || []).indexOf(u.id) < 0)) fail(`#${k} ${u.id} 拿到别人的待办`);
      if (!TM.hasRole(s, u.id, 'owner') && v.decisions.some(x => x.ai)) fail(`#${k} ${u.id} 拿到老板的 AI 决策建议`);
      if (!TM.kbCan(s, u.id) && (v.knowledge || []).some(x => x.scope !== 'team')) fail(`#${k} ${u.id} 拿到仅 AI 可见的资料`);
    });
  }
}
bad.forEach(m => console.log('✗ ' + m));
console.log(`\n随机操作 ${N} 次（成功 ${okN}，被拒 ${rejN}）：问题 ${bad.length}`);
process.exit(bad.length ? 1 : 0);
