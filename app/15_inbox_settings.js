/* app/15_inbox_settings.js — 通知、设置。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
  /* ---------- 页面：通知、设置 ---------- */
  function nKind(n) { var t = n.title + n.body; return /决策/.test(t) ? 'dec' : /@|提到了你/.test(t) ? 'at' : /邀请|加入|新成员/.test(t) ? 'team' : /进度|完成|里程碑|阶段|项目/.test(n.title) ? 'proj' : /待办|评论|留言|建议|提醒/.test(t) ? 'cmt' : 'sys'; }
  var NK = {
    dec: ['n-red', '<svg viewBox="0 0 24 24"><path d="M6 21V4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M6 4h12l-3 4.5 3 4.5H6z" fill="currentColor"/></svg>'],
    at: ['n-blue', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3.8"/><path d="M15.8 12v1.6a2.6 2.6 0 0 0 5.2 0V12a9 9 0 1 0-3.6 7.2"/></svg>'],
    cmt: ['n-green', '<svg viewBox="0 0 24 24"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="currentColor"/><circle cx="8.5" cy="11" r="1.2" fill="#fff"/><circle cx="12" cy="11" r="1.2" fill="#fff"/><circle cx="15.5" cy="11" r="1.2" fill="#fff"/></svg>'],
    team: ['n-purple', '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.4" fill="currentColor"/><path d="M2.8 19.5c.6-3.6 3.2-5.6 6.2-5.6s5.6 2 6.2 5.6z" fill="currentColor"/><circle cx="16.8" cy="8.6" r="2.7" fill="currentColor" opacity=".7"/><path d="M15.6 13.9c2.9.2 4.9 2.1 5.6 5.6h-4.3" fill="currentColor" opacity=".7"/></svg>'],
    proj: ['n-orange', '<svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor"/><path d="M9.5 13h6M9.5 16.5h4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>'],
    sys: ['n-gray', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>']
  };
  var nf = 'all';
  function dayBucket(t) { var d = new Date(t), n = new Date(); n.setHours(0, 0, 0, 0); var diff = Math.floor((n - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); return diff <= 0 ? '今天' : diff === 1 ? '昨天' : '更早'; }
  function nTime(t) { var b = dayBucket(t); if (b === '今天') return ago(t); if (b === '昨天') { var d = new Date(t); return '昨天 ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); } return ago(t); }
  function viewInbox() {
    var st2 = homeStats();
    var tiles = '<div class="n-stats">' + st2.map(function (x) { var foot = x.foot ? '<small class="n-sf">' + esc(x.foot.replace('共 ', '共 ').replace(' 项任务', ' 项')) + '</small>' : x.delta ? '<small class="' + (x.bad ? 'n-up bad' : 'n-up good') + '">' + hi(x.delta > 0 ? 'up' : 'down', 2.6) + Math.abs(x.delta) + (x.unit || '') + '</small>' : '<small class="n-sf">持平</small>'; return '<a class="n-stat ' + x.cls + '" href="#/stat/' + x.k + '">' + hi(x.icon, 1.6) + '<b>' + x.n + '</b><span>' + esc(x.label) + '</span>' + foot + '</a>'; }).join('') + '</div>';
    var F = [['all', '全部'], ['todo', '今日待办'], ['at', '@我'], ['sys', '系统']];
    var chips = '<div class="n-chips">' + F.map(function (f) { return '<button class="' + (nf === f[0] ? 'on' : '') + '" data-do="nFilter" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>';
    var body = '';
    if (nf === 'todo') {
      var td3 = homeTodos().filter(function (x) { return !x.done; });
      body = td3.length ? '<h3 class="n-g">今天</h3>' + td3.map(function (x) { var k = /决策/.test(x.title) ? 'dec' : /想法|草稿/.test(x.title) ? 'proj' : 'cmt'; return '<a class="n-row" href="' + x.href + '"><span class="n-ic ' + NK[k][0] + '">' + NK[k][1] + '</span><span class="n-t"><b>' + esc(x.title) + '</b><small>' + PRIO[x.prio][0] + ' · ' + esc(x.tag[0]) + '</small></span><span class="n-r"><time>' + esc(x.due.t) + '</time>' + hi('chev', 2) + '</span></a>'; }).join('') : emptyBox('今天没有待办。');
    } else {
      var ns = S.notifications.filter(function (n) { return n.userId === me; }).filter(function (n) { var k = nKind(n); return nf === 'all' || (nf === 'at' ? k === 'at' : k === 'sys' || k === 'proj'); }).sort(function (a, b) { return b.at - a.at; });
      var groups = {}; ns.forEach(function (n) { var g = dayBucket(n.at); (groups[g] = groups[g] || []).push(n); });
      body = ns.length ? ['今天', '昨天', '更早'].filter(function (g) { return groups[g]; }).map(function (g) {
        return '<h3 class="n-g">' + g + '</h3>' + groups[g].map(function (n) { var k = nKind(n); return '<a class="n-row' + (n.read ? '' : ' unread') + '" href="' + esc(n.link || '#/inbox') + '" data-do="readOne" data-id="' + n.id + '"><span class="n-ic ' + NK[k][0] + '">' + NK[k][1] + '</span><span class="n-t"><b>' + esc(n.title) + '</b><small>' + esc(n.body || (n.from && n.from !== 'system' ? '来自 ' + TM.name(S, n.from) : '系统通知')) + '</small></span><span class="n-r"><time>' + nTime(n.at) + '</time>' + (n.read ? hi('chev', 2) : '<i class="n-dot"></i>') + '</span></a>'; }).join('');
      }).join('') : emptyBox('没有通知。');
    }
    return '<header class="n-head"><button class="circle" data-do="back" aria-label="返回">' + hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button><h1>通知</h1><button class="n-all" data-do="readAll"' + (unread() ? '' : ' disabled') + '>全部标为已读</button></header>' + tiles + chips + body + '<div class="n-end"><i></i>没有更多了</div>';
  }

  function viewSettings() {
    var u = TM.user(S, me), cs = S.settings, can = isOwner() || TM.hasRole(S, me, 'admin'), dis = can ? '' : ' disabled';
    var sw = function (k, title, desc, code) { return '<label class="sw"><span><b>' + title + '</b><small>' + desc + (code ? '<br><span class="code">' + code + '</span>' : '') + '</small></span><input type="checkbox" data-set="' + k + '"' + (cs[k] ? ' checked' : '') + dis + '></label>'; };
    var h = ixHead('更多设置', '流程开关、提醒与演示工具') + '<div class="st2"><div class="card" style="display:flex;align-items:center;gap:14px">' + av(me) + '<div style="flex:1"><b style="font-size:17px">' + esc(u.name) + '</b><div class="muted" style="font-size:14px">' + esc(u.title) + '，' + u.roles.map(function (a) { return L.role[a.role]; }).join('、') + '</div></div><button class="btn" data-do="switch">切换账号</button></div>';
    h += sec('流程开关') + '<div class="card">' + (can ? '' : '<div class="callout">只有老板或管理员可以修改，你可以查看当前设置。</div>') +
      '<label class="sw"><span><b>老板确认范围</b><small>只送例外：战略、超预算、人事、重要发布才找老板。每条都送：所有想法派发前都要老板确认。</small></span><select data-set="ownerApprovalMode"' + dis + '><option value="exceptions_only"' + (cs.ownerApprovalMode === 'exceptions_only' ? ' selected' : '') + '>只送例外</option><option value="all"' + (cs.ownerApprovalMode === 'all' ? ' selected' : '') + '>每条都送</option></select></label>' +
      sw('agentDirectRoute', 'AI 助理可直接送人', '打开后，在「每条都送」模式下 AI 整理完直接送到老板待决策；派发、立项始终由人点。') +
      sw('ownerFinalAdmin', '行政任务老板终验', '运营者验收后，再进入老板终验。') +
      sw('ownerFinalProduct', '产品任务老板终验', '负责人验收后，再进入老板终验。') +
      sw('showTiers', '显示一级、二级标签', '只是界面分组标签，不影响权限：运营者、负责人为一级，执行者为二级。') + '</div>';
    h += sec('公司与提醒') + '<div class="card"><label class="fld"><span>公司方向与长期目标</span><textarea data-set="direction" rows="3"' + (isOwner() ? '' : ' disabled') + '>' + esc(cs.direction) + '</textarea><small>AI 整理时用来判断新想法是否与现有业务形成闭环。由老板填写。</small></label>' +
      '<div class="row2"><label class="fld"><span>无动态提醒（天）</span><input type="number" min="1" max="30" data-set="staleDays" value="' + cs.staleDays + '"' + dis + '></label><label class="fld"><span>超预算阈值（元）</span><input type="number" min="0" step="1000" data-set="budgetThreshold" value="' + (cs.budgetThreshold || '') + '"' + dis + '></label></div></div>';
    if (!myCaps().tasks && !isOwner()) {} else h += sec('报表') + '<div class="card"><p class="muted" style="margin:0 0 10px;font-size:14px">导出成表格，用 Excel、WPS 或 Numbers 打开。</p><button class="btn block" data-do="csvTasks">导出任务表</button><button class="btn block mt" data-do="csvWorks">导出项目表</button></div>';
    h += SRV ? sec('数据') + '<div class="card"><p class="muted" style="margin:0 0 10px;font-size:14px">服务器：' + esc(TMS.serverUrl()) + '</p><button class="btn block" data-do="srvUsage">使用情况（AI 费用、设备、空间）</button><button class="btn block mt" data-do="srvOps">操作日志（谁做了什么）</button>' + (isOwner() ? '<button class="btn block mt" data-do="srvExportFull">完整备份（含全部附件，压缩包）</button><button class="btn block mt" data-do="srvExport">只导出团队数据（JSON）</button>' : '') + '<div class="mt"></div>' + (isOwner() && !S.real ? '<button class="btn danger block" data-do="clearDemo">清空示例内容（保留成员和设置）</button>' : '<p class="muted" style="margin:0;font-size:13.5px">数据每天自动备份在服务器的 backups 目录。</p>') + '</div>' :
      sec('演示工具') + '<div class="card">' + sw('demoAiFail', '模拟 AI 失败', '用来演示「AI 失败后运营者手写整理稿继续推进」。') +
      '<div class="callout">演示版里：账号是预设的；AI 整理和共创汇总由规则模拟生成，界面都标了「AI 模拟输出」；录音只在本机，不上传、不转写；通知只在 App 内。</div>' +
      (isOwner() ? '<button class="btn block" data-do="clearDemo">清空示例内容（保留成员和设置）</button>' : '') + '<button class="btn danger block mt" data-do="reset">重置全部演示数据</button></div>';
    if (TM.hasRole(S, me, 'admin') || isOwner()) h += membersHTML();
    h += '</div>';
    return h;
  }

