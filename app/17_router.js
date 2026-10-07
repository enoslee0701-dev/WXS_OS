/* app/17_router.js — 路由与渲染、文件导入、表单处理。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
  /* ---------- 路由与渲染 ---------- */
  function cur() { var h = location.hash.replace(/^#\/?/, '').split('/'); return { name: h[0] || 'home', id: h[1], sub: h[2] }; }
  var TABS = [['home', '首页', '<path d="M4.5 10.4L12 4.5l7.5 5.9v8.1a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z"/><path d="M9.4 15.2c1.5 1.3 3.7 1.3 5.2 0"/>'], ['ideas', '想法', '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v1h5v-1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5z"/>'], ['tasks', '任务', '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M8.6 12.2l2.3 2.3 4.6-4.8"/>'],
    ['work', '项目', '<path d="M3.8 8.2a2.7 2.7 0 0 1 2.7-2.7h3l2 2.2h6a2.7 2.7 0 0 1 2.7 2.7v6.9a2.7 2.7 0 0 1-2.7 2.7h-11a2.7 2.7 0 0 1-2.7-2.7z"/><path d="M3.8 10.3h16.4"/>'], ['me', '我的', '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="10" r="2.9"/><path d="M6.8 18.3c1.2-2.2 3-3.3 5.2-3.3s4 1.1 5.2 3.3"/>']];
  var TAB_ON = {
    ideas: '<path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v1h5v-1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5z" fill="currentColor"/><path d="M9 17.5h6M10 20.5h4"/>',
    home: '<path d="M4.5 10.4L12 4.5l7.5 5.9v8.1a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" fill="currentColor"/><path d="M9.4 15.2c1.5 1.3 3.7 1.3 5.2 0" stroke="#fff"/>',
    tasks: '<rect x="4" y="4" width="16" height="16" rx="5" fill="currentColor"/><path d="M8.6 12.2l2.3 2.3 4.6-4.8" stroke="#fff" stroke-width="2"/>',
    work: '<path d="M3.8 8.2a2.7 2.7 0 0 1 2.7-2.7h3l2 2.2h6a2.7 2.7 0 0 1 2.7 2.7v6.9a2.7 2.7 0 0 1-2.7 2.7h-11a2.7 2.7 0 0 1-2.7-2.7z" fill="currentColor"/>',
    team: '<circle cx="9.5" cy="8.5" r="3.2" fill="currentColor"/><path d="M3.8 19.5c.8-3.1 2.9-4.7 5.7-4.7s4.9 1.6 5.7 4.7z" fill="currentColor"/><path d="M15.8 5.6a3.2 3.2 0 0 1 0 5.8M17.4 15c1.6.6 2.6 2.1 3.1 4.5"/>',
    me: '<circle cx="12" cy="12" r="8.5" fill="currentColor"/><circle cx="12" cy="10" r="2.9" fill="#fff" stroke="none"/><path d="M6.8 18.3c1.2-2.2 3-3.3 5.2-3.3s4 1.1 5.2 3.3" stroke="#fff"/>'
  };
  var DEMO = SRV ? '' : '<div class="demo"><span><b>演示版</b>示例数据只存本机，AI 为模拟输出</span></div>';
  var TITLES = { home: '首页', ideas: '项目', new: '记录想法', idea: '想法', work: '项目', inbox: '通知', me: '我的', task: '任务', tasks: '任务', team: '团队', todo: '今日待办' };
  function render() {
    setTimeout(function () { if (typeof dmPanel === 'function') dmPanel(); }, 0);
    var app = document.getElementById('app'), c = cur();
    if (!me) { document.body.classList.remove('has-actions'); var lg = viewLogin(); app.innerHTML = (/class="login welcome"/.test(lg) ? '' : DEMO) + lg; return; }
    if (c.name === 'login') { location.hash = '#/home'; return; }
    if (c.name === 'join') { toast('你已经登录了。要用邀请换账号，请先在「我的」里退出登录', true); location.hash = '#/home'; return; }
    var cp = myCaps(), to = null;
    if (c.name === 'new' && !cp.recordIdea) to = '#/home';
    else if (c.name === 'project' && !cp.createProject) to = '#/home';
    else if (c.name === 'assign' && !cp.assign) to = '#/home';
    else if (c.name === 'settings' && !cp.settings) to = '#/me';
    else if (c.name === 'kb' && c.id === 'voice' && !cp.kbEdit) to = '#/kb';
    else if ((c.name === 'ideas' || c.name === 'idea') && !cp.ideas) to = '#/home';
    else if (c.name === 'work' && !cp.work) to = '#/home';
    if (to) { if ((c.name === 'idea' || c.name === 'work' || c.name === 'task') && c.id) setTimeout(function () { toast('你没有权限查看这个内容', true); }, 50); /* 打开某条看不到的想法 / 项目 / 任务（例如点了通知）时说明原因 */ history.replaceState(null, '', to); if (typeof navStack !== 'undefined' && navStack.length) navStack[navStack.length - 1] = to; return render(); }
    var body = '', acts = [], title = TITLES[c.name] || '首页', back = false;
    switch (c.name) {
      case 'ideas': body = viewIdeas(); break;
      case 'new': body = !TM.canInitiate(S, me) ? viewNew() : c.id === 'voice' ? viewNewVoice() : c.id === 'video' ? viewNewVideo() : c.id === 'text' ? viewNewText() : c.id === 'file' ? viewNewFile() : viewNewHub(); break;
      case 'project': body = viewProject(c.id); break;
      case 'assign': body = viewAssign(c.id); break;
      case 'stat': body = c.id === 'notif' ? viewNotif() : c.id === 'due' ? viewDue() : c.id === 'rate' ? viewRate() : viewDecide(); break;
      case 'idea': body = viewIdea(c.id, c.sub); acts = c.sub === 'log' ? [] : ideaActions(I(c.id)); back = true; break;
      case 'work': if (c.id) { body = viewWorkDetail(c.id); acts = workActions(W(c.id)); } else body = viewWork(); break;
      case 'task': body = viewTask(c.id); acts = taskActions(T(c.id)); back = true; break;
      case 'inbox': body = viewInbox(); break;
      case 'tasks': body = viewToday(); break;
      case 'team': body = viewTeamPage(); break;
      case 'todo': if (c.id === 'new') { body = c.sub === 'manual' ? viewTodoManual() : c.sub === 'ai' ? viewTodoAI() : viewTodoNew(); } else { location.hash = '#/tasks'; return; } break;
      case 'me': body = viewMe(); break;
      case 'kb': body = viewKB(c.id); back = true; break;
      case 'files': body = viewFiles(); break;
      case 'settings': body = viewSettings(); back = true; title = '更多设置'; break;
      default: body = viewHome(); c.name = 'home';
    }
    // 演示模式下的录音 / 视频 / AI 页面：说清楚这里是模拟的，一键连接团队服务器（用户曾在演示模式里试视频，以为功能坏了）
    if (!SRV && /^#\/(new\/(voice|video|file)|project\/ai|todo\/new\/ai|kb\/voice)/.test(location.hash)) { var dtip = '<div class="demo-tip"><b>你正在用演示模式</b><span>这里的录音不会上传，视频里的话不会转成文字，AI 也是规则模拟。连接团队服务器后，录音和视频会自动转成文字，AI 会真正读懂内容。</span><button type="button" class="btn pri" data-do="srvConnect">连接团队服务器</button></div>';
      body = body + dtip; } // 放在页面最后：以前插在第一个区块后面，会把录音页的「话筒—计时—按钮」切开
    var u = TM.user(S, me);
    var tabKey = { idea: 'ideas', new: 'ideas', project: 'work', stat: 'home', settings: 'me', kb: 'me', files: 'me', todo: 'tasks', ideas: 'ideas', task: 'tasks', inbox: 'home', team: 'me', assign: 'work' }[c.name] || c.name;
    var nT = vTasks().filter(function (t) { var nx = TM.nextForTask(S, t); return nx && nx.who === me; }).length;
    var home = c.name === 'home' || c.name === 'new' || c.name === 'project' || c.name === 'tasks' || c.name === 'todo' || c.name === 'assign' || c.name === 'work' || c.name === 'ideas' || c.name === 'stat' || c.name === 'team' || c.name === 'me' || c.name === 'inbox' || c.name === 'idea' || c.name === 'kb' || c.name === 'files' || c.name === 'task' || c.name === 'settings';
    document.body.classList.toggle('is-home', home);
    document.body.classList.toggle('home-lock', c.name === 'home'); document.documentElement.classList.toggle('home-lock', c.name === 'home'); // 旧 WebView 不支持 :has()
    document.body.classList.toggle('is-new', c.name === 'new' || c.name === 'project' || c.name === 'tasks' || c.name === 'todo' || c.name === 'assign' || c.name === 'work' || c.name === 'ideas' || c.name === 'stat' || c.name === 'team' || c.name === 'me' || c.name === 'inbox');
    document.body.classList.toggle('is-work', (c.name === 'work' && !!c.id) || c.name === 'idea' || c.name === 'kb' || c.name === 'task' || c.name === 'settings');
    document.body.classList.toggle('no-dock', c.name === 'inbox' || c.name === 'stat' || c.name === 'project' || c.name === 'assign' || (c.name === 'new' && !!c.id) || (c.name === 'todo' && !!c.sub));
    var actHTML = acts.length ? '<div class="actions">' + acts.map(function (a) { return '<button class="btn ' + (a[2] || '') + '" data-do="' + a[1] + '"' + (a[3] ? ' data-arg="' + a[3] + '"' : '') + '>' + esc(a[0]) + '</button>'; }).join('') + '</div>' : '';
    document.body.classList.toggle('has-actions', !!acts.length);
    // 同一页面重新渲染（例如收到别人的改动）时，保留折叠区和 <details> 的展开状态
    var sameView = lastView === location.hash, folds = sameView ? Array.prototype.map.call(app.querySelectorAll('.ix2-fold, details'), function (e) { return e.classList.contains('open') || e.open; }) : null;
    lastView = location.hash;
    app.innerHTML = wordsFix((home ? '' : DEMO +
      '<div class="top' + (back ? ' detail' : '') + '">' + (back ? '<button class="circle back" data-do="back" aria-label="返回"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>' : '') +
      '<h1>' + esc(title) + '</h1><button class="me-chip" data-do="switch" aria-label="切换账号，当前 ' + esc(u.name) + '">' + av(me) + '<span>' + esc(u.name) + '　' + esc(L.role[role()]) + '</span></button></div>') +
      '<main>' + body + '</main>' + actHTML +
      '<div class="dock"><nav class="tabs" aria-label="主导航">' + TABS.filter(function (t) { var cp = myCaps(); return t[0] === 'ideas' ? cp.ideas : t[0] === 'work' ? cp.work : true; }).map(function (t) { return '<a href="#/' + t[0] + '" class="' + (tabKey === t[0] ? 'on' : '') + '"' + (tabKey === t[0] ? ' aria-current="page"' : '') + '><span class="ti"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (tabKey === t[0] && TAB_ON[t[0]] ? TAB_ON[t[0]] : t[2]) + '</svg></span>' + t[1] + (t[0] === 'tasks' && nT ? '<span class="badge">' + nT + '</span>' : '') + '</a>'; }).join('') + '</nav></div>');
    if (folds) { var fe = app.querySelectorAll('.ix2-fold, details'); if (fe.length === folds.length) Array.prototype.forEach.call(fe, function (e, i) { if (!folds[i]) return; if (e.tagName === 'DETAILS') e.open = true; else { e.classList.add('open'); var b = e.querySelector('[data-do=ixFold]'); if (b) { b.setAttribute('aria-expanded', 'true'); var sp = b.querySelector('span'); if (sp) sp.textContent = '收起'; } } }); }
    afterRender();
  }
  var lastView = null;
  Object.keys(QUICK).forEach(function (k) { DO[k] = QUICK[k]; });
  DO.goAssignWork = function (el) { asg = freshAsg(el.dataset.arg); location.hash = '#/assign/' + el.dataset.arg; };
  Object.keys(PDO).forEach(function (k) { DO[k] = PDO[k]; });
  [VO, CAP, TD, AS, WD, SD, TMD, ME, AIX, MTX].forEach(function (g) { Object.keys(g).forEach(function (k) { DO[k] = g[k]; }); });
  DO.mode = function (el) {
    draft.mode = el.dataset.m; render();
    if (draft.mode === 'voice' && !rec) startRec();
    else if (draft.mode === 'video') { var v = document.getElementById('vidpick'); if (v) v.click(); }
    else if (draft.mode === 'text') { var t = document.querySelector('textarea[name=note]'); if (t) t.focus(); }
  };
  DO.expandNote = function () { draft.big = !draft.big; render(); };
  DO.hmVerse = function () { hmV++; render(); };
  DO.onboard = function () {
    var st = onboardSteps();
    openSheet('三步开始使用', '<p class="muted" style="margin:0 0 12px;font-size:14px">团队已经建好。完成这三步，团队就能运转起来：</p><div class="ob-list">' + st.map(function (x, i) { return '<button type="button" class="ob-i' + (x[3] ? ' done' : '') + '" data-do="onboardGo" data-h="' + x[4] + '"><span class="ob-n">' + (x[3] ? '✓' : i + 1) + '</span><span><b>' + x[1] + '</b><small>' + x[2] + '</small></span>' + hi('chev', 2) + '</button>'; }).join('') + '</div>', '以后再说', function () { try { localStorage.setItem('tm_onboard_' + me, '1'); } catch (e) {} closeSheet(); });
  };
  DO.onboardGo = function (el) { closeSheet(); location.hash = el.dataset.h; };
  var welcomeAsked = false;
  function welcomed() { try { return localStorage.getItem('tm_welcomed_' + me) === '1'; } catch (e) { return true; } }
  var WELCOME = { operator: [['想法页 → 待整理', '新想法提交后先到这里，点「认领」后由你跟进'], ['整理稿', 'AI 先整理一版，你核对、修改'], ['派发', '普通事项直接派任务；超预算、人事等例外送老板决策']],
    lead: [['项目页', '交给你的产品项目在这里：拆任务、派人、推进阶段'], ['任务验收', '执行者提交成果后，由你验收或退回'], ['记录想法', '有发起权时，首页可以直接记想法']],
    executor: [['任务页', '派给你的任务都在这里：先「接收」，再「开始」，做完「提交成果」'], ['遇到问题', '在任务里点「报阻碍」，跟进人会来处理'], ['记一条待办', '自己的小事也可以记在待办里，能设重复']],
    admin: [['成员与账号', '添加成员、分派登录账号、重置密码、停用离职的人'], ['AI 知识库', '维护公司资料，AI 回答问题时会参考'], ['更多设置', '流程开关、操作日志']] };
  DO.welcome = function () {
    try { localStorage.setItem('tm_welcomed_' + me, '1'); } catch (e) {}
    var r = TM.primaryRole(S, me), xs = WELCOME[r] || WELCOME.executor;
    openSheet('欢迎加入团队', '<p class="muted" style="margin:0 0 12px;font-size:14px">你的角色是<b>' + L.role[r] + '</b>。最常用的是这几个地方：</p><div class="ob-list">' + xs.map(function (x, i) { return '<div class="ob-i"><span class="ob-n">' + (i + 1) + '</span><span><b>' + x[0] + '</b><small>' + x[1] + '</small></span></div>'; }).join('') + '</div><p class="muted" style="margin:12px 0 0;font-size:13px">以后随时在「我的 → 使用帮助」查看。</p>', '开始使用', function () { closeSheet(); });
  };
  DO.demoChoose = function () { try { localStorage.setItem('tm_demo_chosen', '1'); } catch (e) {} render(); };
  // 自动查找团队服务器：找到就填进地址框（登录页会顺便重新检查）
  DO.srvScan = function (el, done) {
    if (!el || el.disabled) return; if (typeof done !== 'function') done = null;
    var inp = el && el.parentNode && el.parentNode.querySelector('input[name=server]') || document.querySelector('input[name=server]');
    el.disabled = true; var t0 = el.innerHTML; el.textContent = '正在查找…';
    TMS.scan(function (d, n) { el.textContent = '正在查找… ' + Math.round(d / n * 100) + '%'; }).then(function (list) {
      el.disabled = false; el.innerHTML = t0;
      if (done) done(list[0]);
      if (!list.length) return toast('这个 Wi-Fi 里没找到团队服务器：确认手机和服务器电脑连的是同一个 Wi-Fi、服务器电脑开着，或者直接填老板给的地址', true);
      if (inp) inp.value = list[0];
      if (document.querySelector('form[data-form=srvLogin], form[data-form=srvSetup]')) { srvL.url = list[0]; srvL.err = ''; srvRefresh(); srvProbe(); }
      toast('找到了团队服务器：' + list[0]);
    });
  };
  DO.srvConnect = function () { openSheet('连接团队服务器', field('服务器地址', '<input type="text" inputmode="url" name="server" placeholder="老板给的地址，例如 192.168.1.x" autocapitalize="off" autocorrect="off" required><button type="button" class="srv-scan" data-do="srvScan">' + hi('spark', 1.6) + '在这个 Wi-Fi 里自动查找</button>', '老板在办公室电脑上开启团队服务器后会显示这个地址；同事扫老板给的二维码会自动填好。'), '连接', function (o) { TMS.useServer(o.server); }); };
  DO.srvLocal = function () { TMS.useLocal(); };
  DO.srvLogout = function () { var n = TMS.outbox.length; openSheet('退出登录', '<p style="margin:0">' + (n ? '还有 <b>' + n + '</b> 项改动没同步到服务器，退出后会丢失。建议联网同步完再退出。' : '退出后需要重新输入账号密码。') + '</p>', '退出登录', function () { TMS.logout(); }, true); };
  DO.srvPassword = function (el) { var must = TMS.mustChange;
    openSheet(must ? '请先修改初始密码' : '修改密码', (must ? '<p class="muted" style="margin:0 0 10px;font-size:14px">你正在使用别人帮你设置的初始密码，改成只有你知道的密码。</p>' : field('原密码', '<input type="password" name="old" autocomplete="current-password" required>')) +
      field('新密码', '<input type="password" name="password" autocomplete="new-password" required>', '至少 8 位，别用生日、连续数字') + field('再输一次', '<input type="password" name="again" autocomplete="new-password" required>'), '保存', function (o) {
      if (String(o.password || '').length < 8) return fieldErr('.sheet input[name=password]', '新密码至少 8 位');
      if (o.password !== o.again) return fieldErr('.sheet input[name=again]', '两次输入的新密码不一样');
      TMS.changePassword(o.old || '', o.password).then(function () { closeSheet(); toast('密码已修改'); render(); /* 改完初始密码后重新检查要不要显示欢迎说明 */ }, function (e) { toast(e.error || '修改失败', true); });
    });
    // 初始密码必须先改：不能点遮罩或 × 关掉（以前关掉后操作会卡在同步里）
    if (must) { var ly = document.getElementById('layer'); var sc = ly.querySelector('.scrim'); if (sc) sc.removeAttribute('data-do'); ly.querySelectorAll('.sheet header .circle, .sheet footer [data-do=closeSheet]').forEach(function (x) { x.remove(); }); }
  };
  /* 安卓 App 更新：团队服务器上放着最新的安装包（npm run android 发布），App 启动时比较版本号，有新版就提示下载 */
  var appUpd = { meta: null, info: null, newer: false };
  function isAndroidApp() { return typeof TMN !== 'undefined' && TMN.native && TMN.platform === 'android'; }
  function appCheck(manual) {
    if (!(SRV && TMS.loggedIn())) return Promise.resolve();
    return fetch(TMS.serverUrl() + '/api/app').then(function (r) { return r.json(); }).then(function (j) {
      appUpd.meta = j && j.android || null;
      return isAndroidApp() && TMN.appInfo ? TMN.appInfo() : null;
    }).then(function (info) {
      appUpd.info = info; var m = appUpd.meta;
      appUpd.newer = !!(m && info && m.versionCode > (+info.build || 0));
      var skip = ''; try { skip = localStorage.getItem('tm_upd_skip') || ''; } catch (e) {}
      if (appUpd.newer && (manual || skip !== String(m.versionCode))) appPrompt();
      else if (manual) toast(m ? '已经是最新版本' : '服务器上还没有安卓安装包');
      if (cur().name === 'me') render();
    }).catch(function () { if (manual) toast('检查更新失败，请稍后再试', true); });
  }
  function appPrompt() {
    var m = appUpd.meta;
    askSheet('发现新版本', '新版本 <b>' + esc(m.versionName) + '</b>（你现在用的是 ' + esc(appUpd.info.version) + '）。' + (m.notes ? '<span class="callout" style="display:block;margin:10px 0">' + esc(m.notes) + '</span>' : '<br>') + '<span class="muted" style="font-size:13.5px">点「下载安装」后会在浏览器里下载，下载完点通知栏里的文件安装。数据都在服务器上，更新不会丢失。</span>', '下载安装').then(function (y) {
      if (y) TMN.openUrl(TMS.serverUrl() + m.url); else try { localStorage.setItem('tm_upd_skip', String(m.versionCode)); } catch (e) {}
    });
  }
  function qrSvg(text, cell) { try { var q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag(cell || 4, 2); } catch (e) { return ''; } }
  DO.appUpdate = function () { appCheck(true); };
  DO.appShare = function () {
    var url = TMS.serverUrl() + '/app';
    openSheet('给同事安装 App', '<div class="cred-qr">' + qrSvg(url) + '<small>安卓手机用相机或浏览器扫码，打开安装页下载 App' + (appUpd.meta ? '（' + esc(appUpd.meta.versionName) + '）' : '') + '。iPhone 请用 TestFlight 安装。</small></div><div class="cred"><div><span>安装页</span><b>' + esc(url) + '</b></div></div>' + (appUpd.meta ? '' : '<div class="callout warn" style="margin-top:10px">服务器上还没有安卓安装包：在服务器电脑上运行一次 npm run android。</div>'), '关闭', function () { closeSheet(); });
  };
  /* 账号就绪 / 邀请：二维码和链接里带一次性邀请码，同事点开自己设密码就进来；初始密码只是备用（没有邀请码时才必须告诉对方） */
  function showCred(u, login, pw, inv) {
    var srv = TMS.serverUrl(), join = 'teamops://join?server=' + encodeURIComponent(srv) + '&login=' + encodeURIComponent(login) + (inv ? '&invite=' + encodeURIComponent(inv) : ''), link = inv ? srv + '/#/join/' + inv : '', qr = '';
    try { var qq = qrcode(0, 'M'); qq.addData(join); qq.make(); qr = '<div class="cred-qr">' + qq.createSvgTag(4, 2) + '<small>' + (inv ? '让 TA 用手机相机扫一下：自动打开 App，自己设个密码就进来了（7 天内有效，只能用一次）' : '让 TA 用手机相机扫一下，自动打开 App 并填好服务器和账号（密码请单独告诉 TA）') + '</small></div>'; } catch (e) {}
    if (appUpd.meta) qr += '<p class="muted" style="font-size:13.5px;margin:0 0 12px">TA 还没装 App？安卓手机扫「我的 → 给同事安装 App」里的码下载。</p>';
    openSheet(inv && !pw ? '邀请链接 · ' + u.name : '账号已就绪', qr + '<p style="margin:0 0 10px">把下面的信息发给 <b>' + esc(u.name) + '</b>：</p><div class="cred">' + (link ? '<div><span>邀请链接</span><b class="cred-link">' + esc(link) + '</b></div>' : '') + '<div><span>服务器</span><b>' + esc(srv) + '</b></div><div><span>账号</span><b id="cred-l">' + esc(login) + '</b></div>' + (pw ? '<div><span>初始密码</span><b id="cred-p">' + esc(pw) + '</b></div>' : '') + '</div><p class="muted" style="font-size:13.5px;margin:10px 0 0">' + (inv ? '对方点链接（或扫码）后自己设密码，不用你告诉密码。' + (pw ? '链接失效时再用初始密码登录（只显示这一次，首次登录要改）。' : '') : '密码只显示这一次。对方首次登录后需要改成自己的密码。') + '</p>', '复制并关闭', function () {
      var t = 'WSX OS 登录信息\n' + (link ? '点这个链接设好密码就能进（7 天内有效）：' + link + '\n' : '') + '服务器：' + srv + '\n账号：' + login + (pw ? '\n初始密码：' + pw : '') + '\n在手机上点这个链接直接打开 App：' + join;
      try { navigator.clipboard.writeText(t).then(function () { toast('已复制，可以发给对方'); }, function () { toast('请手动记下账号和密码'); }); } catch (e) { toast('请手动记下账号和密码'); }
      closeSheet(); });
  }
  DO.srvInvite = function (el) { var uid = el.dataset.u, u = TM.user(S, uid); if (!u) return; TMS.invite(uid).then(function (r) { showCred(u, r.login, null, r.invite); }, function (e) { toast(e.error || '生成失败', true); }); };
  DO.srvAccount = function (el) { var uid = el.dataset ? el.dataset.u : el, u = TM.user(S, uid); if (!u) return;
    TMS.accounts().then(function (res) { var a = res.accounts.find(function (x) { return x.uid === uid; });
      openSheet(a ? '登录账号 · ' + u.name : '给 ' + u.name + ' 分派登录账号',
        (a ? '<div class="callout">当前账号 <b>' + esc(a.login) + '</b>' + (a.disabled ? '（已停用）' : '') + (a.mustChange ? ' · 还没改初始密码' : '') + (a.lastLogin ? ' · 最近登录 ' + ago(a.lastLogin) : ' · 还没登录过') + '</div>' : '<p class="muted" style="margin:0 0 10px;font-size:14px">' + esc(u.name) + ' 还没有登录账号。设置后把账号和初始密码告诉对方，对方首次登录时需要修改密码。</p>') +
        field('登录账号', '<input type="text" name="login" value="' + esc(a ? a.login : '') + '" placeholder="例如：xiaoli 或手机号" autocapitalize="off" autocorrect="off" autocomplete="off" required>', '3–32 位字母、数字或 _ . @ -') +
        field(a ? '新密码（可选）' : '初始密码（可选）', '<input type="text" name="password" placeholder="留空自动生成" autocomplete="off" autocapitalize="off">', a ? '填写后旧密码立即失效' : '') +
        (a ? '<label class="sw"><span><b>重置密码</b><small>自动生成新密码，旧密码立即失效</small></span><input type="checkbox" name="reset" value="1"></label>' + (uid !== me && !TM.hasRole(S, uid, 'owner') ? (a.disabled ? '' : '<button type="button" class="btn block mt" data-do="srvInvite" data-u="' + uid + '">' + hi('spark', 1.6) + ' 生成邀请链接 / 二维码</button>') + '<button type="button" class="btn block mt' + (a.disabled ? '' : ' danger') + '" data-do="srvDisable" data-u="' + uid + '" data-d="' + (a.disabled ? '0' : '1') + '">' + (a.disabled ? '恢复这个账号' : '停用这个账号') + '</button>' : '') : ''),
        a ? '保存' : '创建账号', function (o) {
          TMS.setAccount({ uid: uid, login: (o.login || '').trim(), password: o.password || undefined, reset: !!o.reset }).then(function (r) { if (r.password) showCred(u, r.login, r.password, r.invite); else { closeSheet(); toast('已保存'); } }, function (e) { toast(e.error || '保存失败', true); });
        });
    }, function (e) { toast(e.error || '连不上服务器', true); });
  };
  DO.srvDeactivate = function () {
    openSheet('注销账号', '<p style="margin:0 0 8px">注销后你的账号会被停用，<b>不能再登录</b>，老板会收到通知。你记录过的想法、任务和讨论会保留在团队里。</p><div class="callout warn">如果只是换手机或暂时不用，请选择「退出登录」。</div>' + field('输入当前密码确认', '<input type="password" name="password" autocomplete="current-password" required>'), '确认注销', function (o) {
      TMS.deactivate(o.password || '').then(function () { closeSheet(); toast('账号已注销'); setTimeout(function () { location.hash = '#/login'; location.reload(); }, 800); }, function (e) { toast(e.error || '注销失败', true); });
    }, true);
  };
  /* 操作日志：最近 50 条，可按人筛选、只看失败、加载更早的 */
  var OPN = { 'idea.create': '记录想法', 'idea.submit': '提交想法', 'idea.claim': '认领想法', 'idea.route': '派发', 'idea.delete': '删除想法', 'idea.suggest': '提建议', 'idea.saveSummary': '保存整理稿', 'decision.request': '上报决策', 'decision.decide': '老板决策',
    'project.create': '新建项目', 'work.plan': '安排任务', 'work.update': '修改项目', 'work.close': '确认项目完成', 'work.pause': '暂停项目', 'work.resume': '恢复项目', 'work.cancel': '取消项目', 'work.reassign': '更换项目人员', 'work.attach': '上传项目文件',
    'task.transition': '任务状态', 'task.submit': '提交成果', 'task.review': '验收', 'task.update': '修改任务', 'task.comment': '任务留言', 'owner.override': '老板纠偏',
    'work.comment': '项目讨论发言', 'work.requestDecision': '项目上报老板', 'task.reviewComment': '老板复核意见', 'idea.reassignFollower': '改派跟进人', 'work.attach': '上传项目文件', 'work.detach': '删除项目文件', 'idea.close': '结束共创讨论', 'idea.confirm': '确认方向', 'member.active': '账号停用 / 恢复', 'member.add': '添加成员', 'member.update': '修改资料', 'member.role': '调整角色', 'member.handover': '交接工作', 'settings.update': '修改设置', 'todo.create': '新建待办', 'todo.update': '修改待办', 'notif.read': '已读通知' };
  var opsS = { uid: '', fail: false, rows: [], more: false };
  function opsHTML() {
    var ppl = S.users.map(function (u) { return '<option value="' + u.id + '"' + (opsS.uid === u.id ? ' selected' : '') + '>' + esc(u.name) + '</option>'; }).join('');
    return '<div class="ops-f"><select data-ops="uid"><option value="">全部成员</option>' + ppl + '</select><label class="ops-c"><input type="checkbox" data-ops="fail"' + (opsS.fail ? ' checked' : '') + '> 只看失败</label></div>' +
      (opsS.rows.length ? '<div class="ops-l">' + opsS.rows.map(function (r) { return '<div class="ops-r' + (r.ok ? '' : ' bad') + '"><b>' + esc(TM.name(S, r.uid)) + '</b><span>' + esc(OPN[r.action] || r.action) + (r.ok ? '' : '（失败：' + esc(r.error) + '）') + '</span><small>' + ixDate(r.at) + '</small></div>'; }).join('') + '</div>' : emptyBox(opsS.fail ? '没有失败的操作。' : '还没有记录。')) +
      (opsS.more ? '<button type="button" class="btn block mt" data-do="opsMore">加载更早的</button>' : '');
  }
  function opsLoad(more) {
    TMS.ops({ uid: opsS.uid, fail: opsS.fail, before: more && opsS.rows.length ? opsS.rows[opsS.rows.length - 1].seq : '' }).then(function (r) {
      opsS.rows = more ? opsS.rows.concat(r.ops) : r.ops; opsS.more = r.more; var b = document.querySelector('#layer .sheet .body'); if (b && document.querySelector('#layer .sheet .ops-f')) b.innerHTML = opsHTML(); else openSheet('操作日志', opsHTML(), '关闭', function () { closeSheet(); });
    }, function (e) { toast(e.error || '读取失败', true); });
  }
  DO.srvOps = function () { opsS = { uid: '', fail: false, rows: [], more: false }; opsLoad(false); };
  DO.opsMore = function () { opsLoad(true); };
  document.addEventListener('change', function (e) { var k = e.target && e.target.dataset && e.target.dataset.ops; if (!k) return; if (k === 'uid') opsS.uid = e.target.value; else opsS.fail = e.target.checked; opsLoad(false); });
  // 登录设备：看自己在哪些设备上登录着，可以退出某一台或其他全部（手机丢了、换了手机时用）
  function uaName(a) { a = String(a || ''); var dev = /iPhone|iPad/.test(a) ? 'iPhone / iPad' : /Android/.test(a) ? '安卓手机' : /Macintosh/.test(a) ? 'Mac 电脑' : /Windows/.test(a) ? 'Windows 电脑' : '其他设备';
    var br = /wv\)|; wv|TeamOps|Capacitor/i.test(a) || (/iPhone|iPad/.test(a) && !/Safari\//.test(a)) ? 'App' : /Edg\//.test(a) ? 'Edge' : /Chrome\//.test(a) ? 'Chrome' : /Firefox\//.test(a) ? 'Firefox' : /Safari\//.test(a) ? 'Safari' : ''; return dev + (br ? ' · ' + br : ''); }
  DO.srvSessions = function () {
    TMS.sessions().then(function (r) {
      var xs = r.sessions || [], others = xs.filter(function (x) { return !x.current; }).length;
      openSheet('登录设备', '<div class="list">' + xs.map(function (x) { return '<div class="row ses-r"><div class="t"><span><b>' + uaName(x.agent) + ' <em class="ses-id">#' + esc(x.id.slice(-4)) + '</em></b>' + (x.current ? '<span class="tag soft">这台</span>' : '') + '<small class="muted">最近使用 ' + ago(x.seen) + ' · 登录于 ' + ixDate(x.created) + '</small></span>' + (x.current ? '' : '<button type="button" class="btn ghost" data-do="sesOut" data-id="' + x.id + '">退出</button>') + '</div></div>'; }).join('') + '</div>' +
        (others ? '<button type="button" class="btn danger block mt" data-do="sesOutAll">退出其他 ' + others + ' 台设备</button>' : '<p class="muted" style="font-size:13.5px">只有这一台设备登录着。</p>'), '关闭', function () { closeSheet(); });
    }, function (e) { toast(e.error || '读取失败', true); });
  };
  DO.sesOut = function (el) { TMS.revokeSession(el.dataset.id).then(function () { toast('已让那台设备退出登录'); DO.srvSessions(); }, function (e) { toast(e.error || '操作失败', true); }); };
  DO.sesOutAll = function () { TMS.revokeSession(null, true).then(function (r) { toast('已退出其他 ' + (r.n || 0) + ' 台设备'); DO.srvSessions(); }, function (e) { toast(e.error || '操作失败', true); }); };
  /* 报表导出：CSV（带 BOM，Excel 打开中文不乱码），只含自己能看到的数据 */
  function csvSave(name, rows) {
    var q = function (v) { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var blob = new Blob(['\ufeff' + rows.map(function (r) { return r.map(q).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    if (typeof TMN !== 'undefined' && TMN.native && TMN.canShareFile) { TMN.shareFile(blob, name).then(function () {}, function () { toast('导出失败，请重试', true); }); return; }
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('已导出：' + name);
  }
  var dstr = function (t) { return t ? ixDate(t) : ''; }, today = function () { return TM.todayStr(S); }; // 本地日期（以前用 UTC，早上导出的文件名会是昨天）
  DO.csvTasks = function () {
    var rows = [['任务', '所属项目', '状态', '主负责人', '协作者', '验收人', '优先级', '截止日期', '是否逾期', '预期成果', '验收标准', '创建时间', '最近更新']];
    vTasks().forEach(function (t) { var w = W(t.workId) || {}; rows.push([t.title, w.title, L.task[t.status], nm(t.ownerId), (t.collabs || []).map(nm).join('、'), nm(t.reviewerId), ({ hi: '高', mid: '中', lo: '低' })[t.priority || 'mid'], t.due || '', TM.isOverdue(S, t) ? '是' : '', t.expected, t.criteria, dstr(t.createdAt), dstr(t.lastActivity)]); });
    csvSave('任务表-' + today() + '.csv', rows);
  };
  DO.csvWorks = function () {
    var rows = [['项目', '类型', '状态', '负责人', '跟进运营', '验收人', '优先级', '截止日期', '任务总数', '已完成', '完成率', '目标', '创建时间']];
    vWork().forEach(function (w) { var p = TM.workProgress(S, w.id); rows.push([w.title, L.kind[w.kind], L.work[w.status], w.leadId ? nm(w.leadId) : '', nm(w.operatorId), nm(w.reviewerId), ({ hi: '高', mid: '中', lo: '低' })[w.priority || 'mid'], w.due || '', p.total, p.done, p.total ? Math.round(p.done / p.total * 100) + '%' : '', w.goal, dstr(w.createdAt)]); });
    csvSave('项目表-' + today() + '.csv', rows);
  };
  /* 通知设置：按类别开关、推送总开关、免打扰时段。关掉的类别仍记在通知列表里，只是不算未读、不推送 */
  function notifSum(p) { p = p || {}; var m = (p.mute || []).length; return (p.notifyImportant === false ? '推送已关闭' : '推送开启') + (m ? '，' + m + ' 类已静音' : '') + (p.quietOn ? '，免打扰 ' + p.quietFrom + '–' + p.quietTo : ''); }
  DO.notifSet = function () {
    var u = TM.user(S, me), p = u.prefs || {}, mute = p.mute || [];
    openSheet('通知设置', '<p class="muted" style="margin:0 0 8px;font-size:13.5px">关掉的类别仍会记在「通知」里，可以随时查看，只是不算未读、不推送到手机。</p>' +
      Object.keys(TM.NCATS).map(function (k) { return '<label class="sw"><span><b>' + TM.NCATS[k] + '</b></span><input type="checkbox" name="c_' + k + '" value="1"' + (mute.indexOf(k) < 0 ? ' checked' : '') + '></label>'; }).join('') +
      (function () { var can = SRV && typeof TMN !== 'undefined' && TMN.native && TMN.platform === 'ios'; return '<label class="sw mt' + (can ? '' : ' off') + '"><span><b>推送到手机</b><small>' + (can ? '关掉后只在 App 里提醒' : !SRV ? '演示版只有 App 内通知' : '这台手机暂不支持推送，打开 App 时在「通知」里查看') + '</small></span><input type="checkbox" name="push" value="1"' + (p.notifyImportant !== false ? ' checked' : '') + (can ? '' : ' disabled') + '></label>'; })() +
      '<label class="sw"><span><b>免打扰时段</b><small>这段时间只记在 App 里，不推送</small></span><input type="checkbox" name="quietOn" value="1"' + (p.quietOn ? ' checked' : '') + '></label>' +
      '<div class="n-quiet"><input type="time" name="quietFrom" value="' + esc(p.quietFrom || '22:00') + '"><span>到</span><input type="time" name="quietTo" value="' + esc(p.quietTo || '08:00') + '"></div>', '保存', function (o) {
        var m2 = Object.keys(TM.NCATS).filter(function (k) { return !o['c_' + k]; });
        act('member.update', { id: me, prefs: { mute: m2, notifyImportant: o.push === undefined ? (p.notifyImportant !== false) : !!o.push, quietOn: !!o.quietOn, quietFrom: o.quietFrom || '22:00', quietTo: o.quietTo || '08:00' } }, '通知设置已保存');
      });
  };
  /* 使用帮助：按自己的角色讲能做什么、一件事怎么走完、常用功能和常见问题 */
  var HELP_ROLE = { owner: '记想法、拍板决策、看全局、最终验收、纠偏（暂停 / 取消项目、改派、撤销验收），管理成员和设置。', operator: '认领想法、改整理稿、派发或送老板决策、跟进项目、验收行政任务。', lead: '规划产品项目、拆任务派人、推进阶段、验收；有发起权时也可以记想法。', executor: '在「任务」里接收任务、开始执行、遇到问题报阻碍、做完提交成果。', admin: '管理成员和登录账号、流程设置、维护 AI 知识库（看不到想法内容）。' };
  DO.flKind = function (el) { fl.k = el.dataset.k; render(); };
  DO.flOpen = function (el) { var x = allFiles()[+el.dataset.i]; if (x) openMedia(x.m); };
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'flq') { fl.q = e.target.value; clearTimeout(fl.t); fl.t = setTimeout(function () { var pos = e.target.selectionStart; render(); var q2 = document.getElementById('flq'); if (q2) { q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (x) {} } }, 200); } });
  DO.pwEye = function (el) { var i = el.previousElementSibling; if (!i) return; var show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.classList.toggle('on', show); el.setAttribute('aria-label', show ? '隐藏密码' : '显示密码'); };
  DO.fsSet = function (el) { try { if (el.dataset.v) localStorage.setItem('tm_fs', el.dataset.v); else localStorage.removeItem('tm_fs'); } catch (e) {} fsApply(); render(); toast('字体已调整'); };
  DO.meHelp = function () {
    var u = TM.user(S, me), sec2 = function (t, body) { return '<h3 class="hp-h">' + t + '</h3>' + body; }, li = function (xs) { return '<ul class="hp-l">' + xs.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; };
    openSheet('使用帮助', sec2('你的角色', u.roles.map(function (a) { return '<p class="hp-p"><b>' + L.role[a.role] + '</b>：' + HELP_ROLE[a.role] + '</p>'; }).join('')) +
      sec2('一件事怎么走完', '<p class="hp-p">想法 → 整理 → 派发 → 执行 → 验收。老板或有发起权的负责人记想法；AI 先整理成整理稿；运营者认领后派发，例外情况（超预算、人事、战略、重要发布）送老板决策；执行者接收、执行、提交成果；验收人确认通过或退回。</p>') +
      sec2('常用功能', li(['<b>搜索</b>：想法页、项目页右上角的放大镜，能搜想法、项目、任务、留言、文件和同事，多个词用空格分开。', '<b>@同事</b>：在留言、讨论里写「@姓名」，对方会收到「提到了你」。', '<b>项目讨论</b>：项目概览最下面，有问题、进展都可以在这里说。', '<b>看板</b>：项目的「任务」页签可以切换列表和看板。', '<b>重复待办</b>：打开一条自己的待办，设置「重复」，做完会自动生成下一次。', '<b>通知设置</b>：我的 → 通知设置，按类别关掉、设置免打扰时段。'])) +
      sec2('常见问题', li(['<b>没网能用吗？</b>能查看；没网时的改动先存在手机上，联网后自动同步。', '<b>换手机、手机丢了？</b>我的 → 登录设备，退出那台手机；或请老板重置密码。', '<b>同事离职？</b>老板在成员资料里停用账号，再点「交接 TA 手上的工作」，一次转给别人。', '<b>录音没转成文字？</b>连上团队服务器后，录音和视频会由服务器转成文字；手机自带的识别用不了时也没关系。'].concat(isOwner() ? ['<b>数据怎么备份？</b>服务器每天自动备份；更多设置 → 完整备份，可以随时下载含全部附件的压缩包。'] : []))), '知道了', function () { closeSheet(); });
  };
  DO.srvUsage = function () {
    TMS.usage().then(function (u) {
      var mb = function (n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; };
      var K = { ask: 'AI 助手提问', kb: '口述整理', analyze: '想法整理稿', digest: '讨论总结', cocreate: '共创汇总', advice: '决策建议', project: '新建项目解析', image: '拍照识别', doc: '读 PDF', todos: '拆待办', write: '写描述 / 目标', brief: '老板早报' };
      var row = function (a, b) { return '<div class="cred-r"><span>' + a + '</span><b class="plain">' + b + '</b></div>'; };
      openSheet('使用情况', '<div class="cred">' +
        row('AI', u.ai.enabled ? '已启用（' + esc(u.ai.model) + '）' : '未启用（规则模拟）') +
        (u.ai.enabled ? row('今天', u.ai.today.calls + ' 次 · 约 $' + u.ai.today.usd) + row('近 30 天', u.ai.month.calls + ' 次 · 约 $' + u.ai.month.usd) + Object.keys(u.ai.byKind).map(function (k) { return row('　' + (K[k] || k), u.ai.byKind[k] + ' 次'); }).join('') + row('每人每天上限', u.ai.limit + ' 次（后台自动 ' + u.ai.systemLimit + ' 次）') : '') +
        row('在用账号', u.accounts + ' 个') + row('登录中的手机', u.devices + ' 台' + (u.push ? '' : '（推送未配置）')) + row('附件', u.files.count + ' 个 · ' + mb(u.files.bytes)) +
        '</div><p class="muted" style="font-size:13px;margin:10px 0 0">费用按模型标价估算（不含缓存折扣），以 Anthropic 账单为准。</p>', '关闭', function () { closeSheet(); });
    }, function (e) { toast(e.error || '读取失败', true); });
  };
  // 完整备份：服务器边打包边下载，交给系统浏览器下载（附件可能很大，不经过 App 内存）
  DO.srvExportFull = function () { var u = TMS.exportTgzUrl(); if (!u) return toast('请先登录', true); if (typeof TMN !== 'undefined' && TMN.native && TMN.openUrl) { TMN.openUrl(u); toast('已在浏览器里开始下载完整备份'); return; } var a = document.createElement('a'); a.href = u; a.download = ''; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1000); toast('开始下载完整备份'); };
  DO.srvExport = function () {
    TMS.exportAll().then(function (d) {
      var blob = new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' }), name = 'WSX OS 备份-' + TM.todayStr(S) + '.json';
      if (typeof TMN !== 'undefined' && TMN.native && TMN.canShareFile) { TMN.shareFile(blob, name).then(function () {}, function () { toast('导出失败，请重试', true); }); return; }
      if (typeof TMN !== 'undefined' && TMN.native && navigator.share) { var f = new File([blob], name, { type: 'application/json' }); navigator.share({ files: [f], title: name }).catch(function () {}); return; }
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('已导出：' + name);
    }, function (e) { toast(e.error || '导出失败', true); });
  };
  DO.srvDisable = function (el) { var uid = el.dataset.u, d = el.dataset.d === '1'; TMS.disable(uid, d).then(function (r) { closeSheet(); toast(d ? '已停用，对方会被立即登出' + (r && r.open ? '。TA 手上还有工作，可在成员资料里一键交接' : '') : '已恢复'); }, function (e) { toast(e.error || '操作失败', true); }); };
  DO.clearDemo = function () { openSheet('清理演示数据', '<p style="margin:0 0 8px">会清空所有想法、项目、任务、待办、通知和示例资料，<b>成员和设置保留</b>，你自己添加的知识库资料也保留。</p><div class="callout warn">清理后无法恢复。</div>', '确认清理', function () { act('data.clearDemo', {}, '演示数据已清理'); location.hash = '#/home'; }, true); };
  DO.hmTriage = function () { filt.ideas = 'triage'; filt.ideasOpen = true; location.hash = '#/ideas'; };
  DO.hmTasks = function () { location.hash = '#/tasks'; };
  DO.hmTodo = function () { location.hash = '#/todo/new'; };
  DO.hmTeam = function () { location.hash = '#/team'; };
  DO.hmKB = function () { location.hash = '#/kb'; };
  DO.ixFold = function (el) { var c = el.closest('.ix2-fold'); var on = c.classList.toggle('open'); el.setAttribute('aria-expanded', on); el.querySelector('span').textContent = on ? '收起' : (c.classList.contains('ix2-adv') ? '看理由' : c.classList.contains('fl-card') ? '展开完整过程' : c.classList.contains('dg') ? '展开完整总结' : c.classList.contains('tx-log') ? '展开全部动态' : c.classList.contains('dz-card') ? (c.querySelectorAll('.dz-t.more').length ? '展开其余 ' + c.querySelectorAll('.dz-t.more').length + ' 条讨论' : '展开讨论汇总') : c.classList.contains('ix2-aiwrap') ? '展开全部' : '展开全文'); if (!on) c.scrollIntoView({ block: 'nearest' }); };
  DO.ixAttach = function () { var id = cur().id;
    var o = function (cap, acc, icon, t, s) { return '<label class="ix2-opt"><input type="file" data-ixfile="' + id + '"' + (acc ? ' accept="' + acc + '"' : '') + (cap ? ' capture="' + cap + '"' : '') + ' multiple><span class="ix2-oi">' + icon + '</span><b>' + t + '</b><small>' + s + '</small></label>'; };
    openSheet('添加附件', '<div class="ix2-opts">' + o('environment', 'image/*', ai2('img', 1.7), '拍照', '用相机拍一张') + o('', 'image/*,video/*', ai2('vcam', 1.7), '相册', '图片或视频') + o('', '', ai2('doc2', 1.7), '文件', 'PDF、Excel、Word 等') + o('', 'audio/*', ai2('mic', 1.7), '录音', '选择或录一段') +
      '<button type="button" class="ix2-opt" data-do="ixLink"><span class="ix2-oi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg></span><b>链接</b><small>网页、云盘地址</small></button></div><p class="muted" style="font-size:13.5px;margin:10px 0 0">单个想法最多 30 个附件。' + (SRV ? '文件会上传到团队服务器，同事都能打开。' : '演示版不上传，文件只保存在这台设备。') + '</p>', '关闭', function () { closeSheet(); }); };
  DO.ixLink = function () { var id = cur().id; openSheet('添加链接', field('链接地址', '<input type="url" name="url" placeholder="https://" required>') + field('名称（可选）', '<input type="text" name="name" maxlength="40" placeholder="例如：招聘方案草稿">'), '添加', function (o) { var u = (o.url || '').trim(); act('idea.attach', { id: id, media: [{ kind: 'link', url: u, name: (o.name || '').trim() || u.replace(/^https?:\/\//, '').slice(0, 40) }] }, '已添加链接'); }); };
  DO.ixOpen = function (el) { var d = I(cur().id), m = d && d.media[+el.dataset.i]; if (!m) return; if (m.kind === 'link') { var u = m.url || (/^https?:/.test(m.name) ? m.name : ''); if (u) openLink(u); else toast('这个链接没有地址', true); return; } var b = m.localId && blobUrl(m.localId); if (!b) return toast('演示版没有上传，这个文件只在添加它的设备上、刷新前能打开', true); if (m.kind === 'image') return openSheet(m.name, '<img src="' + b + '" alt="' + esc(m.name) + '" style="width:100%;border-radius:14px;display:block">', '关闭', function () { closeSheet(); }); if (m.kind === 'audio' || m.kind === 'video') return; openFile(b, m.name); };
  DO.advAI = function (el) { var id = el.dataset.arg; el.disabled = true; el.innerHTML = '<span class="ai-typing"><i></i><i></i><i></i></span> Claude 正在分析…';
    TMS.aiAdvice(id).then(function () { var f = document.querySelector('.sheet'); if (f && DO.decide) { closeSheet(); DO.decide({ dataset: { arg: id } }); } else render(); toast('Claude 的建议已生成'); }, function (e) { el.disabled = false; el.textContent = '让 Claude 分析'; toast((e && e.error) || 'AI 暂时不可用', true); }); };
  DO.advAdopt = function (el) { var f = el.closest('form'); var r = f.querySelector('input[name=status][value=' + el.dataset.v + ']'); if (r) r.checked = true; var n = f.querySelector('textarea[name=note]'); if (n) { n.value = el.dataset.n; n.focus(); } toast('已填入建议，可以修改后再提交'); };
  DO.ixDigest = function () { var r = act('idea.digest', { id: cur().id }, 'AI 已总结全部讨论'); if (r.ok) setTimeout(function () { var g = document.querySelector('.dg'); if (g) g.scrollIntoView({ block: 'nearest' }); }, 50); };
  DO.goH = function (el) { location.hash = el.dataset.h; };
  DO.ixTitle = function () { var d = I(cur().id); if (!d) return;
    openSheet('想法标题', field('标题', '<input type="text" name="title" maxlength="30" value="' + esc(d.title) + '" required>', '标题要一眼看出这件事是什么，30 字以内。') + '<button type="button" class="ix2-adopt" data-do="ixTitleAI">' + hi('spark', 1.6) + '让 AI 重新拟题</button>' + '<p class="ix2-note">AI 建议：<b id="ix-tsug">' + esc(TM.aiTitle(d)) + '</b></p>', '保存', function (o) { if ((o.title || '').trim() === d.title) return closeSheet(); act('idea.retitle', { id: d.id, title: o.title }, '标题已更新'); }); };
  DO.ixTitleAI = function () { var d = I(cur().id), i2 = document.querySelector('.sheet input[name=title]'); if (i2) { i2.value = TM.aiTitle(d); i2.focus(); } toast('已填入 AI 拟的标题，可以再改'); };
  DO.ixShow = function (el) { var d = I(cur().id), i = +el.dataset.i, m = d && d.media[i]; if (!m) return; var show = !!m.hidden; act('idea.mediaShow', { id: d.id, index: i, mid: m.id, show: show }, show ? '已设为呈现：跟进人可以看到' : '已设为不呈现：只有你、上传人和老板能看到'); };
  DO.ixDetach = function (el) { var d = I(cur().id), i = +el.dataset.i, m = d.media[i]; if (!m) return; openSheet('删除附件', '<p style="margin:0">确定删除「<b>' + esc(m.name) + '</b>」？删除会记在操作记录里。</p>', '删除', function () { act('idea.detach', { id: d.id, index: i, mid: m.id }, '已删除附件'); }, true); };
  DO.ixDiscuss = function () { var c = document.getElementById('ix-disc'); if (!c) return; if (!c.classList.contains('open')) { var b = c.querySelector('[data-do=ixFold]'); if (b) DO.ixFold(b); } c.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  DO.ixReAI = function () { act('idea.reanalyze', { id: cur().id }, '已重新整理'); };
  DO.ixTags = function () { var d = I(cur().id), sel = (d.tags || []).slice(); var pool = TX_TAGS.map(function (x) { return x[0]; }).concat(['招聘', '开发', '预算']).concat(sel).filter(function (x, i, a) { return a.indexOf(x) === i; });
    openSheet('相关标签', '<p class="muted" style="font-size:14px;margin:0 0 10px">点选或取消，最多 5 个。</p><div class="ix2-pick">' + pool.map(function (t) { return '<label><input type="checkbox" name="t" value="' + esc(t) + '"' + (sel.indexOf(t) >= 0 ? ' checked' : '') + '><span># ' + esc(t) + '</span></label>'; }).join('') + '</div>' + field('自定义标签', '<input type="text" name="custom" maxlength="8" placeholder="输入后保存即可添加">'), '保存', function (o) { var f = document.querySelector('.sheet form') || document; var ts = Array.prototype.map.call(document.querySelectorAll('.sheet input[name=t]:checked'), function (x) { return x.value; }); if (o.custom && o.custom.trim()) ts.push(o.custom.trim()); act('idea.tags', { id: d.id, tags: ts }, '标签已更新'); }); };
  DO.ixMore = function () { var d = I(cur().id), acts = ideaActions(d).filter(function (x) { return x[2] !== 'pri'; }); openSheet('更多操作', '<div class="wd-ops">' + acts.map(function (x) { return '<button type="button" class="btn block" data-do="' + x[1] + '"' + (x[3] ? ' data-arg="' + x[3] + '"' : '') + '>' + x[0] + '</button>'; }).join('') + (ixCanLog(d) ? '<button type="button" class="btn block" data-do="ixLog">查看操作记录</button>' : '') + '<button type="button" class="btn block" data-do="ixCopy">复制链接</button>' + (isOwner() && ['triage', 'awaiting_owner'].indexOf(d.status) >= 0 && TM.followUsers(S).filter(function (x) { return x !== d.followerId; }).length ? '<button type="button" class="btn block" data-do="ixFollow">改派跟进人</button>' : '') + (isOwner() || (d.creatorId === me && d.status === 'draft') ? '<button type="button" class="btn block danger" data-do="ixDelete">删除这个想法</button>' : '') + '</div>', '关闭', function () { closeSheet(); }); };
  DO.ixFollow = function () { var d = I(cur().id), us = TM.followUsers(S).filter(function (x) { return x !== d.followerId; });
    openSheet('改派跟进人', '<p class="muted" style="margin:0 0 8px;font-size:14px">' + (d.followerId ? '现在由 ' + esc(nm(d.followerId)) + ' 跟进。' : '还没有人认领，指定一位运营者跟进。') + '</p>' + field('交给', userSelect('to', us, us[0])), d.followerId ? '改派' : '指定', function (o) { act('idea.reassignFollower', { id: d.id, to: o.to }, '已改派，对方收到通知'); }); };
  DO.ixDelete = function () {
    var d = I(cur().id); if (!d) return;
    var live = S.workItems.filter(function (w) { return w.ideaId === d.id && ['done', 'cancelled'].indexOf(w.status) < 0; });
    openSheet('删除想法', '<p style="margin:0 0 8px">确定删除「<b>' + esc(d.title || '未命名') + '</b>」？</p>' + (live.length ? '<div class="callout warn">这个想法已形成进行中的项目「' + esc(live[0].title) + '」，需要先在项目里取消，才能删除。</div>' : '<div class="callout">删除后所有人都看不到这个想法，相关的待决策会自动撤回。操作会留在记录里。</div>' + field('原因（可选）', '<input type="text" name="reason" maxlength="50" placeholder="例如：重复了、已经不需要">')), live.length ? '知道了' : '确认删除', function (o) {
      if (live.length) return closeSheet();
      var r = TM.act(S, me, 'idea.delete', { id: d.id, reason: o.reason }); if (!r.ok) return toast(r.error, true);
      save(); closeSheet(); navFinish('#/ideas', true); toast('已删除想法');
    });
  };
  DO.ixLog = function () { closeSheet(); var d = I(cur().id); if (!d || !ixCanLog(d)) return toast('只有发起人、跟进人和老板能看操作记录', true); location.hash = '#/idea/' + d.id + '/log'; };
  DO.ixCopy = function () { var no = function () { toast('复制失败，请手动复制地址栏链接', true); }; try { navigator.clipboard.writeText(location.href).then(function () { toast('链接已复制'); }, no); } catch (e) { no(); } closeSheet(); };
  DO.nFilter = function (el) { nf = el.dataset.f; render(); };
  DO.ideasNeed = function () { filt.ideas = 'need'; render(); };
  DO.ideasTile = function (el) { filt.ideas = el.dataset.f; filt.ideasOpen = true; render(); };
  DO.ideasRecent = function () { filt.ideasOpen = false; filt.ideas = 'all'; render(); };
  DO.back = function () { goBack(); };
  DO.dvRm = function (el) { dvPick.splice(+el.dataset.i, 1); dvRender(); };
  DO.dvOpen = function (el) {
    var x = S.deliverables.find(function (f) { return f.id === el.dataset.f; }), m = x && (x.media || [])[+el.dataset.i]; if (!m) return;
    var b = blobUrl(m.localId); if (!b) return toast('这个文件还没传到服务器，稍后再试', true);
    if (m.kind === 'image') return openSheet(m.name, '<img src="' + b + '" alt="' + esc(m.name) + '" style="width:100%;border-radius:14px;display:block">', '关闭', function () { closeSheet(); });
    if (m.kind === 'video') return openSheet(m.name, '<video controls playsinline src="' + b + '" style="width:100%;border-radius:14px"></video>', '关闭', function () { closeSheet(); });
    if (m.kind === 'audio') return openSheet(m.name, '<audio controls src="' + b + '" style="width:100%"></audio>', '关闭', function () { closeSheet(); });
    openFile(b, m.name);
  };
  DO.goNew = function () { newMedia = []; draft = { title: '', note: '', mode: 'text', big: false }; location.hash = '#/new'; };

  /* Word（.docx）→ Markdown：在手机上解析，不经过服务器（docx 是 zip，取出 word/document.xml，按段落 / 标题 / 列表转换） */
  function docxToMd(file) {
    return file.arrayBuffer().then(function (buf) {
      var u8 = new Uint8Array(buf), dv = new DataView(buf), eocd = -1;
      for (var i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      if (eocd < 0) throw new Error('不是有效的 Word 文件');
      var n = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), ent = null, dec = new TextDecoder();
      for (var k = 0; k < n; k++) {
        var nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
        var name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
        if (name === 'word/document.xml') ent = { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), raw: dv.getUint32(p + 24, true), off: dv.getUint32(p + 42, true) };
        p += 46 + nl + xl + cl;
      }
      if (!ent) throw new Error('Word 文件里没有正文');
      if (ent.raw > 20 * 1024 * 1024 || ent.off + ent.size > u8.length) throw new Error('Word 文件太大或已损坏');
      var lh = ent.off, start = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true), raw = u8.subarray(start, start + ent.size);
      if (ent.method === 0) return dec.decode(raw);
      if (ent.method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('这台设备不支持读取这种 Word 文件');
      return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    }).then(function (xml) {
      var doc = new DOMParser().parseFromString(xml, 'application/xml'), W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', out = [];
      Array.prototype.forEach.call(doc.getElementsByTagNameNS(W, 'p'), function (pp) {
        var t = Array.prototype.map.call(pp.getElementsByTagNameNS(W, 't'), function (x) { return x.textContent; }).join('').trim(); if (!t) return;
        var st = pp.getElementsByTagNameNS(W, 'pStyle')[0], sv = st ? (st.getAttributeNS(W, 'val') || st.getAttribute('w:val') || '') : '', h = /^(Heading|标题)\s*([1-3])$/i.exec(sv) || /^([1-3])$/.exec(sv);
        var list = pp.getElementsByTagNameNS(W, 'numPr').length;
        out.push(h ? new Array(+(h[2] || h[1]) + 1).join('#') + ' ' + t : list ? '- ' + t : t);
      });
      return out.join('\n\n');
    }).catch(function (e) { throw new Error(/[\u4e00-\u9fa5]/.test(e && e.message || '') ? e.message : '不是有效的 Word 文件'); });
  }
