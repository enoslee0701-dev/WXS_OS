const TM = require('./engine.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('✗ ' + m); } }
function must(r, m) { ok(r.ok, m + (r.ok ? '' : ' → ' + r.error)); return r; }
function rej(r, m) { ok(!r.ok, m + ' (应被拒绝)'); }
let t = Date.UTC(2026, 9, 1, 3);
const clock = () => t;
const fresh = () => TM.seed(clock);
const O = 'u_owner', OP = 'u_op', LD = 'u_lead', AX = 'u_admin_ex', DS = 'u_design', DV = 'u_dev', AD = 'u_sys';

// ===== 黄金路径一：直接推进 · 行政 =====
let s = fresh();
must(TM.act(s, O, 'idea.create', { note: '会议室投影仪坏了，换一台' }), '老板建草稿');
let Iid = s.ideas[s.ideas.length - 1].id; const gI = () => s.ideas.find(x => x.id === Iid); let I = new Proxy({}, { get: (_, k) => gI()[k] });
ok(!TM.canViewIdea(s, OP, I) && !TM.canViewIdea(s, AD, I), '草稿对运营者/管理员不可见');
rej(TM.act(s, OP, 'idea.submit', { id: I.id, path: 'direct' }), '非发起人提交');
must(TM.act(s, O, 'idea.submit', { id: I.id, path: 'direct' }), '直接推进');
ok(I.status === 'triage' && I.aiStatus === 'ready', '进入 triage 且 AI 整理完成');
ok(TM.latestSummary(s, I.id, 'analysis').payload.category === 'admin', '模拟整理判为行政');
ok(TM.canViewIdea(s, OP, I), '运营者能在待认领队列看到');
rej(TM.act(s, OP, 'idea.route', { id: I.id, kind: 'admin', tasks: [] }), '未认领不能派发');
rej(TM.act(s, DS, 'idea.claim', { id: I.id }), '执行者不能认领');
must(TM.act(s, OP, 'idea.claim', { id: I.id }), '运营者认领');
rej(TM.act(s, OP, 'idea.claim', { id: I.id }), '重复认领');
rej(TM.act(s, OP, 'idea.route', { id: I.id, kind: 'admin', tasks: [{ title: 'x', ownerId: AX, expected: '', criteria: 'y' }] }), '缺预期成果');
ok(s.workItems.length === 4, '失败操作已回滚（无多余事项）');
let r = must(TM.act(s, OP, 'idea.route', { id: I.id, kind: 'admin', title: '更换投影仪', tasks: [{ title: '采购并安装投影仪', ownerId: AX, expected: '安装照片', criteria: '能正常投屏' }] }), '派发行政任务');
ok(I.status === 'planned', '想法变为已形成事项');
let Wid = r.workId; const W_ = () => s.workItems.find(w => w.id === Wid); let W = new Proxy({}, { get: (_, k) => W_()[k] });
let Tid = s.tasks.find(x => x.workId === Wid).id; const T_ = () => s.tasks.find(x => x.id === Tid); let T = new Proxy({}, { get: (_, k) => T_()[k] });
ok(T.reviewerId === OP, '行政任务验收人为运营者');
ok(!TM.canViewTask(s, DV, T), '无关执行者看不到该任务');
rej(TM.act(s, DS, 'task.transition', { id: T.id, action: 'accept' }), '非负责人接收');
rej(TM.act(s, AX, 'task.transition', { id: T.id, action: 'start' }), '未接收就开始');
must(TM.act(s, AX, 'task.transition', { id: T.id, action: 'accept' }), '接收');
must(TM.act(s, AX, 'task.transition', { id: T.id, action: 'start' }), '开始');
rej(TM.act(s, AX, 'task.transition', { id: T.id, action: 'block', note: '' }), '报阻碍无原因');
rej(TM.act(s, AX, 'task.transition', { id: T.id, action: 'submit' }), '提交无交付物');
must(TM.act(s, AX, 'task.transition', { id: T.id, action: 'submit', note: '已安装，照片见附件' }), '提交成果');
rej(TM.act(s, AX, 'task.review', { id: T.id, verdict: 'pass', note: '自己验收' }), '执行者自验收');
rej(TM.act(s, OP, 'task.review', { id: T.id, verdict: 'return', note: '' }), '退回无意见');
must(TM.act(s, OP, 'task.review', { id: T.id, verdict: 'return', note: '没有投屏测试照片' }), '退回');
ok(T.status === 'in_progress', '退回回到执行中');
rej(TM.act(s, AX, 'task.transition', { id: T.id, action: 'submit', media: [{ kind: 'image', name: '没有文件ID.jpg' }] }), '只带没有文件 ID 的附件不算交付物');
must(TM.act(s, AX, 'task.transition', { id: T.id, action: 'submit', media: Array.from({ length: 12 }, (_, i) => ({ kind: i ? 'image' : 'evil', name: '投屏照片' + i + '.jpg', localId: 'b_dv' + i, size: '1 MB' })) }), '再次提交：只带照片');
{ const dv = s.deliverables.filter(x => x.taskId === T.id).pop();
  ok(dv.media.length === 9 && dv.media[0].kind === 'file' && dv.media[1].kind === 'image' && dv.media[1].localId === 'b_dv1' && dv.note === '', '交付物照片最多 9 个，未知类型按文件处理'); }
must(TM.act(s, OP, 'task.review', { id: T.id, verdict: 'pass', note: '通过' }), '验收通过');
ok(T.status === 'done' && W.status === 'acceptance', '任务完成，事项待验收');
must(TM.act(s, OP, 'work.close', { id: W.id }), '事项确认完成');
ok(W.status === 'done', '事项完成');
ok(s.events.filter(e => e.ideaId === I.id || e.workId === W.id).length >= 8, '全过程有审计事件');
ok(TM.canViewIdea(s, O, I) && TM.canViewTask(s, O, T), '老板可查全过程');
// 纠偏：撤销验收
const nReviews = s.reviews.length;
rej(TM.act(s, OP, 'owner.override', { id: T.id, action: 'revoke', reason: 'x' }), '非老板纠偏');
rej(TM.act(s, O, 'owner.override', { id: T.id, action: 'revoke', reason: '' }), '纠偏无原因');
must(TM.act(s, O, 'owner.override', { id: T.id, action: 'revoke', reason: '投屏偏色，需复查' }), '老板撤销验收');
ok(T.status === 'in_progress' && W.status === 'active', '任务回执行中，事项重开');
ok(s.reviews.length === nReviews + 1 && s.reviews.some(x => x.verdict === 'pass' && x.taskId === T.id), '原验收记录保留，新增撤销记录');
ok(s.notifications.some(n => n.userId === AX && n.title === '老板纠偏'), '相关人收到纠偏通知');

// ===== 黄金路径二：团队共创 · 产品 =====
s = fresh();
let I2 = new Proxy({}, { get: (_, k) => s.ideas.find(x => x.id === 'I2')[k] });
ok(TM.canViewIdea(s, AX, I2), '全体共享，执行者可见');
ok(!TM.canViewMedia(s, AX, I2), '共创参与者看不到原始媒体');
must(TM.act(s, AX, 'idea.suggest', { id: I2.id, body: '担心每天更新的内容成本太高，有风险' }), '执行者提建议');
must(TM.act(s, O, 'idea.suggest', { id: I2.id, body: '目标用户是谁？', replyTo: null }), '老板提问');
rej(TM.act(s, AX, 'idea.create', { note: '我也有个想法' }), '执行者不能创建想法');
rej(TM.act(s, AX, 'idea.close', { id: I2.id }), '非发起人结束讨论');
must(TM.act(s, LD, 'idea.close', { id: I2.id }), '发起人结束讨论');
rej(TM.act(s, AX, 'idea.suggest', { id: I2.id, body: '晚了' }), '结束后提建议');
let cs = TM.latestSummary(s, I2.id, 'cocreate').payload;
ok(cs.consensus.length >= 1 && cs.divergences.length === 1 && cs.risks.length === 1 && cs.open_questions.length === 1, '汇总含共识/分歧/风险/待澄清');
ok(cs.divergences[0].positions.length === 2, '分歧分别列出两方');
const allSrc = [].concat(...cs.consensus.map(x => x.src), ...cs.risks.map(x => x.src), ...cs.divergences.flatMap(d => d.positions.map(p => p.src)));
ok(allSrc.every(id => s.suggestions.some(x => x.id === id)), '每条结论都引用存在的建议');
rej(TM.act(s, LD, 'idea.confirm', { id: I2.id, direction: '' }), '确认方向为空');
must(TM.act(s, LD, 'idea.confirm', { id: I2.id, direction: '先做人工录制的语音灵修，暂不做视频和 AI 生成' }), '确认方向');
ok(I2.status === 'triage' && TM.latestSummary(s, I2.id, 'analysis').payload.category === 'product', '进入 triage，判为产品');
must(TM.act(s, OP, 'idea.claim', { id: I2.id }), '认领');
rej(TM.act(s, OP, 'idea.route', { id: I2.id, kind: 'product' }), '产品未指定负责人');
r = must(TM.act(s, OP, 'idea.route', { id: I2.id, kind: 'product', leadId: LD, title: '门徒圈语音灵修' }), '交项目负责人');
Wid = r.workId;
ok(W.status === 'planning' && W.leadId === LD, '事项待规划');
rej(TM.act(s, DV, 'work.plan', { id: W.id, tasks: [{ title: 'x', ownerId: DV, expected: 'a', criteria: 'b' }] }), '执行者不能安排任务');
must(TM.act(s, LD, 'work.plan', { id: W.id, tasks: [{ title: '录制流程原型', ownerId: DS, expected: '可点原型', criteria: '能录能听' }] }), '负责人派任务');
must(TM.act(s, LD, 'work.stage', { id: W.id, stage: 'prototype' }), '进入原型');
must(TM.act(s, LD, 'work.stage', { id: W.id, stage: 'ui_review' }), '进入 UI 审核');
must(TM.act(s, LD, 'work.stage', { id: W.id, stage: 'dev' }), '进入开发');
rej(TM.act(s, DS, 'work.stage', { id: W.id, stage: 'test' }), '执行者推进阶段');
ok(W.stage === 'dev', '产品阶段已到开发');

// ===== 例外决策 & 开关 =====
s = fresh();
let I4 = new Proxy({}, { get: (_, k) => s.ideas.find(x => x.id === 'I4')[k] });
rej(TM.act(s, OP, 'decision.decide', { id: 'D1', status: 'approved' }), '运营者做决策');
rej(TM.act(s, O, 'decision.decide', { id: 'D1', status: 'rejected', note: '' }), '否决无原因');
must(TM.act(s, O, 'decision.decide', { id: 'D1', status: 'approved' }), '老板批准');
ok(I4.status === 'triage' && I4.ownerApproved, '批准后回运营整理');
// C2 = all
s = fresh();
must(TM.act(s, O, 'settings.update', { ownerApprovalMode: 'all' }), '改为每条都送老板');
rej(TM.act(s, AX, 'settings.update', { ownerApprovalMode: 'exceptions_only' }), '执行者改设置');
must(TM.act(s, O, 'idea.create', { note: '茶水间加一台饮水机' }), '建草稿');
Iid = s.ideas[s.ideas.length - 1].id;
must(TM.act(s, O, 'idea.submit', { id: I.id, path: 'direct' }), '提交');
ok(I.status === 'awaiting_owner', 'C2=all 且 C3=on：Agent 直接送老板');
const dec = s.decisions.find(d => d.ideaId === I.id);
ok(dec && dec.requestedBy === 'agent', '决策由 AI 助理发起');
must(TM.act(s, O, 'decision.decide', { id: dec.id, status: 'approved' }), '老板批准');
must(TM.act(s, OP, 'idea.claim', { id: I.id }), '认领');
must(TM.act(s, OP, 'idea.route', { id: I.id, kind: 'admin', tasks: [{ title: '采购饮水机', ownerId: AX, expected: '照片', criteria: '可用' }] }), '批准后可派发');
// C2=all + C3 off：需人工上报
must(TM.act(s, O, 'settings.update', { agentDirectRoute: false }), '关闭 Agent 直送');
must(TM.act(s, O, 'idea.create', { note: '换打印机墨盒' }), '建草稿2');
Iid = s.ideas[s.ideas.length - 1].id;
must(TM.act(s, O, 'idea.submit', { id: I.id, path: 'direct' }), '提交2');
ok(I.status === 'triage', 'C3 关闭时停在运营整理');
must(TM.act(s, OP, 'idea.claim', { id: I.id }), '认领2');
rej(TM.act(s, OP, 'idea.route', { id: I.id, kind: 'admin', tasks: [{ title: 'a', ownerId: AX, expected: 'b', criteria: 'c' }] }), 'C2=all 未批准不能派发');
// C1 老板终验
s = fresh();
must(TM.act(s, O, 'settings.update', { ownerFinalProduct: true }), '打开产品老板终验');
must(TM.act(s, LD, 'task.review', { id: 'T2', verdict: 'pass', note: '方案可行' }), '负责人验收');
Tid = 'T2';
ok(T.status === 'owner_review', '进入老板终验');
rej(TM.act(s, LD, 'task.ownerReview', { id: 'T2', verdict: 'owner_pass' }), '非老板终验');
must(TM.act(s, O, 'task.ownerReview', { id: 'T2', verdict: 'owner_pass' }), '老板终验通过');
ok(T.status === 'done', '终验后完成');
// AI 失败 → 人工接手
s = fresh();
must(TM.act(s, O, 'settings.update', { demoAiFail: true }), '模拟 AI 失败');
must(TM.act(s, O, 'idea.create', { note: '前台换新的签到本' }), '草稿');
Iid = s.ideas[s.ideas.length - 1].id;
must(TM.act(s, O, 'idea.submit', { id: I.id, path: 'direct' }), '提交');
ok(I.aiStatus === 'failed' && I.status === 'triage', 'AI 失败但业务状态不卡');
must(TM.act(s, OP, 'idea.claim', { id: I.id }), '认领');
rej(TM.act(s, OP, 'idea.saveSummary', { id: I.id, payload: { title: '', category: 'admin' } }), '整理稿无标题');
must(TM.act(s, OP, 'idea.saveSummary', { id: I.id, payload: { title: '更换前台签到本', category: 'admin', background: '旧本用完' } }), '手写整理稿');
ok(I.aiStatus === 'ready' && I.reviewed, '人工接手成功');
// 受阻 & 解除、暂停、改派、不做
s = fresh();
Tid = 'T3';
rej(TM.act(s, DS, 'task.transition', { id: 'T3', action: 'unblock' }), '无关人解除阻碍');
must(TM.act(s, OP, 'task.transition', { id: 'T3', action: 'unblock' }), '跟进人解除阻碍');
must(TM.act(s, O, 'owner.override', { id: 'T3', action: 'reassign', ownerId: 'u_design', reason: '周敏本周请假' }), '老板改派');
ok(T.ownerId === 'u_design' && T.status === 'assigned', '改派后重新待接收');
must(TM.act(s, O, 'work.pause', { id: 'W2', reason: '年会可能改期' }), '老板暂停');
rej(TM.act(s, 'u_design', 'task.transition', { id: 'T3', action: 'accept' }), '暂停中不能操作');
must(TM.act(s, O, 'work.resume', { id: 'W2' }), '恢复');
must(TM.act(s, O, 'idea.claim', { id: 'I1' }).ok ? { ok: false, error: '老板不应能认领' } : { ok: true }, '老板不能认领');
must(TM.act(s, OP, 'idea.claim', { id: 'I1' }), '认领 I1');
rej(TM.act(s, OP, 'idea.setStatus', { id: 'I1', status: 'declined', reason: '不需要' }), '运营者未经同意不做');
must(TM.act(s, OP, 'idea.setStatus', { id: 'I1', status: 'on_hold', reason: '等搬家后再说' }), '暂缓');
must(TM.act(s, OP, 'idea.setStatus', { id: 'I1', status: 'triage', reason: '不搬了' }), '重新启用');
// 指标
ok(TM.isOverdue(s, s.tasks.find(x => x.id === 'T4')) === false, '已完成任务不算逾期');
ok(TM.isStale(s, s.tasks.find(x => x.id === 'T1')) === true, 'T1 超过 3 天无动态');
ok(TM.nextForTask(s, s.tasks.find(x => x.id === 'T2')).who === LD, 'T2 下一步是验收人');
// 管理员不可见想法
ok(s.ideas.every(d => !TM.canViewIdea(s, AD, d)), '管理员看不到任何想法');
// 审计只追加
const evCount = s.events.length; TM.act(s, O, 'notif.read', {}); ok(s.events.length >= evCount, '事件不减少');

// ===== 新建项目 =====
s = fresh();
rej(TM.act(s, AX, 'project.create', { title: 'x', ptype: 'admin' }), '执行者新建项目');
rej(TM.act(s, O, 'project.create', { title: '', ptype: 'admin' }), '项目名称为空');
rej(TM.act(s, O, 'project.create', { title: '新 App', ptype: 'product' }), '产品项目缺负责人');
let rp = must(TM.act(s, O, 'project.create', { title: '门徒圈小程序', ptype: 'product', leadId: LD, note: '语音灵修', tasks: [{ title: '出原型', ownerId: DS, expected: '可点原型', criteria: '能录能听' }] }), '老板新建产品项目');
let pw = s.workItems.find(w => w.id === rp.workId);
ok(pw.status === 'active' && pw.leadId === LD && pw.reviewerId === LD && pw.ptype === '产品开发', '项目进行中，负责人即验收人');
ok(s.tasks.some(x => x.workId === pw.id && x.ownerId === DS), '首批任务已派出');
let pi = s.ideas.find(d => d.id === rp.ideaId);
ok(pi.status === 'planned' && pi.followerId === OP, '保留想法记录并有跟进人');
ok(TM.canViewWork(s, LD, pw) && TM.canViewIdea(s, LD, pi), '负责人可见');
rp = must(TM.act(s, LD, 'project.create', { title: '团队读书会', ptype: 'research', leadId: 'u_dev' }), '负责人新建项目');
ok(s.workItems.find(w => w.id === rp.workId).leadId === LD, '负责人建项目时自任负责人');
rej(TM.act(s, O, 'project.create', { title: '采购', ptype: 'admin', tasks: [{ title: '买', ownerId: AX, expected: '', criteria: '' }] }), '任务缺预期成果');
must(TM.act(s, O, 'settings.update', { ownerApprovalMode: 'all' }), '改为每条都送');
rej(TM.act(s, OP, 'project.create', { title: '采购打印纸', ptype: 'admin' }), 'C2=all 时运营者不能直接建项目');
must(TM.act(s, O, 'project.create', { title: '采购打印纸', ptype: 'admin' }), 'C2=all 时老板仍可直接建');

// ===== 个人待办 =====
s = fresh();
ok(s.todos.filter(x => x.ownerId === O).length === 6, '种子待办');
rej(TM.act(s, O, 'todo.create', { title: '', date: '2026-10-01' }), '待办内容为空');
rej(TM.act(s, O, 'todo.create', { title: 'x', date: '' }), '缺日期');
rej(TM.act(s, O, 'todo.create', { title: 'x', date: '2026-10-01', time: '25:00' }), '时间格式错');
let tr = must(TM.act(s, O, 'todo.create', { title: '和陈立对齐需求', date: '2026-10-02', time: '15:00', priority: 'hi', people: [LD], tpl: { key: 'meeting', title: '需求对齐' } }), '新建待办');
let td = s.todos.find(x => x.id === tr.id);
ok(td.scope === 'team' && td.people[0] === LD, '有相关人自动归为团队相关');
ok(s.notifications.some(n => n.userId === LD && n.title.includes('待办')), '相关人收到通知');
ok(s.todoRecent[0].title === '需求对齐', '记录近期使用模板');
rej(TM.act(s, LD, 'todo.toggle', { id: tr.id }), '别人不能勾选我的待办');
must(TM.act(s, LD, 'todo.comment', { id: tr.id, body: '好的' }), '相关人可评论');
must(TM.act(s, O, 'todo.toggle', { id: tr.id }), '完成待办');
ok(s.todos.find(x => x.id === tr.id).done, '已完成');
must(TM.act(s, O, 'todo.update', { id: tr.id, time: '16:30' }), '改时间');
must(TM.act(s, O, 'todo.delete', { id: tr.id }), '删除待办');
must(TM.act(s, O, 'todo.clearRecent', {}), '清空近期使用');
ok(!s.todoRecent.some(r => r.userId === O), '已清空');

// ===== 分配任务（描述/类型/优先级/里程碑/协作者） =====
s = fresh();
must(TM.act(s, LD, 'work.plan', { id: 'W1', tasks: [{ title: '完成首页视觉优化', description: '1. 优化 Banner', ttype: '设计', priority: 'hi', milestone: true, ownerId: DS, collabs: [DV, DS, DV], expected: '设计稿', criteria: '负责人确认', assignedBy: 'ai' }] }), '分配带完整字段的任务');
let at = s.tasks[s.tasks.length - 1];
ok(at.priority === 'hi' && at.milestone && at.ttype === '设计' && at.collabs.length === 1 && at.collabs[0] === DV, '字段保存、协作者去重且不含负责人');
ok(s.events.some(e => e.taskId === at.id && e.text.includes('AI 推荐') && e.text.includes('里程碑')), '审计记录 AI 推荐与里程碑');
ok(s.notifications.some(n => n.userId === DV && n.title === '新任务派给你'), '协作者收到通知');
rej(TM.act(s, LD, 'work.plan', { id: 'W1', tasks: [{ title: 'x'.repeat(51), ownerId: DS, expected: 'a', criteria: 'b' }] }), '标题超 50 字');
rej(TM.act(s, LD, 'work.plan', { id: 'W1', tasks: [{ title: 'x', ownerId: DS, expected: 'a', criteria: 'b', priority: 'top' }] }), '优先级非法');

// ===== 项目概览：更新 / 里程碑 =====
s = fresh();
rej(TM.act(s, DS, 'work.update', { id: 'W1', priority: 'lo' }), '执行者不能改项目');
must(TM.act(s, LD, 'work.update', { id: 'W1', priority: 'mid', keyResults: '原型与评审意见' }), '负责人改优先级与关键成果');
ok(s.workItems.find(w => w.id === 'W1').priority === 'mid', '优先级已改');
rej(TM.act(s, LD, 'work.milestone.add', { id: 'W1', title: '', date: '2026-10-20' }), '里程碑名称为空');
let ms = must(TM.act(s, LD, 'work.milestone.add', { id: 'W1', title: '上线发布', date: '2026-11-01' }), '添加里程碑');
let w1 = s.workItems.find(w => w.id === 'W1');
ok(w1.milestones[w1.milestones.length - 1].id === ms.id, '里程碑按日期排序');
must(TM.act(s, OP, 'work.milestone.toggle', { id: 'W1', mid: 'MS2' }), '运营者完成里程碑');
ok(w1.milestones.find(m => m.id === 'MS2').done && s.notifications.some(n => n.userId === DS && n.title.includes('里程碑完成')), '里程碑完成并通知成员');
rej(TM.act(s, DV, 'work.milestone.toggle', { id: 'W1', mid: 'MS3' }), '执行者不能改里程碑');
ok(s.workItems.find(w => w.id === 'W3').status === 'acceptance' && s.workItems.find(w => w.id === 'W4').status === 'done', '待验收与已完成示例项目');
must(TM.act(s, OP, 'work.close', { id: 'W3', note: '课程完成' }), '运营者验收培训项目');

// ===== 团队成员 =====
s = fresh();
ok(s.users.every(u => u.group && u.motto !== undefined && u.presence), '成员有分组、座右铭、状态');
rej(TM.act(s, OP, 'member.add', { name: '王五', role: 'executor', group: '行政运营' }), '运营者不能加成员');
rej(TM.act(s, O, 'member.add', { name: '何静', role: 'executor', group: '设计创意' }), '同名成员');
let mr = must(TM.act(s, O, 'member.add', { name: '王五', title: '摄影', role: 'executor', group: '设计创意', skills: ['摄影', '剪辑'] }), '老板添加成员');
let nu = TM.user(s, mr.id);
ok(nu && TM.hasRole(s, nu.id, 'executor') && nu.roles[0].dept === 'd_prod', '新成员角色与部门');
must(TM.act(s, AX, 'member.update', { id: AX, motto: '细心做好每件事', presence: 'busy' }), '本人改资料');
rej(TM.act(s, AX, 'member.update', { id: DS, motto: 'x' }), '不能改别人资料');
must(TM.act(s, AD, 'member.update', { id: DS, skills: ['设计'] }), '管理员可改资料');

// ===== 我的：个人信息 =====
s = fresh();
ok(TM.user(s, O).email === 'enos@company.com', '老板邮箱种子');
must(TM.act(s, AX, 'member.update', { id: AX, email: 'zm@company.com', location: '清迈', prefs: { notifyImportant: false } }), '本人改邮箱、所在地、偏好');
rej(TM.act(s, AX, 'member.update', { id: AX, email: 'bad' }), '邮箱格式错');
rej(TM.act(s, AX, 'member.update', { id: AX, name: '周敏敏' }), '本人不能改姓名');
must(TM.act(s, AD, 'member.update', { id: AX, name: '周敏敏' }), '管理员改姓名');
rej(TM.act(s, AD, 'member.update', { id: AX, name: '何静' }), '姓名不能重名');

// ===== 想法附件 =====
s = fresh();
rej(TM.act(s, DV, 'idea.attach', { id: 'I1', media: [{ name: 'a.pdf' }] }), '无关的人不能加附件');
must(TM.act(s, O, 'idea.attach', { id: 'I1', media: [{ name: '需求说明.pdf', size: '2.4 MB' }] }), '发起人添加附件');
ok(s.ideas.find(d => d.id === 'I1').media.some(m => m.name === '需求说明.pdf'), '附件已加入');

// ===== 删除想法 =====
s = fresh();
rej(TM.act(s, OP, 'idea.delete', { id: 'I4' }), '运营者不能删除想法');
rej(TM.act(s, O, 'idea.delete', { id: 'I5' }), '已形成进行中项目的想法不能直接删');
must(TM.act(s, O, 'idea.delete', { id: 'I4', reason: '重复了' }), '老板删除想法');
let di = s.ideas.find(d => d.id === 'I4');
ok(di.deleted && !TM.canViewIdea(s, O, di) && !TM.canViewIdea(s, OP, di), '删除后谁都看不到');
ok(s.decisions.filter(dc => dc.ideaId === 'I4').every(dc => dc.status !== 'pending'), '待决策随之撤回');
ok(s.events.some(e => e.action === 'idea.delete'), '删除留痕');
let dr = must(TM.act(s, LD, 'idea.create', { title: '草稿测试', note: 'x' }), '负责人建草稿');
must(TM.act(s, LD, 'idea.delete', { id: dr.id }), '发起人可删自己的草稿');

// ===== 想法详情改版：标签与重新整理 =====
s = fresh();
must(TM.act(s, O, 'idea.create', { title: '明年开发团队扩编', note: '明年我们可能需要再招两名开发，现在项目越来越多，一个人开发有点跟不上。也不知道是全职还是兼职比较合适，要考虑预算。' }), '建想法');
let Ix = s.ideas[s.ideas.length - 1];
must(TM.act(s, O, 'idea.tags', { id: Ix.id, tags: ['团队', '#招聘', '团队'] }), '老板改标签');
ok(Ix.tags.join() === '团队,招聘', '标签去重去井号');
rej(TM.act(s, DS, 'idea.tags', { id: Ix.id, tags: ['x'] }), '无关的人改标签');
rej(TM.act(s, O, 'idea.tags', { id: Ix.id, tags: ['1', '2', '3', '4', '5', '6'] }), '超过 5 个标签');
must(TM.act(s, O, 'idea.submit', { id: Ix.id, path: 'direct' }), '提交');
let pa = TM.latestSummary(s, Ix.id, 'analysis').payload;
ok(pa.overview && pa.goal !== '待确认' && pa.issues.length >= 2 && pa.directions.length >= 4, 'AI 整理含概述/目标/问题/方向');
ok(pa.issues.some(x => x.includes('全职')) && pa.issues.some(x => x.includes('预算')), '识别用工方式与预算问题');
rej(TM.act(s, OP, 'idea.reanalyze', { id: Ix.id }), '未认领不能重新整理');
must(TM.act(s, OP, 'idea.claim', { id: Ix.id }), '认领');
must(TM.act(s, OP, 'idea.reanalyze', { id: Ix.id }), '跟进人重新整理');
ok(TM.latestSummary(s, Ix.id, 'analysis').version === 2, '生成第 2 版');

// ===== 想法附件：链接与删除 =====
s = fresh();
must(TM.act(s, O, 'idea.create', { note: '附件测试想法' }), '建想法');
const IaId = s.ideas[s.ideas.length - 1].id; let Ia = new Proxy({}, { get: (_, k) => s.ideas.find(x => x.id === IaId)[k] });
rej(TM.act(s, O, 'idea.attach', { id: Ia.id, media: [{ kind: 'link', name: 'x', url: 'abc' }] }), '非法链接');
must(TM.act(s, O, 'idea.attach', { id: Ia.id, media: [{ kind: 'link', name: '方案', url: 'https://example.com/a' }, { kind: 'file', name: '预算.xlsx' }] }), '加链接和文件');
ok(Ia.media.length === 2 && Ia.media[0].id && Ia.media[0].url === 'https://example.com/a', '附件带编号与链接');
rej(TM.act(s, DS, 'idea.detach', { id: Ia.id, index: 0 }), '无关的人删附件');
rej(TM.act(s, O, 'idea.detach', { id: Ia.id, index: 0, mid: 'M_bad' }), '编号不符不删');
must(TM.act(s, O, 'idea.detach', { id: Ia.id, index: 0, mid: Ia.media[0].id }), '老板删附件');
ok(Ia.media.length === 1 && Ia.media[0].name === '预算.xlsx' && s.events.some(e => e.action === 'idea.detach'), '删除留痕');

// ===== 原始录音/视频/文件：老板选择是否呈现 =====
s = fresh();
must(TM.act(s, O, 'idea.create', { note: '录音想法', media: [{ kind: 'audio', name: '原始录音.webm' }, { kind: 'video', name: '现场.mp4' }] }), '带原始媒体建想法');
const IvId = s.ideas[s.ideas.length - 1].id; const Iv = () => s.ideas.find(x => x.id === IvId);
must(TM.act(s, O, 'idea.submit', { id: IvId, path: 'direct' }), '提交');
must(TM.act(s, OP, 'idea.claim', { id: IvId }), '认领');
ok(TM.canSeeMediaItem(s, OP, Iv(), Iv().media[0]), '默认呈现给跟进人');
rej(TM.act(s, OP, 'idea.mediaShow', { id: IvId, index: 0, show: false }), '跟进人不能改呈现');
must(TM.act(s, O, 'idea.mediaShow', { id: IvId, index: 0, mid: Iv().media[0].id, show: false }), '老板设为不呈现');
ok(!TM.canSeeMediaItem(s, OP, Iv(), Iv().media[0]) && TM.canSeeMediaItem(s, OP, Iv(), Iv().media[1]), '跟进人看不到被隐藏的录音，视频仍可见');
ok(TM.canSeeMediaItem(s, O, Iv(), Iv().media[0]), '老板自己仍可见');
must(TM.act(s, O, 'idea.mediaShow', { id: IvId, index: 0, show: true }), '恢复呈现');
ok(TM.canSeeMediaItem(s, OP, Iv(), Iv().media[0]) && s.events.filter(e => e.action === 'idea.mediaShow').length === 2, '恢复后可见且留痕');

// ===== 老板决策 · AI 建议 =====
s = fresh();
must(TM.act(s, O, 'idea.create', { title: '明年开发团队扩编', note: '明年想再招两名开发，项目越来越多一个人跟不上，要考虑预算。' }), '建想法');
const IdId = s.ideas[s.ideas.length - 1].id;
must(TM.act(s, O, 'idea.submit', { id: IdId, path: 'direct' }), '提交'); must(TM.act(s, OP, 'idea.claim', { id: IdId }), '认领');
let rq = must(TM.act(s, OP, 'idea.requestDecision', { id: IdId, kind: 'personnel', question: '是否同意明年增招两名开发？' }), '上报人事');
let adv = TM.decisionAdvice(s, s.decisions.find(x => x.id === rq.id));
ok(adv.verdict === 'approved' && adv.label.includes('有条件') && adv.checks.length >= 3 && adv.note, '人事：有条件批准 + 确认清单 + 批语');
ok(adv.reasons.some(x => x.includes('人力')), '理由引用原文中的人力问题');
let adv2 = TM.decisionAdvice(s, { kind: 'over_budget', ideaId: IdId, question: '要花 8 万' });
ok(adv2.verdict === 'needs_info' && adv2.reasons[0].includes('8 万'), '超预算：建议先补充并引用金额');
must(TM.act(s, O, 'decision.decide', { id: rq.id, status: adv.verdict, note: adv.note }), '采用建议做决定');

// ===== AI 知识库 =====
s = fresh(); TM.kbInit(s);
ok(s.knowledge.length === 2 && s.knowledge.every(k => k.on), '预置两份示例资料');
rej(TM.act(s, OP, 'kb.add', { title: 'x', body: '运营者不能加资料内容' }), '运营者不能加资料');
let kr = must(TM.act(s, O, 'kb.add', { title: '老板谈招聘', body: '# 招聘\n- 开发岗位优先招全栈，前端后端都能做的人。\n- 新人先兼职试用三个月。', scope: 'ai_only' }), '老板加资料');
ok(!TM.kbVisible(s, DS).some(k => k.id === kr.id) && TM.kbVisible(s, O).some(k => k.id === kr.id), '仅 AI 参考的资料成员看不到');
let hits = TM.kbMatch(s, '明年招两个开发，前端后端', 3);
ok(hits.some(h => h.title === '老板谈招聘'), '检索命中老板资料');
must(TM.act(s, O, 'kb.update', { id: kr.id, on: false }), '停用');
ok(!TM.kbMatch(s, '明年招两个开发，前端后端', 3).some(h => h.title === '老板谈招聘'), '停用后不再引用');
must(TM.act(s, O, 'kb.update', { id: kr.id, on: true }), '启用');
must(TM.act(s, O, 'idea.create', { note: '明年再招两名开发，前端后端各一个，全职还是兼职？' }), '建想法');
const IkId = s.ideas[s.ideas.length - 1].id;
must(TM.act(s, O, 'idea.submit', { id: IkId, path: 'direct' }), '提交'); must(TM.act(s, OP, 'idea.claim', { id: IkId }), '认领');
let kq = must(TM.act(s, OP, 'idea.requestDecision', { id: IkId, kind: 'personnel', question: '是否同意招两名开发？' }), '上报');
ok(TM.decisionAdvice(s, s.decisions.find(x => x.id === kq.id)).refs.length >= 1, '决策建议引用公司资料');
ok(TM.latestSummary(s, IkId, 'analysis').payload.relation_to_direction.includes('公司资料'), '整理稿关联公司资料');
must(TM.act(s, O, 'kb.delete', { id: kr.id }), '删除资料'); ok(!s.knowledge.some(k => k.id === kr.id), '已删除');

// ===== AI 讨论总结（仅老板） =====
s = fresh();
rej(TM.act(s, LD, 'idea.digest', { id: 'I2' }), '发起人（负责人）不能总结');
rej(TM.act(s, OP, 'idea.digest', { id: 'I2' }), '运营者不能总结');
let dg = must(TM.act(s, O, 'idea.digest', { id: 'I2' }), '老板让 AI 总结');
let dgp = TM.latestSummary(s, 'I2', 'digest').payload;
ok(dgp.count === s.suggestions.filter(x => x.ideaId === 'I2').length && dgp.people.length >= 2, '统计条数与参与人');
ok(dgp.next.length >= 1 && dgp.people.every(p => p.points.length), '有建议下一步与各人观点');
ok(dgp.divergences.length === 1 && dgp.divergences[0].sides.some(x => x.who.includes('何静')), '识别分歧并标注是谁的观点');
ok(s.ideas.find(x => x.id === 'I2').status === 'discussing', '总结不会结束讨论');

// ===== 形成事项后附件锁定 =====
s = fresh();
must(TM.act(s, O, 'idea.create', { note: '会议室换投影仪', media: [{ kind: 'image', name: '旧投影仪.jpg' }] }), '建想法');
const IlId = s.ideas[s.ideas.length - 1].id;
must(TM.act(s, O, 'idea.attach', { id: IlId, media: [{ kind: 'file', name: '型号对比.xlsx' }] }), '草稿可加附件');
must(TM.act(s, O, 'idea.submit', { id: IlId, path: 'direct' }), '提交');
must(TM.act(s, OP, 'idea.claim', { id: IlId }), '认领');
must(TM.act(s, OP, 'idea.attach', { id: IlId, media: [{ kind: 'file', name: '报价单.pdf' }] }), '待整理时运营者可补充');
must(TM.act(s, OP, 'idea.route', { id: IlId, kind: 'admin', tasks: [{ title: '采购投影仪', ownerId: AX, expected: '照片', criteria: '能投屏' }] }), '派发形成事项');
ok(TM.ideaLocked(s.ideas.find(x => x.id === IlId)), '形成事项后锁定');
rej(TM.act(s, O, 'idea.attach', { id: IlId, media: [{ kind: 'file', name: '补充.pdf' }] }), '锁定后老板也不能加');
rej(TM.act(s, O, 'idea.detach', { id: IlId, index: 0 }), '锁定后不能删');
must(TM.act(s, O, 'idea.mediaShow', { id: IlId, index: 0, show: false }), '锁定后仍可设置呈现');

// ===== 想法标题：AI 拟题或老板编辑 =====
s = fresh();
must(TM.act(s, O, 'idea.create', { note: '【要点】\n1. 明年我们可能需要再招两名开发，现在项目越来越多\n2. 前端后端各一个' }), '无标题建想法');
let It = s.ideas[s.ideas.length - 1];
ok(It.title === '明年开发团队扩编（招 2 人）' && It.titleSource === 'ai', 'AI 自动拟题，不截取原文');
ok(TM.aiTitle({ note: '会议室投影仪坏了，换一台' }) === '更换会议室投影仪', '拟题：动作+对象');
ok(TM.aiTitle({ note: '12 月年会，提前订场地，准备物资。' }) === '12 月年会：订场地、准备物资', '拟题：主题+动作');
must(TM.act(s, O, 'idea.create', { title: '招人计划', note: 'xx' }), '老板自己写标题');
ok(s.ideas[s.ideas.length - 1].titleSource === 'user', '自己写的标题标记为老板编辑');
const ItId = It.id;
must(TM.act(s, O, 'idea.retitle', { id: ItId, title: '2027 开发团队扩编' }), '老板改标题');
ok(s.ideas.find(x => x.id === ItId).titleSource === 'user', '改后标记为老板编辑');
rej(TM.act(s, DS, 'idea.retitle', { id: ItId, title: 'x' }), '无关的人不能改标题');
must(TM.act(s, O, 'idea.retitle', { id: ItId, ai: true }), 'AI 重新拟题');
ok(s.ideas.find(x => x.id === ItId).titleSource === 'ai' && s.events.some(e => e.action === 'idea.retitle'), '重新拟题留痕');

// ===== 项目文件 =====
s = fresh();
must(TM.act(s, DV, 'work.attach', { id: 'W1', media: [{ kind: 'file', name: '原型说明.pdf', size: '1 MB' }] }), '任务成员可上传项目文件');
const gW1 = () => s.workItems.find(x => x.id === 'W1');
ok(gW1().files.length === 1 && gW1().files[0].by === DV, '文件记录上传人');
ok(s.events.some(e => e.action === 'work.attach' && e.workId === 'W1'), '上传留痕');
rej(TM.act(s, AX, 'work.attach', { id: 'W1', media: [{ kind: 'file', name: 'x.pdf' }] }), '非成员不能上传');
rej(TM.act(s, LD, 'work.attach', { id: 'W1', media: [] }), '空文件');
rej(TM.act(s, LD, 'work.attach', { id: 'W1', media: [{ kind: 'link', name: '坏链接', url: 'abc' }] }), '链接需 http');
must(TM.act(s, LD, 'work.attach', { id: 'W1', media: [{ kind: 'link', name: '设计稿', url: 'https://figma.com/x' }] }), '负责人加链接');
let F1 = gW1().files[0].id, F2 = gW1().files[1].id;
rej(TM.act(s, DV, 'work.detach', { id: 'W1', fid: F2 }), '执行者不能删别人的文件');
must(TM.act(s, DV, 'work.detach', { id: 'W1', fid: F1 }), '上传人删自己的');
must(TM.act(s, O, 'work.detach', { id: 'W1', fid: F2 }), '老板可删');
ok(gW1().files.length === 0 && s.events.some(e => e.action === 'work.detach'), '删除留痕');
rej(TM.act(s, O, 'work.detach', { id: 'W1', fid: 'P999' }), '文件不存在');

// ===== 新建项目：优先级与目标 =====
s = fresh();
let pr = must(TM.act(s, O, 'project.create', { title: '测试项目', note: 'x', ptype: 'ops', priority: 'hi', goal: '月底完成', tasks: [] }), '带优先级创建');
ok(s.workItems.find(w => w.id === pr.workId).priority === 'hi' && s.workItems.find(w => w.id === pr.workId).goal === '月底完成', '优先级与目标写入项目');
pr = must(TM.act(s, O, 'project.create', { title: '测试项目2', note: 'x', ptype: 'ops', priority: 'zz' }), '非法优先级');
ok(s.workItems.find(w => w.id === pr.workId).priority === 'mid', '非法优先级回落为中');

// ===== 知识库：口述来源 =====
s = fresh();
let kv = must(TM.act(s, O, 'kb.add', { title: '老板口述：做决定', body: '# 规则\n- 新想法先试点两周。', scope: 'ai_only', source: 'voice' }), '口述资料可保存');
ok(s.knowledge.find(k => k.id === kv.id).source === 'voice', '记录来源为口述');
kv = must(TM.act(s, O, 'kb.add', { title: '普通资料', body: '这是一份普通的文字资料内容。', source: 'hack' }), '普通资料');
ok(s.knowledge.find(k => k.id === kv.id).source === 'text', '非法来源回落为文字');

// ===== 角色能力表：用不了的功能不展示 =====
s = fresh();
const cap = (u) => TM.caps(s, u);
ok(cap(O).recordIdea && cap(O).createProject && cap(O).decide && cap(O).settings && cap(O).direction && cap(O).resetData, '老板全部能力');
ok(!cap(OP).recordIdea && cap(OP).createProject && cap(OP).claimIdeas && cap(OP).assign && !cap(OP).settings, '运营者：建项目、认领、分配，不能记录想法和改设置');
ok(cap(LD).recordIdea && cap(LD).createProject && cap(LD).assign && !cap(LD).members, '有发起权的负责人');
[AX, DS, DV].forEach(u => ok(!cap(u).recordIdea && !cap(u).createProject && !cap(u).assign && !cap(u).members && !cap(u).settings && !cap(u).resetData && cap(u).ideas && cap(u).tasks, '执行者 ' + u + ' 只有执行类能力'));
ok(cap(AD).members && cap(AD).settings && cap(AD).kbEdit && !cap(AD).direction && !cap(AD).ideas && !cap(AD).work && !cap(AD).recordIdea, '管理员：成员、设置、知识库；看不到想法和项目');
s.settings.ownerApprovalMode = 'all';
ok(cap(O).createProject && !cap(OP).createProject && !cap(LD).createProject, '每条都送：只有老板能直接建项目');
rej(TM.act(s, OP, 'project.create', { title: 'x', ptype: 'admin' }), '每条都送时运营者建项目');
s.settings.ownerApprovalMode = 'exceptions_only';
s.workItems.forEach(w => { if (w.operatorId === OP || w.leadId === OP) w.status = 'done'; });
ok(!cap(OP).assign, '运营者手上没有进行中的项目时不能分配');
ok(TM.canAssign(s, O) === s.workItems.some(w => ['planning', 'active', 'acceptance', 'blocked'].includes(w.status)), '老板有进行中项目即可分配');

// ===== 服务器下发：按身份裁剪 =====
s = TM.migrate(fresh());
const vw = (u) => TM.viewFor(s, u);
ok(vw(O).ideas.length === s.ideas.length && vw(O).workItems.length === s.workItems.length, '老板拿到全部想法和项目');
ok(vw(DS).ideas.every(d => TM.canViewIdea(s, DS, d)) && vw(DS).ideas.length < s.ideas.length, '执行者只拿到看得到的想法');
ok(!vw(OP).ideas.some(d => d.status === 'draft' && d.creatorId !== OP), '别人的草稿不下发');
ok(vw(AD).ideas.length === 0 && vw(AD).workItems.length === 0 && vw(AD).tasks.length === 0, '管理员拿不到想法、项目、任务');
ok(vw(DS).notifications.every(n => n.userId === DS) && vw(O).todos.every(x => x.ownerId === O || (x.people || []).includes(O)), '通知和个人待办只给本人');
ok(vw(DV).tasks.every(t => vw(DV).workItems.some(w => w.id === t.workId)), '下发的任务都能找到所属项目');
ok(vw(DS).checklist.every(c => vw(DS).tasks.some(t => t.id === c.taskId)), '清单跟着任务走');
ok(vw(DS).seq === s.seq, '保留序号，客户端与服务器生成相同 ID');
s.knowledge.push({ id: 'Kx', title: '只给 AI', body: 'x', scope: 'ai_only', on: true, by: O, at: 1, size: 1 });
ok(vw(O).knowledge.some(k => k.id === 'Kx') && !vw(DS).knowledge.some(k => k.id === 'Kx'), '仅 AI 可见的资料不下发给员工');
const before = JSON.stringify(s); vw(DS); ok(JSON.stringify(s) === before, '裁剪不改动原数据');
// 同一份状态上执行同一操作，结果一致（客户端先执行、服务器再执行）
const a1 = TM.migrate(fresh()), a2 = JSON.parse(JSON.stringify(a1));
const x1 = TM.act(a1, O, 'idea.create', { note: '同步测试' }), x2 = TM.act(a2, O, 'idea.create', { note: '同步测试' });
ok(x1.ok && x1.id === x2.id, '确定性 ID');

// ===== 新团队与清理演示数据 =====
const bl = TM.blank({ name: '王老板', title: '创始人' });
ok(bl.users.length === 1 && bl.users[0].id === 'u_owner' && bl.users[0].name === '王老板' && TM.hasRole(bl, 'u_owner', 'owner'), '新团队只有老板');
ok(!bl.ideas.length && !bl.workItems.length && !bl.todos.length && !bl.knowledge.length && !bl.notifications.length, '新团队没有示例内容');
must(TM.act(bl, 'u_owner', 'member.add', { name: '小李', title: '设计', role: 'executor', group: '设计创意' }), '新团队可以添加成员');
ok(bl.users.length === 2, '成员已添加');
must(TM.act(bl, 'u_owner', 'idea.create', { note: '第一个想法' }), '新团队可以记录想法');
s = TM.migrate(fresh()); s.knowledge.push({ id: 'Ky', title: '自己的', body: 'y', scope: 'team', on: true, by: O, at: 1, size: 1 });
rej(TM.act(s, DS, 'data.clearDemo', {}), '执行者清理数据');
rej(TM.act(s, OP, 'data.clearDemo', {}), '运营者清理数据');
rej(TM.act(s, AD, 'data.clearDemo', {}), '管理员清理数据');
must(TM.act(s, O, 'data.clearDemo', {}), '老板清理演示数据');
ok(!s.ideas.length && !s.workItems.length && !s.tasks.length && !s.todos.length && s.users.length === 7, '内容清空、成员保留');
ok(s.knowledge.length === 1 && s.knowledge[0].id === 'Ky', '演示资料清掉、自己加的资料保留');

// ===== 安全加固（代码审查发现的问题） =====
s = TM.migrate(fresh());
['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'].forEach(n => { const r = TM.act(s, DS, n, {}); ok(r.ok === false && !r.ideas, '原型链上的名字不是操作：' + n); });
// 动态记录按项目 / 任务可见性裁剪
const evOk = (u) => { const v = TM.viewFor(s, u); return v.events.every(e => (!e.workId || v.workItems.some(w => w.id === e.workId)) && (!e.taskId || v.tasks.some(t => t.id === e.taskId)) && (e.ideaId || e.workId || e.taskId || TM.caps(s, u).members)); };
[O, OP, LD, AX, DS, DV, AD].forEach(u => ok(evOk(u), '动态记录不越权：' + u));
ok(TM.viewFor(s, AD).events.length === 0, '纯管理员看不到项目和任务动态');
ok(TM.viewFor(s, DS).events.some(e => e.taskId === 'T1') && !TM.viewFor(s, DS).events.some(e => e.workId === 'W2'), '执行者看到自己任务的动态，看不到别的项目');
// 偏好：白名单、限大小、只给本人
must(TM.act(s, DS, 'member.update', { id: DS, prefs: { notifyImportant: false, evil: 'x'.repeat(100000) } }), '改自己的偏好');
ok(TM.user(s, DS).prefs.notifyImportant === false && !('evil' in TM.user(s, DS).prefs), '偏好只收白名单键');
rej(TM.act(s, DS, 'member.update', { id: DS, prefs: { notifyImportant: 'yes' } }), '偏好值类型不对');
ok(TM.viewFor(s, DV).users.find(u => u.id === DS).prefs === undefined && TM.viewFor(s, DS).users.find(u => u.id === DS).prefs.notifyImportant === false, '别人的偏好不下发');
// 管理员不能改老板资料
rej(TM.act(s, AD, 'member.update', { id: O, name: '新老板' }), '管理员改老板姓名');
rej(TM.act(s, AD, 'member.update', { id: O, title: '员工' }), '管理员改老板职位');
must(TM.act(s, AD, 'member.update', { id: DS, title: '高级设计' }), '管理员可以改员工职位');
// 设置项类型校验
rej(TM.act(s, O, 'settings.update', { staleDays: 'abc' }), '无动态天数不是数字');
rej(TM.act(s, O, 'settings.update', { staleDays: 0 }), '无动态天数超范围');
rej(TM.act(s, O, 'settings.update', { ownerApprovalMode: 'everything' }), '老板确认范围取值不对');
rej(TM.act(s, O, 'settings.update', { ownerFinalAdmin: 'yes' }), '开关不是布尔');
must(TM.act(s, O, 'settings.update', { staleDays: 5, budgetThreshold: 8000, ownerApprovalMode: 'all' }), '合法设置');
ok(s.settings.staleDays === 5 && s.settings.budgetThreshold === 8000, '设置已保存');
// 演示专用迁移只作用于演示数据
const real = TM.blank({ name: '王建国' }); delete real.todos;
TM.migrate(real);
ok(real.users[0].name === '王建国' && (real.todos || []).length === 0, '真实团队：老板叫王建国不会被改名，不会塞演示待办');

// ===== 真实 AI 整理稿写入 =====
s = TM.migrate(fresh());
let ai1 = must(TM.act(s, O, 'idea.create', { note: '想给团队办一次退修会，预算两万元，十二月中旬' }), '老板记想法');
must(TM.act(s, O, 'idea.submit', { id: ai1.id, path: 'direct' }), '提交');
let smA = TM.latestSummary(s, ai1.id, 'analysis');
ok(smA && smA.authorType === 'agent' && smA.payload.simulated, '先有规则版整理稿');
rej(TM.act(s, O, 'idea.aiResult', { id: ai1.id, summaryId: smA.id, payload: {} }), '老板不能伪造 AI 结果');
must(TM.act(s, 'agent', 'idea.aiResult', { id: ai1.id, summaryId: smA.id, model: 'claude-opus-5-5', payload: { title: '团队退修会（12 月中旬）', overview: '在 12 月中旬办一次全队退修会。', goal: '定下时间地点和预算', issues: ['场地未定'], directions: ['先定日期'], category: 'admin', exception_flags: ['over_budget', 'bogus'], suggested_route: 'to_owner', suggested_tasks: [{ title: '找场地', expected_output: '三个候选', acceptance_criteria: '老板选定', suggested_due_days: 500 }], confidence: 3, evil: 'x' } }), '系统写入 AI 结果');
smA = TM.latestSummary(s, ai1.id, 'analysis');
ok(smA.payload.simulated === false && smA.payload.overview.includes('退修会') && smA.payload.category === 'admin', 'AI 结果替换规则稿');
ok(JSON.stringify(smA.payload.exception_flags) === '["over_budget"]' && smA.payload.suggested_tasks[0].suggested_due_days === 90 && smA.payload.confidence === 1 && !('evil' in smA.payload), 'AI 结果字段清洗');
ok(s.ideas.find(x => x.id === ai1.id).title === '团队退修会（12 月中旬）', 'AI 拟的标题生效');
rej(TM.act(s, 'agent', 'idea.aiResult', { id: ai1.id, summaryId: 'S-old', payload: {} }), '整理稿已更新时不覆盖');

// ===== Claude 决策建议写入 =====
s = TM.migrate(fresh());
const pd1 = s.decisions.find(x => x.status === 'pending');
rej(TM.act(s, O, 'decision.aiAdvice', { id: pd1.id, advice: {} }), '老板不能伪造 AI 建议');
must(TM.act(s, 'agent', 'decision.aiAdvice', { id: pd1.id, model: 'claude-opus-5-5', advice: { verdict: 'maybe', label: '建议先补充信息', reasons: ['a', '', 'b'], note: 'x'.repeat(500) } }), '系统写入 AI 建议');
const pd2 = s.decisions.find(x => x.id === pd1.id); // 被拒的操作会回滚、替换对象，重新取
ok(pd2.ai.verdict === 'needs_info' && pd2.ai.reasons.length === 2 && pd2.ai.note.length === 300 && pd2.ai.model === 'claude-opus-5-5', 'AI 建议字段清洗');

// ===== 第二轮审查：泄漏与覆盖 =====
s = TM.migrate(fresh());
s.knowledge.push({ id: 'Ksecret', title: '老板私密：投影仪采购原则', body: '# 采购\n- 投影仪会议室采购只买二手，预算机密不要外传。', scope: 'ai_only', on: true, by: O, at: 1, size: 30 });
let lk = must(TM.act(s, LD, 'idea.create', { note: '会议室投影仪坏了要采购一台新的' }), '负责人记想法');
must(TM.act(s, LD, 'idea.submit', { id: lk.id, path: 'direct' }), '提交');
let lkSum = TM.latestSummary(s, lk.id, 'analysis');
ok(!JSON.stringify(lkSum.payload).includes('机密') && !JSON.stringify(lkSum.payload).includes('Ksecret'), '规则版整理稿不引用「仅 AI 可见」的老板资料');
const pdx = s.decisions.find(x => x.status === 'pending');
must(TM.act(s, 'agent', 'decision.aiAdvice', { id: pdx.id, advice: { verdict: 'approved', label: '批', reasons: ['老板的私密理由'], note: 'x' } }), '写入建议');
ok(!JSON.stringify(TM.viewFor(s, LD).decisions).includes('老板的私密理由') && JSON.stringify(TM.viewFor(s, O).decisions).includes('老板的私密理由'), 'Claude 决策建议只下发给老板');
const coI = s.suggestions[0].ideaId; must(TM.act(s, O, 'idea.digest', { id: coI }), '老板总结讨论');
ok(TM.viewFor(s, O).summaries.some(x => x.kind === 'digest') && !TM.viewFor(s, LD).summaries.some(x => x.kind === 'digest') && !TM.viewFor(s, DS).summaries.some(x => x.kind === 'digest'), '讨论总结只下发给老板');
// AI 结果迟到：想法已被认领派发，不再替换整理稿
let lt = must(TM.act(s, O, 'idea.create', { note: '茶水间换饮水机' }), '建想法');
must(TM.act(s, O, 'idea.submit', { id: lt.id, path: 'direct' }), '提交');
const ltSum = TM.latestSummary(s, lt.id, 'analysis');
must(TM.act(s, OP, 'idea.claim', { id: lt.id }), '认领');
must(TM.act(s, OP, 'idea.route', { id: lt.id, kind: 'admin', tasks: [{ title: '买饮水机', ownerId: AX, expected: '照片', criteria: '可用' }] }), '派发');
rej(TM.act(s, 'agent', 'idea.aiResult', { id: lt.id, summaryId: ltSum.id, payload: { title: '新标题', overview: '迟到的 AI 结果' } }), '想法已派发，迟到的 AI 结果不覆盖');

// ===== 没有运营者的小团队：老板兼任跟进 =====
const sm0 = TM.blank({ name: '老板' });
must(TM.act(sm0, 'u_owner', 'member.add', { name: '小李', title: '设计', role: 'executor', group: '设计创意' }), '加执行者');
const xl = sm0.users[1].id;
let np0 = must(TM.act(sm0, 'u_owner', 'project.create', { title: '第一个项目', ptype: 'admin', tasks: [{ title: '买打印纸', ownerId: xl, expected: '照片', criteria: '够用' }] }), '没有运营者时老板也能建项目');
ok(sm0.workItems.find(w => w.id === np0.workId).operatorId === 'u_owner', '老板兼任跟进');
let ni0 = must(TM.act(sm0, 'u_owner', 'idea.create', { note: '换打印机' }), '记想法');
must(TM.act(sm0, 'u_owner', 'idea.submit', { id: ni0.id, path: 'direct' }), '提交');
ok(sm0.notifications.some(n => n.userId === 'u_owner' && /待认领/.test(n.title)), '待认领通知发给老板');
ok(TM.caps(sm0, 'u_owner').claimIdeas, '没有运营者时老板有认领能力');
must(TM.act(sm0, 'u_owner', 'idea.claim', { id: ni0.id }), '老板认领');
must(TM.act(sm0, 'u_owner', 'idea.route', { id: ni0.id, kind: 'admin', tasks: [{ title: '买新打印机', ownerId: xl, expected: '照片', criteria: '能打印' }] }), '老板派发');
must(TM.act(sm0, 'u_owner', 'member.add', { name: '小王', title: '运营', role: 'operator', group: '行政运营' }), '后来有了运营者');
let ni1 = must(TM.act(sm0, 'u_owner', 'idea.create', { note: '换投影' }), '再记想法'); must(TM.act(sm0, 'u_owner', 'idea.submit', { id: ni1.id, path: 'direct' }), '提交');
rej(TM.act(sm0, 'u_owner', 'idea.claim', { id: ni1.id }), '有了运营者后老板不再认领');
must(TM.act(sm0, 'u_owner', 'project.create', { title: '新 App', ptype: 'product', leadId: 'u_owner', tasks: [] }), '没有负责人时老板可以自任产品项目负责人');
rej(TM.act(sm0, 'u_owner', 'project.create', { title: '新 App2', ptype: 'product', leadId: xl, tasks: [] }), '执行者不能当负责人');

// ===== 最小团队（老板 + 1 名执行者）完整闭环 =====
const mt = TM.blank({ name: '老板' }); must(TM.act(mt, 'u_owner', 'member.add', { name: '小李', title: '行政', role: 'executor', group: '行政运营' }), '加执行者');
const mli = mt.users[1].id, mp = must(TM.act(mt, 'u_owner', 'project.create', { title: '换打印机', ptype: 'admin', tasks: [{ title: '买打印机', ownerId: mli, expected: '照片', criteria: '能打印' }] }), '建项目派任务');
const mtk = mt.tasks.find(x => x.workId === mp.workId).id;
['accept', 'start'].forEach(a => must(TM.act(mt, mli, 'task.transition', { id: mtk, action: a }), '执行者 ' + a));
must(TM.act(mt, mli, 'task.transition', { id: mtk, action: 'submit', note: '装好了' }), '提交');
must(TM.act(mt, 'u_owner', 'task.review', { id: mtk, verdict: 'pass', note: '好' }), '老板验收');
must(TM.act(mt, 'u_owner', 'work.close', { id: mp.workId }), '老板确认项目完成');
ok(mt.workItems.find(w => w.id === mp.workId).status === 'done', '最小团队闭环走通');

// ===== 日常清理 =====
s = TM.migrate(fresh());
s.notifications.push({ id: 'Nold1', userId: O, title: '旧的已读', body: '', link: '', at: t - 90 * TM.DAY, read: true }, { id: 'Nold2', userId: O, title: '旧的未读', body: '', link: '', at: t - 90 * TM.DAY, read: false });
rej(TM.act(s, O, 'system.housekeep', {}), '老板不能直接调用清理');
const hk = must(TM.act(s, 'agent', 'system.housekeep', {}), '系统清理');
ok(hk.removed >= 1 && !s.notifications.some(n => n.id === 'Nold1') && s.notifications.some(n => n.id === 'Nold2'), '删掉 60 天前已读的通知，未读的保留');

// ===== 头像 =====
s = TM.migrate(fresh());
must(TM.act(s, DS, 'member.update', { id: DS, avatar: 'a1b2c3d4e5' }), '换自己的头像');
ok(TM.user(s, DS).avatar === 'a1b2c3d4e5', '头像已保存');
rej(TM.act(s, DS, 'member.update', { id: DS, avatar: '../etc/passwd' }), '头像 ID 格式不对');
rej(TM.act(s, O, 'member.update', { id: DS, avatar: 'zzzz1234' }), '别人不能换我的头像');
must(TM.act(s, DS, 'member.update', { id: DS, avatar: '' }), '移除头像'); ok(!TM.user(s, DS).avatar, '已移除');

// ===== 随机测试发现：老板不能删别人的私人草稿 =====
s = TM.migrate(fresh());
const ldDraft = must(TM.act(s, LD, 'idea.create', { note: '负责人的私人草稿' }), '负责人记草稿');
rej(TM.act(s, O, 'idea.delete', { id: ldDraft.id }), '老板删别人的私人草稿');
must(TM.act(s, LD, 'idea.delete', { id: ldDraft.id }), '发起人删自己的草稿');

// ===== 老板早报 =====
s = TM.migrate(fresh());
rej(TM.act(s, O, 'system.dailyBrief', {}), '老板不能直接调用早报');
const nb0 = s.notifications.length, br = must(TM.act(s, 'agent', 'system.dailyBrief', { ai: 'Claude：今天先处理年会场地。' }), '发早报');
const bn = s.notifications.slice(nb0).find(n => n.title === '今日早报');
ok(br.sent === 1 && bn && bn.userId === O && /等你决策/.test(bn.body) && /Claude/.test(bn.body), '早报发给老板，含待决策和 AI 要点');
const quiet = TM.blank({ name: '老板' });
ok(TM.act(quiet, 'agent', 'system.dailyBrief', {}).sent === 0 && !quiet.notifications.length, '没有需要关注的事就不发');

// ===== 截止提醒 =====
s = TM.migrate(fresh());
const today0 = TM.todayStr(s), tmr = TM.dateAdd(s, 1);
const tA = s.tasks.find(x => ['assigned', 'accepted', 'in_progress'].includes(x.status)); tA.due = tmr;
const tB = s.tasks.find(x => x !== tA && ['assigned', 'accepted', 'in_progress', 'blocked'].includes(x.status)); tB.due = TM.dateAdd(s, -2);
rej(TM.act(s, O, 'system.dueReminders', {}), '老板不能直接调用提醒');
const rm = must(TM.act(s, 'agent', 'system.dueReminders', {}), '发截止提醒');
ok(s.notifications.some(n => n.userId === tA.ownerId && n.title === '任务明天截止' && n.link === '#/task/' + tA.id) && s.notifications.some(n => n.userId === tB.ownerId && n.title === '任务已逾期'), '提醒执行人：明天截止、已逾期');
ok(TM.act(s, 'agent', 'system.dueReminders', {}).sent === 0, '同一天不重复提醒');

// ===== 录音 / 视频转写（服务器 whisper 写回） =====
s = TM.migrate(fresh());
const vi = must(TM.act(s, O, 'idea.create', { note: '', media: [{ kind: 'video', name: '视频 10月5日.mp4', localId: 'b_vid1' }] }), '只带视频的想法');
must(TM.act(s, O, 'idea.submit', { id: vi.id, path: 'direct' }), '提交视频想法');
rej(TM.act(s, O, 'idea.transcript', { id: vi.id, localId: 'b_vid1', status: 'done', text: 'x' }), '老板不能直接写转写结果');
rej(TM.act(s, 'agent', 'idea.transcript', { id: vi.id, localId: 'b_nope', status: 'done', text: 'x' }), '附件不存在');
must(TM.act(s, 'agent', 'idea.transcript', { id: vi.id, localId: 'b_vid1', status: 'pending' }), '标记转写中');
const tvd = s.ideas.find(d => d.id === vi.id);
ok(tvd.media[0].transcriptStatus === 'pending' && !tvd.media[0].transcript, '转写中：只有状态');
const tsm0 = TM.latestSummary(s, vi.id, 'analysis');
const ttr = must(TM.act(s, 'agent', 'idea.transcript', { id: vi.id, localId: 'b_vid1', status: 'done', text: '下周二开同工会，讨论感恩晚会的预算和场地，请林晓整理方案。' }), '写入转写');
const tsm1 = TM.latestSummary(s, vi.id, 'analysis');
ok(tvd.media[0].transcript.includes('感恩晚会') && tvd.media[0].transcriptStatus === 'done' && TM.noteOf(tvd).includes('同工会'), '转写写进附件，想法全文包含转写');
ok(ttr.reanalyzed && tsm1.id !== tsm0.id && JSON.stringify(tsm1.payload).includes('同工会'), '转写后按全文重新生成整理稿');
ok(s.events.some(e => e.ideaId === vi.id && e.action === 'idea.transcript' && /视频「视频 10月5日.mp4」转写完成/.test(e.text)), '动态里记一条转写完成');
// 运营者已经手写整理稿：不覆盖
const vi2 = must(TM.act(s, O, 'idea.create', { note: '录音想法', media: [{ kind: 'audio', name: '录音 0:30', localId: 'b_aud2' }] }), '带录音的想法');
must(TM.act(s, O, 'idea.submit', { id: vi2.id, path: 'direct' }), '提交');
must(TM.act(s, OP, 'idea.claim', { id: vi2.id }), '运营者认领');
const n2 = s.summaries.length; TM.latestSummary(s, vi2.id, 'analysis').authorType = 'human';
const tr2 = must(TM.act(s, 'agent', 'idea.transcript', { id: vi2.id, localId: 'b_aud2', status: 'done', text: '买两箱打印纸' }), '写入转写');
ok(!tr2.reanalyzed && s.summaries.length === n2, '人工改过的整理稿不被转写覆盖');
// 看不到原始录音的人也看不到转写
const hid = s.ideas.find(d => d.id === vi2.id).media[0]; const vv = TM.viewFor(s, DV).ideas.find(d => d.id === vi2.id);
ok(!vv || !(vv.media || []).some(m => m.transcript) || TM.canSeeMediaItem(s, DV, s.ideas.find(d => d.id === vi2.id), hid), '看不到附件的人拿不到转写');

// ===== 只有老板的团队：想法派发为产品类时老板自任负责人 =====
{ const b = TM.blank({ name: '王老板' }, clock); const bo = b.users[0].id;
  const bi = must(TM.act(b, bo, 'idea.create', { note: '做一个报名小程序' }), '小团队老板记想法');
  must(TM.act(b, bo, 'idea.submit', { id: bi.id, path: 'direct' }), '提交');
  if (b.ideas.find(d => d.id === bi.id).followerId !== bo) must(TM.act(b, bo, 'idea.claim', { id: bi.id }), '老板兼任跟进认领');
  const br = must(TM.act(b, bo, 'idea.route', { id: bi.id, kind: 'product', title: '报名小程序', leadId: bo }), '只有老板的团队：派发产品类，老板自任负责人');
  ok(br.workId && b.workItems.find(w => w.id === br.workId).leadId === bo, '项目负责人是老板'); }

// ===== 取消项目：级联取消任务、想法转暂缓、之后可删除 =====
{ const c = fresh();
  const ci = must(TM.act(c, O, 'idea.create', { note: '换会议室投影' }), '建想法'); must(TM.act(c, O, 'idea.submit', { id: ci.id, path: 'direct' }), '提交');
  must(TM.act(c, OP, 'idea.claim', { id: ci.id }), '认领');
  const cr = must(TM.act(c, OP, 'idea.route', { id: ci.id, kind: 'admin', title: '换投影', tasks: [{ title: '买投影', ownerId: AX, expected: '发票', criteria: '型号对' }, { title: '装投影', ownerId: AX, expected: '照片', criteria: '能投屏' }] }), '派发');
  rej(TM.act(c, O, 'idea.delete', { id: ci.id }), '有进行中的项目时不能删想法');
  rej(TM.act(c, AX, 'work.cancel', { id: cr.workId, reason: '不要了' }), '执行者不能取消项目');
  rej(TM.act(c, O, 'work.cancel', { id: cr.workId }), '取消项目必须写原因');
  const cc = must(TM.act(c, O, 'work.cancel', { id: cr.workId, reason: '预算砍了' }), '老板取消项目');
  ok(cc.tasks === 2 && c.tasks.filter(x => x.workId === cr.workId).every(x => x.status === 'cancelled'), '未完成任务一并取消');
  ok(c.workItems.find(w => w.id === cr.workId).status === 'cancelled' && c.ideas.find(d => d.id === ci.id).status === 'on_hold', '项目已取消、想法转暂缓');
  ok(c.notifications.some(n => n.userId === AX && /项目已取消/.test(n.title)), '执行人收到取消通知');
  rej(TM.act(c, O, 'work.cancel', { id: cr.workId, reason: 'x' }), '已取消的不能再取消');
  must(TM.act(c, O, 'idea.delete', { id: ci.id, reason: '不做了' }), '项目取消后可以删除想法'); }

// ===== 停用账号：不能再被派任务；交接手上的工作 =====
{ const h = fresh();
  const hi = must(TM.act(h, O, 'idea.create', { note: '整理仓库' }), '建想法'); must(TM.act(h, O, 'idea.submit', { id: hi.id, path: 'direct' }), '提交'); must(TM.act(h, OP, 'idea.claim', { id: hi.id }), '认领');
  const hr = must(TM.act(h, OP, 'idea.route', { id: hi.id, kind: 'admin', title: '整理仓库', tasks: [{ title: '清点物资', ownerId: AX, expected: '清单', criteria: '齐全' }] }), '派给周敏');
  const ht = h.tasks.find(t => t.workId === hr.workId); must(TM.act(h, AX, 'task.transition', { id: ht.id, action: 'accept' }), '周敏接收');
  rej(TM.act(h, O, 'member.active', { id: AX, active: false }), '只有系统能标记停用');
  const ha = must(TM.act(h, 'agent', 'member.active', { id: AX, active: false }), '系统标记周敏停用');
  ok(ha.open >= 1 && h.users.find(u => u.id === AX).inactive, '停用后记下手上还有工作');
  ok(h.notifications.some(n => n.userId === O && /周敏 的工作需要交接/.test(n.title)), '提醒老板交接');
  ok(!TM.activeUsers(h).some(u => u.id === AX), '在职成员列表不含停用的人');
  { const r2 = TM.act(h, OP, 'work.plan', { id: hr.workId, tasks: [{ title: 'x', ownerId: AX, expected: 'a', criteria: 'b' }] }); ok(!r2.ok && /停用/.test(r2.error || ''), '不能给停用的人派任务 ' + r2.error); }
  rej(TM.act(h, 'agent', 'member.active', { id: O, active: false }), '不能停用老板');
  rej(TM.act(h, AX, 'member.handover', { from: AX, to: DV }), '执行者不能交接');
  rej(TM.act(h, O, 'member.handover', { from: AX, to: AX }), '不能交接给自己');
  const hh = must(TM.act(h, O, 'member.handover', { from: AX, to: DV }), '老板把周敏的工作交接给刘洋');
  const ht2 = h.tasks.find(t => t.id === ht.id);
  ok(hh.tasks >= 1 && ht2.ownerId === DV && ht2.status === 'assigned' && !h.tasks.some(t => t.ownerId === AX && !['done','cancelled'].includes(t.status)), '任务转给接手人，重新待接收 ' + JSON.stringify(hh) + ht2.status);
  ok(h.notifications.some(n => n.userId === DV && /接手了 周敏/.test(n.title)), '接手人收到通知');
  rej(TM.act(h, O, 'member.handover', { from: AX, to: DV }), '没有工作时提示无需交接');
  // 跟进人交接给不是运营者的人：保留并说明
  const hi2 = must(TM.act(h, O, 'idea.create', { note: '换门禁' }), '建想法2'); must(TM.act(h, O, 'idea.submit', { id: hi2.id, path: 'direct' }), '提交2'); must(TM.act(h, OP, 'idea.claim', { id: hi2.id }), '认领2');
  const hk = must(TM.act(h, O, 'member.handover', { from: OP, to: DV }), '运营者的工作交给执行者');
  ok(hk.skipped.some(x => /不是运营者/.test(x)) && h.ideas.find(d => d.id === hi2.id).followerId === OP, '对方没有运营者角色：跟进的想法保留并说明');
  must(TM.act(h, 'agent', 'member.active', { id: AX, active: true }), '恢复账号'); ok(!h.users.find(u => u.id === AX).inactive, '恢复后在职'); }

// ===== 坏附件：创建时清洗；历史坏数据加载时清洗，下发不抛异常 =====
{ const m = fresh();
  const r1 = must(TM.act(m, O, 'idea.create', { note: 'x', media: [null, 'a', { kind: 'evil', name: { a: 1 }, localId: '../x', url: 'javascript:1' }, { kind: 'audio', name: '录音', localId: 'b_aud_77', durationSec: 12 }] }), '带坏附件的想法也能建');
  const md = m.ideas.find(d => d.id === r1.id).media;
  ok(md.length === 2 && md[0].kind === 'file' && !md[0].localId && md[1].localId === 'b_aud_77' && md[1].durationSec === 12, '坏附件被清洗、好附件保留 ' + JSON.stringify(md));
  rej(TM.act(m, O, 'idea.create', { media: 'abc' }), '只有坏附件、没有文字时不能建');
  m.ideas[0].media = 'abc'; m.ideas[1].media = [null, { kind: 'audio' }];
  const mm = TM.migrate(m); ok(Array.isArray(mm.ideas[0].media) && mm.ideas[1].media.length === 1, '历史坏附件加载时清洗');
  let thrown = null; try { TM.viewFor(mm, O); TM.viewFor(mm, DV); } catch (e) { thrown = e; } ok(!thrown, '清洗后下发不抛异常 ' + (thrown && thrown.message)); }

// ===== 权限收紧：老板不能改别人的私人草稿；清单项必须属于该任务；暂停期间不能验收 =====
{ const g = fresh();
  const dr = must(TM.act(g, LD, 'idea.create', { note: '负责人的私人草稿', media: [{ kind: 'audio', name: '录音', localId: 'b_aud_88' }] }), '负责人建私人草稿');
  for (const [a, pl] of [['idea.tags', { tags: ['x'] }], ['idea.attach', { media: [{ kind: 'link', name: 'l', url: 'https://a.cn' }] }], ['idea.retitle', { title: '改' }], ['idea.mediaShow', { index: 0, show: true }], ['idea.detach', { index: 0 }]])
    rej(TM.act(g, O, a, Object.assign({ id: dr.id }, pl)), '老板不能对别人的私人草稿做 ' + a);
  const t1 = g.tasks.find(t => t.ownerId === DV && ['accepted', 'in_progress'].includes(t.status));
  const foreign = g.checklist.find(c => c.taskId !== (t1 && t1.id));
  if (t1 && foreign) rej(TM.act(g, DV, 'task.check', { id: t1.id, itemId: foreign.id }), '不能勾选别的任务的清单项');
  const sub = g.tasks.find(t => t.status === 'submitted');
  if (sub) { const w = g.workItems.find(x => x.id === sub.workId); must(TM.act(g, O, 'work.pause', { id: w.id, reason: '先停一下' }), '老板暂停项目');
    rej(TM.act(g, sub.reviewerId, 'task.review', { id: sub.id, verdict: 'pass', note: '好' }), '暂停期间不能验收');
    must(TM.act(g, O, 'work.resume', { id: w.id }), '恢复'); must(TM.act(g, sub.reviewerId, 'task.review', { id: sub.id, verdict: 'pass', note: '好' }), '恢复后可以验收'); }
  else ok(false, '演示数据里没有待验收任务'); }

// ===== 编辑任务、更换项目人员 =====
{ const e = fresh();
  const et = e.tasks.find(t => !['done', 'cancelled'].includes(t.status) && e.workItems.find(w => w.id === t.workId).status !== 'paused');
  const ew = e.workItems.find(w => w.id === et.workId);
  rej(TM.act(e, et.ownerId === DV ? AX : DV, 'task.update', { id: et.id, due: '2026-12-01' }), '无关的人不能改任务');
  const eu = must(TM.act(e, O, 'task.update', { id: et.id, due: '2026-12-01', priority: 'hi', title: '改过的标题' }), '老板改任务截止、优先级、标题');
  const et2 = e.tasks.find(t => t.id === et.id);
  ok(et2.due === '2026-12-01' && et2.priority === 'hi' && et2.title === '改过的标题', '任务已更新');
  ok(e.events.some(v => v.taskId === et.id && v.action === 'task.update' && /截止/.test(v.text)), '修改写进动态');
  ok(e.notifications.some(n => n.userId === et.ownerId && /任务有修改/.test(n.title)), '执行人收到修改通知');
  rej(TM.act(e, O, 'task.update', { id: et.id, due: 'next week' }), '非法日期被拒');
  rej(TM.act(e, O, 'task.update', { id: et.id, reviewerId: et.ownerId }), '验收人不能是执行人自己');
  rej(TM.act(e, O, 'task.update', { id: et.id, title: '改过的标题' }), '没变化时提示没有要修改的内容');
  // 更换项目人员
  rej(TM.act(e, OP, 'work.reassign', { id: ew.id, leadId: O }), '运营者不能换负责人');
  const newRev = [LD, OP, O].find(x => x !== ew.reviewerId);
  must(TM.act(e, O, 'work.reassign', { id: ew.id, reviewerId: newRev }), '老板换验收人');
  ok(e.workItems.find(w => w.id === ew.id).reviewerId === newRev, '验收人已更换');
  rej(TM.act(e, O, 'work.reassign', { id: ew.id, operatorId: DV }), '跟进人必须是运营者');
  rej(TM.act(e, O, 'work.reassign', { id: ew.id }), '没有要换的人');
  // 派任务时验收人和日期要合法
  rej(TM.act(e, O, 'work.plan', { id: ew.id, tasks: [{ title: 'x', ownerId: DV, expected: 'a', criteria: 'b', reviewerId: 'nobody' }] }), '验收人不存在被拒');
  rej(TM.act(e, O, 'work.plan', { id: ew.id, tasks: [{ title: 'x', ownerId: DV, expected: 'a', criteria: 'b', due: { a: 1 } }] }), '非法截止日期被拒'); }

// ===== 原型链名字不能当枚举；长度上限；删除记录老板可见；认领不泄露姓名 =====
{ const f2 = fresh();
  rej(TM.act(f2, O, 'project.create', { title: 'x', desc: 'y', ptype: 'constructor' }), 'ptype=constructor 被拒');
  const anyT = f2.tasks.find(t => t.ownerId === DV);
  { let err = null, r = null; try { r = TM.act(f2, DV, 'task.transition', { id: anyT.id, action: '__proto__' }); } catch (e) { err = e; } ok(!err && r && !r.ok, 'action=__proto__ 是用户错误，不抛异常'); }
  rej(TM.act(f2, O, 'idea.create', { note: 'x'.repeat(20001) }), '想法内容超过 2 万字被拒');
  const di = must(TM.act(f2, O, 'idea.create', { note: '要删的' }), '建想法'); must(TM.act(f2, O, 'idea.delete', { id: di.id, reason: '重复' }), '删除');
  ok(TM.viewFor(f2, O).events.some(e => e.action === 'idea.delete' && e.ideaId === di.id), '老板在动态里能看到删除记录');
  ok(!TM.viewFor(f2, DV).events.some(e => e.action === 'idea.delete'), '执行者看不到删除记录');
  const ci2 = f2.ideas.find(d => d.status === 'triage' && d.followerId);
  if (ci2) { const r2 = TM.act(f2, O, 'idea.claim', { id: ci2.id }); ok(!r2.ok && !(r2.error || '').includes(TM.name(f2, ci2.followerId)), '认领失败不泄露跟进人姓名'); } }

// ===== @提及、回复通知；老板解除阻碍和代验收；没人接收算无动静；验收积压提醒 =====
{ let tt = Date.UTC(2026, 9, 1, 3); const ck = () => tt; const n = TM.seed(ck);
  const mt = n.tasks.find(t => t.ownerId === DV && !['done', 'cancelled'].includes(t.status));
  const n0 = n.notifications.length;
  must(TM.act(n, DV, 'task.comment', { id: mt.id, body: '@Enos 这个要不要加预算？' }), '留言里 @老板');
  ok(n.notifications.slice(n0).some(x => x.userId === O && /提到了你/.test(x.title)), '被 @ 的人收到「提到了你」');
  // 共创讨论里回复别人的建议
  const ci = must(TM.act(n, O, 'idea.create', { note: '年会怎么办' }), '建想法'); must(TM.act(n, O, 'idea.submit', { id: ci.id, path: 'cocreate', shareAll: true }), '全体共创');
  const s1 = must(TM.act(n, DV, 'idea.suggest', { id: ci.id, body: '去海边' }), '刘洋提建议');
  const n1 = n.notifications.length; must(TM.act(n, DS, 'idea.suggest', { id: ci.id, body: '太远了', replyTo: s1.id }), '何静回复刘洋');
  ok(n.notifications.slice(n1).some(x => x.userId === DV && /回复了你的建议/.test(x.title)), '被回复的人收到通知');
  // 老板解除阻碍
  const bt = n.tasks.find(t => ['accepted', 'in_progress'].includes(t.status) && n.workItems.find(w => w.id === t.workId).status !== 'paused');
  must(TM.act(n, bt.ownerId, 'task.transition', { id: bt.id, action: 'block', note: '缺钱' }), '执行人报阻碍');
  must(TM.act(n, O, 'task.transition', { id: bt.id, action: 'unblock', note: '已批预算' }), '老板可以解除阻碍');
  // 没人接收算无动静
  tt += 30 * 864e5; const at = n.tasks.find(t => t.status === 'assigned'); if (at) ok(TM.isStale(n, at), '派出去很久没人接收算无动静');
  // 验收积压提醒
  const sb = n.tasks.find(t => t.status === 'submitted'); if (sb) { const n2 = n.notifications.length; must(TM.act(n, 'agent', 'system.dueReminders', {}), '系统提醒');
    ok(n.notifications.slice(n2).some(x => x.userId === sb.reviewerId && /等你验收/.test(x.title)), '待验收积压提醒验收人 ' + JSON.stringify({ id: sb.id, la: sb.lastActivity, now: tt, r: sb.reviewRemindedOn, ns: n.notifications.slice(n2).map(x => x.userId + x.title) })); }
  // 老板代验收
  const aw = n.workItems.find(w => w.status === 'acceptance'); if (aw && aw.reviewerId !== O) { must(TM.act(n, O, 'work.close', { id: aw.id }), '老板代验收'); ok(n.events.some(e => e.workId === aw.id && /老板代验收/.test(e.text)), '动态写明老板代验收'); } }

// ===== 隐私：联系方式和公司策略按角色下发 =====
{ const pv = fresh(); pv.users.find(u => u.id === OP).email = 'lin@x.cn'; pv.users.find(u => u.id === OP).phone = '13800000000';
  const vd = TM.viewFor(pv, DV), vo = TM.viewFor(pv, O), vop = TM.viewFor(pv, OP);
  ok(!vd.users.find(u => u.id === OP).email && !vd.users.find(u => u.id === OP).phone, '执行者看不到别人的邮箱手机');
  ok(vo.users.find(u => u.id === OP).email === 'lin@x.cn', '老板能看到成员联系方式');
  ok(vop.users.find(u => u.id === OP).email === 'lin@x.cn', '自己能看到自己的联系方式');
  ok(vd.settings.direction === undefined && vd.settings.budgetThreshold === undefined && vd.settings.staleDays === pv.settings.staleDays, '执行者拿不到公司方向和预算阈值，界面需要的设置照常');
  ok(vop.settings.budgetThreshold === pv.settings.budgetThreshold, '运营者能拿到预算阈值（整理派发要用）'); }

// ===== 添加管理员、调整角色 =====
{ const m = TM.blank({ name: '王老板' }, clock), bo = m.users[0].id;
  const ad = must(TM.act(m, bo, 'member.add', { name: '小管', role: 'admin', group: '管理层' }), '老板添加管理员');
  ok(TM.hasRole(m, ad.id, 'admin'), '新成员是管理员');
  rej(TM.act(m, ad.id, 'member.add', { name: '小管2', role: 'admin', group: '管理层' }), '管理员不能再加管理员');
  const ex = must(TM.act(m, bo, 'member.add', { name: '小李', role: 'executor', group: '行政运营' }), '添加执行者');
  must(TM.act(m, bo, 'member.role', { id: ex.id, role: 'operator' }), '老板把执行者调整为运营者');
  ok(TM.hasRole(m, ex.id, 'operator') && TM.followUsers(m).includes(ex.id), '调整后成为跟进人候选');
  ok(m.notifications.some(n => n.userId === ex.id && /角色调整/.test(n.title)), '本人收到角色调整通知');
  rej(TM.act(m, bo, 'member.role', { id: ex.id, role: 'operator' }), '角色没变化时提示');
  rej(TM.act(m, ad.id, 'member.role', { id: ex.id, role: 'lead' }), '管理员不能调整角色');
  rej(TM.act(m, bo, 'member.role', { id: bo, role: 'executor' }), '老板的角色不能改'); }

// ===== 项目讨论 =====
{ const wc = fresh(), w = wc.workItems.find(x => x.status !== 'cancelled' && x.leadId);
  const outsider = wc.users.map(u => u.id).find(u => !TM.canViewWork(wc, u, w));
  if (outsider) rej(TM.act(wc, outsider, 'work.comment', { id: w.id, body: '我也说一句' }), '不是项目成员不能发言');
  const n0 = wc.notifications.length;
  must(TM.act(wc, w.leadId, 'work.comment', { id: w.id, body: '下周一前把方案定下来 @Enos' }), '负责人在项目里发言');
  ok(wc.notifications.slice(n0).some(n => n.userId === O && /提到了你/.test(n.title)), '@老板 收到提到通知');
  ok(TM.viewFor(wc, w.leadId).comments.some(c => c.workId === w.id), '项目成员能看到讨论');
  if (outsider) ok(!TM.viewFor(wc, outsider).comments.some(c => c.workId === w.id), '非项目成员拿不到讨论'); }

// ===== 通知设置：按类别静音（记下但已读、不推送）、免打扰格式、只能改自己的 =====
{ const nt = fresh();
  must(TM.act(nt, DV, 'member.update', { id: DV, prefs: { mute: ['cmt'], quietOn: true, quietFrom: '22:00', quietTo: '07:30' } }), '刘洋静音留言类、开免打扰');
  rej(TM.act(nt, DV, 'member.update', { id: DV, prefs: { mute: ['nope'] } }), '不认识的类别被拒');
  rej(TM.act(nt, DV, 'member.update', { id: DV, prefs: { quietFrom: '25:00' } }), '时间格式不对被拒');
  rej(TM.act(nt, O, 'member.update', { id: DV, prefs: { notifyImportant: false } }), '老板不能改别人的通知设置');
  const tk = nt.tasks.find(t => t.ownerId === DV && t.status !== 'cancelled'), n0 = nt.notifications.length;
  must(TM.act(nt, O, 'task.comment', { id: tk.id, body: '辛苦了' }), '老板留言');
  const got = nt.notifications.slice(n0).find(n => n.userId === DV);
  ok(got && got.read && got.muted, '静音类别的通知照样记下，但已读、标记静音');
  ok(TM.ncat('3 个任务等你验收') === 'review' && TM.ncat('任务已逾期') === 'remind' && TM.ncat('Enos 提到了你') === 'cmt' && TM.ncat('新任务派给你') === 'task', '通知分类正确'); }

console.log(`\n通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
