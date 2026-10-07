/* app/07_todo.js — 今日待办 + 新建待办（手动 / AI）。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
  /* ---------- 今日待办（任务 Tab）+ 新建待办（手动 / AI） ---------- */
  var td = { day: null, filter: 'all', view: 'list', showDone: false };
  var WK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function dayInfo(off) { var d = new Date(); d.setDate(d.getDate() + off); var ds = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); return { ds: ds, name: off === 0 ? '今天' : off === 1 ? '明天' : WK[d.getDay()], md: (d.getMonth() + 1) + '/' + d.getDate() }; }
  function relDay(ds) { var n = dayDiff(ds); if (n == null) return ''; if (n < 0) return '逾期'; if (n === 0) return '今天'; if (n === 1) return '明天'; if (n === 2) return '后天'; if (n < 7) { var p = ds.split('-'); return WK[new Date(+p[0], p[1] - 1, +p[2]).getDay()]; } var q = ds.split('-'); return +q[1] + '月' + +q[2] + '日'; }
  var TAGC = { '高优先级': 'k-red', '想法': 'k-blue', '会议': 'k-violet', '决策': 'k-violet', '沟通': 'k-green', '数据': 'k-violet', '个人成长': 'k-orange', '事工': 'k-orange', '工作': 'k-blue', '学习': 'k-green', '内容': 'k-violet', '活动': 'k-green', '运维': 'k-gray', '产品': 'k-blue', '行政': 'k-green', '项目': 'k-blue', '任务': 'k-blue', '运营': 'k-green' };
  function unified() {
    TM.ensureTodos(S);
    var out = S.todos.filter(function (t) { return t.ownerId === me || t.people.indexOf(me) >= 0; }).map(function (t) {
      var mineT = t.ownerId === me, ppl = (mineT ? t.people : [t.ownerId].concat(t.people.filter(function (x) { return x !== me; })));
      return { key: t.id, own: mineT, personal: true, id: t.id, title: t.title, repeat: t.repeat || '', tags: (t.priority === 'hi' ? ['高优先级'] : []).concat(t.tags), prio: t.priority, date: t.date, time: t.time, comments: t.comments.length, people: ppl, done: t.done, doneAt: t.doneAt,
        group: t.priority === 'hi' ? 'hi' : !mineT || t.people.length || t.scope === 'team' ? 'team' : t.scope === 'other' ? 'other' : 'mine', mine: mineT && !t.people.length };
    });
    todoItems().forEach(function (x, i) {
      out.push({ key: 's' + i + x.href, sys: true, href: x.href, title: x.title, tags: (x.prio === 'hi' ? ['高优先级'] : []).concat([x.tag[0]]), prio: x.prio, date: x.date, time: '', timeLabel: x.due.t, comments: x.comments || 0, people: x.people || [], done: !!x.done, doneAt: x.doneAt,
        group: x.prio === 'hi' ? 'hi' : x.mine ? 'mine' : 'team', mine: !!x.mine });
    });
    var rank = { hi: 0, mid: 1, lo: 2 };
    return out.sort(function (a, b) { return (a.date || '').localeCompare(b.date || '') || rank[a.prio] - rank[b.prio] || (a.time || '99').localeCompare(b.time || '99'); });
  }
  function tdTime(x) { return x.time ? (relDay(x.date) === '逾期' ? '逾期 ' : relDay(x.date) + ' ') + x.time : x.timeLabel || relDay(x.date); }
  var TI = {
    plus2: '<path d="M12 5v14M5 12h14"/>',
    cmt: '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z"/><path d="M8 10h8M8 13h5"/>',
    listv: '<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>', groupv: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    flag: '<path d="M5.5 21V4" stroke-width="2.2"/><path d="M5.5 4h12.5l-3 4.5 3 4.5H5.5z" fill="currentColor" stroke="none"/>', me1: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6"/>',
    more: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/>',
    bag: '<rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>', grad: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.5c3 2.4 8 2.4 11 0v-4.5M21.5 9.5V14"/>',
    brush: '<path d="M14.5 4.5l5 5L10 19l-5.5.5L5 14z"/><path d="M12.5 6.5l5 5"/>', person: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6"/>',
    filedoc: '<path d="M7 3.5h7l4 4v13H7z" fill="currentColor" stroke="none" opacity=".9"/><path d="M9.5 13h6M9.5 16h4" stroke="#fff"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.1-2.4 3.6M12 17v.1"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>', down: '<path d="M7 10l5 5 5-5"/>', file: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M9.5 12h6M9.5 15.5h6"/>',
    bulb: '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v1h5v-1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5z"/>'
  };
  function ti(k, sw) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (TI[k] || PI[k] || NI[k] || HI[k]) + '</svg>'; }
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function calHTML(all) {
    if (!td.calOpen) return '';
    if (!td.calMonth) td.calMonth = td.day.slice(0, 7);
    var y = +td.calMonth.slice(0, 4), m = +td.calMonth.slice(5, 7) - 1, first = new Date(y, m, 1), startOff = (first.getDay() + 6) % 7;
    var start = new Date(y, m, 1 - startOff), t0 = TM.todayStr(S), cells = '';
    var byDay = {}; all.forEach(function (x) { var k = x.date; byDay[k] = byDay[k] || { open: 0, hi: 0, done: 0 }; if (x.done) byDay[k].done++; else { byDay[k].open++; if (x.prio === 'hi') byDay[k].hi++; } });
    for (var i = 0; i < 42; i++) {
      var d = new Date(start); d.setDate(start.getDate() + i); var k = ymd(d), b = byDay[k], out = d.getMonth() !== m;
      cells += '<button class="' + (out ? 'out ' : '') + (k === td.day ? 'on ' : '') + (k === t0 ? 'today' : '') + '" data-do="tdPick" data-d="' + k + '" aria-label="' + (d.getMonth() + 1) + '月' + d.getDate() + '日' + (b && b.open ? '，' + b.open + ' 项待办' : '') + '"><span>' + d.getDate() + '</span><i>' + (b && b.hi ? '<em class="r"></em>' : '') + (b && b.open > b.hi ? '<em class="b"></em>' : '') + (b && !b.open && b.done ? '<em class="g"></em>' : '') + '</i></button>';
    }
    var mOpen = Object.keys(byDay).filter(function (k) { return k.slice(0, 7) === td.calMonth; }).reduce(function (n, k) { return n + byDay[k].open; }, 0);
    return '<section class="t-cal"><div class="t-cal-h"><button data-do="tdMonth" data-n="-1" aria-label="上个月">' + hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button><b>' + y + '年' + (m + 1) + '月</b><button data-do="tdMonth" data-n="1" aria-label="下个月">' + hi('chev', 2.2) + '</button><span>本月 ' + mOpen + ' 项待办</span><button class="t-cal-today" data-do="tdPick" data-d="' + t0 + '">今天</button></div>' +
      '<div class="t-cal-w">' + ['一', '二', '三', '四', '五', '六', '日'].map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div><div class="t-cal-g">' + cells + '</div>' +
      '<div class="t-cal-l"><span><em class="r"></em>有高优先级</span><span><em class="b"></em>有待办</span><span><em class="g"></em>已全部完成</span></div></section>';
  }
  var TGI = {
    '高优先级': '<path d="M6 21V4"/><path d="M6 4.5h11l-2.5 4 2.5 4H6"/>',
    '决策': '<path d="M14 4l6 6M12 6l6 6M4 20l8-8M9 9l6 6"/>',
    '想法': '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v1h5v-1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5z"/>',
    '沟通': '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z"/>',
    '数据': '<path d="M5 20v-6M10 20V9M15 20v-9M20 20V5"/>',
    '个人成长': '<path d="M12 21v-8"/><path d="M12 13c0-4 3-7 7-7 0 4-3 7-7 7zM12 15c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5z"/>',
    '会议': '<circle cx="9" cy="8.5" r="3"/><path d="M3.8 19c.8-2.9 2.7-4.4 5.2-4.4s4.4 1.5 5.2 4.4M15.2 5.8a3 3 0 0 1 0 5.4M16.8 14.8c1.7.5 2.9 1.9 3.4 4.2"/>',
    '工作': '<rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>',
    '学习': '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/>',
    '内容': '<path d="M4.5 19.5l1-4.2L15.8 5a2.1 2.1 0 0 1 3 3L8.6 18.4z"/>',
    '活动': '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8.5 3v3.5M15.5 3v3.5"/>',
    '运维': '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01"/>',
    '事工': '<path d="M12 20s-7-4.3-7-9.6A4 4 0 0 1 12 8a4 4 0 0 1 7 2.4C19 15.7 12 20 12 20z"/>',
    '产品': '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    '行政': '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 10h4a1 1 0 0 1 1 1v10M3 21h18M8 8h3M8 12h3M8 16h3"/>',
    '项目': '<path d="M3.8 8.2a2.7 2.7 0 0 1 2.7-2.7h3l2 2.2h6a2.7 2.7 0 0 1 2.7 2.7v6.9a2.7 2.7 0 0 1-2.7 2.7h-11a2.7 2.7 0 0 1-2.7-2.7z"/>',
    '任务': '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.6 12.2l2.3 2.3 4.6-4.8"/>',
    '待办': '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.4 2.4 4.6-5"/>'
  };
  function tagIcon(g) {
    var path = TGI[g] || '<path d="M3.5 12V5a1.5 1.5 0 0 1 1.5-1.5h7l8.5 8.5-8.5 8.5z"/><circle cx="8" cy="8" r="1.3"/>';
    return '<i class="tg' + (g === '高优先级' ? ' tg-hi' : '') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>' + esc(g) + '</i>';
  }
  var TACC = { '高优先级': ['#F0475A', 'c-hi'], '决策': ['#9AA3B2', 'c-gray'], '沟通': ['#9AA7BC', 'c-slate'], '数据': ['#C9D0DA', 'c-gray'], '个人成长': ['#E8C48C', 'c-amber'], '事工': ['#E8C48C', 'c-amber'], '想法': ['#C6BEF3', 'c-lav'], '会议': ['#AFC3E8', 'c-slate'], '工作': ['#AFC3E8', 'c-slate'], '学习': ['#B9DCC8', 'c-mint'], '内容': ['#C6BEF3', 'c-lav'], '活动': ['#B9DCC8', 'c-mint'], '运维': ['#C9D0DA', 'c-gray'], '产品': ['#AFC3E8', 'c-slate'], '行政': ['#B9DCC8', 'c-mint'], '项目': ['#AFC3E8', 'c-slate'], '任务': ['#AFC3E8', 'c-slate'], '待办': ['#C9D0DA', 'c-gray'] };
  function tagChip(g) { var c = TACC[g] || ['#C9D0DA', 'c-gray']; return '<i class="tg2 ' + c[1] + (g === '高优先级' ? ' tg-hi' : '') + '"><em style="background:' + c[0] + '"></em>' + esc(g) + '</i>'; }
  function tdCard(x) {
    var circle = x.personal && x.own ? '<button class="t-chk' + (x.done ? ' on' : '') + '" data-do="tdToggle" data-id="' + x.id + '" aria-label="' + (x.done ? '标为未完成' : '标为完成') + '"></button>' : '<span class="t-chk' + (x.done ? ' on' : '') + (x.sys ? ' sys' : '') + '" aria-hidden="true"></span>';
    var red = x.prio === 'hi' && !x.done && (relDay(x.date) === '今天' || relDay(x.date) === '逾期');
    var main = x.tags.filter(function (g) { return g !== '高优先级'; })[0] || '待办', acc = x.prio === 'hi' ? TACC['高优先级'][0] : (TACC[main] || ['#C9D0DA'])[0];
    return '<div class="t-card tk2-card' + (x.done ? ' done' : '') + (x.prio === 'hi' && !x.done ? ' hot' : '') + '">' + circle + '<span class="tk2-bar" style="background:' + acc + '"></span><' + (x.sys ? 'a href="' + x.href + '"' : 'button type="button" data-do="tdOpen" data-id="' + x.id + '"') + ' class="t-main"><span class="tk-l"><b>' + esc(x.title) + (x.repeat && TM.REPEATS[x.repeat] ? '<span class="wt-rep" title="重复待办">↻ ' + TM.REPEATS[x.repeat] + '</span>' : '') + '</b><span class="t-tags">' + x.tags.slice(0, 3).map(tagChip).join('') +
      (x.comments ? '<span class="t-cmt">' + ti('cmt', 1.6) + x.comments + '</span>' : '') + '</span></span>' +
      '<span class="tk-r"><span class="t-time' + (red ? ' red' : '') + '">' + esc(tdTime(x)) + '</span>' + hi('chev', 2) + '</span></' + (x.sys ? 'a' : 'button') + '></div>';
  }
  function viewToday() {
    var all = unified(); if (!td.day) td.day = TM.todayStr(S);
    var offSel = dayDiff(td.day) || 0, center = Math.abs(offSel) <= 7 ? 0 : offSel;
    var days = []; for (var di = -7; di <= 7; di++) days.push(dayInfo(center + di));
    var isT = td.day === TM.todayStr(S);
    // 今天：除了今天的和逾期的，所有「下一步等我处理」的任务（例如刚分派给我、下周才截止）也都显示，不然执行者打开任务页看不到要接收的任务
    var onDay = all.filter(function (x) { return x.date === td.day || (isT && !x.done && (x.date < td.day || x.sys)); });
    var open = onDay.filter(function (x) { return !x.done; }), done = onDay.filter(function (x) { return x.done; });
    var F = [['all', '全部', open.length], ['hi', '高优先级', open.filter(function (x) { return x.prio === 'hi'; }).length], ['mine', '我负责', open.filter(function (x) { return x.mine; }).length], ['done', '已完成', done.length]];
    var nU = unread(), p = td.day.split('-');
    var h = '<section class="tk2-hero tk-compact"><header class="tk2-top"><h1>任务</h1><button class="tk-month" data-do="tdCal" aria-expanded="' + !!td.calOpen + '">' + ai2('cal', 1.6) + (+p[1]) + '月' + ai2(td.calOpen ? 'up' : 'downc', 1.8) + '</button><span class="tk-sp"></span><button class="tk-ic" data-do="search" aria-label="搜索">' + hi('search', 1.8) + '</button><a class="tk-ic" href="#/inbox" aria-label="通知 ' + nU + ' 条未读">' + hi('bell', 1.8) + (nU ? '<i>' + nU + '</i>' : '') + '</a></header></section>' +
      calHTML(all) +
      '<div class="tk-days" id="tkdays">' + days.map(function (d) { var has = all.some(function (x) { return x.date === d.ds && !x.done; }); return '<button class="' + (d.ds === td.day ? 'on' : '') + (d.ds === TM.todayStr(S) ? ' today' : '') + '" data-do="tdDay" data-d="' + d.ds + '"><span>' + (dayDiff(d.ds) === -1 ? '昨天' : d.name) + '</span><b>' + d.md + '</b>' + (has && d.ds !== td.day ? '<i></i>' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="tk-filters tk2-filters">' + F.map(function (f) { return '<button class="' + (td.filter === f[0] ? 'on' : '') + '" data-do="tdFilter" data-f="' + f[0] + '">' + f[1] + ' ' + f[2] + '</button>'; }).join('') + '<button class="tk2-opt" data-do="tdOpts" aria-label="显示设置">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg></button></div>';
    if (td.view === 'group' && td.filter !== 'done') {
      var G = [['hi', '高优先级'], ['mine', '我负责'], ['team', '团队相关'], ['other', '其他']];
      h += G.map(function (g) { var xs = open.filter(function (x) { return x.group === g[0]; }); return xs.length ? '<h3 class="tk2-gh">' + g[1] + '<span>' + xs.length + '</span></h3>' + xs.map(tdCard).join('') : ''; }).join('') || emptyBox('这一天没有待办。');
    } else {
      var rows = td.filter === 'done' ? done : open.filter(function (x) { return td.filter === 'hi' ? x.prio === 'hi' : td.filter === 'mine' ? x.mine : true; });
      h += rows.length ? rows.map(tdCard).join('') : emptyBox(td.filter === 'done' ? '这一天还没有完成的事。' : '这一天没有待办。点右下角「+」添加。');
    }
    if (td.filter !== 'done' && done.length) h += '<button class="t-donebar" data-do="tdShowDone"><span class="t-chk on"></span>已完成 ' + done.length + hi('chev', 2) + '</button>' + (td.showDone ? done.map(tdCard).join('') : '');
    return h + '<footer class="tk2-foot"><span>SMALL STEPS<br>ETERNAL IMPACT.</span><i></i></footer>' +
      '<a class="t-fab" href="#/todo/new" aria-label="新建待办">' + ti('plus2', 2.4) + '</a>';
  }
  function tdDetail(id) {
    var t = S.todos.find(function (x) { return x.id === id; }); if (!t) return;
    var own = t.ownerId === me;
    openSheet(own ? '编辑待办' : '待办', (own ? field('内容', '<input type="text" name="title" maxlength="50" value="' + esc(t.title) + '">') +
      '<div class="row2">' + field('日期', '<input type="date" name="date" value="' + t.date + '">') + field('时间', '<input type="time" name="time" value="' + esc(t.time) + '">') + '</div>' +
      '<div class="fld"><span>优先级</span><div class="opts tdpr">' + [['hi', '高'], ['mid', '中'], ['lo', '低']].map(function (p) { return opt('priority', p[0], p[1], '', t.priority === p[0]); }).join('') + '</div></div>' +
      field('重复', '<select name="repeat"><option value="">不重复</option>' + Object.keys(TM.REPEATS).map(function (k) { return '<option value="' + k + '"' + (t.repeat === k ? ' selected' : '') + '>' + TM.REPEATS[k] + '</option>'; }).join('') + '</select>', '完成后自动生成下一次') +
      field('备注', '<textarea name="note" rows="2">' + esc(t.note) + '</textarea>') : '<div class="lead" style="font-size:18px">' + esc(t.title) + '</div><p class="muted">' + esc(nm(t.ownerId)) + ' 的待办，' + esc(tdTime({ date: t.date, time: t.time })) + '</p>') +
      (t.people.length ? '<div class="fld"><span>相关人</span><div class="who">' + t.people.map(function (u) { return '<label style="cursor:default">' + av(u, true) + esc(nm(u)) + '</label>'; }).join('') + '</div></div>' : '') +
      '<div class="fld"><span>评论 ' + t.comments.length + '</span>' + t.comments.map(function (c) { return '<div class="sug"><div class="h">' + av(c.by, true) + '<b>' + esc(nm(c.by)) + '</b><span>' + ago(c.at) + '</span></div><p class="b">' + esc(c.body) + '</p></div>'; }).join('') +
      '<div class="row2 mt"><input type="text" id="tdc" placeholder="写评论"><button type="button" class="btn" style="flex:0 0 auto" data-do="tdComment" data-id="' + t.id + '">发送</button></div></div>' +
      (own ? '<button type="button" class="btn danger block mt" data-do="tdDelete" data-id="' + t.id + '">删除待办</button>' : ''), own ? '保存' : '关闭',
      function (o) { if (!own) return closeSheet(); act('todo.update', { id: t.id, title: o.title, date: o.date, time: o.time, priority: o.priority, note: o.note, repeat: o.repeat || '' }, '已保存'); });
  }
  /* 新建待办：入口 */
  var TPLS = [
    { key: 'work', name: '工作任务', sub: '项目 / 任务 / 执行', icon: 'bag', c: 'c-blue', tags: ['工作'], scope: 'mine' },
    { key: 'meeting', name: '会议纪要', sub: '讨论 / 决策 / 跟进', icon: 'team', c: 'c-indigo', tags: ['会议'], scope: 'team', note: '【讨论】\n【决策】\n【跟进】', title: '会议纪要：' },
    { key: 'study', name: '学习计划', sub: '课程 / 阅读 / 练习', icon: 'grad', c: 'c-teal', tags: ['学习'], scope: 'mine' },
    { key: 'content', name: '内容创作', sub: '文案 / 视频 / 设计', icon: 'brush', c: 'c-pink', tags: ['内容'], scope: 'mine' },
    { key: 'personal', name: '个人项目', sub: '生活 / 健康 / 其他', icon: 'person', c: 'c-orange', tags: ['个人成长'], scope: 'other' },
    { key: 'event', name: '活动策划', sub: '筹备 / 分工 / 物资', icon: 'event', c: 'c-green', tags: ['活动'], scope: 'team' },
    { key: 'custom', name: '自定义模板', sub: '按需创建', icon: 'more', c: 'c-gray', tags: [], scope: 'mine' }
  ];
  function tplOf(k) { return TPLS.find(function (t) { return t.key === k; }) || TPLS[6]; }
  var RC = { meeting: 'r-blue', content: 'r-red', event: 'r-green', work: 'r-blue', study: 'r-green', personal: 'r-red', custom: 'r-blue' };
  function viewTodoNew() {
    TM.ensureTodos(S);
    var recent = S.todoRecent.filter(function (r) { return r.userId === me; }).slice(0, 4);
    var shown = TPLS.filter(function (t) { return t.key !== 'event'; });
    return '<section class="n-hero t-nhero"><div class="n-top"><button class="circle n-back" data-do="back" aria-label="返回">' + hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button></div>' +
      '<h1>新建待办</h1><p>选择创建方式，快速记录或让 AI 帮你生成</p><div class="n-script" aria-hidden="true">Turn<br>&nbsp;Ideas<br>&nbsp;&nbsp;Into Action</div></section>' +
      '<div class="t-ways"><a href="#/todo/new/manual" data-do="tdManual" data-t="custom" class="t-way">' + ni('pen', 1.6) + '<b>手动创建</b><small>自由输入，结构清晰</small>' + hi('chev', 2) + '</a>' +
      '<a href="#/todo/new/ai" class="t-way ai">' + hi('spark', 1.5) + '<b>AI 智能创建</b><small>录音或上传，自动解析</small>' + hi('chev', 2) + '</a></div>' +
      '<section class="h-card t-tpls"><div class="h-sec in"><h2>快速模板</h2><button class="t-link" data-do="tdAllTpl">全部模板' + hi('chev', 2) + '</button></div><div class="t-tgrid">' +
      shown.map(function (t) { return '<button data-do="tdManual" data-t="' + t.key + '"><span class="' + t.c + '">' + ti(t.icon, 1.8) + '</span><b>' + t.name + '</b><small>' + t.sub + '</small></button>'; }).join('') + '</div></section>' +
      '<section class="h-card t-recent"><div class="h-sec in"><h2>近期使用</h2>' + (recent.length ? '<button class="t-link" data-do="tdClearRecent">清空</button>' : '') + '</div>' +
      (recent.length ? recent.map(function (r) { return '<button class="t-ritem" data-do="tdManual" data-t="' + r.tpl + '" data-title="' + esc(r.title) + '"><span class="' + (RC[r.tpl] || 'r-blue') + '">' + ti('filedoc', 1.4) + '</span><span class="t-rt"><b>' + esc(r.title) + '</b><small>上次使用：' + ago(r.at) + '</small></span>' + hi('chev', 2) + '</button>'; }).join('') : '<p class="muted" style="font-size:13.5px;margin:0 16px 14px">还没有使用记录。</p>') + '</section>' +
      '<a class="t-tip" href="#/todo/new/ai">' + ti('bulb', 1.7) + '<span><b>小提示</b><small>不知道怎么写？试试 AI 智能创建，用语音或文件，帮你自动生成结构化内容。</small></span>' + hi('chev', 2) + '</a>';
  }
  /* 手动创建 */
  var tf = null;
  function freshTF(k, title) { var t = tplOf(k || 'custom'); return { title: title || t.title || '', date: td.day || TM.todayStr(S), time: '', priority: 'mid', scope: t.scope, tags: t.tags.slice(), people: [], note: t.note || '', tpl: k && k !== 'custom' ? { key: k, title: title || t.name } : null, tplName: t.name }; }
  var TAGS = ['工作', '沟通', '会议', '数据', '学习', '内容', '个人成长', '事工', '运维'];
  function viewTodoManual() {
    if (!tf) tf = freshTF('custom');
    var dd = [0, 1, 2].map(dayInfo), others = TM.activeUsers(S).filter(function (u) { return u.id !== me && !u.roles.every(function (a) { return a.role === 'admin'; }); });
    var seg = function (key, arr) { return '<div class="t-seg">' + arr.map(function (a) { return '<button type="button" class="' + (tf[key] === a[0] ? 'on' : '') + '" data-do="tfSet" data-k="' + key + '" data-v="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div>'; };
    return pHead('手动创建', tf.tplName && tf.tplName !== '自定义模板' ? '模板：' + tf.tplName : '自由输入，结构清晰') +
      '<section class="p-card"><label class="p-fld"><span>待办内容 <em>*</em></span><input type="text" data-tf="title" maxlength="50" placeholder="比如：回复合作方邮件" value="' + esc(tf.title) + '"></label><div class="n-cnt" id="tfc">' + tf.title.length + '/50</div>' +
      '<div class="p-fld"><span>日期</span><div class="t-seg">' + dd.map(function (d) { return '<button type="button" class="' + (tf.date === d.ds ? 'on' : '') + '" data-do="tfSet" data-k="date" data-v="' + d.ds + '">' + (d.name === '今天' || d.name === '明天' ? d.name : '后天') + '</button>'; }).join('') + '<label class="t-pick' + (dd.every(function (d) { return d.ds !== tf.date; }) ? ' on' : '') + '">' + (dd.every(function (d) { return d.ds !== tf.date; }) ? relDay(tf.date) : '选择') + '<input type="date" data-tf="date" value="' + tf.date + '"></label></div></div>' +
      '<label class="p-fld"><span>时间（可选）</span><input type="time" data-tf="time" value="' + esc(tf.time) + '"></label></section>' +
      '<section class="p-card"><div class="p-fld"><span>优先级</span>' + seg('priority', [['hi', '高'], ['mid', '中'], ['lo', '低']]) + '</div>' +
      '<div class="p-fld"><span>归类</span>' + seg('scope', [['mine', '我负责'], ['team', '团队相关'], ['other', '其他']]) + '</div>' +
      '<div class="p-fld"><span>标签</span><div class="t-tagpick">' + TAGS.map(function (g) { return '<button type="button" class="' + (tf.tags.indexOf(g) >= 0 ? 'on' : '') + '" data-do="tfTag" data-g="' + g + '">' + g + '</button>'; }).join('') + '</div></div>' +
      '<div class="p-fld"><span>相关人（可选）</span><div class="who">' + others.map(function (u) { return '<button type="button" class="t-person' + (tf.people.indexOf(u.id) >= 0 ? ' on' : '') + '" data-do="tfPerson" data-u="' + u.id + '">' + av(u.id, true) + esc(u.name) + '</button>'; }).join('') + '</div><small>选了相关人，会归到「团队相关」，对方会收到通知。</small></div></section>' +
      '<section class="p-card"><label class="p-fld"><span>备注</span><textarea data-tf="note" rows="3" maxlength="500" placeholder="补充说明（可选）">' + esc(tf.note) + '</textarea></label></section>' +
      '<button class="n-next" data-do="tfSave">添加待办' + ni('check', 2.4) + '</button>';
  }
  /* AI 智能创建 */
  var ta = { tab: 'rec', lang: 'zh-CN', auto: true, text: '', recording: false, t0: 0, mr: null, sr: null, timer: null, raf: null, ctx: null };
  var LANGS = [['zh-CN', '普通话'], ['zh-HK', '粤语'], ['zh-TW', '台湾国语'], ['en-US', 'English'], ['th-TH', 'ภาษาไทย']];
  function viewTodoAI() {
    var h = pHead('AI 智能创建', '用语音或上传视频，让 AI 帮你生成待办', '<button class="t-help" data-do="taHelp">' + ti('help', 1.7) + '使用说明</button>').replace('<header class="p-head">', '<header class="p-head t-aihead">') +
      '<div class="t-aitabs">' + [['rec', 'mic', '录音输入'], ['video', 'upv', '上传视频'], ['file', 'file', '上传文件']].map(function (t) { return '<button class="' + (ta.tab === t[0] ? 'on' : '') + '" data-do="taTab" data-t="' + t[0] + '">' + ti(t[1], 1.8) + t[2] + '</button>'; }).join('') + '</div>';
    if (ta.tab === 'rec') {
      h += '<section class="a-rec t-rec' + (ta.recording ? ' live' : '') + '">' + waveBars('l') + '<div class="a-mic"><span>' + ni('mic', 1.6) + '</span></div>' + waveBars('r') + '</section>' +
        '<div class="a-time" id="tatimer">' + (ta.recording ? fmtSec(Math.round((Date.now() - ta.t0) / 1000)) : '00:00') + '</div>' +
        '<button class="a-start' + (ta.recording ? ' stop' : '') + '" data-do="' + (ta.recording ? 'taStop' : 'taStart') + '">' + (ta.recording ? '<span class="dot"></span>停止录音' : ni('mic') + '开始录音') + '</button>' +
        '<div class="t-opts"><label class="t-sel"><select data-ta="lang">' + LANGS.map(function (l) { return '<option value="' + l[0] + '"' + (ta.lang === l[0] ? ' selected' : '') + '>' + l[1] + '</option>'; }).join('') + '</select>' + ti('down', 2) + '</label>' +
        '<button class="t-opt' + (ta.auto ? ' on' : '') + '" data-do="taAuto" title="自动识别时间、相关人和优先级">自动识别</button><span class="t-opt">' + ti('clock', 1.7) + '最长 10 分钟</span></div>' +
        (SR || canSrvTr() ? '' : '<p class="t-warn">当前浏览器不支持语音转文字（安卓 Chrome 支持）。可以改用「上传文件」或在下方直接输入。</p>') +
        '<div class="a-or"><span>或</span></div><label class="p-drop t-drop">' + pi('cloud') + '<b>点击上传视频</b><small>支持 MP4、MOV、AVI 等格式<br>单个文件不超过 500MB</small><input type="file" accept="video/*" data-tavideo="1"></label>';
    } else if (ta.tab === 'video') {
      h += '<label class="p-drop t-drop t-big">' + pi('cloud') + '<b>点击上传视频</b><small>支持 MP4、MOV、AVI 等格式<br>单个文件不超过 500MB</small><input type="file" accept="video/*" data-tavideo="1"></label>';
    } else {
      h += '<label class="p-drop t-drop t-big">' + ti('file', 1.6) + '<b>点击上传文件</b><small>支持 TXT、Markdown 文本文件<br>会议记录、聊天记录、清单都可以</small><input type="file" accept=".txt,.md,text/plain,text/markdown" data-tafile="1"></label>';
    }
    h += '<section class="p-card t-text"><label class="p-fld"><span>' + (ta.tab === 'rec' ? '识别内容' : '文字内容') + '</span><textarea data-ta="text" rows="4" maxlength="3000" placeholder="' + (ta.tab === 'file' ? '文件内容会显示在这里，也可以直接粘贴文字' : '识别出的文字会出现在这里，也可以直接输入。例如：明天上午10点和陈立开周会，周五前回复合作方邮件，紧急') + '">' + esc(ta.text) + '</textarea></label></section>' +
      '<section class="a-gen t-gen"><h3>' + hi('spark', 1.6) + 'AI 将为你自动生成</h3><ul>' + ['项目名称（智能命名）', '项目概要（自动总结）', '任务清单（拆解待办）', '优先级与时间建议', '相关标签与负责人建议'].map(function (t) { return '<li>' + ni('check', 2.2) + t + '</li>'; }).join('') + '</ul><i class="t-ring" aria-hidden="true"></i></section>' +
      '<button class="t-gen-btn" data-do="taGen"' + (ta.text.trim() ? '' : ' disabled') + '>生成待办' + ni('arrow', 2) + '</button>' +
      '<p class="t-priv">' + ti('lock', 1.6) + '你的内容仅用于生成待办，不会用于其他用途</p>';
    return h;
  }
  var CN = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12 };
  function parseWhen(t) {
    var base = new Date(); base.setHours(0, 0, 0, 0); var d = null, time = '';
    if (/后天/.test(t)) d = 2; else if (/明天|明早|明晚/.test(t)) d = 1; else if (/今天|今晚|今早|待会|马上/.test(t)) d = 0;
    var m = t.match(/(下周|这周|本周|周|星期)([一二三四五六日天])/);
    if (m && d == null) { var map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 }, target = map[m[2]], cur = base.getDay(); var diff = (target - cur + 7) % 7;
      // 「下周X」= 下一个自然周的周X（今天周三说「下周一」是 5 天后，不是 12 天后）；「这周 / 本周X」= 本周的周X
      if (m[1] === '下周' || m[1] === '这周' || m[1] === '本周') { var mon = (cur + 6) % 7, tw = (target + 6) % 7; diff = tw - mon + (m[1] === '下周' ? 7 : 0); } d = diff; }
    var md = t.match(/(\d{1,2})月(\d{1,2})[日号]/);
    var date;
    if (md) { var y = base.getFullYear(); date = y + '-' + ('0' + md[1]).slice(-2) + '-' + ('0' + md[2]).slice(-2); }
    else { var x = new Date(base); x.setDate(x.getDate() + (d || 0)); date = x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); }
    var tm = t.match(/(\d{1,2})[:：](\d{2})/) || t.match(/(早上|上午|中午|下午|晚上|今晚|明晚)?\s*(\d{1,2}|[一二两三四五六七八九十]{1,2})点(半|(\d{1,2})分?)?/);
    if (tm) {
      if (tm[0].indexOf(':') >= 0 || tm[0].indexOf('：') >= 0) time = ('0' + tm[1]).slice(-2) + ':' + tm[2];
      else { var hh = /\d/.test(tm[2]) ? +tm[2] : CN[tm[2]] || 0; if (/下午|晚上|今晚|明晚/.test(tm[1] || '') && hh < 12) hh += 12; if (/中午/.test(tm[1] || '') && hh < 6) hh += 12; var mm = tm[3] === '半' ? 30 : tm[4] ? +tm[4] : 0; time = ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2); }
    } else if (/晚上|今晚|明晚/.test(t)) time = '20:00'; else if (/下午/.test(t)) time = '15:00'; else if (/上午|早上|明早/.test(t)) time = '09:00';
    return { date: date, time: time };
  }
  function parseTodos(text) {
    var parts = text.replace(/\s+/g, ' ').split(/[。！？!?；;\n]|，?(?:然后|还要|另外|再就是|以及)，?/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length >= 3; });
    var out = [];
    parts.forEach(function (p) {
      p.split(/，(?=[^，]*(?:回复|准备|整理|检查|安排|开|写|发|联系|提交|确认|预订|买|做|完成|跟进|祷告|读))/).forEach(function (c) {
        c = c.trim(); if (c.length < 3 || out.length >= 8) return;
        var w = ta.auto ? parseWhen(c) : { date: TM.todayStr(S), time: '' };
        var people = S.users.filter(function (u) { return u.id !== me && c.indexOf(u.name) >= 0; }).map(function (u) { return u.id; });
        var pr = /紧急|尽快|马上|立刻|重要|务必/.test(c) ? 'hi' : /有空|顺便|不急/.test(c) ? 'lo' : 'mid';
        var tag = /邮件|回复|联系|沟通|电话/.test(c) ? '沟通' : /会|周会|例会/.test(c) ? '会议' : /数据|报表|财务/.test(c) ? '数据' : /祷告|灵修|读经|讲道|聚会/.test(c) ? '事工' : /服务器|部署|更新|备份/.test(c) ? '运维' : /学|读|课/.test(c) ? '学习' : '工作';
        var title = c.replace(/(下周|这周|本周)?(周|星期)[一二三四五六日天]|今天|明天|后天|今晚|明晚|明早|(早上|上午|中午|下午|晚上)?\s*(\d{1,2}|[一二两三四五六七八九十]{1,2})点(半|\d{1,2}分?)?|\d{1,2}[:：]\d{2}|\d{1,2}月\d{1,2}[日号]|之前|以前|前|紧急|尽快|务必|要|得|需要|记得|帮我/g, '').replace(/^[，,\s]+|[，,\s]+$/g, '').trim();
        if (title.length < 2) return;
        out.push({ title: title.slice(0, 50), date: w.date, time: w.time, priority: pr, people: people, tags: [tag], scope: people.length ? 'team' : 'mine', on: true });
      });
    });
    return out;
  }
  function taShowResult(given) {
    // 老板 / 管理员且 AI 启用：交给 Claude 拆待办，失败退回规则
    if (!given && AI_ON && (ta.text || '').trim().length >= 4) {
      toast('Claude 正在拆分待办…');
      TMS.aiTodos(ta.text).then(function (r) { if (!r.items.length) return taShowResult(parseTodos(ta.text)); ta.real = true; taShowResult(r.items); }, function (e) { toast(((e && e.error) || 'AI 暂时不可用') + '，已改用规则拆分', true); taShowResult(parseTodos(ta.text)); });
      return;
    }
    var items = given || parseTodos(ta.text);
    if (!items.length) return toast('没有识别出待办，试着用「明天上午10点和陈立开会」这样的句子', true);
    var PR = { hi: '高', mid: '中', lo: '低' };
    var real = !!(given && ta.real); ta.real = false;
    openSheet('AI 生成的待办', (real ? '<span class="tag ai-real-tag">Claude 拆分，可修改后添加</span>' : '<span class="tag sim">AI 模拟输出，可修改后添加</span>') + items.map(function (x, i) {
      return '<div class="t-res"><label class="t-res-h"><input type="checkbox" name="on' + i + '" checked><input type="text" name="title' + i + '" value="' + esc(x.title) + '" maxlength="50"></label><div class="t-res-m"><input type="date" name="date' + i + '" value="' + x.date + '"><input type="time" name="time' + i + '" value="' + x.time + '"><select name="pr' + i + '">' + ['hi', 'mid', 'lo'].map(function (p) { return '<option value="' + p + '"' + (p === x.priority ? ' selected' : '') + '>' + PR[p] + '优先级</option>'; }).join('') + '</select></div>' +
        '<div class="t-res-t"><i class="k-gray">' + esc(x.tags[0]) + '</i>' + x.people.map(function (u) { return av(u, true) + '<span>' + esc(nm(u)) + '</span>'; }).join('') + '</div></div>';
    }).join(''), '添加到待办', function (o) {
      var n = 0, err = '';
      items.forEach(function (x, i) { if (!o['on' + i]) return; var r = TM.act(S, me, 'todo.create', { title: o['title' + i], date: o['date' + i], time: o['time' + i], priority: o['pr' + i], people: x.people, tags: x.tags, scope: x.scope, source: 'ai' }); if (r.ok) n++; else err = r.error; });
      if (!n) return toast(err || '请至少选一条', true);
      save(); closeSheet(); ta.text = ''; td.day = TM.todayStr(S); td.view = 'list'; td.filter = 'all'; navFinish('#/tasks'); toast('已添加 ' + n + ' 条待办');
    });
  }
  function taStop() {
    if (!ta.recording) return; ta.recording = false; clearInterval(ta.timer); cancelAnimationFrame(ta.raf);
    try { ta.ctx && ta.ctx.close(); } catch (e) {}
    if (ta.sr) { var r = ta.sr; ta.sr = null; try { r.stop(); } catch (e) {} }
    try { ta.mr && ta.mr.stop(); } catch (e) {}
    render();
  }
  var TD = {
    tdDay: function (el) { td.day = el.dataset.d; td.showDone = false; td.calMonth = td.day.slice(0, 7); render(); },
    tdOpts: function () { openSheet('显示设置', '<div class="fld"><span>视图</span><div class="opts">' + opt('view', 'list', '列表', '按时间顺序', td.view !== 'group') + opt('view', 'group', '分组', '高优先级、我负责、团队相关、其他', td.view === 'group') + '</div></div>', '应用', function (o) { td.view = o.view; closeSheet(); render(); }); },
    tdCal: function () { td.calOpen = !td.calOpen; td.calMonth = td.day.slice(0, 7); render(); },
    tdPick: function (el) { td.stripScroll = null; td.day = el.dataset.d; td.calMonth = td.day.slice(0, 7); td.showDone = false; td.calOpen = false; render(); },
    tdMonth: function (el) { var y = +td.calMonth.slice(0, 4), m = +td.calMonth.slice(5, 7) - 1 + (+el.dataset.n), d = new Date(y, m, 1); td.calMonth = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); render(); },
    tdView: function (el) { td.view = el.dataset.v; render(); },
    tdFilter: function (el) { td.filter = el.dataset.f; render(); },
    tdShowDone: function () { td.showDone = !td.showDone; render(); },
    tdGroup: function (el) { td.view = 'list'; td.filter = el.dataset.g === 'hi' ? 'hi' : el.dataset.g === 'mine' ? 'mine' : 'all'; render(); },
    tdToggle: function (el) { var r = TM.act(S, me, 'todo.toggle', { id: el.dataset.id }); if (!r.ok) return toast(r.error, true); save(); var t = S.todos.find(function (x) { return x.id === el.dataset.id; }); toast(t && t.done ? (r.next ? '已完成，下一次在 ' + mdTxt(r.nextDate) : '已完成') : '已恢复为未完成'); render(); },
    tdOpen: function (el) { tdDetail(el.dataset.id); },
    tdComment: function (el) { var v = (document.getElementById('tdc') || {}).value; var r = TM.act(S, me, 'todo.comment', { id: el.dataset.id, body: v }); if (!r.ok) return toast(r.error, true); save(); tdDetail(el.dataset.id); render(); tdDetail(el.dataset.id); },
    tdDelete: function (el) { var id = el.dataset.id; askSheet('删除待办', '确定删除这条待办？', '删除', true).then(function (y) { if (y) act('todo.delete', { id: id }, '已删除'); }); },
    tdManual: function (el) { tf = freshTF(el.dataset.t, el.dataset.title || ''); location.hash = '#/todo/new/manual'; },
    tdAllTpl: function () { openSheet('全部模板', '<div class="t-tgrid">' + TPLS.map(function (t) { return '<button type="button" data-do="tdManual" data-t="' + t.key + '"><span class="' + t.c + '">' + ti(t.icon, 1.8) + '</span><b>' + t.name + '</b><small>' + t.sub + '</small></button>'; }).join('') + '</div>', '关闭', function () { closeSheet(); }); },
    tdClearRecent: function () { act('todo.clearRecent', {}, '已清空'); },
    tfSet: function (el) { tf[el.dataset.k] = el.dataset.v; render(); },
    tfTag: function (el) { var g = el.dataset.g, i = tf.tags.indexOf(g); if (i >= 0) tf.tags.splice(i, 1); else if (tf.tags.length < 4) tf.tags.push(g); else toast('最多 4 个标签', true); render(); },
    tfPerson: function (el) { var u = el.dataset.u, i = tf.people.indexOf(u); if (i >= 0) tf.people.splice(i, 1); else tf.people.push(u); if (tf.people.length) tf.scope = 'team'; render(); },
    tfSave: function () {
      var r = TM.act(S, me, 'todo.create', { title: tf.title, date: tf.date, time: tf.time, priority: tf.priority, scope: tf.scope, tags: tf.tags, people: tf.people, note: tf.note, tpl: tf.tpl ? { key: tf.tpl.key, title: tf.title } : null });
      if (!r.ok) return toast(r.error, true);
      save(); td.day = tf.date; td.view = 'list'; td.filter = 'all'; tf = null; navFinish('#/tasks'); toast('已添加待办');
    },
    taTab: function (el) { if (ta.recording) taStop(); ta.tab = el.dataset.t; render(); },
    taAuto: function () { ta.auto = !ta.auto; render(); toast(ta.auto ? '会自动识别时间、相关人和优先级' : '已关闭自动识别，全部按今天处理'); },
    taHelp: function () { openSheet('使用说明', '<ol class="t-help-l"><li>点「开始录音」，像平时说话一样说出要做的事，比如「明天上午10点和陈立开周会，周五前回复合作方邮件，紧急」。</li><li>说完点「停止录音」，识别出的文字会出现在下方，可以修改。</li><li>点「生成待办」，AI 会拆成多条待办，并识别时间、相关人和优先级。</li><li>也可以上传文本文件，或直接粘贴文字。</li></ol><div class="callout">演示版：语音转文字用的是浏览器自带的识别（安卓 Chrome 支持）；拆解由规则模拟，不调用真实大模型；视频暂时无法解析。</div>', '知道了', function () { closeSheet(); }); },
    taStart: function () {
      if (!(navigator.mediaDevices && window.MediaRecorder)) return toast('当前浏览器不支持录音', true);
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var mr = new MediaRecorder(stream), tchunks = []; ta.mr = mr; ta.recording = true; ta.t0 = Date.now(); var tn0 = ta.text.length;
        mr.ondataavailable = function (e) { tchunks.push(e.data); };
        mr.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          // 手机没转出文字：交给服务器转，结果追加到文字框
          if (ta.text.length === tn0 && canSrvTr()) { srvTr(new Blob(tchunks, { type: mr.mimeType || 'audio/webm' }), '录音').then(function (t) { if (t) { ta.text = (ta.text + (ta.text ? '\n' : '') + t).slice(0, 3000); render(); toast('已转成文字，可以点「AI 生成待办」'); } else toast('录音里没有识别到说话，可以在下方直接输入', true); }, function () {}); return; }
          if (!ta.text.trim()) toast(SR ? '没有识别到清晰的语音，可以在下方直接输入' : '当前浏览器不支持转文字，请在下方输入或上传文件', true); render();
        };
        mr.start();
        try { var AC = window.AudioContext || window.webkitAudioContext, ctx = new AC(), an = ctx.createAnalyser(); an.fftSize = 64; ctx.createMediaStreamSource(stream).connect(an); ta.ctx = ctx; var buf = new Uint8Array(an.frequencyBinCount); var loop = function () { an.getByteFrequencyData(buf); document.querySelectorAll('.t-rec .a-wave i').forEach(function (b, i) { var v = buf[(i % 12) + 2] / 255; b.style.height = Math.max(4, Math.round(+b.dataset.h * (0.25 + v * 1.4))) + 'px'; }); ta.raf = requestAnimationFrame(loop); }; loop(); } catch (e) {}
        if (SR) { try { var r = new SR(); r.lang = ta.lang; r.continuous = true; r.onresult = function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { ta.text = (ta.text + e.results[i][0].transcript + '。').slice(0, 3000); var x = document.querySelector('[data-ta="text"]'); if (x) x.value = ta.text; var g = document.querySelector('[data-do=taGen]'); if (g) g.disabled = false; } }; srKeep(r, function () { return ta.recording && ta.sr === r; }, srGaveUp); r.start(); ta.sr = r; } catch (e) {} }
        ta.timer = setInterval(function () { var s2 = Math.round((Date.now() - ta.t0) / 1000); var t = document.getElementById('tatimer'); if (t) t.textContent = fmtSec(s2); if (s2 >= 600) { taStop(); toast('已到 10 分钟上限，自动停止'); } }, 500);
        render();
      }).catch(function () { toast('没有拿到麦克风权限，请在浏览器设置里允许后再试', true); });
    },
    taStop: taStop,
    taGen: function () { if (ta.recording) taStop(); taShowResult(); }
  };
