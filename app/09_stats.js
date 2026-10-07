/* app/09_stats.js — 首页数据卡详情页。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
  /* ---------- 首页四个数据卡的详情页 ---------- */
  var st = { decTab: 'pending', notif: 'all', due: 'all', period: 0 };
  function sHead(title, right) { return '<header class="p-head s-head"><button class="circle" data-do="back" aria-label="返回">' + hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button><div><h1>' + title + '</h1></div>' + (right || '<span style="width:44px"></span>') + '</header>'; }
  function deltaHTML(d, unit, badUp) { if (d == null) return '暂无对比'; if (d === 0) return '与上周持平'; var bad = badUp ? d > 0 : d < 0; return '较上周 <em class="' + (bad ? 'bad' : 'good') + '">' + (d > 0 ? '+' : '') + d + (unit || '') + hi(d > 0 ? 'up' : 'down', 2.6) + '</em>'; }
  function sHero(cls, icon, n, label, foot, deco, right) { return '<section class="s-hero ' + cls + '"><span class="s-hi">' + icon + '</span><div><b>' + n + '</b><span>' + label + '</span><small>' + foot + '</small></div>' + (right || '') + '<i class="s-deco" aria-hidden="true">' + deco + '</i></section>'; }
  var DECO = {
    bars: '<svg viewBox="0 0 90 70"><g fill="#FF8A95" opacity=".35"><rect x="4" y="40" width="10" height="30" rx="5"/><rect x="20" y="28" width="10" height="42" rx="5"/><rect x="36" y="18" width="10" height="52" rx="5"/><rect x="52" y="34" width="10" height="36" rx="5"/></g><circle cx="70" cy="20" r="18" fill="#FF8A95" opacity=".18"/><circle cx="70" cy="20" r="8" fill="#FF6B78" opacity=".3"/></svg>',
    bubble: '<svg viewBox="0 0 96 80"><path d="M48 6c22 0 40 13 40 29S70 64 48 64c-5 0-10-.7-14-2L16 72l5-14C13 52 8 44 8 35 8 19 26 6 48 6z" fill="#B9CFFF" opacity=".6"/><circle cx="34" cy="35" r="4" fill="#fff"/><circle cx="48" cy="35" r="4" fill="#fff"/><circle cx="62" cy="35" r="4" fill="#fff"/></svg>',
    cal: '<svg viewBox="0 0 96 90"><rect x="8" y="14" width="80" height="70" rx="12" fill="#A7E8C4" opacity=".55"/><rect x="8" y="14" width="80" height="18" rx="9" fill="#7FD8A8" opacity=".5"/><rect x="24" y="6" width="8" height="16" rx="4" fill="#7FD8A8" opacity=".7"/><rect x="64" y="6" width="8" height="16" rx="4" fill="#7FD8A8" opacity=".7"/><rect x="26" y="40" width="44" height="34" rx="6" fill="#fff" opacity=".85"/><path d="M38 57l7 7 13-14" stroke="#4CC98A" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  /* 1. 需要你决策 */
  function viewDecide() {
    var hs = homeStats()[0];
    if (!isOwner()) {
      var td2 = todoItems().filter(function (x) { return !x.done; });
      return sHead('等你处理') + sHero('s-red', ti('flag', 1.8), td2.length, '等你处理', deltaHTML(hs.delta, '', true), DECO.bars) + (td2.length ? '<section class="h-card">' + td2.map(todoRow).join('') + '</section>' : emptyBox('没有等你处理的事。'));
    }
    var pend = S.decisions.filter(function (d) { return d.status === 'pending'; }).sort(function (a, b) { return a.at - b.at; });
    var done = S.decisions.filter(function (d) { return d.status !== 'pending'; }).sort(function (a, b) { return (b.decidedAt || 0) - (a.decidedAt || 0); });
    var h = sHead('需要你决策', '<button class="circle s-more" data-do="sDecMore" aria-label="更多">' + ti('more', 1.6) + '</button>') + sHero('s-red', ti('flag', 1.8), pend.length, '需要你决策', deltaHTML(hs.delta, '', true), DECO.bars) +
      '<div class="s-seg"><button class="' + (st.decTab === 'pending' ? 'on' : '') + '" data-do="sDecTab" data-t="pending">待决策（' + pend.length + '）</button><button class="' + (st.decTab === 'done' ? 'on' : '') + '" data-do="sDecTab" data-t="done">已处理</button></div>';
    if (st.decTab === 'pending') {
      h += pend.length ? pend.map(function (dc, i) { return decCard(dc, i === 0); }).join('') : emptyBox('没有待决策的事。普通事项由运营者和负责人推进。');
      if (done.length) h += '<section class="s-hist"><div class="h-sec in"><h2>历史决策（' + done.length + '）</h2><button class="t-link s-blue" data-do="sDecTab" data-t="done">查看全部</button></div>' + done.slice(0, 3).map(histRow).join('') + '</section>';
    } else h += done.length ? '<section class="s-hist">' + done.map(histRow).join('') + '</section>' : emptyBox('还没有处理过的决策。');
    return h;
  }
  function decCard(dc, open) {
    var d = dc.ideaId ? I(dc.ideaId) : null, sm = d && TM.latestSummary(S, d.id, 'analysis'), u = TM.user(S, dc.requestedBy), wk = dc.workId ? W(dc.workId) : null;
    var ctx = (sm && sm.payload.background) || (d && d.note) || '';
    var rel = []; if (d) rel.push(['doc2', '想法：' + (d.title || '未命名'), '#/idea/' + d.id]); if (sm) rel.push(['spark', '整理稿 v' + sm.version + (sm.authorType === 'agent' ? '（AI 模拟）' : ''), '#/idea/' + d.id]);
    if (d) d.media.forEach(function (m) { rel.push([m.kind === 'audio' ? 'mic' : 'clip', m.name, '#/idea/' + d.id]); });
    S.workItems.filter(function (w) { return (d && w.ideaId === d.id) || (wk && w.id === wk.id); }).forEach(function (w) { rel.push(['proj', '项目：' + w.title, '#/work/' + w.id]); });
    return '<article class="s-dec"><a class="s-dec-h" href="' + (wk ? '#/work/' + wk.id : d ? '#/idea/' + d.id : '#/stat/decide') + '"><b>' + esc(dc.question) + '</b>' + hi('chev', 2) + '</a><div class="t-tags"><i class="k-blue">' + esc(L.decision[dc.kind]) + '</i><i class="k-red">高优先级</i></div>' +
      (open ? (ctx ? '<p class="s-ctx">' + esc(ctx) + '</p>' : '') + (rel.length ? '<h4>相关信息</h4><ul class="s-rel">' + rel.slice(0, 4).map(function (r) { return '<li><a href="' + r[2] + '">' + ai2(r[0], 1.7) + esc(r[1]) + '</a></li>'; }).join('') + '</ul>' : '') +
        '<h4>发起人</h4><div class="s-by">' + av(dc.requestedBy === 'agent' ? 'agent' : dc.requestedBy) + '<span><b>' + esc(TM.name(S, dc.requestedBy)) + '</b><small>' + esc(u ? u.title : 'AI 助理') + '</small></span><time>' + whenTxt(dc.at) + '</time></div>' +
        '<div class="s-btns"><a class="s-b2" href="' + (d ? '#/idea/' + d.id : '#/stat/decide') + '">更多信息</a><button class="s-b1" data-do="decide" data-arg="' + dc.id + '">去决策</button></div>' : '') + '</article>';
  }
  function whenTxt(t) { var d = new Date(t), n = new Date(); var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); if (d.toDateString() === n.toDateString()) return '今天 ' + hm; var y = new Date(n); y.setDate(n.getDate() - 1); if (d.toDateString() === y.toDateString()) return '昨天 ' + hm; return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm; }
  function histRow(dc) { var c = dc.status === 'approved' ? ['已通过', 'k-green'] : dc.status === 'rejected' ? ['已拒绝', 'k-red'] : ['要求补充', 'k-gray']; return '<a class="s-hrow" href="' + (dc.ideaId ? '#/idea/' + dc.ideaId : '#/stat/decide') + '" ' + (dc.ideaId ? '' : 'data-do="sDecInfo" data-id="' + dc.id + '"') + '>' + ai2('doc2', 1.6) + '<b>' + esc(dc.question.replace(/^是否/, '').replace(/[？?]$/, '')) + '</b><i class="' + c[1] + '">' + c[0] + '</i><time>' + mdTxt(new Date(dc.decidedAt || dc.at).toISOString().slice(0, 10)) + '</time></a>'; }
  /* 2. 未读通知 */
  function nCat(n) { return /@|提到了你|把你加进|邀请你/.test(n.title + n.body) ? 'at' : /评论|留言|建议/.test(n.title) ? 'cmt' : 'sys'; }
  function viewNotif() {
    var hs = homeStats()[1], un = S.notifications.filter(function (n) { return n.userId === me && !n.read; }).sort(function (a, b) { return b.at - a.at; });
    var C = [['all', '全部'], ['at', '@我'], ['cmt', '评论'], ['sys', '系统']];
    var rows = un.filter(function (n) { return st.notif === 'all' || nCat(n) === st.notif; });
    return sHead('未读通知', '<button class="circle s-more" data-do="readAll" aria-label="全部标为已读">' + ti('more', 1.6) + '</button>') + sHero('s-blue', ai2('at', 2), un.length, '未读通知', deltaHTML(hs.delta, '', true), DECO.bubble) +
      '<div class="t-filters s-chips">' + C.map(function (c) { var k = c[0] === 'all' ? un.length : un.filter(function (n) { return nCat(n) === c[0]; }).length; return '<button class="' + (st.notif === c[0] ? 'on' : '') + '" data-do="sNotif" data-f="' + c[0] + '">' + c[1] + '（' + k + '）</button>'; }).join('') + '</div>' +
      rows.map(function (n) { var cat = nCat(n); return '<a class="s-noti" href="' + esc(n.link || '#/inbox') + '" data-do="readOne" data-id="' + n.id + '">' + (n.from ? av(n.from) : '<span class="av agent">系</span>') + '<span class="s-nb"><span class="s-nh"><b>' + esc(n.from ? TM.name(S, n.from) : '系统') + '</b>' + (cat === 'at' ? '<i class="k-blue">@我</i>' : cat === 'cmt' ? '<i class="k-violet">评论</i>' : '') + '<time>' + ago(n.at) + '</time>' + hi('chev', 2) + '</span><span class="s-nt">' + esc(n.title) + '</span>' + (n.body ? '<span class="s-nbody">' + esc(n.body) + '</span>' : '') + '</span></a>'; }).join('') +
      '<div class="s-end">' + ti('inbox', 1.4) + '<p>' + (rows.length ? '没有更多未读通知了' : '这一类没有未读通知') + '</p><a href="#/inbox">查看全部通知</a></div>';
  }
  /* 3. 今天到期 */
  function dueItems() {
    var t0 = TM.todayStr(S), out = [];
    // 已逾期还没完成的也算「到期」，排在最前面（以前只数今天，逾期任务在这一页和任务页都看不到）
    scopeTasks().forEach(function (t) { if (t.due && t.due <= t0 && ['done', 'cancelled'].indexOf(t.status) < 0) { var w = W(t.workId); out.push({ kind: 'task', title: t.title, tags: [['任务', 'k-blue'], prTag(t.priority || prioOf(t.due, t.status === 'blocked'))], sub: w ? w.title : '', who: t.ownerId, time: t.due < t0 ? '已逾期' : '今天', href: '#/task/' + t.id }); } });
    TM.ensureTodos(S); S.todos.forEach(function (x) { if (x.ownerId === me && x.date === t0 && !x.done) out.push({ kind: 'task', title: x.title, tags: [['待办', 'k-gray'], prTag(x.priority)], sub: x.tags[0] ? '个人待办 · ' + x.tags[0] : '个人待办', who: x.people[0] || me, time: '今天' + (x.time ? ' ' + x.time : ''), href: '#/tasks', todo: x.id }); });
    vWork().forEach(function (w) { (w.milestones || []).forEach(function (m) { if (m.date === t0 && !m.done) out.push({ kind: 'ms', title: m.title, tags: [['里程碑', 'k-blue'], prTag(w.priority || 'mid')], sub: w.title, who: w.leadId || w.operatorId, time: '今天', href: '#/work/' + w.id }); }); });
    return out.sort(function (a, b) { return (b.time === '已逾期') - (a.time === '已逾期') || a.time.localeCompare(b.time); });
  }
  function prTag(p) { return p === 'hi' ? ['高优先级', 'k-red'] : p === 'lo' ? ['低优先级', 'k-gray'] : ['中优先级', 'k-orange']; }
  function viewDue() {
    var items = dueItems(), tasks = items.filter(function (x) { return x.kind === 'task'; }), ms = items.filter(function (x) { return x.kind === 'ms'; });
    var open = scopeTasks().filter(function (t) { return t.status !== 'done' && t.status !== 'cancelled'; }).length;
    var rows = st.due === 'task' ? tasks : st.due === 'ms' ? ms : items;
    return sHead('今天到期', '<button class="circle s-more" data-do="sDueMore" aria-label="更多">' + ti('more', 1.6) + '</button>') + sHero('s-green', ai2('cal', 1.8), items.length, '今天到期', (function () { var od = items.filter(function (x) { return x.time === '已逾期'; }).length, tk = items.filter(function (x) { return x.kind === 'task' && !/待办/.test((x.tags[0] || [])[0]); }).length; return '任务 ' + tk + (od ? '（已逾期 ' + od + '）' : '') + ' · 待办 ' + (tasks.length - tk) + ' · 里程碑 ' + ms.length; })(), DECO.cal) +
      '<div class="t-filters s-chips">' + [['all', '全部', items.length], ['task', '任务', tasks.length], ['ms', '项目里程碑', ms.length]].map(function (c) { return '<button class="' + (st.due === c[0] ? 'on' : '') + '" data-do="sDue" data-f="' + c[0] + '">' + c[1] + '（' + c[2] + '）</button>'; }).join('') + '</div>' +
      (rows.length ? '<section class="s-list">' + rows.map(function (x) { return '<div class="s-due">' + (x.todo ? '<button class="t-chk" data-do="tdToggle" data-id="' + x.todo + '" aria-label="标为完成"></button>' : '<span class="t-chk sys"></span>') + '<a href="' + x.href + '"><b>' + esc(x.title) + '</b><span class="t-tags">' + x.tags.map(function (g) { return '<i class="' + g[1] + '">' + g[0] + '</i>'; }).join('') + '</span><small>' + ai2(x.kind === 'ms' ? 'flagO' : 'doc2', 1.6) + esc(x.sub) + '</small></a><span class="s-dr">' + av(x.who, true) + '<time>' + esc(x.time) + '</time></span></div>'; }).join('') + '</section>' : emptyBox('今天没有到期的事。')) +
      '<button class="n-next s-fixed" data-do="sDueNew">' + ti('plus2', 2.4) + '新建任务</button>';
  }
  /* 4. 本周完成率 */
  function weekStart(off) { var d = new Date(); d.setHours(0, 0, 0, 0); var wd2 = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd2 - off * 7); return d; }
  function weekRate(off) {
    var sc = scopeTasks(), ws0 = weekStart(off).getTime(), we0 = ws0 + 7 * 864e5, passAt = {};
    S.reviews.forEach(function (r) { if (r.taskId && (r.verdict === 'pass' || r.verdict === 'owner_pass')) passAt[r.taskId] = Math.max(passAt[r.taskId] || 0, r.at); });
    var open = sc.filter(function (t) { return ['done', 'cancelled'].indexOf(t.status) < 0; }).length;
    var cnt = function (a, b) { return sc.filter(function (t) { return t.status === 'done' && passAt[t.id] >= a && passAt[t.id] < b; }).length; };
    var d0 = cnt(ws0, we0), d1 = cnt(ws0 - 7 * 864e5, ws0);
    var r0 = d0 + open ? Math.round(d0 / (d0 + open) * 100) : null, r1 = d1 + open ? Math.round(d1 / (d1 + open) * 100) : null;
    return { rate: r0, prev: r1, done: d0, open: open };
  }
  /* 流转速度（文档 1.2 成功标准）：想法提交到有人跟进、到派出第一个任务的平均时间；进行中任务里多久没动静的比例。只给老板和运营者看 */
  function flowCard() {
    if (!(isOwner() || TM.hasRole(S, me, 'operator'))) return '';
    var dur = function (ms) { if (ms == null) return '—'; var h = ms / 36e5; return h < 1 ? Math.max(1, Math.round(ms / 6e4)) + ' 分钟' : h < 48 ? (Math.round(h * 10) / 10) + ' 小时' : Math.round(h / 24) + ' 天'; };
    var avg = function (xs) { return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : null; };
    var since = Date.now() - 30 * 864e5, claim = [], first = [];
    vIdeas().forEach(function (d) { if (!d.submittedAt || d.submittedAt < since) return;
      var ce = S.events.filter(function (e) { return e.ideaId === d.id && (e.action === 'idea.claim' || e.action === 'idea.reassignFollower'); }).sort(function (a, b) { return a.at - b.at; })[0]; if (ce) claim.push(ce.at - d.submittedAt);
      var ws = S.workItems.filter(function (w) { return w.ideaId === d.id; }).map(function (w) { return w.id; }), ts = S.tasks.filter(function (t) { return ws.indexOf(t.workId) >= 0; }).map(function (t) { return t.createdAt; }).sort(); if (ts.length) first.push(ts[0] - d.submittedAt); });
    var prog = scopeTasks().filter(function (t) { return ['assigned', 'accepted', 'in_progress'].indexOf(t.status) >= 0; }), st = prog.filter(function (t) { return TM.isStale(S, t); }).length;
    var cell = function (v, l) { return '<div><b>' + v + '</b><small>' + l + '</small></div>'; };
    return '<section class="wd-card s-flow"><div class="wd-ph"><b>流转速度</b><small class="muted" style="font-size:12.5px">近 30 天</small></div><div class="s-flow-g">' +
      cell(dur(avg(claim)), '提交到有人跟进') + cell(dur(avg(first)), '提交到派出第一个任务') + cell(prog.length ? Math.round(st / prog.length * 100) + '%' : '—', S.settings.staleDays + ' 天以上没动静的任务') + '</div></section>';
  }
  function viewRate() {
    var sc = scopeTasks(), off = st.period, ws0 = weekStart(off).getTime(), we0 = ws0 + 7 * 864e5;
    var passAt = {}; S.reviews.forEach(function (r) { if (r.taskId && (r.verdict === 'pass' || r.verdict === 'owner_pass')) passAt[r.taskId] = Math.max(passAt[r.taskId] || 0, r.at); });
    var doneW = sc.filter(function (t) { return t.status === 'done' && passAt[t.id] >= ws0 && passAt[t.id] < we0; });
    var open = sc.filter(function (t) { return ['done', 'cancelled'].indexOf(t.status) < 0; });
    var inprog = open.filter(function (t) { return ['accepted', 'in_progress', 'submitted', 'owner_review', 'blocked'].indexOf(t.status) >= 0; }), notyet = open.filter(function (t) { return t.status === 'assigned'; });
    var total = doneW.length + open.length, rate = total ? Math.round(doneW.length / total * 100) : 0;
    var prevS = weekStart(off + 1).getTime(), prevDone = sc.filter(function (t) { return t.status === 'done' && passAt[t.id] >= prevS && passAt[t.id] < ws0; }).length;
    var prevRate = prevDone + open.length ? Math.round(prevDone / (prevDone + open.length) * 100) : 0, dlt = rate - prevRate;
    var pts = []; for (var i = 0; i < 7; i++) { var end = ws0 + (i + 1) * 864e5; if (off === 0 && ws0 + i * 864e5 > Date.now()) break; var c = doneW.filter(function (t) { return passAt[t.id] < end; }).length; pts.push(total ? c / total : 0); }
    if (pts.length < 3 || pts.every(function (v) { return v === pts[0]; })) pts = []; // 点太少或一条平线时不画（以前三个点像一个滑块）
    var W2 = 300, H2 = 80, line = pts.map(function (v, i) { return [10 + i * (W2 - 20) / 6, H2 - 8 - v * (H2 - 20)]; });
    var path = line.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var chart = '<svg class="s-line" viewBox="0 0 ' + W2 + ' ' + H2 + '" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="slg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8B5CF6" stop-opacity=".35"/><stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/></linearGradient></defs>' + (line.length > 1 ? '<path d="' + path + ' L' + line[line.length - 1][0] + ' ' + H2 + ' L10 ' + H2 + 'Z" fill="url(#slg)"/><path d="' + path + '" fill="none" stroke="#7C4DEB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' : '') + line.map(function (p, i) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i === line.length - 1 ? 5 : 3.5) + '" fill="' + (i === line.length - 1 ? '#fff' : '#7C4DEB') + '" stroke="#7C4DEB" stroke-width="2"/>'; }).join('') + '</svg>';
    if (!pts.length) chart = '<div class="s-pbar" aria-hidden="true"><span style="width:' + rate + '%"></span></div>'; // 没有变化曲线时：给一条进度条
    var days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    var perDay = days.map(function (_, i) { var ds = new Date(ws0 + i * 864e5), key = ds.getFullYear() + '-' + ('0' + (ds.getMonth() + 1)).slice(-2) + '-' + ('0' + ds.getDate()).slice(-2); var xs = sc.filter(function (t) { return t.due === key && t.status !== 'cancelled'; }); return { d: xs.filter(function (t) { return t.status === 'done'; }).length, p: xs.filter(function (t) { return inprog.indexOf(t) >= 0; }).length, n: xs.filter(function (t) { return t.status === 'assigned'; }).length }; });
    var mx = Math.max(1, Math.max.apply(null, perDay.map(function (x) { return x.d + x.p + x.n; })));
    var projs = vWork().filter(function (w) { return w.status !== 'cancelled'; }).map(function (w) { var p = TM.workProgress(S, w.id); return { w: w, p: p, pct: wPct(w) }; });
    var hiOpen = open.filter(function (t) { return t.priority === 'hi' || TM.isOverdue(S, t) || t.status === 'blocked'; }).length;
    var tip = (dlt > 0 ? '本周完成率较上周提升 ' + dlt + '%，继续保持！' : dlt < 0 ? '本周完成率较上周下降 ' + (-dlt) + '%，留意卡住的任务。' : '本周完成率与上周持平。') + (hiOpen ? '建议优先完成高优先级、逾期或受阻的 ' + hiOpen + ' 个任务。' : '目前没有高优先级积压。');
    return sHead('本周完成率', '<label class="s-period"><select data-speriod="1"><option value="0"' + (off === 0 ? ' selected' : '') + '>本周</option><option value="1"' + (off === 1 ? ' selected' : '') + '>上周</option></select>' + ai2('downc', 2) + '</label>') +
      sHero('s-purple', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3.1A9 9 0 1 0 20.9 13H11z" fill="currentColor"/><path d="M13 2.1V11h8.9A9 9 0 0 0 13 2.1z" fill="currentColor" opacity=".55"/></svg>', rate + '%', off ? '上周完成率' : '本周完成率', deltaHTML(dlt, '%', false), '', '<span class="s-frac">' + doneW.length + ' / ' + total + '</span>').replace('</section>', chart + '</section>').replace('s-hero s-purple', pts.length ? 's-hero s-purple' : 's-hero s-purple s-flat') +
      '<section class="wd-card"><div class="wd-ph"><b>任务完成情况</b><small class="muted" style="font-size:12.5px">按截止日</small></div><div class="s-legend"><span><i class="d-green"></i>已完成 <b>' + doneW.length + '</b></span><span><i class="d-blue"></i>进行中 <b>' + inprog.length + '</b></span><span><i class="d-gray"></i>未开始 <b>' + notyet.length + '</b></span></div>' +
      (perDay.every(function (x) { return !(x.d + x.p + x.n); }) ? '<p class="muted s-empty">这一周没有到截止日的任务。</p>' : '<div class="s-bars">' + perDay.map(function (x, i) { var h3 = function (v) { return Math.round(v / mx * 86); }; return '<div><span class="s-col"><i class="g" style="height:' + h3(x.d) + 'px"></i><i class="b" style="height:' + h3(x.p) + 'px"></i><i class="n" style="height:' + Math.max(x.d + x.p + x.n ? 0 : 6, h3(x.n)) + 'px"></i></span><small>' + days[i] + '</small></div>'; }).join('') + '</div>') + '</section>' +
      '<section class="wd-card"><div class="wd-ph"><b>按项目统计</b><a class="wd-link" href="#/work">查看全部</a></div>' + (projs.length ? '' : '<p class="muted s-empty">还没有项目。<a href="#/project">去新建一个</a></p>') + projs.map(function (x) { return '<a class="s-prow" href="#/work/' + x.w.id + '">' + wIcon(x.w) + '<span class="s-pn">' + esc(x.w.title) + '<i><em class="' + (x.pct >= 75 ? 'g' : '') + '" style="width:' + x.pct + '%"></em></i></span><span class="s-pp">' + x.pct + '%</span><span class="s-pf">' + x.p.done + '/' + x.p.total + '</span></a>'; }).join('') + '</section>' +
      flowCard() +
      '<section class="s-tip">' + ti('bulb', 1.7) + '<div><b>效率建议</b><p>' + esc(tip) + '</p></div><button class="t-link s-blue" data-do="quickAI">AI 建议' + hi('chev', 2) + '</button></section>';
  }
  var SD = {
    sDecTab: function (el) { st.decTab = el.dataset.t; render(); },
    sDecMore: function () { openSheet('决策', '<div class="wd-ops"><a class="btn block" href="#/ideas" data-do="sAwaiting">查看所有等决策的想法</a><a class="btn block" href="#/me">设置：老板确认范围</a></div>', '关闭', function () { closeSheet(); }); },
    sAwaiting: function () { filt.ideas = 'awaiting'; location.hash = '#/ideas'; return true; },
    sDecInfo: function (el) { var dc = S.decisions.find(function (x) { return x.id === el.dataset.id; }); openSheet('决策记录', '<div class="lead" style="font-size:17px">' + esc(dc.question) + '</div><p class="muted">' + esc(TM.name(S, dc.requestedBy)) + ' 上报，' + esc(L.decisionStatus[dc.status]) + '</p>' + (dc.note ? '<div class="callout">' + esc(dc.note) + '</div>' : ''), '关闭', function () { closeSheet(); }); },
    sNotif: function (el) { st.notif = el.dataset.f; render(); },
    sDue: function (el) { st.due = el.dataset.f; render(); },
    sDueMore: function () { location.hash = '#/tasks'; },
    sDueNew: function () { if (canAssign()) DO.goAssign(); else location.hash = '#/todo/new'; }
  };
