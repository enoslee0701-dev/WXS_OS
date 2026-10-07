/* app/10_team_me.js — 团队、我的。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
  /* ---------- 团队 ---------- */
  var tm = { group: 'all' };
  var SKC = ['k-blue', 'k-violet', 'k-green'];
  var PRES = { online: ['在线', '#16C47F'], away: ['离开', '#F59E0B'], busy: ['忙碌', '#F03E50'], offline: ['离线', '#9AA3B2'] };
  function hoCount(uid) { var o = TM.openWorkOf(S, uid); return o.tasks.length + o.reviews.length + o.works.length + o.ideas.length; }
  function tCounts(uid) { var mine = S.tasks.filter(function (t) { return t.ownerId === uid; }); return { prog: mine.filter(function (t) { return ['done', 'cancelled'].indexOf(t.status) < 0; }).length, done: mine.filter(function (t) { return t.status === 'done'; }).length }; }
  function weekDue() { var ws = weekStart(0).getTime(), we = ws + 7 * 864e5; return scopeTasks().filter(function (t) { if (!t.due || ['done', 'cancelled'].indexOf(t.status) >= 0) return false; var p = t.due.split('-'), d = new Date(+p[0], p[1] - 1, +p[2]).getTime(); return d >= ws && d < we; }); }
  function viewTeamPage() {
    var us = TM.activeUsers(S), G = TM.GROUPS, sel = tm.group;
    var rows = us.concat(S.users.filter(function (u) { return u.inactive; })).filter(function (u) { return sel === 'all' || u.group === sel; });
    var actProj = vWork().filter(function (w) { return ['active', 'blocked', 'planning', 'acceptance'].indexOf(w.status) >= 0; }).length;
    var wr = weekRate(0), eff = wr.rate == null ? '—' : wr.rate + '%';
    var tiles = [['tm-blue', '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.4" fill="currentColor"/><path d="M2.8 19.5c.6-3.6 3.2-5.6 6.2-5.6s5.6 2 6.2 5.6z" fill="currentColor"/><circle cx="16.8" cy="8.6" r="2.7" fill="currentColor" opacity=".7"/><path d="M15.6 13.9c2.9.2 4.9 2.1 5.6 5.6h-4.3" fill="currentColor" opacity=".7"/></svg>', us.length, '团队成员', 'tmMembers'],
      ['tm-green', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M8 12.3l2.8 2.8 5.2-5.6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>', actProj, '进行中项目', 'tmProjects'],
      ['tm-orange', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M12 7.5V12l3 2" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>', weekDue().length, '本周到期', 'tmDue'],
      ['tm-purple', '<svg viewBox="0 0 24 24"><rect x="4" y="13" width="4" height="7" rx="1.5" fill="currentColor" opacity=".55"/><rect x="10" y="9" width="4" height="11" rx="1.5" fill="currentColor" opacity=".8"/><rect x="16" y="5" width="4" height="15" rx="1.5" fill="currentColor"/></svg>', eff, '团队效率', 'tmRate']];
    var canInvite = isOwner() || TM.hasRole(S, me, 'admin');
    return stdHero({ back: true, title: '团队', bg: 'var(--hero)', pos: '40% 70%', sub: '不同的恩赐，同一个使命。', verse: ['两个人总比一个人好，<br>因为二人劳碌同得美好的果效。', '传道书 4:9'], script: 'Better<br>&nbsp;Together',
      actions: '<button class="tk-ic w-ic" data-do="tmSearch" aria-label="搜索成员">' + hi('search', 1.8) + '</button>' + (canInvite ? '<button class="w-plus" data-do="tmInvite" aria-label="邀请新成员">' + ti('plus2', 2.4) + '</button>' : ''),
      pill: '<button class="tk-month tm-count" data-do="tmMembers">' + ai2('team', 1.6) + '<b>' + us.length + '</b> 位伙伴' + (S.users.length > us.length ? '<small class="tm-offn">· 已停用 ' + (S.users.length - us.length) + '</small>' : '') + ai2('downc', 1.8) + '</button>' }) +
      '<div class="w-chips tm-chips"><button class="' + (sel === 'all' ? 'on' : '') + '" data-do="tmGroup" data-g="all">全部 <i>' + S.users.length + '</i></button>' + G.slice(1).concat(G.slice(0, 1)).map(function (g) { var n = us.filter(function (u) { return u.group === g; }).length; return n ? '<button class="' + (sel === g ? 'on' : '') + '" data-do="tmGroup" data-g="' + g + '">' + g + ' <i>' + n + '</i></button>' : ''; }).join('') + '</div>' +
      rows.map(memberCard).join('') +
      (canInvite ? '<button class="tm-invite" data-do="tmInvite"><span class="tm-ip">' + ti('plus2', 2.4) + '</span><span><b>邀请新成员</b><small>' + (canInvite ? '一起打造更好的团队' : '由老板或管理员添加成员') + '</small></span><svg class="tm-ppl" viewBox="0 0 120 60" aria-hidden="true"><g fill="#C9D8FB"><circle cx="30" cy="22" r="10"/><path d="M12 60c1-14 8-22 18-22s17 8 18 22z"/><circle cx="90" cy="22" r="10"/><path d="M72 60c1-14 8-22 18-22s17 8 18 22z"/></g><g fill="#B3C8F8"><circle cx="60" cy="16" r="13"/><path d="M36 60c1-17 10-27 24-27s23 10 24 27z"/></g></svg>' + hi('chev', 2) + '</button>' : '');
  }
  function memberCard(u) {
    var c = tCounts(u.id), p = PRES[u.presence || 'offline'];
    return '<article class="tm-card' + (u.inactive ? ' off' : '') + '"><span class="tm-av">' + av(u.id) + '<i style="background:' + p[1] + '" title="' + p[0] + '"></i></span><div class="tm-mid"><div class="tm-name"><b>' + esc(u.name) + '</b>' + (u.inactive ? '<em class="tm-off">已停用</em>' : '') + (TM.hasRole(S, u.id, 'owner') ? '<svg class="tm-crown" viewBox="0 0 24 24" aria-label="创始人"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="#F5B300"/></svg>' : '') + '<i>' + esc(u.title) + '</i></div>' +
      '<div class="tm-sub"><q>' + esc(u.motto || '还没有写一句话') + '</q>' + ((u.skills || []).length && !TM.hasRole(S, u.id, 'owner') ? '<span class="t-tags">' + u.skills.map(function (k, i) { return '<i class="' + SKC[i % 3] + '">' + esc(k) + '</i>'; }).join('') + '</span>' : '') + '</div></div>' +
      '<div class="tm-num"><span><b>' + c.prog + '</b><small>进行中</small></span><span><b>' + c.done + '</b><small>已完成</small></span></div><button class="w-more" data-do="tmMember" data-u="' + u.id + '" aria-label="' + esc(u.name) + ' 的更多操作">' + ti('more', 1.6) + '</button></article>';
  }
  var TMD = {
    tmGroup: function (el) { tm.group = el.dataset.g; render(); },
    tmMembers: function () { tm.group = 'all'; render(); var x = document.querySelector('.tm-chips'); if (x) x.scrollIntoView({ behavior: 'smooth' }); },
    tmProjects: function () { filt.work = 'active'; location.hash = '#/work'; },
    tmRate: function () { location.hash = '#/stat/rate'; },
    tmDue: function () {
      var xs = weekDue().sort(function (a, b) { return a.due.localeCompare(b.due); });
      openSheet('本周到期', xs.length ? '<div class="list">' + xs.map(function (t) { return taskRow(t); }).join('') + '</div>' : emptyBox('本周没有到期的任务。'), '关闭', function () { closeSheet(); });
    },
    tmSearch: function () {
      openSheet('搜索成员', '<input type="text" id="tmq" placeholder="输入姓名、职位或擅长领域" autocomplete="off"><div id="tmr" class="mt"></div>', '关闭', function () { closeSheet(); });
      var q = document.getElementById('tmq'); q.focus();
      q.addEventListener('input', function () { var k = q.value.trim(); var r = !k ? [] : S.users.filter(function (u) { return (u.name + u.title + (u.skills || []).join('') + (u.motto || '')).indexOf(k) >= 0; }); document.getElementById('tmr').innerHTML = !k ? '' : r.length ? r.map(memberCard).join('') : emptyBox('没有找到「' + k + '」'); });
    },
    tmMember: function (el) {
      var u = TM.user(S, el.dataset.u), self = u.id === me, mg = !u.inactive && (self || isOwner() || TM.hasRole(S, me, 'admin')), c = tCounts(u.id), p = u.inactive ? ['已停用', '#B8BFCB'] : PRES[u.presence || 'offline']; // 停用的人：资料只读、状态显示「已停用」
      var ts = S.tasks.filter(function (t) { return t.ownerId === u.id && ['done', 'cancelled'].indexOf(t.status) < 0 && TM.canViewTask(S, me, t); });
      openSheet(u.name, '<div class="tm-prof">' + av(u.id) + '<div><b>' + esc(u.name) + '</b><small>' + esc(u.title) + '，' + u.roles.map(function (a) { return L.role[a.role]; }).join('、') + '</small><small><i style="background:' + p[1] + '"></i>' + p[0] + '　' + esc(u.group || '') + '</small></div></div>' +
        (mg ? field('一句话', '<input type="text" name="motto" maxlength="30" value="' + esc(u.motto || '') + '">') + field('擅长领域（最多 3 个，用顿号分隔）', '<input type="text" name="skills" value="' + esc((u.skills || []).join('、')) + '">') +
          '<div class="fld"><span>状态</span><div class="opts tdpr">' + Object.keys(PRES).map(function (k) { return opt('presence', k, PRES[k][0], '', (u.presence || 'offline') === k); }).join('') + '</div></div>' : '<p class="tm-motto">“' + esc(u.motto || '') + '”</p>') +
        '<div class="fld"><span>手上的任务（' + c.prog + ' 项进行中，你能看到 ' + ts.length + ' 项）</span>' + (ts.length ? '<div class="list">' + ts.map(function (t) { return taskRow(t); }).join('') + '</div>' : '<p class="muted" style="font-size:13.5px">没有你能看到的进行中任务。</p>') + '</div>' +
        (isOwner() && !TM.hasRole(S, u.id, 'owner') && !u.inactive ? '<button type="button" class="btn block mt" data-do="tmRole" data-u="' + u.id + '">调整角色</button>' : '') +
        // 管理员手机上看不到任务，所以停用的人总是给交接按钮，以服务器结果为准
        ((isOwner() || TM.hasRole(S, me, 'admin')) && u.id !== me && !TM.hasRole(S, u.id, 'owner') && (hoCount(u.id) || u.inactive) ? '<button type="button" class="btn block mt' + (u.inactive ? ' pri' : '') + '" data-do="tmHandover" data-u="' + u.id + '">交接 TA 手上的工作' + (hoCount(u.id) ? '（' + hoCount(u.id) + ' 项）' : '') + '</button>' : '') +
        (!u.inactive && canAssign() && !TM.user(S, u.id).roles.every(function (a) { return a.role === 'admin' || a.role === 'owner'; }) ? '<button type="button" class="btn block mt" data-do="tmAssignTo" data-u="' + u.id + '">给 ' + esc(u.name) + ' 分配任务</button>' : '') +
        (SRV && TMS.loggedIn() && (isOwner() || TM.hasRole(S, me, 'admin')) && (!TM.hasRole(S, u.id, 'owner') || u.id === me) ? '<button type="button" class="btn block mt" data-do="srvAccount" data-u="' + u.id + '">登录账号与密码</button>' : ''),
        mg ? '保存' : '关闭', function (o) { if (!mg) return closeSheet(); act('member.update', { id: u.id, motto: o.motto, skills: (o.skills || '').split(/[、,，\s]+/), presence: o.presence }, '资料已更新'); });
    },
    tmRole: function (el) {
      var u = TM.user(S, el.dataset.u), cur0 = u.roles[0] || {};
      var R = [['executor', '执行者', '接收并完成任务'], ['lead', '负责人', '可发起想法、规划项目、验收'], ['operator', '运营者', '认领想法、派发、跟进'], ['admin', '管理员', '管理账号、流程设置、知识库，看不到想法内容']];
      openSheet('调整 ' + u.name + ' 的角色', '<div class="fld"><span>角色</span><div class="opts">' + R.map(function (r) { return opt('role', r[0], r[1], r[2], cur0.role === r[0]); }).join('') + '</div></div>' +
        '<label class="sw"><span><b>负责人可发起想法</b><small>只对负责人有效</small></span><input type="checkbox" name="canInitiate" value="1"' + (cur0.role !== 'lead' || cur0.canInitiate ? ' checked' : '') + '></label>', '保存', function (o) {
          var r = act('member.role', { id: u.id, role: o.role, canInitiate: !!o.canInitiate }); if (!r.ok) return;
          toast('已调整为' + L.role[o.role] + (r.keep ? '。TA 还担任 ' + r.keep + ' 个项目的负责人或跟进人，需要时在项目「更换人员」里改' : ''), !!r.keep);
        });
    },
    tmHandover: function (el) {
      var u = TM.user(S, el.dataset.u), ow = TM.openWorkOf(S, u.id), to = TM.activeUsers(S).filter(function (x) { return x.id !== u.id && !x.roles.every(function (a) { return a.role === 'admin'; }); });
      openSheet('交接 ' + u.name + ' 的工作', '<div class="callout">' + [ow.tasks.length && ow.tasks.length + ' 个未完成任务', ow.reviews.length && ow.reviews.length + ' 个待 TA 验收的任务', ow.works.length && ow.works.length + ' 个项目里的负责人 / 跟进 / 验收角色', ow.ideas.length && ow.ideas.length + ' 条跟进中的想法'].filter(Boolean).join('、') + '，一起转给下面这位。接手人没有相应角色的部分会保留并告诉你。</div>' +
        field('接手人', userSelect('to', to.map(function (x) { return x.id; }), (to[0] || {}).id)), '交接', function (o) {
          var r = act('member.handover', { from: u.id, to: o.to }); if (!r.ok) return;
          var nn = (r.tasks || 0) + (r.reviews || 0) + (r.works || 0) + (r.ideas || 0);
          toast(nn ? '已交接给 ' + nm(o.to) + (r.skipped && r.skipped.length ? '；未转：' + r.skipped.join('；') : '') : SRV ? '已提交，服务器会把 TA 的工作转给 ' + nm(o.to) : 'TA 手上没有需要交接的工作', !!(r.skipped && r.skipped.length));
        });
    },
    tmAssignTo: function (el) { asg = freshAsg(); asg.ownerId = el.dataset.u; closeSheet(); location.hash = '#/assign'; },
    tmInvite: function () {
      if (!(isOwner() || TM.hasRole(S, me, 'admin'))) return toast('只有老板或管理员可以添加成员', true);
      openSheet('邀请新成员', field('姓名', '<input type="text" name="name" maxlength="20" placeholder="例如：王五">') + field('职位', '<input type="text" name="title" maxlength="12" placeholder="例如：摄影师">') +
        '<div class="fld"><span>角色</span><div class="opts">' + opt('role', 'executor', '执行者', '接收并完成任务', true) + opt('role', 'lead', '负责人', '可发起想法、规划项目、验收') + opt('role', 'operator', '运营者', '认领想法、派发、跟进') + (isOwner() ? opt('role', 'admin', '管理员', '管理账号、流程设置、知识库，看不到想法内容') : '') + '</div></div>' +
        field('分组', '<select name="group">' + TM.GROUPS.map(function (g) { return '<option' + (g === '行政运营' ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select>') +
        field('擅长领域（可选）', '<input type="text" name="skills" placeholder="用顿号分隔，例如：摄影、剪辑">') + field('联系方式（可选）', '<input type="text" name="contact" placeholder="手机号或邮箱">', (SRV ? '添加后为 TA 分派登录账号和初始密码。' : '演示版不会真的发送邀请。正式版会通过短信或邮件邀请对方登录。')), '添加成员',
        function (o) { var n0 = S.users.length, r = act('member.add', { name: o.name, title: o.title, role: o.role, group: o.group, skills: (o.skills || '').split(/[、,，\s]+/), contact: o.contact }, '已添加成员'); if (r.ok && SRV && S.users.length > n0) setTimeout(function () { DO.srvAccount(S.users[S.users.length - 1].id); }, 400); });
    }
  };
  /* ---------- 我的 ---------- */
  var ROLE_BADGE = { owner: '老板', operator: '运营者', lead: '负责人', executor: '执行者', admin: '管理员' };
  var ROLE_DUTY = { owner: '团队创始人', operator: '想法跟进与派发', lead: '项目规划与验收', executor: '任务执行与交付', admin: '账号与配置管理' };
  function viewMe() {
    var u = TM.user(S, me), r = role(), cs = S.settings, can = isOwner() || TM.hasRole(S, me, 'admin'), dis = can ? '' : ' disabled', p = PRES[u.presence || 'offline'];
    var sc = scopeTasks(), open = sc.filter(function (t) { return ['done', 'cancelled'].indexOf(t.status) < 0; }).length;
    var ws = weekStart(0).getTime(), weekDone = {}; S.reviews.forEach(function (x) { if (x.taskId && (x.verdict === 'pass' || x.verdict === 'owner_pass') && x.at >= ws && sc.some(function (t) { return t.id === x.taskId && t.status === 'done'; })) weekDone[x.taskId] = 1; });
    var wr = weekRate(0), nU = unread(), pref = u.prefs || {};
    var tiles = [['tm-blue', '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.4" fill="currentColor"/><path d="M2.8 19.5c.6-3.6 3.2-5.6 6.2-5.6s5.6 2 6.2 5.6z" fill="currentColor"/><circle cx="16.8" cy="8.6" r="2.7" fill="currentColor" opacity=".7"/><path d="M15.6 13.9c2.9.2 4.9 2.1 5.6 5.6h-4.3" fill="currentColor" opacity=".7"/></svg>', S.users.length, '团队成员', '#/team'],
      ['tm-green', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M8 12.3l2.8 2.8 5.2-5.6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>', open, '进行中任务', '#/tasks'],
      ['tm-orange', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M12 7.5V12l3 2" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>', Object.keys(weekDone).length, '本周完成', '#/stat/rate'],
      ['tm-purple', '<svg viewBox="0 0 24 24"><rect x="4" y="13" width="4" height="7" rx="1.5" fill="currentColor" opacity=".55"/><rect x="10" y="9" width="4" height="11" rx="1.5" fill="currentColor" opacity=".8"/><rect x="16" y="5" width="4" height="15" rx="1.5" fill="currentColor"/></svg>', scopeTasks().filter(function (t) { return TM.isOverdue(S, t); }).length, '已逾期', '#/stat/due'] /* 完成率在下面「工作概览」里已有，这里不重复，改看逾期 */];
    // 执行者看自己的：待接收、已逾期（团队规模、团队效率是管理者关心的）
    var cpM = myCaps(); if (!cpM.recordIdea && !cpM.claimIdeas && !cpM.decide && !cpM.members) { var mineT = sc.filter(function (t) { return t.ownerId === me; }); tiles[0] = [tiles[0][0], tiles[0][1], mineT.filter(function (t) { return t.status === 'assigned'; }).length, '待接收', '#/tasks']; tiles[3] = [tiles[3][0], tiles[3][1], mineT.filter(function (t) { return TM.isOverdue(S, t); }).length, '已逾期', '#/stat/due']; }
    var ic = function (k) { return '<span class="me-ic">' + k + '</span>'; };
    var row = function (iconSvg, title, desc, ctrl) { return '<div class="me-sw">' + ic(iconSvg) + '<div><b>' + title + '</b><small>' + desc + '</small></div>' + ctrl + '</div>'; };
    var tog = function (k, on, d) { return '<input type="checkbox" class="me-tog" ' + k + (on ? ' checked' : '') + (d || '') + '>'; };
    var info = function (iconSvg, label, val, k, ok2) { return '<button class="me-info" ' + (ok2 ? 'data-do="meEdit" data-k="' + k + '"' : 'disabled') + '>' + iconSvg + '<span>' + label + '</span><b>' + esc(val || '未填写') + '</b>' + (ok2 ? hi('chev', 2) : '<i></i>') + '</button>'; };
    var adm = can;
    return stdHero({ title: '我的', bg: 'var(--homebg)', pos: '50% 62%', sub: '管理账号与个性化设置，让团队协作更高效。', verse: ['凡你们所做的都要凭爱心而做。', '哥林多前书 16:14'], script: 'Serve<br>&nbsp;with Love',
      actions: '<a class="tk-ic me-round" href="#/inbox" aria-label="通知 ' + nU + ' 条未读">' + hi('bell', 1.8) + (nU ? '<i>' + nU + '</i>' : '') + '</a>' + (can ? '<a class="tk-ic me-round" href="#/settings" aria-label="更多设置">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>' + '</a>' : '') + '',
      pill: '<button class="tk-month" data-do="switch">' + av(me, true) + esc(u.name) + ' · ' + ROLE_BADGE[r] + ai2('downc', 1.8) + '</button>' }) +
      '<section class="me-card"><label class="tm-av me-av me-avbtn" aria-label="换头像">' + av(me) + '<input type="file" accept="image/*" data-avatar="1" hidden>' + '<i style="background:' + p[1] + '"></i></label><div class="me-who"><div class="me-nm"><b>' + esc(u.name) + '</b><span class="me-badge">' + (r === 'owner' ? '<svg viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" fill="currentColor"/></svg>' : '') + ROLE_BADGE[r] + '</span></div><p>' + esc(u.bio || u.motto || '') + '</p>' +
      '<div class="me-meta"><span>' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 10h4a1 1 0 0 1 1 1v10M3 21h18M8 8h3M8 12h3M8 16h3"/></svg>' + ROLE_DUTY[r] + '</span>' + (u.location ? '<i></i><span>' + ai2('pin', 1.7) + esc(u.location) + '</span>' : '') + '</div></div>' +
      '<div class="me-script" aria-hidden="true">Better<br>&nbsp;Together</div></section>' +
      '<div class="tm-stats me-stats">' + tiles.map(function (t) { return '<a class="tm-stat" href="' + t[4] + '"><span class="tm-si sq ' + t[0] + '">' + t[1] + '</span><b>' + t[2] + '</b><small>' + t[3] + '</small></a>'; }).join('') + '</div>' +
      '<a class="me-team" href="#/team"><span class="me-ic blue">' + ti('team', 1.8) + '</span><span class="me-tt"><b>我的团队</b><small>' + S.users.length + ' 位伙伴 · ' + TM.GROUPS.filter(function (g) { return S.users.some(function (u) { return u.group === g; }); }).length + ' 个分组</small></span><span class="h-stack">' + S.users.slice(0, 4).map(function (u) { return av(u.id, true); }).join('') + (S.users.length > 4 ? '<i class="w-more-n">+' + (S.users.length - 4) + '</i>' : '') + '</span>' + hi('chev', 2) + '</a>' +
      '<a class="me-team me-kb" href="#/kb"><span class="me-ic kbic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11.5h5"/></svg></span><span class="me-tt"><b>AI 知识库</b><small>' + TM.kbVisible(S, me).filter(function (k) { return k.on; }).length + ' 份资料 · 让 AI 了解公司和老板的想法</small></span>' + hi('chev', 2) + '</a>' +
      (SRV ? '' : '<button class="me-team me-demo" data-do="demoStart"><span class="me-ic dk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5l12 7-12 7z"/></svg></span><span class="me-tt"><b>演示向导</b><small>一键走完 想法 → 整理 → 项目 → 执行 → 验收</small></span>' + hi('chev', 2) + '</button>') +
      '<section class="me-sec"><div class="me-sh">' + ic(ai2('ops', 1.8)).replace('me-ic', 'me-ic blue') + '<b>工作概览</b></div>' + homeStats().map(function (x) { return '<a class="me-info me-ov" href="#/stat/' + x.k + '">' + hi(x.icon, 1.7).replace('<svg ', '<svg class="' + x.cls + '" ') + '<span>' + esc(x.label) + '</span><b><strong>' + x.n + '</strong></b>' + hi('chev', 2) + '</a>'; }).join('') + '</section>' +
      (can ? '<section class="me-sec"><a class="me-sh" href="#/settings">' + ic('<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="#fff"/><path d="M19.4 13.5l1.6 1.2-1.8 3.2-1.9-.7a7 7 0 0 1-1.8 1l-.3 2h-3.6l-.3-2a7 7 0 0 1-1.8-1l-1.9.7-1.8-3.2 1.6-1.2a7 7 0 0 1 0-2.1L4.6 10.3 6.4 7l1.9.8a7 7 0 0 1 1.8-1l.3-2h3.6l.3 2a7 7 0 0 1 1.8 1l1.9-.8 1.8 3.3-1.6 1.1a7 7 0 0 1 0 2.1z" fill="currentColor"/><circle cx="12" cy="12" r="2.6" fill="#E8F0FF"/></svg>').replace('me-ic', 'me-ic blue') + '<b>流程开关</b><small>根据团队需要灵活设置</small>' + hi('chev', 2) + '</a>' +
      
      row('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>', '老板确认范围', '只送例外：战略、超预算、人事、重要发布才找老板。每条都送：所有想法派发前都要老板确认。',
        '<label class="me-sel"><select data-set="ownerApprovalMode"' + dis + '><option value="exceptions_only"' + (cs.ownerApprovalMode === 'exceptions_only' ? ' selected' : '') + '>只送例外</option><option value="all"' + (cs.ownerApprovalMode === 'all' ? ' selected' : '') + '>每条都送</option></select>' + ai2('downc', 2) + '</label>') +
      row(hi('spark', 1.6).replace('<svg ', '<svg class="gold" '), 'AI 助理可直接送人', '打开后，在「每条都送」模式下 AI 整理完可直接发送到老板待决策；派发、立项由人点。', tog('data-set="agentDirectRoute"', cs.agentDirectRoute, dis)) +
      row('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.4 2.4 4.6-5"/></svg>', '行政任务老板终验', '负责人验收后，再进入老板终验。', tog('data-set="ownerFinalAdmin"', cs.ownerFinalAdmin, dis)) +
      row(hi('bell', 1.7), '通知设置', notifSum(pref), '<button type="button" class="btn ghost me-nset" data-do="notifSet">设置</button>') + '</section>' : '<section class="me-sec"><div class="me-sh">' + ic(hi('bell', 1.7)).replace('me-ic', 'me-ic blue') + '<b>通知</b></div>' + row(hi('bell', 1.7), '通知设置', notifSum(pref), '<button type="button" class="btn ghost me-nset" data-do="notifSet">设置</button>') + '</section>') +
      '<section class="me-sec"><div class="me-sh">' + ic(ti('person', 1.8)).replace('me-ic', 'me-ic blue') + '<b>个人信息</b></div>' +
      info('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h4M14.5 13.5h3"/></svg>', '姓名', u.name, 'name', adm) +
      info('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="7" width="18" height="12.5" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/></svg>', '职位', u.title, 'title', true) +
      info('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>', '邮箱', u.email, 'email', true) +
      info('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>', '手机', u.phone, 'phone', true) +
      info(ai2('pin', 1.7), '所在地', u.location, 'location', true) +
      info('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z"/></svg>', '个人签名', u.bio, 'bio', true) + '</section>' +
      (SRV && TMS.loggedIn() ? '<section class="me-sec me-acct"><div class="me-sh">' + ic(ti('person', 1.8)).replace('me-ic', 'me-ic blue') + '<b>账号与安全</b></div>' +
        '<button class="me-info" data-do="srvPassword">' + hi('flag', 1.7) + '<span>修改密码</span><b>' + (TMS.mustChange ? '请修改初始密码' : '') + '</b>' + hi('chev', 2) + '</button>' +
        '<button class="me-info" data-do="srvSessions">' + ti('lock', 1.7) + '<span>登录设备</span><b></b>' + hi('chev', 2) + '</button>' +
        '<div class="me-info">' + hi('pie', 1.7) + '<span>服务器</span><b>' + esc(TMS.serverUrl()) + '</b><i></i></div>' +
        (isAndroidApp() ? '<button class="me-info" data-do="appUpdate">' + hi('spark', 1.7) + '<span>App 版本</span><b>' + esc(appUpd.info ? appUpd.info.version : '') + (appUpd.newer ? ' · 有新版本' : ' · 检查更新') + '</b>' + hi('chev', 2) + '</button>' : '') +
        (isOwner() || TM.hasRole(S, me, 'admin') ? '<button class="me-info" data-do="appShare">' + hi('flag', 1.7) + '<span>给同事安装 App</span><b>扫码下载安卓版</b>' + hi('chev', 2) + '</button>' : '') +
        '<button class="me-info me-out" data-do="srvLogout">' + hi('chev', 1.7) + '<span>退出登录</span><b></b>' + hi('chev', 2) + '</button>' + (isOwner() ? '' : '<button class="me-info me-del" data-do="srvDeactivate">' + hi('chev', 1.7) + '<span>注销账号</span><b>停用后无法登录</b>' + hi('chev', 2) + '</button>') + '</section>' : '') +
      '<section class="me-sec"><div class="me-sh">' + ic(ti('more', 1.6)).replace('me-ic', 'me-ic blue') + '<b>通用</b></div>' +
      (SRV && isOwner() && S.real && !onboardSteps().every(function (x) { return x[3]; }) ? '<button class="me-info" data-do="onboard">' + hi('flag', 1.7) + '<span>开始使用</span><b>还有 ' + onboardSteps().filter(function (x) { return !x[3]; }).length + ' 步</b>' + hi('chev', 2) + '</button>' : '') +
      '<div class="me-info me-fs">' + ai2('edit', 1.7) + '<span>字体大小</span><span class="fs-seg" role="group" aria-label="字体大小">' + [['', '标准'], ['l', '大'], ['xl', '特大']].map(function (x) { return '<button type="button" class="' + (fsGet() === x[0] ? 'on' : '') + '" data-do="fsSet" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</span></div>' +
      '<button class="me-info" data-do="quickAI">' + hi('spark', 1.7) + '<span>AI 助手</span><b>整理、分析、建议、创作</b>' + hi('chev', 2) + '</button>' +
      '<a class="me-info" href="#/inbox">' + hi('bell', 1.7) + '<span>通知中心</span><b>' + (nU ? nU + ' 条未读' : '全部已读') + '</b>' + hi('chev', 2) + '</a>' +
      (can ? '<a class="me-info" href="#/settings">' + ai2('ctx', 1.7) + '<span>更多设置</span><b>终验、标签、提醒、演示工具</b>' + hi('chev', 2) + '</a>' : '') +
      (myCaps().work || myCaps().ideas || myCaps().tasks ? '<a class="me-info" href="#/files">' + ai2('doc2', 1.7) + '<span>全部文件</span><b></b>' + hi('chev', 2) + '</a>' : '') +
      '<button class="me-info" data-do="meHelp">' + ti('help', 1.7) + '<span>使用帮助</span><b></b>' + hi('chev', 2) + '</button>' +
      '<button class="me-info" data-do="meAbout">' + ai2('info', 1.7) + '<span>关于</span><b>' + esc(SRV ? (APPV ? '版本 ' + APPV : '正式版') : '演示模式') + '</b>' + hi('chev', 2) + '</button></section>';
  }
  var ME = {
    meEdit: function (el) {
      var k = el.dataset.k, u = TM.user(S, me), L2 = { name: ['姓名', 20], title: ['职位', 16], email: ['邮箱', 60], phone: ['手机', 20], location: ['所在地', 20], bio: ['个人签名', 30] }[k];
      openSheet('修改' + L2[0], field(L2[0], '<input type="text" inputmode="' + (k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text') + '" name="v" maxlength="' + L2[1] + '" value="' + esc(u[k] || '') + '">', k === 'name' ? '姓名由老板或管理员修改。' : ''), '保存', function (o) { var p = { id: me }; p[k] = o.v; act('member.update', p, '已保存'); });
    },
    meAbout: function () {
      var li = function (k, v) { return '<div><span>' + k + '</span><b>' + v + '</b></div>'; };
      var plat = typeof TMN !== 'undefined' && TMN.native ? (TMN.platform === 'ios' ? 'iPhone' : '安卓') : '网页';
      var h = '<div class="cred">' + li('版本', esc((APPV || '') + (APPV ? ' · ' : '') + plat + ' 版')) +
        (SRV ? li('团队服务器', esc(TMS.serverUrl())) + li('AI', AI_ON ? (AI_LOCAL ? '本机 AI（' + esc(AI_MODEL.replace(/^本机 /, '')) + '）' : 'Claude') : '未启用，由规则生成') + li('录音转文字', TR_ON ? '已启用（服务器离线转写）' : '未安装') + li('数据', '保存在团队服务器，每天自动备份') : li('模式', '演示模式（数据只在这台设备）')) + '</div>';
      if (!SRV) h += '<p class="muted" style="font-size:14px;margin:12px 0 0">演示模式里账号是预设的，AI 由规则模拟。连接团队服务器后，用老板分派的账号登录，数据在团队里实时同步，录音和视频能自动转成文字，老板配置后 AI 由 Claude 完成。</p>';
      else h += '<button type="button" class="btn block mt" data-do="mePrivacy">隐私政策</button>';
      openSheet('关于团队协同', h, '知道了', function () { closeSheet(); });
    },
    mePrivacy: function () { closeSheet(); openLink(TMS.serverUrl() + '/privacy'); },
  };
