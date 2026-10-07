/* app/13_work.js — 项目详情、会议拆任务。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
  /* ---------- 页面：项目 ---------- */
  var WF = [['active', '进行中'], ['planning', '待规划'], ['acceptance', '待验收'], ['done', '已完成']];
  var WST = { active: ['进行中', 'ws-blue'], blocked: ['受阻', 'ws-red'], paused: ['暂停', 'ws-gray'], planning: ['待规划', 'ws-orange'], acceptance: ['待验收', 'ws-gray'], done: ['已完成', 'ws-green'], cancelled: ['已取消', 'ws-gray'] };
  var WI = {
    product: ['wi-blue', '<rect x="5" y="6" width="14" height="12" rx="3" fill="#fff" opacity=".95"/><path d="M8 15l3-3 2 2 3-3" stroke="#5B8DEF" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'],
    admin: ['wi-teal', '<path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="3" fill="#fff"/>'],
    brand: ['wi-purple', '<path d="M12 18.5s-6.5-4-6.5-8.5A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 6.5 2c0 4.5-6.5 8.5-6.5 8.5z" fill="#fff"/>'],
    people: ['wi-orange', '<rect x="5" y="6.5" width="14" height="11" rx="3" fill="#fff"/><circle cx="12" cy="12" r="2.4" fill="#F97316"/>'],
    finance: ['wi-green', '<rect x="6" y="5" width="12" height="14" rx="3" fill="#fff"/><path d="M9 14l2 2 4-5" stroke="#16A34A" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>']
  };
  function wIcon(w, big) {
    var k = w.kind === 'product' ? 'product' : /行政|活动/.test(w.ptype || '') || w.kind === 'admin' ? 'admin' : /市场|内容|品牌/.test(w.ptype || '') ? 'brand' : /研究|学习|运营/.test(w.ptype || '') ? 'people' : 'finance';
    return '<span class="wi ' + WI[k][0] + (big ? ' big' : '') + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + WI[k][1] + '</svg></span>';
  }
  function wKindLabel(w) { return w.ptype ? w.ptype.replace(/事务|开发|推广|创作|优化|学习|策划/, '') || w.ptype : L.kind[w.kind]; }
  function wMembers(w) {
    var m = [w.leadId, w.operatorId, w.reviewerId]; S.tasks.forEach(function (t) { if (t.workId === w.id) m = m.concat([t.ownerId], t.collabs); });
    return m.filter(function (x, i) { return x && m.indexOf(x) === i; });
  }
  function wFlags(w) { return S.tasks.filter(function (t) { return t.workId === w.id && (t.status === 'blocked' || TM.isOverdue(S, t) || TM.isStale(S, t)); }).length; }
  function wPct(w) { var p = TM.workProgress(S, w.id); return w.status === 'done' ? 100 : p.total ? Math.round(p.done / p.total * 100) : 0; }
  function mdTxt(ds) { if (!ds) return '未设'; var p = ds.split('-'); return +p[1] + '月' + +p[2] + '日'; }
  function stdHero(o) {
    return '<section class="tk2-hero std-hero tk-compact" style="--hbg:' + (o.bg || 'var(--hero)') + ';--hpos:' + (o.pos || '60% 30%') + '"><header class="tk2-top">' + (o.back ? '<button class="tk-ic" data-do="back" aria-label="返回">' + hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button>' : '') + '<h1>' + o.title + '</h1>' + (o.pill || '') + '<span class="tk-sp"></span>' + o.actions + '</header></section>';
  }
  function projHeader(on) {
    var act = vWork().filter(function (w) { return ['active', 'blocked', 'paused'].indexOf(w.status) >= 0; }).length;
    return stdHero({ title: on === 'ideas' ? '想法' : '项目', bg: 'var(--homebg)', pos: '50% 22%', sub: '让想法落地，一步步推进。', verse: ['凡事都要规规矩矩地按着次序行。', '哥林多前书 14:40'], script: 'Step<br>&nbsp;by Step',
      actions: '<button class="tk-ic w-ic" data-do="search" aria-label="搜索">' + hi('search', 1.8) + '</button>' + (on === 'ideas' && !myCaps().recordIdea ? '' : '<button class="w-plus" data-do="' + (on === 'ideas' ? 'quickIdea' : 'wNew') + '" aria-label="' + (on === 'ideas' ? '记录想法' : '新建') + '">' + ti('plus2', 2.4) + '</button>'),
      pill: on === 'ideas' ? '' : '<button class="tk-month" data-do="workFilter" data-f="active">' + ai2('ops', 1.6) + '进行中 ' + act + ' 个' + ai2('downc', 1.8) + '</button>' }) +
      '';
  }
  function wPhoto(w) {
    var key = null; Object.keys(TM.PTYPE).forEach(function (k) { if (TM.PTYPE[k][0] === w.ptype) key = k; });
    if (!key) key = w.kind === 'product' ? 'product' : w.kind === 'admin' ? 'admin' : 'other';
    return { product: 'np-product', ops: 'np-ops', market: 'np-market', admin: 'wc-lake', event: 'wc-lake', content: 'wc-pen', research: 'np-research', training: 'np-training', mission: 'np-mission', care: 'np-care', finance: 'wc-desk', tech: 'np-tech', media: 'np-media', worship: 'np-worship', hr: 'np-hr', other: 'wc-desk' }[key] || 'wc-desk';
  }
  function wCard(w) {
    var p = TM.workProgress(S, w.id), pct = wPct(w), fl = wFlags(w), mem = wMembers(w), st = WST[w.status] || ['', 'ws-gray'];
    var left = p.total - p.done, meta = w.status === 'done' ? '已完成 ' + p.done + '/' + p.total : p.total ? (left ? left + ' 个任务未完成' : '任务已全部完成') : '还没有任务';
    return '<article class="w-card wc2"><a class="w-link" href="#/work/' + w.id + '" aria-label="' + esc(w.title) + '"></a><span class="wc-th ' + wPhoto(w) + '"></span><div class="wc-b"><div class="wc-top"><span class="ws ' + st[1] + '">' + st[0] + '</span>' + (fl && w.status !== 'done' ? '<span class="wc-flag">' + fl + ' 项需关注</span>' : '') + '<button class="w-more" data-do="wCardMore" data-id="' + w.id + '" aria-label="更多">' + ti('more', 1.6) + '</button></div>' +
      '<b class="wc-t">' + esc(w.title) + '</b><span class="wc-m">' + esc(wKindLabel(w)) + ' · ' + meta + '</span><p class="wc-d">' + esc(w.desc || w.goal || '') + '</p>' +
      '<div class="wc-f"><span class="h-stack">' + mem.slice(0, 3).map(function (u) { return av(u, true); }).join('') + (mem.length > 3 ? '<i class="w-more-n">+' + (mem.length - 3) + '</i>' : '') + '</span><span class="wc-pct">' + pct + '%</span><i class="wc-bar"><em class="' + (pct >= 100 ? 'g' : '') + '" style="width:' + pct + '%"></em></i></div></div></article>';
  }

  var WB = {
    active: ['进行中', '正在推进', '<circle cx="12" cy="12" r="8.5"/><path d="M10 8.8v6.4l5-3.2z"/>', 'ib-blue'],
    attention: ['需关注', '受阻、逾期或无动态', '<path d="M12 4.5l8.5 15h-17z"/><path d="M12 10v4.5M12 17.2v.1"/>', 'ib-red'],
    planning: ['待规划', '还没排任务', '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>', 'ib-amber'],
    acceptance: ['待验收', '等验收人确认', '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>', 'ib-violet'],
    done: ['已完成', '结果已交付', '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.4 2.4 4.6-5"/>', 'ib-green'],
    paused: ['已暂停', '老板暂停', '<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>', 'ib-gray'],
    cancelled: ['已取消', '不再推进', '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>', 'ib-gray'],
    all: ['全部项目', '所有你能看到的', '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>', 'ib-slate']
  };
  function workMatch(w, f) { return f === 'all' ? true : f === 'active' ? ['active', 'blocked'].indexOf(w.status) >= 0 : f === 'attention' ? ['done', 'cancelled'].indexOf(w.status) < 0 && wFlags(w) > 0 : w.status === f; }
  function workNeedsMe(w) {
    if (w.status === 'acceptance' && w.reviewerId === me) return true;
    if (w.status === 'planning' && (w.leadId === me || w.operatorId === me)) return true;
    if (['active', 'blocked'].indexOf(w.status) >= 0 && (w.leadId === me || w.operatorId === me) && wFlags(w) > 0) return true;
    return false;
  }
  function viewWork() {
    var f = filt.work && WB[filt.work] ? filt.work : filt.work === 'need' ? 'need' : 'active';
    var all = vWork().sort(byRecent), need = all.filter(workNeedsMe);
    var h = projHeader('work');
    if (role() === 'admin') return h + emptyBox('管理员看不到项目内容。');
    if (need.length) h += '<button class="ib-need" data-do="workFilter" data-f="need"><span class="ib-nic">' + ai2('flagO', 1.7) + '</span><span><b>有 ' + need.length + ' 个项目需要你处理</b><small>' + esc(need.slice(0, 2).map(function (w) { return w.title; }).join('、')) + (need.length > 2 ? ' 等' : '') + '</small></span>' + hi('chev', 2) + '</button>';
    h += '<div class="sc-row">' + ['active', 'attention', 'planning', 'acceptance', 'done', 'paused', 'cancelled', 'all'].map(function (k) {
      var x = WB[k], n = all.filter(function (w) { return workMatch(w, k); }).length, act = all.some(function (w) { return workMatch(w, k) && workNeedsMe(w); });
      if (!n && k !== 'active' && k !== 'all' && f !== k) return '';
      return '<button class="ib-tile sc-chip ' + x[3] + (f === k ? ' on' : '') + '" data-do="workFilter" data-f="' + k + '" aria-pressed="' + (f === k) + '">' + x[0] + '<i class="sc-n">' + n + '</i>' + (act && k !== 'all' ? '<i class="ib-dot"></i>' : '') + '</button>';
    }).join('') + '</div>';
    var ws = f === 'need' ? need : all.filter(function (w) { return workMatch(w, f); });
    h += '<div class="ib-head"><b>' + (f === 'need' ? '需要你处理' : WB[f][0]) + '</b><span>' + ws.length + ' 个</span>' + (canCreateProject() ? '<button data-do="quickProject">' + ti('plus2', 2) + '新建项目</button>' : '') + '</div>';
    return h + (ws.length ? ws.map(wCard).join('') : emptyBox('这个分类下没有项目。'));
  }

  var wd = { id: null, tab: 'ov', board: (function () { try { return localStorage.getItem('tm_wt_board') === '1'; } catch (e) { return false; } })() };
  function wEvText(e, t) {
    var tt = t ? '「' + t.title + '」' : '';
    var m = { 'work.done': '项目已完成', 'task.review.pass': '验收通过任务' + tt, 'task.review.return': '退回任务' + tt, 'task.submit': '提交了任务' + tt + '的成果', 'task.start': '开始任务' + tt, 'task.accept': '接收任务' + tt, 'task.block': '任务' + tt + '受阻', 'task.assign': '派出任务' + tt, 'idea.route': '项目创建', 'work.stage': e.text, 'work.update': e.text, 'work.status': e.text };
    return m[e.action] || e.text || e.action;
  }
  function viewWorkDetail(id) {
    var w = W(id);
    if (!w || !TM.canViewWork(S, me, w)) return '<header class="wd-top"><button class="wd-ic" data-do="back" aria-label="返回">' + hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button></header>' + emptyBox('这个项目不存在，或你没有查看权限。');
    if (wd.id !== id) wd = { id: id, tab: 'ov', tf: 'all' };
    var d = w.ideaId ? I(w.ideaId) : null, p = TM.workProgress(S, w.id), pct = wPct(w), st = WST[w.status] || ['', 'ws-gray'], mem = wMembers(w);
    var mg = w.leadId === me || w.operatorId === me || isOwner();
    var back = hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6');
    var h = '<header class="wx-top"><button class="wx-ic" data-do="back" aria-label="返回">' + back + '</button><span></span><button class="wx-ic" data-do="wMore" aria-label="更多">' + ti('more', 1.6) + '</button><button class="wx-ic" data-do="wShare" aria-label="分享">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg></button></header>' +
      '<section class="wx-hero"><span class="wx-logo">' + '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="14" rx="4" fill="#fff"/><path d="M7.5 15l3-3.2 2.3 2.2 3.7-4" stroke="#4F7BEF" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>' + '</span><div><h1>' + esc(w.title) + '</h1><div class="wx-chips"><i>' + esc(wKindLabel(w)) + '</i><i>' + esc(wStage(w)) + '阶段</i><span class="ws ' + st[1] + '">' + st[0] + '</span></div></div></section>' +
      ((w.desc || w.goal) ? '<p class="wx-desc">' + esc(w.desc || w.goal) + '</p>' : '') +
      (w.status === 'paused' ? '<div class="callout warn">老板已暂停这个项目，任务暂不能操作。</div>' : '') +
      (w.status === 'acceptance' && w.reviewerId === me ? '<div class="wd-accept"><span>任务已全部完成，等你确认项目完成</span><button data-do="closeWork">确认完成</button></div>' : '') +
      '<nav class="wx-tabs">' + [['ov', '概览'], ['tasks', '任务'], ['mem', '成员'], ['files', '文件'], ['log', '动态']].map(function (t) { return '<button class="' + (wd.tab === t[0] ? 'on' : '') + '" data-do="wTab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</nav>';
    var IC = function (path, color) { return '<svg viewBox="0 0 24 24" fill="none" stroke="' + (color || 'currentColor') + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>'; };
    if (wd.tab === 'ov') {
      var ts = S.tasks.filter(function (t) { return t.workId === w.id && t.status !== 'cancelled'; });
      var inprog = ts.filter(function (t) { return ['accepted', 'in_progress', 'submitted', 'owner_review', 'assigned'].indexOf(t.status) >= 0; }).length;
      var left = w.due ? dayDiff(w.due) : null;
      var ms = w.milestones || [], curIdx = ms.findIndex(function (m) { return !m.done; });
      var pri = w.priority || 'mid';
      var tags = (w.tags && w.tags.length ? w.tags : [wKindLabel(w)]);
      var row = function (icon, label, val) { return '<div class="wx-r"><span class="wx-ri">' + icon + '</span><span class="wx-rl">' + label + '</span><span class="wx-rv">' + val + '</span></div>'; };
      h += '<section class="wx-card"><div class="wx-sh"><b>' + IC('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6-6"/>') + '项目进度</b><strong>' + pct + '%</strong></div><div class="wx-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="wx-stats">' + [[p.total, '全部任务', '#9AA3B2'], [inprog, '进行中', '#3B82F6'], [p.done, '已完成', '#10B981'], [wFlags(w), '需关注', '#EF4444']].map(function (x) { return '<div><b>' + x[0] + '</b><i style="background:' + x[2] + '"></i><span>' + x[1] + '</span></div>'; }).join('') + '</div></section>' +
        '<section class="wx-card"><div class="wx-sh"><b>' + IC('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>') + '项目信息</b>' + (mg ? '<button class="wx-edit" data-do="wInfo">' + ai2('edit', 1.7) + '编辑</button>' : '') + '</div><div class="wx-grid"><div>' +
        row(IC('<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>'), '截止时间', w.due ? mdTxt(w.due) + (left != null && w.status !== 'done' ? '<small class="' + (left < 0 ? 'bad' : '') + '">' + (left >= 0 ? '剩 ' + left + ' 天' : '逾期 ' + (-left) + ' 天') + '</small>' : '') : '<em>未设置</em>') +
        row(IC('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', '#EF4444'), '优先级', '<span class="wx-pri p-' + pri + '">' + ({ hi: '高', mid: '中', lo: '低' })[pri] + '</span>') +
        row(IC('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v.5h5V16c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>'), '来源想法', d && TM.canViewIdea(S, me, d) ? '<a href="#/idea/' + d.id + '">' + esc(d.title) + '</a>' : '<em>手动创建</em>') +
        '</div><div>' +
        row(IC('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'), '项目目标', w.goal ? esc(w.goal) : '<em>未填写</em>') +
        row(IC('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'), '关键成果', w.keyResults ? esc(w.keyResults) : '<em>未填写</em>') +
        (w.externalLink ? row(IC('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'), '研发工具', '<a href="' + esc(w.externalLink) + '" class="wx-xl">' + esc(w.externalLink.replace(/^https?:\/\//, '').slice(0, 28)) + '</a>') : '') +
        row(IC('<path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.5 1.5 0 0 1 0 2.1l-7 7a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.3"/>'), '标签', '<span class="wx-tags">' + tags.map(function (t) { return '<i>' + esc(t) + '</i>'; }).join('') + (mg ? '<button data-do="wInfo" aria-label="编辑标签">+</button>' : '') + '</span>') +
        '</div></div></section>' +
        '<section class="wx-card"><div class="wx-sh"><b>' + IC('<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.6c2 .3 3.6 1.6 4.2 4"/>') + '项目成员（' + mem.length + '）</b><button class="wx-link" data-do="wTab" data-t="mem">管理' + hi('chev', 2) + '</button></div><div class="wx-mem">' +
        mem.slice(0, 6).map(function (u) { return '<div>' + av(u) + '<span><b>' + esc(nm(u)) + '</b><small>' + esc(memRole(w, u)) + '</small></span></div>'; }).join('') + (mg ? '<button class="wx-inv" data-do="goAssignWork" data-arg="' + w.id + '"><span>' + ti('plus2', 2.2) + '</span><small>邀请成员</small></button>' : '') + '</div></section>' +
        (ms.length || mg ? '<section class="wx-card"><div class="wx-sh"><b>' + IC('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>') + '里程碑</b>' + (mg ? '<button class="wx-link" data-do="wAddMs">添加' + hi('chev', 2) + '</button>' : '') + '</div>' +
        (ms.length ? '<ol class="wd-ms">' + ms.map(function (m, i) { var cls = m.done ? 'done' : i === curIdx ? 'cur' : ''; return '<li class="' + cls + '"><button class="wd-dot" ' + (mg ? 'data-do="wMs" data-mid="' + m.id + '" aria-label="' + (m.done ? '重新打开' : '标为完成') + '"' : 'disabled') + '></button><b>' + esc(m.title) + '</b><span>' + mdTxt(m.date) + '</span></li>'; }).join('') + '</ol>' : '<p class="wx-empty">还没有里程碑。</p>') + '</section>' : '');
      h += '<button class="wx-ask' + (wchatOpen[w.id] ? ' on' : '') + '" data-do="wcOpen"><span class="ix2-spark">' + hi('spark', 1.6) + '</span><span><b>问 AI</b><small>进度、分工、风险、下一步，随时问</small></span>' + hi('chev', 2) + '</button>' + wchatHTML(w) + workFlowHTML(w);
      var evs = S.events.filter(function (e) { return e.workId === w.id && (!e.taskId || (T(e.taskId) && TM.canViewTask(S, me, T(e.taskId)))); }).sort(function (x, y) { return y.at - x.at; }).slice(0, 3);
      h += '<section class="wx-card"><div class="wx-sh"><b>' + IC('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>') + '最新动态</b><button class="wx-link gray" data-do="wTab" data-t="log">查看全部' + hi('chev', 2) + '</button></div>' +
        (evs.length ? '<ol class="wx-tl">' + evs.map(function (e, i) { var t = e.taskId ? T(e.taskId) : null; return '<li class="' + (i ? '' : 'on') + '"><b>' + esc(wEvText(e, t)) + '</b><small>' + esc(e.actorType === 'human' ? nm(e.actorId) : e.actorType === 'agent' ? 'AI 助理' : '系统') + ' · ' + ago(e.at) + '</small></li>'; }).join('') + '</ol>' : '<p class="wx-empty">还没有动态。</p>') + '</section>';
      // 项目讨论：最近 20 条，成员可以发言（@姓名 会通知对方）
      var wcs = S.comments.filter(function (c) { return c.workId === w.id && !c.taskId; }).sort(function (x, y) { return x.at - y.at; }).slice(-20);
      h += '<section class="wx-card wx-disc"><div class="wx-sh"><b>' + IC('<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z"/>') + '项目讨论</b><small class="muted">' + wcs.length + ' 条</small></div>' +
        (wcs.length ? '<div class="wx-cm">' + wcs.map(function (c) { return '<div class="wx-c">' + av(c.authorId, true) + '<div><div class="wx-ch"><b>' + esc(nm(c.authorId)) + '</b><span>' + ago(c.at) + '</span></div><p>' + esc(c.body) + '</p></div></div>'; }).join('') + '</div>' : '<p class="muted" style="font-size:14px;margin:4px 2px 10px">还没有人发言。有问题、想法、进展，都可以在这里说，@姓名 会通知对方。</p>') +
        (w.status !== 'cancelled' ? '<form data-form="wComment" class="wx-cf"><textarea name="body" rows="2" maxlength="2000" placeholder="说点什么…（@姓名 提醒同事）" required></textarea><button class="btn pri" type="submit">发送</button></form>' : '') + '</section>';
    } else if (wd.tab === 'tasks') {
      h += wTasksTab(w);
    } else if (wd.tab === 'mem') {
      h += wMemTab(w, mg);
    } else if (wd.tab === 'files') {
      h += wFilesTab(w, d, mg);
    } else {
      var evs = S.events.filter(function (e) { return e.workId === w.id; });
      h += eventsHTML(evs) || emptyBox('还没有动态。');
    }
    return h;
  }
  function workFlowHTML(w) {
    var d = w.ideaId ? I(w.ideaId) : null, dv = !!(d && TM.canViewIdea(S, me, d));
    var ts = S.tasks.filter(function (t) { return t.workId === w.id && TM.canViewTask(S, me, t); });
    var evs = S.events.filter(function (e) { if (e.workId === w.id) { if (!e.taskId) return true; var t = T_(e.taskId); return t && TM.canViewTask(S, me, t); } return dv && e.ideaId === d.id && !e.workId && !e.taskId; })
      .map(function (e) { return flowMap(e, d); }).filter(Boolean).sort(function (x, y) { return x.at - y.at; });
    if (!evs.length) return '';
    var st = w.status === 'done' ? 5 : w.status === 'acceptance' ? 4 : ts.some(function (t) { return ['accepted', 'in_progress', 'submitted', 'owner_review', 'done', 'blocked'].indexOf(t.status) >= 0; }) ? 3 : 2;
    var tn = ts.map(function (t) { return TM.nextForTask(S, t); }).filter(Boolean)[0], hand = '';
    if (w.status === 'done') hand = '已全部完成';
    else if (w.status === 'paused') hand = '老板已暂停';
    else if (w.status === 'acceptance') hand = (w.reviewerId === me ? '你' : nm(w.reviewerId)) + '：确认项目完成';
    else if (tn) hand = (tn.who === me ? '你' : nm(tn.who)) + '：' + tn.what;
    else if (w.status === 'planning') hand = (w.leadId === me ? '你' : nm(w.leadId || w.operatorId)) + '：拆分任务';
    return flowRender(evs, st, hand).replace('ix2-card ix2-fold fl-card', 'ix2-card ix2-fold fl-card wx-flow');
  }
  /* 项目里的问 AI（规则模拟：基于本项目可见的任务、文件、动态和公司资料） */
  var wchat = {}, wchatOpen = {};
  function wchatAnswer(w, q) {
    var t = q.replace(/[？?。！!\s]/g, ''), li = function (a) { return '<ul>' + a.join('') + '</ul>'; };
    var ts = S.tasks.filter(function (x) { return x.workId === w.id && x.status !== 'cancelled' && TM.canViewTask(S, me, x); });
    var open = ts.filter(function (x) { return x.status !== 'done'; }), p = TM.workProgress(S, w.id), left = w.due ? dayDiff(w.due) : null;
    var flagOf = function (x) { return x.status === 'blocked' ? '受阻' + (x.blockedReason ? '：' + x.blockedReason : '') : TM.isOverdue(S, x) ? '已逾期' : TM.isStale(S, x) ? S.settings.staleDays + ' 天以上没动静' : ''; };
    var tl = function (x) { return '<li>' + esc(x.title) + '<em>' + esc(nm(x.ownerId)) + ' · ' + esc(L.task[x.status] || '') + '</em></li>'; };
    if (/进度|到哪|状态|多少|完成了|情况/.test(t)) return { html: '<p>完成 <b>' + p.done + '/' + p.total + '</b> 项任务（' + wPct(w) + '%），当前在<b>' + esc(wStage(w)) + '</b>阶段。' + (left == null ? '' : left >= 0 ? '离截止还有 ' + left + ' 天。' : '已超过截止 ' + (-left) + ' 天。') + '</p>' + (open.length ? '<p>还没完成的：</p>' + li(open.slice(0, 5).map(tl)) : ''), src: ['任务'] };
    if (/谁|分工|在做|负责|成员/.test(t)) { var by = {}; open.forEach(function (x) { (by[x.ownerId] = by[x.ownerId] || []).push(x.title); }); var ks = Object.keys(by); return { html: '<p>负责人 <b>' + esc(w.leadId ? nm(w.leadId) : '未设') + '</b>，跟进运营 <b>' + esc(w.operatorId ? nm(w.operatorId) : '未设') + '</b>。</p>' + (ks.length ? '<p>手上有任务的：</p>' + li(ks.map(function (u) { return '<li><b>' + esc(nm(u)) + '</b>：' + esc(by[u].join('、')) + '</li>'; })) : '<p>目前没有进行中的任务。</p>'), src: ['任务', '成员'] }; }
    if (/风险|卡|受阻|逾期|关注|问题|担心/.test(t)) { var fl = open.filter(flagOf); return { html: fl.length ? '<p>有 ' + fl.length + ' 项需要关注：</p>' + li(fl.map(function (x) { return '<li>' + esc(x.title) + '<em>' + esc(nm(x.ownerId) + ' · ' + flagOf(x)) + '</em></li>'; })) : '<p>目前没有受阻、逾期或长期没动静的任务。</p>' + (left != null && left >= 0 && left <= 3 && open.length ? '<p>不过离截止只剩 ' + left + ' 天，还有 ' + open.length + ' 项没完成，要盯紧。</p>' : ''), src: ['任务'] }; }
    if (/下一步|接下来|怎么办|该做|建议/.test(t)) { var nx = open.map(function (x) { var n = TM.nextForTask(S, x); return n ? '<li>' + esc((n.who === me ? '你' : nm(n.who)) + ' ' + n.what + '「' + x.title + '」') + '</li>' : ''; }).filter(Boolean); if (w.status === 'planning' && !ts.length) nx.unshift('<li>' + esc(nm(w.leadId || w.operatorId)) + ' 先拆分任务</li>'); if (w.status === 'acceptance') nx.unshift('<li>' + esc(nm(w.reviewerId)) + ' 确认项目完成</li>'); return { html: nx.length ? '<p>接下来：</p><ol>' + nx.slice(0, 6).join('') + '</ol>' : '<p>项目没有待办的下一步了。</p>', src: ['任务'] }; }
    if (/文件|附件|交付|资料在哪|文档/.test(t)) { var fs = (w.files || []).map(function (f) { return '<li>' + esc(f.name) + '<em>' + esc(nm(f.by)) + ' 上传</em></li>'; }).concat(S.deliverables.filter(function (f) { return ts.some(function (x) { return x.id === f.taskId; }); }).map(function (f) { return '<li>' + esc(f.note || f.url) + '<em>交付物</em></li>'; })); return { html: fs.length ? '<p>项目里有 ' + fs.length + ' 份文件：</p>' + li(fs.slice(0, 6)) + '<p class="muted">在「文件」标签页可以打开或上传。</p>' : '<p>项目里还没有文件，可以在「文件」标签页上传。</p>', src: ['文件'] }; }
    if (/资料|规定|制度|原则|公司|老板怎么看|价值观/.test(t)) { var r = TM.kbMatch(S, w.title + ' ' + (w.goal || '') + ' ' + q, 3); return { html: r.length ? '<p>公司资料里相关的内容：</p>' + refsHTML(r, '') : '<p>AI 知识库里没有找到相关资料。可以去「我的 → AI 知识库」补充。</p>', src: ['AI 知识库'] }; }
    if (/总结|概括|汇报|梳理/.test(t)) { var f2 = open.filter(flagOf).length; return { html: '<p><b>' + esc(w.title) + '</b>：' + esc(w.goal || '') + '</p><p>任务 ' + p.done + '/' + p.total + ' 完成，' + open.length + ' 项进行中' + (f2 ? '，' + f2 + ' 项需关注' : '') + '。' + (left == null ? '' : left >= 0 ? '剩 ' + left + ' 天。' : '已逾期 ' + (-left) + ' 天。') + '</p>', src: ['任务'] }; }
    var bi = []; t.replace(/AI|ai|我们|这个|一下|关于|有没有|什么|怎么|吗|呢|的/g, ' ').split(/\s+/).forEach(function (x) { for (var i = 0; i < x.length - 1; i++) bi.push(x.slice(i, i + 2)); });
    var hit = ts.filter(function (x) { return bi.some(function (b) { return x.title.indexOf(b) >= 0; }); }), kr = TM.kbMatch(S, q, 2);
    if (hit.length || kr.length) return { html: (hit.length ? '<p>相关的任务：</p>' + li(hit.slice(0, 4).map(tl)) : '') + (kr.length ? refsHTML(kr, '公司资料') : ''), src: hit.length ? ['任务'] : ['AI 知识库'] };
    return { html: '<p>这个问题我在项目里没找到直接的内容。可以试试问：「现在进度如何」「谁在做什么」「有哪些风险」「下一步做什么」「公司资料怎么说」。</p>', src: [] };
  }
  function wchatHTML(w) {
    if (!wchatOpen[w.id]) return '';
    var ms = wchat[w.id] || [], chips = ['现在进度如何', '谁在做什么', '有哪些风险', '下一步做什么', '项目有哪些文件'];
    return '<div class="ic-panel wx-icp" id="wc-panel"><div class="ic-hd"><span class="ix2-spark">' + hi('spark', 1.6) + '</span><b>问 AI</b><small>基于这个项目的任务、文件和公司资料回答</small><button class="ic-x" data-do="wcClose" aria-label="收起对话">×</button></div>' +
      '<div class="ic-list" id="wc-list">' + (ms.length ? ms.map(function (m) { return m.me ? '<div class="ic-q">' + esc(m.text) + '</div>' : '<div class="ic-a">' + m.html + (m.src && m.src.length ? '<span class="ic-src">依据：' + esc(m.src.join('、')) + '</span>' : '') + '</div>'; }).join('') : '<p class="ic-hi">关于「' + esc(w.title) + '」想问什么？</p>') + '</div>' +
      '<div class="ic-chips">' + chips.map(function (c) { return '<button data-do="wcAsk" data-q="' + c + '">' + c + '</button>'; }).join('') + '</div>' +
      '<div class="ic-in"><input type="text" id="wc-q" maxlength="80" placeholder="输入问题，或点话筒说话"><button class="ic-mic" data-do="wcMic" aria-label="语音提问">' + ai2('mic', 1.8) + '</button><button class="ic-go" data-do="wcSend" aria-label="发送"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div><p class="ix2-advf">AI 模拟回答，按关键词从项目任务和资料里找答案。</p></div>';
  }
  function wcPush(w, q) {
    if (AI_ON) return aiChatPush(wchat, w.id, '关于项目「' + w.title + '」（' + L.work[w.status] + '，负责人 ' + (w.leadId ? nm(w.leadId) : '无') + '，跟进 ' + (w.operatorId ? nm(w.operatorId) : '无') + '，截止 ' + (w.due || '未定') + '）。目标：' + (w.goal || ''), q, function () { return wchatAnswer(w, q); }, function () { setTimeout(function () { var l = document.getElementById('wc-list'); if (l) l.scrollTop = l.scrollHeight; }, 30); }, { type: 'work', id: w.id });
    var a2 = wchatAnswer(w, q); (wchat[w.id] = wchat[w.id] || []).push({ me: true, text: q }, { html: a2.html, src: a2.src }); render(); setTimeout(function () { var l = document.getElementById('wc-list'); if (l) l.scrollTop = l.scrollHeight; }, 30); }
  /* 任务 / 成员 / 文件 标签页 */
  var WTF = [['all', '全部'], ['doing', '进行中'], ['review', '待验收'], ['done', '已完成'], ['flag', '需关注']];
  function wtFlag(t) { return t.status === 'blocked' || TM.isOverdue(S, t) || TM.isStale(S, t); }
  function wtIn(f, t) { return f === 'all' ? true : f === 'doing' ? ['assigned', 'accepted', 'in_progress', 'blocked'].indexOf(t.status) >= 0 : f === 'review' ? ['submitted', 'owner_review'].indexOf(t.status) >= 0 : f === 'done' ? t.status === 'done' : wtFlag(t) && ['done', 'cancelled'].indexOf(t.status) < 0; }
  function wTaskRow(t) {
    var od = TM.isOverdue(S, t), fl = wtFlag(t) && ['done', 'cancelled'].indexOf(t.status) < 0, nx = TM.nextForTask(S, t);
    var cl = S.checklist.filter(function (c) { return c.taskId === t.id; }), cd = cl.filter(function (c) { return c.done; }).length;
    var meta = ['<span class="wt-who">' + av(t.ownerId, true) + esc(nm(t.ownerId)) + '</span>'];
    if (t.due) meta.push('<span' + (od && t.status !== 'done' ? ' class="r"' : '') + '>' + esc(dueTxt(t.due)) + '</span>');
    if (cl.length) meta.push('<span>清单 ' + cd + '/' + cl.length + '</span>');
    if (t.status === 'blocked') meta.push('<span class="r">受阻' + (t.blockedReason ? '：' + esc(t.blockedReason) : '') + '</span>');
    else if (TM.isStale(S, t) && t.status !== 'done') meta.push('<span class="r">' + S.settings.staleDays + ' 天无动态</span>');
    return '<a class="row wt' + (fl ? ' wt-f' : '') + '" href="#/task/' + t.id + '"><span class="wt-t"><b>' + esc(t.title) + '</b>' + pill('task', t.status) + '</span><span class="wt-m">' + meta.join('') + '</span>' +
      (nx && t.status !== 'done' ? '<span class="wt-n">下一步：' + esc(nx.who === me ? '你' : nm(nx.who)) + ' ' + esc(nx.what) + '</span>' : '') + '</a>';
  }
  /* ---------- 会议拆任务：会议录音或纪要 → AI 拆成任务（谁、做什么、什么时候）→ 核对后一次派出 ---------- */
  function canPlanWork(w) { return !!w && ['done', 'cancelled', 'paused'].indexOf(w.status) < 0 && (isOwner() || w.leadId === me || (w.kind !== 'product' && w.operatorId === me)); }
  var mt = { wid: null, text: '', items: null, rec: null, busy: false };
  // 规则版（没有 AI 时）：按句子找「人名 + 要做的事 + 时间」
  function mtParse(text, w) {
    var ppl = TM.activeUsers(S).filter(function (u) { return !u.roles.every(function (a) { return a.role === 'admin'; }); });
    var VERB = /(做|出|写|准备|联系|确认|采购|买|订|安排|整理|提交|设计|开发|测试|上线|发布|对接|跟进|核对|统计|汇总|通知|布置|搭建|印|拍|剪辑|修改|完善|落实|负责)/;
    var out = [], prev = null;
    String(text || '').split(/[。；;！!？?\n：:]+/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length >= 4; }).forEach(function (sen) {
      sen.split(/[，,]?(?:另外|然后|还有|再由|再让)/).forEach(function (c) {
        c = c.trim(); if (out.length >= 10 || c.length < 4) return;
        var who = ppl.filter(function (u) { return c.indexOf(u.name) >= 0; })[0], last = prev; prev = null;
        /* 没提到人、只补了时间的半句（「张伟联系酒店：下周五前签好合同」）：并进上一个任务，当它的截止时间 */
        if (!who && last && !last.due && /(今天|明天|后天|下周|这周|本周|周[一二三四五六日天]|星期[一二三四五六日天]|\d{1,2}月\d{1,2}[日号])/.test(c)) {
          var more = c.replace(/(今天|明天|后天|(下|这|本)?(周|星期)[一二三四五六日天]|\d{1,2}月\d{1,2}[日号])(之前|以前|前)?/g, '').replace(/^(请|就|先|再|然后|并且|要|把)+/, '').replace(/^[，,、\s]+|[，,、\s]+$/g, '');
          last.due = parseWhen(c).date; if (more.length >= 2) last.title = (last.title + '，' + more).slice(0, 40); return;
        }
        if (!who && !VERB.test(c)) return;
        var hasDate = /(今天|明天|后天|下周|这周|本周|周[一二三四五六日天]|星期[一二三四五六日天]|\d{1,2}月\d{1,2}[日号])/.test(c);
        var title = c.replace(who ? new RegExp('(由|让|请|麻烦)?' + who.name + '(来|去|负责|那边)?') : /^$/, '').replace(/(今天|明天|后天|(下|这|本)?(周|星期)[一二三四五六日天]|\d{1,2}月\d{1,2}[日号])(之前|以前|前)?/g, '').replace(/^(请|由|让|麻烦|就|先|再|然后|并且|我们|大家)+/, '').replace(/^[，,、\s]+|[，,、\s]+$/g, '').slice(0, 40);
        if (title.length < 3) return;
        prev = { title: title, ownerId: who ? who.id : '', due: hasDate ? parseWhen(c).date : '', expected: '', criteria: '', on: true }; out.push(prev);
      });
    });
    return out;
  }
  /* AI 拆出的任务没带时间时（小模型常漏）：用规则识别出的同一负责人、标题最像的那条的时间补上 */
  function mtFillDue(items, rule) {
    var sim = function (a, b) { var n = 0; for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) >= 0) n++; return n; };
    items.forEach(function (x) {
      if (x.due) return;
      var best = null, bs = 0; rule.forEach(function (r) { if (!r.due || (x.ownerId && r.ownerId && r.ownerId !== x.ownerId)) return; var v = sim(x.title, r.title) + (r.ownerId === x.ownerId ? 2 : 0); if (v > bs) { bs = v; best = r; } });
      if (best && bs >= 3) x.due = best.due;
    });
  }
  /* 两个任务标题像不像：一个包含另一个（≥4 字），或者公共字占短的那个六成以上 */
  function mtSimilar(a, b) {
    a = String(a || '').replace(/[\s，,。.、：:；;！!？?「」『』（）()]/g, ''); b = String(b || '').replace(/[\s，,。.、：:；;！!？?「」『』（）()]/g, '');
    if (a.length < 2 || b.length < 2) return false;
    var sh = a.length <= b.length ? a : b, lg = sh === a ? b : a;
    if (sh.length >= 4 && lg.indexOf(sh) >= 0) return true;
    var n = 0, used = {}; for (var i = 0; i < sh.length; i++) { var j = lg.indexOf(sh[i]); while (j >= 0 && used[j]) j = lg.indexOf(sh[i], j + 1); if (j >= 0) { used[j] = 1; n++; } }
    return sh.length >= 3 && n / sh.length >= 0.6 && n >= 3;
  }
  /* 核对拆出的任务：和项目里已有的（未结束）任务重复的，标出来并默认不勾；AI 给的时间和规则识别出的不一致时，标出来请人核对 */
  function mtFlag(items, w, rule) {
    var open = S.tasks.filter(function (t) { return t.workId === w.id && ['done', 'cancelled'].indexOf(t.status) < 0; });
    items.forEach(function (x, i) {
      var d = open.filter(function (t) { return mtSimilar(x.title, t.title); })[0];
      if (!d) for (var k = 0; k < i; k++) if (items[k].on !== false && mtSimilar(x.title, items[k].title)) { d = { title: items[k].title, self: true }; break; }
      x.dup = d ? d.title : ''; if (d) x.on = false;
      x.dueAlt = '';
      if (x.due && rule) { var best = null, bs = 0; rule.forEach(function (r) { if (!r.due || r.due === x.due) return; var v = (mtSimilar(x.title, r.title) ? 3 : 0) + (r.ownerId && r.ownerId === x.ownerId ? 2 : 0); if (v > bs) { bs = v; best = r; } }); if (best && bs >= 3) x.dueAlt = best.due; }
    });
    return items;
  }
  function mtOwnerDefault(w) { var ex = TM.usersWith(S, 'executor'); return w.kind === 'product' && w.leadId ? (ex[0] || w.leadId) : (ex[0] || w.operatorId); }
  function mtBody() {
    var w = W(mt.wid), ppl = TM.activeUsers(S).filter(function (u) { return !u.roles.every(function (a) { return a.role === 'admin'; }); });
    if (!mt.items) return '<p class="muted" style="margin:0 0 8px;font-size:14px">把会议录音或会议纪要交给 AI，它会找出「谁、做什么、什么时候」，你核对后一次派出去。</p>' +
      '<textarea id="mt-text" rows="7" placeholder="例如：周五前刘洋把报名页面做出来；何静下周一给出海报初稿；场地由周敏这周确认，预算不超过 3000。">' + esc(mt.text) + '</textarea>' +
      '<div class="mt-row">' + (canSrvTr() || TR_ON || (typeof TMS !== 'undefined' && TMS.loggedIn && TMS.loggedIn()) ? '<button type="button" class="btn" data-do="mtRec">' + (mt.rec ? '■ 停止录音（' + '<span id="mt-sec">0</span> 秒）' : ni('mic', 1.6) + ' 录一段会议') + '</button>' + (mt.rec ? '' : '<label class="btn">' + ai2('doc2', 1.6) + ' 上传录音<input type="file" accept="audio/*,video/*" data-mtfile="1" hidden></label>') : '') +
      '<button type="button" class="btn pri" data-do="mtGo"' + (mt.busy ? ' disabled' : '') + '>' + (mt.busy ? '正在拆解…' : hi('spark', 1.6) + ' 拆成任务') + '</button></div>';
    var on = mt.items.filter(function (x) { return x.on; }).length;
    return '<p class="muted" style="margin:0 0 8px;font-size:14px">拆出 ' + mt.items.length + ' 个任务' + (mt.src ? '（' + mt.src + '）' : '') + '，核对负责人和时间后派出；不要的取消勾选。</p><div class="mt-list">' + mt.items.map(function (x, i) {
      return '<div class="mt-it' + (x.on ? '' : ' off') + '"><label class="mt-chk"><input type="checkbox" data-mt="on" data-i="' + i + '"' + (x.on ? ' checked' : '') + '><span></span></label><div class="mt-f">' +
        '<input type="text" data-mt="title" data-i="' + i + '" value="' + esc(x.title) + '" maxlength="50" aria-label="任务">' +
        '<div class="mt-r"><select data-mt="ownerId" data-i="' + i + '" aria-label="负责人"><option value="">选负责人</option>' + ppl.map(function (u) { return '<option value="' + u.id + '"' + (u.id === x.ownerId ? ' selected' : '') + '>' + esc(u.name) + '</option>'; }).join('') + '</select>' +
        '<input type="date" data-mt="due" data-i="' + i + '" value="' + esc(x.due || '') + '" aria-label="截止"></div>' +
        (x.dup ? '<small class="mt-warn">和已有任务「' + esc(x.dup) + '」像是同一件事，已取消勾选；确实要派就勾上</small>' : '') + (x.dueAlt ? '<small class="mt-warn">时间请核对：会议里说的像是 ' + esc(x.dueAlt) + '</small>' : '') + '</div></div>';
    }).join('') + '</div><button type="button" class="link mt-back" data-do="mtBack">← 改一下会议内容</button>' + (on ? '' : '<p class="muted">至少勾选一个任务。</p>');
  }
  function mtRender() { var b = document.querySelector('#layer .sheet .body'); if (b) b.innerHTML = mtBody(); var f = document.querySelector('#layer .sheet footer button[type=submit]'); if (f) f.textContent = mt.items ? '派出 ' + mt.items.filter(function (x) { return x.on; }).length + ' 个任务' : '关闭'; }
  var MTX = {};
  MTX.wTplSave = function () { var w = W(cur().id); openSheet('存为模板', '<p class="muted" style="margin:0 0 8px;font-size:14px">把这个项目的任务、验收标准和里程碑存成模板，下次新建同类项目时一键带出（日期按相对天数换算）。</p>' + field('模板名称', '<input type="text" name="name" maxlength="20" value="' + esc(w.title.slice(0, 20)) + '" required>'), '保存模板', function (o) { act('template.save', { id: w.id, name: o.name }, '已存为模板，新建项目时可以选'); }); };
  MTX.wMeeting = function () {
    var w = W(cur().id); if (!canPlanWork(w)) return toast('只有能给这个项目派任务的人可以用', true);
    mt = { wid: w.id, text: '', items: null, rec: null, busy: false }; mtOpen();
  };
  /* 打开（或转文字后重新打开）会议拆任务面板：转文字时会临时换成「正在转文字」面板 */
  function mtOpen() {
    var w = W(mt.wid); if (!w) return;
    openSheet('会议拆任务', mtBody(), '关闭', function () {
      if (!mt.items) return closeSheet();
      var pick = mt.items.filter(function (x) { return x.on && x.title.trim(); });
      if (!pick.length) return toast('至少勾选一个任务', true);
      var miss = pick.filter(function (x) { return !x.ownerId; }); if (miss.length) return toast('「' + miss[0].title + '」还没选负责人', true);
      var r = act('work.plan', { id: w.id, tasks: pick.map(function (x) { return { title: x.title.trim(), ownerId: x.ownerId, due: x.due || undefined, expected: x.expected || ('完成「' + x.title.trim() + '」并提交成果说明'), criteria: x.criteria || '验收人确认达到要求', assignedBy: 'ai' }; }) });
      if (r.ok) { closeSheet(); toast('已派出 ' + pick.length + ' 个任务，负责人都收到了通知'); }
    });
    mtRender();
  }
  MTX.mtBack = function () { mt.items = null; mtRender(); };
  MTX.mtGo = function () {
    var ta = document.getElementById('mt-text'); mt.text = ta ? ta.value : mt.text; var w = W(mt.wid);
    if (mt.text.trim().length < 6) return fieldErr('#mt-text', '先写或录一段会议内容');
    var useRule = function (why) { mt.items = mtParse(mt.text, w); mt.src = why || '规则识别'; mt.items.forEach(function (x) { if (!x.ownerId) x.ownerId = mtOwnerDefault(w); }); mtFlag(mt.items, w, null); mt.busy = false; if (!mt.items.length) { mt.items = null; mtRender(); return toast('没有识别出要做的事，试着写成「谁 + 什么时候 + 做什么」', true); } mtRender(); };
    if ((AI_ON || AI_CFG) && typeof TMS !== 'undefined' && TMS.aiMeeting) /* 会议拆任务服务器对负责人、运营者开放 */ {
      mt.busy = true; mtRender();
      TMS.aiMeeting(w.id, mt.text).then(function (r) { mt.busy = false; mt.items = (r.items || []).map(function (x) { return { title: x.title, ownerId: x.ownerId || mtOwnerDefault(w), due: x.due, expected: x.expected, criteria: x.criteria, on: true }; }); mt.src = AI_LOCAL ? '本机 AI' : 'Claude'; if (!mt.items.length) return useRule('AI 没拆出来，改用规则识别'); var rl = mtParse(mt.text, w); mtFillDue(mt.items, rl); mtFlag(mt.items, w, rl); mtRender(); }, function () { useRule('AI 暂时不可用，改用规则识别'); });
    } else useRule();
  };
  MTX.mtRec = function () {
    if (mt.rec) { try { mt.rec.mr.stop(); } catch (e) {} return; }
    var ta = document.getElementById('mt-text'); if (ta) mt.text = ta.value;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [], mr = new MediaRecorder(stream), t0 = Date.now();
      mt.rec = { mr: mr, timer: setInterval(function () { var e = document.getElementById('mt-sec'); if (e) e.textContent = Math.round((Date.now() - t0) / 1000); }, 500) };
      mr.ondataavailable = function (e) { chunks.push(e.data); };
      mr.onstop = function () { stream.getTracks().forEach(function (t) { t.stop(); }); clearInterval(mt.rec.timer); mt.rec = null; mtRender();
        var blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        if (!canSrvTr()) return toast('录好了，但这里没法转文字：请连接团队服务器，或用输入法的话筒说到文字框里', true);
        srvTr(blob, '会议录音').then(function (t) { if (!t) { mtOpen(); return toast('录音里没有识别到说话', true); } mt.text = (mt.text ? mt.text + '\n' : '') + t; mtOpen(); toast('已转成文字，可以点「拆成任务」'); }, function () { mtOpen(); /* 转失败也回到会议面板，已写的内容还在 */ }); };
      mr.start(); mtRender();
    }).catch(function () { toast('没有拿到麦克风权限，请在设置里允许后再试', true); });
  };
  document.addEventListener('input', function (e) { var t = e.target; if (!t || !t.dataset) return; if (t.id === 'mt-text') mt.text = t.value; if (t.dataset.mt && mt.items) { var x = mt.items[+t.dataset.i]; if (x) x[t.dataset.mt] = t.type === 'checkbox' ? t.checked : t.value; } });
  document.addEventListener('change', function (e) { var t = e.target; if (!t || !t.dataset || !t.dataset.mt || !mt.items) return; var x = mt.items[+t.dataset.i]; if (!x) return; x[t.dataset.mt] = t.type === 'checkbox' ? t.checked : t.value; if (t.dataset.mt === 'on') mtRender(); });
  function wTasksTab(w) {
    var vts = S.tasks.filter(function (t) { return t.workId === w.id && TM.canViewTask(S, me, t); });
    var ord = { blocked: 0, submitted: 1, owner_review: 1, in_progress: 2, accepted: 2, assigned: 3, done: 5, cancelled: 6 };
    vts.sort(function (a, b) { return (wtFlag(b) && b.status !== 'done') - (wtFlag(a) && a.status !== 'done') || (ord[a.status] || 4) - (ord[b.status] || 4); });
    var f = wd.tf || 'all', rows = vts.filter(function (t) { return wtIn(f, t); });
    var h = '<div class="wt-chips">' + WTF.map(function (x) { var n = vts.filter(function (t) { return wtIn(x[0], t); }).length; return '<button class="' + (f === x[0] ? 'on' : '') + (x[0] === 'flag' && n ? ' warn' : '') + '" data-do="wTf" data-f="' + x[0] + '">' + x[1] + '<i>' + n + '</i></button>'; }).join('') + '</div>';
    h += '<div class="wt-bar"><div class="wt-view"><button class="' + (wd.board ? '' : 'on') + '" data-do="wtView" data-v="list">列表</button><button class="' + (wd.board ? 'on' : '') + '" data-do="wtView" data-v="board">看板</button></div>' + (canPlanWork(w) ? '<button class="wt-meet" data-do="wMeeting">' + hi('spark', 1.6) + '会议拆任务</button>' : '') + '</div>';
    if (wd.board && vts.length) {
      // 看板：按状态分列，横向滑动；每列显示数量
      var COLS = [['待接收', ['assigned']], ['进行中', ['accepted', 'in_progress']], ['受阻', ['blocked']], ['待验收', ['submitted', 'owner_review']], ['已完成', ['done']]];
      return h + '<div class="wt-board">' + COLS.map(function (c) { var xs = rows.filter(function (t) { return c[1].indexOf(t.status) >= 0; });
        return '<section class="wt-col"><h4>' + c[0] + '<span>' + xs.length + '</span></h4>' + (xs.length ? xs.map(function (t) { return '<a class="wt-bc' + (wtFlag(t) && t.status !== 'done' ? ' warn' : '') + '" href="#/task/' + t.id + '"><b>' + esc(t.title) + '</b><span>' + av(t.ownerId, true) + esc(nm(t.ownerId)) + (t.due ? ' · ' + esc(mdTxt(t.due)) : '') + '</span></a>'; }).join('') : '<p class="wt-none">没有</p>') + '</section>'; }).join('') + '</div>';
    }
    return h + (rows.length ? '<div class="list wt-list">' + rows.map(wTaskRow).join('') + '</div>' : emptyBox(!vts.length ? (w.status === 'planning' ? '还没有任务，点下方「新建任务」分配。' : '没有你可见的任务。') : '这个分类下没有任务。'));
  }
  function wMemTab(w, mg) {
    var mem = wMembers(w), roleOf = function (u) { var r = []; if (u === w.leadId) r.push('负责人'); if (u === w.operatorId) r.push('跟进运营'); if (u === w.reviewerId) r.push('验收人'); if (S.tasks.some(function (t) { return t.workId === w.id && t.ownerId === u; })) r.push('执行'); if (!r.length) r.push('协作'); return r; };
    var rk = function (u) { return u === w.leadId ? 0 : u === w.operatorId ? 1 : u === w.reviewerId ? 2 : 3; };
    mem.sort(function (a, b) { return rk(a) - rk(b); });
    var doing = 0;
    var rows = mem.map(function (u) {
      var mine = S.tasks.filter(function (t) { return t.workId === w.id && t.ownerId === u && t.status !== 'cancelled'; }), on = mine.filter(function (t) { return t.status !== 'done'; }).length, dn = mine.length - on, fl = mine.filter(function (t) { return wtFlag(t) && t.status !== 'done'; }).length; doing += on;
      return '<div class="row wm" role="button" tabindex="0" data-do="wMem" data-u="' + u + '">' + av(u) + '<span class="wm-i"><b>' + esc(nm(u)) + (u === me ? '<small class="wm-me">我</small>' : '') + (fl ? '<small class="wm-f">' + fl + ' 项需关注</small>' : '') + '</b><span class="wm-r">' + roleOf(u).map(function (r) { return '<i>' + r + '</i>'; }).join('') + '<em>' + esc(TM.user(S, u).title || '') + '</em></span></span>' +
        '<span class="wm-n"><b>' + on + '</b><small>进行中</small></span><span class="wm-n"><b>' + dn + '</b><small>已完成</small></span></div>';
    }).join('');
    return '<div class="wm-sum"><span><b>' + mem.length + '</b> 位成员 · 进行中 <b>' + doing + '</b> 项</span>' + (mg ? '<button class="wx-link" data-do="goAssignWork" data-arg="' + w.id + '">' + ti('plus2', 2) + '邀请成员</button>' : '') + '</div><div class="list wm-list">' + rows + '</div><p class="wx-tip">成员来自负责人、跟进运营者、验收人和任务参与者。要加人，给他分配一个任务即可。</p>';
  }
  var LINKI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>';
  function wfIcon(m) { var k = m.kind === 'link' ? ['ix-l', 'link'] : fileKind(m), b = m.localId && blobUrl(m.localId); return '<span class="ix-fi wf-ic ' + k[0] + '">' + (b && m.kind === 'image' ? '<img src="' + b + '" alt="">' : k[1] === 'link' ? LINKI : ai2(k[1], 1.7)) + '</span>'; }
  function wFilesTab(w, d, mg) {
    var up = (w.files || []).slice().sort(function (a, b) { return b.at - a.at; });
    var dl = S.deliverables.filter(function (f) { var t = T_(f.taskId); return t && t.workId === w.id && TM.canViewTask(S, me, t); }).sort(function (a, b) { return b.at - a.at; });
    var src = d && TM.canViewMedia(S, me, d) ? d.media.filter(function (m) { return TM.canSeeMediaItem(S, me, d, m); }) : [];
    var canUp = w.status !== 'cancelled';
    var sec = function (title, n, rows, empty) { return '<section class="wx-card wf-sec"><div class="wx-sh"><b>' + title + '<i class="wf-n">' + n + '</i></b></div>' + (rows.length ? '<div class="list wf-list">' + rows.join('') + '</div>' : empty || '') + '</section>'; };
    var h = '<div class="wf-head"><span><b>' + (up.length + dl.length + src.length) + ' 个文件</b><small>项目文件 ' + up.length + ' · 交付物 ' + dl.length + ' · 来源想法 ' + src.length + '</small></span>' + (canUp ? '<button class="wf-up" data-do="wUpload">' + ti('plus2', 2.2) + '上传</button>' : '') + '</div>';
    h += sec('项目文件', up.length, up.map(function (m) {
      var meta = [m.kind === 'link' ? String(m.url || '').replace(/^https?:\/\//, '').slice(0, 26) : m.size, nm(m.by), ago(m.at)].filter(Boolean).join(' · ');
      var canDel = m.by === me || mg, b = m.localId && blobUrl(m.localId);
      return '<div class="row wf"><button class="wf-o" data-do="wfOpen" data-fid="' + m.id + '">' + wfIcon(m) + '<span class="wf-t"><b>' + esc(m.name) + '</b><small>' + esc(meta) + (m.kind !== 'link' && !b ? ' · 本机未缓存' : '') + '</small></span></button>' + (canDel ? '<button class="wf-x" data-do="wfDel" data-fid="' + m.id + '" aria-label="删除 ' + esc(m.name) + '">×</button>' : '') + '</div>';
    }), '<button class="wf-empty" data-do="' + (canUp ? 'wUpload' : 'noop') + '">' + ai2('doc2', 1.7) + '<span><b>' + (canUp ? '上传项目资料' : '还没有项目文件') + '</b><small>方案、图片、表格、录音或链接，成员都能看到</small></span></button>');
    h += sec('交付物', dl.length, dl.map(function (f) { var t = T_(f.taskId); return '<a class="row wf" href="#/task/' + t.id + '">' + '<span class="ix-fi wf-ic ix-x">' + ai2('check', 1.8) + '</span><span class="wf-t"><b>' + esc(f.note || f.url || (f.media && f.media.length ? f.media.map(function (m) { return m.name; }).join('、') : '交付物')) + '</b><small>交付物' + (f.media && f.media.length ? '（' + f.media.length + ' 个文件）' : '') + ' · ' + esc(t.title) + ' · ' + esc(nm(f.by)) + ' · ' + ago(f.at) + '</small></span>' + hi('chev', 2) + '</a>'; }), '<p class="wx-empty">任务提交的交付物会出现在这里。</p>');
    if (src.length) h += sec('来源想法', src.length, src.map(function (m) { return '<a class="row wf" href="#/idea/' + d.id + '">' + wfIcon(m) + '<span class="wf-t"><b>' + esc(m.name) + '</b><small>来源想法 · ' + esc(d.title) + '</small></span>' + hi('chev', 2) + '</a>'; }));
    return h;
  }
  function memRole(w, u) { return u === w.leadId ? '项目负责人' : u === w.operatorId ? '跟进运营' : u === w.reviewerId ? '验收人' : pRole(u); }
  function moreOps(w) {
    var a = [], ow = isOwner();
    if (w.status === 'acceptance' && (w.reviewerId === me || ow)) a.push([w.reviewerId === me ? '确认项目完成' : '老板代验收（确认完成）', 'closeWork']);
    if ((w.leadId === me || (w.kind !== 'product' && w.operatorId === me) || ow) && TM.STAGES[w.kind].length > 1 && ['done', 'cancelled'].indexOf(w.status) < 0) a.push(['推进阶段', 'stage']);
    if (ow && ['planning', 'active', 'acceptance', 'blocked'].indexOf(w.status) >= 0) a.push(['暂停', 'pause']);
    if (ow && w.status === 'paused') a.push(['恢复', 'resume']);
    if (canPlanWork(w)) a.push(['会议拆任务', 'wMeeting']);
    if ((ow || w.leadId === me || w.operatorId === me) && S.tasks.some(function (t) { return t.workId === w.id; })) a.push(['存为模板', 'wTplSave']);
    if (!ow && (w.leadId === me || w.operatorId === me) && ['done', 'cancelled'].indexOf(w.status) < 0 && !S.decisions.some(function (x) { return x.workId === w.id && x.status === 'pending'; })) a.push(['上报老板决策', 'wEscalate']);
    if ((ow || w.leadId === me) && ['done', 'cancelled'].indexOf(w.status) < 0) a.push(['更换人员', 'wReassign']);
    if ((ow || w.leadId === me || w.operatorId === me) && ['done', 'cancelled'].indexOf(w.status) < 0) a.push(['取消项目', 'cancelWork']);
    return a;
  }
  function workActions(w) {
    if (!w || !TM.canViewWork(S, me, w)) return [];
    var a = [], ow = isOwner(), planner = w.leadId === me || w.operatorId === me;
    if (moreOps(w).length) a.push(['更多操作', 'wMore', 'w-moreb']);
    if ((planner || ow) && ['planning', 'active', 'acceptance', 'blocked'].indexOf(w.status) >= 0) a.push(['新建任务', 'goAssignWork', 'pri', w.id]);
    return a;
  }
  var WD = {
    wNew: function () {
      var O2 = [['quickIdea', 'bulb', '记录想法', '语音、文字或视频'], ['quickProject', 'plus2', '新建项目', '手动填写或 AI 解析'], ['quickAssign', 'person', '分配任务', '让合适的人做合适的事'], ['quickAI', 'spark', 'AI 助手', '整理、分析、建议、创作']];
      var cp = myCaps(); O2 = O2.filter(function (o) { return o[0] === 'quickIdea' ? cp.recordIdea : o[0] === 'quickProject' ? cp.createProject : o[0] === 'quickAssign' ? cp.assign : true; });
      openSheet('新建', '<div class="wn-list">' + O2.map(function (o) { return '<button type="button" class="wn-item" data-do="' + o[0] + '"><span>' + (o[1] === 'spark' ? hi('spark', 1.6) : o[1] === 'plus2' ? ti('plus2', 2) : ai2(o[1], 1.7)) + '</span><b>' + o[2] + '</b><small>' + o[3] + '</small>' + hi('chev', 2) + '</button>'; }).join('') + '</div>', '关闭', function () { closeSheet(); });
    },
    wTab: function (el) { wd.tab = el.dataset.t; render(); },
    wTf: function (el) { wd.tf = el.dataset.f; render(); },
    noop: function () {},
    wMem: function (el) { var u = el.dataset.u, w = W(cur().id); var ts = S.tasks.filter(function (t) { return t.workId === w.id && t.ownerId === u && TM.canViewTask(S, me, t); });
      openSheet(nm(u), '<div class="wm-pf">' + av(u) + '<span><b>' + esc(nm(u)) + '</b><small>' + esc((TM.user(S, u).title || '') + ' · ' + memRole(w, u)) + '</small></span></div>' + (ts.length ? '<div class="list wt-list">' + ts.map(wTaskRow).join('') + '</div>' : '<p class="muted" style="font-size:13.5px">在这个项目里还没有任务。</p>'), '关闭', function () { closeSheet(); }); },
    wcOpen: function () { var id = cur().id; wchatOpen[id] = !wchatOpen[id]; render(); setTimeout(function () { var pn = document.getElementById('wc-panel'); if (pn) pn.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30); },
    wcClose: function () { wchatOpen[cur().id] = false; render(); },
    wcAsk: function (el) { wcPush(W(cur().id), el.dataset.q); },
    wcSend: function () { var v = ((document.getElementById('wc-q') || {}).value || '').trim(); if (!v) return toast('先输入问题', true); wcPush(W(cur().id), v); },
    wcMic: function (el) { if (!SR) return toast('这个浏览器不支持语音输入，可以用输入法自带的语音键', true); var r = new SR(); r.lang = 'zh-CN'; r.interimResults = false; el.classList.add('on'); r.onresult = function (e) { wcPush(W(cur().id), e.results[0][0].transcript); }; r.onend = function () { el.classList.remove('on'); }; r.onerror = function () { el.classList.remove('on'); toast('没听清，再试一次', true); }; try { r.start(); toast('请说出你的问题'); } catch (e) { el.classList.remove('on'); } },
    wUpload: function () { var id = cur().id;
      var o = function (cap, acc, icon, t, s2) { return '<label class="ix2-opt"><input type="file" data-wfile="' + id + '"' + (acc ? ' accept="' + acc + '"' : '') + (cap ? ' capture="' + cap + '"' : '') + ' multiple><span class="ix2-oi">' + icon + '</span><b>' + t + '</b><small>' + s2 + '</small></label>'; };
      openSheet('上传到项目', '<div class="ix2-opts">' + o('environment', 'image/*', ai2('img', 1.7), '拍照', '用相机拍一张') + o('', 'image/*,video/*', ai2('vcam', 1.7), '相册', '图片或视频') + o('', '', ai2('doc2', 1.7), '文件', 'PDF、Excel、Word 等') + o('', 'audio/*', ai2('mic', 1.7), '录音', '选择一段录音') +
        '<button type="button" class="ix2-opt" data-do="wLink"><span class="ix2-oi">' + LINKI + '</span><b>链接</b><small>网页、云盘地址</small></button></div><p class="muted" style="font-size:13px;margin:10px 0 0">项目成员都能看到。每个项目最多 50 个文件；' + (SRV ? '文件会上传到团队服务器，同事都能打开。' : '演示版不上传，文件只保存在这台设备。') + '</p>', '关闭', function () { closeSheet(); }); },
    wLink: function () { var id = cur().id; openSheet('添加链接', field('链接地址', '<input type="url" name="url" placeholder="https://" required>') + field('名称（可选）', '<input type="text" name="name" maxlength="40" placeholder="例如：设计稿">'), '添加', function (o) { var u = (o.url || '').trim(); act('work.attach', { id: id, media: [{ kind: 'link', url: u, name: (o.name || '').trim() || u.replace(/^https?:\/\//, '').slice(0, 40) }] }, '已添加链接'); }); },
    wfOpen: function (el) { var w = W(cur().id), m = (w.files || []).find(function (f) { return f.id === el.dataset.fid; }); if (!m) return; openMedia(m); },
    wfDel: function (el) { var w = W(cur().id), m = (w.files || []).find(function (f) { return f.id === el.dataset.fid; }); if (!m) return; openSheet('删除文件', '<p style="margin:0;font-size:14px">确定删除「' + esc(m.name) + '」？删除后项目成员都看不到了。</p>', '删除', function () { act('work.detach', { id: w.id, fid: m.id }, '已删除'); }, true); },
    wShare: function () { var u = location.href; try { navigator.clipboard.writeText(u).then(function () { toast('链接已复制，同事登录后可查看（需有权限）'); }, function () { toast('请手动复制地址栏链接'); }); } catch (e) { toast('请手动复制地址栏链接'); } },
    wMore: function () {
      // 没有可执行的操作时也给可做的事：复制链接、看动态（以前是一个空面板）
      var w = W(cur().id), ops = moreOps(w).concat([['复制项目链接', 'wShare'], ['查看项目动态', 'wLog']]);
      openSheet('更多操作', '<div class="wd-ops">' + ops.map(function (o) { return '<button type="button" class="btn block' + (o[1] === 'cancelWork' ? ' danger' : '') + '" data-do="' + o[1] + '">' + o[0] + '</button>'; }).join('') + '</div>', '关闭', function () { closeSheet(); });
    },
    wLog: function () { closeSheet(); var b = document.querySelector('[data-do=wTab][data-t=log]'); if (b) b.click(); },
    wCardMore: function (el) { var w = W(el.dataset.id); openSheet(w.title, '<div class="wd-ops"><a class="btn block" href="#/work/' + w.id + '">打开项目</a>' + (workActions(w).some(function (a) { return a[1] === 'goAssignWork'; }) ? '<button type="button" class="btn block" data-do="goAssignWork" data-arg="' + w.id + '">新建任务</button>' : '') + '</div>', '关闭', function () { closeSheet(); }); },
    wtView: function (el) { wd.board = el.dataset.v === 'board'; try { localStorage.setItem('tm_wt_board', wd.board ? '1' : ''); } catch (e) {} render(); },
    wPri: function () { var w = W(cur().id); openSheet('项目优先级', '<div class="opts">' + [['hi', '高'], ['mid', '中'], ['lo', '低']].map(function (p) { return opt('priority', p[0], p[1], '', (w.priority || 'mid') === p[0]); }).join('') + '</div>', '保存', function (o) { act('work.update', { id: w.id, priority: o.priority }, '已更新优先级'); }); },
    wEditText: function (el) { var w = W(cur().id), k = el.dataset.k; openSheet(k === 'goal' ? '项目目标' : '关键成果', field(k === 'goal' ? '项目目标' : '关键成果', '<textarea name="v" rows="3" maxlength="200">' + esc(w[k] || '') + '</textarea>'), '保存', function (o) { var p = { id: w.id }; p[k] = o.v; act('work.update', p, '已保存'); }); },
    wAddMs: function () { var w = W(cur().id); openSheet('添加里程碑', field('名称', '<input type="text" name="title" maxlength="30" placeholder="例如：内部评审">') + field('日期', '<input type="date" name="date" value="' + (w.due || TM.dateAdd(S, 7)) + '">'), '添加', function (o) { act('work.milestone.add', { id: w.id, title: o.title, date: o.date }, '已添加里程碑'); }); },
    wMs: function (el) { act('work.milestone.toggle', { id: cur().id, mid: el.dataset.mid }, '里程碑已更新，成员已收到通知'); }
  };

