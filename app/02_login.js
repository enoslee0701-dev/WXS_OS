/* app/02_login.js — 登录、服务器模式：登录 / 创建团队。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
  /* ---------- 页面：登录 ---------- */
  var ROLE_DESC = {
    u_owner: '录想法、做例外决策、查看全局、纠偏', u_op: '认领想法、复核整理稿、派发、跟进、验收行政任务',
    u_lead: '发起想法、规划产品项目、派执行人、验收', u_admin_ex: '行政执行：接收、执行、交付', u_design: '产品执行：原型与 UI',
    u_dev: '产品执行：开发', u_sys: '管理成员与配置，看不到想法内容'
  };
  /* ---------- 服务器模式：登录 / 创建团队 ---------- */
  var SRV = typeof TMS !== 'undefined' && TMS.server, srvL = { probed: false, setup: false, err: '', busy: false, url: SRV ? TMS.serverUrl() : '' };
  function srvProbe() {
    if (!srvL.url || /^https?:\/\/$/.test(srvL.url)) { srvL.probed = true; srvL.err = '请先填写服务器地址'; return; }
    var url = srvL.url;
    TMS.probe(url).then(function (r) { srvL.probed = true; var mode = !r.setup; srvL.err = ''; if (mode !== srvL.setup) { srvL.setup = mode; render(); } else srvRefresh(); }, function (e) { srvL.probed = true; srvL.err = e.error || '连不上服务器'; srvRefresh(); netFix(url); });
  }
  function viewSrvLogin() {
    if (!srvL.probed) { srvProbe(); }
    var urlF = TMS.sameOrigin ? '' : field('服务器地址', '<input type="text" inputmode="url" name="server" value="' + esc(srvL.url) + '" placeholder="老板给的地址，例如 192.168.1.x" autocapitalize="off" autocorrect="off" required><button type="button" class="srv-scan" data-do="srvScan">' + hi('spark', 1.6) + '在这个 Wi-Fi 里自动查找</button>', '<span class="srv-err" id="srvErr"' + (srvL.err ? '' : ' style="display:none"') + '>' + esc(srvL.err) + '</span>');
    var h = '<div class="login srv-login"><div class="mark" aria-hidden="true">协同</div>';
    if (srvL.probed && srvL.setup && !srvL.err) {
      h += '<h1>创建你的团队</h1><p>第一次使用：先建立老板账号。之后由你给每位成员分派登录账号。</p><form class="srv-form" data-form="srvSetup">' + urlF +
        field('初始化码', '<input type="text" name="code" inputmode="numeric" autocomplete="off" required>', '开启团队服务器时显示的 6 位数字（只在第一次建团队时需要）') +
        field('你的姓名', '<input type="text" name="name" maxlength="20" required>') + field('职位（可选）', '<input type="text" name="title" maxlength="20" placeholder="例如：创始人">') +
        field('登录账号', '<input type="text" name="login" autocapitalize="off" autocorrect="off" autocomplete="username" required>', '3–32 位字母、数字或 _ . @ -') +
        field('密码', '<input type="password" name="password" autocomplete="new-password" required>', '至少 8 位') +
        '<label class="sw"><span><b>带上演示数据</b><small>先看看完整的样子；以后可以在设置里一键清理</small></span><input type="checkbox" name="demo" value="1"></label>' +
        '<button class="btn pri block" type="submit"' + (srvL.busy ? ' disabled' : '') + '>' + (srvL.busy ? '正在创建…' : '创建团队') + '</button></form>';
    } else {
      h += '<h1>登录</h1><p>使用老板或管理员分派给你的账号登录。</p><form class="srv-form" data-form="srvLogin">' + urlF +
        field('账号', '<input type="text" name="login" value="' + esc(srvPrefill()) + '" autocapitalize="off" autocorrect="off" autocomplete="username" required>') +
        field('密码', '<input type="password" name="password" autocomplete="current-password" required>') +
        (srvL.probed && srvL.err && TMS.sameOrigin ? '<p class="srv-err">' + esc(srvL.err) + '</p>' : '') +
        '<button class="btn pri block" type="submit"' + (srvL.busy ? ' disabled' : '') + '>' + (srvL.busy ? '正在登录…' : '登录') + '</button></form>' +
        '<p class="muted srv-tip">没有账号？请找老板或管理员为你开通。<br>忘记密码？请老板在「团队 → 成员 → 登录账号与密码」里重置。</p>';
    }
    if (!TMS.sameOrigin) h += '<button class="srv-local" data-do="srvLocal">不连服务器，用演示模式看看</button>';
    return h + '</div>';
  }
  /* 连不上服务器时（安卓）：申请本地网络权限后重试；系统网络能通但浏览器内核不通，就切到原生网络模式；还不行就把诊断写进提示 */
  var netFixing = false;
  // 只更新错误提示，不重绘整页（重绘会清掉正在输入的账号密码、打断自动查找）
  function srvRefresh() {
    var box = document.getElementById('srvErr');
    if (!box || !document.querySelector('form[data-form=srvLogin], form[data-form=srvSetup]')) return render();
    box.textContent = srvL.err || ''; box.style.display = srvL.err ? '' : 'none';
  }
  var netTried = {}, autoScanned = false;
  function netFix(url) {
    if (netFixing || typeof TMN === 'undefined' || !TMN.netDiag || !url || /^https?:\/\/$/.test(url)) return;
    var base = TMS.normUrl ? TMS.normUrl(url) : url;
    if (netTried[base]) return; netTried[base] = true; // 每个地址只诊断一次，避免反复弹提示、反复刷新
    netFixing = true;
    TMN.netDiag(base).then(function (d) {
      netFixing = false; if (!d) return;
      var retry = function (msg) { if (msg) toast(msg); if (srvL.url === url) srvProbe(); };
      if (d.nativeOk && !TMS.nativeMode) { TMS.setNativeMode(true); return retry('已改用手机系统网络连接服务器'); }
      if (d.granted) return retry('已允许访问本地网络，正在重新连接');
      // 这个地址连不上：自动在当前 Wi-Fi 里找一次团队服务器（地址可能填错了，或者电脑换了 IP）
      var diagMsg = '连不上服务器（' + base + '）。手机系统也连不到这个地址：请确认手机和服务器电脑连的是同一个 Wi-Fi（不是流量、不是访客 Wi-Fi）、关掉 VPN，服务器电脑开着。诊断：' + d.device + '；本地网络权限 ' + (d.localnet || '无') + '；' + (d.nativeErr || '').slice(0, 80);
      var showDiag = function () { if (!d.nativeOk && srvL.url === url) { srvL.err = diagMsg; srvRefresh(); } };
      if (!autoScanned && TMS.scan) { autoScanned = true; var sb = document.querySelector('[data-do=srvScan]'); if (sb) return DO.srvScan(sb, function (found) { if (!found) showDiag(); }); }
      showDiag();
      if (SRV && TMS.diag) TMS.diag({ kind: 'connect', base: base, diag: d });
    });
  }
  // 只切换按钮状态，不重绘表单（重绘会清掉已经填好的账号）
  /* 正式模式（连服务器）下的措辞：去掉「演示版」，已经不对的说法（不上传等）换成实际情况；演示模式原样 */
  var SRV_WORDS = [
    [/演示版（阶段 1）/g, '正式版'],
    [/终验、标签、提醒、演示工具/g, '终验、标签、提醒、数据'], [/流程开关、提醒与演示工具/g, '流程开关、提醒与数据'],
    [/演示版里：账号是预设的；[^<'"]*/g, '账号由老板分派；数据保存在团队服务器。'],
    [/演示版的输出由规则模拟，正式版接入真实大模型。/g, '这部分目前由规则生成，结果请核对。'],
    [/演示版：整理由规则模拟完成，不调用真实大模型。/g, '这部分目前由规则整理，结果请核对。'],
    [/演示版：解析由规则模拟完成，不调用真实大模型。/g, '这部分目前由规则解析，结果请核对。'],
    [/AI 模拟输出/g, '规则整理'], [/AI 模拟建议/g, '规则建议'], [/（AI 模拟）/g, '（规则整理）'],
    [/（演示版为模拟整理）/g, '（规则整理）'], [/演示版为模拟整理/g, '规则整理'],
    [/（演示版为规则模拟）/g, ''], [/（演示：规则模拟）/g, '（规则生成）'], [/演示：规则模拟/g, '规则生成'],
    [/演示版只有 App 内通知。/g, '目前只有 App 内通知。'],
    [/演示版还没接入云盘，正式版会支持 Google Drive、OneDrive 等/g, '暂不支持直接连接云盘，可以贴分享链接'],
    [/演示版暂不支持识别图片内容，正式版接入后可识别白板和纸质记录/g, '暂不支持识别图片内容'],
    [/演示版不会上传视频，也无法读取视频里的语音。正式版会提取音轨并自动转写。/g, function () { return TR_ON ? '视频会上传到团队服务器，服务器自动把里面的话转成文字，再交给 AI 整理。' : '视频会作为附件上传，暂时无法读取视频里的语音。'; }],
    [/演示版无法读取视频里的语音。正式版会提取音轨并自动转写。/g, function () { return TR_ON ? '视频里的话会在上传后由服务器自动转成文字。' : '暂时无法读取视频里的语音。'; }],
    [/演示版不会上传，也不会转写。正式版接入后会断点续传并自动转写。/g, function () { return TR_ON ? '录音会上传到团队服务器，并自动转成文字。' : '录音会作为附件上传到团队服务器。'; }],
    [/（演示版不上传）。?/g, ''], [/演示版不会上传。/g, '会上传到团队服务器。'], [/演示版不上传/g, '会上传到团队服务器'],
    [/演示版没有上传，这个文件只在添加它的设备上、刷新前能打开/g, '这个文件还没上传完，或者已被删除'],
    [/演示版只能读取/g, '目前只能读取'],
    [/演示版：AI 按关键词匹配资料段落，不是真正读懂全文。连接团队服务器并启用 AI 后，AI 会通读这些资料来理解公司和老板的思路。/g, '老板和管理员用 AI 时，Claude 会通读这些资料来理解公司和老板的思路。'],
    [/演示版能做这些：/g, '我能做这些：'], [/演示版推荐由规则计算/g, '推荐由规则计算'], [/演示版会把链接记进说明/g, '会把链接记进说明'],
    [/演示版为模板化建议；接入大模型后会结合你的公司方向和历史项目给出具体方案。/g, '目前为模板化建议。'],
    [/演示版不支持上传文件，可贴链接或写说明。/g, '可以贴链接或写说明。'],
    [/演示版：录音不上传，AI 为模拟/g, '录音会上传到团队服务器'],
    [/演示版：语音转文字用的是浏览器自带的识别（安卓 Chrome 支持）；/g, '语音转文字用手机自带的识别；'], [/拆解由规则模拟，不调用真实大模型；/g, '拆解由规则生成；'],
    [/演示版的汇总由规则模拟生成/g, '汇总由规则生成'],
    [/演示版：附件只保存在这台设备，刷新后只保留文件名。/g, '附件会上传到团队服务器。']
  ];
  // 手机 App 里没有「浏览器」：提示改成手机上的说法
  var APP_WORDS = [
    [/（安卓 Chrome 支持）/g, ''],
    [/请在浏览器设置里允许后再试/g, '请在手机「设置 → 应用 → 团队协同 → 权限」里允许麦克风后再试'],
    [/这台设备的浏览器里/g, '这台手机上'],
    [/(当前|这个)浏览器/g, '这台手机'],
    [/浏览器自带的?识别/g, '手机自带的识别'],
    [/浏览器实时识别/g, '手机实时识别']
  ];
  var IS_APP = typeof TMN !== 'undefined' && TMN.native;
  function wordsFix(h) {
    if (typeof h !== 'string') return h;
    if (SRV) h = SRV_WORDS.reduce(function (x, r) { return x.replace(r[0], r[1]); }, h);
    if (IS_APP) h = APP_WORDS.reduce(function (x, r) { return x.replace(r[0], r[1]); }, h);
    if (AI_LOCAL) h = h.replace(/Claude/g, '本机 AI'); // 用的是服务器本机的开源模型
    return h;
  }
  function srvPrefill() { try { return localStorage.getItem('tm_prefill_login') || ''; } catch (e) { return ''; } }
  function srvBusy(b) { srvL.busy = b; var x = document.querySelector('.srv-form button[type=submit]'); if (x) { x.disabled = b; if (!x.dataset.t) x.dataset.t = x.textContent; x.textContent = b ? (x.closest('[data-form=srvSetup]') ? '正在创建…' : '正在登录…') : x.dataset.t; } }
  var SRVF = {
    srvLogin: function (o) { srvL.url = o.server || srvL.url; srvBusy(true); TMS.login(srvL.url, (o.login || '').trim(), o.password || '').then(null, function (e) { srvBusy(false); if (e.needsSetup) { srvL.setup = true; srvL.err = ''; render(); } toast(e.error || '登录失败', true); if (!e.status) netFix(srvL.url); }); },
    srvJoin: function (o) {
      if (String(o.password || '').length < 8) return fieldErr('.srv-form input[name=password]', '密码至少 8 位');
      if (o.password !== o.again) return fieldErr('.srv-form input[name=again]', '两次输入的密码不一样');
      jn.busy = true; render();
      TMS.inviteAccept(srvL.url, jn.tok, o.password).then(null, function (e) { jn.busy = false; var m = (e && e.error) || '进不去，稍后再试'; if (/失效/.test(m)) jn.err = m; render(); toast(m, true); });
    },
    srvSetup: function (o) { srvL.url = o.server || srvL.url; srvBusy(true); TMS.setup(srvL.url, { name: (o.name || '').trim(), title: (o.title || '').trim(), login: (o.login || '').trim(), password: o.password || '', demo: !!o.demo, code: (o.code || '').trim() }).then(null, function (e) { srvBusy(false); toast(e.error || '创建失败', true); }); }
  };
  /* App（原生）首次打开：先问连团队服务器还是看演示；浏览器演示网页不受影响 */
  function demoChosen() { try { return localStorage.getItem('tm_demo_chosen') === '1'; } catch (e) { return true; } }
  function viewWelcome() {
    return '<div class="login welcome"><div class="mark" aria-hidden="true">协同</div><h1>欢迎使用团队协同</h1><p>用科技让福音走得更远。连接你们团队的服务器，用老板分派给你的账号登录。</p>' +
      '<button class="btn pri block wl-go" data-do="srvConnect">连接团队服务器</button>' +
      '<button class="btn block wl-demo" data-do="demoChoose">先看看演示</button>' +
      '<p class="muted wl-tip">服务器地址由老板提供，例如 http://192.168.1.20:8787。演示模式的数据只存在这台手机上。</p></div>';
  }
  /* 邀请链接 #/join/<邀请码>：看是谁邀请、账号是什么，设一个密码就进来（不用初始密码、不用再改密码） */
  var jn = { tok: '', info: null, err: '', busy: false };
  function viewJoin(tok) {
    if (jn.tok !== tok) { jn = { tok: tok, info: null, err: '', busy: false }; TMS.invitePeek(srvL.url, tok).then(function (r) { jn.info = r; render(); }, function (e) { jn.err = (e && e.error) || '连不上服务器'; render(); }); }
    var h = '<div class="login srv-login join"><div class="mark" aria-hidden="true">协同</div>';
    if (jn.err) h += '<h1>邀请链接打不开</h1><p>' + esc(jn.err) + '</p><a class="btn block" href="#/login">用账号密码登录</a>';
    else if (!jn.info) h += '<h1>正在打开邀请…</h1><p class="muted">连接 ' + esc(srvL.url) + '</p>';
    else h += '<h1>' + esc(jn.info.by || '老板') + ' 邀请你加入</h1><p>你是 <b>' + esc(jn.info.name) + '</b>' + (jn.info.title ? '（' + esc(jn.info.title) + '）' : '') + '，登录账号 <b>' + esc(jn.info.login) + '</b>。设一个只有你知道的密码，以后就用它登录。</p>' +
      '<form class="srv-form" data-form="srvJoin">' + field('设置密码', '<input type="password" name="password" autocomplete="new-password" required>', '至少 8 位，别用生日、连续数字') + field('再输一次', '<input type="password" name="again" autocomplete="new-password" required>') +
      '<button class="btn pri block" type="submit"' + (jn.busy ? ' disabled' : '') + '>' + (jn.busy ? '正在进入…' : '设好密码，进入团队') + '</button></form><p class="muted wl-tip">链接 7 天内有效、只能用一次。不是你本人请不要继续。<a href="#/login">用账号密码登录</a></p>';
    return h + '</div>';
  }
  function viewLogin() {
    if (SRV && cur().name === 'join' && cur().id) return viewJoin(cur().id);
    if (SRV) return viewSrvLogin();
    if (typeof TMN !== 'undefined' && TMN.native && !demoChosen()) return viewWelcome();
    return '<div class="login"><div class="mark" aria-hidden="true">协同</div><h1>以谁的身份进入？</h1><p>每个账号按角色和权限看到不同内容。切换账号，可以把一件事从想法一路走到验收。</p>' +
      '<div class="list">' + S.users.map(function (u) {
        return '<div class="acct" role="button" tabindex="0" data-do="login" data-id="' + u.id + '">' + av(u.id) + '<div><b>' + esc(u.name) + '　<span class="muted" style="font-weight:400;font-size:14px">' + esc(u.title) + '</span></b><small>' + esc(ROLE_DESC[u.id] || '') + '</small></div><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></div>';
      }).join('') + '</div><p class="muted" style="font-size:13.5px;margin-top:18px">演示模式：账号是预设的，数据只存在这台设备上。连接团队服务器后，用老板分派的真实账号登录，数据在团队里实时同步。</p><button class="srv-local" data-do="srvConnect">连接团队服务器 →</button></div>';
  }

