/* 团队管理 App · 领域引擎（纯逻辑，无 DOM）。浏览器与 Node 测试共用。 */
var TM = (function () {
  'use strict';
  var DAY = 86400000;

  var L = {
    role: { owner: '老板', operator: '运营者', lead: '项目负责人', executor: '执行者', admin: '管理员' },
    idea: { draft: '私人草稿', discussing: '共创讨论中', summary_ready: '待确认方向', triage: '待运营整理', awaiting_owner: '等老板决策', planned: '已形成项目', on_hold: '暂缓', declined: '不做' },
    work: { planning: '待规划', active: '进行中', acceptance: '待验收', done: '完成', blocked: '受阻', paused: '暂停', cancelled: '已取消' },
    task: { assigned: '待接收', accepted: '已接收', in_progress: '进行中', submitted: '待验收', done: '完成', owner_review: '老板终验', blocked: '受阻', cancelled: '已取消' },
    kind: { admin: '行政', product: '产品', other: '其他' },
    decision: { strategy_change: '战略方向变更', over_budget: '超预算', personnel: '人事决定', major_release: '重要对外发布', approval_all: '派发前确认', other: '其他' },
    decisionStatus: { pending: '待决策', approved: '已批准', rejected: '已否决', needs_info: '要求补充', withdrawn: '已撤回' },
    verdict: { pass: '验收通过', return: '退回', owner_pass: '老板终验通过', owner_return: '老板终验退回', owner_revoke: '老板撤销验收', comment: '复核意见' },
    route: { operator_direct: '运营者直接派发', to_lead: '交项目负责人', to_owner: '送老板决策' }
  };
  var STAGES = {
    product: [['clarify', '需求澄清'], ['prototype', '原型'], ['ui_review', '原型/UI 审核'], ['dev', '开发'], ['test', '测试'], ['release', '发布'], ['maintain', '维护']],
    admin: [['clarify', '澄清'], ['handle', '办理'], ['verify', '核验'], ['done', '完成']],
    other: [['clarify', '澄清']]
  };
  var TONE = {
    idea: { draft: 'hold', discussing: 'prog', summary_ready: 'wait', triage: 'wait', awaiting_owner: 'wait', planned: 'prog', on_hold: 'hold', declined: 'hold' },
    work: { planning: 'wait', active: 'prog', acceptance: 'wait', done: 'ok', blocked: 'bad', paused: 'hold', cancelled: 'hold' },
    task: { assigned: 'wait', accepted: 'prog', in_progress: 'prog', submitted: 'wait', done: 'ok', owner_review: 'wait', blocked: 'bad', cancelled: 'hold' },
    decision: { pending: 'wait', approved: 'ok', rejected: 'bad', needs_info: 'wait' }
  };

  function UserError(msg) { this.message = msg; this.userError = true; }
  function deny(msg) { throw new UserError(msg); }
  function need(cond, msg) { if (!cond) deny(msg); }
  function txt(v) { return (v == null ? '' : String(v)).trim(); }

  /* ---------- 基础查询 ---------- */
  function user(s, id) { return s.users.find(function (u) { return u.id === id; }); }
  // 在职：账号被停用 / 注销的成员（inactive）仍保留在团队记录里，但不再能被派任务、选为负责人或跟进人
  function live(s, id) { var u = user(s, id); return !!u && !u.inactive; }
  function activeUsers(s) { return s.users.filter(function (u) { return !u.inactive; }); }
  function name(s, id) { if (id === 'agent') return 'AI 助理'; if (id === 'system') return '系统'; var u = user(s, id); return u ? u.name : '—'; }
  function hasRole(s, uid, r) { var u = user(s, uid); return !!u && u.roles.some(function (a) { return a.role === r; }); }
  function canInitiate(s, uid) { var u = user(s, uid); return !!u && u.roles.some(function (a) { return a.role === 'owner' || (a.role === 'lead' && a.canInitiate); }); }
  /* 跟进人：团队里有运营者就是运营者；还没有运营者的小团队，由老板兼任（否则建不了项目、想法没人认领） */
  function followUsers(s) { var ops = usersWith(s, 'operator'); return ops.length ? ops : usersWith(s, 'owner'); }
  function leadUsers(s) { var l = usersWith(s, 'lead'); return l.length ? l : usersWith(s, 'owner'); }
  function canFollow(s, uid) { return hasRole(s, uid, 'operator') || (hasRole(s, uid, 'owner') && !usersWith(s, 'operator').length); }
  function usersWith(s, r) { return s.users.filter(function (u) { return !u.inactive && hasRole(s, u.id, r); }).map(function (u) { return u.id; }); }
  function primaryRole(s, uid) { var order = ['owner', 'operator', 'lead', 'executor', 'admin']; for (var i = 0; i < order.length; i++) if (hasRole(s, uid, order[i])) return order[i]; return 'executor'; }
  function get(arr, id, what) { var x = arr.find(function (o) { return o.id === id; }); if (!x) deny('找不到该' + (what || '记录')); return x; }
  // 已删除的想法对所有人都不可见，任何操作都不能再动它
  function idea(s, id) { var d = get(s.ideas, id, '想法'); if (d.deleted) deny('找不到该想法'); return d; }
  function work(s, id) { return get(s.workItems, id, '项目'); }
  function task(s, id) { return get(s.tasks, id, '任务'); }
  function nid(s, p) { s.seq = (s.seq || 100) + 1; return p + s.seq; }
  function now(s) { return s.clock ? s.clock() : Date.now(); }

  /* ---------- 可见性（对应文档第 11 节 RLS） ---------- */
  function canViewIdea(s, uid, d) {
    if (d && d.deleted) return false;
    if (d.creatorId === uid) return true;
    if (d.status === 'draft') return false;
    if (hasRole(s, uid, 'owner')) return true;
    if (d.followerId === uid) return true;
    if (hasRole(s, uid, 'operator') && d.status === 'triage' && !d.followerId) return true;
    if ((d.status === 'discussing' || d.status === 'summary_ready') && ((d.shareAll && !onlyAdmin(s, uid)) || d.shares.indexOf(uid) >= 0)) return true;
    return s.workItems.some(function (w) { return w.ideaId === d.id && (w.leadId === uid || w.operatorId === uid); });
  }
  function onlyAdmin(s, uid) { var u = user(s, uid); return !!u && u.roles.every(function (a) { return a.role === 'admin'; }); }
  function canSeeMediaItem(s, uid, d, m) { return canViewMedia(s, uid, d) && (!m.hidden || d.creatorId === uid || m.by === uid || hasRole(s, uid, 'owner')); }
  function canViewMedia(s, uid, d) {
    if (d.creatorId === uid) return true;
    if (d.status !== 'draft' && (hasRole(s, uid, 'owner') || d.followerId === uid)) return true;
    return false;
  }
  function deptLead(s, uid, deptId) { var u = user(s, uid); return !!u && u.roles.some(function (a) { return a.role === 'lead' && a.dept === deptId; }); }
  // ctx（可选，viewFor 批量判断时传入预先建好的索引，避免每条都全表扫描）：myWorks = 我有任务的项目，workById = 项目索引
  function canViewWork(s, uid, w, ctx) {
    if (hasRole(s, uid, 'owner')) return true;
    if (w.operatorId === uid || w.leadId === uid || w.reviewerId === uid) return true;
    if (deptLead(s, uid, w.dept)) return true;
    if (ctx && ctx.myWorks) return !!ctx.myWorks[w.id];
    return s.tasks.some(function (t) { return t.workId === w.id && (t.ownerId === uid || t.collabs.indexOf(uid) >= 0); });
  }
  function canViewTask(s, uid, t, ctx) {
    var w = ctx && ctx.workById ? ctx.workById[t.workId] : s.workItems.find(function (x) { return x.id === t.workId; });
    if (ctx && ctx.W) return !!w && !!ctx.W[w.id] && (hasRole(s, uid, 'owner') || w.operatorId === uid || w.leadId === uid || deptLead(s, uid, w.dept) || t.reviewerId === uid || t.ownerId === uid || t.collabs.indexOf(uid) >= 0);
    if (!w || !canViewWork(s, uid, w)) return false;
    return hasRole(s, uid, 'owner') || w.operatorId === uid || w.leadId === uid || deptLead(s, uid, w.dept) || t.reviewerId === uid || t.ownerId === uid || t.collabs.indexOf(uid) >= 0;
  }
  function canSuggest(s, uid, d) {
    return d.status === 'discussing' && live(s, uid) && (d.creatorId === uid || (d.shareAll && !onlyAdmin(s, uid)) || d.shares.indexOf(uid) >= 0 || hasRole(s, uid, 'owner'));
  }

  /* ---------- 审计、通知、活跃度 ---------- */
  function ev(s, o) {
    s.events.push({ id: nid(s, 'E'), at: now(s), ideaId: o.ideaId || null, workId: o.workId || null, taskId: o.taskId || null,
      actorType: o.actor === 'agent' ? 'agent' : o.actor === 'system' ? 'system' : 'human', actorId: o.actor, action: o.action,
      from: o.from || null, to: o.to || null, reason: o.reason || null, text: o.text || '' });
  }
  // 文字里 @姓名 提到的在职成员（姓名长的先匹配，避免「王小明」被当成「王小」）
  function mentioned(s, text) {
    var t = String(text || ''), out = [];
    activeUsers(s).slice().sort(function (a, b) { return b.name.length - a.name.length; }).forEach(function (u) { if (u.name && t.indexOf('@' + u.name) >= 0) { out.push(u.id); t = t.split('@' + u.name).join(''); } });
    return out;
  }
  /* 通知分类（用于「通知设置」按类别开关）：决策、验收、任务、留言讨论、团队、提醒 */
  var NCATS = { dec: '决策', review: '验收', task: '任务', cmt: '留言与讨论', team: '团队与成员', remind: '截止提醒与早报' };
  // 只看标题模板本身：去掉开头的发言人姓名、冒号后面的用户内容（不然叫「陈验收」的人发的留言会被当成验收类）
  function ncat(title, who) { var t = String(title || ''); if (who && t.indexOf(who) === 0) t = t.slice(who.length); t = t.split(/[：:]/)[0]; return /决策|上报|老板确认|批准/.test(t) ? 'dec' : /验收|终验|提交了成果/.test(t) ? 'review' : /提到了你|留言|回复|建议|讨论|发言|评论/.test(t) ? 'cmt' : /逾期|截止|早报|提醒/.test(t) ? 'remind' : /成员|加入|停用|注销|角色/.test(t) ? 'team' : 'task'; }
  function notify(s, uids, actor, title, body, link) {
    var seen = {};
    (uids || []).forEach(function (u) {
      if (!u || u === actor || seen[u] || u === 'agent' || u === 'system') return; seen[u] = 1;
      // 关掉的类别：仍记在通知列表里（可查），但直接标为已读、不推送
      var uu = user(s, u), mute = uu && uu.prefs && Array.isArray(uu.prefs.mute) && uu.prefs.mute.indexOf(ncat(title, actor && name(s, actor))) >= 0;
      s.notifications.push({ id: nid(s, 'N'), userId: u, from: actor || null, title: title, body: body || '', link: link || '', at: now(s), read: !!mute, muted: mute || undefined });
    });
  }
  function touchTask(s, t) { var n = now(s); t.lastActivity = n; var w = s.workItems.find(function (x) { return x.id === t.workId; }); if (w) touchWork(s, w); }
  function touchWork(s, w) { var n = now(s); w.lastActivity = n; if (w.ideaId) { var d = s.ideas.find(function (x) { return x.id === w.ideaId; }); if (d) d.lastActivity = n; } }
  function touchIdea(s, d) { d.lastActivity = now(s); }

  /* ---------- 模拟 AI（演示，规则生成，非真实大模型） ---------- */
  function has(t, words) { return words.some(function (w) { return t.indexOf(w) >= 0; }); }
  /* 规则模拟：把原文整理成「核心概述 / 目标 / 当前问题 / 建议方向」 */
  // 想法的全部文字：原文 + 录音 / 视频的转写（服务器用 whisper 转写后写入 media[].transcript）
  function noteOf(d) {
    var tr = (d.media || []).filter(function (m) { return m.transcript; }).map(function (m) { return m.transcript; });
    return [txt(d.note)].concat(tr).filter(Boolean).join('\n');
  }
  function deriveAnalysis(d) {
    var note = txt(noteOf(d)), title = d.title || note.slice(0, 18) || '这件事', t = title + ' ' + note;
    var hire = has(t, ['招聘', '招人', '招两', '招一', '扩编', '人手', '人力', '团队扩']);
    var cat = has(t, ['网线', '采购', '场地', '报销', '办公', '打印', '维修', '投影', '设备', '会议室', '饮水', '墨盒']) ? 'admin' : has(t, ['App', 'app', '产品', '原型', '功能', '系统', '小程序', '网站', '官网', '界面']) ? 'product' : 'other';
    var sents = note.split(/[。！？!?\n；;]/).map(function (x) { return x.replace(/^(?:【[^】]*】|\d+\s*[.、．]\s*)+/, '').trim(); }).filter(function (x) { return x.length > 3; });
    var overview = hire ? '结合' + (has(t, ['明年']) ? '明年' : '后续') + '的项目需求和现有人力，评估是否需要扩充团队' + (has(t, ['前端']) && has(t, ['后端']) ? '（倾向前端、后端各 1 人）' : '') + '，并综合预算、用工方式和时间安排，形成可执行的招聘方案。'
      : sents.length ? sents.slice(0, 2).join('，') + '。' : title;
    var goal = hire ? '确定是否扩充团队，以及具体的招聘数量、岗位类型、用工方式和预算方案。'
      : cat === 'admin' ? '把「' + title + '」处理好，并留下可以核对的结果（照片或说明）。'
      : cat === 'product' ? '明确「' + title + '」的需求范围、负责人和上线时间，做出能验收的版本。'
      : '把「' + title + '」落实成有负责人、有截止时间、能验收的事项。';
    var issues = sents.filter(function (x) { return has(x, ['跟不上', '不够', '不足', '没确定', '未确定', '不知道', '还没', '问题', '缺', '太慢', '太多', '越来越多', '困难', '麻烦', '坏了', '不清楚']); }).map(function (x) { return x.length > 26 ? x.slice(0, 26) + '…' : x; });
    if (hire) { issues = ['项目越来越多，现有人力可能不足']; if (!/\d+\s*(人|名)|[一两二三四五]名|[一两二三四五]个人/.test(t) || has(t, ['几个人', '招几'])) issues.push('招聘人数、岗位配置尚未确定'); else issues.push('岗位配置需要进一步确认'); }
    if (has(t, ['全职']) || has(t, ['兼职'])) issues.push('全职还是兼职尚未决定');
    if (has(t, ['预算']) && !/\d+\s*(万|元)/.test(t)) issues.push('预算还不明确');
    if (!has(t, ['天', '周', '号', '截止', '月底', '月初']) || has(t, ['什么时候', '没确定什么时候'])) issues.push((hire ? '招聘' : '完成') + '时间还没确定');
    issues = issues.filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 5);
    if (!issues.length) issues = ['原文没有写明遇到的具体问题，需要发起人补充'];
    var directions = hire ? ['评估现有工作量与人力负荷', '梳理明年的项目需求', '制定招聘方案（人数、岗位、全职 / 兼职）', '核算预算并选择招聘渠道', '提交团队讨论后由老板决策']
      : cat === 'admin' ? ['确认需求、数量和预算', '指定负责人去处理或采购', '完成后拍照或写明结果', '验收人确认后关闭']
      : cat === 'product' ? ['梳理需求和使用场景', '指定项目负责人', '拆成原型、设计、开发等任务', '约定上线时间和验收标准']
      : ['补充背景和想达到的目标', '确定负责人', '拆成几个可以执行的任务', '约定截止时间和验收标准'];
    return { overview: overview, goal: goal, issues: issues, directions: directions };
  }
  /* 规则模拟：AI 给想法拟一个清楚的标题（不是截取原文） */
  var FILLER = /^(?:我觉得|觉得|我想|我们|我|大家|咱们|最近|可能|需要|想要|想|希望|考虑|打算|准备好|应该|要|先|再|还是|就|也|能不能|可不可以|是否|一下|一个)+/;
  var ACT = /招|扩编|开发|做|建|搭建|换|改|更新|升级|采购|买|准备|举办|办|订|预订|上线|发布|推出|培训|整理|优化|设立|成立|组织|装|安装|修|维修|制定|规划|策划|调整|录|拍|写|设计|对接|申请|报名|开通/;
  function aiTitle(d) {
    var raw = String(d ? noteOf(d) : '').replace(/【[^】]*】[。.]?/g, ' ').replace(/(^|\n)\s*(?:\d+\s*[.、．)）]\s*|[·•-]\s*)+/g, '$1');
    if (!raw.trim()) return (d && d.media && d.media.length) ? (d.media[0].kind === 'audio' ? '语音想法（待整理）' : d.media[0].kind === 'video' ? '视频想法（待整理）' : '文件想法（待整理）') : '未命名想法';
    var t = raw.replace(/\s+/g, ' ');
    var when = (t.match(/明年|今年年底|年底|下个月|下周|本月|这个月|(\d{1,2})\s*月(?:份)?/) || [''])[0].replace(/\s+/g, '');
    if (/招|扩编|扩充|人手|人力/.test(t) && /开发|前端|后端|程序|技术/.test(t)) {
      var n = (t.match(/([一两二三四五六七八九十\d]+)\s*(?:名|个人|位)/) || [])[1];
      return (when || '') + '开发团队扩编' + (n ? '（招 ' + ({ '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5 }[n] || n) + ' 人）' : '');
    }
    if (/招|招聘|招人/.test(t)) { var role = (t.match(/招(?:聘)?(?:[一两二三四五\d]+\s*(?:名|个|位))?([^\s，。,；;！!？?]{2,6})/) || [])[1]; return (when || '') + '招聘' + (role ? role.replace(/的?人$/, '') : '新同工'); }
    var clean = function (x) { return x.trim().replace(FILLER, '').replace(/^(?:提前|赶紧|尽快|先)/, '').replace(/(?:一下|吧|了|呢|啊|的事|这件事)+$/, '').trim(); };
    var parts = t.split(/[，。,；;！!？?\n]/).map(clean).filter(function (x) { return x.length >= 2; });
    var PROB = /^(.{1,10}?)(?:[\d一两二三四五六七八九十]+\s*年|很久|一直|有点|总是)?(?:不好|坏了?|太慢|太差|没更新|不够用?|跟不上|有问题|不行|老化|太旧|太乱)/;
    var subj = '', acts = [], topic = '';
    parts.forEach(function (x) {
      var m = x.match(PROB);
      if (m && !subj) { subj = m[1].replace(/^(?:现在|最近|目前|我们的?|公司的?)/, '').replace(/[的地]$/, ''); return; }
      if (/^(?:别|不要|不用|不能)/.test(x)) return;
      if (ACT.test(x) || /^加/.test(x)) acts.push(x); else if (!topic && !acts.length && x.length <= 16 && !/成员|可以|意见|大家|分享/.test(x)) topic = x;
    });
    var VN = { '换': '更换', '修': '维修', '买': '采购', '订': '预订', '加': '添置', '装': '安装' };
    var noObj = function (x) { return /^[换修买订加装][一两几\d]?[台个张套根件]?$/.test(x); };
    var norm = function (x) { x = x.replace(/^(?:做|搞|弄|出)一?个/, '').replace(/^想/, '').replace(/可以|能够/g, ''); return x.length > 6 ? x.replace(/(?:给|让|请)[^，]{1,6}(?:试|看|用|听)$/, '') : x; };
    var title = '';
    var a0 = acts[0] ? norm(acts[0]) : '';
    if (subj && a0) title = noObj(acts[0]) ? (VN[acts[0][0]] || acts[0][0]) + subj : (a0.indexOf(subj) >= 0 ? a0 : (subj.length <= 4 && !/\d/.test(subj) && /新|版|上线|发布/.test(a0) ? subj + ' ' + a0 : a0 + '，解决' + subj + '问题'));
    else if (topic && acts.length >= 2) title = topic + '：' + acts.slice(0, 2).map(norm).join('、');
    else if (topic && a0) title = (topic + '：' + a0).length <= 22 ? topic + '：' + a0 : topic;
    else if (a0) title = a0;
    else if (subj) title = subj + '问题处理';
    else title = parts[0] || t;
    if (title.length > 24) { var cut = title.slice(0, 24), k = Math.max(cut.lastIndexOf('，'), cut.lastIndexOf('、'), cut.lastIndexOf('：')); title = k > 6 ? cut.slice(0, k) : cut; }
    if (when && title.indexOf(when) < 0 && !/\d\s*月/.test(title)) title = when + title;
    return title.replace(/\s+/g, ' ').trim();
  }
  /* ---------- AI 知识库：公司资料与老板思想（规则检索，非语义理解） ---------- */
  var KB_SEED = [
    { title: '公司方向与价值观（示例）', body: '# 公司方向与价值观\n\n## 我们为什么存在\n用技术服务海外华人群体，让事工和团队协作更有效率。\n\n## 做事原则\n- 先想清楚再动手：每件事都要写清楚目标、负责人、截止时间和验收标准。\n- 小步试点：新想法先用最小成本试 2 周，有反馈再扩大。\n- 凡事凭爱心而做：对同工要有耐心，批评对事不对人。\n\n## 今年重点\n1. 把团队协同 App 做稳定，让每个人都用起来。\n2. 控制成本，没有把握的投入先做方案再决定。' },
    { title: '用人与预算原则（示例）', body: '# 用人与预算原则\n\n## 招聘\n- 招人之前先评估现有工作量，能通过分工解决的先不招。\n- 新岗位先写清楚岗位职责和三个月内要交出的成果。\n- 优先考虑兼职或试用，三个月后再决定是否转全职。\n\n## 预算\n- 单笔超过 5000 元的支出需要老板确认。\n- 采购先比价，至少看两家。\n- 长期成本（工资、订阅）比一次性支出更要谨慎。' }
  ];
  function kbInit(s) { if (s.knowledge) return; s.knowledge = KB_SEED.map(function (x, i) { return { id: 'K' + (i + 1), title: x.title, body: x.body, scope: 'team', on: true, demo: true, by: 'u_owner', at: s.settings ? now(s) : Date.now(), size: x.body.length }; }); }
  function kbCan(s, uid) { return hasRole(s, uid, 'owner') || hasRole(s, uid, 'admin'); }
  /* ---------- 角色能力表：界面按它显示或隐藏入口（用不了的功能不展示） ---------- */
  function canCreateProject(s, uid) {
    if (hasRole(s, uid, 'owner')) return true;
    if (s.settings.ownerApprovalMode === 'all') return false;
    return hasRole(s, uid, 'operator') || (canInitiate(s, uid) && hasRole(s, uid, 'lead'));
  }
  var LIVE = ['planning', 'active', 'acceptance', 'blocked'];
  function canAssign(s, uid) {
    var owner = hasRole(s, uid, 'owner');
    return s.workItems.some(function (w) { return LIVE.indexOf(w.status) >= 0 && (owner || w.leadId === uid || w.operatorId === uid); });
  }
  function caps(s, uid) {
    var owner = hasRole(s, uid, 'owner'), admin = hasRole(s, uid, 'admin'), solo = onlyAdmin(s, uid);
    return {
      recordIdea: canInitiate(s, uid),          // 记录想法
      createProject: canCreateProject(s, uid),  // 新建项目
      assign: canAssign(s, uid),                // 分配任务
      claimIdeas: canFollow(s, uid),             // 认领整理想法（没有运营者时老板兼任）
      decide: owner,                            // 老板决策
      members: owner || admin,                  // 添加 / 管理成员
      settings: owner || admin,                 // 流程开关、提醒阈值
      direction: owner,                         // 公司方向
      kbEdit: kbCan(s, uid),                    // 知识库维护、口述整理
      resetData: owner || admin,                // 清理 / 重置数据
      ideas: !solo,                             // 想法页
      work: !solo,                              // 项目页
      tasks: !solo                              // 任务（项目任务）；纯管理员只有个人待办
    };
  }
  function kbVisible(s, uid) { kbInit(s); return s.knowledge.filter(function (k) { return k.scope === 'team' || kbCan(s, uid); }); }
  function kbTerms(t) {
    t = String(t || '').replace(/[\s，。！？、；：,.!?;:（）()【】\[\]「」"'“”#*\-\d]+/g, ' ');
    var out = []; t.split(' ').forEach(function (w) { if (!w) return; if (/^[A-Za-z]+$/.test(w)) { if (w.length > 2) out.push(w.toLowerCase()); return; } for (var i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2)); });
    var stop = ['我们', '一个', '这个', '那个', '可以', '需要', '是否', '什么', '没有', '还是', '如果', '因为', '所以', '已经', '现在', '比较', '一下', '然后', '自己', '他们', '你们', '要求', '同意'];
    return out.filter(function (x, i, a) { return a.indexOf(x) === i && stop.indexOf(x) < 0; });
  }
  // teamOnly：结果会存下来给员工看时（整理稿），只能引用公开给团队的资料，不能带出「仅 AI 可见」的老板资料
  function kbMatch(s, text, n, teamOnly) {
    kbInit(s); var x = String(text || ''), syn = [[/招(?!呼)/, '招聘 招人 岗位'], [/钱|花费|费用|成本|买/, '预算 支出 成本'], [/人手|人力|跟不上|忙不过来/, '工作量 招聘'], [/兼职|全职|试用/, '兼职 全职 试用'], [/方向|战略|目标/, '方向 重点'], [/同工|团队|同事/, '团队 同工']];
    syn.forEach(function (p) { if (p[0].test(x)) x += ' ' + p[1]; });
    var q = kbTerms(x); if (!q.length) return [];
    var hits = [];
    s.knowledge.filter(function (k) { return k.on && (!teamOnly || k.scope === 'team'); }).forEach(function (k) {
      var head = '';
      k.body.split(/\n+/).forEach(function (line) {
        var l = line.trim(); if (!l) return; if (/^#/.test(l)) { head = l.replace(/^#+\s*/, ''); return; }
        var clean = l.replace(/^[-*\d.、\s]+/, ''); if (clean.length < 6) return;
        var lt = kbTerms(clean + ' ' + head), sc = 0; q.forEach(function (w) { if (lt.indexOf(w) >= 0) sc += w.length > 2 ? 2 : 1; });
        if (sc >= 2) hits.push({ id: k.id, title: k.title, head: head, text: clean, score: sc });
      });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    var seen = {}; return hits.filter(function (h) { if (seen[h.text]) return false; seen[h.text] = 1; return true; }).slice(0, n || 3);
  }
  /* 规则模拟：给老板的决策建议（只是建议，决定由老板做） */
  function decisionAdvice(s, dc) {
    var d = dc.ideaId ? s.ideas.find(function (x) { return x.id === dc.ideaId; }) : null;
    var sm = d ? latestSummary(s, d.id, 'analysis') : null, p = sm ? sm.payload : {};
    var dv = d ? deriveAnalysis(d) : { issues: [], directions: [] };
    var t = (d ? (d.title || '') + ' ' + (d.note || '') : '') + ' ' + (dc.question || '');
    var oq = (p.open_questions || []).slice(), issues = p.issues || dv.issues || [];
    var money = t.match(/(\d+(?:\.\d+)?)\s*(万|元)/);
    var r = { verdict: 'approved', label: '建议批准', reasons: [], risks: [], checks: [], note: '' };
    if (dc.kind === 'personnel') {
      r.label = '建议有条件批准'; r.reasons.push('先批准做招聘方案，风险小，人数和预算可以等方案出来再定');
      if (issues.some(function (x) { return /人力|跟不上|不足/.test(x); })) r.reasons.push('原文提到项目增多、现有人力跟不上，需求是真实的');
      r.risks.push('用人是长期成本，招错人代价高'); r.risks.push('招聘周期通常 1–3 个月，需要提前排期');
      r.checks = ['招几个人、什么岗位', '每月用人预算上限', '全职还是兼职', '希望什么时候到岗'];
      r.note = '同意先出招聘方案（人数、岗位、预算、时间），方案出来再定招不招、招几个。';
    } else if (dc.kind === 'over_budget') {
      r.verdict = 'needs_info'; r.label = '建议先补充信息';
      r.reasons.push(money ? '金额 ' + money[0] + ' 超过了设定的预算线' : '涉及超预算，但没写具体金额');
      r.risks.push('钱花出去不容易收回，需要先看清楚明细');
      r.checks = ['具体金额和费用明细', '能不能分期或先做一部分', '有没有更便宜的替代方案', '花了之后怎么算有效果'];
      r.note = '请补充费用明细和替代方案，再报我决定。';
    } else if (dc.kind === 'strategy_change') {
      r.verdict = 'needs_info'; r.label = '建议当面讨论后再定';
      r.reasons.push('改变方向影响面大，不适合只看文字就拍板');
      r.risks.push('影响正在做的项目和团队预期');
      r.checks = ['为什么要改，依据是什么', '对现有项目有什么影响', '不改会怎样'];
      r.note = '这件事约个时间当面谈，请先准备改变的理由和影响范围。';
    } else if (dc.kind === 'major_release') {
      r.label = '建议有条件批准'; r.reasons.push('对外发布可以推进，但要有人把关内容');
      r.risks.push('对外内容一旦发出，很难撤回');
      r.checks = ['谁负责最后审核内容', '发布时间和渠道', '对外说法是否统一'];
      r.note = '同意发布，发布前由负责人审核内容，发给我看一眼最终版。';
    } else {
      if (oq.length) { r.verdict = 'needs_info'; r.label = '建议先补充信息'; r.reasons.push('整理稿里还有没说清楚的地方'); r.checks = oq.slice(0, 4); r.note = '请先补充：' + oq.slice(0, 3).join('；'); }
      else { r.reasons.push('信息基本完整，没有发现例外风险'); r.checks = ['负责人和截止时间']; r.note = '同意推进。'; }
    }
    r.refs = kbMatch(s, t + ' ' + (dc.kind === 'personnel' ? '招聘 招人 岗位 全职 兼职 工作量' : dc.kind === 'over_budget' ? '预算 支出 成本 采购' : ''), 3);
    oq.forEach(function (q) { if (r.checks.length < 5 && !r.checks.some(function (c) { return c.slice(0, 2) === q.slice(0, 2); })) r.checks.push(q.replace(/[？?]$/, '')); });
    return r;
  }
  function ideaText(d) { return (d.title || '') + ' ' + noteOf(d); }
  /* 原文里提到的金额（「5万」「3000元」「五万元」）有没有超过老板设的预算阈值；没设阈值就不算超预算 */
  function overBudget(s, t) {
    var lim = s.settings.budgetThreshold; if (!lim) return false;
    var cn = { '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 }, re = /(\d+(?:\.\d+)?|[一两二三四五六七八九十]+)\s*(万|千|元|块)/g, m;
    while ((m = re.exec(String(t || '')))) {
      var n = /\d/.test(m[1]) ? parseFloat(m[1]) : m[1].split('').reduce(function (a, c) { return c === '十' ? (a || 1) * 10 : a + cn[c]; }, 0);
      if (n * (m[2] === '万' ? 10000 : m[2] === '千' ? 1000 : 1) > lim) return true;
    }
    return false;
  }
  var CAT_ADMIN = ['网线', '网速', '采购', '场地', '报销', '办公', '打印', '订', '搬', '装修', '物资', '年会', '证件', '投影', '坏了', '维修', '饮水', '墨盒', '签到', '会议室', '设备', '换一'],
    CAT_PRODUCT = ['App', 'app', '产品', '原型', '功能', '开发', '系统', '小程序', '灵修', '网站', '官网', '界面'];
  function ruleCat(t) { return has(t, CAT_ADMIN) ? 'admin' : has(t, CAT_PRODUCT) ? 'product' : 'other'; }
  function mockAnalysis(s, d) {
    var t = (d.title || '') + ' ' + noteOf(d);
    var cat = ruleCat(t);
    var flags = [];
    if (has(t, ['战略', '转型', '方向调整', '砍掉'])) flags.push('strategy_change');
    if (overBudget(s, t)) flags.push('over_budget');
    if (has(t, ['招聘', '招人', '招两', '辞退', '调岗', '人事', '加薪'])) flags.push('personnel');
    if (has(t, ['对外发布', '官网', '公开发布', '上架', '发布会'])) flags.push('major_release');
    var dv = deriveAnalysis(d);
    var route = flags.length ? 'to_owner' : cat === 'product' ? 'to_lead' : 'operator_direct';
    var title = d.title || aiTitle(d);
    var oq = [];
    if (!has(t, ['天', '周', '月', '前', '截止'])) oq.push('期望什么时候完成？');
    if (!/(\d+(?:\.\d+)?|[一两二三四五六七八九十]+)\s*(万|千|元|块)/.test(t) && (cat === 'admin' || flags.length)) oq.push('预算上限是多少？');
    if (txt(d.note).length < 12) oq.push('原始描述较短，背景和目标需要发起人补充。');
    return {
      simulated: true, title: title, summary: txt(d.note).slice(0, 60) || title,
      background: txt(d.note) || '（材料中未说明）', problem: dv.issues.join('；'), goal: dv.goal, overview: dv.overview, issues: dv.issues, directions: dv.directions,
      category: cat, refs: kbMatch(s, t, 3, true), relation_to_direction: kbMatch(s, t, 1, true).length ? '与公司资料「' + kbMatch(s, t, 1, true)[0].title + '」相关：' + kbMatch(s, t, 1, true)[0].text : s.settings.direction ? '需对照公司方向判断是否闭环（演示未做判断）' : '知识库里没有找到相关的公司资料',
      options: [], open_questions: oq, exception_flags: flags, suggested_route: route,
      suggested_tasks: [{ title: title, expected_output: '完成说明 + 照片或截图', acceptance_criteria: '由验收人按目标确认', suggested_due_days: 3 }],
      confidence: 0.5
    };
  }
  var DISAGREE = ['不同意', '反对', '不建议', '先别', '不赞成', '我觉得不', '还是先'];
  function mockCocreate(s, d) {
    var sug = s.suggestions.filter(function (x) { return x.ideaId === d.id; });
    var tops = sug.filter(function (x) { return !x.replyTo; });
    var out = { simulated: true, consensus: [], divergences: [], risks: [], open_questions: [], proposed_direction: '' };
    tops.forEach(function (x) {
      var replies = sug.filter(function (r) { return r.replyTo === x.id; });
      var against = replies.filter(function (r) { return has(r.body, DISAGREE); });
      var short = x.body.length > 40 ? x.body.slice(0, 40) + '…' : x.body;
      if (has(x.body, ['?', '？'])) out.open_questions.push({ point: short, src: [x.id] });
      else if (has(x.body, ['风险', '成本', '担心', '隐患'])) out.risks.push({ point: short, src: [x.id] });
      else if (against.length) {
        out.divergences.push({ point: short, positions: [{ view: '支持：' + short, src: [x.id].concat(replies.filter(function (r) { return against.indexOf(r) < 0; }).map(function (r) { return r.id; })) }]
          .concat(against.map(function (r) { return { view: (r.body.length > 30 ? r.body.slice(0, 30) + '…' : r.body), src: [r.id] }; })) });
      } else out.consensus.push({ point: short, src: [x.id].concat(replies.map(function (r) { return r.id; })) });
    });
    out.proposed_direction = (d.title || '该想法') + '：按共识推进' + (out.divergences.length ? '，分歧项由发起人确定' : '') + '（供发起人确认，不代表团队共识）';
    return out;
  }
  /* 规则模拟：老板专用的讨论总结 */
  function mockDigest(s, d) {
    var sug = s.suggestions.filter(function (x) { return x.ideaId === d.id; }).sort(function (a, b) { return a.at - b.at; });
    var nmx = function (id) { var u = user(s, id); return u ? u.name : id; };
    var cut = function (t, n) { t = String(t || '').replace(/[。！!]+$/, ''); return t.length > n ? t.slice(0, n) + '…' : t; };
    var base = mockCocreate(s, d), ppl = sug.map(function (x) { return x.authorId; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
    var who = function (ids) { return ids.map(function (id) { var x = sug.find(function (q) { return q.id === id; }); return x ? nmx(x.authorId) : ''; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }); };
    var people = ppl.map(function (u) { return { name: nmx(u), points: sug.filter(function (x) { return x.authorId === u; }).map(function (x) { return (x.replyTo ? '回复：' : '') + cut(x.body, 36); }) }; });
    var consensus = base.consensus.map(function (c) { return { point: c.point, who: who(c.src) }; });
    var divergences = base.divergences.map(function (v) { return { point: v.point, sides: v.positions.map(function (q) { return { view: q.view.replace(/^支持：/, ''), who: who(q.src) }; }) }; });
    var risks = base.risks.map(function (r) { return { point: r.point, who: who(r.src) }; });
    var questions = base.open_questions.map(function (r) { return { point: r.point, who: who(r.src) }; });
    var next = [];
    divergences.forEach(function (v) { next.push('就「' + cut(v.point, 14) + '」拍板：' + v.sides.map(function (sd) { return sd.who.join('、') + '认为' + cut(sd.view.replace(/^我觉得|^我认为/, ''), 16); }).join('；')); });
    questions.forEach(function (q) { next.push('先回答：' + q.point); });
    risks.forEach(function (r) { next.push('评估风险：' + r.point); });
    if (consensus.length) next.push('按共识推进：' + consensus.map(function (c) { return cut(c.point, 18); }).join('；'));
    if (!next.length) next.push('讨论还不多，可以再等等大家的意见');
    return { simulated: true, count: sug.length, people: people, consensus: consensus, divergences: divergences, risks: risks, questions: questions, next: next.slice(0, 5),
      refs: kbMatch(s, (d.title || '') + ' ' + sug.map(function (x) { return x.body; }).join(' '), 2), lastSugAt: sug.length ? sug[sug.length - 1].at : 0 };
  }
  function runAnalysis(s, d, actorIsHuman) {
    if (s.settings.demoAiFail) {
      d.aiStatus = 'failed';
      ev(s, { ideaId: d.id, actor: 'agent', action: 'ai.analyze.failed', text: 'AI 整理失败（演示：已开启「模拟 AI 失败」）' });
      notify(s, d.followerId ? [d.followerId] : followUsers(s), null, 'AI 整理失败', (d.title || '想法') + '：可重试或手写整理稿', '#/idea/' + d.id);
      return;
    }
    var p = mockAnalysis(s, d);
    addSummary(s, d, 'analysis', p, 'agent');
    d.aiStatus = 'ready';
    if (!d.title) d.title = p.title;
    ev(s, { ideaId: d.id, actor: 'agent', action: 'ai.analyze.ready', text: '生成整理稿（模拟）· 建议：' + L.route[p.suggested_route] });
    // C3 + C2：Agent 可把整理稿直接送到「老板待决策」，但不做派发决定
    if (s.settings.agentDirectRoute && s.settings.ownerApprovalMode === 'all' && d.status === 'triage') {
      d.status = 'awaiting_owner';
      var dec = { id: nid(s, 'D'), ideaId: d.id, workId: null, kind: 'approval_all', question: '是否同意推进：' + d.title, requestedBy: 'agent', status: 'pending', decidedBy: null, note: '', at: now(s), decidedAt: null };
      s.decisions.push(dec);
      ev(s, { ideaId: d.id, actor: 'agent', action: 'idea.to_owner', from: 'triage', to: 'awaiting_owner', text: 'AI 助理按设置直接送老板确认' });
      notify(s, usersWith(s, 'owner'), null, '新的待决策', d.title, '#/idea/' + d.id);
    } else if (d.status === 'triage' && !d.followerId) {
      notify(s, followUsers(s), null, '有想法待认领', d.title, '#/idea/' + d.id);
    }
  }
  function addSummary(s, d, kind, payload, authorType, authorId) {
    var v = s.summaries.filter(function (x) { return x.ideaId === d.id && x.kind === kind; }).length + 1;
    var sm = { id: nid(s, 'S'), ideaId: d.id, kind: kind, version: v, authorType: authorType, authorId: authorId || null, payload: payload, at: now(s) };
    s.summaries.push(sm); return sm;
  }
  function latestSummary(s, ideaId, kind) {
    var xs = s.summaries.filter(function (x) { return x.ideaId === ideaId && x.kind === kind; });
    return xs.length ? xs[xs.length - 1] : null;
  }

  /* ---------- 动作（对应文档第 12 节 RPC） ---------- */
  var A = {};

  /* 附件清洗：客户端传来的附件只保留已知字段并校验类型和长度——坏数据（字符串、null、对象）以前会让下发数据和后台转写抛异常 */
  var MKINDS = ['audio', 'video', 'image', 'file', 'link', 'doc'], TRS = ['intext', 'pending', 'done', 'failed'];
  function cleanMedia(list) {
    return (Array.isArray(list) ? list : []).filter(function (x) { return x && typeof x === 'object' && !Array.isArray(x); }).map(function (x) {
      var k = MKINDS.indexOf(x.kind) >= 0 ? x.kind : 'file', m = { kind: k, name: txt(x.name).slice(0, 80) || (k === 'audio' ? '录音' : k === 'video' ? '视频' : k === 'link' ? '链接' : '文件') };
      if (typeof x.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(x.id)) m.id = x.id;
      if (typeof x.localId === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(x.localId)) m.localId = x.localId;
      if (k === 'link') m.url = /^https?:\/\/\S+\.\S+/.test(txt(x.url)) ? txt(x.url).slice(0, 500) : '';
      if (typeof x.size === 'string' || typeof x.size === 'number') m.size = String(x.size).slice(0, 20);
      if (typeof x.fname === 'string') m.fname = x.fname.slice(0, 120);
      if (typeof x.durationSec === 'number' && isFinite(x.durationSec)) m.durationSec = Math.max(0, Math.round(x.durationSec));
      if (TRS.indexOf(x.transcriptStatus) >= 0) m.transcriptStatus = x.transcriptStatus;
      if (typeof x.transcript === 'string') m.transcript = x.transcript.slice(0, 20000);
      if (typeof x.transcriptAt === 'number') m.transcriptAt = x.transcriptAt;
      if (typeof x.hidden === 'boolean') m.hidden = x.hidden;
      if (typeof x.at === 'number') m.at = x.at;
      if (typeof x.by === 'string') m.by = x.by.slice(0, 40);
      return m;
    }).slice(0, 30);
  }
  A['idea.create'] = function (s, uid, p) {
    need(canInitiate(s, uid), '只有老板和有发起权的负责人可以创建想法');
    p.media = cleanMedia(p.media); need(txt(p.note) || txt(p.title) || p.media.length, '请至少写一句话或附上录音'); need(txt(p.note).length <= 20000, '想法内容不超过 2 万字');
    var d = { id: nid(s, 'I'), creatorId: uid, dept: p.dept || null, path: null, status: 'draft', aiStatus: 'none', title: txt(p.title).slice(0, 30), titleSource: txt(p.title) ? 'user' : 'ai', note: txt(p.note),
      followerId: null, shareAll: false, shares: [], deadline: null, directionConfirmedAt: null, ownerApproved: false, reviewed: false,
      media: p.media, tags: (Array.isArray(p.tags) ? p.tags : []).map(txt).filter(Boolean).slice(0, 5), submittedAt: null, lastActivity: now(s), createdAt: now(s) };
    if (!d.title) d.title = aiTitle(d);
    s.ideas.push(d);
    ev(s, { ideaId: d.id, actor: uid, action: 'idea.create', to: 'draft', text: '保存为私人草稿' });
    return { id: d.id };
  };
  A['idea.update'] = function (s, uid, p) {
    var d = idea(s, p.id); need(d.creatorId === uid && d.status === 'draft', '只有发起人能修改自己的草稿');
    need(txt(p.note).length <= 20000, '想法内容不超过 2 万字'); var nt = txt(p.title).slice(0, 30); if (nt !== d.title) d.titleSource = nt ? 'user' : 'ai'; d.note = txt(p.note); d.title = nt || aiTitle(d); touchIdea(s, d);
    return {};
  };
  A['idea.submit'] = function (s, uid, p) {
    var d = idea(s, p.id);
    need(d.creatorId === uid, '只有发起人可以提交'); need(d.status === 'draft', '只有草稿可以提交');
    need(p.path === 'direct' || p.path === 'cocreate', '请选择直接推进或团队共创');
    d.path = p.path; d.submittedAt = now(s); touchIdea(s, d);
    if (p.path === 'direct') {
      d.status = 'triage'; d.aiStatus = 'queued';
      ev(s, { ideaId: d.id, actor: uid, action: 'idea.submit', from: 'draft', to: 'triage', text: '直接推进' });
      runAnalysis(s, d);
    } else {
      var ids = (Array.isArray(p.shares) ? p.shares : []).filter(function (x) { return x !== uid && live(s, x) && !onlyAdmin(s, x); });
      need(p.shareAll || ids.length, '共创请选择分享范围');
      if (p.deadline) need(typeof p.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.deadline) && p.deadline >= todayStr(s), '截止日期不正确（不能早于今天）');
      d.shareAll = !!p.shareAll; d.shares = ids; d.deadline = p.deadline || null; d.status = 'discussing';
      ev(s, { ideaId: d.id, actor: uid, action: 'idea.submit', from: 'draft', to: 'discussing', text: '开启团队共创（' + (d.shareAll ? '全体' : ids.length + ' 人') + (d.deadline ? '，有截止时间' : '，发起人手动结束') + '）' });
      notify(s, (d.shareAll ? activeUsers(s).map(function (u) { return u.id; }) : ids).filter(function (x) { return !onlyAdmin(s, x); }), uid, '邀请你参与共创', d.title || d.note.slice(0, 20), '#/idea/' + d.id);
    }
    return {};
  };
  A['idea.suggest'] = function (s, uid, p) {
    var d = idea(s, p.id);
    need(canSuggest(s, uid, d), d.status !== 'discussing' ? '讨论已结束，不能再提建议' : '该想法没有分享给你');
    var body = txt(p.body); need(body, '建议内容不能为空'); need(body.length <= 2000, '建议不超过 2000 字');
    if (p.replyTo) need(s.suggestions.some(function (x) { return x.id === p.replyTo && x.ideaId === d.id; }), '回复的建议不存在');
    var sg = { id: nid(s, 's'), ideaId: d.id, authorId: uid, replyTo: p.replyTo || null, body: body, at: now(s) };
    s.suggestions.push(sg); touchIdea(s, d);
    ev(s, { ideaId: d.id, actor: uid, action: 'idea.suggest', text: p.replyTo ? '回复了一条建议' : '提了一条建议' });
    var rp = p.replyTo && s.suggestions.find(function (x) { return x.id === p.replyTo; });
    if (rp && rp.authorId !== d.creatorId) notify(s, [rp.authorId], uid, name(s, uid) + ' 回复了你的建议', body.slice(0, 60), '#/idea/' + d.id);
    var at = mentioned(s, body).filter(function (x) { return canViewIdea(s, x, d); });
    if (at.length) notify(s, at, uid, name(s, uid) + ' 提到了你', body.slice(0, 60), '#/idea/' + d.id);
    notify(s, [d.creatorId], uid, name(s, uid) + (rp ? ' 回复了建议' : ' 提了建议'), d.title, '#/idea/' + d.id);
    return { id: sg.id };
  };
  A['idea.close'] = function (s, uid, p) {
    var d = idea(s, p.id);
    need(d.creatorId === uid || uid === 'system', '只有发起人可以结束讨论'); need(d.status === 'discussing', '当前不在讨论中'); // 没有建议也可以结束（文档 6.1），汇总里会写明
    d.status = 'summary_ready';
    var sm = addSummary(s, d, 'cocreate', mockCocreate(s, d), 'agent');
    ev(s, { ideaId: d.id, actor: uid, action: 'idea.close_discussion', from: 'discussing', to: 'summary_ready', text: '结束讨论' });
    ev(s, { ideaId: d.id, actor: 'agent', action: 'ai.cocreate.ready', text: '生成共创汇总 v' + sm.version + '（模拟）' });
    notify(s, [d.creatorId], uid, '共创汇总完成，请确认方向', d.title, '#/idea/' + d.id);
    touchIdea(s, d); return {};
  };
  /* 提交后 30 分钟还没人认领：再提醒所有运营者一次（文档 13.1） */
  A['system.triageNudge'] = function (s, uid) {
    need(uid === 'agent' || uid === 'system', '只有系统可以执行'); var n = 0;
    s.ideas.forEach(function (d) { if (d.deleted || d.status !== 'triage' || d.followerId || d.nudged || !d.submittedAt || d.submittedAt > now(s) - 30 * 60e3) return;
      d.nudged = true; notify(s, followUsers(s), null, '想法 30 分钟没人认领', d.title || '新想法', '#/idea/' + d.id); n++; });
    return { sent: n };
  };
  /* 共创截止（文档 5.2 / 13.1）：截止当天提醒发起人；过了截止日自动结束并生成汇总。服务器每 10 分钟以系统身份调用 */
  A['system.discussionDue'] = function (s, uid) {
    need(uid === 'agent' || uid === 'system', '只有系统可以执行'); var today = todayStr(s), closed = 0, warned = 0;
    s.ideas.forEach(function (d) {
      if (d.deleted || d.status !== 'discussing' || !d.deadline || !/^\d{4}-\d{2}-\d{2}$/.test(d.deadline)) return;
      if (d.deadline < today) { A['idea.close'](s, 'system', { id: d.id }); closed++; }
      else if (d.deadline === today && !d.dueWarned) { d.dueWarned = true; notify(s, [d.creatorId], null, '讨论今天截止', (d.title || '共创讨论') + '：今天结束后会自动汇总', '#/idea/' + d.id); warned++; }
    });
    return { closed: closed, warned: warned };
  };
  A['idea.reopen'] = function (s, uid, p) {
    var d = idea(s, p.id); need(d.creatorId === uid, '只有发起人可以重新开放'); need(d.status === 'summary_ready', '当前状态不能重新讨论');
    d.status = 'discussing'; d.deadline = null; d.dueWarned = false; /* 重新讨论后由发起人手动结束（不然过了旧截止日会被系统反复自动结束） */ ev(s, { ideaId: d.id, actor: uid, action: 'idea.reopen', from: 'summary_ready', to: 'discussing', text: '重新开放讨论' }); touchIdea(s, d); return {};
  };
  A['idea.confirm'] = function (s, uid, p) {
    var d = idea(s, p.id); need(d.creatorId === uid, '只有发起人可以确认方向'); need(d.status === 'summary_ready', '汇总完成后才能确认方向');
    var dir = txt(p.direction); need(dir, '请写下最终方向');
    var cur = latestSummary(s, d.id, 'cocreate');
    var payload = JSON.parse(JSON.stringify(cur ? cur.payload : {})); payload.confirmed_direction = dir;
    addSummary(s, d, 'cocreate', payload, 'human', uid);
    d.directionConfirmedAt = now(s); d.status = 'triage'; d.aiStatus = 'queued'; d.submittedAt = now(s); d.nudged = false; // 从这时起算「多久没人认领」
    d.note = d.note + (d.note ? '\n\n' : '') + '【确认方向】' + dir;
    ev(s, { ideaId: d.id, actor: uid, action: 'idea.confirm_direction', from: 'summary_ready', to: 'triage', text: '确认方向：' + dir });
    runAnalysis(s, d); touchIdea(s, d); return {};
  };
  A['idea.claim'] = function (s, uid, p) {
    var d = idea(s, p.id); need(canFollow(s, uid), '只有运营者可以认领'); need(d.status === 'triage', '只有待运营整理的想法可以认领'); need(!d.followerId, '这条想法已经有人认领了');
    d.followerId = uid; ev(s, { ideaId: d.id, actor: uid, action: 'idea.claim', text: '认领，成为跟进人' }); touchIdea(s, d); return {};
  };
  // 人工整理稿：只保留字符串 / 数字 / 布尔、数组和对象（限层数、个数、长度），防止塞入超大或奇怪的数据
  function cleanPayload(v, dep) {
    dep = dep || 0; if (typeof v === 'string') return v.slice(0, 3000); if (typeof v === 'number') return isFinite(v) ? v : 0; if (typeof v === 'boolean') return v;
    if (dep > 3 || !v || typeof v !== 'object') return undefined;
    if (Array.isArray(v)) return v.slice(0, 30).map(function (x) { return cleanPayload(x, dep + 1); }).filter(function (x) { return x !== undefined; });
    var o = {}; Object.keys(v).slice(0, 40).forEach(function (k) { if (k.length <= 40 && k !== '__proto__') { var c = cleanPayload(v[k], dep + 1); if (c !== undefined) o[k] = c; } }); return o;
  }
  A['idea.saveSummary'] = function (s, uid, p) {
    var d = idea(s, p.id);
    need(d.followerId === uid || hasRole(s, uid, 'owner'), '只有跟进人或老板可以修改整理稿');
    need(['triage', 'awaiting_owner'].indexOf(d.status) >= 0, '当前状态不能修改整理稿');
    var pl = cleanPayload(p.payload) || {}; need(txt(pl.title), '整理稿需要标题'); pl.title = txt(pl.title).slice(0, 30); need(JSON.stringify(pl).length <= 60000, '整理稿内容太长'); need(['admin', 'product', 'other'].indexOf(pl.category) >= 0, '请选择类别');
    pl.simulated = false;
    var sm = addSummary(s, d, 'analysis', pl, 'human', uid);
    d.title = pl.title; d.reviewed = true; if (d.aiStatus === 'failed') d.aiStatus = 'ready';
    ev(s, { ideaId: d.id, actor: uid, action: 'summary.save', text: '保存人工整理稿 v' + sm.version }); touchIdea(s, d); return {};
  };
  /* 老板改派跟进人：待整理 / 等老板决策的想法，换给另一位在职的运营者（或没有运营者时老板自己） */
  A['idea.reassignFollower'] = function (s, uid, p) {
    var d = idea(s, p.id); need(hasRole(s, uid, 'owner'), '只有老板可以改派跟进人'); need(['triage', 'awaiting_owner'].indexOf(d.status) >= 0, '只有待整理或等决策的想法可以改派跟进人');
    need(p.to && p.to !== d.followerId && live(s, p.to) && canFollow(s, p.to), '请选择在职的运营者');
    var old = d.followerId; d.followerId = p.to; touchIdea(s, d);
    ev(s, { ideaId: d.id, actor: uid, action: 'idea.reassignFollower', text: '跟进人：' + (old ? name(s, old) : '无') + ' → ' + name(s, p.to) });
    notify(s, [p.to], uid, '老板把一条想法交给你跟进', d.title, '#/idea/' + d.id);
    if (old) notify(s, [old], uid, '这条想法改由 ' + name(s, p.to) + ' 跟进', d.title, '#/idea/' + d.id);
    return {};
  };
  A['idea.tags'] = function (s, uid, p) {
    var d = idea(s, p.id); need(canViewIdea(s, uid, d), '找不到该想法'); need(d.creatorId === uid || d.followerId === uid || hasRole(s, uid, 'owner'), '只有发起人、跟进人或老板可以改标签');
    var tags = (p.tags || []).map(function (x) { return txt(x).replace(/^#/, ''); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    need(tags.length <= 5, '标签最多 5 个'); need(tags.every(function (x) { return x.length <= 8; }), '每个标签不超过 8 个字');
    d.tags = tags; ev(s, { ideaId: d.id, actor: uid, action: 'idea.tags', text: '标签改为：' + (tags.length ? tags.join('、') : '无') }); touchIdea(s, d); return {};
  };
  A['idea.reanalyze'] = function (s, uid, p) {
    var d = idea(s, p.id); need(d.followerId === uid || hasRole(s, uid, 'owner'), '只有跟进人或老板可以重新整理');
    need(['triage', 'awaiting_owner'].indexOf(d.status) >= 0, '当前状态不能重新整理');
    addSummary(s, d, 'analysis', mockAnalysis(s, d), 'agent'); d.aiStatus = 'ready';
    ev(s, { ideaId: d.id, actor: uid, action: 'ai.reanalyze', text: '重新生成 AI 整理稿（模拟）' }); touchIdea(s, d); return {};
  };
  A['idea.retryAi'] = function (s, uid, p) {
    var d = idea(s, p.id); need(d.followerId === uid || (canFollow(s, uid) && !d.followerId), '只有跟进人可以重试'); need(d.aiStatus === 'failed', 'AI 没有失败，无需重试');
    d.aiStatus = 'queued'; ev(s, { ideaId: d.id, actor: uid, action: 'ai.retry', text: '手动重试 AI 整理' }); runAnalysis(s, d); return {};
  };
  A['idea.requestDecision'] = function (s, uid, p) {
    var d = idea(s, p.id); need(d.followerId === uid || hasRole(s, uid, 'owner') || d.creatorId === uid, '只有跟进人、发起人或老板可以上报'); need(d.status === 'triage', '当前状态不能上报');
    need(Object.prototype.hasOwnProperty.call(L.decision, p.kind), '请选择例外类型'); var q = txt(p.question); need(q, '请写清楚要老板决定什么');
    var dec = { id: nid(s, 'D'), ideaId: d.id, workId: null, kind: p.kind, question: q, requestedBy: uid, status: 'pending', decidedBy: null, note: '', at: now(s), decidedAt: null };
    s.decisions.push(dec); d.status = 'awaiting_owner';
    ev(s, { ideaId: d.id, actor: uid, action: 'decision.request', from: 'triage', to: 'awaiting_owner', text: L.decision[p.kind] + '：' + q });
    notify(s, usersWith(s, 'owner'), uid, '新的待决策', q, '#/idea/' + d.id); touchIdea(s, d); return { id: dec.id };
  };
  /* 项目执行中遇到例外（超预算、人事等）：负责人 / 跟进运营上报老板决策，不改变想法状态（文档 4.2、12 request_decision 的项目级） */
  A['work.requestDecision'] = function (s, uid, p) {
    var w = work(s, p.id); need(w.leadId === uid || w.operatorId === uid, '只有项目负责人或跟进运营可以上报'); need(['done', 'cancelled'].indexOf(w.status) < 0, '项目已结束');
    need(Object.prototype.hasOwnProperty.call(L.decision, p.kind), '请选择例外类型'); var q = txt(p.question); need(q, '请写清楚要老板决定什么'); need(q.length <= 500, '不超过 500 字');
    need(!s.decisions.some(function (x) { return x.workId === w.id && x.status === 'pending'; }), '这个项目已有一条待老板决策，等老板决定后再上报');
    var dec = { id: nid(s, 'D'), ideaId: w.ideaId || null, workId: w.id, kind: p.kind, question: q, requestedBy: uid, status: 'pending', decidedBy: null, note: '', at: now(s), decidedAt: null };
    s.decisions.push(dec); ev(s, { workId: w.id, actor: uid, action: 'decision.request', text: '上报老板：' + L.decision[p.kind] + '：' + q });
    notify(s, usersWith(s, 'owner'), uid, '新的待决策', w.title + '：' + q, '#/work/' + w.id); touchWork(s, w); return { id: dec.id };
  };
  A['decision.decide'] = function (s, uid, p) {
    need(hasRole(s, uid, 'owner'), '只有老板可以做例外决策');
    var dec = get(s.decisions, p.id, '决策'); need(dec.status === 'pending', '该决策已处理');
    need(['approved', 'rejected', 'needs_info'].indexOf(p.status) >= 0, '请选择决定');
    var note = txt(p.note); if (p.status !== 'approved') need(note, '否决或要求补充时请写原因');
    dec.status = p.status; dec.decidedBy = uid; dec.note = note; dec.decidedAt = now(s);
    var d = dec.ideaId ? idea(s, dec.ideaId) : null;
    if (d && d.status === 'awaiting_owner') {
      var to = p.status === 'rejected' ? 'declined' : 'triage';
      if (p.status === 'approved') { d.ownerApproved = true; }
      d.status = to;
      ev(s, { ideaId: d.id, actor: uid, action: 'decision.' + p.status, from: 'awaiting_owner', to: to, reason: note, text: L.decisionStatus[p.status] + (note ? '：' + note : '') });
      var who = [d.creatorId]; if (d.followerId) who.push(d.followerId); else if (to === 'triage') who = who.concat(followUsers(s));
      notify(s, who, uid, '老板' + L.decisionStatus[p.status], d.title, '#/idea/' + d.id); touchIdea(s, d);
    } else if (dec.workId) {
      var w = s.workItems.find(function (x) { return x.id === dec.workId; });
      if (w) { ev(s, { workId: w.id, actor: uid, action: 'decision.' + p.status, reason: note, text: '老板' + L.decisionStatus[p.status] + '：' + dec.question + (note ? '（' + note + '）' : '') });
        notify(s, [dec.requestedBy, w.leadId, w.operatorId], uid, '老板' + L.decisionStatus[p.status], w.title + '：' + dec.question, '#/work/' + w.id); touchWork(s, w); }
    }
    return {};
  };
  A['idea.route'] = function (s, uid, p) {
    var d = idea(s, p.id); need(d.followerId === uid, '只有跟进人可以派发'); need(d.status === 'triage', '只有待运营整理的想法可以派发');
    if (s.settings.ownerApprovalMode === 'all') need(d.ownerApproved, '当前设置要求每条想法派发前由老板确认，请先送老板决策');
    var kind = p.kind; need(kind === 'admin' || kind === 'product' || kind === 'other', '请选择项目类型');
    var title = txt(p.title) || d.title; need(title, '项目需要标题');
    var w = { id: nid(s, 'W'), ideaId: d.id, dept: p.dept || d.dept, kind: kind, title: title, goal: txt(p.goal), status: 'planning', stage: 'clarify',
      operatorId: uid, leadId: null, reviewerId: uid, externalLink: '', due: p.due && typeof p.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.due) ? p.due : null, lastActivity: now(s), createdAt: now(s) };
    if (kind === 'product') {
      need(p.leadId && leadUsers(s).indexOf(p.leadId) >= 0, '专业事项请指定项目负责人'); // 没有负责人的小团队：老板可自任
      w.leadId = p.leadId; w.reviewerId = p.leadId;
    } else {
      var ts = p.tasks || []; need(ts.length, '行政事务请至少派一个任务');
      w.status = 'active'; w.stage = kind === 'admin' ? 'handle' : 'clarify';
    }
    s.workItems.push(w);
    d.status = 'planned'; touchIdea(s, d);
    ev(s, { ideaId: d.id, workId: w.id, actor: uid, action: 'idea.route', from: 'triage', to: 'planned', text: '形成项目「' + title + '」（' + L.kind[kind] + '）' + (w.leadId ? '，交 ' + name(s, w.leadId) : '') });
    if (kind === 'product') notify(s, [w.leadId], uid, '新项目待你规划', title, '#/work/' + w.id);
    else addTasks(s, uid, w, p.tasks);
    // 发起人（常常是老板）知道自己的想法已经落地成项目（闭环实测：之前发起人收不到任何消息）
    if (d.creatorId !== uid) notify(s, [d.creatorId], uid, '你的想法已立项', '「' + title + '」' + (kind === 'product' ? '交 ' + name(s, w.leadId) + ' 规划' : '已派出 ' + (p.tasks || []).length + ' 个任务') + '，由 ' + name(s, uid) + ' 跟进', '#/work/' + w.id);
    return { workId: w.id };
  };
  /* 默认验收人是项目的验收人；任务正好派给验收人自己时，换成负责人 / 跟进人 / 老板，不能自己验收自己（闭环实测发现） */
  function defReviewer(s, w, ownerId) {
    if (w.reviewerId !== ownerId) return w.reviewerId;
    return [w.leadId, w.operatorId].concat(usersWith(s, 'owner')).filter(function (id) { return id && id !== ownerId && live(s, id); })[0] || w.reviewerId;
  }
  function addTasks(s, uid, w, list) {
    list.forEach(function (x) {
      need(txt(x.title), '任务需要标题'); need(x.ownerId && user(s, x.ownerId), '请选择主负责人'); need(live(s, x.ownerId), name(s, x.ownerId) + ' 的账号已停用，不能派任务');
      need(txt(x.expected), '请写预期成果'); need(txt(x.criteria), '请写验收标准');
      var collabs = (x.collabs || []).filter(function (c, i, a) { return c !== x.ownerId && live(s, c) && a.indexOf(c) === i; });
      if (x.priority) need(['hi', 'mid', 'lo'].indexOf(x.priority) >= 0, '优先级不正确');
      if (txt(x.title).length > 50) deny('任务标题不超过 50 字');
      if (x.reviewerId) { need(live(s, x.reviewerId), '验收人不存在或已停用'); need(x.reviewerId !== x.ownerId, '验收人不能是执行人自己'); }
      if (x.due) need(typeof x.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.due), '截止日期不正确');
      var t = { id: nid(s, 'T'), workId: w.id, title: txt(x.title), description: txt(x.description).slice(0, 2000), ttype: typeof x.ttype === 'string' ? x.ttype.slice(0, 20) : '', priority: x.priority || 'mid', milestone: !!x.milestone, ownerId: x.ownerId, collabs: collabs, reviewerId: x.reviewerId || defReviewer(s, w, x.ownerId),
        due: x.due || (w.due && w.due >= todayStr(s) ? w.due : dateAdd(s, 7)), expected: txt(x.expected), /* 每个任务都要有截止（文档 5.4）：没填就用项目截止，再没有就一周后 */ criteria: txt(x.criteria), status: 'assigned', blockedReason: '', assignedBy: x.assignedBy || 'manual', lastActivity: now(s), createdAt: now(s) };
      s.tasks.push(t);
      ev(s, { workId: w.id, taskId: t.id, actor: uid, action: 'task.assign', to: 'assigned', text: (t.assignedBy === 'ai' ? '按 AI 推荐（人工确认）' : '') + '派给 ' + name(s, t.ownerId) + (t.collabs.length ? '，协作者 ' + t.collabs.map(function (c) { return name(s, c); }).join('、') : '') + '，验收人 ' + name(s, t.reviewerId) + (t.milestone ? '（里程碑）' : '') });
      notify(s, [t.ownerId].concat(t.collabs), uid, '新任务派给你', t.title, '#/task/' + t.id);
    });
    touchWork(s, w);
  }
  A['idea.setStatus'] = function (s, uid, p) {
    var d = idea(s, p.id); var owner = hasRole(s, uid, 'owner'); var reason = txt(p.reason);
    need(owner || d.followerId === uid, '只有跟进人或老板可以调整');
    need(reason, '请写原因');
    var ok = (d.status === 'triage' && (p.status === 'on_hold' || p.status === 'declined')) || (d.status === 'on_hold' && p.status === 'triage');
    need(ok, '不能从「' + L.idea[d.status] + '」改为「' + L.idea[p.status] + '」');
    if (p.status === 'declined' && !owner) need(p.creatorAgreed, '运营者决定「不做」需先征得发起人同意');
    var from = d.status; d.status = p.status;
    ev(s, { ideaId: d.id, actor: uid, action: 'idea.status', from: from, to: p.status, reason: reason, text: L.idea[p.status] + '：' + reason });
    notify(s, [d.creatorId, d.followerId], uid, '想法' + L.idea[p.status], d.title, '#/idea/' + d.id); touchIdea(s, d); return {};
  };

  /* 新建项目：老板/运营者可直接派发（文档 4.2：派发简单事务、交专业事项给负责人）；
     有发起权的负责人可在本部门建项目并自任负责人。保留一条想法记录用于追溯。 */
  var PTYPE = { product: ['产品开发', 'product'], ops: ['运营优化', 'other'], market: ['市场推广', 'other'], admin: ['行政事务', 'admin'], content: ['内容创作', 'other'], event: ['活动策划', 'admin'], research: ['研究学习', 'other'], training: ['培训教育', 'other'], mission: ['宣教外展', 'other'], care: ['关怀探访', 'admin'], finance: ['财务预算', 'admin'], tech: ['技术运维', 'other'], media: ['媒体设计', 'other'], worship: ['敬拜聚会', 'admin'], hr: ['人事招募', 'admin'], other: ['其他', 'other'] };
  /* 项目模板库：常见项目一键带出任务（相对开始日期的天数）和里程碑；团队也可以把做过的项目存成模板 */
  var TEMPLATES = [
    { id: 'tp_event', name: '活动筹办', ptype: 'event', days: 21, desc: '聚会、年会、感恩晚会等活动：定方案、报名、物资、现场、复盘。', goal: '活动按时举办，参与人数达到预期，费用不超预算',
      tasks: [['确定时间、地点和预算', 3, '活动方案（时间、地点、人数、预算）', '老板或负责人确认方案'], ['发布报名通知', 5, '报名链接和通知截图', '通知已发到所有群'], ['采购活动物资', 12, '物资清单和发票', '物资到齐、金额不超预算'], ['布置场地并彩排', 19, '现场照片', '流程走通、设备正常'], ['活动复盘和报销', 23, '复盘记录和报销单', '复盘写清做得好和要改进的']],
      milestones: [['方案确定', 3], ['报名截止', 14], ['活动当天', 21]] },
    { id: 'tp_course', name: '培训课程开设', ptype: 'training', days: 30, desc: '开一门课或一期培训班：大纲、讲员、课件、招生、开课、反馈。', goal: '课程按期开课，学员完成率和满意度达到预期',
      tasks: [['确定课程大纲和讲员', 5, '课程大纲', '负责人确认大纲'], ['发布招生和报名', 10, '招生海报和报名表', '报名人数达到开班要求'], ['准备讲义和课件', 14, '讲义和课件文件', '讲员确认可用'], ['准备场地设备和签到', 25, '场地照片和签到表', '设备测试正常'], ['课后反馈问卷和总结', 33, '问卷结果和总结', '总结写清下期改进点']],
      milestones: [['大纲定稿', 5], ['开课', 28]] },
    { id: 'tp_purchase', name: '物资采购', ptype: 'admin', days: 10, desc: '设备、办公用品、活动物资等采购：需求、比价、审批、下单、验收。', goal: '按需求买到合适的物资，价格合理、手续齐全',
      tasks: [['整理需求清单和预算', 2, '需求清单（品名、数量、预算）', '使用部门确认清单'], ['三家比价并提交审批', 4, '比价表', '审批人同意'], ['下单并跟进到货', 8, '订单截图和物流单号', '按时到货'], ['验收入库和报销', 10, '验收照片和发票', '数量质量无误、发票齐全']],
      milestones: [['审批通过', 4], ['到货', 8]] },
    { id: 'tp_publish', name: '对外发布', ptype: 'content', days: 14, desc: '文章、视频、网站内容等对外发布：初稿、审核、设计、上线、回顾。', goal: '内容按时发布，信息准确，达到预期的阅读或观看',
      tasks: [['写稿或制作初稿', 5, '初稿文件或链接', '内容完整、信息准确'], ['内部审核和修改', 8, '审核意见和修改稿', '负责人审核通过'], ['设计配图和排版', 10, '配图和排版稿', '风格统一、无错字'], ['定稿上线并转发', 12, '发布链接', '已上线、已转发到各渠道'], ['一周后数据回顾', 19, '阅读 / 观看数据截图', '写出下次改进的一两点']],
      milestones: [['初稿完成', 5], ['正式发布', 12]] },
    { id: 'tp_onboard', name: '新同工入职', ptype: 'hr', days: 30, desc: '新同事入职：账号设备、带领人、第一周跟岗、30 天回顾。', goal: '新同事一个月内熟悉工作、能独立负责任务',
      tasks: [['准备账号、设备和工位', 1, '账号和设备清单', '新同事当天能开始工作'], ['安排带领人并介绍团队', 2, '带领人和介绍安排', '新同事认识团队、知道找谁'], ['第一周学习和跟岗', 7, '学习记录', '完成必学内容'], ['30 天回顾面谈', 30, '面谈记录', '明确下一步目标']],
      milestones: [['入职', 0], ['30 天回顾', 30]] },
    { id: 'tp_care', name: '探访关怀', ptype: 'care', days: 7, desc: '探访、关怀一批人：名单、分组、探访、记录、跟进需要。', goal: '名单上的人都探访到，需要帮助的事有人跟进',
      tasks: [['整理探访名单和需要', 1, '探访名单', '名单完整、需要写清楚'], ['分组安排探访人员', 2, '分组表', '每个人都有探访人'], ['完成探访并记录', 6, '探访记录', '每次探访都有记录'], ['跟进需要帮助的事', 7, '跟进清单', '每件事都有人负责']],
      milestones: [['探访完成', 6]] },
    { id: 'tp_feature', name: '产品功能开发', ptype: 'product', days: 28, desc: 'App 或网站的一个新功能：需求、原型、设计、开发、测试、上线。', goal: '功能按时上线，测试通过，用户能正常使用',
      tasks: [['需求澄清和原型', 5, '需求说明和可点原型', '负责人评审通过'], ['界面设计', 10, '设计稿', '风格统一、标注完整'], ['功能开发', 20, '可演示的版本', '按需求完成、自测通过'], ['测试和修复', 24, '测试记录', '没有严重问题'], ['上线并收集反馈', 28, '上线说明和反馈汇总', '已上线、收到首批反馈']],
      milestones: [['原型评审', 5], ['开发完成', 20], ['上线', 28]] }
  ];
  function allTemplates(s) { return TEMPLATES.concat((s.templates || []).map(function (t) { return Object.assign({ custom: true }, t); })); }
  A['template.save'] = function (s, uid, p) {
    var w = work(s, p.id); need(hasRole(s, uid, 'owner') || w.leadId === uid || w.operatorId === uid, '只有老板、项目负责人或跟进人可以存为模板');
    var nm0 = txt(p.name) || w.title; need(nm0.length <= 20, '模板名称不超过 20 字');
    s.templates = s.templates || []; need(s.templates.length < 30, '模板最多 30 个，先删掉不用的');
    need(!allTemplates(s).some(function (t) { return t.name === nm0; }), '已经有同名模板');
    var t0 = w.createdAt, dayOf = function (ts) { return Math.max(0, Math.round((ts - t0) / DAY)); }, dueDay = function (d) { return d ? Math.max(0, Math.round((new Date(d + 'T12:00:00').getTime() - t0) / DAY)) : 7; };
    var ts = s.tasks.filter(function (t) { return t.workId === w.id && t.status !== 'cancelled'; }).slice(0, 20);
    var tp = { id: nid(s, 'tp_'), name: nm0, ptype: w.ptype && Object.keys(PTYPE).find(function (k) { return PTYPE[k][0] === w.ptype; }) || (w.kind === 'product' ? 'product' : 'admin'), days: w.due ? dueDay(w.due) : 14, desc: (w.goal || '').slice(0, 200), goal: (w.goal || '').slice(0, 200),
      tasks: ts.map(function (t) { return [t.title, dueDay(t.due), t.expected || '', t.criteria || '']; }), milestones: (w.milestones || []).slice(0, 12).map(function (m) { return [m.title, dueDay(m.date)]; }), by: uid, at: now(s) };
    s.templates.push(tp); ev(s, { workId: w.id, actor: uid, action: 'template.save', text: '存为模板「' + nm0 + '」' }); return { id: tp.id };
  };
  A['template.delete'] = function (s, uid, p) {
    s.templates = s.templates || []; var t = get(s.templates, p.id, '模板'); need(hasRole(s, uid, 'owner') || t.by === uid, '只有老板或创建人可以删除模板');
    s.templates = s.templates.filter(function (x) { return x.id !== t.id; }); return {};
  };
  A['project.create'] = function (s, uid, p) {
    var owner = hasRole(s, uid, 'owner'), op = hasRole(s, uid, 'operator'), lead = canInitiate(s, uid) && hasRole(s, uid, 'lead');
    need(owner || op || lead, '只有老板、运营者或有发起权的负责人可以新建项目');
    if (!canCreateProject(s, uid)) deny('当前设置要求每条想法派发前由老板确认，请改用「记录想法」提交');
    var title = txt(p.title); need(title, '请填写项目名称'); need(title.length <= 50, '项目名称不超过 50 字');
    var pt = Object.prototype.hasOwnProperty.call(PTYPE, p.ptype) ? PTYPE[p.ptype] : null; need(pt, '请选择项目类型');
    var kind = pt[1];
    var opId = p.operatorId || (op ? uid : followUsers(s)[0]); need(opId && live(s, opId) && canFollow(s, opId), '请选择在职的跟进运营者');
    var leadId = p.leadId || null;
    if (lead && !owner && !op) leadId = uid;
    // 还没有负责人的小团队：老板可以自己担任产品项目负责人
    if (kind === 'product') need(leadId && leadUsers(s).indexOf(leadId) >= 0, '产品开发项目请指定项目负责人');
    if (leadId) need(leadUsers(s).indexOf(leadId) >= 0, '项目负责人必须是负责人角色');
    var reviewerId = p.reviewerId || leadId || opId; need(live(s, reviewerId), '请选择在职的验收人');
    var tasks = (p.tasks || []).filter(function (t) { return txt(t.title); });
    var mss = (Array.isArray(p.milestones) ? p.milestones : []).filter(function (m) { return m && txt(m.title) && /^\d{4}-\d{2}-\d{2}$/.test(m.date || ''); }).slice(0, 12);
    var leadDept = leadId && (user(s, leadId).roles.find(function (a) { return a.role === 'lead'; }) || {}).dept;
    var d = { id: nid(s, 'I'), creatorId: uid, dept: leadDept || null, path: 'direct', status: 'planned', aiStatus: p.source === 'ai' ? 'ready' : 'none', title: title, note: txt(p.note),
      followerId: opId, shareAll: false, shares: [], deadline: null, directionConfirmedAt: null, ownerApproved: owner, reviewed: true,
      media: cleanMedia(p.media), submittedAt: now(s), lastActivity: now(s), createdAt: now(s) };
    s.ideas.push(d);
    addSummary(s, d, 'analysis', { simulated: p.source === 'ai', title: title, summary: txt(p.note).slice(0, 80), background: txt(p.note), category: kind, ptype: pt[0], options: [], open_questions: [], exception_flags: [], suggested_route: kind === 'product' ? 'to_lead' : 'operator_direct', suggested_tasks: [] }, 'human', uid);
    var w = { id: nid(s, 'W'), ideaId: d.id, dept: leadDept || null, kind: kind, ptype: pt[0], title: title, goal: txt(p.goal), status: 'planning', stage: 'clarify',
      operatorId: opId, leadId: leadId, reviewerId: reviewerId, externalLink: '', due: p.due || null, priority: ['hi', 'mid', 'lo'].indexOf(p.priority) >= 0 ? p.priority : 'mid', lastActivity: now(s), createdAt: now(s) };
    if (mss.length) w.milestones = mss.map(function (m) { return { id: nid(s, 'MS'), title: txt(m.title).slice(0, 30), date: m.date, done: false, doneAt: null }; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    s.workItems.push(w);
    ev(s, { ideaId: d.id, actor: uid, action: 'project.create', to: 'planned', text: '新建项目（' + (p.source === 'ai' ? 'AI 解析后人工确认' : '手动填写') + '）：' + title });
    ev(s, { ideaId: d.id, workId: w.id, actor: uid, action: 'idea.route', from: 'triage', to: 'planned', text: '形成项目「' + title + '」（' + pt[0] + '）' + (leadId ? '，负责人 ' + name(s, leadId) : '') + '，跟进 ' + name(s, opId) });
    if (tasks.length) {
      addTasks(s, uid, w, tasks.map(function (t) { return { title: t.title, ownerId: t.ownerId, expected: t.expected, criteria: t.criteria, due: t.due || p.due, reviewerId: reviewerId }; }));
      w.status = 'active'; if (kind === 'admin') w.stage = 'handle';
    }
    notify(s, [leadId, opId].concat(usersWith(s, 'owner')), uid, '新项目：' + title, w.status === 'planning' ? '待安排任务' : '已派出 ' + tasks.length + ' 个任务', '#/work/' + w.id);
    return { workId: w.id, ideaId: d.id };
  };
  /* 个人待办：只属于本人，不进入业务审计；可标注相关人 */
  function ensureTodos(s) { if (!s.todos) s.todos = []; if (!s.todoRecent) s.todoRecent = []; }
  var TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  /* 重复待办：完成后自动生成下一次（每天 / 工作日 / 每周 / 每月） */
  var REPEATS = { daily: '每天', weekdays: '工作日', weekly: '每周', monthly: '每月' };
  function nextDate(ds, rule) {
    var p = ds.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])), day = +p[2];
    if (rule === 'daily') d.setUTCDate(d.getUTCDate() + 1);
    else if (rule === 'weekdays') { do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6); }
    else if (rule === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
    else if (rule === 'monthly') { d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1); var last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); }
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  A['todo.create'] = function (s, uid, p) {
    ensureTodos(s); need(user(s, uid), '请先选择账号');
    var t = txt(p.title); need(t, '请填写待办内容'); need(t.length <= 50, '待办内容不超过 50 字');
    need(/^\d{4}-\d{2}-\d{2}$/.test(p.date || ''), '请选择日期');
    if (p.time) need(TIME_RE.test(p.time), '时间格式应为 HH:MM');
    need(['hi', 'mid', 'lo'].indexOf(p.priority || 'mid') >= 0, '优先级不正确');
    need(['mine', 'team', 'other'].indexOf(p.scope || 'mine') >= 0, '归类不正确');
    if (p.repeat) need(Object.prototype.hasOwnProperty.call(REPEATS, p.repeat), '重复方式不正确');
    var people = (Array.isArray(p.people) ? p.people : []).filter(function (x) { return x !== uid && live(s, x); });
    var td = { id: nid(s, 'TD'), ownerId: uid, title: t, note: txt(p.note), date: p.date, time: p.time || '', priority: p.priority || 'mid', scope: people.length ? 'team' : (p.scope || 'mine'),
      tags: (p.tags || []).map(txt).filter(Boolean).slice(0, 4), people: people, done: false, doneAt: null, comments: [], source: p.source || 'manual', repeat: p.repeat || '', at: now(s) };
    s.todos.push(td);
    if (p.tpl) { s.todoRecent = s.todoRecent.filter(function (r) { return !(r.userId === uid && r.title === p.tpl.title); }); s.todoRecent.unshift({ userId: uid, tpl: p.tpl.key, title: p.tpl.title, at: now(s) }); s.todoRecent = s.todoRecent.slice(0, 12); }
    notify(s, people, uid, name(s, uid) + ' 把你加进了待办', t, '#/tasks');
    return { id: td.id };
  };
  function myTodo(s, uid, id) { ensureTodos(s); var td = get(s.todos, id, '待办'); need(td.ownerId === uid, '只能操作自己的待办'); return td; }
  A['todo.toggle'] = function (s, uid, p) {
    var td = myTodo(s, uid, p.id); td.done = !td.done; td.doneAt = td.done ? now(s) : null;
    // 重复待办第一次完成时生成下一次（取消勾选再勾上不会重复生成）
    if (td.done && td.repeat && !(td.nextId && s.todos.some(function (x) { return x.id === td.nextId; }))) {
      // 下一次不早于今天（很久以前的每日待办今天才完成，不会一口气补出一串过去的）
      var nd = nextDate(td.date, td.repeat), t0 = todayStr(s); while (nd < t0) nd = nextDate(nd, td.repeat);
      var nx = { id: nid(s, 'TD'), ownerId: td.ownerId, title: td.title, note: td.note, date: nd, time: td.time, priority: td.priority, scope: td.scope, tags: (td.tags || []).slice(), people: (td.people || []).slice(), done: false, doneAt: null, comments: [], source: 'repeat', repeat: td.repeat, at: now(s) };
      s.todos.push(nx); td.nextId = nx.id; return { next: nx.id, nextDate: nx.date }; }
    return {};
  };
  A['todo.update'] = function (s, uid, p) {
    var td = myTodo(s, uid, p.id);
    if ('title' in p) { var t = txt(p.title); need(t && t.length <= 50, '待办内容 1 到 50 字'); td.title = t; }
    if ('date' in p) { need(/^\d{4}-\d{2}-\d{2}$/.test(p.date), '日期不正确'); td.date = p.date; }
    if ('time' in p) { need(!p.time || TIME_RE.test(p.time), '时间格式应为 HH:MM'); td.time = p.time; }
    if ('priority' in p) { need(['hi', 'mid', 'lo'].indexOf(p.priority) >= 0, '优先级不正确'); td.priority = p.priority; }
    if ('note' in p) td.note = txt(p.note).slice(0, 2000);
    if ('repeat' in p) { need(!p.repeat || Object.prototype.hasOwnProperty.call(REPEATS, p.repeat), '重复方式不正确'); td.repeat = p.repeat || ''; }
    return {};
  };
  A['todo.delete'] = function (s, uid, p) { var td = myTodo(s, uid, p.id); s.todos.splice(s.todos.indexOf(td), 1); return {}; };
  A['todo.comment'] = function (s, uid, p) {
    ensureTodos(s); var td = get(s.todos, p.id, '待办'); need(td.ownerId === uid || td.people.indexOf(uid) >= 0, '无权评论'); var b = txt(p.body); need(b, '内容不能为空');
    need(b.length <= 2000, '评论不超过 2000 字'); td.comments.push({ by: uid, body: b, at: now(s) });
    var at = mentioned(s, b).filter(function (x) { return x === td.ownerId || td.people.indexOf(x) >= 0; });
    if (at.length) notify(s, at, uid, name(s, uid) + ' 提到了你', b.slice(0, 60), '#/tasks');
    notify(s, [td.ownerId].concat(td.people).filter(function (x) { return at.indexOf(x) < 0; }), uid, name(s, uid) + ' 评论了待办', td.title, '#/tasks'); return {};
  };
  A['todo.clearRecent'] = function (s, uid) { ensureTodos(s); s.todoRecent = s.todoRecent.filter(function (r) { return r.userId !== uid; }); return {}; };
  function seedTodos(s, T0) {
    ensureTodos(s); var d0 = dateAddS(T0, 0), d1 = dateAddS(T0, 1);
    var mk = function (id, uid, title, date, time, pr, scope, tags, people, extra) { s.todos.push(Object.assign({ id: id, ownerId: uid, title: title, note: '', date: date, time: time, priority: pr, scope: scope, tags: tags, people: people || [], done: false, doneAt: null, comments: [], source: 'manual', at: T0 - 86400000 }, extra || {})); };
    mk('TD1', 'u_owner', '回复合作方邮件', d0, '18:00', 'mid', 'mine', ['沟通'], [], { comments: [{ by: 'u_op', body: '合作方希望周五前回复报价。', at: T0 - 7200000 }] });
    mk('TD2', 'u_owner', '整理 Q3 财务数据', d0, '20:00', 'mid', 'mine', ['数据']);
    mk('TD3', 'u_owner', '晚间祷告与灵修', d0, '21:00', 'lo', 'mine', ['个人成长']);
    mk('TD4', 'u_owner', '准备周会资料', d1, '09:00', 'mid', 'team', ['会议'], ['u_op', 'u_lead']);
    mk('TD5', 'u_owner', '检查服务器更新', d1, '10:00', 'lo', 'other', ['运维']);
    mk('TD6', 'u_owner', '确认本周讲道题目', d0, '09:30', 'mid', 'mine', ['事工'], [], { done: true, doneAt: T0 - 3600000 });
    mk('TD7', 'u_op', '整理本周想法队列', d0, '17:00', 'mid', 'mine', ['运营']);
    s.todoRecent = [{ userId: 'u_owner', tpl: 'meeting', title: '项目周会纪要', at: T0 - 2 * 86400000 }, { userId: 'u_owner', tpl: 'content', title: '视频内容策划', at: T0 - 4 * 86400000 }, { userId: 'u_owner', tpl: 'event', title: '团队建设活动', at: T0 - 7 * 86400000 }];
  }
  /* 项目概览：优先级 / 目标 / 关键成果 / 里程碑 */
  function canManageWork(s, uid, w) { return w.leadId === uid || w.operatorId === uid || hasRole(s, uid, 'owner'); }
  /* 项目文件：项目成员可上传；上传人、负责人、跟进运营者、老板可删除 */
  A['work.attach'] = function (s, uid, p) {
    var w = work(s, p.id); need(canViewWork(s, uid, w), '只有项目成员可以上传文件'); need(['done', 'cancelled'].indexOf(w.status) < 0, '项目已结束，不能再上传');
    var m = cleanMedia(p.media).filter(function (x) { return txt(x.name); }); need(m.length, '请选择文件');
    w.files = w.files || []; need(w.files.length + m.length <= 50, '每个项目最多 50 个文件');
    m.forEach(function (x) { if (x.kind === 'link') need(/^https?:\/\/\S+\.\S+/.test(txt(x.url)), '请填写以 http:// 或 https:// 开头的链接'); });
    m.forEach(function (x) { w.files.push({ id: nid(s, 'P'), kind: x.kind || 'file', name: txt(x.name).slice(0, 80), url: x.kind === 'link' ? txt(x.url) : undefined, size: x.size || '', at: now(s), by: uid, localId: x.localId }); });
    ev(s, { workId: w.id, actor: uid, action: 'work.attach', text: m.length === 1 ? '上传了「' + txt(m[0].name).slice(0, 30) + '」' : '上传了 ' + m.length + ' 个文件' }); w.lastActivity = now(s); return {};
  };
  A['work.detach'] = function (s, uid, p) {
    var w = work(s, p.id); w.files = w.files || []; var i = w.files.findIndex(function (f) { return f.id === p.fid; }); need(i >= 0, '文件不存在');
    var f = w.files[i]; need(f.by === uid || canManageWork(s, uid, w), '只有上传人、项目负责人、跟进运营者或老板可以删除');
    w.files.splice(i, 1); ev(s, { workId: w.id, actor: uid, action: 'work.detach', text: '删除了「' + f.name + '」' }); w.lastActivity = now(s); return {};
  };
  A['work.update'] = function (s, uid, p) {
    var w = work(s, p.id); need(['done', 'cancelled'].indexOf(w.status) < 0, '项目已结束，不能修改'); need(canManageWork(s, uid, w), '只有项目负责人、跟进运营者或老板可以修改项目信息');
    var ch = [];
    if ('priority' in p) { need(['hi', 'mid', 'lo'].indexOf(p.priority) >= 0, '优先级不正确'); w.priority = p.priority; ch.push('优先级'); }
    if ('goal' in p) { w.goal = txt(p.goal).slice(0, 200); ch.push('目标'); }
    if ('keyResults' in p) { w.keyResults = txt(p.keyResults).slice(0, 200); ch.push('关键成果'); }
    if ('tags' in p) { var tg = (p.tags || []).map(function (x) { return txt(x).replace(/^#/, ''); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }); need(tg.length <= 5, '标签最多 5 个'); need(tg.every(function (x) { return x.length <= 8; }), '每个标签不超过 8 个字'); w.tags = tg; ch.push('标签'); }
    if ('due' in p) { need(!p.due || /^\d{4}-\d{2}-\d{2}$/.test(p.due), '日期不正确'); w.due = p.due || null; ch.push('截止时间'); }
    if ('externalLink' in p) { var xl = txt(p.externalLink); need(!xl || (/^https?:\/\/\S+\.\S+$/.test(xl) && xl.length <= 500), '研发工具链接请填完整的 http(s) 地址'); if (xl !== (w.externalLink || '')) { w.externalLink = xl; ch.push('研发工具链接'); } } // 文档 2.1：专业阶段可链接现有研发工具
    need(ch.length, '没有要修改的内容');
    ev(s, { workId: w.id, ideaId: w.ideaId, actor: uid, action: 'work.update', text: '修改项目' + ch.join('、') }); touchWork(s, w); return {};
  };
  /* 换项目里的人：老板可换负责人 / 跟进运营 / 验收人；负责人可换验收人。写动态、通知新旧双方 */
  A['work.reassign'] = function (s, uid, p) {
    var w = work(s, p.id), ow = hasRole(s, uid, 'owner'); need(['done', 'cancelled'].indexOf(w.status) < 0, '项目已结束');
    var ch = [], who = [];
    var set = function (field, label, id, ok, msg) { if (!(field in p) || !p[field] || p[field] === w[id]) return; need(ok(p[field]), msg); var old = w[id]; w[id] = p[field]; ch.push(label + '：' + name(s, old) + ' → ' + name(s, p[field])); who.push(old, p[field]); };
    if ('leadId' in p || 'operatorId' in p) need(ow, '只有老板可以更换项目负责人或跟进运营');
    if ('reviewerId' in p) need(ow || w.leadId === uid, '只有老板或项目负责人可以更换验收人');
    set('leadId', '项目负责人', 'leadId', function (v) { return leadUsers(s).indexOf(v) >= 0; }, '新负责人必须是在职的负责人角色');
    set('operatorId', '跟进运营', 'operatorId', function (v) { return live(s, v) && canFollow(s, v); }, '新跟进人必须是在职的运营者');
    set('reviewerId', '验收人', 'reviewerId', function (v) { return live(s, v); }, '验收人不存在或已停用');
    need(ch.length, '没有要更换的人');
    ev(s, { workId: w.id, ideaId: w.ideaId, actor: uid, action: 'work.reassign', text: '更换' + ch.join('；') });
    notify(s, who, uid, '项目人员有变动', w.title + '：' + ch.join('；'), '#/work/' + w.id); touchWork(s, w); return {};
  };
  /* 编辑任务：项目负责人、跟进运营或老板；改截止、验收人等写进动态并通知执行人（改验收人还通知新验收人） */
  A['task.update'] = function (s, uid, p) {
    var t = task(s, p.id), w = work(s, t.workId); need(canManageWork(s, uid, w), '只有项目负责人、跟进运营者或老板可以修改任务');
    need(['done', 'cancelled'].indexOf(t.status) < 0, '任务已结束，不能修改'); need(w.status !== 'paused', '项目已暂停，恢复后才能操作');
    var ch = [], extra = [];
    if ('title' in p) { var ti = txt(p.title); need(ti, '任务需要标题'); need(ti.length <= 50, '任务标题不超过 50 字'); if (ti !== t.title) { t.title = ti; ch.push('标题'); } }
    if ('description' in p) { var de = txt(p.description).slice(0, 2000); if (de !== t.description) { t.description = de; ch.push('说明'); } }
    if ('expected' in p) { var ex = txt(p.expected); need(ex, '请写预期成果'); if (ex !== t.expected) { t.expected = ex.slice(0, 500); ch.push('预期成果'); } }
    if ('criteria' in p) { var cr = txt(p.criteria); need(cr, '请写验收标准'); if (cr !== t.criteria) { t.criteria = cr.slice(0, 500); ch.push('验收标准'); } }
    if ('priority' in p) { need(['hi', 'mid', 'lo'].indexOf(p.priority) >= 0, '优先级不正确'); if (p.priority !== t.priority) { t.priority = p.priority; ch.push('优先级'); } }
    if ('due' in p) { need(!p.due || (typeof p.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.due)), '截止日期不正确'); var nd = p.due || null; if (nd !== t.due) { ch.push('截止：' + (t.due || '无') + ' → ' + (nd || '无')); t.due = nd; t.remindedOn = null; } }
    if ('reviewerId' in p && p.reviewerId && p.reviewerId !== t.reviewerId) { need(live(s, p.reviewerId), '验收人不存在或已停用'); need(p.reviewerId !== t.ownerId, '验收人不能是执行人自己'); ch.push('验收人：' + name(s, t.reviewerId) + ' → ' + name(s, p.reviewerId)); t.reviewerId = p.reviewerId; extra.push(p.reviewerId); }
    if ('collabs' in p) { var cs = (Array.isArray(p.collabs) ? p.collabs : []).filter(function (c, i, a) { return c !== t.ownerId && live(s, c) && a.indexOf(c) === i; }).slice(0, 10);
      if (cs.join() !== t.collabs.join()) { extra = extra.concat(cs.filter(function (c) { return t.collabs.indexOf(c) < 0; })); t.collabs = cs; ch.push('协作者'); } }
    need(ch.length, '没有要修改的内容');
    ev(s, { taskId: t.id, workId: w.id, actor: uid, action: 'task.update', text: '修改任务' + ch.join('、') });
    notify(s, [t.ownerId].concat(extra), uid, '任务有修改', t.title + '：' + ch.join('、'), '#/task/' + t.id); touchTask(s, t); return {};
  };
  A['work.milestone.add'] = function (s, uid, p) {
    var w = work(s, p.id); need(['done', 'cancelled'].indexOf(w.status) < 0, '项目已结束，不能修改'); need(canManageWork(s, uid, w), '只有项目负责人、跟进运营者或老板可以添加里程碑');
    var t = txt(p.title); need(t, '请填写里程碑名称'); need(t.length <= 30, '里程碑名称不超过 30 字'); need(/^\d{4}-\d{2}-\d{2}$/.test(p.date || ''), '请选择日期');
    w.milestones = w.milestones || []; var m = { id: nid(s, 'MS'), title: t, date: p.date, done: false, doneAt: null };
    w.milestones.push(m); w.milestones.sort(function (a, b) { return a.date.localeCompare(b.date); });
    ev(s, { workId: w.id, actor: uid, action: 'work.milestone.add', text: '添加里程碑「' + t + '」（' + p.date + '）' }); touchWork(s, w); return { id: m.id };
  };
  A['work.milestone.toggle'] = function (s, uid, p) {
    var w = work(s, p.id); need(['done', 'cancelled'].indexOf(w.status) < 0, '项目已结束，不能修改'); need(canManageWork(s, uid, w), '只有项目负责人、跟进运营者或老板可以更新里程碑');
    var m = get(w.milestones || [], p.mid, '里程碑'); m.done = !m.done; m.doneAt = m.done ? now(s) : null;
    ev(s, { workId: w.id, actor: uid, action: 'work.milestone.' + (m.done ? 'done' : 'reopen'), text: (m.done ? '完成里程碑「' : '重新打开里程碑「') + m.title + '」' });
    notify(s, relatedOfWork(s, w), uid, (m.done ? '里程碑完成：' : '里程碑重新打开：') + m.title, w.title, '#/work/' + w.id); touchWork(s, w); return {};
  };
  /* 团队成员 */
  var GROUPS = ['管理层', '行政运营', '产品研发', '设计创意'];
  var ROLE_TITLE = { executor: '执行者', lead: '负责人', operator: '运营者', admin: '管理员' };
  function roleDept(role, group) { return role === 'admin' ? null : group === '行政运营' ? (role === 'operator' ? 'd_ops' : 'd_admin') : group === '管理层' ? null : 'd_prod'; }
  /* 换角色（老板）：执行者 / 负责人 / 运营者 / 管理员之间调整；老板自己的角色不能改。手上的项目角色保留，提示老板需要时去「更换人员」 */
  A['member.role'] = function (s, uid, p) {
    need(hasRole(s, uid, 'owner'), '只有老板可以调整角色'); var u = user(s, p.id); need(u, '找不到该成员'); need(!hasRole(s, u.id, 'owner'), '老板的角色不能修改');
    need(['executor', 'lead', 'operator', 'admin'].indexOf(p.role) >= 0, '请选择角色');
    var old = u.roles.map(function (a) { return L.role[a.role]; }).join('、'), ci = p.role === 'lead' && p.canInitiate !== false;
    if (u.roles.length === 1 && u.roles[0].role === p.role && !!u.roles[0].canInitiate === ci) deny('角色没有变化');
    u.roles = [{ role: p.role, dept: roleDept(p.role, u.group), canInitiate: ci }];
    var ow = openWorkOf(s, u.id), keep = ow.works.filter(function (w) { return (w.leadId === u.id && p.role !== 'lead') || (w.operatorId === u.id && p.role !== 'operator'); }).length + (p.role === 'admin' ? ow.tasks.length + ow.reviews.length + ow.ideas.length : 0);
    ev(s, { actor: uid, action: 'member.role', text: u.name + ' 的角色：' + old + ' → ' + L.role[p.role] });
    notify(s, [u.id], uid, '你的角色调整为「' + L.role[p.role] + '」', '打开 App 看看新的功能入口', '#/home');
    return { keep: keep };
  };
  A['member.add'] = function (s, uid, p) {
    need(hasRole(s, uid, 'owner') || hasRole(s, uid, 'admin'), '只有老板或管理员可以添加成员');
    var nm2 = txt(p.name); need(nm2, '请填写姓名'); need(nm2.length <= 20, '姓名不超过 20 字');
    need(!s.users.some(function (u) { return u.name === nm2; }), '已有同名成员');
    need(['executor', 'lead', 'operator', 'admin'].indexOf(p.role) >= 0, '请选择角色');
    need(p.role !== 'admin' || hasRole(s, uid, 'owner'), '只有老板可以添加管理员');
    need(GROUPS.indexOf(p.group) >= 0, '请选择分组');
    var dept = roleDept(p.role, p.group);
    var u = { id: nid(s, 'u_'), name: nm2, title: txt(p.title) || ROLE_TITLE[p.role], tier: '', roles: [{ role: p.role, dept: dept, canInitiate: p.role === 'lead' }],
      motto: '', skills: (p.skills || []).map(txt).filter(Boolean).slice(0, 3), presence: 'offline', group: p.group, contact: txt(p.contact), invited: true, joinedAt: now(s) };
    s.users.push(u);
    ev(s, { actor: uid, action: 'member.add', text: '添加成员 ' + nm2 + '（' + u.title + '）' });
    notify(s, usersWith(s, 'owner').concat(usersWith(s, 'admin')).filter(function (x) { return x !== u.id; }), uid, '新成员加入：' + nm2, u.title, '#/team');
    return { id: u.id };
  };
  A['member.update'] = function (s, uid, p) {
    var u = user(s, p.id); need(u, '找不到该成员');
    need(p.id === uid || hasRole(s, uid, 'owner') || hasRole(s, uid, 'admin'), '只能修改自己的资料');
    need(p.id === uid || !hasRole(s, p.id, 'owner') || hasRole(s, uid, 'owner'), '老板的资料只能由老板自己修改');
    if ('motto' in p) { need(txt(p.motto).length <= 30, '一句话不超过 30 字'); u.motto = txt(p.motto); }
    if ('skills' in p) u.skills = (p.skills || []).map(txt).filter(Boolean).slice(0, 3);
    if ('presence' in p) { need(['online', 'away', 'busy', 'offline'].indexOf(p.presence) >= 0, '状态不正确'); u.presence = p.presence; }
    var adm = hasRole(s, uid, 'owner') || hasRole(s, uid, 'admin');
    if ('name' in p) { need(adm, '姓名由老板或管理员修改'); var n2 = txt(p.name); need(n2 && n2.length <= 20, '姓名 1 到 20 字'); need(!s.users.some(function (x) { return x.id !== u.id && x.name === n2; }), '已有同名成员'); u.name = n2; }
    if ('title' in p) { var t2 = txt(p.title); need(t2 && t2.length <= 16, '职位 1 到 16 字'); u.title = t2; }
    if ('email' in p) { var m2 = txt(p.email); need(!m2 || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m2), '邮箱格式不正确'); u.email = m2; }
    if ('phone' in p) { var ph = txt(p.phone); need(!ph || /^[+\d][\d\s-]{5,19}$/.test(ph), '手机号格式不正确'); u.phone = ph; }
    if ('location' in p) u.location = txt(p.location).slice(0, 20);
    if ('bio' in p) u.bio = txt(p.bio).slice(0, 30);
    if ('avatar' in p) { var av = txt(p.avatar); need(!av || /^[A-Za-z0-9_-]{4,64}$/.test(av), '头像格式不对'); need(p.id === uid, '头像只能自己换'); u.avatar = av || null; }
    if ('prefs' in p) {
      // 偏好只收白名单里的布尔开关（防止往全局状态里塞任意数据）
      need(p.prefs && typeof p.prefs === 'object' && !Array.isArray(p.prefs), '偏好设置格式不对');
      var PREFS = ['notifyImportant', 'quietOn'], np = Object.assign({}, u.prefs || {}), pp = p.prefs;
      need(p.id === uid, '通知设置只能自己改');
      Object.keys(pp).forEach(function (k) { if (PREFS.indexOf(k) < 0) return; need(typeof pp[k] === 'boolean', '偏好设置格式不对'); np[k] = pp[k]; });
      if ('mute' in pp) { need(Array.isArray(pp.mute) && pp.mute.every(function (x) { return Object.prototype.hasOwnProperty.call(NCATS, x); }), '通知类别不正确'); np.mute = pp.mute.filter(function (x, i, a) { return a.indexOf(x) === i; }); }
      ['quietFrom', 'quietTo'].forEach(function (k) { if (k in pp) { need(/^([01]\d|2[0-3]):[0-5]\d$/.test(pp[k]), '时间格式不对'); np[k] = pp[k]; } });
      u.prefs = np;
    }
    return {};
  };
  A['idea.delete'] = function (s, uid, p) {
    var d = get(s.ideas, p.id, '想法'); need(!d.deleted, '这个想法已删除');
    var ow = hasRole(s, uid, 'owner');
    need(ow || (d.creatorId === uid && d.status === 'draft'), '只有老板可以删除想法（发起人可以删除自己的草稿）');
    need(canViewIdea(s, uid, d), '找不到该想法'); // 老板也看不到别人的私人草稿，更不能删
    var live = s.workItems.filter(function (w) { return w.ideaId === d.id && ['done', 'cancelled'].indexOf(w.status) < 0; });
    need(!live.length, '这个想法已形成进行中的项目「' + (live[0] && live[0].title) + '」，请先在项目里取消，再删除想法');
    d.deleted = true; d.deletedAt = now(s); d.deletedBy = uid; d.deleteReason = txt(p.reason);
    s.decisions.forEach(function (dc) { if (dc.ideaId === d.id && dc.status === 'pending') { dc.status = 'withdrawn'; dc.decidedAt = now(s); dc.note = '想法已删除'; } });
    ev(s, { ideaId: d.id, actor: uid, action: 'idea.delete', text: '删除了想法「' + (d.title || '未命名') + '」' + (d.deleteReason ? '：' + d.deleteReason : '') });
    notify(s, [d.creatorId, d.followerId].filter(Boolean), uid, '想法已被删除', (d.title || '未命名') + (d.deleteReason ? '：' + d.deleteReason : ''), '#/ideas');
    return {};
  };
  function ideaLocked(d) { return ['planned', 'declined'].indexOf(d.status) >= 0 || !!d.deleted; }
  A['idea.attach'] = function (s, uid, p) {
    var d = idea(s, p.id); need(canViewIdea(s, uid, d), '找不到该想法'); need(d.creatorId === uid || d.followerId === uid || hasRole(s, uid, 'owner'), '只有发起人、跟进人或老板可以添加附件');
    need(!ideaLocked(d), '这个想法已形成项目，附件已锁定。新资料请加到项目或任务里');
    var m = cleanMedia(p.media).filter(function (x) { return txt(x.name); }); need(m.length, '请选择文件');
    need(d.media.length + m.length <= 30, '每个想法最多 30 个附件');
    m.forEach(function (x) { if (x.kind === 'link') need(/^https?:\/\/\S+\.\S+/.test(txt(x.url)), '请填写以 http:// 或 https:// 开头的链接'); });
    m.forEach(function (x) { d.media.push({ id: nid(s, 'M'), kind: x.kind || 'file', name: txt(x.name).slice(0, 80), url: x.kind === 'link' ? txt(x.url) : undefined, size: x.size || '', at: now(s), by: uid, localId: x.localId }); });
    ev(s, { ideaId: d.id, actor: uid, action: 'idea.attach', text: '添加了 ' + m.length + ' 个附件' }); d.lastActivity = now(s); return {};
  };
  A['kb.add'] = function (s, uid, p) {
    kbInit(s); need(kbCan(s, uid), '只有老板和管理员可以给 AI 添加资料');
    var title = txt(p.title).slice(0, 40), body = String(p.body || '').trim(); need(title, '请填写资料标题'); need(body.length >= 10, '资料内容太少');
    need(body.length <= 200000, '单份资料不超过 20 万字'); need(s.knowledge.length < 30, '最多 30 份资料');
    var k = { id: nid(s, 'K'), title: title, body: body, scope: p.scope === 'ai_only' ? 'ai_only' : 'team', on: true, by: uid, at: now(s), size: body.length, source: p.source === 'voice' ? 'voice' : 'text' };
    s.knowledge.push(k); ev(s, { actor: uid, action: 'kb.add', text: '给 AI 添加资料「' + title + '」' }); return { id: k.id };
  };
  A['kb.update'] = function (s, uid, p) {
    kbInit(s); need(kbCan(s, uid), '只有老板和管理员可以修改 AI 资料'); var k = get(s.knowledge, p.id, '资料');
    if (p.title != null) { need(txt(p.title), '请填写资料标题'); k.title = txt(p.title).slice(0, 40); }
    if (p.body != null) { var b = String(p.body).trim(); need(b.length >= 10, '资料内容太少'); k.body = b; k.size = b.length; k.demo = false; }
    if (p.scope) k.scope = p.scope === 'ai_only' ? 'ai_only' : 'team';
    if (p.on != null) k.on = !!p.on;
    k.at = now(s); ev(s, { actor: uid, action: 'kb.update', text: '更新 AI 资料「' + k.title + '」' + (p.on != null ? (p.on ? '（启用）' : '（停用）') : '') }); return {};
  };
  A['kb.delete'] = function (s, uid, p) {
    kbInit(s); need(kbCan(s, uid), '只有老板和管理员可以删除 AI 资料'); var k = get(s.knowledge, p.id, '资料');
    s.knowledge = s.knowledge.filter(function (x) { return x.id !== k.id; }); ev(s, { actor: uid, action: 'kb.delete', text: '删除 AI 资料「' + k.title + '」' }); return {};
  };
  A['idea.digest'] = function (s, uid, p) {
    var d = idea(s, p.id); need(hasRole(s, uid, 'owner'), '只有老板可以让 AI 总结讨论');
    need(s.suggestions.some(function (x) { return x.ideaId === d.id; }), '还没有讨论，暂时不用总结');
    var sm = addSummary(s, d, 'digest', mockDigest(s, d), 'agent', uid);
    ev(s, { ideaId: d.id, actor: uid, action: 'ai.digest', text: '让 AI 总结讨论（第 ' + sm.version + ' 版）' }); return { id: sm.id };
  };
  A['idea.retitle'] = function (s, uid, p) {
    var d = idea(s, p.id); need(canViewIdea(s, uid, d), '找不到该想法'); need(d.creatorId === uid || d.followerId === uid || hasRole(s, uid, 'owner'), '只有发起人、跟进人或老板可以改标题');
    var old = d.title, nt = p.ai ? aiTitle(d) : txt(p.title); need(nt, '标题不能为空'); need(nt.length <= 30, '标题不超过 30 个字');
    d.title = nt; d.titleSource = p.ai ? 'ai' : 'user';
    ev(s, { ideaId: d.id, actor: uid, action: 'idea.retitle', text: (p.ai ? 'AI 重新拟题' : '修改标题') + '：「' + old + '」→「' + nt + '」' }); touchIdea(s, d); return {};
  };
  A['idea.mediaShow'] = function (s, uid, p) {
    var d = idea(s, p.id); need(canViewIdea(s, uid, d), '找不到该想法'); var m = d.media[+p.index];
    need(m && (!p.mid || m.id === p.mid), '附件不存在，可能已被删除');
    need(d.creatorId === uid || m.by === uid || hasRole(s, uid, 'owner'), '只有发起人、上传人或老板可以设置是否呈现');
    m.hidden = !p.show;
    ev(s, { ideaId: d.id, actor: uid, action: 'idea.mediaShow', text: (p.show ? '呈现' : '不呈现') + '附件「' + m.name + '」' }); d.lastActivity = now(s); return {};
  };
  A['idea.detach'] = function (s, uid, p) {
    var d = idea(s, p.id); need(canViewIdea(s, uid, d), '找不到该想法'); var i = +p.index, m = d.media[i];
    need(m && (!p.mid || m.id === p.mid), '附件不存在，可能已被删除');
    need(m.by === uid || d.creatorId === uid || hasRole(s, uid, 'owner'), '只有上传人、发起人或老板可以删除附件');
    need(!ideaLocked(d), '这个想法已形成项目，附件已锁定，不能删除');
    d.media.splice(i, 1); ev(s, { ideaId: d.id, actor: uid, action: 'idea.detach', text: '删除了附件「' + m.name + '」' }); d.lastActivity = now(s); return {};
  };
  A['work.plan'] = function (s, uid, p) {
    var w = work(s, p.id); need(w.leadId === uid || (w.kind !== 'product' && w.operatorId === uid) || hasRole(s, uid, 'owner'), w.kind === 'product' ? '产品项目由项目负责人安排执行人' : '只有项目负责人或跟进的运营者可以安排任务');
    need(['planning', 'active', 'acceptance', 'blocked'].indexOf(w.status) >= 0, '当前项目状态不能新增任务');
    need((p.tasks || []).length, '请至少添加一个任务');
    addTasks(s, uid, w, p.tasks);
    if (w.status === 'planning' || w.status === 'acceptance') { var f = w.status; w.status = 'active'; ev(s, { workId: w.id, actor: uid, action: 'work.status', from: f, to: 'active', text: '开始执行' }); }
    return {};
  };
  A['work.stage'] = function (s, uid, p) {
    var w = work(s, p.id); need(['done', 'cancelled'].indexOf(w.status) < 0, '项目已结束，不能修改'); need(w.status !== 'paused', '项目已暂停，恢复后才能操作'); need(w.leadId === uid || hasRole(s, uid, 'owner') || (w.kind !== 'product' && w.operatorId === uid), '只有项目负责人可以推进阶段');
    var st = STAGES[w.kind].map(function (x) { return x[0]; }); need(st.indexOf(p.stage) >= 0, '阶段不存在'); need(p.stage !== w.stage, '已经在该阶段');
    var from = w.stage; w.stage = p.stage; touchWork(s, w);
    ev(s, { workId: w.id, ideaId: w.ideaId, actor: uid, action: 'work.stage', from: stageName(w.kind, from), to: stageName(w.kind, p.stage), reason: txt(p.note), text: '阶段：' + stageName(w.kind, from) + ' 到 ' + stageName(w.kind, p.stage) });
    return {};
  };
  A['work.close'] = function (s, uid, p) {
    var w = work(s, p.id), proxy = w.reviewerId !== uid && hasRole(s, uid, 'owner');
    s.decisions.forEach(function (dc) { if (dc.workId === w.id && dc.status === 'pending' && w.status === 'acceptance') { dc.status = 'withdrawn'; dc.decidedAt = now(s); dc.note = '项目已完成'; } }); need(w.reviewerId === uid || proxy, '只有项目验收人或老板可以确认完成'); need(w.status === 'acceptance', '项目下任务全部完成后才能确认');
    w.status = 'done'; if (w.kind === 'admin') w.stage = 'done';
    s.reviews.push({ id: nid(s, 'R'), taskId: null, workId: w.id, reviewerId: uid, verdict: 'pass', note: txt(p.note), at: now(s) });
    ev(s, { workId: w.id, ideaId: w.ideaId, actor: uid, action: 'work.done', from: 'acceptance', to: 'done', text: (proxy ? '老板代验收：' : '') + '项目验收完成' + (txt(p.note) ? '：' + txt(p.note) : '') });
    var d = w.ideaId && s.ideas.find(function (x) { return x.id === w.ideaId; });
    notify(s, usersWith(s, 'owner').concat([w.operatorId, w.leadId, d && d.creatorId]), uid, '项目完成', w.title, '#/work/' + w.id);
    touchWork(s, w); return {};
  };
  A['work.pause'] = function (s, uid, p) {
    var w = work(s, p.id); need(hasRole(s, uid, 'owner'), '只有老板可以暂停（纠偏）'); var r = txt(p.reason); need(r, '纠偏必须填写原因');
    need(['planning', 'active', 'acceptance', 'blocked'].indexOf(w.status) >= 0, '当前状态不能暂停');
    var f = w.status; w.status = 'paused'; w.pausedFrom = f;
    ev(s, { workId: w.id, ideaId: w.ideaId, actor: uid, action: 'owner.override.pause', from: f, to: 'paused', reason: r, text: '老板暂停：' + r });
    notify(s, relatedOfWork(s, w), uid, '老板暂停了项目', w.title + '：' + r, '#/work/' + w.id); touchWork(s, w); return {};
  };
  A['work.resume'] = function (s, uid, p) {
    var w = work(s, p.id); need(hasRole(s, uid, 'owner'), '只有老板可以恢复'); need(w.status === 'paused', '项目未暂停');
    w.status = w.pausedFrom || 'active'; ev(s, { workId: w.id, actor: uid, action: 'work.resume', from: 'paused', to: w.status, text: '恢复项目' }); syncWork(s, w, uid); // 暂停期间任务状态可能变了：按任务重新算项目状态
    notify(s, relatedOfWork(s, w), uid, '项目已恢复', w.title, '#/work/' + w.id); touchWork(s, w); return {};
  };
  /* 取消项目：老板、项目负责人或跟进运营者，必须写原因；未结束的任务一并取消；来源想法没有别的进行中项目时回到「暂缓」（之后可恢复或删除） */
  A['work.cancel'] = function (s, uid, p) {
    var w = work(s, p.id); need(hasRole(s, uid, 'owner') || w.leadId === uid || w.operatorId === uid, '只有老板、项目负责人或跟进运营者可以取消项目');
    need(['done', 'cancelled'].indexOf(w.status) < 0, '项目已结束，不能取消'); var r = txt(p.reason); need(r, '取消项目必须填写原因');
    var who = relatedOfWork(s, w), f = w.status, n = 0;
    s.tasks.forEach(function (t) { if (t.workId === w.id && ['done', 'cancelled'].indexOf(t.status) < 0) { ev(s, { taskId: t.id, workId: w.id, actor: uid, action: 'task.cancel', from: t.status, to: 'cancelled', text: '项目取消，任务一并取消' }); t.status = 'cancelled'; t.lastActivity = now(s); n++; } });
    s.decisions.forEach(function (dc) { if (dc.workId === w.id && dc.status === 'pending') { dc.status = 'withdrawn'; dc.decidedAt = now(s); dc.note = '项目已取消'; } });
    w.status = 'cancelled'; w.cancelReason = r; w.cancelledAt = now(s); w.cancelledBy = uid;
    ev(s, { workId: w.id, ideaId: w.ideaId, actor: uid, action: 'work.cancel', from: f, to: 'cancelled', reason: r, text: '取消项目：' + r + (n ? '（一并取消 ' + n + ' 个未完成任务）' : '') });
    var d = w.ideaId && s.ideas.find(function (x) { return x.id === w.ideaId; });
    if (d && d.status === 'planned' && !s.workItems.some(function (x) { return x.ideaId === d.id && ['done', 'cancelled'].indexOf(x.status) < 0; })) {
      d.status = 'on_hold'; touchIdea(s, d); ev(s, { ideaId: d.id, actor: uid, action: 'idea.hold', from: 'planned', to: 'on_hold', text: '形成的项目已取消，想法转为暂缓' });
    }
    notify(s, who.concat(usersWith(s, 'owner'), [d && d.creatorId]), uid, '项目已取消', w.title + '：' + r, '#/work/' + w.id); touchWork(s, w); return { tasks: n };
  };
  function relatedOfWork(s, w) {
    var a = [w.operatorId, w.leadId, w.reviewerId];
    s.tasks.forEach(function (t) { if (t.workId === w.id) { a.push(t.ownerId); a = a.concat(t.collabs); } });
    return a;
  }
  function syncWork(s, w, uid) {
    var ts = s.tasks.filter(function (t) { return t.workId === w.id && t.status !== 'cancelled'; });
    if (!ts.length) return;
    var allDone = ts.every(function (t) { return t.status === 'done'; }), anyBlocked = ts.some(function (t) { return t.status === 'blocked'; });
    // 项目「受阻」（文档 6.2）：有任务受阻时项目标受阻，都解除后回到进行中
    if (anyBlocked && w.status === 'active') { w.status = 'blocked'; ev(s, { workId: w.id, actor: 'system', action: 'work.status', from: 'active', to: 'blocked', text: '有任务受阻，项目标为受阻' }); return; }
    if (!anyBlocked && w.status === 'blocked' && !allDone) { w.status = 'active'; ev(s, { workId: w.id, actor: 'system', action: 'work.status', from: 'blocked', to: 'active', text: '阻碍已解除，项目回到进行中' }); return; }
    if (allDone && (w.status === 'active' || w.status === 'blocked')) {
      var f = w.status; w.status = 'acceptance';
      ev(s, { workId: w.id, actor: 'system', action: 'work.status', from: f, to: 'acceptance', text: '任务全部完成，项目进入待验收' });
      notify(s, [w.reviewerId], uid, '项目待你验收', w.title, '#/work/' + w.id);
    } else if (!allDone && w.status === 'acceptance') {
      w.status = 'active'; ev(s, { workId: w.id, actor: 'system', action: 'work.status', from: 'acceptance', to: 'active', text: '有任务重新打开，项目回到进行中' });
    }
  }

  var TT = {
    accept: { from: ['assigned'], to: 'accepted', label: '接收' },
    start: { from: ['accepted'], to: 'in_progress', label: '开始' },
    submit: { from: ['in_progress'], to: 'submitted', label: '提交成果' },
    block: { from: ['assigned', 'accepted', 'in_progress'], to: 'blocked', label: '报阻碍' },
    unblock: { from: ['blocked'], to: 'in_progress', label: '解除阻碍' },
    cancel: { from: ['assigned', 'accepted', 'in_progress', 'submitted', 'owner_review', 'blocked'], to: 'cancelled', label: '取消' }
  };
  A['task.transition'] = function (s, uid, p) {
    var t = task(s, p.id); var w = work(s, t.workId); var tr = Object.prototype.hasOwnProperty.call(TT, p.action) ? TT[p.action] : null; need(tr, '未知操作');
    need(w.status !== 'paused', '项目已被老板暂停，暂不能操作');
    need(tr.from.indexOf(t.status) >= 0, '当前状态为「' + L.task[t.status] + '」，不能' + tr.label);
    var note = txt(p.note);
    if (p.action === 'cancel') need(w.operatorId === uid || w.leadId === uid || hasRole(s, uid, 'owner'), '只有跟进人、负责人或老板可以取消任务');
    else if (p.action === 'unblock') need(t.ownerId === uid || w.operatorId === uid || w.leadId === uid || hasRole(s, uid, 'owner'), '只有主负责人、跟进人或老板可以解除阻碍');
    else need(t.ownerId === uid, '只有主负责人可以' + tr.label);
    if (p.action === 'block' || p.action === 'cancel') need(note, '请写原因');
    if (p.action === 'submit') {
      // 交付物可以带照片 / 文件（最多 9 个；文件本身由 App 传到服务器，这里只记名字和文件 ID）
      var dm = (Array.isArray(p.media) ? p.media : []).filter(function (x) { return x && txt(x.name) && x.localId; }).slice(0, 9).map(function (x) { return { kind: ['image', 'video', 'audio', 'file'].indexOf(x.kind) >= 0 ? x.kind : 'file', name: txt(x.name).slice(0, 80), localId: String(x.localId).slice(0, 64), size: txt(x.size).slice(0, 20) }; });
      need(note || txt(p.url) || dm.length, '提交时至少附一个交付物或说明');
      s.deliverables.push({ id: nid(s, 'F'), taskId: t.id, note: note, url: txt(p.url), media: dm, by: uid, at: now(s) });
    }
    var from = t.status; t.status = tr.to; if (p.action === 'block') t.blockedReason = note; if (p.action === 'unblock') t.blockedReason = '';
    ev(s, { taskId: t.id, workId: w.id, actor: uid, action: 'task.' + p.action, from: from, to: tr.to, reason: (p.action === 'block' || p.action === 'cancel') ? note : null, text: tr.label + (note ? '：' + note : '') });
    if (p.action === 'submit') notify(s, [t.reviewerId], uid, '任务待你验收', t.title, '#/task/' + t.id);
    if (p.action === 'block') notify(s, [w.operatorId, w.leadId], uid, '任务受阻', t.title + '：' + note, '#/task/' + t.id);
    if (p.action === 'unblock') notify(s, [t.ownerId], uid, '阻碍已解除，可以继续了', t.title + (note ? '：' + note : ''), '#/task/' + t.id);
    if (p.action === 'cancel') notify(s, [t.ownerId].concat(t.collabs), uid, '任务已取消', t.title + '：' + note, '#/task/' + t.id);
    touchTask(s, t); syncWork(s, w, uid); return {};
  };
  A['task.check'] = function (s, uid, p) {
    var t = task(s, p.id); need(work(s, t.workId).status !== 'paused', '项目已暂停，恢复后才能操作'); need(t.ownerId === uid || t.collabs.indexOf(uid) >= 0, '只有主负责人或协作者可以勾选');
    need(['accepted', 'in_progress', 'blocked'].indexOf(t.status) >= 0, '接收任务后才能更新进度');
    var c = get(s.checklist, p.itemId, '清单项'); need(c.taskId === t.id, '清单项不属于这个任务'); c.done = !c.done;
    ev(s, { taskId: t.id, workId: t.workId, actor: uid, action: 'task.check', text: (c.done ? '完成：' : '取消勾选：') + c.title }); touchTask(s, t); return {};
  };
  A['task.addCheck'] = function (s, uid, p) {
    var t = task(s, p.id); var w = work(s, t.workId); need(w.status !== 'paused', '项目已暂停，恢复后才能操作'); need(t.ownerId === uid || t.collabs.indexOf(uid) >= 0 || w.leadId === uid || w.operatorId === uid, '无权添加子任务');
    need(t.status !== 'done' && t.status !== 'cancelled', '任务已结束'); var ti = txt(p.title); need(ti, '子任务不能为空');
    s.checklist.push({ id: nid(s, 'C'), taskId: t.id, title: ti, done: false }); touchTask(s, t); return {};
  };
  A['task.review'] = function (s, uid, p) {
    var t = task(s, p.id); var w = work(s, t.workId); need(w.status !== 'paused', '项目已暂停，恢复后才能操作'); need(t.reviewerId === uid, '只有该任务的验收人可以验收'); need(t.status === 'submitted', '当前状态为「' + L.task[t.status] + '」，只有待验收任务可以验收');
    var note = txt(p.note); need(note, '验收通过或退回都需要留意见');
    need(p.verdict === 'pass' || p.verdict === 'return', '请选择通过或退回');
    s.reviews.push({ id: nid(s, 'R'), taskId: t.id, workId: w.id, reviewerId: uid, verdict: p.verdict, note: note, at: now(s) });
    var from = t.status;
    if (p.verdict === 'return') {
      t.status = 'in_progress';
      notify(s, [t.ownerId].concat(t.collabs), uid, '任务被退回', t.title + '：' + note, '#/task/' + t.id);
    } else {
      var ofa = w.kind === 'product' ? s.settings.ownerFinalProduct : s.settings.ownerFinalAdmin;
      t.status = ofa ? 'owner_review' : 'done';
      if (ofa) notify(s, usersWith(s, 'owner'), uid, '任务待你终验', t.title, '#/task/' + t.id);
      notify(s, [t.ownerId], uid, '任务验收通过', t.title, '#/task/' + t.id);
    }
    ev(s, { taskId: t.id, workId: w.id, actor: uid, action: 'task.review.' + p.verdict, from: from, to: t.status, reason: note, text: L.verdict[p.verdict] + '：' + note });
    touchTask(s, t); syncWork(s, w, uid); return {};
  };
  A['task.ownerReview'] = function (s, uid, p) {
    var t = task(s, p.id); var w = work(s, t.workId); need(w.status !== 'paused', '项目已暂停，恢复后才能操作'); need(hasRole(s, uid, 'owner'), '只有老板可以终验'); need(t.status === 'owner_review', '任务不在老板终验状态');
    var note = txt(p.note); if (p.verdict === 'owner_return') need(note, '退回请写原因');
    need(p.verdict === 'owner_pass' || p.verdict === 'owner_return', '请选择通过或退回');
    s.reviews.push({ id: nid(s, 'R'), taskId: t.id, workId: w.id, reviewerId: uid, verdict: p.verdict, note: note, at: now(s) });
    t.status = p.verdict === 'owner_pass' ? 'done' : 'in_progress';
    ev(s, { taskId: t.id, workId: w.id, actor: uid, action: 'task.' + p.verdict, from: 'owner_review', to: t.status, reason: note, text: L.verdict[p.verdict] + (note ? '：' + note : '') });
    notify(s, [t.ownerId, t.reviewerId], uid, L.verdict[p.verdict], t.title, '#/task/' + t.id); touchTask(s, t); syncWork(s, w, uid); return {};
  };
  A['task.comment'] = function (s, uid, p) {
    var t = task(s, p.id); need(canViewTask(s, uid, t), '无权评论该任务'); var b = txt(p.body); need(b, '内容不能为空'); need(b.length <= 2000, '留言不超过 2000 字');
    s.comments.push({ id: nid(s, 'M'), taskId: t.id, authorId: uid, body: b, at: now(s) });
    ev(s, { taskId: t.id, workId: t.workId, actor: uid, action: 'task.comment', text: '留言：' + b });
    var w = work(s, t.workId), at = mentioned(s, b).filter(function (x) { return canViewTask(s, x, t); });
    if (at.length) notify(s, at, uid, name(s, uid) + ' 提到了你', b.slice(0, 60), '#/task/' + t.id); // 被 @ 的人收到「提到了你」，不再重复收普通留言通知
    notify(s, [t.ownerId, t.reviewerId, w.operatorId, w.leadId].concat(t.collabs).filter(function (x) { return at.indexOf(x) < 0; }), uid, name(s, uid) + ' 在任务里留言', b, '#/task/' + t.id);
    touchTask(s, t); return {};
  };
  /* 项目讨论：项目成员都能发言；通知项目相关的人，@ 到的人收到「提到了你」 */
  A['work.comment'] = function (s, uid, p) {
    var w = work(s, p.id); need(canViewWork(s, uid, w), '只有项目成员可以参与讨论'); need(w.status !== 'cancelled', '项目已取消');
    var b = txt(p.body); need(b, '内容不能为空'); need(b.length <= 2000, '留言不超过 2000 字');
    var c = { id: nid(s, 'M'), workId: w.id, taskId: null, authorId: uid, body: b, at: now(s) }; s.comments.push(c);
    // 讨论是聊天，不写进「操作记录」（动态只记事情本身的变化）
    var at = mentioned(s, b).filter(function (x) { return canViewWork(s, x, w); });
    if (at.length) notify(s, at, uid, name(s, uid) + ' 提到了你', b.slice(0, 60), '#/work/' + w.id);
    notify(s, relatedOfWork(s, w).filter(function (x) { return at.indexOf(x) < 0; }), uid, name(s, uid) + ' 在项目里发言', w.title + '：' + b.slice(0, 40), '#/work/' + w.id);
    touchWork(s, w); return { id: c.id };
  };
  /* 老板复核意见（文档 2.7、4.2）：只追加一条复核记录、通知执行人和验收人，不改变任务状态 */
  A['task.reviewComment'] = function (s, uid, p) {
    need(hasRole(s, uid, 'owner'), '只有老板可以写复核意见'); var t = task(s, p.id); var note = txt(p.note); need(note, '请写复核意见'); need(note.length <= 1000, '不超过 1000 字');
    need(['submitted', 'owner_review', 'done'].indexOf(t.status) >= 0, '提交成果后才能复核');
    s.reviews.push({ id: nid(s, 'R'), taskId: t.id, workId: t.workId, reviewerId: uid, verdict: 'comment', note: note, at: now(s) });
    ev(s, { taskId: t.id, workId: t.workId, actor: uid, action: 'task.comment_review', text: '老板复核意见：' + note });
    notify(s, [t.ownerId, t.reviewerId], uid, '老板的复核意见', t.title + '：' + note.slice(0, 40), '#/task/' + t.id); touchTask(s, t); return {};
  };
  A['owner.override'] = function (s, uid, p) {
    need(hasRole(s, uid, 'owner'), '只有老板可以纠偏'); var r = txt(p.reason); need(r, '纠偏必须填写原因');
    var t = task(s, p.id); var w = work(s, t.workId); need(w.status !== 'paused', '项目已暂停，请先恢复再纠偏'); var from = t.status;
    if (p.action === 'revoke') {
      need(t.status === 'done', '只有已完成的任务可以撤销验收');
      s.reviews.push({ id: nid(s, 'R'), taskId: t.id, workId: w.id, reviewerId: uid, verdict: 'owner_revoke', note: r, at: now(s) });
      t.status = 'in_progress';
      ev(s, { taskId: t.id, workId: w.id, actor: uid, action: 'owner.override.revoke', from: from, to: 'in_progress', reason: r, text: '老板撤销验收：' + r });
      if (w.status === 'done') { w.status = 'active'; ev(s, { workId: w.id, actor: 'system', action: 'work.status', from: 'done', to: 'active', text: '因撤销验收，项目重新打开' }); }
    } else if (p.action === 'reassign') {
      need(p.ownerId && live(s, p.ownerId) && p.ownerId !== t.ownerId, '请选择新的主负责人（不能是已停用的成员）');
      need(t.status !== 'done' && t.status !== 'cancelled', '已结束的任务不能改派');
      var old = t.ownerId; t.ownerId = p.ownerId; t.status = 'assigned'; t.blockedReason = '';
      ev(s, { taskId: t.id, workId: w.id, actor: uid, action: 'owner.override.reassign', from: from, to: 'assigned', reason: r, text: '老板改派：' + name(s, old) + ' 改为 ' + name(s, p.ownerId) + '。原因：' + r });
      notify(s, [old], uid, '任务已被改派', t.title + '：' + r, '#/task/' + t.id);
    } else deny('未知纠偏操作');
    notify(s, [t.ownerId, t.reviewerId, w.operatorId, w.leadId].concat(t.collabs), uid, '老板纠偏', t.title + '：' + r, '#/task/' + t.id);
    touchTask(s, t); syncWork(s, w, uid); return {};
  };
  A['settings.update'] = function (s, uid, p) {
    need(hasRole(s, uid, 'owner') || hasRole(s, uid, 'admin'), '只有老板或管理员可以修改配置');
    var keys = ['ownerApprovalMode', 'ownerFinalAdmin', 'ownerFinalProduct', 'agentDirectRoute', 'staleDays', 'budgetThreshold', 'direction', 'demoAiFail', 'showTiers'];
    var BOOL = ['ownerFinalAdmin', 'ownerFinalProduct', 'agentDirectRoute', 'demoAiFail', 'showTiers'];
    keys.forEach(function (k) {
      if (!(k in p)) return; var v = p[k];
      if (BOOL.indexOf(k) >= 0) need(typeof v === 'boolean', '开关设置格式不对');
      if (k === 'ownerApprovalMode') need(v === 'exceptions_only' || v === 'all', '老板确认范围只能是「只送例外」或「每条都送」');
      if (k === 'staleDays') need(typeof v === 'number' && v >= 1 && v <= 30 && Math.floor(v) === v, '无动态提醒天数要在 1 到 30 之间');
      if (k === 'budgetThreshold') need(v === null || (typeof v === 'number' && v >= 0 && v <= 1e9), '超预算阈值格式不对');
      if (k === 'direction') need(typeof v === 'string' && v.length <= 500, '公司方向不超过 500 字');
    });
    var changed = [];
    keys.forEach(function (k) { if (k in p && p[k] !== s.settings[k]) { s.settings[k] = p[k]; changed.push(k); } });
    if (hasRole(s, uid, 'admin') && !hasRole(s, uid, 'owner') && 'direction' in p) deny('公司方向由老板填写');
    if (changed.length) ev(s, { actor: uid, action: 'settings.update', text: '修改配置：' + changed.join('、') });
    return {};
  };
  A['notif.read'] = function (s, uid, p) {
    s.notifications.forEach(function (n) { if (n.userId === uid && (!p.id || n.id === p.id)) n.read = true; }); return {};
  };

  function act(s, uid, action, p) {
    // 只认自己定义的操作：constructor / toString / __proto__ 这类原型链上的名字不能当操作（否则会把整个状态当结果返回）
    var fn = Object.prototype.hasOwnProperty.call(A, action) && typeof A[action] === 'function' ? A[action] : null;
    if (!fn) return { ok: false, error: '未知操作：' + String(action).slice(0, 40) };
    var snapshot = JSON.stringify(stripFns(s));
    try { var r = fn(s, uid, p || {}); return Object.assign({ ok: true }, r); }
    catch (e) {
      restore(s, JSON.parse(snapshot)); // 意外错误也回滚，不留下改了一半的数据
      if (e && e.userError) return { ok: false, error: e.message };
      throw e;
    }
  }

  /* ---------- 数据迁移（客户端缓存与服务器共用，幂等） ---------- */
  function migrate(s) {
    // 清洗历史数据里的坏附件（以前没校验，坏数据会让下发和转写抛异常）
    (s.ideas || []).forEach(function (d) { if (!Array.isArray(d.media) || d.media.some(function (x) { return !x || typeof x !== 'object' || MKINDS.indexOf(x.kind) < 0; })) d.media = cleanMedia(d.media); });
    (s.workItems || []).forEach(function (w) { if (w.files && !Array.isArray(w.files)) w.files = []; else if (w.files) w.files = w.files.filter(function (x) { return x && typeof x === 'object'; }); });
    // 演示数据的历史迁移（改名、补演示待办、补演示资料）只作用于演示数据；真实团队（blank 创建，real=true）不动
    if (s.real) { if (!s.todos) s.todos = []; if (!s.knowledge) s.knowledge = []; } else
    (function () { var o = user(s, 'u_owner'); if (o && o.name === '王建国') { o.name = 'Enos'; } if (!s.todos) seedTodos(s, Date.now()); if (s.users.some(function (u) { return !u.group; })) { var fr = seed(); s.users.forEach(function (u) { var f = fr.users.find(function (x) { return x.id === u.id; }); if (f && !u.group) { u.motto = f.motto; u.skills = f.skills; u.presence = f.presence; u.group = f.group; if (u.id === 'u_owner') u.title = f.title; } else if (!u.group) { u.group = '行政运营'; u.presence = 'offline'; u.skills = []; u.motto = ''; } }); } })();
    kbInit(s);
    s.ideas.forEach(function (d) { if (d.titleSource) return; var n = String(d.note || '').replace(/\s+/g, ''), t = String(d.title || '').replace(/\s+/g, ''); if (!t || /【|^\d+[.、]/.test(d.title) || (t.length >= 6 && n.indexOf(t) === 0)) { d.title = aiTitle(d); d.titleSource = 'ai'; } else d.titleSource = 'user'; });
    return s;
  }

  /* ---------- 按身份裁剪数据：服务器只下发这个人能看到的内容 ---------- */
  function viewFor(s, uid) {
    var I = {}, W = {}, T = {}, ctx = { myWorks: {}, workById: {}, W: W }, ideaById = {};
    s.tasks.forEach(function (t) { if (t.ownerId === uid || t.collabs.indexOf(uid) >= 0) ctx.myWorks[t.workId] = 1; });
    s.workItems.forEach(function (w) { ctx.workById[w.id] = w; });
    s.ideas.forEach(function (d) { ideaById[d.id] = d; if (canViewIdea(s, uid, d)) I[d.id] = 1; });
    s.workItems.forEach(function (w) { if (canViewWork(s, uid, w, ctx)) W[w.id] = 1; });
    s.tasks.forEach(function (t) { if (W[t.workId] && canViewTask(s, uid, t, ctx)) T[t.id] = 1; });
    var kb = {}; kbVisible(s, uid).forEach(function (k) { kb[k.id] = 1; });
    // 先在原数据上筛出能看的，再只深拷贝这一部分（以前先拷整个状态再筛，大团队时很慢）
    var src = stripFns(s), pre = {};
    Object.keys(src).forEach(function (k) { pre[k] = src[k]; });
    pre.ideas = s.ideas.filter(function (d) { return I[d.id]; }); pre.workItems = s.workItems.filter(function (w) { return W[w.id]; }); pre.tasks = s.tasks.filter(function (t) { return T[t.id]; });
    pre.notifications = s.notifications.filter(function (n) { return n.userId === uid; });
    var v = JSON.parse(JSON.stringify(pre));
    var byIdea = function (x) { return !x.ideaId || I[x.ideaId]; };
    v.ideas.forEach(function (d) { var o = ideaById[d.id]; d.media = (d.media || []).filter(function (m) { return canSeeMediaItem(s, uid, o, m); }); });
    v.suggestions = v.suggestions.filter(byIdea);
    var own = hasRole(s, uid, 'owner');
    // 讨论总结只给老板看
    v.summaries = v.summaries.filter(function (x) { return byIdea(x) && (x.kind !== 'digest' || own); });
    var mgr = hasRole(s, uid, 'owner') || hasRole(s, uid, 'admin');
    // 动态：关联的想法 / 项目 / 任务都得看得到；不关联任何对象的（成员、配置变更）只给老板和管理员
    // 删除想法的记录：想法本身看不到了，但老板要能在动态里查到是谁、为什么删的
    v.events = v.events.filter(function (e) { if (!e.ideaId && !e.workId && !e.taskId) return mgr; if (e.action === 'idea.delete') return hasRole(s, uid, 'owner'); return (e.workId ? W[e.workId] : byIdea(e)) && (!e.taskId || T[e.taskId]); }); // 项目上的动态：能看项目就能看（不要求能看来源想法）
    v.decisions = v.decisions.filter(function (x) { return (x.ideaId && I[x.ideaId]) || (x.workId && W[x.workId]) || (!x.ideaId && !x.workId && hasRole(s, uid, 'owner')); });
    // 决策上的 Claude 建议基于老板的全部资料，只给老板
    if (!own) v.decisions.forEach(function (x) { delete x.ai; });
    v.workItems = v.workItems.filter(function (w) { return W[w.id]; });
    v.tasks = v.tasks.filter(function (t) { return T[t.id]; });
    ['checklist', 'deliverables', 'comments'].forEach(function (k) { v[k] = (v[k] || []).filter(function (x) { return (!x.taskId || T[x.taskId]) && (!x.workId || W[x.workId]); }); }); // 项目讨论（只有 workId）按项目可见性过滤
    v.reviews = v.reviews.filter(function (x) { return x.taskId ? T[x.taskId] : W[x.workId]; });
    v.notifications = v.notifications.filter(function (n) { return n.userId === uid; });
    v.todos = (v.todos || []).filter(function (x) { return x.ownerId === uid || (x.people || []).indexOf(uid) >= 0; });
    v.todoRecent = (v.todoRecent || []).filter(function (x) { return x.userId === uid; });
    v.knowledge = (v.knowledge || []).filter(function (k) { return kb[k.id]; });
    // 隐私：别人的联系方式只给老板和管理员；公司方向、预算阈值只给老板、管理员和运营者（他们要据此整理和派发）
    var seeContact = hasRole(s, uid, 'owner') || hasRole(s, uid, 'admin'), seePolicy = seeContact || hasRole(s, uid, 'operator');
    v.users.forEach(function (u) { if (u.id !== uid) { delete u.prefs; if (!seeContact) { delete u.email; delete u.phone; delete u.contact; } } });
    if (!seePolicy && v.settings) { delete v.settings.direction; delete v.settings.budgetThreshold; }
    return v;
  }

  /* ---------- 新团队：只有老板一个人、没有任何示例内容 ---------- */
  function blank(o, clock) {
    o = o || {};
    var s = seed(clock), owner = s.users.find(function (u) { return u.id === 'u_owner'; });
    owner.name = txt(o.name) || '老板'; owner.title = txt(o.title) || '负责人';
    owner.email = ''; owner.location = ''; owner.bio = ''; owner.motto = ''; owner.skills = []; owner.presence = 'online';
    s.users = [owner];
    s.real = true;
    clearContent(s);
    s.knowledge = [];
    s.settings.direction = '';
    return migrate(s);
  }
  function clearContent(s) {
    ['ideas', 'suggestions', 'summaries', 'workItems', 'tasks', 'checklist', 'deliverables', 'reviews', 'decisions', 'comments', 'events', 'notifications', 'todos', 'todoRecent'].forEach(function (k) { s[k] = []; });
    if (s.knowledge) s.knowledge = s.knowledge.filter(function (k) { return !k.demo; });
  }
  /* 真实 AI 整理稿：只有服务器以系统身份（agent）能写入；最新一版已经是人工写的就不覆盖 */
  var AI_CAT = ['admin', 'product', 'other'], AI_FLAGS = ['strategy_change', 'over_budget', 'personnel', 'major_release'], AI_ROUTE = ['operator_direct', 'to_lead', 'to_owner'];
  /* 录音 / 视频转写（系统身份，由服务器调用）：status pending → done / failed。转写完成后，如果整理稿还是系统生成的、
     想法还没往前推进，就按「原文 + 转写」重新生成整理稿（服务器启用 AI 时会再交给 Claude） */
  A['idea.transcript'] = function (s, uid, p) {
    need(uid === 'agent', '只有系统可以写入转写结果');
    var d = s.ideas.find(function (x) { return x.id === p.id; }); need(d && !d.deleted, '想法不存在');
    var m = (d.media || []).find(function (x) { return x.localId && x.localId === p.localId; }); need(m, '附件不存在');
    need(['pending', 'done', 'failed'].indexOf(p.status) >= 0, '状态不对');
    m.transcriptStatus = p.status;
    if (p.status !== 'done') return {};
    var t = txt(p.text).slice(0, 20000); m.transcript = t; m.transcriptAt = now(s);
    ev(s, { ideaId: d.id, actor: 'agent', action: 'idea.transcript', text: (m.kind === 'video' ? '视频' : '录音') + '「' + m.name + '」转写完成（' + t.length + ' 字）' });
    var sm = latestSummary(s, d.id, 'analysis');
    var fresh = d.status === 'triage' && (!sm || sm.authorType === 'agent') && !s.workItems.some(function (w) { return w.ideaId === d.id; }) && !s.decisions.some(function (x) { return x.ideaId === d.id; }); // AI 版整理稿也要重做（之前没看到转写内容）；人改过的不动
    if (t && fresh && d.submittedAt) { addSummary(s, d, 'analysis', mockAnalysis(s, d), 'agent'); d.aiStatus = 'ready'; return { reanalyzed: true }; }
    return {};
  };
  A['idea.aiResult'] = function (s, uid, p) {
    need(uid === 'agent', '只有系统可以写入 AI 整理结果');
    var d = s.ideas.find(function (x) { return x.id === p.id; }); need(d && !d.deleted, '想法不存在');
    var sm = latestSummary(s, d.id, 'analysis');
    need(sm && sm.id === p.summaryId && sm.authorType === 'agent', '整理稿已经更新过，不覆盖');
    // 运营者已经据此派发、或已送老板 / 老板已决定：整理稿是当时决定的依据，不再改
    need(d.status === 'triage' && !s.workItems.some(function (w) { return w.ideaId === d.id; }) && !s.decisions.some(function (x) { return x.ideaId === d.id && x.status !== 'pending'; }), '想法已经往前推进，不再替换整理稿');
    var a = p.payload || {}, str = function (v, n) { var x = txt(v); return /^[（(]?(无|暂无|没有|未提及|未说明|未知|不详|n\/?a|none)[）)]?[。.]?$/i.test(x) ? '' : x.slice(0, n); }, /* 模型常把没说的写成「无」，当作没填 */ arr = function (v, n, m) { return (Array.isArray(v) ? v : []).map(function (x) { return str(x, m); }).filter(Boolean).slice(0, n); };
    var np = Object.assign({}, sm.payload, {
      simulated: false, model: str(p.model, 40),
      title: str(a.title, 30) || sm.payload.title, summary: str(a.summary, 120), background: str(a.background, 1000), problem: str(a.problem, 500),
      goal: str(a.goal, 300), overview: str(a.overview, 600), issues: arr(a.issues, 6, 80), directions: arr(a.directions, 6, 80),
      category: a.category === 'product' && !has(ideaText(d), CAT_PRODUCT) ? ruleCat(ideaText(d)) : AI_CAT.indexOf(a.category) >= 0 ? a.category : sm.payload.category, /* 小模型常把活动说成产品：原文没有研发类字眼就按规则判断 */
      relation_to_direction: str(a.relation_to_direction, 300) || sm.payload.relation_to_direction,
      open_questions: arr(a.open_questions, 5, 80),
      exception_flags: (Array.isArray(a.exception_flags) ? a.exception_flags : []).filter(function (x, i, l) { return AI_FLAGS.indexOf(x) >= 0 && l.indexOf(x) === i && (x !== 'over_budget' || overBudget(s, ideaText(d))); }), /* 超预算按原文金额和老板设的阈值核对，不信模型的猜测 */
      suggested_route: AI_ROUTE.indexOf(a.suggested_route) >= 0 ? a.suggested_route : sm.payload.suggested_route,
      suggested_tasks: (Array.isArray(a.suggested_tasks) ? a.suggested_tasks : []).slice(0, 6).map(function (t) { return { title: str(t && t.title, 50), expected_output: str(t && t.expected_output, 100), acceptance_criteria: str(t && t.acceptance_criteria, 100), suggested_due_days: Math.max(1, Math.min(90, Math.round(+(t && t.suggested_due_days) || 7))) }; }).filter(function (t) { return t.title; }),
      confidence: Math.max(0, Math.min(1, +a.confidence || 0.7))
    });
    if (!np.suggested_tasks.length) np.suggested_tasks = sm.payload.suggested_tasks;
    if (!np.overview) np.overview = np.summary || sm.payload.overview; if (!np.summary) np.summary = sm.payload.summary;
    sm.payload = np;
    if (d.titleSource === 'ai' && np.title) d.title = np.title;
    ev(s, { ideaId: d.id, actor: 'agent', action: 'ai.analyze.real', text: (/^本机/.test(np.model) ? '本机 AI' : 'Claude') + ' 完成整理 · 建议：' + L.route[np.suggested_route] });
    return {};
  };
  /* 老板早报：今天需要老板关注的事（服务器每天早上以系统身份发一条通知） */
  function briefStats(s) {
    var t = now(s), y = t - DAY, open = function (x) { return ['done', 'cancelled'].indexOf(x.status) < 0; };
    return {
      decisions: s.decisions.filter(function (x) { return x.status === 'pending'; }).length,
      ownerReview: s.tasks.filter(function (x) { return x.status === 'owner_review'; }).length,
      overdue: s.tasks.filter(function (x) { return isOverdue(s, x); }).length,
      blocked: s.tasks.filter(function (x) { return x.status === 'blocked'; }).length,
      stale: s.tasks.filter(function (x) { return open(x) && isStale(s, x); }).length,
      newIdeas: s.ideas.filter(function (x) { return !x.deleted && x.status !== 'draft' && (x.submittedAt || x.createdAt) >= y; }).length,
      doneYesterday: s.tasks.filter(function (x) { return x.status === 'done' && x.lastActivity >= y; }).length
    };
  }
  A['system.dailyBrief'] = function (s, uid, p) {
    need(uid === 'agent', '只有系统可以发早报');
    var b = briefStats(s), parts = [];
    if (b.decisions) parts.push(b.decisions + ' 件等你决策');
    if (b.ownerReview) parts.push(b.ownerReview + ' 个任务等你终验');
    if (b.overdue) parts.push(b.overdue + ' 个任务逾期');
    if (b.blocked) parts.push(b.blocked + ' 个任务受阻');
    if (b.stale) parts.push(b.stale + ' 个任务好几天没动静');
    if (b.newIdeas) parts.push('昨天新提交 ' + b.newIdeas + ' 个想法');
    if (b.doneYesterday) parts.push('昨天完成 ' + b.doneYesterday + ' 个任务');
    if (!parts.length) return { sent: 0 };
    var body = parts.join('，') + '。' + (p && p.ai ? '\n' + txt(p.ai).slice(0, 300) : '');
    notify(s, usersWith(s, 'owner'), null, '今日早报', body, '#/inbox');
    return { sent: 1 };
  };
  /* 截止提醒（服务器每天早上以系统身份执行）：明天截止、已逾期的任务提醒执行人本人；同一任务一天最多提醒一次 */
  A['system.dueReminders'] = function (s, uid) {
    need(uid === 'agent', '只有系统可以发提醒');
    var today = todayStr(s), tomorrow = dateAdd(s, 1), n = 0;
    s.tasks.forEach(function (t) {
      if (!t.due || ['done', 'cancelled', 'submitted', 'owner_review'].indexOf(t.status) >= 0 || t.remindedOn === today) return;
      var w0 = s.workItems.find(function (x) { return x.id === t.workId; }); if (w0 && ['paused', 'cancelled', 'done'].indexOf(w0.status) >= 0) return; // 暂停 / 结束的项目不催
      var late = t.due < today, soon = t.due === tomorrow; if (!late && !soon) return;
      notify(s, [t.ownerId], null, late ? '任务已逾期' : '任务明天截止', t.title + (late ? '（截止 ' + t.due + '）' : ''), '#/task/' + t.id);
      // 逾期也告诉跟进人和负责人（文档 13.1）
      if (late) { var w = s.workItems.find(function (x) { return x.id === t.workId; }); if (w) notify(s, [w.operatorId, w.leadId].filter(function (x) { return x && x !== t.ownerId && live(s, x); }), null, '任务已逾期：' + name(s, t.ownerId), t.title + '（截止 ' + t.due + '）', '#/task/' + t.id); }
      t.remindedOn = today; n++;
    });
    // 超过 N 天无动态：每天汇总告诉项目的跟进人和负责人（文档 13.1）
    var stale = {};
    s.tasks.forEach(function (t) { if (!isStale(s, t) || t.staleRemindedOn === today) return; var w = s.workItems.find(function (x) { return x.id === t.workId; }); if (!w || ['paused', 'cancelled', 'done'].indexOf(w.status) >= 0) return; t.staleRemindedOn = today;
      [w.operatorId, w.leadId].filter(function (u, i, a) { return u && a.indexOf(u) === i && u !== t.ownerId && live(s, u); }).forEach(function (u) { (stale[u] = stale[u] || []).push(t); }); }); // 跟进人和负责人是同一人时只算一次
    Object.keys(stale).forEach(function (u) { var ts = stale[u]; notify(s, [u], null, ts.length + ' 个任务超过 ' + s.settings.staleDays + ' 天没有动态', ts.slice(0, 3).map(function (t) { return t.title + '（' + name(s, t.ownerId) + '）'; }).join('、') + (ts.length > 3 ? ' 等' : ''), ts.length === 1 ? '#/task/' + ts[0].id : '#/tasks'); n++; });
    // 待验收积压：提交超过 2 天还没验收，每天提醒验收人一次（汇总成一条）
    var back = {};
    s.tasks.forEach(function (t) { if (t.status === 'submitted' && t.reviewerId && t.lastActivity < now(s) - 2 * DAY && t.reviewRemindedOn !== today) { (back[t.reviewerId] = back[t.reviewerId] || []).push(t); t.reviewRemindedOn = today; } });
    Object.keys(back).forEach(function (r) { var ts = back[r]; notify(s, [r], null, ts.length + ' 个任务等你验收', ts.slice(0, 3).map(function (t) { return t.title; }).join('、') + (ts.length > 3 ? ' 等' : ''), ts.length === 1 ? '#/task/' + ts[0].id : '#/tasks'); n++; });
    return { sent: n };
  };
  /* 日常清理（服务器每天以系统身份执行）：已读且超过 60 天的通知删掉，未读的保留 */
  A['system.housekeep'] = function (s, uid) {
    need(uid === 'agent', '只有系统可以清理');
    var cut = now(s) - 60 * DAY, n0 = s.notifications.length;
    s.notifications = s.notifications.filter(function (n) { return !n.read || n.at >= cut; });
    return { removed: n0 - s.notifications.length };
  };
  /* Claude 讨论总结：服务器后台以系统身份替换规则版（期间老板又让总结了一版就不覆盖） */
  /* 写回 AI 共创汇总：只在发起人还没确认方向时替换规则版；来源编号必须是这个想法里的建议，没有来源的结论丢弃（文档 8.4） */
  A['idea.cocreateResult'] = function (s, uid, p) {
    need(uid === 'agent', '只有系统可以写入 AI 汇总');
    var d = s.ideas.find(function (x) { return x.id === p.id; }); need(d && !d.deleted, '想法不存在'); need(d.status === 'summary_ready', '方向已经确认，不再替换汇总');
    var sm = latestSummary(s, d.id, 'cocreate'); need(sm && sm.id === p.summaryId && sm.payload.simulated, '汇总已经更新过，不覆盖');
    var ids = s.suggestions.filter(function (x) { return x.ideaId === d.id; }).map(function (x) { return x.id; });
    var a = p.payload || {}, str = function (v, n) { var x = txt(v); return /^[（(]?(无|暂无|没有|未提及|未说明|未知|不详|n\/?a|none)[）)]?[。.]?$/i.test(x) ? '' : x.slice(0, n); }, /* 模型常把没说的写成「无」，当作没填 */ src = function (v) { return (Array.isArray(v) ? v : []).map(String).filter(function (x, i, l) { return ids.indexOf(x) >= 0 && l.indexOf(x) === i; }).slice(0, 10); };
    var pts = function (v, needSrc) { return (Array.isArray(v) ? v : []).slice(0, 8).map(function (x) { return { point: str(x && x.point, 120), src: src(x && x.src) }; }).filter(function (x) { return x.point && (!needSrc || x.src.length); }); };
    var np = { simulated: false, model: str(p.model, 40), consensus: pts(a.consensus, true), risks: pts(a.risks, true), open_questions: pts(a.open_questions, false),
      divergences: (Array.isArray(a.divergences) ? a.divergences : []).slice(0, 5).map(function (v) { return { point: str(v && v.point, 120), positions: (Array.isArray(v && v.positions) ? v.positions : []).slice(0, 4).map(function (q) { return { view: str(q && q.view, 120), src: src(q && q.src) }; }).filter(function (q) { return q.view && q.src.length; }) }; }).filter(function (v) { return v.point && v.positions.length; }),
      proposed_direction: str(a.proposed_direction, 300) || sm.payload.proposed_direction };
    need(np.consensus.length + np.divergences.length + np.risks.length + np.open_questions.length, 'AI 没有给出可追溯的结论，保留规则版');
    sm.payload = np;
    ev(s, { ideaId: d.id, actor: 'agent', action: 'ai.cocreate.ready', text: 'AI 重新整理了共创汇总' }); touchIdea(s, d); return {};
  };
  /* AI 重试三次都失败：记一条动态，告诉相关的人「先用规则版」，可以手动修改或稍后点「重新整理」 */
  A['ai.failed'] = function (s, uid, p) {
    need(uid === 'agent', '只有系统可以记录'); var d = s.ideas.find(function (x) { return x.id === p.id; }); need(d && !d.deleted, '想法不存在');
    var what = p.kind === 'cocreate' ? '共创汇总' : p.kind === 'digest' ? '讨论总结' : '整理稿';
    var who = p.kind === 'cocreate' ? [d.creatorId] : p.kind === 'digest' ? usersWith(s, 'owner') : (d.followerId ? [d.followerId] : followUsers(s));
    ev(s, { ideaId: d.id, actor: 'agent', action: 'ai.failed', text: 'AI 生成' + what + '没有成功（已重试 3 次），先用规则版' });
    notify(s, who, null, 'AI ' + what + '没有成功', (d.title || '想法') + '：先用规则版，可以手动修改', '#/idea/' + d.id); return {};
  };
  A['idea.digestResult'] = function (s, uid, p) {
    need(uid === 'agent', '只有系统可以写入 AI 总结');
    var d = s.ideas.find(function (x) { return x.id === p.id; }); need(d && !d.deleted, '想法不存在');
    var sm = latestSummary(s, d.id, 'digest'); need(sm && sm.id === p.summaryId && sm.payload.simulated, '总结已经更新过，不覆盖');
    var a = p.payload || {}, str = function (v, n) { return txt(v).slice(0, n); };
    var names = s.users.map(function (u) { return u.name; }), who = function (v) { return (Array.isArray(v) ? v : []).map(function (x) { return str(x, 20); }).filter(function (x) { return names.indexOf(x) >= 0; }).slice(0, 8); };
    var pts = function (v) { return (Array.isArray(v) ? v : []).slice(0, 6).map(function (x) { return { point: str(x && x.point, 120), who: who(x && x.who), src: [] }; }).filter(function (x) { return x.point; }); };
    sm.payload = Object.assign({}, sm.payload, {
      simulated: false, model: str(p.model, 40),
      people: (Array.isArray(a.people) ? a.people : []).slice(0, 12).map(function (x) { return { name: str(x && x.name, 20), points: (Array.isArray(x && x.points) ? x.points : []).map(function (t) { return str(t, 120); }).filter(Boolean).slice(0, 4) }; }).filter(function (x) { return names.indexOf(x.name) >= 0 && x.points.length; }),
      consensus: pts(a.consensus), risks: pts(a.risks), questions: pts(a.questions),
      divergences: (Array.isArray(a.divergences) ? a.divergences : []).slice(0, 4).map(function (v) { return { point: str(v && v.point, 120), sides: (Array.isArray(v && v.sides) ? v.sides : []).slice(0, 4).map(function (x) { return { view: str(x && x.view, 120), who: who(x && x.who) }; }).filter(function (x) { return x.view; }) }; }).filter(function (v) { return v.point && v.sides.length; }),
      next: (Array.isArray(a.next) ? a.next : []).map(function (t) { return str(t, 100); }).filter(Boolean).slice(0, 5)
    });
    if (!sm.payload.next.length) sm.payload.next = ['再听听大家的意见'];
    return {};
  };
  /* Claude 给老板的决策建议：服务器以系统身份写到决策上（换设备也能看到，不重复收费） */
  A['decision.aiAdvice'] = function (s, uid, p) {
    need(uid === 'agent', '只有系统可以写入 AI 建议');
    var dc = s.decisions.find(function (x) { return x.id === p.id; }); need(dc, '决策不存在');
    var a = p.advice || {}, str = function (v, n) { return txt(v).slice(0, n); }, arr = function (v) { return (Array.isArray(v) ? v : []).map(function (x) { return str(x, 120); }).filter(Boolean).slice(0, 6); };
    dc.ai = { verdict: ['approved', 'needs_info', 'rejected'].indexOf(a.verdict) >= 0 ? a.verdict : 'needs_info', label: str(a.label, 20) || '建议', reasons: arr(a.reasons), risks: arr(a.risks), checks: arr(a.checks), note: str(a.note, 300), model: str(p.model, 40), at: now(s) };
    return {};
  };
  /* 成员在 App 里注销账号（服务器以系统身份调用）：通知老板 */
  // 手上还没结束的工作：交接时用
  function openWorkOf(s, id) {
    var open = function (x) { return ['done', 'cancelled'].indexOf(x.status) < 0; };
    return { tasks: s.tasks.filter(function (t) { return open(t) && t.ownerId === id; }), reviews: s.tasks.filter(function (t) { return open(t) && t.reviewerId === id && t.ownerId !== id; }), works: s.workItems.filter(function (w) { return open(w) && (w.leadId === id || w.operatorId === id || w.reviewerId === id); }),
      ideas: s.ideas.filter(function (d) { return !d.deleted && d.followerId === id && ['triage', 'awaiting_owner'].indexOf(d.status) >= 0; }) };
  }
  /* 账号停用 / 恢复（服务器在老板或管理员停用账号时以系统身份调用）：停用后不能再被派任务；提醒老板交接 TA 手上的工作 */
  A['member.active'] = function (s, uid, p) {
    need(uid === 'agent', '只有系统可以记录账号停用'); var u = user(s, p.id); need(u, '找不到该成员'); need(!hasRole(s, u.id, 'owner'), '不能停用老板');
    var on = !!p.active; if (!on === !!u.inactive) return {};
    u.inactive = !on; var ow = openWorkOf(s, u.id), n = ow.tasks.length + ow.reviews.length + ow.works.length + ow.ideas.length;
    ev(s, { actor: 'agent', action: 'member.active', text: u.name + (on ? ' 的账号已恢复' : ' 的账号已停用') });
    if (!on && n) notify(s, usersWith(s, 'owner').concat(usersWith(s, 'admin')), null, u.name + ' 的工作需要交接', '账号已停用，TA 手上还有 ' + [ow.tasks.length && ow.tasks.length + ' 个任务', ow.reviews.length && ow.reviews.length + ' 个待 TA 验收的任务', ow.works.length && ow.works.length + ' 个项目', ow.ideas.length && ow.ideas.length + ' 条跟进中的想法'].filter(Boolean).join('、') + '。到成员资料里一键交接。', '#/team');
    return { open: n };
  };
  /* 交接：把一个人（通常是已停用的）手上未结束的任务、项目角色、跟进中的想法转给另一位在职成员；对方没有相应角色的部分保留并说明 */
  A['member.handover'] = function (s, uid, p) {
    need(hasRole(s, uid, 'owner') || hasRole(s, uid, 'admin'), '只有老板或管理员可以交接工作');
    var from = user(s, p.from); need(from, '找不到要交接的成员'); need(p.to && p.to !== p.from && live(s, p.to), '请选择在职的接手人');
    need(hasRole(s, uid, 'owner') || !hasRole(s, from.id, 'owner'), '老板的工作只能由老板自己交接'); need(!onlyAdmin(s, p.to), '接手人不能是只做管理的成员（看不到任务）');
    var to = p.to, ow = openWorkOf(s, from.id), r = { tasks: 0, reviews: 0, works: 0, ideas: 0, skipped: [] };
    ow.reviews.forEach(function (t) { var w = s.workItems.find(function (x) { return x.id === t.workId; }) || {}; var nr = t.ownerId !== to ? to : [w.reviewerId, w.leadId, w.operatorId].find(function (x) { return x && x !== t.ownerId && x !== from.id && live(s, x); });
      if (!nr) { r.skipped.push('任务「' + t.title + '」的验收人（找不到合适的人）'); return; } t.reviewerId = nr; r.reviews++; ev(s, { taskId: t.id, workId: t.workId, actor: uid, action: 'member.handover', text: '验收人从 ' + from.name + ' 交接给 ' + name(s, nr) }); });
    ow.tasks.forEach(function (t) { t.ownerId = to; if (t.reviewerId === to) { var w0 = s.workItems.find(function (x) { return x.id === t.workId; }) || {}; t.reviewerId = [w0.reviewerId, w0.leadId, w0.operatorId].find(function (x) { return x && x !== to && live(s, x); }) || t.reviewerId; } t.collabs = t.collabs.filter(function (c) { return c !== to; }); if (['accepted', 'in_progress', 'blocked'].indexOf(t.status) >= 0) t.status = 'assigned'; t.lastActivity = now(s); r.tasks++;
      ev(s, { taskId: t.id, workId: t.workId, actor: uid, action: 'member.handover', text: '任务从 ' + from.name + ' 交接给 ' + name(s, to) }); });
    s.tasks.forEach(function (t) { if (['done', 'cancelled'].indexOf(t.status) < 0 && t.collabs.indexOf(from.id) >= 0) t.collabs = t.collabs.filter(function (c) { return c !== from.id; }); });
    ow.works.forEach(function (w) {
      var did = false;
      if (w.leadId === from.id) { if (leadUsers(s).indexOf(to) >= 0) { w.leadId = to; did = true; } else r.skipped.push('项目「' + w.title + '」的负责人（' + name(s, to) + ' 不是负责人角色）'); }
      if (w.operatorId === from.id) { if (canFollow(s, to)) { w.operatorId = to; did = true; } else r.skipped.push('项目「' + w.title + '」的跟进运营（' + name(s, to) + ' 不是运营者）'); }
      if (w.reviewerId === from.id) { w.reviewerId = to; did = true; }
      if (did) { r.works++; ev(s, { workId: w.id, actor: uid, action: 'member.handover', text: from.name + ' 在项目里的角色交接给 ' + name(s, to) }); touchWork(s, w); }
    });
    ow.ideas.forEach(function (d) { if (canFollow(s, to)) { d.followerId = to; r.ideas++; touchIdea(s, d); ev(s, { ideaId: d.id, actor: uid, action: 'member.handover', text: '跟进人从 ' + from.name + ' 交接给 ' + name(s, to) }); } else r.skipped.push('想法「' + (d.title || '未命名') + '」的跟进（' + name(s, to) + ' 不是运营者）'); });
    // 没有可交接的也算成功（管理员的手机上看不到任务，以服务器上的结果为准）
    if (r.tasks + r.reviews + r.works + r.ideas) notify(s, [to], uid, '你接手了 ' + from.name + ' 的工作', [r.tasks && r.tasks + ' 个任务', r.reviews && r.reviews + ' 个待验收', r.works && r.works + ' 个项目', r.ideas && r.ideas + ' 条想法'].filter(Boolean).join('、'), '#/tasks');
    return r;
  };
  A['account.deactivated'] = function (s, uid, p) {
    need(uid === 'agent', '只有系统可以记录注销');
    var u = user(s, p.id); need(u, '找不到该成员'); u.inactive = true;
    notify(s, usersWith(s, 'owner'), null, '成员注销了账号', u.name + ' 在 App 里注销了自己的账号，已无法登录。需要时可以在成员资料里恢复。', '#/team');
    ev(s, { actor: 'agent', action: 'account.deactivated', text: u.name + ' 注销了账号' });
    return {};
  };
  /* 清理演示数据：保留成员、设置和自己添加的知识库资料，其余示例内容全部清空 */
  A['data.clearDemo'] = function (s, uid) {
    need(hasRole(s, uid, 'owner'), '只有老板可以清理数据');
    clearContent(s);
    return {};
  };
  function stripFns(s) { var o = {}; Object.keys(s).forEach(function (k) { if (typeof s[k] !== 'function') o[k] = s[k]; }); return o; }
  function restore(s, snap) { Object.keys(snap).forEach(function (k) { s[k] = snap[k]; }); }

  /* ---------- 指标（文档 13.2） ---------- */
  // 无动静：派出去没人接收的、接收了 / 进行中但很久没更新的
  function isStale(s, t) { return (t.status === 'assigned' || t.status === 'accepted' || t.status === 'in_progress') && t.lastActivity < now(s) - s.settings.staleDays * DAY; }
  function isOverdue(s, t) { if (!t.due || t.status === 'done' || t.status === 'cancelled') return false; return t.due < todayStr(s); }
  function todayStr(s) { var d = new Date(now(s)); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateAdd(s, days) { var d = new Date(now(s) + days * DAY); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function stageName(kind, st) { var x = (STAGES[kind] || []).find(function (a) { return a[0] === st; }); return x ? x[1] : st; }
  function nextForTask(s, t) {
    var w = s.workItems.find(function (x) { return x.id === t.workId; }) || {};
    if (t.status === 'submitted') return { who: t.reviewerId, what: '验收' };
    if (t.status === 'owner_review') return { who: usersWith(s, 'owner')[0], what: '终验' };
    if (t.status === 'blocked') return { who: w.operatorId || w.leadId, what: '解除阻碍' };
    if (t.status === 'done' || t.status === 'cancelled') return null;
    if (t.status === 'assigned') return { who: t.ownerId, what: '接收' };
    return { who: t.ownerId, what: '执行' };
  }
  function nextForIdea(s, d) {
    switch (d.status) {
      case 'draft': return { who: d.creatorId, what: '提交草稿' };
      case 'discussing': return { who: d.creatorId, what: '团队提建议，发起人结束讨论' };
      case 'summary_ready': return { who: d.creatorId, what: '确认方向' };
      case 'triage': return d.followerId ? { who: d.followerId, what: d.reviewed || d.ownerApproved ? '派发' : '复核整理稿' } : { who: null, what: '运营者认领', queue: true };
      case 'awaiting_owner': return { who: usersWith(s, 'owner')[0], what: '例外决策' };
      case 'on_hold': return { who: d.followerId, what: '暂缓中' };
      default: return null;
    }
  }
  function ideaProgress(s, ideaId) {
    var ws = s.workItems.filter(function (w) { return w.ideaId === ideaId; }).map(function (w) { return w.id; });
    var ts = s.tasks.filter(function (t) { return ws.indexOf(t.workId) >= 0 && t.status !== 'cancelled'; });
    if (!ts.length) return null; return ts.filter(function (t) { return t.status === 'done'; }).length / ts.length;
  }
  function workProgress(s, wid) {
    var ts = s.tasks.filter(function (t) { return t.workId === wid && t.status !== 'cancelled'; });
    return { done: ts.filter(function (t) { return t.status === 'done'; }).length, total: ts.length };
  }

  /* ---------- 演示种子数据 ---------- */
  function seed(clock) {
    var T0 = clock ? clock() : Date.now();
    var s = { v: 3, seq: 100, users: [], settings: {}, ideas: [], suggestions: [], summaries: [], workItems: [], tasks: [], checklist: [], deliverables: [], reviews: [], decisions: [], comments: [], events: [], notifications: [] };
    if (clock) s.clock = clock;
    s.depts = [{ id: 'd_admin', name: '行政部' }, { id: 'd_prod', name: '事工发展部' }, { id: 'd_ops', name: '运营部' }];
    s.users = [
      { id: 'u_owner', name: 'Enos', title: '老板', tier: '', roles: [{ role: 'owner', dept: null }] },
      { id: 'u_op', name: '林晓', title: '运营者', tier: '一级', roles: [{ role: 'operator', dept: 'd_ops' }] },
      { id: 'u_lead', name: '陈立', title: '事工发展部负责人', tier: '一级', roles: [{ role: 'lead', dept: 'd_prod', canInitiate: true }] },
      { id: 'u_admin_ex', name: '周敏', title: '行政专员', tier: '二级', roles: [{ role: 'executor', dept: 'd_admin' }] },
      { id: 'u_design', name: '何静', title: 'UI 设计', tier: '二级', roles: [{ role: 'executor', dept: 'd_prod' }] },
      { id: 'u_dev', name: '刘洋', title: '开发（攻）', tier: '二级', roles: [{ role: 'executor', dept: 'd_prod' }] },
      { id: 'u_sys', name: '孙磊', title: '系统管理员', tier: '', roles: [{ role: 'admin', dept: null }] }
    ];
    var EXTRA = {
      u_owner: { title: 'CEO · 创始人', email: 'enos@company.com', location: '清迈 · 泰国', bio: '让想法变成可见的结果 🚀', motto: '专注当下，创造未来。', skills: ['战略', '事工', '产品'], presence: 'online', group: '管理层' },
      u_op: { motto: '把复杂的事，变简单。', skills: ['运营', '行政', '内容'], presence: 'online', group: '行政运营' },
      u_lead: { motto: '用产品创造真实的价值。', skills: ['产品', '研发', '用户'], presence: 'away', group: '产品研发' },
      u_admin_ex: { motto: '细节决定体验。', skills: ['行政', '运营', '支持'], presence: 'online', group: '行政运营' },
      u_design: { motto: '让设计，更有温度。', skills: ['设计', '创意', '品牌'], presence: 'busy', group: '设计创意' },
      u_dev: { motto: '写好每一行代码。', skills: ['开发', '前端', '后端'], presence: 'online', group: '产品研发' },
      u_sys: { motto: '稳定、安全、高效。', skills: ['技术', '运维', '支持'], presence: 'offline', group: '产品研发' }
    };
    s.users.forEach(function (u) { Object.assign(u, EXTRA[u.id] || {}); });
    s.settings = { ownerApprovalMode: 'exceptions_only', ownerFinalAdmin: false, ownerFinalProduct: false, agentDirectRoute: true, staleDays: 3, budgetThreshold: 20000,
      direction: '以社区与信仰内容为核心，产品彼此导流，形成可持续的服务闭环。', demoAiFail: false, showTiers: false };
    var at = function (d) { return T0 - d * DAY; };
    function I(o) { var d = Object.assign({ path: 'direct', aiStatus: 'none', followerId: null, shareAll: false, shares: [], deadline: null, directionConfirmedAt: null, ownerApproved: false, reviewed: false, media: [], dept: null, submittedAt: at(1), lastActivity: at(1), createdAt: at(2) }, o); s.ideas.push(d); return d; }
    var tmp;
    // 1. 黄金路径一的起点：换网线（待认领，AI 整理已完成）
    var i1 = I({ id: 'I1', creatorId: 'u_owner', status: 'triage', aiStatus: 'ready', title: '', note: '最近网速不好，换根网线，别用 WiFi 了。', media: [{ kind: 'audio', name: '语音备忘 0:42', durationSec: 42, demo: true }], submittedAt: T0 - 3600000, lastActivity: T0 - 3600000, createdAt: T0 - 3700000 });
    tmp = mockAnalysis(s, i1); tmp.problem = 'WiFi 信号不稳定导致网速慢'; tmp.goal = '主要工位网络稳定'; tmp.title = '办公室网络改用有线连接';
    tmp.suggested_tasks = [{ title: '采购并铺设网线到主要工位', expected_output: '铺设完成照片 + 测速截图', acceptance_criteria: '主要工位有线测速达到宽带标称的 80% 以上', suggested_due_days: 3 }];
    s.summaries.push({ id: 'S1', ideaId: 'I1', kind: 'analysis', version: 1, authorType: 'agent', authorId: null, payload: tmp, at: T0 - 3500000 });
    i1.title = tmp.title;
    s.events.push({ id: 'E1', at: T0 - 3600000, ideaId: 'I1', actorType: 'human', actorId: 'u_owner', action: 'idea.submit', from: 'draft', to: 'triage', text: '直接推进' });
    s.events.push({ id: 'E2', at: T0 - 3500000, ideaId: 'I1', actorType: 'agent', actorId: 'agent', action: 'ai.analyze.ready', text: '生成整理稿（模拟）· 建议：运营者直接派发' });
    // 2. 黄金路径二的起点：门徒圈语音灵修（共创中）
    I({ id: 'I2', creatorId: 'u_lead', dept: 'd_prod', path: 'cocreate', status: 'discussing', title: '门徒圈语音灵修', note: '想做一个每天 5 分钟的语音灵修，门徒圈成员可以收听并留言回应。先听听大家的意见。', shareAll: true, lastActivity: at(0.5) });
    s.suggestions.push({ id: 's1', ideaId: 'I2', authorId: 'u_op', replyTo: null, body: '先只做语音，不做视频，录制门槛低，同工容易坚持。', at: at(0.9) });
    s.suggestions.push({ id: 's2', ideaId: 'I2', authorId: 'u_dev', replyTo: null, body: '可以用 AI 根据经文自动生成每日内容。', at: at(0.8) });
    s.suggestions.push({ id: 's3', ideaId: 'I2', authorId: 'u_design', replyTo: 's2', body: '我觉得不要一开始就用 AI，还是先人工录，保证内容质量。', at: at(0.6) });
    s.events.push({ id: 'E3', at: at(1), ideaId: 'I2', actorType: 'human', actorId: 'u_lead', action: 'idea.submit', from: 'draft', to: 'discussing', text: '开启团队共创（全体，发起人手动结束）' });
    // 3. 老板私人草稿
    I({ id: 'I3', creatorId: 'u_owner', status: 'draft', path: null, title: '明年开发团队扩编', note: '考虑明年再招两名开发，一攻一守。先想清楚再说。', submittedAt: null });
    // 4. 等老板决策：官网改版对外发布
    I({ id: 'I4', creatorId: 'u_lead', dept: 'd_prod', status: 'awaiting_owner', aiStatus: 'ready', followerId: 'u_op', reviewed: true, title: '官网改版并对外发布', note: '官网三年没更新，希望 11 月对外发布新版本，配合年底活动。' });
    s.decisions.push({ id: 'D1', ideaId: 'I4', workId: null, kind: 'major_release', question: '是否同意 11 月对外发布新版官网（含新的品牌介绍）？', requestedBy: 'u_op', status: 'pending', decidedBy: null, note: '', at: at(0.3), decidedAt: null });
    s.decisions.push({ id: 'D2', ideaId: 'I5', workId: null, kind: 'other', question: '是否启动「清醒」App 原型开发？', requestedBy: 'u_op', status: 'approved', decidedBy: 'u_owner', note: '同意，先做可点原型。', at: at(13), decidedAt: at(12) });
    s.decisions.push({ id: 'D3', ideaId: 'I6', workId: null, kind: 'over_budget', question: '年会预算是否可上调到 3 万元？', requestedBy: 'u_op', status: 'approved', decidedBy: 'u_owner', note: '同意，控制在 3 万以内。', at: at(9), decidedAt: at(8) });
    s.decisions.push({ id: 'D4', ideaId: null, workId: null, kind: 'over_budget', question: '是否采购新的云服务套餐？', requestedBy: 'u_lead', status: 'rejected', decidedBy: 'u_owner', note: '现有套餐够用，暂不采购。', at: at(20), decidedAt: at(19) });
    s.events.push({ id: 'E4', at: at(0.3), ideaId: 'I4', actorType: 'human', actorId: 'u_op', action: 'decision.request', from: 'triage', to: 'awaiting_owner', text: '重要对外发布：是否同意 11 月对外发布新版官网？' });
    // 5. 已形成产品项目：清醒 App 原型
    I({ id: 'I5', creatorId: 'u_owner', status: 'planned', aiStatus: 'ready', followerId: 'u_op', reviewed: true, title: '「清醒」App 第一版原型', note: '个人生活规划 + AI 顾问，先出可点的原型给团队试。', createdAt: at(12), submittedAt: at(12) });
    s.workItems.push({ id: 'W1', ideaId: 'I5', dept: 'd_prod', kind: 'product', title: '「清醒」App 第一版原型', goal: '两周内出可点击原型，团队试用', status: 'active', stage: 'prototype', operatorId: 'u_op', leadId: 'u_lead', reviewerId: 'u_lead', externalLink: '', due: dateAddS(T0, 6), lastActivity: at(1), createdAt: at(10) });
    s.workItems[0].priority = 'hi'; s.workItems[0].keyResults = '交互原型、功能清单、评审意见'; s.workItems[0].goal = '完成第一版可交互原型并通过评审'; s.workItems[0].desc = '基于核心功能完成第一版交互原型，验证产品方向，为后续开发提供依据。';
    s.workItems[0].milestones = [{ id: 'MS1', title: '需求评审', date: dateAddS(T0, -6), done: true, doneAt: at(6) }, { id: 'MS2', title: '交互原型设计', date: dateAddS(T0, 4), done: false, doneAt: null }, { id: 'MS3', title: '内部评审', date: dateAddS(T0, 11), done: false, doneAt: null }, { id: 'MS4', title: '开发对接', date: dateAddS(T0, 14), done: false, doneAt: null }];
    s.tasks.push({ id: 'T1', workId: 'W1', title: '首页与今日计划页面原型', ownerId: 'u_design', collabs: [], reviewerId: 'u_lead', due: dateAddS(T0, 2), expected: 'Figma 链接 + 可点击原型', criteria: '覆盖首页、今日计划、AI 顾问入口三个页面，可在手机上点通', status: 'in_progress', blockedReason: '', lastActivity: at(5), createdAt: at(9) });
    s.tasks.push({ id: 'T2', workId: 'W1', title: '数据结构与本地存储方案', ownerId: 'u_dev', collabs: ['u_design'], reviewerId: 'u_lead', due: dateAddS(T0, 1), expected: '方案文档一页', criteria: '说明表结构、离线策略，负责人确认可行', status: 'submitted', blockedReason: '', lastActivity: at(0.2), createdAt: at(9) });
    s.checklist.push({ id: 'C1', taskId: 'T1', title: '首页', done: true }, { id: 'C2', taskId: 'T1', title: '今日计划', done: false }, { id: 'C3', taskId: 'T1', title: 'AI 顾问入口', done: false });
    s.deliverables.push({ id: 'F1', taskId: 'T2', note: '方案已写在文档里：本地 SQLite + 云端同步，离线草稿优先。', url: 'https://example.com/demo-doc', by: 'u_dev', at: at(0.2) });
    s.events.push({ id: 'E5', at: at(10), ideaId: 'I5', workId: 'W1', actorType: 'human', actorId: 'u_op', action: 'idea.route', from: 'triage', to: 'planned', text: '形成项目「「清醒」App 第一版原型」（产品），交 陈立' });
    s.events.push({ id: 'E6', at: at(9), workId: 'W1', taskId: 'T1', actorType: 'human', actorId: 'u_lead', action: 'task.assign', to: 'assigned', text: '派给 何静，验收人 陈立' });
    s.events.push({ id: 'E7', at: at(9), workId: 'W1', taskId: 'T2', actorType: 'human', actorId: 'u_lead', action: 'task.assign', to: 'assigned', text: '派给 刘洋，验收人 陈立' });
    s.events.push({ id: 'E8', at: at(5), workId: 'W1', taskId: 'T1', actorType: 'human', actorId: 'u_design', action: 'task.start', from: 'accepted', to: 'in_progress', text: '开始' });
    s.events.push({ id: 'E9', at: at(0.2), workId: 'W1', taskId: 'T2', actorType: 'human', actorId: 'u_dev', action: 'task.submit', from: 'in_progress', to: 'submitted', text: '提交成果：方案已写在文档里' });
    // 6. 行政事项：年会场地（一个受阻逾期，一个已完成可追溯）
    I({ id: 'I6', creatorId: 'u_owner', status: 'planned', aiStatus: 'ready', followerId: 'u_op', reviewed: true, title: '年会场地与物资准备', note: '12 月年会，提前订场地，准备物资。', createdAt: at(8), submittedAt: at(8) });
    s.workItems.push({ id: 'W2', ideaId: 'I6', dept: 'd_admin', kind: 'admin', title: '年会场地与物资准备', goal: '场地确认、物资清单到位', status: 'active', stage: 'handle', operatorId: 'u_op', leadId: null, reviewerId: 'u_op', externalLink: '', due: dateAddS(T0, 10), lastActivity: at(1), createdAt: at(8) });
    s.workItems[1].priority = 'mid'; s.workItems[1].keyResults = '场地合同、物资清单、流程表'; s.workItems[1].desc = '确定场地、预订物资、安排流程，确保年会顺利进行。'; s.workItems[1].ptype = '行政事务';
    s.workItems[1].milestones = [{ id: 'MS5', title: '物资清单确认', date: dateAddS(T0, -3), done: true, doneAt: at(3) }, { id: 'MS6', title: '场地签约', date: dateAddS(T0, 3), done: false, doneAt: null }, { id: 'MS7', title: '年会彩排', date: dateAddS(T0, 9), done: false, doneAt: null }];
    s.tasks.push({ id: 'T3', workId: 'W2', title: '确认年会场地并付定金', ownerId: 'u_admin_ex', collabs: [], reviewerId: 'u_op', due: dateAddS(T0, -1), expected: '场地合同照片 + 定金收据', criteria: '可容纳 80 人，12 月第二个周六可用', status: 'blocked', blockedReason: '两家场地都要求先确认人数，等各部门报名', lastActivity: at(2), createdAt: at(7) });
    s.tasks.push({ id: 'T4', workId: 'W2', title: '整理年会物资清单', ownerId: 'u_admin_ex', collabs: [], reviewerId: 'u_op', due: dateAddS(T0, -3), expected: '物资清单表格', criteria: '列出数量、预算、采购人', status: 'done', blockedReason: '', lastActivity: at(3), createdAt: at(7) });
    s.deliverables.push({ id: 'F2', taskId: 'T4', note: '物资清单已整理，共 23 项，预算 4,600 元。', url: '', by: 'u_admin_ex', at: at(3.5) });
    s.reviews.push({ id: 'R1', taskId: 'T4', workId: 'W2', reviewerId: 'u_op', verdict: 'pass', note: '清单完整，预算在范围内。', at: at(3) });
    s.events.push({ id: 'E10', at: at(7), workId: 'W2', taskId: 'T3', actorType: 'human', actorId: 'u_op', action: 'task.assign', to: 'assigned', text: '派给 周敏，验收人 林晓' });
    s.events.push({ id: 'E11', at: at(2), workId: 'W2', taskId: 'T3', actorType: 'human', actorId: 'u_admin_ex', action: 'task.block', from: 'in_progress', to: 'blocked', reason: '两家场地都要求先确认人数', text: '报阻碍：两家场地都要求先确认人数，等各部门报名' });
    s.events.push({ id: 'E12', at: at(3), workId: 'W2', taskId: 'T4', actorType: 'human', actorId: 'u_op', action: 'task.review.pass', from: 'submitted', to: 'done', text: '验收通过：清单完整，预算在范围内。' });
    // 7. 待验收项目：团队培训计划；已完成项目：Q3 财务复盘
    s.workItems.push({ id: 'W3', ideaId: null, dept: 'd_admin', kind: 'other', ptype: '研究学习', title: '团队培训计划', goal: '完成第一期同工培训课程', desc: '制定培训计划并完成第一期课程。', keyResults: '课程表、签到表、培训反馈', priority: 'mid', status: 'acceptance', stage: 'clarify', operatorId: 'u_op', leadId: null, reviewerId: 'u_op', externalLink: '', due: dateAddS(T0, 8), lastActivity: at(1), createdAt: at(20), milestones: [{ id: 'MS8', title: '课程设计', date: dateAddS(T0, -10), done: true, doneAt: at(10) }, { id: 'MS9', title: '第一期开课', date: dateAddS(T0, -2), done: true, doneAt: at(2) }] });
    s.tasks.push({ id: 'T5', workId: 'W3', title: '整理培训课程表', ownerId: 'u_admin_ex', collabs: [], reviewerId: 'u_op', due: dateAddS(T0, -5), expected: '课程表', criteria: '覆盖四周课程', status: 'done', blockedReason: '', lastActivity: at(4), createdAt: at(18), ttype: '文档' });
    s.tasks.push({ id: 'T6', workId: 'W3', title: '培训海报设计', ownerId: 'u_design', collabs: [], reviewerId: 'u_op', due: dateAddS(T0, -3), expected: '海报', criteria: '风格统一', status: 'done', blockedReason: '', lastActivity: at(2), createdAt: at(18), ttype: '设计' });
    s.reviews.push({ id: 'R2', taskId: 'T5', workId: 'W3', reviewerId: 'u_op', verdict: 'pass', note: '课程表完整。', at: at(4) }, { id: 'R3', taskId: 'T6', workId: 'W3', reviewerId: 'u_op', verdict: 'pass', note: '海报通过。', at: at(2) });
    s.events.push({ id: 'E13', at: at(1), workId: 'W3', actorType: 'system', actorId: 'system', action: 'work.status', from: 'active', to: 'acceptance', text: '任务全部完成，项目进入待验收' });
    s.workItems.push({ id: 'W4', ideaId: null, dept: 'd_ops', kind: 'other', ptype: '其他', title: 'Q3 财务复盘', goal: '输出 Q3 复盘报告', desc: '整理 Q3 数据，输出复盘报告。', keyResults: '复盘报告', priority: 'mid', status: 'done', stage: 'clarify', operatorId: 'u_op', leadId: null, reviewerId: 'u_op', externalLink: '', due: dateAddS(T0, -1), lastActivity: at(1.5), createdAt: at(25), milestones: [] });
    s.tasks.push({ id: 'T7', workId: 'W4', title: '整理 Q3 收支数据', ownerId: 'u_admin_ex', collabs: [], reviewerId: 'u_op', due: dateAddS(T0, -4), expected: '数据表', criteria: '与账目一致', status: 'done', blockedReason: '', lastActivity: at(3), createdAt: at(20), ttype: '文档' });
    s.reviews.push({ id: 'R4', taskId: 'T7', workId: 'W4', reviewerId: 'u_op', verdict: 'pass', note: '数据核对无误。', at: at(3) }, { id: 'R5', taskId: null, workId: 'W4', reviewerId: 'u_op', verdict: 'pass', note: '复盘报告已发。', at: at(1.5) });
    s.notifications.push({ id: 'N0', userId: 'u_owner', from: 'u_lead', title: '陈立 在任务里提到了你', body: '@Enos 麻烦你确认一下这个交互方案，看是否可行？', link: '#/task/T1', at: T0 - 3600000, read: false });
    s.notifications.push({ id: 'N5', userId: 'u_owner', from: 'system', title: '待办提醒：回复合作方邮件', body: '沟通 · 今天 18:00 截止', link: '#/tasks', at: at(1), read: true });
    s.notifications.push({ id: 'N6', userId: 'u_owner', from: 'u_lead', title: '团队邀请', body: '陈立 邀请你参与「门徒圈语音灵修」共创', link: '#/idea/I2', at: at(1.6), read: true });
    s.notifications.push({ id: 'N7', userId: 'u_owner', from: 'system', title: '项目进度更新', body: '「年会场地与物资准备」完成 50%', link: '#/work/W2', at: at(3), read: true });
    s.notifications.push({ id: 'N1', userId: 'u_owner', from: 'u_op', title: '新的待决策', body: '是否同意 11 月对外发布新版官网？', link: '#/idea/I4', at: at(0.3), read: false });
    s.notifications.push({ id: 'N2', userId: 'u_op', title: '有想法待认领', body: '办公室网络改用有线连接', link: '#/idea/I1', at: T0 - 3500000, read: false });
    s.notifications.push({ id: 'N3', userId: 'u_lead', title: '任务待你验收', body: '数据结构与本地存储方案', link: '#/task/T2', at: at(0.2), read: false });
    s.notifications.push({ id: 'N4', userId: 'u_op', title: '任务受阻', body: '确认年会场地并付定金', link: '#/task/T3', at: at(2), read: false });
    seedTodos(s, T0);
    return s;
  }
  function dateAddS(T0, days) { var d = new Date(T0 + days * DAY); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  return {
    L: L, STAGES: STAGES, TONE: TONE, DAY: DAY, act: act, seed: seed, user: user, name: name, hasRole: hasRole, canInitiate: canInitiate, usersWith: usersWith,
    primaryRole: primaryRole, TEMPLATES: TEMPLATES, allTemplates: allTemplates, REPEATS: REPEATS, nextDate: nextDate, NCATS: NCATS, ncat: ncat, activeUsers: activeUsers, live: live, openWorkOf: openWorkOf, followUsers: followUsers, canFollow: canFollow, leadUsers: leadUsers, briefStats: briefStats, canViewIdea: canViewIdea, canViewMedia: canViewMedia, canSeeMediaItem: canSeeMediaItem, canViewWork: canViewWork, canViewTask: canViewTask, canSuggest: canSuggest,
    latestSummary: latestSummary, deriveAnalysis: deriveAnalysis, noteOf: noteOf, decisionAdvice: decisionAdvice, aiTitle: aiTitle, ideaLocked: ideaLocked, discussionDigest: mockDigest, kbInit: kbInit, kbMatch: kbMatch, kbVisible: kbVisible, kbCan: kbCan, migrate: migrate, viewFor: viewFor, blank: blank, canCreateProject: canCreateProject, canAssign: canAssign, caps: caps, isStale: isStale, isOverdue: isOverdue, todayStr: todayStr, dateAdd: dateAdd, stageName: stageName,
    nextForTask: nextForTask, PTYPE: PTYPE, GROUPS: GROUPS, seedTodos: seedTodos, ensureTodos: ensureTodos, nextForIdea: nextForIdea, ideaProgress: ideaProgress, workProgress: workProgress, TT: TT
  };
})();
if (typeof module !== 'undefined') module.exports = TM;
