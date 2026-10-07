/* app/03_home.js — 首页。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
  /* ---------- 页面：首页 ---------- */
  /* ---------- 首页（按设计稿复刻） ---------- */
  var HI = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    bell: '<path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    bulb: '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v1h5v-1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5z"/><path d="M10.6 11.2l1.4 1.4 1.4-1.4"/>',
    plus: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8.5v7M8.5 12h7"/>',
    people: '<circle cx="9" cy="8.5" r="3"/><path d="M3.8 19c.8-2.9 2.7-4.4 5.2-4.4s4.4 1.5 5.2 4.4"/><path d="M15.2 5.8a3 3 0 0 1 0 5.4M16.8 14.8c1.7.5 2.9 1.9 3.4 4.2"/>',
    spark: '<path d="M11 4.5l1.6 4.4 4.4 1.6-4.4 1.6L11 16.5l-1.6-4.4-4.4-1.6 4.4-1.6z"/><path d="M18 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    flag: '<path d="M5.5 20.5V4.5"/><path d="M5.5 5h11.2a.6.6 0 0 1 .5.9L15 9.3l2.2 3.4a.6.6 0 0 1-.5.9H5.5"/>',
    at: '<circle cx="12" cy="12" r="3.6"/><path d="M15.6 12v1.4a2.5 2.5 0 0 0 5 0V12a8.6 8.6 0 1 0-3.4 6.8"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M3.5 10h17M8.5 3v3.5M15.5 3v3.5M9.3 15l1.9 1.8 3.6-3.6"/>',
    pie: '<path d="M12 3.5v8.5h8.5A8.5 8.5 0 1 1 12 3.5z"/><path d="M15 3.9a8.5 8.5 0 0 1 5.1 5.1H15z"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    up: '<path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/>', down: '<path d="M12 5v13M6.5 12.5L12 18l5.5-5.5"/>'
  };
  function hi(k, sw) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + HI[k] + '</svg>'; }
  function dayDiff(dateStr) { if (!dateStr) return null; var p = dateStr.split('-'), d = new Date(+p[0], p[1] - 1, +p[2]), t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 864e5); }
  function dueLabel(dateStr) {
    var n = dayDiff(dateStr); if (n == null) return { t: '无截止', bad: false };
    if (n < 0) return { t: '逾期 ' + (-n) + ' 天', bad: true }; if (n === 0) return { t: '今天', bad: false }; if (n === 1) return { t: '明天', bad: false };
    var p = dateStr.split('-'); return { t: +p[1] + '月' + +p[2] + '日', bad: false };
  }
  function prioOf(due, blocked) { var n = dayDiff(due); if (blocked || (n != null && n <= 0)) return 'hi'; if (n != null && n <= 3) return 'mid'; return 'lo'; }
  var PRIO = { hi: ['高优先级', 'p-hi'], mid: ['中优先级', 'p-mid'], lo: ['低优先级', 'p-lo'] };
  function isToday(t) { return new Date(t).toDateString() === new Date().toDateString(); }
  /* 「今日待办」= 下一步由我负责的所有事 + 我今天刚完成的事 */
  function todoItems() {
    var out = [];
    vTasks().forEach(function (t) {
      var nx = TM.nextForTask(S, t), w = W(t.workId); if (w && w.status === 'paused') return; // 项目暂停中：不算「待你处理」
      if (nx && nx.who === me) out.push({ title: (nx.what === '执行' ? '' : nx.what + '：') + t.title, tag: [L.kind[w.kind], w.kind === 'product' ? 'tg-blue' : 'tg-green'], prio: prioOf(t.due, t.status === 'blocked'), who: t.ownerId, due: dueLabel(t.due), href: '#/task/' + t.id, at: t.createdAt, date: actDate(t.due), comments: S.comments.filter(function (c) { return c.taskId === t.id; }).length, mine: t.ownerId === me, people: t.ownerId === me ? [] : [t.ownerId], kind: '任务' });
      // 我负责但受阻（下一步等别人解除）：仍出现在我的待办里，不然首页会说「都处理完了」、任务页看不到自己逾期的任务
      else if (nx && t.ownerId === me && t.status === 'blocked') out.push({ title: '受阻，等 ' + nm(nx.who) + ' 处理：' + t.title, tag: [L.kind[w.kind], w.kind === 'product' ? 'tg-blue' : 'tg-green'], prio: prioOf(t.due, true), who: t.ownerId, due: dueLabel(t.due), href: '#/task/' + t.id, at: t.createdAt, date: actDate(t.due), comments: S.comments.filter(function (c) { return c.taskId === t.id; }).length, mine: true, people: [], kind: '任务' });
      else if (t.status === 'done' && isToday(t.lastActivity) && (t.ownerId === me || t.reviewerId === me)) out.push({ done: true, title: t.title, tag: [L.kind[w.kind], w.kind === 'product' ? 'tg-blue' : 'tg-green'], prio: 'lo', who: t.ownerId, due: { t: '今天', bad: false }, href: '#/task/' + t.id, at: t.createdAt, date: TM.todayStr(S), doneAt: t.lastActivity, comments: 0, mine: t.ownerId === me, people: t.ownerId === me ? [] : [t.ownerId] });
    });
    if (isOwner()) S.decisions.filter(function (d) { return d.status === 'pending'; }).forEach(function (d) {
      out.push({ title: '决策：' + d.question, tag: ['决策', 'tg-purple'], prio: 'hi', who: d.requestedBy, due: { t: isToday(d.at) ? '今天' : ago(d.at), bad: false }, href: d.workId ? '#/work/' + d.workId : '#/idea/' + d.ideaId, at: d.at, date: TM.todayStr(S), comments: 0, mine: false, people: [d.requestedBy] });
    });
    vIdeas().forEach(function (d) {
      var nx = TM.nextForIdea(S, d);
      if (d.status === 'awaiting_owner') return;
      if (nx && (nx.who === me || (nx.queue && TM.canFollow(S, me)))) out.push({ title: nx.what + '：' + (d.title || d.note.slice(0, 16)), tag: ['想法', 'tg-purple'], prio: nx.queue || d.status === 'summary_ready' ? 'mid' : 'lo', who: d.creatorId, due: { t: ago(d.lastActivity), bad: false }, href: '#/idea/' + d.id, at: d.submittedAt || d.createdAt, date: TM.todayStr(S), comments: S.suggestions.filter(function (x) { return x.ideaId === d.id; }).length, mine: d.creatorId === me && d.status === 'draft', people: d.creatorId === me ? [] : [d.creatorId] });
    });
    vWork().forEach(function (w) {
      if ((w.status === 'planning' && w.leadId === me) || (w.status === 'acceptance' && w.reviewerId === me))
        out.push({ title: (w.status === 'planning' ? '安排任务：' : '确认完成：') + w.title, tag: ['项目', 'tg-blue'], prio: 'mid', who: w.operatorId, due: dueLabel(w.due), href: '#/work/' + w.id, at: w.createdAt, date: actDate(w.due), comments: 0, mine: false, people: [w.operatorId] });
    });
    var rank = { hi: 0, mid: 1, lo: 2 };
    return out.sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0) || rank[a.prio] - rank[b.prio]; });
  }
  function actDate(due) { var n = dayDiff(due); return n != null && n > 0 ? due : TM.todayStr(S); }
  function todoRow(x) {
    return '<a class="h-todo" href="' + x.href + '"><span class="h-chk' + (x.done ? ' on' : '') + '" aria-label="' + (x.done ? '已完成' : '未完成') + '"></span><span class="h-tt"><b>' + esc(x.title) + '</b><span class="h-tags"><i class="' + x.tag[1] + '">' + esc(x.tag[0]) + '</i>' + (x.done ? '' : '<i class="' + PRIO[x.prio][1] + '">' + PRIO[x.prio][0] + '</i>') + '</span></span>' +
      av(x.who) + '<span class="h-due' + (x.due.bad && !x.done ? ' bad' : '') + '">' + esc(x.due.t) + '</span>' + hi('chev', 2) + '</a>';
  }
  function inWeek(t, w) { var n = Date.now(); return t > n - (w + 1) * 7 * 864e5 && t <= n - w * 7 * 864e5; }
  function scopeTasks() { return vTasks().filter(function (t) { return isOwner() || t.ownerId === me || t.reviewerId === me || t.collabs.indexOf(me) >= 0 || (W(t.workId) || {}).operatorId === me || (W(t.workId) || {}).leadId === me; }); }
  function homeStats() {
    var todo = todoItems().filter(function (x) { return !x.done; });
    var s1 = isOwner() ? S.decisions.filter(function (d) { return d.status === 'pending'; }).length + vTasks().filter(function (t) { return t.status === 'owner_review'; }).length : todo.length;
    // 趋势和主数字同一口径：老板看「本周新来的决策请求」比上周；其他人看待办
    var src1 = isOwner() ? S.decisions : todo;
    var d1 = src1.filter(function (x) { return inWeek(x.at, 0); }).length - src1.filter(function (x) { return inWeek(x.at, 1); }).length;
    var ns = S.notifications.filter(function (n) { return n.userId === me && !n.read; }); // 未读通知：全部标为已读后趋势也归零
    var d2 = ns.filter(function (n) { return inWeek(n.at, 0); }).length - ns.filter(function (n) { return inWeek(n.at, 1); }).length;
    var sc = scopeTasks(), open = sc.filter(function (t) { return t.status !== 'done' && t.status !== 'cancelled'; });
    var dueToday = dueItems().length;
    var doneIn = function (w) { var ids = {}; S.reviews.forEach(function (r) { if (r.taskId && (r.verdict === 'pass' || r.verdict === 'owner_pass') && inWeek(r.at, w) && sc.some(function (t) { return t.id === r.taskId && t.status === 'done'; })) ids[r.taskId] = 1; }); return Object.keys(ids).length; };
    var w0 = doneIn(0), w1 = doneIn(1);
    var wr = weekRate(0), rate = wr.rate, rate1 = wr.prev;
    return [
      { k: 'decide', cls: 'st-red', icon: 'flag', n: s1, label: isOwner() ? '需要你决策' : '等你处理', delta: d1, bad: d1 > 0, unit: '' },
      { k: 'notif', cls: 'st-blue', icon: 'at', n: unread(), label: '未读通知', delta: d2, bad: d2 > 0, unit: '' },
      { k: 'due', cls: 'st-green', icon: 'cal', n: dueToday, label: '今天到期', foot: '共 ' + open.length + ' 项任务' },
      { k: 'rate', cls: 'st-purple', icon: 'pie', n: rate == null ? '—' : rate + '%', label: '本周完成率', delta: rate == null || rate1 == null ? null : rate - rate1, bad: rate != null && rate1 != null && rate < rate1, unit: '%' }
    ];
  }
  function statTile(x) {
    var foot = x.foot ? esc(x.foot) : x.delta == null ? '暂无对比' : x.delta === 0 ? '与上周持平' :
      '较上周 <em class="' + (x.delta > 0 ? 'up' : 'down') + '">' + (x.delta > 0 ? '+' : '') + x.delta + x.unit + hi(x.delta > 0 ? 'up' : 'down', 2.6) + '</em>';
    return '<a class="h-stat ' + x.cls + '" href="#/stat/' + x.k + '">' + hi(x.icon, 1.6) + '<b>' + x.n + '</b><span>' + esc(x.label) + '</span><small>' + foot + '</small></a>';
  }
  var COVERS = {
    product: '<svg viewBox="0 0 300 112" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="cg1" cx="55%" cy="40%" r="60%"><stop offset="0" stop-color="#2D6CDF" stop-opacity=".55"/><stop offset="1" stop-color="#0B1320" stop-opacity="0"/></radialGradient><linearGradient id="cs1" x1="0" x2="1"><stop offset="0" stop-color="#14325E"/><stop offset="1" stop-color="#3E8BEA"/></linearGradient></defs><rect width="300" height="112" fill="#0B121C"/><rect width="300" height="112" fill="url(#cg1)"/><path d="M95 18h120a6 6 0 0 1 6 6v62H89V24a6 6 0 0 1 6-6z" fill="#1A2433"/><rect x="96" y="25" width="118" height="56" rx="2" fill="url(#cs1)"/><path d="M104 70l14-12 10 6 16-18 14 10 16-14 14 8" stroke="#9FD0FF" stroke-width="2" fill="none" opacity=".9"/><g fill="#BFE0FF" opacity=".55"><rect x="104" y="33" width="34" height="3" rx="1.5"/><rect x="104" y="40" width="22" height="3" rx="1.5"/></g><path d="M70 86h170l14 10H56z" fill="#2A3442"/><rect x="0" y="96" width="300" height="16" fill="#070B11"/><circle cx="250" cy="40" r="9" fill="#1C2A3C"/><rect x="246" y="48" width="8" height="40" fill="#141E2B"/></svg>',
    community: '<svg viewBox="0 0 300 112" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="cg2" cx="45%" cy="30%" r="55%"><stop offset="0" stop-color="#F6C27A"/><stop offset=".45" stop-color="#7A4A26" stop-opacity=".7"/><stop offset="1" stop-color="#1A120D" stop-opacity="0"/></radialGradient></defs><rect width="300" height="112" fill="#17110D"/><rect width="300" height="112" fill="url(#cg2)"/><circle cx="135" cy="34" r="14" fill="#FFE2AE" opacity=".9"/><path d="M60 112c2-26 14-40 30-40s28 14 30 40z" fill="#2A1C14"/><circle cx="90" cy="58" r="13" fill="#3A281C"/><path d="M190 112c2-28 14-42 32-42s30 14 32 42z" fill="#24180F"/><circle cx="222" cy="56" r="14" fill="#33241A"/><rect x="146" y="58" width="22" height="14" rx="3" fill="#1E1611"/><path d="M157 72l-10 40M157 72l10 40M157 72v40" stroke="#1E1611" stroke-width="2.5"/></svg>',
    org: '<svg viewBox="0 0 300 112" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="cg3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFD3E6"/><stop offset="1" stop-color="#E9EEF3"/></linearGradient></defs><rect width="300" height="112" fill="url(#cg3)"/><path d="M0 92l40-22 40 14 50-26 60 30 50-20 60 18v26H0z" fill="#8FA4B5" opacity=".45"/><g><path d="M150 8h110v104H150z" fill="#F4F6F8"/>' + (function () { var r = ''; for (var y = 14; y < 106; y += 9) r += '<rect x="154" y="' + y + '" width="102" height="4" fill="#C7D3DE"/>'; return r; })() + '<path d="M150 8h12v104h-12z" fill="#DCE3EA"/></g><path d="M0 112v-14c20-8 40-6 60-2s40 0 60-4l30 2v18z" fill="#5D7A55" opacity=".8"/></svg>'
  };
  function coverFor(w) { return w.kind === 'product' ? COVERS.product : w.kind === 'admin' ? COVERS.org : COVERS.community; }
  var WSTAT = { active: '进行中', planning: '规划中', acceptance: '待验收', blocked: '受阻', paused: '暂停' };
  function projCard(w) {
    var p = TM.workProgress(S, w.id), pct = p.total ? Math.round(p.done / p.total * 100) : 0;
    var mem = [w.operatorId, w.leadId]; S.tasks.forEach(function (t) { if (t.workId === w.id) mem = mem.concat([t.ownerId], t.collabs); });
    mem = mem.filter(function (x, i) { return x && mem.indexOf(x) === i; });
    return '<a class="h-proj-card" href="#/work/' + w.id + '"><div class="h-cover">' + coverFor(w) + '<span class="s-' + w.status + '">' + (WSTAT[w.status] || L.work[w.status]) + '</span></div><div class="h-pbody"><b>' + esc(w.title) + '</b>' +
      '<div class="h-prog"><i class="k-' + w.kind + '"><em style="width:' + pct + '%"></em></i><span>' + pct + '%</span></div>' +
      '<div class="h-mem"><span class="h-stack">' + mem.slice(0, 3).map(function (u) { return av(u, true); }).join('') + '</span><small>' + p.total + ' 个任务 · ' + mem.length + ' 位成员</small></div></div></a>';
  }
  function greet() { var h = new Date().getHours(); return h < 5 ? '晚上好' : h < 11 ? '早上好' : h < 13 ? '中午好' : h < 18 ? '下午好' : '晚上好'; }
  function viewHome() {
    var u = TM.user(S, me), nU = unread(), p = PRES[u.presence || 'offline'];
    return '<section class="hm">' +
      '<header class="hm-top"><button class="hm-me" data-do="switch" aria-label="切换账号，当前 ' + esc(u.name) + '">' + av(me) + '<i style="background:' + p[1] + '"></i></button>' + '<span class="hm-mid">' + (SRV ? '' : '<span class="hm-demo">演示版</span>') + hmPending() + '</span>' + '<a class="hm-bell" href="#/inbox" aria-label="通知 ' + nU + ' 条未读">' + hi('bell', 1.8) + (nU ? '<i>' + nU + '</i>' : '') + '</a></header>' +
      '<div class="hm-copy"><small>FOR A GREATER MISSION</small><h1>用科技<br>让福音走得更远</h1>' +
      '<button class="hm-verse" data-do="hmVerse"><svg class="hm-q" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18v-5.5C4 8.4 6.2 6 10 5.5V8c-2 .4-3 1.7-3 4h3v6zm9.5 0v-5.5c0-4.1 2.2-6.5 6-7V8c-2 .4-3 1.7-3 4h3v6z" fill="currentColor"/></svg><span><b>' + esc(VERSES[hmV % VERSES.length][0]).replace('，', '，<br>') + '</b><small>— ' + VERSES[hmV % VERSES.length][1] + '</small></span>' + hi('chev', 2) + '</button></div>' +
      '<div class="hm-cards"><div class="hm-script" aria-hidden="true">Better<br>&nbsp;&nbsp;Together<svg viewBox="0 0 180 40"><path d="M4 38C60 22 120 10 176 2" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg></div>' + homeCards().map(function (k, i) { return '<button class="hm-card c' + (i + 1) + ' hc-' + k[0] + '" data-do="' + k[0] + '"><span class="hm-ic">' + k[1] + '</span><i class="hm-go">' + hi('chev', 2.2) + '</i><b>' + k[2] + '</b><small>' + k[3] + '</small></button>'; }).join('') + '</div>' +
      '<footer class="hm-foot"><i></i><p>微小的顺服，<br>可以带来永恒的改变。</p><small>SMALL STEPS · ETERNAL IMPACT</small></footer></section>';
  }
  // 首页第一屏的「待你处理」（文档 1.2 / 7.2）：老板 = 待决策 + 待终验；其他人 = 我的待办里没做完的
  function hmPending() {
    var n = isOwner() ? S.decisions.filter(function (d) { return d.status === 'pending'; }).length + vTasks().filter(function (t) { return t.status === 'owner_review'; }).length : todoItems().filter(function (x) { return !x.done; }).length;
    return n ? '<a class="hm-todo" href="' + (isOwner() ? '#/stat/decide' : '#/tasks') + '">待你处理 <b>' + n + '</b></a>' : '';
  }
  /* 首页两张卡片按角色给出：老板/发起人 记录想法+新建项目；运营者 整理想法+新建项目；执行者 我的待办+记待办；管理员 成员+知识库 */
  function homeCards() {
    var c = myCaps(), out = [];
    var nT = todoItems().filter(function (x) { return !x.done; }).length;
    var nTri = c.claimIdeas ? vIdeas().filter(function (d) { return d.status === 'triage' && !d.followerId; }).length : 0;
    if (c.recordIdea) out.push(['quickIdea', ai2('bulb', 1.5), '记录想法', '随时记录，激发灵感']);
    if (c.claimIdeas && !c.recordIdea) out.push(['hmTriage', ai2('bulb', 1.5), '整理想法', nTri ? nTri + ' 条新想法等你认领' : '暂时没有待认领的想法']);
    if (c.createProject) out.push(['quickProject', ti('plus2', 1.6), '新建项目', '从想法开始，落地执行']);
    if (c.assign) out.push(['quickAssign', ai2('person', 1.6), '分配任务', '让合适的人做合适的事']);
    if (!c.ideas) { if (c.members) out.push(['hmTeam', ai2('team', 1.6), '成员与账号', '添加成员、设置角色']); if (c.kbEdit) out.push(['hmKB', ai2('doc2', 1.6), 'AI 知识库', '维护老板思想与公司资料']); }
    out.push(['hmTasks', hi('cal', 1.6), '我的待办', nT ? nT + ' 件等你处理' : '今天的事都处理完了']);
    out.push(['hmTodo', ai2('edit', 1.6), '记一条待办', '提醒自己要做的事']);
    return out.slice(0, 2);
  }
  var VERSES = [['你们往普天下去，传福音给万民听。', '马可福音 16:15'], ['凡你手所当做的事，要尽力去做。', '传道书 9:10'], ['两个人总比一个人好，因为二人劳碌同得美好的果效。', '传道书 4:9'], ['你们要先求他的国和他的义，这些东西都要加给你们了。', '马太福音 6:33']];
  var hmV = 0;
  function homeTodos() {
    var t0 = TM.todayStr(S);
    return unified().filter(function (x) { return x.date <= t0 && (!x.done || isToday(x.doneAt || 0)); }).map(function (x) {
      var tag = x.tags.filter(function (g) { return g !== '高优先级'; })[0] || '待办';
      return { title: x.title, tag: [tag, tag === '决策' || tag === '想法' ? 'tg-purple' : tag === '产品' || tag === '项目' ? 'tg-blue' : 'tg-green'], prio: x.prio, who: x.people[0] || me, due: { t: x.time ? (x.date < t0 ? '逾期' : '今天 ') + x.time : x.timeLabel || '今天', bad: x.date < t0 }, href: x.sys ? x.href : '#/tasks', done: x.done };
    }).sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0) || ({ hi: 0, mid: 1, lo: 2 })[a.prio] - ({ hi: 0, mid: 1, lo: 2 })[b.prio]; });
  }
  function viewTodo() {
    var t = todoItems();
    return t.length ? t.map(todoRow).join('') : emptyBox('今天没有需要你处理的事。');
  }
  function viewTeam() {
    var h = '';
    S.users.forEach(function (u) {
      var ts = S.tasks.filter(function (t) { return t.ownerId === u.id && t.status !== 'done' && t.status !== 'cancelled'; });
      var vis = ts.filter(function (t) { return TM.canViewTask(S, me, t); });
      var bad = vis.filter(function (t) { return t.status === 'blocked' || TM.isOverdue(S, t); }).length;
      h += '<div class="row" style="cursor:default"><div class="t" style="justify-content:flex-start;align-items:center;gap:12px">' + av(u.id) + '<span style="flex:1">' + esc(nm(u.id)) + '<span class="muted" style="display:block;font-weight:400;font-size:13.5px">' + esc(u.title) + '，' + u.roles.map(function (a) { return L.role[a.role]; }).join('、') + '</span></span>' +
        (u.roles.some(function (a) { return a.role === 'admin' || a.role === 'owner'; }) ? '' : '<span class="pill ' + (bad ? 't-bad' : vis.length ? 't-prog' : 't-hold') + '">' + (vis.length ? '手上 ' + vis.length + ' 项' + (bad ? '，' + bad + ' 项需关注' : '') : '空闲') + '</span>') + '</div></div>';
    });
    return '<div class="list">' + h + '</div><p class="muted" style="font-size:13.5px;margin:12px 4px">只统计你有权限看到的任务。</p>';
  }
  var TF = [['mine', '我的任务'], ['review', '待我验收'], ['all', '全部可见']];
  function viewTasks() {
    var f = filt.tasks || 'mine';
    var ts = vTasks().filter(function (t) { return f === 'mine' ? (t.ownerId === me || t.collabs.indexOf(me) >= 0) && t.status !== 'cancelled' : f === 'review' ? t.reviewerId === me && t.status === 'submitted' : true; })
      .sort(function (a, b) { return (a.status === 'done') - (b.status === 'done') || byRecent(a, b); });
    return '<div class="chips">' + TF.map(function (x) { return '<button class="' + (f === x[0] ? 'on' : '') + '" data-do="tasksFilter" data-f="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      list(ts.map(function (t) { return taskRow(t); }), role() === 'admin' ? '管理员不参与任务。' : '这个分类下没有任务。');
  }
  function projSeg(on) { return '<div class="seg"><button class="' + (on === 'work' ? 'on' : '') + '" data-do="goWork">项目</button><button class="' + (on === 'ideas' ? 'on' : '') + '" data-do="goIdeas">想法</button></div>'; }
  /* 全局搜索：在自己能看到的数据里找（S 已按身份裁剪）。多个词同时匹配、不分大小写；结果按类别分组、片段里高亮命中的词 */
  function searchAll(raw) {
    var ks = String(raw || '').toLowerCase().split(/\s+/).filter(Boolean); if (!ks.length) return [];
    var vi = {}, vt = {}; vIdeas().forEach(function (d) { vi[d.id] = d; }); vTasks().forEach(function (t) { vt[t.id] = t; }); // 只在自己能看到的想法、任务里找留言和讨论
    var out = [], hit = function (txt) { var l = String(txt || '').toLowerCase(); return ks.every(function (k) { return l.indexOf(k) >= 0; }); };
    var add = function (g, title, text, href) { out.push({ g: g, title: title || '（未命名）', text: String(text || ''), href: href }); };
    vIdeas().forEach(function (d) { var sm = TM.latestSummary(S, d.id, 'analysis'), full = [d.title, TM.noteOf ? TM.noteOf(d) : d.note, (d.tags || []).join(' '), sm && sm.payload ? (sm.payload.summary || '') + ' ' + (sm.payload.goal || '') : ''].join(' '); if (hit(full)) add('想法', d.title, full, '#/idea/' + d.id); });
    S.suggestions.forEach(function (x) { var d = vi[x.ideaId]; if (d && hit(x.body)) add('讨论', d.title, nm(x.authorId) + '：' + x.body, '#/idea/' + d.id); });
    vWork().forEach(function (w) { var full = [w.title, w.goal, w.keyResults, (w.tags || []).join(' '), w.leadId ? nm(w.leadId) : '', nm(w.operatorId)].join(' '); if (hit(full)) add('项目', w.title, full, '#/work/' + w.id);
      (w.files || []).forEach(function (f) { if (hit(f.name)) add('文件', f.name, '项目「' + w.title + '」的文件', '#/work/' + w.id); }); });
    vTasks().forEach(function (t) { var full = [t.title, t.description, t.expected, t.criteria, nm(t.ownerId), (t.collabs || []).map(nm).join(' ')].join(' '); /* 带上执行人姓名：可以搜「何静 原型」 */ if (hit(full)) add('任务', t.title, full, '#/task/' + t.id); });
    var vw = {}; vWork().forEach(function (w) { vw[w.id] = w; });
    S.comments.forEach(function (c) { if (!hit(c.body)) return; var t = c.taskId && vt[c.taskId], w = !c.taskId && c.workId && vw[c.workId]; if (t) add('留言', '任务「' + t.title + '」', nm(c.authorId) + '：' + c.body, '#/task/' + t.id); else if (w) add('留言', '项目讨论「' + w.title + '」', nm(c.authorId) + '：' + c.body, '#/work/' + w.id); });
    (S.deliverables || []).forEach(function (f) { var t = vt[f.taskId]; if (!t) return; var full = [f.note, f.url, (f.media || []).map(function (m) { return m.name; }).join(' ')].join(' '); if (hit(full)) add('交付物', t.title, full, '#/task/' + t.id); });
    TM.ensureTodos(S); S.todos.forEach(function (x) { if ((x.ownerId === me || x.people.indexOf(me) >= 0) && hit(x.title + ' ' + (x.note || ''))) add('待办', x.title, x.note || '', '#/tasks'); });
    TM.activeUsers(S).forEach(function (u) { var full = [u.name, u.title, (u.skills || []).join(' '), u.group].join(' '); if (hit(full)) add('成员', u.name, [u.title, (u.skills || []).join('、')].filter(Boolean).join(' · '), '#/team'); });
    if (TM.kbVisible) TM.kbVisible(S, me).forEach(function (k) { if (hit(k.title + ' ' + k.body)) add('知识库', k.title, k.body, '#/kb/' + k.id); });
    return out;
  }
  // 片段：取第一个命中词前后各一段，命中的词高亮
  function snip(text, ks) {
    var t = String(text || '').replace(/\s+/g, ' '), l = t.toLowerCase(), at = -1;
    ks.forEach(function (k) { var i = l.indexOf(k); if (i >= 0 && (at < 0 || i < at)) at = i; });
    var a = Math.max(0, at - 18), part = (a ? '…' : '') + t.slice(a, a + 70) + (t.length > a + 70 ? '…' : '');
    var h = esc(part); ks.forEach(function (k) { var e = esc(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); h = h.replace(new RegExp('(' + e + ')', 'gi'), '<mark>$1</mark>'); }); return h;
  }
  function searchHTML(raw) {
    var ks = String(raw || '').toLowerCase().split(/\s+/).filter(Boolean); if (!ks.length) return '';
    var rs = searchAll(raw); if (!rs.length) return emptyBox('没有找到「' + esc(raw.trim()) + '」相关的内容。');
    var order = ['想法', '项目', '任务', '留言', '交付物', '文件', '讨论', '待办', '成员', '知识库'], h = '<p class="muted q-n">共 ' + rs.length + ' 条</p>';
    order.forEach(function (g) { var xs = rs.filter(function (r) { return r.g === g; }); if (!xs.length) return;
      h += '<h3 class="q-g">' + g + '<span>' + xs.length + '</span></h3><div class="list">' + xs.slice(0, 8).map(function (r) { return '<a class="row q-r" href="' + r.href + '"><b>' + snip(r.title, ks) + '</b>' + (r.text && r.text !== r.title ? '<small>' + snip(r.text, ks) + '</small>' : '') + '</a>'; }).join('') + (xs.length > 8 ? '<p class="muted q-more">还有 ' + (xs.length - 8) + ' 条，换个更具体的词试试</p>' : '') + '</div>'; });
    return h;
  }
  var QUICK = {
    quickIdea: function () { if (!TM.canInitiate(S, me)) return toast('只有老板和有发起权的负责人可以记录想法', true); DO.goNew(); },
    quickProject: function () { DO.goProject(); },
    quickAssign: function () { DO.goAssign(); },
    quickAI: function () {
      var xs = vIdeas().filter(function (d) { return TM.latestSummary(S, d.id, 'analysis') || d.aiStatus === 'failed'; });
      openSheet('AI 助手', '<div class="callout ai">AI 助手负责转写、整理、汇总共创和建议拆解；立项、派发、验收始终由人决定。演示版的输出由规则模拟，正式版接入真实大模型。</div>' +
        (xs.length ? '<div class="list">' + xs.slice(0, 6).map(function (d) { var sm = TM.latestSummary(S, d.id, 'analysis'); return '<a class="row" href="#/idea/' + d.id + '"><div class="t"><span>' + esc(d.title || '未命名') + '</span>' + (d.aiStatus === 'failed' ? '<span class="pill t-bad">AI 失败</span>' : '<span class="tag sim">整理稿 v' + sm.version + '</span>') + '</div><div class="m"><span>' + (sm ? esc(L.route[sm.payload.suggested_route] ? 'AI 建议：' + L.route[sm.payload.suggested_route] : '') : '可重试或手写') + '</span></div></a>'; }).join('') + '</div>' : emptyBox('还没有 AI 整理过的想法。')), '知道了', function () { closeSheet(); });
    },
    search: function () {
      openSheet('搜索', '<input type="search" id="q" placeholder="搜想法、项目、任务、留言、文件、成员…" autocomplete="off" enterkeyhint="search"><p class="muted q-tip">多个词用空格分开，会同时匹配。</p><div id="qr" class="mt"></div>', '关闭', function () { closeSheet(); });
      var q = document.getElementById('q'); q.focus(); var t0 = null;
      q.addEventListener('input', function () { clearTimeout(t0); t0 = setTimeout(function () { var r = document.getElementById('qr'); if (r) r.innerHTML = searchHTML(q.value); }, 120); });
    },
    tasksFilter: function (el) { filt.tasks = el.dataset.f; render(); },
    goWork: function () { location.hash = '#/work'; }, goIdeas: function () { location.hash = '#/ideas'; }
  };

  function membersHTML() {
    return sec('成员', S.users.length) + '<div class="list">' + S.users.map(function (u) {
      return '<div class="row" style="cursor:default"><div class="t" style="justify-content:flex-start;align-items:center">' + av(u.id) + '<span>' + esc(u.name) + ' <span class="muted" style="font-weight:400;font-size:14px">' + esc(u.title) + '</span></span></div><div class="m">' +
        // 角色、部门、可发起分成几个标签（以前用中点连成一串，加粗不好读）
        u.roles.map(function (a) { var d = (S.depts || []).find(function (x) { return x.id === a.dept; }); return '<span class="tag">' + L.role[a.role] + '</span>' + (d ? '<span class="tag soft">' + esc(d.name) + '</span>' : '') + (a.canInitiate ? '<span class="tag soft">可发起想法</span>' : ''); }).join('') + (u.inactive ? '<span class="tag soft">已停用</span>' : '') +
        (S.settings.showTiers && u.tier ? '<span class="tag">' + esc(u.tier) + '</span>' : '') + '</div></div>';
    }).join('') + '</div>';
  }

