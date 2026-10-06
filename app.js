(function () {
  'use strict';
  var K = 'tm_demo_v3', KU = 'tm_user_v3';
  var L = TM.L;
  var S, me = null, blobs = {}, rec = null, newMedia = [];
  var filt = { ideas: 'all', work: null };

  /* ---------- 存储 ---------- */
  var SRV_ON = typeof TMS !== 'undefined' && TMS.loggedIn();
  function load() {
    try { var raw = localStorage.getItem(K); if (raw) { var x = JSON.parse(raw); if (x && x.v === 3 && !x.loading) return x; } } catch (e) {}
    // 服务器模式：完整缓存太大存在 IndexedDB 里（异步），先用小的「启动骨架」（成员、设置）启动，绝不能退回演示数据
    if (SRV_ON) { try { var b = JSON.parse(localStorage.getItem('tm_boot') || 'null'); if (b && b.users) { var sh = TM.blank({}); sh.users = b.users; sh.settings = b.settings || sh.settings; sh.seq = b.seq || sh.seq; sh.real = b.real; sh.loading = true; return sh; } } catch (e) {} var e0 = TM.blank({}); e0.loading = true; return e0; }
    return TM.seed();
  }
  function save() {
    if (S.loading) return; // 启动骨架不是完整数据，不能存成缓存（否则离线时再也读不到 IndexedDB 里的完整数据）
    var j = JSON.stringify(S);
    try { localStorage.setItem(K, j); } catch (e) {
      // 超过 localStorage 容量（约 5MB，团队用久了会到）：完整数据改存 IndexedDB
      try { localStorage.removeItem(K); } catch (x) {}
      if (SRV_ON) TMS.cacheBig(j);
    }
    if (SRV_ON) try { localStorage.setItem('tm_boot', JSON.stringify({ users: S.users, settings: S.settings, seq: S.seq, real: S.real })); } catch (e) {}
  }
  S = load();
  TM.migrate(S);
  var PHOTOS = { u_owner: '__ENOS__' };
  /* 真实 AI：服务器模式下老板 / 管理员可用（服务器配置了密钥时）；否则一律规则模拟 */
  var AI_ON = false; var TR_ON = false, APPV = '', AI_LOCAL = false, AI_MODEL = ''; // AI_LOCAL：没有 Claude 密钥，用的是服务器本机的开源模型 // APPV：安装的 App 版本号（原生 App 才有）
  if (typeof TMN !== 'undefined' && TMN.appInfo) TMN.appInfo().then(function (i) { if (i && i.version) APPV = i.version; });
  // 团队服务器装了语音转写（录音 / 视频自动转文字）
  if (typeof TMS !== 'undefined' && TMS.loggedIn()) TMS.aiStatus().then(function (r) { AI_ON = !!(r && r.enabled); TR_ON = !!(r && r.transcribe); AI_LOCAL = !!(r && r.provider === 'local'); AI_MODEL = r && r.model || ''; if (AI_ON && aiS && aiS.open) renderAI(); });
  /* 头像：裁成正方形、压到 256 像素再上传（服务器模式）；演示模式只存在本机 */
  function avatarPick(f) {
    if (!/^image\//.test(f.type)) return toast('请选一张图片', true);
    var img = new Image(), url = URL.createObjectURL(f);
    img.onload = function () {
      var n = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 256;
      c.getContext('2d').drawImage(img, (img.width - n) / 2, (img.height - n) / 2, n, n, 0, 0, 256, 256); URL.revokeObjectURL(url);
      c.toBlob(function (bl) { if (!bl) return toast('图片处理失败', true); var id = rid('a'); blobs[id] = keepBlob(id, new File([bl], 'avatar.jpg', { type: 'image/jpeg' })); act('member.update', { id: me, avatar: id }, '头像已更新'); }, 'image/jpeg', 0.85);
    };
    img.onerror = function () { toast('这张图片打不开', true); };
    img.src = url;
  }
  /* 附件 ID：加密随机（服务器按 ID 存文件，不能被猜到或抢注） */
  function rid(p) { var a = new Uint8Array(12); try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < 12; i++) a[i] = Math.random() * 256; } return p + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  /* 附件：本机预览用 blob URL；服务器模式下同时在后台上传（localId 即服务器文件 ID），别的设备从服务器读取 */
  function keepBlob(id, data) { var u = URL.createObjectURL(data); if (typeof TMS !== 'undefined' && TMS.loggedIn()) TMS.upload(id, data, data && data.name); return u; }
  // 打开链接 / 文件：App 里交给系统浏览器或「用其他应用打开」（见 native.js），网页里开新窗口
  function openLink(u) { if (typeof TMN !== 'undefined' && TMN.openUrl) TMN.openUrl(u); else window.open(u, '_blank', 'noopener'); }
  function openFile(u, name) {
    if (typeof TMN !== 'undefined' && TMN.native && /^blob:/.test(u) && TMN.canShareFile) {
      return fetch(u).then(function (r) { return r.blob(); }).then(function (b) { return TMN.shareFile(b, name); }).catch(function () { toast('这个文件打不开', true); });
    }
    openLink(u);
  }
  // 手机自己转不了文字时，交给团队服务器转（服务器装了 whisper；见 server/transcribe.js）
  function canSrvTr() { return SRV && TR_ON && typeof TMS !== 'undefined' && TMS.loggedIn() && !!TMS.transcribe; }
  function srvTr(blob, what) {
    openSheet('正在转文字', '<div class="tr-wait"><span class="ai-typing"><i></i><i></i><i></i></span><p>正在把' + (what || '录音') + '里的话转成文字…</p><small class="muted">在团队服务器上转写，一般几秒到一分钟</small></div>', '请稍候', function () {});
    return TMS.transcribe(blob).then(function (t) { closeSheet(); return String(t || '').trim(); }, function (e) { closeSheet(); toast((e && e.error) || '转文字失败', true); throw e; });
  }
  // 任务交付物：提交时选的照片 / 文件
  var dvPick = [];
  function dvRender() { var box = document.getElementById('dv-files'); if (!box) return; box.innerHTML = dvPick.map(function (m, i) { return '<div class="dv-f">' + (m.kind === 'image' && blobUrl(m.localId) ? '<img src="' + blobUrl(m.localId) + '" alt="">' : '<span class="dv-ic">' + ai2('doc2', 1.6) + '</span>') + '<span>' + esc(m.name) + '<small>' + esc(m.size) + '</small></span><button type="button" data-do="dvRm" data-i="' + i + '" aria-label="移除 ' + esc(m.name) + '">×</button></div>'; }).join(''); }
  function dvMediaHTML(x) {
    var ms = x.media || []; if (!ms.length) return '';
    return '<div class="dv-ms">' + ms.map(function (m, i) { var b = blobUrl(m.localId); return m.kind === 'image' && b ? '<button class="dv-th" data-do="dvOpen" data-f="' + x.id + '" data-i="' + i + '" aria-label="查看 ' + esc(m.name) + '"><img src="' + b + '" alt=""></button>' : '<button class="dv-chip" data-do="dvOpen" data-f="' + x.id + '" data-i="' + i + '">' + ai2(m.kind === 'video' ? 'vcam' : m.kind === 'audio' ? 'mic' : 'doc2', 1.5) + '<span>' + esc(m.name) + '</span></button>'; }).join('') + '</div>';
  }
  // 录音 / 视频的转写（团队服务器上的 whisper 转好后写回）
  function trBlock(m) {
    if (!(m.kind === 'audio' || m.kind === 'video')) return '';
    var what = m.kind === 'video' ? '视频' : '录音';
    if (m.transcriptStatus === 'pending') return '<div class="ix2-tr wait"><i></i>正在把' + what + '里的话转成文字…</div>';
    if (m.transcriptStatus === 'failed') return '<div class="ix2-tr bad">这段' + what + '没能转成文字</div>';
    if (m.transcriptStatus === 'done' && !m.transcript) return '<div class="ix2-tr bad">这段' + what + '里没有识别到说话</div>';
    if (m.transcript) return '<details class="ix2-tr"><summary>' + what + '转成的文字 · ' + m.transcript.length + ' 字</summary><p>' + esc(m.transcript) + '</p></details>';
    return '';
  }
  function blobUrl(id) { return id ? (blobs[id] || (typeof TMS !== 'undefined' && TMS.loggedIn() ? TMS.fileUrl(id) : null)) : null; }
  try { me = localStorage.getItem(KU); } catch (e) {}
  if (me && !TM.user(S, me)) me = null;

  /* ---------- 工具 ---------- */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var COLORS = ['#2148C0', '#0E7490', '#7C3AED', '#B45309', '#047857', '#BE185D', '#4B5563'];
  function color(uid) { var i = S.users.findIndex(function (u) { return u.id === uid; }); return COLORS[(i < 0 ? 6 : i) % COLORS.length]; }
  function av(uid, sm) {
    if (uid === 'agent') return '<span class="av agent' + (sm ? ' sm' : '') + '" aria-hidden="true">AI</span>';
    if (uid === 'system') return '<span class="av agent' + (sm ? ' sm' : '') + '" aria-hidden="true">系</span>';
    var n = TM.name(S, uid), uu = TM.user(S, uid), au = uu && uu.avatar && blobUrl(uu.avatar);
    // 头像文件取不到（没同步到服务器、被删）时：去掉图片，显示名字的字
    if (au) return '<span class="av ph' + (sm ? ' sm' : '') + '" aria-hidden="true" data-ch="' + esc(/^[A-Za-z]/.test(n) ? n.charAt(0) : n.slice(-1)) + '"><img src="' + esc(au) + '" alt="" loading="lazy" onerror="var p=this.parentNode;p.classList.remove(\'ph\');p.textContent=p.dataset.ch"></span>';
    if (PHOTOS[uid] && !S.real && n === 'Enos') return '<span class="av ph' + (sm ? ' sm' : '') + '" aria-hidden="true"><img src="' + PHOTOS[uid] + '" alt=""></span>'; return '<span class="av' + (sm ? ' sm' : '') + '" style="background:' + color(uid) + '" aria-hidden="true">' + esc(/^[A-Za-z]/.test(n) ? n.charAt(0) : n.slice(-1)) + '</span>';
  }
  function nm(uid) { var u = TM.user(S, uid); var n = TM.name(S, uid); return u && S.settings.showTiers && u.tier ? n + '（' + u.tier + '）' : n; }
  function pill(group, st) { return '<span class="pill t-' + TM.TONE[group][st] + '">' + esc(L[group === 'decision' ? 'decisionStatus' : group][st]) + '</span>'; }
  function ago(t) {
    var d = Date.now() - t, m = Math.round(d / 60000);
    if (m < 1) return '刚刚'; if (m < 60) return m + ' 分钟前'; var h = Math.round(m / 60); if (h < 24) return h + ' 小时前';
    var dd = Math.round(h / 24); if (dd < 30) return dd + ' 天前'; var x = new Date(t); return (x.getMonth() + 1) + '月' + x.getDate() + '日';
  }
  function dueTxt(due) { if (!due) return ''; var p = due.split('-'); return +p[1] + '月' + +p[2] + '日截止'; }
  function isOwner() { return TM.hasRole(S, me, 'owner'); }
  function role() { return TM.primaryRole(S, me); }
  function vIdeas() { return S.ideas.filter(function (d) { return TM.canViewIdea(S, me, d); }); }
  function vWork() { return S.workItems.filter(function (w) { return TM.canViewWork(S, me, w); }); }
  function vTasks() { return S.tasks.filter(function (t) { return TM.canViewTask(S, me, t); }); }
  function W(id) { return S.workItems.find(function (w) { return w.id === id; }); }
  function I(id) { return S.ideas.find(function (d) { return d.id === id; }); }
  function T(id) { return S.tasks.find(function (t) { return t.id === id; }); }
  function byRecent(a, b) { return (b.lastActivity || b.at || 0) - (a.lastActivity || a.at || 0); }
  function unread() { return S.notifications.filter(function (n) { return n.userId === me && !n.read; }).length; }

  var toastT;
  function toast(msg, bad) { if (typeof TMN !== 'undefined' && TMN.haptic) TMN.haptic(bad ? 'error' : 'success'); var el = document.getElementById('toast'); el.textContent = wordsFix(msg); el.className = 'toast on' + (bad ? ' bad' : ''); clearTimeout(toastT); toastT = setTimeout(function () { el.className = 'toast' + (bad ? ' bad' : ''); }, bad ? 3600 : 2200); }
  function act(a, p, okMsg) {
    var r = TM.act(S, me, a, p);
    if (!r.ok) { toast(r.error, true); return r; }
    save(); closeSheet(); if (okMsg) toast(okMsg); render(); return r;
  }

  /* ---------- 卡片组件 ---------- */
  function batonHTML(nx) {
    if (!nx) return '';
    if (nx.queue) return '<div class="baton"><span class="q">等待运营者认领</span></div>';
    return '<div class="baton">' + av(nx.who, true) + '<span>下一步 <b>' + esc(nx.who === me ? '你' : nm(nx.who)) + '</b> ' + esc(nx.what) + '</span></div>';
  }
  function ideaRow(d) {
    var nx = TM.nextForIdea(S, d), pr = TM.ideaProgress(S, d.id);
    var meta = [nm(d.creatorId) + ' 发起', d.path === 'cocreate' ? '团队共创' : d.path === 'direct' ? '直接推进' : '', ago(d.lastActivity)];
    if (d.aiStatus === 'failed') meta.push('<span class="r">AI 整理失败</span>');
    return '<a class="row" href="#/idea/' + d.id + '"><div class="t"><span>' + esc(d.title || d.note.slice(0, 24) || '未命名') + '</span>' + pill('idea', d.status) + '</div>' +
      '<div class="m">' + meta.filter(Boolean).map(function (x) { return x.indexOf('<span') === 0 ? x : '<span>' + esc(x) + '</span>'; }).join('') + '</div>' +
      (pr != null ? '<div class="bar"><i style="width:' + Math.round(pr * 100) + '%"></i></div>' : '') + batonHTML(nx) + '</a>';
  }
  function taskRow(t, opt) {
    var w = W(t.workId), od = TM.isOverdue(S, t), st = TM.isStale(S, t), nx = TM.nextForTask(S, t);
    var meta = ['<span>' + esc(w ? w.title : '') + '</span>'];
    if (t.due) meta.push(od ? '<span class="r">已逾期 ' + esc(dueTxt(t.due)) + '</span>' : '<span>' + esc(dueTxt(t.due)) + '</span>');
    if (st) meta.push('<span class="r">' + S.settings.staleDays + ' 天以上无动态</span>');
    if (t.status === 'blocked' && t.blockedReason) meta.push('<span class="r">受阻：' + esc(t.blockedReason) + '</span>');
    var duty = opt && opt.duty ? '<div class="m" style="margin-top:6px"><span>交付：' + esc(t.expected) + '</span></div>' : '';
    return '<a class="row' + (od || st || t.status === 'blocked' ? ' flag' : '') + '" href="#/task/' + t.id + '"><div class="t"><span>' + esc(t.title) + '</span>' + pill('task', t.status) + '</div><div class="m">' + meta.join('') + '</div>' + duty + batonHTML(nx) + '</a>';
  }
  function workRow(w) {
    var p = TM.workProgress(S, w.id);
    var flags = S.tasks.filter(function (t) { return t.workId === w.id && (t.status === 'blocked' || TM.isOverdue(S, t) || TM.isStale(S, t)); }).length;
    var meta = ['<span>' + L.kind[w.kind] + '</span>', '<span>阶段：' + esc(TM.stageName(w.kind, w.stage)) + '</span>', '<span>任务 ' + p.done + '/' + p.total + '</span>'];
    if (flags) meta.push('<span class="r">' + flags + ' 项需关注</span>');
    var nx = w.status === 'planning' ? { who: w.leadId, what: '安排任务' } : w.status === 'acceptance' ? { who: w.reviewerId, what: '确认事项完成' } : null;
    return '<a class="row' + (flags ? ' flag' : '') + '" href="#/work/' + w.id + '"><div class="t"><span>' + esc(w.title) + '</span>' + pill('work', w.status) + '</div><div class="m">' + meta.join('') + '</div>' +
      (p.total ? '<div class="bar"><i style="width:' + Math.round(p.done / p.total * 100) + '%"></i></div>' : '') + batonHTML(nx) + '</a>';
  }
  function decisionRow(dc) {
    var d = dc.ideaId ? I(dc.ideaId) : null;
    return '<a class="row" href="#/idea/' + (d ? d.id : '') + '"><div class="t"><span>' + esc(dc.question) + '</span><span class="pill t-wait">' + esc(L.decision[dc.kind]) + '</span></div><div class="m"><span>' + esc(TM.name(S, dc.requestedBy)) + ' 上报</span><span>' + ago(dc.at) + '</span></div></a>';
  }
  var INBOX = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/></svg>';
  function emptyBox(msg) { return '<div class="empty">' + INBOX + '<span>' + esc(msg) + '</span></div>'; }
  function list(rows, emptyMsg) { return rows.length ? '<div class="list">' + rows.join('') + '</div>' : emptyBox(emptyMsg); }
  var IC = {
    gavel: '<path d="M14 4l6 6M12 6l6 6M4 20l8-8M9 9l6 6"/>', alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>', inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>', plan: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>', play: '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/>', people: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c.8-3.5 3.2-5 6-5s5.2 1.5 6 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c1.6.6 2.6 2.2 3 5"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'
  };
  function ico(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[k] + '</svg>'; }
  function scene(big, sub, tiles) {
    return '<section class="scene hero"><div class="big">' + big + '</div><p>' + esc(sub) + '</p><div class="tiles">' + tiles.map(function (t) {
      return '<button type="button" class="tile" data-do="' + t.do + '" data-f="' + t.f + '"><span class="row1">' + ico(t.icon) + '<b>' + t.n + '</b></span><span>' + esc(t.label) + '</span></button>';
    }).join('') + '</div></section>';
  }
  function sec(title, n, extra) { return '<div class="sec"><h2>' + esc(title) + (n != null ? ' <span class="n">' + n + '</span>' : '') + '</h2>' + (extra || '') + '</div>'; }

  /* ---------- 页面：登录 ---------- */
  var ROLE_DESC = {
    u_owner: '录想法、做例外决策、查看全局、纠偏', u_op: '认领想法、复核整理稿、派发、跟进、验收行政任务',
    u_lead: '发起想法、规划产品事项、派执行人、验收', u_admin_ex: '行政执行：接收、执行、交付', u_design: '产品执行：原型与 UI',
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
        field('密码', '<input type="password" name="password" minlength="8" autocomplete="new-password" required>', '至少 8 位') +
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
  function viewLogin() {
    if (SRV) return viewSrvLogin();
    if (typeof TMN !== 'undefined' && TMN.native && !demoChosen()) return viewWelcome();
    return '<div class="login"><div class="mark" aria-hidden="true">协同</div><h1>以谁的身份进入？</h1><p>每个账号按角色和权限看到不同内容。切换账号，可以把一件事从想法一路走到验收。</p>' +
      '<div class="list">' + S.users.map(function (u) {
        return '<div class="acct" role="button" tabindex="0" data-do="login" data-id="' + u.id + '">' + av(u.id) + '<div><b>' + esc(u.name) + '　<span class="muted" style="font-weight:400;font-size:14px">' + esc(u.title) + '</span></b><small>' + esc(ROLE_DESC[u.id] || '') + '</small></div><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></div>';
      }).join('') + '</div><p class="muted" style="font-size:13.5px;margin-top:18px">演示模式：账号是预设的，数据只存在这台设备上。连接团队服务器后，用老板分派的真实账号登录，数据在团队里实时同步。</p><button class="srv-local" data-do="srvConnect">连接团队服务器 →</button></div>';
  }

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
      var nx = TM.nextForTask(S, t), w = W(t.workId);
      if (nx && nx.who === me) out.push({ title: (nx.what === '执行' ? '' : nx.what + '：') + t.title, tag: [L.kind[w.kind], w.kind === 'product' ? 'tg-blue' : 'tg-green'], prio: prioOf(t.due, t.status === 'blocked'), who: t.ownerId, due: dueLabel(t.due), href: '#/task/' + t.id, at: t.createdAt, date: actDate(t.due), comments: S.comments.filter(function (c) { return c.taskId === t.id; }).length, mine: t.ownerId === me, people: t.ownerId === me ? [] : [t.ownerId], kind: '任务' });
      // 我负责但受阻（下一步等别人解除）：仍出现在我的待办里，不然首页会说「都处理完了」、任务页看不到自己逾期的任务
      else if (nx && t.ownerId === me && t.status === 'blocked') out.push({ title: '受阻，等 ' + nm(nx.who) + ' 处理：' + t.title, tag: [L.kind[w.kind], w.kind === 'product' ? 'tg-blue' : 'tg-green'], prio: prioOf(t.due, true), who: t.ownerId, due: dueLabel(t.due), href: '#/task/' + t.id, at: t.createdAt, date: actDate(t.due), comments: S.comments.filter(function (c) { return c.taskId === t.id; }).length, mine: true, people: [], kind: '任务' });
      else if (t.status === 'done' && isToday(t.lastActivity) && (t.ownerId === me || t.reviewerId === me)) out.push({ done: true, title: t.title, tag: [L.kind[w.kind], w.kind === 'product' ? 'tg-blue' : 'tg-green'], prio: 'lo', who: t.ownerId, due: { t: '今天', bad: false }, href: '#/task/' + t.id, at: t.createdAt, date: TM.todayStr(S), doneAt: t.lastActivity, comments: 0, mine: t.ownerId === me, people: t.ownerId === me ? [] : [t.ownerId] });
    });
    if (isOwner()) S.decisions.filter(function (d) { return d.status === 'pending'; }).forEach(function (d) {
      out.push({ title: '决策：' + d.question, tag: ['决策', 'tg-purple'], prio: 'hi', who: d.requestedBy, due: { t: isToday(d.at) ? '今天' : ago(d.at), bad: false }, href: '#/idea/' + d.ideaId, at: d.at, date: TM.todayStr(S), comments: 0, mine: false, people: [d.requestedBy] });
    });
    vIdeas().forEach(function (d) {
      var nx = TM.nextForIdea(S, d);
      if (d.status === 'awaiting_owner') return;
      if (nx && (nx.who === me || (nx.queue && TM.canFollow(S, me)))) out.push({ title: nx.what + '：' + (d.title || d.note.slice(0, 16)), tag: ['想法', 'tg-purple'], prio: nx.queue || d.status === 'summary_ready' ? 'mid' : 'lo', who: d.creatorId, due: { t: ago(d.lastActivity), bad: false }, href: '#/idea/' + d.id, at: d.submittedAt || d.createdAt, date: TM.todayStr(S), comments: S.suggestions.filter(function (x) { return x.ideaId === d.id; }).length, mine: d.creatorId === me && d.status === 'draft', people: d.creatorId === me ? [] : [d.creatorId] });
    });
    vWork().forEach(function (w) {
      if ((w.status === 'planning' && w.leadId === me) || (w.status === 'acceptance' && w.reviewerId === me))
        out.push({ title: (w.status === 'planning' ? '安排任务：' : '确认完成：') + w.title, tag: ['事项', 'tg-blue'], prio: 'mid', who: w.operatorId, due: dueLabel(w.due), href: '#/work/' + w.id, at: w.createdAt, date: actDate(w.due), comments: 0, mine: false, people: [w.operatorId] });
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
      '<header class="hm-top"><button class="hm-me" data-do="switch" aria-label="切换账号，当前 ' + esc(u.name) + '">' + av(me) + '<i style="background:' + p[1] + '"></i></button>' + (SRV ? '<span></span>' : '<span class="hm-demo">演示版</span>') + '<a class="hm-bell" href="#/inbox" aria-label="通知 ' + nU + ' 条未读">' + hi('bell', 1.8) + (nU ? '<i>' + nU + '</i>' : '') + '</a></header>' +
      '<div class="hm-copy"><small>FOR A GREATER MISSION</small><h1>用科技<br>让福音走得更远</h1>' +
      '<button class="hm-verse" data-do="hmVerse"><svg class="hm-q" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18v-5.5C4 8.4 6.2 6 10 5.5V8c-2 .4-3 1.7-3 4h3v6zm9.5 0v-5.5c0-4.1 2.2-6.5 6-7V8c-2 .4-3 1.7-3 4h3v6z" fill="currentColor"/></svg><span><b>' + esc(VERSES[hmV % VERSES.length][0]).replace('，', '，<br>') + '</b><small>— ' + VERSES[hmV % VERSES.length][1] + '</small></span>' + hi('chev', 2) + '</button></div>' +
      '<div class="hm-cards"><div class="hm-script" aria-hidden="true">Better<br>&nbsp;&nbsp;Together<svg viewBox="0 0 180 40"><path d="M4 38C60 22 120 10 176 2" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg></div>' + homeCards().map(function (k, i) { return '<button class="hm-card c' + (i + 1) + ' hc-' + k[0] + '" data-do="' + k[0] + '"><span class="hm-ic">' + k[1] + '</span><i class="hm-go">' + hi('chev', 2.2) + '</i><b>' + k[2] + '</b><small>' + k[3] + '</small></button>'; }).join('') + '</div>' +
      '<footer class="hm-foot"><i></i><p>微小的顺服，<br>可以带来永恒的改变。</p><small>SMALL STEPS · ETERNAL IMPACT</small></footer></section>';
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
      return { title: x.title, tag: [tag, tag === '决策' || tag === '想法' ? 'tg-purple' : tag === '产品' || tag === '事项' ? 'tg-blue' : 'tg-green'], prio: x.prio, who: x.people[0] || me, due: { t: x.time ? (x.date < t0 ? '逾期' : '今天 ') + x.time : x.timeLabel || '今天', bad: x.date < t0 }, href: x.sys ? x.href : '#/tasks', done: x.done };
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
  function projSeg(on) { return '<div class="seg"><button class="' + (on === 'work' ? 'on' : '') + '" data-do="goWork">事项</button><button class="' + (on === 'ideas' ? 'on' : '') + '" data-do="goIdeas">想法</button></div>'; }
  /* 全局搜索：在自己能看到的数据里找（S 已按身份裁剪）。多个词同时匹配、不分大小写；结果按类别分组、片段里高亮命中的词 */
  function searchAll(raw) {
    var ks = String(raw || '').toLowerCase().split(/\s+/).filter(Boolean); if (!ks.length) return [];
    var vi = {}, vt = {}; vIdeas().forEach(function (d) { vi[d.id] = d; }); vTasks().forEach(function (t) { vt[t.id] = t; }); // 只在自己能看到的想法、任务里找留言和讨论
    var out = [], hit = function (txt) { var l = String(txt || '').toLowerCase(); return ks.every(function (k) { return l.indexOf(k) >= 0; }); };
    var add = function (g, title, text, href) { out.push({ g: g, title: title || '（未命名）', text: String(text || ''), href: href }); };
    vIdeas().forEach(function (d) { var sm = TM.latestSummary(S, d.id, 'analysis'), full = [d.title, TM.noteOf ? TM.noteOf(d) : d.note, (d.tags || []).join(' '), sm && sm.payload ? (sm.payload.summary || '') + ' ' + (sm.payload.goal || '') : ''].join(' '); if (hit(full)) add('想法', d.title, full, '#/idea/' + d.id); });
    S.suggestions.forEach(function (x) { var d = vi[x.ideaId]; if (d && hit(x.body)) add('讨论', d.title, nm(x.authorId) + '：' + x.body, '#/idea/' + d.id); });
    vWork().forEach(function (w) { var full = [w.title, w.goal, w.keyResults, (w.tags || []).join(' ')].join(' '); if (hit(full)) add('项目', w.title, full, '#/work/' + w.id);
      (w.files || []).forEach(function (f) { if (hit(f.name)) add('文件', f.name, '项目「' + w.title + '」的文件', '#/work/' + w.id); }); });
    vTasks().forEach(function (t) { var full = [t.title, t.description, t.expected, t.criteria].join(' '); if (hit(full)) add('任务', t.title, full, '#/task/' + t.id); });
    var vw = {}; vWork().forEach(function (w) { vw[w.id] = w; });
    S.comments.forEach(function (c) { if (!hit(c.body)) return; var t = c.taskId && vt[c.taskId], w = !c.taskId && c.workId && vw[c.workId]; if (t) add('留言', t.title, nm(c.authorId) + '：' + c.body, '#/task/' + t.id); else if (w) add('留言', w.title, nm(c.authorId) + '：' + c.body, '#/work/' + w.id); });
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

  /* ---------- 页面：想法列表 ---------- */
  var IF = [['all', '全部'], ['draft', '草稿'], ['cocreate', '共创'], ['triage', '待整理'], ['awaiting', '等决策'], ['planned', '进行中'], ['finished', '已完成'], ['closed', '暂缓/不做']];
  function ideaMatch(d, f) {
    switch (f) {
      case 'draft': return d.status === 'draft'; case 'cocreate': return d.status === 'discussing' || d.status === 'summary_ready';
      case 'triage': return d.status === 'triage'; case 'awaiting': return d.status === 'awaiting_owner';
      case 'planned': return d.status === 'planned' && TM.ideaProgress(S, d.id) !== 1; case 'finished': return d.status === 'planned' && TM.ideaProgress(S, d.id) === 1;
      case 'closed': return d.status === 'on_hold' || d.status === 'declined';
      case 'mine': return S.suggestions.some(function (x) { return x.ideaId === d.id && x.authorId === me; }) || S.workItems.some(function (w) { return w.ideaId === d.id && S.tasks.some(function (t) { return t.workId === w.id && (t.ownerId === me || (t.collabs || []).indexOf(me) >= 0); }); });
      default: return true;
    }
  }
  var IB = {
    all: ['全部想法', '所有你能看到的', '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>', 'ib-slate'],
    draft: ['草稿', '只有自己可见', '<path d="M4.5 19.5l1-4.2L15.8 5a2.1 2.1 0 0 1 3 3L8.6 18.4z"/><path d="M13.8 7l3 3"/>', 'ib-gray'],
    cocreate: ['共创中', '团队一起出主意', '<circle cx="9" cy="8.5" r="3"/><path d="M3.8 19c.8-2.9 2.7-4.4 5.2-4.4s4.4 1.5 5.2 4.4M15.2 5.8a3 3 0 0 1 0 5.4M16.8 14.8c1.7.5 2.9 1.9 3.4 4.2"/>', 'ib-violet'],
    triage: ['待整理', '等运营认领', '<path d="M4 7h16M4 12h10M4 17h6"/><circle cx="18" cy="16" r="3"/>', 'ib-amber'],
    awaiting: ['等决策', '等老板拍板', '<path d="M6 21V4"/><path d="M6 4.5h11l-2.5 4 2.5 4H6"/>', 'ib-red'],
    planned: ['进行中', '已形成事项', '<circle cx="12" cy="12" r="8.5"/><path d="M10 8.8v6.4l5-3.2z"/>', 'ib-blue'],
    finished: ['已完成', '结果已交付', '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.4 2.4 4.6-5"/>', 'ib-green'],
    closed: ['暂缓 / 不做', '先放一放', '<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>', 'ib-gray'],
    mine: ['我参与的', '提过建议或有我的任务', '<circle cx="10" cy="8" r="3.2"/><path d="M4 19.5c.7-3.1 3-4.8 6-4.8 1.3 0 2.4.3 3.4.9"/><path d="M15 17.2l2 2 3.5-3.7"/>', 'ib-amber']
  };
  function ideaNeedsMe(d) {
    if (d.status === 'awaiting_owner' && isOwner()) return true;
    if (d.status === 'draft' && d.creatorId === me) return true;
    if (d.status === 'triage' && TM.canFollow(S, me)) return true;
    if (d.status === 'cocreate' && d.creatorId !== me && !S.suggestions.some(function (x) { return x.ideaId === d.id && x.authorId === me; })) return true;
    return false;
  }
  /* 执行者不整理、不决策：六宫格换成和自己相关的分类 */
  var EXEC_TILE = [['all', '全部想法', '从灵感到行动'], ['cocreate', '共创中', '团队一起出主意'], ['mine', '我参与的', '提过建议或有我的任务'], ['planned', '进行中', '正在推进的项目'], ['finished', '已完成', '达成的成果'], ['closed', '暂缓 / 不做', '先放一放']];
  var IDEA_TILE = [['all', '全部想法', '从灵感到行动'], ['cocreate', '共创中', '团队一起出主意'], ['triage', '待整理', '收集与梳理'], ['awaiting', '等决策', '等老板拍板'], ['planned', '进行中', '正在推进的项目'], ['finished', '已完成', '达成的成果'], ['draft', '草稿', '只有自己可见'], ['closed', '暂缓 / 不做', '先放一放']];
  var IST = { discussing: 'ib-violet', summary_ready: 'ib-violet', triage: 'ib-amber', awaiting_owner: 'ib-red', planned: 'ib-blue', draft: 'ib-gray', on_hold: 'ib-gray', declined: 'ib-gray' };
  function ideaRecent(d) {
    var ev = S.events.filter(function (e) { return e.ideaId === d.id; }).sort(function (x, y) { return y.at - x.at; })[0];
    var who = ev ? (ev.actorId === me ? '你' : TM.name(S, ev.actorId || ev.actor || 'system')) : nm(d.creatorId);
    var txt = ev ? ev.text.replace(/^.{0,0}/, '') : '创建了想法';
    return { who: who, txt: txt.length > 22 ? txt.slice(0, 22) + '…' : txt, at: ev ? ev.at : d.lastActivity };
  }
  function viewIdeas() {
    var all = vIdeas().sort(byRecent), f = filt.ideas || 'all';
    var h = projHeader('ideas');
    if (role() === 'admin') return h + emptyBox('管理员看不到想法内容。');
    var cp = myCaps(), exec = !cp.recordIdea && !cp.claimIdeas && !cp.decide;
    var tiles = exec ? EXEC_TILE : IDEA_TILE.filter(function (t) { return ['draft', 'closed'].indexOf(t[0]) < 0 || all.some(function (d) { return ideaMatch(d, t[0]); }); }).slice(0, 6);
    h += '<section class="id-grid">' + tiles.map(function (t) {
      var x = IB[t[0]], n = all.filter(function (d) { return ideaMatch(d, t[0]); }).length, act = t[0] !== 'all' && all.some(function (d) { return ideaMatch(d, t[0]) && ideaNeedsMe(d); });
      return '<button class="ib-tile id-tile it-' + t[0] + ' ' + x[3] + (f === t[0] && filt.ideasOpen ? ' on' : '') + (n ? '' : ' zero') + '" data-do="ideasTile" data-f="' + t[0] + '"><span class="ib-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (t[0] === 'all' ? '<path d="M9 17.5h6M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v1h5v-1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5z"/>' : x[2]) + '</svg></span>' + (act ? '<i class="ib-dot"></i>' : '') + '<b>' + n + '</b><span class="ib-l">' + t[1] + '</span><small>' + t[2] + '</small></button>';
    }).join('') + '</section>';
    var open = filt.ideasOpen, list2 = open ? all.filter(function (d) { return ideaMatch(d, f); }) : all.slice(0, 5);
    var title = open ? (IDEA_TILE.concat(EXEC_TILE).find(function (t) { return t[0] === f; }) || IDEA_TILE[0])[1] : '最近动态';
    h += '<div class="ib-head"><b>' + title + '</b>' + (open ? '<span>' + list2.length + ' 个</span><button class="id-link" data-do="ideasRecent">返回动态</button>' : '<button class="id-link" data-do="ideasTile" data-f="all">查看全部' + hi('chev', 2) + '</button>') + '</div>';
    if (!list2.length) return h + emptyBox('这个分类下还没有想法。');
    return h + '<div class="id-list">' + list2.map(function (d) {
      var r = ideaRecent(d), st = d.status;
      return '<a class="id-row" href="#/idea/' + d.id + '"><span class="id-sq ' + (IST[st] || 'ib-slate') + '">' + ai2('bulb', 1.7) + (ideaNeedsMe(d) ? '<i class="ib-dot"></i>' : '') + '</span><span class="id-t"><b>' + esc(d.title || d.note.slice(0, 20) || '未命名') + '</b><small>' + esc(r.who) + ' ' + esc(r.txt) + ' · ' + ago(r.at) + '</small></span>' + (open ? pill('idea', st) : '') + hi('chev', 2) + '</a>';
    }).join('') + '</div>';
  }

  /* ---------- 页面：新建想法 ---------- */
  var draft = { title: '', note: '', mode: 'text', big: false };
  var NI = {
    mic: '<rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    cam: '<rect x="2.8" y="6.5" width="13" height="11" rx="2.6"/><path d="M15.8 10.4l4.7-2.6v8.4l-4.7-2.6z"/>',
    pen: '<path d="M4.5 19.5l1-4.2L15.8 5a2.1 2.1 0 0 1 3 3L8.6 18.4z"/><path d="M13.8 7l3 3M4 21h16"/>',
    clip: '<path d="M20 11.5l-7.6 7.6a5 5 0 0 1-7.1-7.1l8.2-8.2a3.3 3.3 0 0 1 4.7 4.7l-8.1 8.1a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
    upv: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M12 15.5V9M9 11.5l3-3 3 3"/>',
    expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', check: '<path d="M6.5 12.5l3.5 3.5 7.5-8"/>'
  };
  function ni(k, sw) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + NI[k] + '</svg>'; }
  function viewNew() {
    if (!TM.canInitiate(S, me)) return '<section class="n-hero"><button class="circle n-back" data-do="back" aria-label="返回">' + hi('chev', 2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button><h1>记录一个想法</h1></section>' + emptyBox('只有老板和有发起权的负责人可以创建想法。你可以在被分享的想法里提建议，或在自己的任务里反馈问题。');
    var u = TM.user(S, me), dept = (u.roles.find(function (a) { return a.dept; }) || {}).dept || '';
    var M = [['voice', 'm-voice', 'mic', '语音记录', '说出你的想法'], ['video', 'm-video', 'cam', '上传视频', '从手机选择'], ['text', 'm-text', 'pen', '文字输入', '快速记录']];
    return '<section class="n-hero"><div class="n-top"><button class="circle n-back" data-do="back" aria-label="返回">' + hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button>' +
      '<button class="n-ai" data-do="quickAI">' + hi('spark', 1.6) + 'AI 助手</button></div>' +
      '<h1>记录一个想法</h1><p>用语音、文字或视频，随时记录你的想法</p><small>好的想法，值得被认真对待。</small>' +
      '<div class="n-script" aria-hidden="true">Turn<br>&nbsp;Ideas<br>&nbsp;&nbsp;Into Impact<svg viewBox="0 0 120 16"><path d="M4 13c34-5 72-8 112-11" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg></div>' +
      '<div class="n-demo">演示版：录音不上传，AI 为模拟</div></section>' +
      '<div class="n-modes" role="radiogroup" aria-label="记录方式">' + M.map(function (m) {
        return '<button type="button" role="radio" aria-checked="' + (draft.mode === m[0]) + '" class="n-mode ' + m[1] + (draft.mode === m[0] ? ' on' : '') + '" data-do="mode" data-m="' + m[0] + '"><span class="n-mi">' + ni(m[2]) + '</span><b>' + m[3] + '</b><small>' + m[4] + '</small>' + (draft.mode === m[0] ? '<i class="n-ok">' + ni('check', 2.6) + '</i>' : '') + '</button>';
      }).join('') + '</div>' +
      '<button type="button" class="n-aibar" data-do="quickAI">' + hi('spark', 1.6) + '<span><b>AI 会自动转写、整理和生成建议</b><small>帮你把想法变成可执行的事项：提炼问题、整理目标、给出下一步。</small></span>' + hi('chev', 2) + '</button>' +
      '<form data-form="newIdea" class="n-form">' +
      '<label class="n-fld"><span>标题（可不填，AI 会起）</span><input type="text" name="title" maxlength="50" placeholder="比如：办公室换网线" value="' + esc(draft.title) + '" data-count="50"></label><div class="n-cnt" id="cnt-title">' + draft.title.length + '/50</div>' +
      '<label class="n-fld"><span>想法</span><span class="n-ta"><textarea name="note" maxlength="1000" rows="' + (draft.big ? 12 : 4) + '" placeholder="说清楚背景、想解决什么、希望的结果。&#10;说不清的地方 AI 会列为待澄清。" data-count="1000">' + esc(draft.note) + '</textarea><button type="button" class="n-exp" data-do="expandNote" aria-label="' + (draft.big ? '收起' : '展开') + '输入框">' + ni('expand', 1.7) + '</button></span></label><div class="n-cnt" id="cnt-note">' + draft.note.length + '/1000</div>' +
      '<div class="n-fld"><span>录音或附件</span><div class="n-rec" id="recbox">' + recControls() + '</div>' + mediaListHTML(newMedia, true) +
      '<p class="n-note">' + ni('info', 1.6) + '<span>录音只保存在本次打开的页面里，演示版不会上传，也不会转写。正式版接入后会断点续传并自动转写。</span></p></div>' +
      '<input type="hidden" name="dept" value="' + esc(dept) + '">' +
      '<button class="n-next" type="submit" name="go" value="submit">下一步' + ni('arrow', 2) + '</button>' +
      '<input type="file" id="vidpick" accept="video/*" capture="environment" data-do-change="pickFile" hidden></form>';
  }
  function recControls() {
    if (rec) return '<span class="dot"></span><span id="rectime">录音中 0:00</span><button type="button" class="n-pill n-stop" data-do="recStop">停止</button>';
    var ok = !!(navigator.mediaDevices && window.MediaRecorder);
    return '<button type="button" class="n-pill n-mic" data-do="recStart"' + (ok ? '' : ' disabled') + '>' + ni('mic') + '录音</button>' +
      '<label class="n-pill">' + ni('clip') + '附件<input type="file" accept="audio/*,video/*,image/*" data-do-change="pickFile" style="position:absolute;inset:0;opacity:0"></label>' +
      (ok ? '' : '<small class="muted">当前浏览器不支持录音</small>');
  }
  function mediaListHTML(ms, editable, viewOk) {
    return (ms || []).map(function (m, i) {
      var b = m.localId && blobUrl(m.localId);
      var inner = b ? (m.kind === 'video' ? '<video controls playsinline src="' + b + '" style="width:100%;border-radius:10px;max-height:240px;background:#000"></video>' : '<audio controls src="' + b + '"></audio>') : '<span>' + esc(m.name) + '</span>';
      var tag = m.demo ? '<span class="tag sim">演示素材</span>' : b ? '<span class="tag">仅本机</span>' : m.localId ? '<span class="tag">本次打开已结束，录音未保留</span>' : '<span class="tag">未上传</span>';
      return '<div class="media">' + (m.kind === 'audio' ? micIcon() : m.kind === 'video' ? ni('cam') : fileIcon()) + '<div style="flex:1;min-width:0">' + (b ? '' : '') + inner + '<div>' + tag + '</div></div>' + (editable ? '<button type="button" class="btn ghost" data-do="rmMedia" data-i="' + i + '">移除</button>' : '') + '</div>';
    }).join('');
  }
  function micIcon() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>'; }
  function fileIcon() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/></svg>'; }

  /* ---------- 新建项目：方式一 手动记录 / 方式二 AI 自动解析 ---------- */
  function freshPD() { return { step: 1, title: '', note: '', ptype: 'product', leadId: '', operatorId: '', reviewerId: '', due: TM.dateAdd(S, 14), tasks: [], files: [], source: 'manual', aiNote: '', goal: '', priority: 'mid' }; }
  var pd = null;
  var PI = {
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><path d="M13.5 16.7h6.5M16.7 13.5v6.5"/>',
    types: '<circle cx="7.3" cy="7.3" r="3.2"/><circle cx="16.7" cy="7.3" r="3.2"/><circle cx="7.3" cy="16.7" r="3.2"/><circle cx="16.7" cy="16.7" r="3.2"/>',
    product: '<rect x="4" y="5" width="16" height="10.5" rx="1.8"/><path d="M2.5 18.5h19"/>', ops: '<path d="M4 20h16M6.5 20v-6M11 20V9M15.5 20v-8.5M20 20V5"/>',
    market: '<path d="M4 10.5v3a1 1 0 0 0 1 1h2l7 4V5.5l-7 4H5a1 1 0 0 0-1 1zM17.5 9a4 4 0 0 1 0 6M8 14.5l1 4.5"/>', admin: '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5M8.5 13h7M8.5 16.5h5"/>',
    content: '<path d="M4.5 19.5l1-4.2L15.8 5a2.1 2.1 0 0 1 3 3L8.6 18.4z"/>', event: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8.5 3v3.5M15.5 3v3.5M8 14h2M14 14h2M8 17h2"/>',
    research: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.5c3 2.4 8 2.4 11 0v-4.5M21.5 9.5V14"/>', other: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
    clip: '<path d="M20 11.5l-7.6 7.6a5 5 0 0 1-7.1-7.1l8.2-8.2a3.3 3.3 0 0 1 4.7 4.7l-8.1 8.1a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4"/>',
    img: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.6"/><path d="M20.5 15.5l-5-5L5 19.5"/>',
    cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.2a4.2 4.2 0 0 1-.5 10.3"/><path d="M12 12v8M9 15l3-3 3 3"/>',
    team: '<circle cx="9" cy="8.5" r="3"/><path d="M3.8 19c.8-2.9 2.7-4.4 5.2-4.4s4.4 1.5 5.2 4.4"/><path d="M15.2 5.8a3 3 0 0 1 0 5.4M16.8 14.8c1.7.5 2.9 1.9 3.4 4.2"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4 6.5l1 1 2-2M4 12l1 1 2-2M4 17.5l1 1 2-2"/>',
    doc: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M9.5 12h6M9.5 15.5h6"/>', pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
    play: '<path d="M9 7.5v9l7.5-4.5z" fill="currentColor"/>', vcam: '<rect x="2.8" y="6.5" width="13" height="11" rx="2.6"/><path d="M15.8 10.4l4.7-2.6v8.4l-4.7-2.6z"/>'
  };
  function pi(k, sw) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.7) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PI[k] || NI[k] || HI[k]) + '</svg>'; }
  function canCreateProject() { return TM.canCreateProject(S, me); }
  /* 角色能力表（engine.js TM.caps）：用不了的功能不展示 */
  function myCaps() { return TM.caps(S, me); }
  function pHead(title, sub, right) {
    return '<header class="p-head"><button class="circle" data-do="pBack" aria-label="返回">' + hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button><div><h1>' + title + '</h1><p>' + sub + '</p></div>' + (right || '<span style="width:44px"></span>') + '</header>';
  }
  function pSec(icon, title, sub, right) { return '<div class="p-sec">' + pi(icon) + '<div><b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>' + (right || '') + '</div>'; }
  function userOpts(ids, sel, empty) { return (empty ? '<option value="">' + empty + '</option>' : '') + ids.map(function (id) { return '<option value="' + id + '"' + (id === sel ? ' selected' : '') + '>' + esc(nm(id)) + '（' + esc(TM.user(S, id).title) + '）</option>'; }).join(''); }
  function IC2(path) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'; }
  function npPick(title, ids, sel, empty, onPick) {
    var load = function (u) { return S.tasks.filter(function (t) { return t.ownerId === u && ['done', 'cancelled'].indexOf(t.status) < 0; }).length; };
    openSheet(title, '<div class="np-pick">' + (empty ? '<label class="np-po"><input type="radio" name="v" value=""' + (!sel ? ' checked' : '') + '><span class="av">—</span><span><b>' + empty + '</b></span></label>' : '') + ids.map(function (u) {
      return '<label class="np-po"><input type="radio" name="v" value="' + u + '"' + (u === sel ? ' checked' : '') + '>' + av(u) + '<span><b>' + esc(nm(u)) + (u === me ? '（你）' : '') + '</b><small>' + esc(TM.user(S, u).title || '') + '</small></span><em>手上 ' + load(u) + ' 项</em></label>';
    }).join('') + '</div>', '确定', function (o) { onPick(o.v || ''); closeSheet(); render(); });
  }
  var TASK_TPL = { product: [['梳理需求和功能清单', '功能清单文档', '负责人确认范围'], ['出可点击原型', '原型链接', '团队试用能走通主流程'], ['开发第一版', '可安装或可访问的版本', '主流程无阻塞问题'], ['测试并收集反馈', '测试记录 + 反馈汇总', '关键问题已修复']],
    ops: [['整理现状数据', '数据表', '数据完整可核对'], ['制定优化方案', '方案文档', '老板或负责人认可'], ['执行并跟踪效果', '每周进度记录', '目标指标有改善']],
    market: [['确定主题和受众', '一页策划', '负责人确认'], ['制作宣传内容', '文案 + 图片/视频', '符合品牌要求'], ['发布并统计效果', '发布链接 + 数据截图', '按期发布']],
    admin: [['确认需求和预算', '清单 + 预算', '运营者确认'], ['采购或办理', '单据照片', '物品到位或事项办结'], ['归档说明', '归档记录', '资料齐全']],
    other: [['明确目标和分工', '一页计划', '负责人确认'], ['执行主要工作', '阶段成果', '达到计划要求'], ['总结复盘', '总结文档', '团队确认']] };
  var PT_MORE = [['content', '内容创作', '文案 / 视频 / 设计'], ['event', '活动策划', '筹备 / 分工 / 物资'], ['research', '研究学习', '课程 / 阅读 / 调研'], ['training', '培训教育', '课程 / 讲座 / 门训'], ['mission', '宣教外展', '短宣 / 植堂 / 外展'], ['care', '关怀探访', '探访 / 陪伴 / 辅导'], ['finance', '财务预算', '预算 / 报销 / 奉献'], ['tech', '技术运维', '系统 / 网络 / 设备'], ['media', '媒体设计', '摄影 / 剪辑 / 海报'], ['worship', '敬拜聚会', '主日 / 敬拜 / 聚会'], ['hr', '人事招募', '招募 / 面试 / 入职'], ['other', '其他', '自定义类型']];
  function viewProject(id) {
    if (!canCreateProject()) return pHead('新建项目', '从一个想法，开始改变') + emptyBox('只有老板、运营者和有发起权的负责人可以新建项目。你可以在被分享的想法里提建议。');
    if (!pd) pd = freshPD();
    if (id === 'ai') return viewProjectAI();
    var steps = ['基本信息', '补充设置', '确认创建'];
    var h = '<section class="np-hero"><div class="n-top"><button class="circle n-back" data-do="pBack" aria-label="返回">' + hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button><button class="n-ai" data-do="pOptimize">' + hi('spark', 1.6) + 'AI 帮我写</button></div>' +
      '<h1>新建项目</h1><p>把想法变成行动，<br>从这里开始。</p></section>' +
      '<ol class="p-steps np-steps">' + steps.map(function (t, i) { var n2 = i + 1; return '<li class="' + (n2 === pd.step ? 'on' : n2 < pd.step ? 'done' : '') + '"><i>' + (n2 < pd.step ? ni('check', 2.6) : n2) + '</i><span>' + t + '</span></li>'; }).join('') + '</ol>';
    if (pd.aiNote && pd.step === 1) h += '<div class="p-ainote">' + hi('spark', 1.6) + '<span>' + esc(pd.aiNote) + '</span></div>';
    if (pd.step === 1) {
      var PT5 = [['product', '产品开发', '应用 / 网站 / 工具'], ['ops', '运营优化', '增长 / 效率 / 数据'], ['market', '市场推广', '内容 / 品牌 / 活动'], ['admin', '行政事务', '流程 / 制度 / 管理']];
      var otherSel = PT_MORE.some(function (t) { return t[0] === pd.ptype; });
      var TAGIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12V5a1.5 1.5 0 0 1 1.5-1.5h7l8.5 8.5-8.5 8.5z"/><circle cx="8" cy="8" r="1.3"/></svg>';
      h += '<section class="cx-card np-card"><div class="vr-ch">' + TAGIC + '<div><b>项目名称 <em class="np-req">*</em></b></div></div><input class="cx-in" type="text" data-pd="title" maxlength="50" placeholder="给你的项目起一个清晰的名字" value="' + esc(pd.title) + '"><div class="n-cnt" id="pc-title">' + pd.title.length + '/50</div>' +
        '<i class="np-div"></i><div class="vr-ch">' + ai2('doc2', 1.6) + '<div><b>项目描述 <em class="np-req">*</em></b></div></div><textarea class="cx-in" data-pd="note" rows="3" maxlength="500" placeholder="简单描述你的想法、目标或预期效果...">' + esc(pd.note) + '</textarea><div class="n-cnt" id="pc-note">' + pd.note.length + '/500</div></section>' +
        '<section class="cx-card np-card"><div class="cx-sh in"><b>' + pi('types').replace('<svg ', '<svg class="np-ti" ') + '项目类型</b><span class="np-hint">选择最合适的类型</span></div><div class="np-types">' +
        PT5.map(function (t) { var on = pd.ptype === t[0]; return '<button type="button" class="np-type np-' + t[0] + (on ? ' on' : '') + '" data-do="pType" data-k="' + t[0] + '" aria-pressed="' + on + '">' + (on ? '<i class="np-ok">' + ni('check', 2.6) + '</i>' : '') + '<span class="np-tl"><b>' + t[1] + '</b><small>' + t[2] + '</small></span></button>'; }).join('') +
        '<button type="button" class="np-type np-other' + (otherSel ? ' on np-' + pd.ptype : '') + (pd.otherOpen ? ' open' : '') + '" data-do="pTypeOther" aria-expanded="' + !!pd.otherOpen + '">' + (otherSel ? '<i class="np-ok">' + ni('check', 2.6) + '</i>' : '<span class="np-dots">' + ti('more', 1.6) + '</span>') + '<span class="np-tl"><b>' + (otherSel ? TM.PTYPE[pd.ptype][0] : '更多类型') + '</b><small>' + (pd.otherOpen ? '收起' : otherSel ? '点此更换' : '展开更多') + ai2(pd.otherOpen ? 'up' : 'downc', 2) + '</small></span></button></div>' +
        (pd.otherOpen ? '<div class="np-more">' + PT_MORE.map(function (t) { var on = pd.ptype === t[0]; return '<button type="button" class="np-type np-' + t[0] + (on ? ' on' : '') + '" data-do="pType" data-k="' + t[0] + '">' + (on ? '<i class="np-ok">' + ni('check', 2.6) + '</i>' : '') + '<span class="np-tl"><b>' + t[1] + '</b><small>' + t[2] + '</small></span></button>'; }).join('') + '</div>' : '') + '</section>' +
        '<section class="cx-card np-card"><div class="vr-ch">' + pi('clip') + '<div><b>添加附件 <span class="p-opt-l">（可选）</span></b><small>上传相关文档、图片或链接，支持多种格式</small></div></div>' +
        '<label class="cx-drop np-drop">' + CLOUD + '<b>点击或拖拽文件到这里</b><em>支持图片、文档、PDF 等，单个文件不超过 50MB</em><input type="file" multiple data-pfile="1"></label>' +
        pd.files.map(function (f, i) { return '<div class="media">' + (f.kind === 'audio' ? micIcon() : fileIcon()) + '<div style="flex:1;min-width:0">' + (f.localId && blobUrl(f.localId) ? '<audio controls src="' + blobUrl(f.localId) + '"></audio>' : esc(f.name)) + '<div><span class="tag">未上传，仅本机</span></div></div><button type="button" class="btn ghost" data-do="pRmFile" data-i="' + i + '">移除</button></div>'; }).join('') + '</section>' +
        '<section class="cx-card np-card np-voice"><div class="vr-ch">' + ni('mic', 1.6) + '<div><b>语音输入 <span class="p-opt-l">（可选）</span></b><small>用语音快速记录你的想法' + (SR || canSrvTr() ? '' : '（当前浏览器不支持转文字）') + '</small></div>' +
        (rec ? '<button type="button" class="np-rec on" data-do="pRecStop"><span class="dot"></span><span id="rectime">录音中 0:00</span></button>' : '<button type="button" class="np-rec" data-do="pRecStart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 10v4M9 7v10M13 9v6M17 6v12M21 10v4"/></svg>开始录音</button>') + '</div></section>' +
        '<button class="np-ailink" data-do="goProjectAI">' + hi('spark', 1.5) + '没想好怎么写？录音或上传视频，让 AI 帮你生成' + hi('chev', 2) + '</button>' +
        '<button class="vr-next" data-do="pNext">下一步' + ni('arrow', 2) + '</button>';
    } else if (pd.step === 2) {
      var leadLocked = TM.hasRole(S, me, 'lead') && !isOwner() && !TM.hasRole(S, me, 'operator');
      if (leadLocked) pd.leadId = me;
      if (!pd.operatorId) pd.operatorId = TM.hasRole(S, me, 'operator') ? me : TM.followUsers(S)[0];
      var isProd = TM.PTYPE[pd.ptype][1] === 'product', left = pd.due ? dayDiff(pd.due) : null;
      var who = function (k, role, sub, uid, locked, req, empty) {
        return '<button type="button" class="np-who' + (uid ? '' : ' empty') + (req && !uid ? ' req' : '') + '"' + (locked ? ' disabled' : ' data-do="pPick" data-k="' + k + '"') + '><span class="np-wr"><b>' + role + (req ? ' <em class="np-req">*</em>' : '') + '</b><small>' + sub + '</small></span>' +
          (uid ? av(uid, true) + '<span class="np-wn"><b>' + esc(nm(uid)) + (uid === me ? '（你）' : '') + '</b><small>' + esc(TM.user(S, uid).title || '') + '</small></span>' : '<span class="np-wn"><b>' + empty + '</b></span>') + (locked ? '' : hi('chev', 2)) + '</button>';
      };
      var rvAuto = pd.reviewerId ? '' : (pd.leadId || pd.operatorId);
      var DUE = [['7', '1 周'], ['14', '2 周'], ['30', '1 个月'], ['60', '2 个月']];
      h += '<section class="cx-card np-card"><div class="vr-ch">' + pi('team') + '<div><b>项目团队</b><small>谁来负责、谁来跟进、谁来验收</small></div></div><div class="np-whos">' +
        who('leadId', '负责人', isProd ? '拆分任务、安排执行' : '可不指定，由运营者推进', pd.leadId, leadLocked, isProd, isProd ? '请选择负责人' : '不指定') +
        who('operatorId', '跟进运营', '推动进度、协调资源', pd.operatorId, false, false, '请选择') +
        who('reviewerId', '验收人', pd.reviewerId ? '最终确认成果' : '默认由' + (pd.leadId ? '负责人' : '运营者') + '验收', pd.reviewerId || rvAuto, false, false, '请选择') + '</div></section>' +
        '<section class="cx-card np-card"><div class="vr-ch">' + IC2('<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>') + '<div><b>时间与优先级</b><small>' + (left == null ? '不设截止日期' : left >= 0 ? mdTxt(pd.due) + ' 截止 · 还有 ' + left + ' 天' : mdTxt(pd.due) + ' · 已过期') + '</small></div></div>' +
        '<div class="np-chips">' + DUE.map(function (d2) { var v = TM.dateAdd(S, +d2[0]); return '<button type="button" class="' + (pd.due === v ? 'on' : '') + '" data-do="pDue" data-d="' + d2[0] + '">' + d2[1] + '</button>'; }).join('') + '<label class="np-date' + (pd.due && !DUE.some(function (d2) { return TM.dateAdd(S, +d2[0]) === pd.due; }) ? ' on' : '') + '">' + IC2('<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16"/>') + '<span>自定义</span><input type="date" data-pd="due" value="' + esc(pd.due) + '"></label></div>' +
        '<div class="np-seg" role="radiogroup" aria-label="优先级"><span>优先级</span>' + [['hi', '高'], ['mid', '中'], ['lo', '低']].map(function (x) { return '<button type="button" role="radio" aria-checked="' + (pd.priority === x[0]) + '" class="p-' + x[0] + (pd.priority === x[0] ? ' on' : '') + '" data-do="pPri" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></section>' +
        '<section class="cx-card np-card"><div class="vr-ch">' + IC2('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>') + '<div><b>项目目标 <span class="p-opt-l">（可选）</span></b><small>做成什么样算成功</small></div><button type="button" class="np-aib" data-do="pGoalAI">' + hi('spark', 1.6) + 'AI 写</button></div>' +
        '<textarea class="cx-in" data-pd="goal" rows="2" maxlength="200" placeholder="比如：月底前出可点击原型，团队试用 10 人以上">' + esc(pd.goal) + '</textarea></section>' +
        '<section class="cx-card np-card"><div class="vr-ch">' + pi('list') + '<div><b>首批任务 <span class="p-opt-l">（可选）</span></b><small>现在派出去，或交给负责人之后安排</small></div></div>' +
        '<div class="np-tbtns"><button type="button" class="np-aib" data-do="pTasksAI">' + hi('spark', 1.6) + 'AI 拆任务</button><button type="button" class="np-add" data-do="pAddTask">' + ti('plus2', 2.2) + '添加任务</button></div>' +
        (pd.tasks.length ? pd.tasks.map(function (t, i) {
          return '<div class="p-task np-task"><div class="np-th"><i>' + (i + 1) + '</i><input type="text" data-pt="' + i + '" data-f="title" maxlength="40" placeholder="任务标题" value="' + esc(t.title) + '"><button type="button" class="np-tx" data-do="pRmTask" data-i="' + i + '" aria-label="删除任务">×</button></div>' +
            '<button type="button" class="np-own" data-do="pPickT" data-i="' + i + '">' + av(t.ownerId, true) + '<span class="np-on">' + esc(nm(t.ownerId)) + '<small>' + esc(TM.user(S, t.ownerId).title || '') + '</small></span><em>执行人</em>' + hi('chev', 2) + '</button>' +
            '<div class="np-tf"><label><span>预期成果</span><input type="text" data-pt="' + i + '" data-f="expected" maxlength="60" placeholder="交付什么，比如：照片 + 说明" value="' + esc(t.expected) + '"></label><label><span>验收标准</span><input type="text" data-pt="' + i + '" data-f="criteria" maxlength="60" placeholder="怎样算通过" value="' + esc(t.criteria) + '"></label></div></div>';
        }).join('') : '<div class="np-tempty">' + pi('list') + '<span><b>还没有任务</b><small>' + (pd.leadId ? '创建后由 ' + esc(nm(pd.leadId)) + ' 拆分安排' : '创建后项目进入「待规划」，由运营者安排') + '</small></span></div>') + '</section>' +
        '<div class="p-btns"><button class="p-prev" data-do="pPrev">上一步</button><button class="n-next" data-do="pNext">下一步' + ni('arrow', 2) + '</button></div>';
    } else {
      var rv = pd.reviewerId || pd.leadId || pd.operatorId, tks = pd.tasks.filter(function (t) { return t.title.trim(); }), left3 = pd.due ? dayDiff(pd.due) : null;
      var notif = [pd.leadId, pd.operatorId].concat(TM.usersWith(S, 'owner'), tks.map(function (t) { return t.ownerId; })).filter(function (u, i, a) { return u && u !== me && a.indexOf(u) === i; });
      var mem = function (u, r) { return '<div class="np-m">' + av(u) + '<b>' + esc(nm(u)) + '</b><small>' + r + '</small></div>'; };
      h += '<section class="cx-card np-card np-sum"><span class="np-ptag">' + esc(TM.PTYPE[pd.ptype][0]) + '</span>' + (pd.source === 'ai' ? '<span class="np-ptag ai">' + hi('spark', 1.4) + 'AI 草稿</span>' : '') +
        '<div class="p-sum-t">' + esc(pd.title) + '</div>' + (pd.note ? '<p class="p-sum-d">' + esc(pd.note.length > 120 ? pd.note.slice(0, 120) + '…' : pd.note) + '</p>' : '') +
        (pd.goal.trim() ? '<div class="np-goal">' + IC2('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>') + '<span><small>目标</small>' + esc(pd.goal) + '</span></div>' : '') +
        '<div class="np-facts"><span><small>截止</small><b>' + (pd.due ? mdTxt(pd.due) : '不设') + '</b>' + (left3 != null ? '<em>' + (left3 >= 0 ? '剩 ' + left3 + ' 天' : '已过期') + '</em>' : '') + '</span><span><small>优先级</small><b class="np-pri np-pri-' + pd.priority + '">' + ({ hi: '高', mid: '中', lo: '低' })[pd.priority] + '</b></span><span><small>附件</small><b>' + pd.files.length + '</b><em>个</em></span></div></section>' +
        '<section class="cx-card np-card"><div class="vr-ch">' + pi('team') + '<div><b>项目团队</b></div><button type="button" class="np-edit" data-do="pPrev">修改</button></div><div class="np-ms">' +
        (pd.leadId ? mem(pd.leadId, '负责人') : '<div class="np-m none"><span class="av">—</span><b>不指定</b><small>负责人</small></div>') + mem(pd.operatorId, '跟进运营') + mem(rv, '验收人' + (pd.reviewerId ? '' : '（默认）')) + '</div></section>' +
        '<section class="cx-card np-card"><div class="vr-ch">' + pi('list') + '<div><b>首批任务（' + tks.length + '）</b></div></div>' +
        (tks.length ? '<div class="np-tl3">' + tks.map(function (t, i) { return '<div class="np-t3"><i>' + (i + 1) + '</i><span class="np-t3t"><b>' + esc(t.title) + '</b><small>交付：' + esc(t.expected) + ' · 验收：' + esc(t.criteria) + '</small></span>' + av(t.ownerId, true) + '</div>'; }).join('') + '</div>' : '<p class="np-note">没有首批任务，创建后项目进入「待规划」，由' + esc(pd.leadId ? nm(pd.leadId) : nm(pd.operatorId)) + '安排。</p>') + '</section>' +
        '<div class="np-notify">' + IC2('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>') + '<span>创建后会通知 <b>' + (notif.length ? notif.map(function (u) { return esc(nm(u)); }).join('、') : '相关的人') + '</b>' + (tks.length ? '，任务立即派出' : '') + '。</span></div>' +
        (pd.source === 'ai' ? '<div class="callout ai">内容由 AI 解析生成（演示版为模拟整理），已由你核对。</div>' : '') +
        '<div class="p-btns"><button class="p-prev" data-do="pPrev">上一步</button><button class="n-next" data-do="pCreate">创建项目' + ni('check', 2.4) + '</button></div>';
    }
    return h;
  }
  /* 方式二：AI 自动解析 */
  var ai = { tab: 'rec', recording: false, t0: 0, transcript: '', timer: null, raf: null, sr: null, ctx: null };
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  window.addEventListener('tm-nospeech', function () { SR = null; if (me) render(); });
  var SAMPLES = [
    { k: 's1', t: '会议讨论', d: '03:24', text: '下周要启动门徒圈语音灵修的小程序。陈立负责产品，何静先出可点击原型，刘洋评估开发工作量。月底前要能给团队试用。需要准备录音设备，预算控制在三千元以内。' },
    { k: 's2', t: '项目思路', d: '12:18', text: '我想把官网改版，重新整理品牌介绍。先梳理现有页面内容，再出新的页面结构，然后请何静做视觉稿。最后安排上线前的测试，争取十一月底前完成。' },
    { k: 's3', t: '功能演示', d: '08:37', text: '这是清醒 App 今日计划功能的演示。需要优化 AI 顾问的回复速度，修复同步时偶尔丢数据的问题，补充新手引导页面。由刘洋负责开发，陈立验收。' }
  ];
  var THUMB = {
    s1: '<svg viewBox="0 0 160 96" preserveAspectRatio="xMidYMid slice"><rect width="160" height="96" fill="#C9D4DD"/><rect x="0" y="0" width="160" height="40" fill="#E6ECF1"/><rect x="104" y="10" width="42" height="34" fill="#9FB7A2" opacity=".7"/><path d="M40 96c2-24 14-36 30-36s28 12 30 36z" fill="#2E3B4E"/><circle cx="70" cy="44" r="13" fill="#E3B48F"/><path d="M57 40c2-10 24-12 27 0" fill="#1D2430"/><rect x="74" y="66" width="56" height="30" rx="3" fill="#5F6C7B"/><rect x="0" y="80" width="160" height="16" fill="#3A3F46" opacity=".5"/></svg>',
    s2: '<svg viewBox="0 0 160 96" preserveAspectRatio="xMidYMid slice"><rect width="160" height="96" fill="#EEF0F2"/><rect x="18" y="10" width="124" height="70" rx="3" fill="#FAFBFC" stroke="#C9CED6"/><g stroke="#6B7FA8" stroke-width="1.6" fill="none"><rect x="30" y="20" width="26" height="12"/><rect x="72" y="20" width="26" height="12"/><rect x="104" y="40" width="26" height="12"/><path d="M56 26h16M85 32v14h19M43 32v26h40"/></g><path d="M118 96l6-34 12 2-4 32z" fill="#E3B48F"/></svg>',
    s3: '<svg viewBox="0 0 160 96" preserveAspectRatio="xMidYMid slice"><rect width="160" height="96" fill="#1E2633"/><rect x="14" y="10" width="132" height="72" rx="4" fill="#2C3A50"/><rect x="20" y="16" width="36" height="60" rx="2" fill="#E9EEF6"/><rect x="62" y="16" width="78" height="10" rx="2" fill="#4F7BF5"/><g fill="#8FA6C8"><rect x="62" y="32" width="70" height="5" rx="2"/><rect x="62" y="42" width="54" height="5" rx="2"/><rect x="62" y="52" width="62" height="5" rx="2"/></g><rect x="24" y="22" width="28" height="4" rx="2" fill="#9AA7BA"/><rect x="24" y="30" width="20" height="4" rx="2" fill="#C2CAD6"/></svg>'
  };
  function waveBars(side) { var h = [6, 12, 18, 10, 26, 34, 22, 14, 28, 16, 9, 5]; if (side === 'r') h = h.slice().reverse(); return '<div class="a-wave a-' + side + '">' + h.map(function (v) { return '<i style="height:' + v + 'px" data-h="' + v + '"></i>'; }).join('') + '</div>'; }
  function viewProjectAI() {
    var h = pHead('AI 智能创建项目', '录音或上传视频，AI 自动为你生成项目') +
      '<div class="a-seg"><button class="' + (ai.tab === 'rec' ? 'on' : '') + '" data-do="aiTab" data-t="rec">' + ni('mic') + '录音输入</button><button class="' + (ai.tab === 'video' ? 'on' : '') + '" data-do="aiTab" data-t="video">' + pi('vcam') + '上传视频</button></div>';
    if (ai.tab === 'rec') {
      h += '<section class="a-rec' + (ai.recording ? ' live' : '') + '">' + waveBars('l') + '<div class="a-mic"><span>' + ni('mic', 1.6) + '</span></div>' + waveBars('r') + '</section>' +
        '<div class="a-time" id="aitimer">' + (ai.recording ? fmtSec(Math.round((Date.now() - ai.t0) / 1000)) : '00:00') + '</div>' +
        '<button class="a-start' + (ai.recording ? ' stop' : '') + '" data-do="' + (ai.recording ? 'aiStop' : 'aiStart') + '">' + (ai.recording ? '<span class="dot"></span>停止并解析' : ni('mic') + '开始录音') + '</button>' +
        (ai.recording && ai.transcript ? '<p class="a-live">' + esc(ai.transcript.slice(-60)) + '</p>' : '') +
        '<div class="a-feats">' + [['doc', '自动转文字', SR ? '浏览器实时识别' : canSrvTr() ? '服务器转写' : '当前浏览器不支持'], ['pin', '智能提取要点', '生成标题与任务'], ['spark', '一键创建项目', '可继续编辑']].map(function (f) { return '<div>' + '<span>' + pi(f[0]) + '</span><b>' + f[1] + '</b><small>' + f[2] + '</small></div>'; }).join('') + '</div>' +
        '<div class="a-or"><span>或</span></div>';
    }
    h += '<label class="p-drop a-drop">' + pi('cloud') + '<b>上传视频文件</b><small>支持 MP4、MOV、AVI 等格式，单个文件不超过 500MB</small><input type="file" accept="video/*" data-aivideo="1"></label>' +
      '<div class="a-samples">' + SAMPLES.map(function (x) { return '<button type="button" data-do="aiSample" data-k="' + x.k + '"><span class="a-th">' + THUMB[x.k] + '<i>' + pi('play') + '</i><em>' + x.d + '</em></span><b>' + x.t + '</b></button>'; }).join('') + '</div>' +
      '<p class="a-samp-note">以上为示例素材，点一下体验解析效果</p>' +
      '<section class="a-gen"><h3>' + hi('spark', 1.6) + 'AI 会为你生成</h3><ul>' + ['项目名称（自动生成）', '项目概要（自动总结）', '关键任务清单（自动拆解）', '相关人和标签（智能推荐）', '可随时编辑，确认后创建项目'].map(function (t) { return '<li>' + ni('check', 2.2) + t + '</li>'; }).join('') + '</ul></section>';
    return h;
  }
  function fmtSec(s) { return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + s % 60).slice(-2); }
  /* 规则解析（演示：模拟 AI，不调用大模型） */
  function parseTranscript(text) {
    var sents = text.split(/[。！？!?；;\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
    var first = sents[0] || '';
    var m = first.match(/(?:启动|做|把|改版|关于|演示)([^，,。]{2,18})/);
    var title = (m ? m[1] : first).replace(/^(一个|下周|我想|这是)/, '').replace(/的(小程序|演示)$/, '$1').slice(0, 20) || '新项目';
    if (/官网/.test(text) && /改版/.test(text)) title = '官网改版';
    var ptype = /小程序|App|app|功能|开发|原型|网站|官网/.test(text) ? 'product' : /采购|设备|场地|报销|行政/.test(text) ? 'admin' : /活动|聚会|年会/.test(text) ? 'event' : /推广|宣传/.test(text) ? 'market' : 'other';
    var users = S.users.filter(function (u) { return text.indexOf(u.name) >= 0; });
    var lead = users.find(function (u) { return TM.hasRole(S, u.id, 'lead'); });
    var execs = users.filter(function (u) { return TM.hasRole(S, u.id, 'executor'); });
    var tasks = [];
    sents.forEach(function (x) {
      if (tasks.length >= 4 || x === first && sents.length > 1) return;
      x.split(/[，,]/).forEach(function (c) {
        c = c.replace(/^(然后|再|先|最后|并且|还要|需要|要|由)/, '').trim();
        if (tasks.length < 4 && /(出|做|评估|准备|梳理|安排|优化|修复|补充|整理|测试|开发|设计)/.test(c) && c.length >= 4) {
          var who = execs.find(function (u) { return c.indexOf(u.name) >= 0; }) || users.find(function (u) { return c.indexOf(u.name) >= 0 && !TM.hasRole(S, u.id, 'lead'); });
          tasks.push({ title: c.replace(/^(陈立|何静|刘洋|周敏|林晓)(负责)?/, '').replace(/^(请|先|再|然后)/, '').slice(0, 24), ownerId: (who || execs[tasks.length % Math.max(execs.length, 1)] || {}).id || TM.usersWith(S, 'executor')[0], expected: '完成说明 + 成果链接或照片', criteria: '由验收人确认达到项目目标' });
        }
      });
    });
    var tags = ['语音', '小程序', '官网', '原型', '测试', '预算', 'AI', '同步'].filter(function (k) { return text.indexOf(k) >= 0; });
    return { title: title, summary: sents.slice(0, 2).join('。') + '。', ptype: ptype, leadId: lead ? lead.id : '', tasks: tasks, people: users.map(function (u) { return u.id; }), tags: tags, transcript: text };
  }
  function runParse(text, label) {
    if (AI_ON && !ai.ruleOnly) {
      openSheet('AI 正在解析', '<p class="muted" style="font-size:14px">' + esc(label) + '</p><ol class="a-prog"><li class="ok">读取内容</li><li>Claude 正在整理项目名称、概要和首批任务…</li></ol>', '请稍候', function () {});
      var b0 = document.querySelector('.sheet footer button[type=submit]'); if (b0) b0.disabled = true;
      TMS.aiProject(text).then(function (r) {
        r.transcript = text; r.real = true; if (!r.tasks.length) r.tasks = []; r.tasks.forEach(function (t) { if (!t.ownerId) t.ownerId = TM.usersWith(S, 'executor')[0]; });
        showResult(r);
      }, function (e) { closeSheet(); toast(((e && e.error) || 'AI 暂时不可用') + '，已改用规则解析', true); ai.ruleOnly = true; runParse(text, label); ai.ruleOnly = false; });
      return;
    }
    var steps = ['转写文字', '提取要点', '生成项目草稿'];
    openSheet('AI 正在解析', '<p class="muted" style="font-size:14px">' + esc(label) + '</p><ol class="a-prog">' + steps.map(function (s, i) { return '<li id="ap' + i + '">' + s + '</li>'; }).join('') + '</ol><div class="callout">演示版：解析由规则模拟完成，不调用真实大模型。</div>', '请稍候', function () {});
    var btn = document.querySelector('.sheet footer button[type=submit]'); if (btn) btn.disabled = true;
    steps.forEach(function (_, i) { setTimeout(function () { var li = document.getElementById('ap' + i); if (li) li.className = 'ok'; }, 350 * (i + 1)); });
    setTimeout(function () { showResult(parseTranscript(text)); }, 1250);
  }
  function showResult(r) {
    var T = TM.PTYPE;
    openSheet('AI 解析结果', (r.real ? '<span class="tag ai-real-tag">Claude 解析，可直接修改</span>' : '<span class="tag sim">AI 模拟输出，可直接修改</span>') +
      field('项目名称', '<input type="text" name="title" maxlength="50" value="' + esc(r.title) + '">') +
      field('项目概要', '<textarea name="summary" rows="3">' + esc(r.summary) + '</textarea>') +
      field('项目类型', '<select name="ptype">' + Object.keys(T).map(function (k) { return '<option value="' + k + '"' + (k === r.ptype ? ' selected' : '') + '>' + T[k][0] + '</option>'; }).join('') + '</select>') +
      field('关键任务（每行一条）', '<textarea name="tasks" rows="4">' + esc(r.tasks.map(function (t) { return t.title; }).join('\n')) + '</textarea>', r.tasks.length ? '负责人按录音里提到的人自动推荐，下一步可改。' : '没有识别出明确任务，可以自己补充。') +
      '<div class="fld"><span>相关人和标签</span><div class="who">' + (r.people.length ? r.people.map(function (u) { return '<label style="cursor:default">' + av(u, true) + esc(nm(u)) + '</label>'; }).join('') : '<span class="muted" style="font-size:13.5px">没有识别出相关人</span>') + r.tags.map(function (t) { return '<span class="tag">#' + esc(t) + '</span>'; }).join('') + '</div></div>' +
      '<details class="a-tr"><summary>查看转写原文</summary><p>' + esc(r.transcript) + '</p></details>', '生成项目草稿',
      function (o) {
        var lines = (o.tasks || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
        pd = freshPD(); pd.title = (o.title || '').slice(0, 50); pd.note = o.summary || ''; pd.ptype = o.ptype; pd.leadId = r.leadId; pd.source = 'ai';
        pd.tasks = lines.map(function (t, i) { var old = r.tasks.find(function (x) { return x.title === t; }) || r.tasks[i] || {}; return { title: t, ownerId: old.ownerId || TM.usersWith(S, 'executor')[0], expected: old.expected || '完成说明 + 成果链接或照片', criteria: old.criteria || '由验收人确认达到项目目标' }; });
        pd.files = ai.pending ? [ai.pending] : []; ai.pending = null;
        pd.aiNote = 'AI 已根据' + (r.label || '录音') + '生成草稿，请核对后继续。';
        closeSheet(); location.hash = '#/project'; render();
      });
  }
  function aiStart() {
    if (!(navigator.mediaDevices && window.MediaRecorder)) return toast('当前浏览器不支持录音', true);
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [], mr = new MediaRecorder(stream);
      ai.recording = true; ai.t0 = Date.now(); ai.transcript = ''; ai.stream = stream; ai.mr = mr;
      mr.ondataavailable = function (e) { chunks.push(e.data); };
      mr.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var lid = rid('b'), sec = Math.round((Date.now() - ai.t0) / 1000);
        var ablob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        blobs[lid] = keepBlob(lid, ablob);
        ai.pending = { kind: 'audio', name: '录音 ' + fmtSec(sec), durationSec: sec, localId: lid };
        var text = ai.transcript.trim();
        if (text) runParse(text, '录音 ' + fmtSec(sec) + '，已识别 ' + text.length + ' 字');
        else if (canSrvTr()) srvTr(ablob, '录音').then(function (t) { if (t) runParse(t, '录音 ' + fmtSec(sec) + '，服务器转写 ' + t.length + ' 字'); else toast('录音里没有识别到说话，可以再录一次', true); }, function () {});
        else openSheet('没有识别出文字', '<p>录音已保存在本机（演示版不上传）。' + (SR ? '这次没有识别到清晰的语音。' : '当前浏览器不支持语音转文字。') + '</p><p class="muted" style="font-size:14px">可以去手动创建，把录音作为附件，自己补充项目信息。</p>', '去手动填写', function () { pd = freshPD(); pd.files = [ai.pending]; ai.pending = null; closeSheet(); location.hash = '#/project'; render(); });
      };
      try {
        var AC = window.AudioContext || window.webkitAudioContext, ctx = new AC(), an = ctx.createAnalyser(); an.fftSize = 64;
        ctx.createMediaStreamSource(stream).connect(an); ai.ctx = ctx;
        var buf = new Uint8Array(an.frequencyBinCount);
        var loop = function () { an.getByteFrequencyData(buf); document.querySelectorAll('.a-wave i').forEach(function (b, i) { var v = buf[(i % 12) + 2] / 255; b.style.height = Math.max(4, Math.round(+b.dataset.h * (0.3 + v * 1.4))) + 'px'; }); ai.raf = requestAnimationFrame(loop); };
        loop();
      } catch (e) {}
      if (SR) { try { var r = new SR(); r.lang = 'zh-CN'; r.continuous = true; r.interimResults = false; r.onresult = function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) ai.transcript += e.results[i][0].transcript + '。'; }; r.onerror = function () {}; r.start(); ai.sr = r; } catch (e) {} }
      ai.timer = setInterval(function () { var t = document.getElementById('aitimer'); if (t) t.textContent = fmtSec(Math.round((Date.now() - ai.t0) / 1000)); }, 500);
      mr.start(); render();
    }).catch(function () { toast('没有拿到麦克风权限，请在浏览器设置里允许后再试', true); });
  }
  function aiStop() {
    if (!ai.recording) return;
    ai.recording = false; clearInterval(ai.timer); cancelAnimationFrame(ai.raf);
    try { ai.ctx && ai.ctx.close(); } catch (e) {}
    var finish = function () { try { ai.mr.stop(); } catch (e) {} render(); };
    if (ai.sr) { try { ai.sr.onend = finish; ai.sr.stop(); setTimeout(function () { if (ai.mr.state === 'recording') finish(); }, 1500); } catch (e) { finish(); } ai.sr = null; } else finish();
  }
  /* 手动录音（追加到描述） */
  var pSR = null;
  function pRecStart() {
    var n0 = pd ? pd.note.length : 0;
    startRec(function (blob) { if (pd && pd.note.length === n0 && canSrvTr()) srvTr(blob, '录音').then(function (t) { if (t && pd) { pd.note = (pd.note + (pd.note ? '\n' : '') + t).slice(0, 1000); render(); } }, function () {}); });
    if (SR) { try { pSR = new SR(); pSR.lang = 'zh-CN'; pSR.continuous = true; pSR.onresult = function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { pd.note = (pd.note + (pd.note ? '\n' : '') + e.results[i][0].transcript).slice(0, 1000); } }; pSR.start(); } catch (e) { pSR = null; } }
  }
  function pRecStop() { if (pSR) { try { pSR.stop(); } catch (e) {} pSR = null; } stopRec(); }
  function optimize() {
    if (!pd.title && !pd.note) { location.hash = '#/project/ai'; return toast('先说一说或上传视频，AI 帮你生成项目'); }
    var n = pd.note.trim();
    if (/【背景】/.test(n)) return toast('描述已经是结构化格式了');
    if (AI_ON && !pd.aiRule) { toast('Claude 正在整理描述…'); TMS.aiWrite('optimize', pd.title, n, pd.due).then(function (r) { if (r.text) { pd.note = r.text; render(); toast('Claude 已按「背景、问题、目标、要点」整理，可以再改'); } }, function (e) { toast(((e && e.error) || 'AI 暂时不可用') + '，已改用规则整理', true); pd.aiRule = true; optimize(); pd.aiRule = false; }); return; }
    pd.note = ('【背景】' + (n || pd.title) + '\n【要解决的问题】待补充\n【目标】' + (pd.title || '待补充') + '顺利完成并通过验收\n【关键要点】时间、预算、负责人待确认').slice(0, 500);
    render(); toast('已按「背景、问题、目标、要点」整理（演示：规则模拟）');
  }
  var PDO = {
    goProject: function () { if (!canCreateProject()) return toast('只有老板、运营者和有发起权的负责人可以新建项目', true); pd = freshPD(); location.hash = '#/project'; },
    goProjectAI: function () { location.hash = '#/project/ai'; },
    // 通用页头（新建项目、分配任务、创建待办、补充记录等）的返回：新建项目第 2、3 步先退回上一步，其余回到来源页面
    pBack: function () {
      var c = cur();
      if (ai.recording) aiStop();
      if (c.name === 'project' && !c.id && pd && pd.step > 1) { pd.step--; render(); window.scrollTo(0, 0); return; }
      if (c.name === 'project' && !c.id) pd = null;
      goBack();
    },
    pType: function (el) { pd.ptype = el.dataset.k; if (PT_MORE.some(function (t) { return t[0] === pd.ptype; })) pd.otherOpen = false; render(); },
    pTypeOther: function () { pd.otherOpen = !pd.otherOpen; render(); },
    pOptimize: optimize,
    pRmFile: function (el) { pd.files.splice(+el.dataset.i, 1); render(); },
    pRecStart: pRecStart, pRecStop: pRecStop,
    pPick: function (el) { var k = el.dataset.k, ids, empty = '', t2;
      if (k === 'leadId') { ids = TM.leadUsers(S); t2 = '选择负责人'; if (TM.PTYPE[pd.ptype][1] !== 'product') empty = '不指定，由运营者推进'; }
      else if (k === 'operatorId') { ids = TM.followUsers(S); t2 = '选择跟进运营'; }
      else { ids = TM.activeUsers(S).filter(function (u) { return !u.roles.every(function (a) { return a.role === 'admin'; }); }).map(function (u) { return u.id; }); t2 = '选择验收人'; empty = '默认：负责人，没有时由运营者验收'; }
      npPick(t2, ids, pd[k], empty, function (v) { pd[k] = v; }); },
    pPickT: function (el) { var i = +el.dataset.i, ids = TM.activeUsers(S).filter(function (u) { return u.roles.some(function (a) { return a.role === 'executor' || a.role === 'lead' || a.role === 'operator'; }); }).map(function (u) { return u.id; });
      npPick('选择执行人', ids, pd.tasks[i].ownerId, '', function (v) { if (v) pd.tasks[i].ownerId = v; }); },
    pDue: function (el) { pd.due = TM.dateAdd(S, +el.dataset.d); render(); },
    pPri: function (el) { pd.priority = el.dataset.v; render(); },
    pGoalAI: function () { if (AI_ON && !pd.aiRule && (pd.title || pd.note)) { toast('Claude 正在拟目标…'); TMS.aiWrite('goal', pd.title, pd.note, pd.due).then(function (r) { if (r.text) { pd.goal = r.text; render(); toast('Claude 拟了目标，可以再改'); } }, function (e) { toast(((e && e.error) || 'AI 暂时不可用') + '，已改用规则', true); pd.aiRule = true; DO.pGoalAI(); pd.aiRule = false; }); return; }
      var n = (pd.note || '').replace(/【[^】]*】/g, ' ').split(/[。\n！!；;]/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 3; })[0] || pd.title; pd.goal = ((pd.due ? mdTxt(pd.due) + '前' : '') + (n || '').replace(/^(我想|我们想|希望|打算|准备)/, '') + '，并通过验收').slice(0, 200); render(); toast('已按描述拟了目标（演示：规则模拟），可以再改'); },
    pTasksAI: function (el) {
      // 老板 / 管理员且 AI 已启用：交给 Claude 按名称、类型和描述拆任务；失败退回规则
      if (AI_ON && !pd.aiRule && (pd.title || pd.note)) {
        if (el && el.disabled) return; if (el) { el.disabled = true; el.dataset.t = el.innerHTML; el.innerHTML = '<span class="ai-typing"><i></i><i></i><i></i></span> Claude 拆解中…'; }
        var undo = function () { if (el) { el.disabled = false; el.innerHTML = el.dataset.t; } };
        TMS.aiProject('项目名称：' + (pd.title || '') + '\n项目类型：' + (TM.PTYPE[pd.ptype] ? TM.PTYPE[pd.ptype][0] : '') + '\n项目描述：' + (pd.note || '') + (pd.goal ? '\n项目目标：' + pd.goal : '') + '\n请拆出首批任务。').then(function (r) {
          undo(); var have = pd.tasks.map(function (t) { return t.title.trim(); });
          var list = r.tasks.filter(function (t) { return have.indexOf(t.title) < 0; }).map(function (t) { return { title: t.title, ownerId: t.ownerId || pd.leadId || TM.usersWith(S, 'executor')[0], expected: t.expected || '完成说明 + 成果链接或照片', criteria: t.criteria || '由验收人确认达到目标' }; });
          if (!list.length) return toast('Claude 建议的任务都已经在列表里了');
          pd.tasks = pd.tasks.filter(function (t) { return t.title.trim(); }).concat(list); render(); toast('Claude 拆出 ' + list.length + ' 个任务，执行人可以改');
        }, function (e) { undo(); toast(((e && e.error) || 'AI 暂时不可用') + '，已改用规则拆解', true); pd.aiRule = true; DO.pTasksAI(); pd.aiRule = false; });
        return;
      }
      var r = pd.note ? parseTranscript(pd.note) : { tasks: [] }, ld = pd.leadId && (TM.user(S, pd.leadId).roles.find(function (x) { return x.role === 'lead'; }) || {}).dept;
      var ex = (ld && S.users.find(function (u) { return u.roles.some(function (x) { return x.role === 'executor' && x.dept === ld; }); }) || {}).id || TM.usersWith(S, 'executor')[0];
      var list = r.tasks && r.tasks.length >= 2 ? r.tasks.map(function (t) { return { title: t.title, ownerId: t.ownerId || ex, expected: t.expected || '完成说明 + 成果链接或照片', criteria: t.criteria || '由验收人确认达到目标' }; })
        : (TASK_TPL[TM.PTYPE[pd.ptype][1]] || TASK_TPL.other).map(function (t) { return { title: t[0], ownerId: ex, expected: t[1], criteria: t[2] }; });
      var have = pd.tasks.map(function (t) { return t.title.trim(); }); list = list.filter(function (t) { return have.indexOf(t.title) < 0; });
      if (!list.length) return toast('AI 建议的任务都已经在列表里了');
      pd.tasks = pd.tasks.filter(function (t) { return t.title.trim(); }).concat(list); render(); toast('AI 拆出 ' + list.length + ' 个任务（演示：规则模拟），执行人可以改');
    },
    pAddTask: function () { pd.tasks.push({ title: '', ownerId: TM.usersWith(S, 'executor')[0], expected: '', criteria: '' }); render(); },
    pRmTask: function (el) { pd.tasks.splice(+el.dataset.i, 1); render(); },
    pPrev: function () { pd.step = Math.max(1, pd.step - 1); render(); window.scrollTo(0, 0); },
    pNext: function () {
      if (rec) return toast('请先停止录音', true);
      if (pd.step === 1) { if (!pd.title.trim()) return toast('请填写项目名称', true); if (!pd.note.trim()) return toast('请简单描述一下项目', true); }
      if (pd.step === 2) {
        if (TM.PTYPE[pd.ptype][1] === 'product' && !pd.leadId) return toast('产品开发项目请指定项目负责人', true);
        var bad = pd.tasks.find(function (t) { return t.title.trim() && (!t.expected.trim() || !t.criteria.trim()); });
        if (bad) return toast('「' + bad.title + '」请写预期成果和验收标准', true);
      }
      pd.step++; render(); window.scrollTo(0, 0);
    },
    pCreate: function () {
      var r = TM.act(S, me, 'project.create', { title: pd.title, note: pd.note, ptype: pd.ptype, leadId: pd.leadId, operatorId: pd.operatorId, reviewerId: pd.reviewerId, due: pd.due, tasks: pd.tasks, goal: pd.goal, priority: pd.priority, media: pd.files.map(function (f) { return { kind: f.kind, name: f.name, durationSec: f.durationSec, localId: f.localId }; }), source: pd.source });
      if (!r.ok) return toast(r.error, true);
      save(); pd = null; navFinish('#/work/' + r.workId); toast('项目已创建，相关的人已收到通知');
    },
    aiTab: function (el) { if (ai.recording) aiStop(); ai.tab = el.dataset.t; render(); },
    aiStart: aiStart, aiStop: aiStop,
    aiSample: function (el) { var x = SAMPLES.find(function (s) { return s.k === el.dataset.k; }); ai.pending = null; runParse(x.text, '示例视频「' + x.t + '」' + x.d + '（示例素材）'); }
  };
  /* ---------- 记录想法：总入口 + 三个专属页面（语音 / 视频 / 文字） ---------- */
  var G4ART = {
    voice: '<svg viewBox="0 0 120 70"><g stroke="#8A93A3" stroke-width="2.4" stroke-linecap="round" opacity=".55">' + [10, 22, 34, 18, 46, 30, 52, 26, 40, 14, 30, 20, 8].map(function (h, i) { return '<path d="M' + (6 + i * 9) + ' ' + (35 - h / 2) + 'v' + h + '"/>'; }).join('') + '</g></svg>',
    video: '<svg viewBox="0 0 120 90"><g fill="none" stroke="#8A93A3" opacity=".55"><rect x="22" y="22" width="78" height="52" rx="10" stroke-width="2"/><circle cx="61" cy="48" r="18" stroke-width="2.5"/><circle cx="61" cy="48" r="10" stroke-width="1.5"/><path d="M34 22l6-8h22l6 8" stroke-width="2"/></g><circle cx="56" cy="43" r="3" fill="#fff" opacity=".9"/></svg>',
    text: '<svg viewBox="0 0 120 90"><g stroke="#8A93A3" opacity=".45" stroke-linecap="round"><path d="M10 30h70M10 44h56M10 58h64M10 72h40" stroke-width="1.6"/></g><g opacity=".6"><path d="M70 82l38-58 8 5-38 58-10 4z" fill="#C3CAD6"/><path d="M70 82l2-9 8 5z" fill="#6B7586"/></g></svg>',
    ai: '<svg viewBox="0 0 120 100"><defs><radialGradient id="g4b" cx="40%" cy="35%" r="60%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#C9D2E2" stop-opacity=".5"/></radialGradient></defs><g opacity=".75"><path d="M60 14a26 26 0 0 0-16 46c3 3 5 6 5 10v4h22v-4c0-4 2-7 5-10a26 26 0 0 0-16-46z" fill="url(#g4b)" stroke="#AEB7C6" stroke-width="1.5"/><path d="M50 82h20M53 89h14" stroke="#AEB7C6" stroke-width="2" stroke-linecap="round"/><path d="M92 26l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="#fff"/></g></svg>'
  };
  var FILEIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-10z"/><path d="M14 3.5v5h5M12 11.5v5M9.5 14h5"/></svg>';
  function viewNewHub() {
    var M = [['voice', 'm-voice', 'mic', '语音记录', '说出你的想法'], ['video', 'm-video', 'cam', '上传视频', '从手机选择'], ['text', 'm-text', 'pen', '文字输入', '快速记录']];
    var drafts = S.ideas.filter(function (d) { return d.creatorId === me && d.status === 'draft'; }).sort(byRecent);
    return '<section class="n-hero"><div class="n-top"><button class="circle n-back" data-do="back" aria-label="返回">' + hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button>' +
      '</div>' +
      '<h1>记录一个想法</h1><p>用语音、文字或视频，随时记录你的想法</p><small>好的想法，值得被认真对待。</small>' +
      '<div class="n-script" aria-hidden="true">Turn<br>&nbsp;Ideas<br>&nbsp;&nbsp;Into Impact<svg viewBox="0 0 120 16"><path d="M4 13c34-5 72-8 112-11" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg></div>' +
      '</section>' +
      '<div class="g4">' + M.concat([['file', '', 'filein', '从文件导入', '图片 / 文档 / 链接']]).map(function (m) {
        return '<a class="n-mode g4-card g4-' + m[0] + '" href="#/new/' + m[0] + '" data-do="pickMode" data-m="' + m[0] + '"><span class="g4-ic">' + (m[2] === 'filein' ? FILEIN : ni(m[2], 1.6)) + '</span><b>' + m[3] + '</b><small>' + m[4] + '</small><i class="g4-go">' + hi('chev', 2.2) + '</i></a>';
      }).join('') + '</div>' +
      '<button type="button" class="g4-card g4-wide g4-ai" data-do="recallOpen"><span class="g4-ic">' + hi('spark', 1.5) + '</span><span class="g4-wt"><b>AI 助手</b><small>忘了放在哪？问我就能找回记过的想法、录音、视频和文件</small></span><i class="g4-go">' + hi('chev', 2.2) + '</i></button>' +
      '<section class="h-card n-drafts"><div class="h-sec in"><h2>我的草稿' + (drafts.length ? '<i>' + drafts.length + '</i>' : '') + '</h2></div>' +
      (drafts.length ? drafts.slice(0, 5).map(function (d) { return '<a class="h-todo" href="#/idea/' + d.id + '"><span class="n-dic">' + ni(d.media.some(function (m) { return m.kind === 'video'; }) ? 'cam' : d.media.some(function (m) { return m.kind === 'audio'; }) ? 'mic' : 'pen') + '</span><span class="h-tt"><b>' + esc(d.title || d.note.slice(0, 20) || '未命名') + '</b><span class="h-tags"><i class="p-lo">仅自己可见</i></span></span><span class="h-due">' + ago(d.lastActivity) + '</span>' + hi('chev', 2) + '</a>'; }).join('') : '<p class="muted" style="font-size:13.5px;margin:2px 16px 14px">还没有草稿。点上面任一方式开始记录。</p>') + '</section>';
  }
  function capHead(title, sub) { return pHead(title, sub, '<button class="n-ai p-aibtn" data-do="quickAI">' + hi('spark', 1.6) + 'AI 助手</button>'); }
  function capFoot(kind) {
    return '<div class="p-btns c-foot"><button class="p-prev" data-do="capSave" data-k="' + kind + '">存为草稿</button><button class="n-next" data-do="capNext" data-k="' + kind + '">下一步' + ni('arrow', 2) + '</button></div>' +
      '<p class="c-hint">保存后是你的私人草稿；点「下一步」再选择直接推进还是团队共创。</p>';
  }
  function titleField(val, key) { return '<label class="p-fld"><span>标题（可不填，AI 会起）</span><input type="text" data-cap="' + key + '.title" maxlength="50" placeholder="比如：办公室换网线" value="' + esc(val) + '"></label>'; }
  function clipHTML(m, i, kind) {
    var b = m.localId && blobUrl(m.localId);
    var player = b ? (m.kind === 'video' ? '<video controls playsinline src="' + b + '"></video>' : '<audio controls src="' + b + '"></audio>') : '<span>' + esc(m.name) + '</span>';
    return '<div class="c-clip">' + '<div class="c-clip-h"><span>' + ni(m.kind === 'video' ? 'cam' : 'mic') + esc(m.name) + '</span><button type="button" class="btn ghost" data-do="capRmClip" data-k="' + kind + '" data-i="' + i + '">删除</button></div>' + player + '</div>';
  }
  /* —— 语音记录 —— */
  var vo = { clips: [], text: '', title: '', state: 'idle', t0: 0, acc: 0, mr: null, stream: null, sr: null, ctx: null, raf: null, timer: null };
  function voSec() { return Math.round((vo.acc + (vo.state === 'rec' ? Date.now() - vo.t0 : 0)) / 1000); }
  var VTAGS = ['活动', '宣教', '教育', '事工', '团契', '产品', '行政', '培训', '探访', '媒体'];
  function viewNewVoice() {
    var st3 = vo.state, sec = voSec(), arc = st3 === 'idle' && !vo.clips.length ? 0 : ((sec % 60) || (st3 === 'idle' ? 60 : 0)) / 60;
    var C = 2 * Math.PI * 92, ring = '<svg class="vr-ring" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="5"/><circle id="vring" cx="100" cy="100" r="92" fill="none" stroke="url(#vrg)" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - arc)).toFixed(1) + '" transform="rotate(-90 100 100)"/><defs><linearGradient id="vrg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9DB8FF"/><stop offset="1" stop-color="#3B6FF0"/></linearGradient></defs></svg>';
    var status = st3 === 'rec' ? '正在聆听…' : st3 === 'pause' ? '已暂停' : vo.clips.length ? '已录 ' + vo.clips.length + ' 段，可继续录' : '点击话筒开始录音';
    var ctl = function (doAct, icon, label, big, dis) { return '<button class="vr-c' + (big ? ' big' : '') + '" data-do="' + doAct + '"' + (dis ? ' disabled' : '') + '><span>' + icon + '</span><small>' + label + '</small></button>'; };
    var TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 12.2a1.5 1.5 0 0 0 1.5 1.3h6a1.5 1.5 0 0 0 1.5-1.3l1-12.2M10 11v6M14 11v6"/></svg>';
    var STOP = '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="#3B6FF0"/></svg>', PAUSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6v12M15 6v12"/></svg>', PLAY = '<svg viewBox="0 0 24 24"><path d="M8.5 6.5v11l9-5.5z" fill="currentColor"/></svg>', MIC2 = '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11.5" rx="3" fill="#3B6FF0"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="#3B6FF0" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';
    var ctrls = st3 === 'idle' ? ctl('voCancel', TRASH, '清空', false, !vo.clips.length && !vo.text) + ctl('voStart', MIC2, vo.clips.length ? '继续录' : '开始', true) + ctl('voPause', PAUSE, '暂停', false, true)
      : ctl('voCancel', TRASH, '取消') + ctl('voStop', STOP, '停止', true) + (st3 === 'rec' ? ctl('voPause', PAUSE, '暂停') : ctl('voResume', PLAY, '继续'));
    return '<section class="vr-hero"><div class="n-top"><button class="circle n-back" data-do="back" aria-label="返回">' + hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button></div>' +
      '<small class="vr-eye">VOICE YOUR IDEA</small><h1>语音记录</h1><p>说出你的想法，AI 会帮你整理</p><div class="vr-script" aria-hidden="true">Ideas<br>&nbsp;Change<br>&nbsp;&nbsp;Everything<svg viewBox="0 0 90 12"><path d="M3 9c26-4 54-6 84-6" stroke="#3E4757" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg></div></section>' +
      '<section class="c-voice vr-main"><div class="a-rec' + (st3 === 'rec' ? ' live' : '') + '">' + waveBars('l') + '<button class="vr-mic" data-do="' + (st3 === 'rec' ? 'voPause' : st3 === 'pause' ? 'voResume' : 'voStart') + '" aria-label="' + (st3 === 'rec' ? '暂停录音' : '开始录音') + '">' + ring + '<span>' + ni('mic', 1.6) + '</span></button>' + waveBars('r') + '</div>' +
      '<div class="vr-time" id="votimer">' + fmtSec(sec) + '</div><p class="vr-st">' + status + '</p><div class="vr-ctrls">' + ctrls + '</div>' +
      (vo.clips.length ? '<div class="vr-clips">' + vo.clips.map(function (m, i) { return clipHTML(m, i, 'vo'); }).join('') + '</div>' : '') + '</section>' +
      '<section class="p-card vr-card"><div class="vr-ch">' + ai2('doc2', 1.6) + '<div><b>实时识别文字</b><small>' + (SR ? '边说边转写，可随时编辑' : canSrvTr() ? '停止录音后由团队服务器转成文字，可随时编辑' : '当前浏览器不支持转写，可直接输入要点') + '</small></div>' + (st3 === 'rec' && SR ? '<span class="vr-badge"><i></i>识别中…</span>' : '') + '</div>' +
      '<div class="vr-box"><textarea data-cap="vo.text" rows="4" maxlength="1000" placeholder="' + (SR ? '开始录音后，识别的文字会出现在这里' : '在这里写下这段录音的要点') + '">' + esc(vo.text) + '</textarea><div class="vr-boxf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 10v4M9 7v10M13 9v6M17 6v12M21 10v4"/></svg>' + ai2('edit', 1.6) + '</div></div></section>' +
      '<section class="p-card vr-card"><div class="vr-ch">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12V5a1.5 1.5 0 0 1 1.5-1.5h7l8.5 8.5-8.5 8.5z"/><circle cx="8" cy="8" r="1.3"/></svg>' + '<div><b>添加标签（可不填）</b><small>帮助 AI 更好地理解你的想法</small></div><div class="vr-tags">' + VTAGS.slice(0, 3).concat((vo.tags || []).filter(function (t) { return VTAGS.slice(0, 3).indexOf(t) < 0; })).map(function (t) { var on = (vo.tags || []).indexOf(t) >= 0; return '<button class="' + (on ? 'on' : '') + '" data-do="voTag" data-t="' + t + '">' + (on ? '✓ ' : '+ ') + t + '</button>'; }).join('') + '<button class="vr-more" data-do="voTagMore" aria-label="更多标签">' + ti('more', 1.6) + '</button></div></div></section>' +
      aitBar('vo') + '<button class="vr-next" data-do="capNext" data-k="vo">' + hi('spark', 1.6) + '下一步 · 让 AI 整理这条想法' + ni('arrow', 2) + '</button><p class="c-hint">你可以在下一步中补充更多信息、选择项目或分享给团队。</p>';
  }
  function voLevels(stream) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext, ctx = new AC(), an = ctx.createAnalyser(); an.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(an); vo.ctx = ctx; var buf = new Uint8Array(an.frequencyBinCount);
      var loop = function () { an.getByteFrequencyData(buf); document.querySelectorAll('.c-voice .a-wave i').forEach(function (b, i) { var v = vo.state === 'rec' ? buf[(i % 12) + 2] / 255 : 0; b.style.height = Math.max(6, Math.round(+b.dataset.h * (0.7 + v * 0.9))) + 'px'; }); vo.raf = requestAnimationFrame(loop); };
      loop();
    } catch (e) {}
  }
  /* 持续识别：识别说完一段会自动结束，需要接着听。但有些手机的语音服务一启动就出错——如果每次结束都立刻重启，
     会变成每秒上百次「启动 → 出错 → 结束 → 重启」，耗尽系统资源导致 App 闪退。这里：致命错误不再重启；
     连续 3 次启动不到 1.5 秒就结束则放弃；重启前稍等一下，越快结束等得越久。onGiveUp(是否致命错误) 由调用方提示用户。 */
  function srKeep(r, alive, onGiveUp) {
    var quick = 0, t0 = Date.now(), fatal = false, prevErr = r.onerror;
    r.onerror = function (e) { if (/not-allowed|service-not-allowed|audio-capture|language-not-supported/.test(e && e.error || '')) fatal = true; if (e && e.detail) srDiag(e.error, e.detail); if (prevErr) prevErr.call(r, e); };
    r.onend = function () {
      if (!alive()) return;
      quick = Date.now() - t0 < 1500 ? quick + 1 : 0;
      if (fatal || quick >= 3) { if (onGiveUp) onGiveUp(fatal); return; }
      setTimeout(function () { if (!alive()) return; t0 = Date.now(); try { r.start(); } catch (e) { if (onGiveUp) onGiveUp(true); } }, quick ? 400 * quick : 150);
    };
  }
  // 语音识别出错的诊断信息（安卓原生给出：错误代码、试过的识别服务、手机型号）：登录了团队服务器就发一份过去，方便排查；每次打开 App 最多发 3 次
  var srDiagN = 0;
  function srDiag(err, d) {
    if (srDiagN >= 3 || !(SRV && TMS.loggedIn() && TMS.diag)) return; srDiagN++;
    TMS.diag({ kind: 'speech', error: err, code: d.code, tried: d.tried, service: d.service, device: d.device });
  }
  function srCodeText() { var d = typeof TMN !== 'undefined' && TMN.lastSpeechError; return d && d.code ? '（错误代码 ' + d.code + '）' : ''; }
  // 手机自带的识别不行时：连着能转写的团队服务器就不当成错误——停止录音后服务器会转（见 voStop / taRec 的 srvTr）
  function srGaveUp(fatal) { if (canSrvTr()) return toast('手机自带的边说边转用不了，停止录音后由团队服务器转成文字'); toast((fatal ? '语音转文字暂时不可用' : '这台手机的语音转文字连不上') + srCodeText() + '，录音照常进行。也可以用输入法的话筒说到文字框里', true); }
  function voSR() {
    if (!SR) return; try { var r = new SR(); r.lang = 'zh-CN'; r.continuous = true; r.onresult = function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { vo.text = (vo.text + e.results[i][0].transcript + '。').slice(0, 1000); var ta = document.querySelector('[data-cap="vo.text"]'); if (ta) ta.value = vo.text; } }; srKeep(r, function () { return vo.state === 'rec' && vo.sr === r; }, srGaveUp); r.start(); vo.sr = r; } catch (e) {}
  }
  function voCleanup() {
    clearInterval(vo.timer); cancelAnimationFrame(vo.raf);
    if (vo.sr) { var r = vo.sr; vo.sr = null; try { r.stop(); } catch (e) {} }
    try { vo.ctx && vo.ctx.close(); } catch (e) {} vo.ctx = null;
  }
  var VO = {
    voStart: function () {
      if (!(navigator.mediaDevices && window.MediaRecorder)) return toast('当前浏览器不支持录音', true);
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var chunks = [], mr = new MediaRecorder(stream), vn0 = vo.text.length;
        vo.stream = stream; vo.mr = mr; vo.acc = 0; vo.t0 = Date.now(); vo.state = 'rec';
        mr.ondataavailable = function (e) { chunks.push(e.data); };
        mr.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          if (vo.discard) { vo.discard = false; vo.state = 'idle'; render(); return; } var sec = Math.round(vo.acc / 1000), lid = rid('b');
          var vblob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), clip = { kind: 'audio', name: '录音 ' + fmtSec(sec), durationSec: sec, localId: lid };
          blobs[lid] = keepBlob(lid, vblob);
          vo.clips.push(clip); vo.state = 'idle'; render();
          // 这一段手机没转出文字：交给服务器转，写进识别文字；这段录音标成「已写进正文」，服务器不再重复转
          if (vo.text.length === vn0 && canSrvTr()) srvTr(vblob, '录音').then(function (t) { if (!t) return toast('这段录音里没有识别到说话', true); vo.text = (vo.text + (vo.text ? '\n' : '') + t).slice(0, 5000); clip.transcriptStatus = 'intext'; render(); }, function () {});
        };
        mr.start(); voLevels(stream); voSR();
        vo.timer = setInterval(function () { var t = document.getElementById('votimer'); if (t) t.textContent = fmtSec(voSec()); var rg = document.getElementById('vring'); if (rg) { var C2 = 2 * Math.PI * 92; rg.setAttribute('stroke-dashoffset', (C2 * (1 - (voSec() % 60) / 60)).toFixed(1)); } }, 400);
        render();
      }).catch(function () { toast('没有拿到麦克风权限，请在浏览器设置里允许后再试', true); });
    },
    voPause: function () { try { vo.mr.pause(); } catch (e) {} vo.acc += Date.now() - vo.t0; vo.state = 'pause'; if (vo.sr) { var r = vo.sr; vo.sr = null; try { r.stop(); } catch (e) {} } render(); },
    voResume: function () { try { vo.mr.resume(); } catch (e) {} vo.t0 = Date.now(); vo.state = 'rec'; voSR(); render(); },
    voCancel: function () {
      if (vo.state === 'rec' || vo.state === 'pause') { vo.discard = true; VO.voStop(); toast('已取消这段录音'); return; }
      askSheet('清空录音', '清空已录的音频和识别文字？清空后无法恢复。', '清空', true).then(function (y) { if (y) { vo.clips = []; vo.text = ''; render(); } });
    },
    voTag: function (el) { var t = el.dataset.t; vo.tags = vo.tags || []; var i = vo.tags.indexOf(t); if (i >= 0) vo.tags.splice(i, 1); else if (vo.tags.length < 5) vo.tags.push(t); else toast('最多 5 个标签', true); render(); },
    voTagMore: function () { openSheet('选择标签', '<div class="t-tagpick">' + VTAGS.map(function (t) { var on = (vo.tags || []).indexOf(t) >= 0; return '<button type="button" class="' + (on ? 'on' : '') + '" data-do="voTag" data-t="' + t + '">' + t + '</button>'; }).join('') + '</div><p class="muted" style="font-size:13px">最多 5 个。</p>', '完成', function () { closeSheet(); render(); }); },
    voStop: function () { if (vo.state === 'rec') vo.acc += Date.now() - vo.t0; vo.state = 'stopping'; voCleanup(); try { vo.mr.stop(); } catch (e) {} }
  };
  /* —— 三个记录页（与语音记录同一风格） —— */
  function addVideos(files) {
    var added = 0, big = 0;
    Array.prototype.forEach.call(files, function (cf) { if (!/^video\//.test(cf.type) && !/\.(mp4|mov|m4v|webm|avi)$/i.test(cf.name)) return; if (cf.size > VMAX) { big++; return; } var cl = rid('v'); blobs[cl] = keepBlob(cl, cf); cam.clips.push({ kind: 'video', name: cf.name + '（' + fmtSize(cf.size) + '）', fname: cf.name, size: fmtSize(cf.size), localId: cl }); added++; });
    render(); toast(big ? big + ' 个视频超过 2GB，未添加' : added ? '已添加 ' + added + ' 个视频（未上传）' : '请选择视频文件', !!big || !added);
  }
  function addFiles(files) {
    var rf = recentFiles();
    Array.prototype.forEach.call(files, function (f) {
      var isImg = /^image\//.test(f.type), isVid = /^video\//.test(f.type), isTxt = /\.(txt|md)$/i.test(f.name) || /^text\//.test(f.type);
      var item = { kind: isImg ? 'image' : isVid ? 'video' : 'file', name: f.name, size: fmtSize(f.size) };
      item.localId = rid('i'); blobs[item.localId] = keepBlob(item.localId, f);
      fi.files.push(item);
      rf.unshift({ kind: item.kind, name: f.name, size: item.size, at: Date.now(), localId: item.localId }); 
      if (isTxt) { var r2 = new FileReader(); r2.onload = function () { item.read = true; fi.note = (fi.note + (fi.note ? '\n\n' : '') + '【' + f.name + '】\n' + String(r2.result)).slice(0, 1000); if (!fi.title) fi.title = f.name.replace(/\.[^.]+$/, '').slice(0, 50); render(); }; r2.readAsText(f); }
    });
    S.fileRecent = rf.filter(function (x, i) { return rf.findIndex(function (y) { return y.name === x.name; }) === i; }).slice(0, 12).map(function (x) { var y = Object.assign({}, x); return y; });
    save(); render(); toast('已导入 ' + files.length + ' 个文件（未上传）');
  }
  function vrHero(eye, title, sub) {
    return '<section class="vr-hero"><div class="n-top"><button class="circle n-back" data-do="back" aria-label="返回">' + hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button></div>' +
      '<small class="vr-eye">' + eye + '</small><h1>' + title + '</h1><p>' + sub + '</p><div class="vr-script" aria-hidden="true">Ideas<br>&nbsp;Change<br>&nbsp;&nbsp;Everything<svg viewBox="0 0 90 12"><path d="M3 9c26-4 54-6 84-6" stroke="#3E4757" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg></div></section>';
  }
  function tagRow(list, sel, act) {
    return '<div class="cx-tags">' + list.map(function (t) { var on = sel.indexOf(t[0]) >= 0; return '<button class="' + (on ? 'on' : '') + '" data-do="' + act + '" data-t="' + t[0] + '">' + (t[1] ? ai2(t[1], 1.6) : (on ? '✓ ' : '+ ')) + t[0] + '</button>'; }).join('') + '<button class="cx-more" data-do="' + act + 'More" aria-label="更多标签">' + ti('more', 1.6) + '</button></div>';
  }
  /* 提交前预览 AI 拟题：没填标题、已有内容时显示，可直接改 */
  function capObj(k) { return k === 'vo' ? vo : k === 'cam' ? cam : k === 'fi' ? fi : tx; }
  function aitInner(k) {
    var d = capData(k); if (String(d.title || '').trim() || (!String(d.note || '').trim() && !(d.media || []).length)) return '';
    return '<span class="cx-ait-l">' + hi('spark', 1.6) + 'AI 拟题</span><b>' + esc(TM.aiTitle(d)) + '</b><button type="button" data-do="aitEdit" data-k="' + k + '">' + ai2('edit', 1.7) + '改一改</button>';
  }
  function aitBar(k) { return '<div class="cx-ait" id="cx-ait-' + k + '">' + aitInner(k) + '</div>'; }
  function cxNext(k, label, hint) { return aitBar(k) + '<button class="vr-next" data-do="capNext" data-k="' + k + '">' + hi('spark', 1.6) + label + ni('arrow', 2) + '</button><p class="c-hint">' + hint + '</p>'; }
  function fmtSize(n) { return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : Math.round(n / 1048576 * 10) / 10 + ' MB'; }
  var CLOUD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.2a4.2 4.2 0 0 1-.5 10.3"/><path d="M12 12v8M9 15l3-3 3 3"/></svg>';
  /* 上传视频 */
  var cam = { clips: [], title: '', note: '', tags: [] };
  var VMAX = 2048 * 1048576, VID_TAGS = [['事工'], ['宣教'], ['见证'], ['活动'], ['生活']], VID_MORE = ['培训', '团契', '敬拜', '探访', '媒体'];
  function viewNewVideo() {
    var pick = function (cap, icon, label) { return '<label class="cx-pick">' + icon + '<span>' + label + '</span>' + hi('chev', 2) + '<input type="file" accept="video/*" ' + (cap ? 'capture="environment" ' : 'multiple ') + 'data-camfile="1"></label>'; };
    return vrHero('SHARE YOUR VIDEO', '上传视频', '用影像记录你的想法，让好内容被看见。') +
      '<section class="cx-card cx-up"><label class="cx-drop" data-drop="cam">' + '<span class="cx-dropic">' + CLOUD + '</span><b>点击上传视频</b><small>或拖拽文件到这里</small><em>支持 MP4、MOV 等常见格式 · 单个文件不超过 2GB</em><input type="file" accept="video/*" multiple data-camfile="1"></label>' +
      '<div class="cx-picks">' + pick(false, pi('img'), '从相册选择') + pick(true, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/></svg>', '拍摄视频') + '</div></section>' +
      cam.clips.map(function (m, i) { var b = m.localId && blobUrl(m.localId); return '<section class="cx-card cx-vid"><span class="cx-thumb">' + (b ? '<video src="' + b + '#t=0.5" muted playsinline preload="metadata" data-vmeta="' + i + '"></video>' : '') + '<i>' + pi('play') + '</i><em>' + (m.durationSec ? fmtSec(m.durationSec) : '--:--') + '</em></span><div class="cx-vi"><b>' + esc(m.fname || m.name) + '</b><small>' + esc(m.size || '') + (m.durationSec ? ' · ' + fmtSec(m.durationSec) : '') + '</small><span class="cx-prog"><i style="width:100%"></i></span><small class="cx-local">已添加到本机 · 演示版不上传</small></div><button class="cx-x" data-do="capRmClip" data-k="cam" data-i="' + i + '" aria-label="移除">' + ai2('x', 2) + '</button></section>'; }).join('') +
      '<section class="cx-card"><div class="vr-ch">' + pi('img') + '<div><b>标题（可不填）</b></div></div><input class="cx-in" type="text" data-cap="cam.title" maxlength="100" placeholder="给这个视频起个标题..." value="' + esc(cam.title) + '"><div class="n-cnt" id="cc-cam-title">' + cam.title.length + '/100</div></section>' +
      '<section class="cx-card"><div class="vr-ch">' + ai2('doc2', 1.6) + '<div><b>补充说明（可不填）</b></div></div><textarea class="cx-in" data-cap="cam.note" rows="3" maxlength="500" placeholder="简单介绍一下这个视频的内容...">' + esc(cam.note) + '</textarea><div class="n-cnt" id="cc-cam-note">' + cam.note.length + '/500</div></section>' +
      '<section class="cx-card"><div class="vr-ch">' + TAGI + '<div><b>添加标签（可多选）</b></div></div>' + tagRow(VID_TAGS.concat(cam.tags.filter(function (t) { return !VID_TAGS.some(function (x) { return x[0] === t; }); }).map(function (t) { return [t]; })), cam.tags, 'camTag') + '</section>' +
      cxNext('cam', '下一步，让 AI 整理这条视频', '上传后，AI 会帮你提取要点、生成摘要，并推荐合适的分类。');
  }
  var TAGI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12V5a1.5 1.5 0 0 1 1.5-1.5h7l8.5 8.5-8.5 8.5z"/><circle cx="8" cy="8" r="1.3"/></svg>';
  /* 文字输入 */
  var tx = (function () { try { var x = JSON.parse(localStorage.getItem('tm_txdraft') || 'null'); if (x) return { title: x.title || '', note: x.note || '', files: [], tags: x.tags || [], ai: x.ai !== false, big: false }; } catch (e) {} return { title: '', note: '', files: [], tags: [], ai: true, big: false }; })();
  /* AI 优化：生成块与正文分离，重复点击不叠加 */
  function txClean(x) { return String(x).trim().replace(/^(?:[·•\-]\s*|\d+\s*[.、．)）]\s*)+/, '').trim(); }
  function txSplit(note) {
    var points = '', tasks = '', body = String(note || '');
    body = body.replace(/【可执行任务】[。.]?\s*\n?([\s\S]*)$/, function (_, x) { tasks = x.trim(); return ''; });
    var pm = body.match(/^\s*【要点】[。.]?\s*\n?([\s\S]*?)(?:\n\s*\n|$)/);
    if (pm) { points = pm[1].split('\n').map(txClean).filter(Boolean).map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n'); body = body.slice(pm[0].length); }
    body = body.replace(/【要点】[。.]?/g, '').split('\n').map(function (l) { return l.replace(/^(\s*)(?:\d+\s*[.、．]\s*){2,}/, '$1'); }).join('\n').trim();
    return { points: points, body: body, tasks: tasks };
  }
  function txJoin(points, body, tasks) { return ((points ? '【要点】\n' + points + '\n\n' : '') + body + (tasks ? '\n\n【可执行任务】\n' + tasks : '')).trim().slice(0, 2000); }
  function txSnap() { if (!tx.hist) tx.hist = []; tx.hist.push({ note: tx.note, tags: tx.tags.slice() }); if (tx.hist.length > 20) tx.hist.shift(); }
  function txPersist() { try { localStorage.setItem('tm_txdraft', JSON.stringify({ title: tx.title, note: tx.note, tags: tx.tags, ai: tx.ai })); } catch (e) {} }
  var TX_TAGS = [['事工', 'book'], ['团队', 'team'], ['教育', 'grad'], ['运营', 'ops'], ['关怀', 'heart'], ['创意', 'bulb'], ['产品', 'mon'], ['重要', 'crown'], ['待讨论', 'timer']];
  function txIcons() { AI2.book = TGI['学习']; AI2.heart = TGI['事工']; AI2.grad = PI.research; AI2.mon = '<rect x="3.5" y="4.5" width="17" height="12" rx="2"/><path d="M8 20h8M12 16.5V20"/>'; AI2.crown = '<path d="M3.5 8.5l4.5 4 4-6.5 4 6.5 4.5-4-2 10h-13z"/>'; }
  var TPL = [['结构', '【背景】\n【想解决什么】\n【希望的结果】']];
  function viewNewText() {
    txIcons();
    return vrHero('WRITE YOUR IDEA', '文字输入', '把你的想法写下来，AI 会帮你整理。') +
      '<section class="cx-card cx-editor"><div class="cx-eh">' + ai2('edit', 1.7) + '<input type="text" data-cap="tx.title" maxlength="50" placeholder="在这里输入你的想法..." value="' + esc(tx.title) + '"><button class="cx-exp" data-do="txExpand" aria-label="展开">' + ni('expand', 1.7) + '</button></div>' +
      '<textarea data-cap="tx.note" rows="' + (tx.big ? 14 : 7) + '" maxlength="2000" placeholder="比如：&#10;明年我们想在清迈举办一个面向华人家庭的亲子营，&#10;主要是结合信仰教育、英语学习和户外活动，&#10;时间大概是暑假，先初步规划一下……">' + esc(tx.note) + '</textarea>' +
      (tx.files.length ? '<div class="cx-files">' + tx.files.map(function (f, i) { return '<span>' + esc(f.name) + '<button data-do="txRmFile" data-i="' + i + '" aria-label="移除">' + ai2('x', 2) + '</button></span>'; }).join('') + '</div>' : '') +
      '<div class="cx-tools"><label aria-label="添加图片">' + pi('img') + '<input type="file" accept="image/*" multiple data-txfile="1"></label><label aria-label="添加附件">' + pi('clip') + '<input type="file" multiple data-txfile="1"></label><button data-do="txAt" aria-label="提到同事">' + ai2('at', 1.7) + '</button><i></i><button data-do="txMic" class="' + (tx.listening ? 'on' : '') + '" aria-label="语音输入">' + ni('mic', 1.7) + '</button><span class="n-cnt" id="cc-tx-note">' + tx.note.length + '/2000</span></div>' +
      '<span class="n-cnt" id="cc-tx-title" hidden>' + tx.title.length + '/50</span></section>' +
      '<div class="cx-sh"><b>快速添加标签（可多选）</b><button data-do="txTagMore">管理标签' + hi('chev', 2) + '</button></div>' + tagRow(TX_TAGS, tx.tags, 'txTag').replace('<div class="cx-tags">', '<div class="cx-tags icon">') +
      '<section class="cx-card cx-ai"><div class="vr-ch">' + hi('spark', 1.4) + '<div><b>AI 帮我优化</b><small>自动整理、提炼要点、生成执行建议。</small></div><input type="checkbox" class="me-tog" data-txai="1"' + (tx.ai ? ' checked' : '') + ' aria-label="AI 帮我优化"></div>' +
      (tx.ai ? '<div class="cx-aib"><button data-do="txPolish">' + ai2('doc2', 1.6) + '润色内容</button><button data-do="txPoints">' + ai2('listv', 1.6) + '提炼要点</button><button data-do="txTasks">' + ai2('check', 1.6) + '生成任务</button><button data-do="txClass">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/></svg>' + '推荐分类</button></div>' + (tx.hist && tx.hist.length ? '<button class="cx-undo" data-do="txUndo">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>撤销上一次 AI 优化（还可撤销 ' + tx.hist.length + ' 次）</button>' : '') : '') + '</section>' +
      cxNext('tx', '下一步 · 让 AI 整理这条想法', '内容会暂存在本机，你也可以稍后继续完善。');
  }
  /* 从文件导入 */
  var fi = { title: '', note: '', files: [], link: '' };
  function recentFiles() { S.fileRecent = S.fileRecent || [{ name: '清迈事工分享.mp4', size: '68.2 MB', at: Date.now() - 3600000 * 2, kind: 'video', demo: true }, { name: '2026 年宣教计划方案.pdf', size: '1.4 MB', at: Date.now() - 864e5 * 3, kind: 'file', demo: true }, { name: '团队周会纪要.docx', size: '231 KB', at: Date.now() - 864e5 * 5, kind: 'file', demo: true }]; return S.fileRecent; }
  function viewNewFile() {
    var rf = recentFiles();
    var opt2 = function (icon, b, sm, inner) { return '<label class="cx-opt"' + (inner ? '' : '') + '><span>' + icon + '</span><b>' + b + '</b><small>' + sm + hi('chev', 2) + '</small>' + (inner || '') + '</label>'; };
    var FOLDER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8a2.5 2.5 0 0 1 2.5-2.5h3.2l2 2.2H18A2.5 2.5 0 0 1 20.5 10.2v7.3A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M12 17v-6M9.5 13.3L12 11l2.5 2.3"/></svg>';
    return vrHero('IMPORT FILES', '从文件导入', '选择文件，AI 会帮你提取内容并转化为想法。') +
      '<section class="cx-card cx-up"><label class="cx-drop" data-drop="fi"><span class="cx-dropic sq">' + FOLDER + '</span><b>拖拽文件到这里</b><small>或点击下方方式选择文件</small><em>支持 PDF、Word、Excel、PPT、TXT、图片、视频等常见格式<br>（单个文件不超过 2GB）</em><input type="file" multiple data-fifile="1"></label>' +
      '<div class="cx-opts">' + opt2(FILEIN, '本地文件', '从手机选择', '<input type="file" multiple data-fifile="1">') + opt2('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/></svg>', '拍照上传', '拍照或扫描', '<input type="file" accept="image/*" capture="environment" data-fifile="1">') +
      '<button class="cx-opt" data-do="fiLinkSheet"><span>' + pi('clip') + '</span><b>链接导入</b><small>粘贴网页链接' + hi('chev', 2) + '</small></button><button class="cx-opt" data-do="fiCloud"><span>' + CLOUD.replace('M12 12v8M9 15l3-3 3 3', '') + '</span><b>云端文件</b><small>来自云盘' + hi('chev', 2) + '</small></button></div></section>' +
      (fi.files.length ? '<section class="cx-card"><div class="cx-sh in"><b>已选择（' + fi.files.length + '）</b><button data-do="fiClear">清空</button></div>' + fi.files.map(function (f, i) { return fileRow(f, '<button class="cx-x" data-do="fiRm" data-i="' + i + '" aria-label="移除">' + ai2('x', 2) + '</button>'); }).join('') +
        '<div class="cx-meta"><input class="cx-in" type="text" data-cap="fi.title" maxlength="50" placeholder="标题（可不填，AI 会起）" value="' + esc(fi.title) + '"><textarea class="cx-in" data-cap="fi.note" rows="3" maxlength="1000" placeholder="补充说明（导入的文字会出现在这里）">' + esc(fi.note) + '</textarea></div></section>' : '') +
      '<section class="cx-card"><div class="cx-sh in"><b>最近文件</b><button data-do="fiRecentAll">查看全部' + hi('chev', 2) + '</button></div>' + rf.slice(0, 3).map(function (f, i) { return fileRow(f, hi('chev', 2), 'data-do="fiRecent" data-i="' + i + '"'); }).join('') + '</section>' +
      (fi.files.length ? cxNext('fi', '下一步 · 让 AI 提取内容', '') : '<label class="vr-next cx-choose">' + FILEIN + '选择文件<input type="file" multiple data-fifile="1"></label>') +
      '<p class="c-hint cx-priv">' + ti('lock', 1.6) + '你的文件仅用于内容提取，演示版不会上传。</p>';
  }
  function fileRow(f, right, attrs) {
    var b = f.localId && blobUrl(f.localId);
    var th = b && f.kind === 'image' ? '<img src="' + b + '" alt="">' : b && f.kind === 'video' ? '<video src="' + b + '#t=0.5" muted playsinline preload="metadata"></video>' : f.kind === 'video' ? '<i class="cx-vth"></i>' : f.kind === 'link' ? pi('clip') : ai2('doc2', 1.6);
    return '<div class="cx-frow"' + (attrs ? ' role="button" tabindex="0" ' + attrs : '') + '><span class="cx-fth">' + th + '</span><span class="cx-fi"><b>' + esc(f.name) + '</b><small>' + esc((f.size ? f.size + ' · ' : '') + (f.at ? whenTxt(f.at) : f.read ? '已读取文字' : '')) + (f.demo ? ' · 示例' : '') + '</small></span>' + right + '</div>';
  }
  function capData(k) {
    if (k === 'vo') return { title: vo.title, note: vo.text, media: vo.clips.slice(), tags: (vo.tags || []).slice() };
    if (k === 'cam') return { title: cam.title, note: cam.note, media: cam.clips.map(function (m) { return { kind: 'video', name: m.name, localId: m.localId, durationSec: m.durationSec }; }), tags: cam.tags.slice() };
    if (k === 'fi') return { title: fi.title, note: fi.note, media: fi.files.map(function (f) { return { kind: f.kind, name: f.name, localId: f.localId }; }) };
    if (k === 'tx') return { title: tx.title, note: tx.note, media: tx.files.slice(), tags: tx.tags.slice() };
    return { title: tx.title, note: tx.note, media: tx.files.slice() };
  }
  function capReset(k) { if (k === 'fi') { fi = { title: '', note: '', files: [], link: '' }; return; } if (k === 'vo') vo.clips = [], vo.text = '', vo.title = '', vo.tags = []; else if (k === 'cam') cam.clips = [], cam.title = '', cam.note = '', cam.tags = []; else { tx = { title: '', note: '', files: [], tags: [], ai: true, big: false }; try { localStorage.removeItem('tm_txdraft'); } catch (e) {} } }
  function capCreate(k, go) {
    if (k === 'vo' && (vo.state === 'rec' || vo.state === 'pause')) return toast('请先完成录音', true);
    var d = capData(k), u = TM.user(S, me), dept = (u.roles.find(function (a) { return a.dept; }) || {}).dept || null;
    var r = TM.act(S, me, 'idea.create', { title: d.title, note: d.note, dept: dept, media: d.media, tags: d.tags || [] });
    if (!r.ok) return toast(k === 'vo' && !d.media.length ? '请先录一段，或在「识别的文字」里写点内容' : k === 'cam' && !d.media.length && !d.note ? '请先选择一个视频，或写点说明' : r.error, true);
    save(); capReset(k);
    navFinish('#/idea/' + r.id);
    if (go) setTimeout(function () { submitSheet(r.id); }, 60); else toast('已保存为私人草稿');
  }
  var CAP = {
    pickMode: function (el) { draft.mode = el.dataset.m; location.hash = '#/new/' + el.dataset.m; },
    capSave: function (el) { capCreate(el.dataset.k, false); },
    aitEdit: function (el) {
      var k = el.dataset.k, o = capObj(k), sug = TM.aiTitle(capData(k));
      openSheet('想法标题', field('标题', '<input type="text" name="title" maxlength="30" value="' + esc(sug) + '" required>', 'AI 根据内容拟的标题，可以直接改，30 字以内。'), '用这个标题', function (r) {
        var t = String(r.title || '').trim().slice(0, 30); if (!t) return toast('标题不能为空', true);
        o.title = t === sug ? '' : t; if (o === tx) txPersist(); closeSheet(); render(); toast(t === sug ? '保留 AI 拟题' : '标题已更新');
      });
    },
    capNext: function (el) { capCreate(el.dataset.k, true); },
    capRmClip: function (el) { (el.dataset.k === 'vo' ? vo.clips : cam.clips).splice(+el.dataset.i, 1); render(); },
    txTpl: function (el) { var t = TPL[+el.dataset.i][1]; tx.note = (tx.note + (tx.note && !/\n$/.test(tx.note) ? '\n' : '') + t).slice(0, 1000); render(); var ta = document.querySelector('[data-cap="tx.note"]'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } },
    fiRm: function (el) { fi.files.splice(+el.dataset.i, 1); render(); },
    fiLink: function () { var u = (fi.link || '').trim(); if (!/^https?:\/\/\S+\.\S+/.test(u)) return toast('请输入以 http 开头的完整链接', true); fi.files.push({ kind: 'link', name: u }); fi.note = (fi.note + (fi.note ? '\n' : '') + '参考链接：' + u).slice(0, 1000); fi.link = ''; render(); },
    camTag: function (el) { var t = el.dataset.t, i = cam.tags.indexOf(t); if (i >= 0) cam.tags.splice(i, 1); else if (cam.tags.length < 5) cam.tags.push(t); else toast('最多 5 个标签', true); closeSheet(); render(); },
    camTagMore: function () { openSheet('更多标签', '<div class="t-tagpick">' + VID_TAGS.map(function (x) { return x[0]; }).concat(VID_MORE).map(function (t) { return '<button type="button" class="' + (cam.tags.indexOf(t) >= 0 ? 'on' : '') + '" data-do="camTag" data-t="' + t + '">' + t + '</button>'; }).join('') + '</div>', '完成', function () { closeSheet(); render(); }); },
    txTag: function (el) { var t = el.dataset.t, i = tx.tags.indexOf(t); if (i >= 0) tx.tags.splice(i, 1); else if (tx.tags.length < 5) tx.tags.push(t); else toast('最多 5 个标签', true); txPersist(); closeSheet(); render(); },
    txTagMore: function () { openSheet('管理标签', '<div class="t-tagpick">' + TX_TAGS.map(function (x) { return x[0]; }).concat(['宣教', '活动', '培训', '探访', '媒体']).map(function (t) { return '<button type="button" class="' + (tx.tags.indexOf(t) >= 0 ? 'on' : '') + '" data-do="txTag" data-t="' + t + '">' + t + '</button>'; }).join('') + '</div><p class="muted" style="font-size:13px">最多选 5 个。</p>', '完成', function () { closeSheet(); render(); }); },
    txExpand: function () { tx.big = !tx.big; render(); },
    txAt: function () { var us = TM.activeUsers(S).filter(function (u) { return u.id !== me; }); openSheet('提到同事', '<div class="as-plist">' + us.map(function (u) { return '<label class="as-pi"><input type="radio" name="u" value="' + u.id + '">' + av(u.id, true) + '<span><b>' + esc(u.name) + '</b><small>' + esc(u.title) + '</small></span></label>'; }).join('') + '</div>', '插入', function (o) { var u = TM.user(S, o.u); if (!u) return toast('请选择一位同事', true); tx.note = (tx.note + (tx.note && !/\s$/.test(tx.note) ? ' ' : '') + '@' + u.name + ' ').slice(0, 2000); txPersist(); closeSheet(); render(); }); },
    txMic: function () {
      if (!SR) return toast('当前浏览器不支持语音输入（安卓 Chrome 支持）', true);
      if (tx.sr) { try { tx.sr.stop(); } catch (e) {} return; }
      try { var r = new SR(); r.lang = 'zh-CN'; r.continuous = true; r.onresult = function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { tx.note = (tx.note + e.results[i][0].transcript + '。').slice(0, 2000); var ta = document.querySelector('[data-cap="tx.note"]'); if (ta) ta.value = tx.note; txPersist(); } }; r.onend = function () { tx.sr = null; tx.listening = false; render(); }; r.start(); tx.sr = r; tx.listening = true; render(); toast('正在听，说完再点一次话筒'); } catch (e) { toast('无法启动语音输入', true); }
    },
    txPolish: function () { var b = txSplit(tx.note); if (!b.body && !b.points) return toast('先写一点内容', true); txSnap(); var body = b.body.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/([^。！？!?…：:，,、；;】\n])\n/g, '$1。\n').replace(/([^。！？!?…：:，,、；;】\s])$/, '$1。').replace(/([，,])\1+/g, '$1').replace(/([。！？!?])[。，,]+/g, '$1').replace(/\n{3,}/g, '\n\n'); var out = txJoin(b.points, body, b.tasks); if (out === tx.note) { tx.hist.pop(); return toast('内容已经很整齐了，不需要再润色'); } tx.note = out; txPersist(); render(); toast('已润色：整理了标点和换行（可撤销）'); },
    txPoints: function () { var b = txSplit(tx.note); var ss = (b.body || b.points.split('\n').map(txClean).join('\n')).split(/[。！？!?\n；;]/).map(function (x) { return txClean(x); }).filter(function (x) { return x.length > 3; }); if (!ss.length) return toast('内容太少，提炼不出要点', true); var pts = ss.slice(0, 5).map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n'); var out = txJoin(pts, b.body, b.tasks); if (out === tx.note) return toast('要点已经是最新的了'); txSnap(); tx.note = out; txPersist(); render(); toast('已提炼要点（可撤销）'); },
    txTasks: function () { var b = txSplit(tx.note); var ts = parseTodos(b.body); if (!ts.length) return toast('没有识别出可执行的事，试着写「谁 + 什么时候 + 做什么」', true); var list = ts.map(function (t) { return '· ' + t.title + (t.people.length ? '（' + t.people.map(function (u) { return nm(u); }).join('、') + '）' : ''); }).join('\n'); var out = txJoin(b.points, b.body, list); if (out === tx.note) return toast('任务建议已经是最新的了'); txSnap(); tx.note = out; txPersist(); render(); toast('已生成 ' + ts.length + ' 条任务建议（可撤销）'); },
    txUndo: function () { var h = tx.hist && tx.hist.pop(); if (!h) return toast('没有可以撤销的操作'); tx.note = h.note; tx.tags = h.tags; txPersist(); render(); toast('已撤销上一次 AI 优化'); },
    txClass: function () { var t2 = tx.title + tx.note, rec = []; [['事工', /事工|教会|福音|宣教|祷告|灵修/], ['团队', /团队|同工|分工/], ['教育', /教育|学习|课程|培训|英语/], ['运营', /运营|推广|数据|流程|预算|场地|活动|采购/], ['关怀', /关怀|探访|家庭|照顾/], ['创意', /创意|点子|设计|想法/], ['产品', /App|产品|功能|系统|网站/], ['重要', /紧急|重要|务必/]].forEach(function (x) { if (x[1].test(t2) && rec.length < 3) rec.push(x[0]); }); if (!rec.length) return toast('没找到明显的分类，可以手动选', true); var add = rec.filter(function (r2) { return tx.tags.indexOf(r2) < 0; }); if (!add.length) return toast('推荐分类已经选上了：' + rec.join('、')); txSnap(); add.forEach(function (r2) { if (tx.tags.length < 5) tx.tags.push(r2); }); txPersist(); render(); toast('推荐分类：' + rec.join('、') + '（已选中，可撤销）'); },
    fiLinkSheet: function () { openSheet('链接导入', field('网页链接', '<input type="text" inputmode="url" name="u" placeholder="https://">', '演示版会把链接记进说明，不会抓取网页内容。'), '添加', function (o) { fi.link = o.u || ''; DO.fiLink(); closeSheet(); render(); }); },
    fiCloud: function () { toast('暂不支持直接从云盘导入：先把文件下载到手机，再点「选择文件」', true); },
    fiClear: function () { fi = { title: '', note: '', files: [], link: '' }; render(); },
    fiRecent: function (el) { var f = recentFiles()[+el.dataset.i]; if (fi.files.some(function (x) { return x.name === f.name; })) return toast('已在选择列表里'); fi.files.push({ kind: f.kind, name: f.name, size: f.size, demo: f.demo, localId: f.localId }); render(); toast('已添加「' + f.name + '」'); },
    fiRecentAll: function () { var rf = recentFiles(); openSheet('最近文件', rf.map(function (f, i) { return fileRow(f, hi('chev', 2), 'data-do="fiRecent" data-i="' + i + '"'); }).join(''), '关闭', function () { closeSheet(); }); },
    txRmFile: function (el) { tx.files.splice(+el.dataset.i, 1); render(); }
  };
  var mustAsked = false;
  /* 真实团队（老板刚创建）第一天：三步开始 */
  var onboardAsked = false;
  function onboardSteps() { return [
    ['members', '添加成员并分派账号', '让同事用自己的账号登录', S.users.length > 1, '#/team'],
    ['direction', '填写公司方向', 'AI 整理想法时会参考', !!(S.settings.direction || '').trim(), '#/settings'],
    ['idea', '记录第一个想法', '说一段话、拍个视频或写几句', S.ideas.length > 0, '#/new']
  ]; }
  function onboardDone() { try { if (localStorage.getItem('tm_onboard_' + me) === '1') return true; } catch (e) {} return onboardSteps().every(function (x) { return x[3]; }); }

  function afterRender() {
    markChecked(); flexGapFix(document.getElementById('app'));
    if (SRV && me && TMS.mustChange && !mustAsked && !document.querySelector('#layer .sheet')) { mustAsked = true; setTimeout(function () { DO.srvPassword(); }, 300); }
    if (SRV && me && isOwner() && S.real && !S.loading && cur().name === 'home' && !onboardAsked && !document.querySelector('#layer .sheet') && !onboardDone()) { onboardAsked = true; setTimeout(function () { DO.onboard(); }, 400); }
    var strip = document.getElementById('tkdays');
    if (strip) { if (td.stripScroll != null) strip.scrollLeft = td.stripScroll; else { var tg = strip.querySelector('.today') || strip.querySelector('.on'); if (tg) strip.scrollLeft = tg.offsetLeft - strip.firstElementChild.offsetLeft; } strip.onscroll = function () { td.stripScroll = strip.scrollLeft; }; }
    document.querySelectorAll('video[data-vmeta]').forEach(function (v) { v.onloadedmetadata = function () { var m = cam.clips[+v.dataset.vmeta]; if (m && !m.durationSec && isFinite(v.duration)) { m.durationSec = Math.round(v.duration); render(); } }; });
  }
  document.addEventListener('wheel', function (e) { var r = e.target.closest && e.target.closest('.np-types, .tk-days'); if (r && Math.abs(e.deltaY) > Math.abs(e.deltaX) && r.scrollWidth > r.clientWidth) { r.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  (function () { var dr = null; document.addEventListener('mousedown', function (e) { var r = e.target.closest && e.target.closest('.np-types, .tk-days'); if (r) dr = { r: r, x: e.clientX, l: r.scrollLeft, moved: false }; }); document.addEventListener('mousemove', function (e) { if (!dr) return; var dx = e.clientX - dr.x; if (Math.abs(dx) > 4) dr.moved = true; dr.r.scrollLeft = dr.l - dx; }); document.addEventListener('mouseup', function () { if (dr && dr.moved) { var stop = function (ev) { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click', stop, true); }; document.addEventListener('click', stop, true); setTimeout(function () { document.removeEventListener('click', stop, true); }, 0); } dr = null; }); })();
  ['dragover', 'drop'].forEach(function (ev2) { document.addEventListener(ev2, function (e) { var z = e.target.closest && e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); if (ev2 === 'drop' && e.dataTransfer && e.dataTransfer.files.length) { if (z.dataset.drop === 'cam') addVideos(e.dataTransfer.files); else addFiles(e.dataTransfer.files); } }); });
  /* ---------- 今日待办（任务 Tab）+ 新建待办（手动 / AI） ---------- */
  var td = { day: null, filter: 'all', view: 'list', showDone: false };
  var WK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function dayInfo(off) { var d = new Date(); d.setDate(d.getDate() + off); var ds = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); return { ds: ds, name: off === 0 ? '今天' : off === 1 ? '明天' : WK[d.getDay()], md: (d.getMonth() + 1) + '/' + d.getDate() }; }
  function relDay(ds) { var n = dayDiff(ds); if (n == null) return ''; if (n < 0) return '逾期'; if (n === 0) return '今天'; if (n === 1) return '明天'; if (n === 2) return '后天'; if (n < 7) { var p = ds.split('-'); return WK[new Date(+p[0], p[1] - 1, +p[2]).getDay()]; } var q = ds.split('-'); return +q[1] + '月' + +q[2] + '日'; }
  var TAGC = { '高优先级': 'k-red', '想法': 'k-blue', '会议': 'k-violet', '决策': 'k-violet', '沟通': 'k-green', '数据': 'k-violet', '个人成长': 'k-orange', '事工': 'k-orange', '工作': 'k-blue', '学习': 'k-green', '内容': 'k-violet', '活动': 'k-green', '运维': 'k-gray', '产品': 'k-blue', '行政': 'k-green', '事项': 'k-blue', '任务': 'k-blue', '运营': 'k-green' };
  function unified() {
    TM.ensureTodos(S);
    var out = S.todos.filter(function (t) { return t.ownerId === me || t.people.indexOf(me) >= 0; }).map(function (t) {
      var mineT = t.ownerId === me, ppl = (mineT ? t.people : [t.ownerId].concat(t.people.filter(function (x) { return x !== me; })));
      return { key: t.id, own: mineT, personal: true, id: t.id, title: t.title, tags: (t.priority === 'hi' ? ['高优先级'] : []).concat(t.tags), prio: t.priority, date: t.date, time: t.time, comments: t.comments.length, people: ppl, done: t.done, doneAt: t.doneAt,
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
    '事项': '<path d="M3.8 8.2a2.7 2.7 0 0 1 2.7-2.7h3l2 2.2h6a2.7 2.7 0 0 1 2.7 2.7v6.9a2.7 2.7 0 0 1-2.7 2.7h-11a2.7 2.7 0 0 1-2.7-2.7z"/>',
    '任务': '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.6 12.2l2.3 2.3 4.6-4.8"/>',
    '待办': '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.4 2.4 4.6-5"/>'
  };
  function tagIcon(g) {
    var path = TGI[g] || '<path d="M3.5 12V5a1.5 1.5 0 0 1 1.5-1.5h7l8.5 8.5-8.5 8.5z"/><circle cx="8" cy="8" r="1.3"/>';
    return '<i class="tg' + (g === '高优先级' ? ' tg-hi' : '') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>' + esc(g) + '</i>';
  }
  var TACC = { '高优先级': ['#F0475A', 'c-hi'], '决策': ['#9AA3B2', 'c-gray'], '沟通': ['#9AA7BC', 'c-slate'], '数据': ['#C9D0DA', 'c-gray'], '个人成长': ['#E8C48C', 'c-amber'], '事工': ['#E8C48C', 'c-amber'], '想法': ['#C6BEF3', 'c-lav'], '会议': ['#AFC3E8', 'c-slate'], '工作': ['#AFC3E8', 'c-slate'], '学习': ['#B9DCC8', 'c-mint'], '内容': ['#C6BEF3', 'c-lav'], '活动': ['#B9DCC8', 'c-mint'], '运维': ['#C9D0DA', 'c-gray'], '产品': ['#AFC3E8', 'c-slate'], '行政': ['#B9DCC8', 'c-mint'], '事项': ['#AFC3E8', 'c-slate'], '任务': ['#AFC3E8', 'c-slate'], '待办': ['#C9D0DA', 'c-gray'] };
  function tagChip(g) { var c = TACC[g] || ['#C9D0DA', 'c-gray']; return '<i class="tg2 ' + c[1] + (g === '高优先级' ? ' tg-hi' : '') + '"><em style="background:' + c[0] + '"></em>' + esc(g) + '</i>'; }
  function tdCard(x) {
    var circle = x.personal && x.own ? '<button class="t-chk' + (x.done ? ' on' : '') + '" data-do="tdToggle" data-id="' + x.id + '" aria-label="' + (x.done ? '标为未完成' : '标为完成') + '"></button>' : '<span class="t-chk' + (x.done ? ' on' : '') + (x.sys ? ' sys' : '') + '" aria-hidden="true"></span>';
    var red = x.prio === 'hi' && !x.done && (relDay(x.date) === '今天' || relDay(x.date) === '逾期');
    var main = x.tags.filter(function (g) { return g !== '高优先级'; })[0] || '待办', acc = x.prio === 'hi' ? TACC['高优先级'][0] : (TACC[main] || ['#C9D0DA'])[0];
    return '<div class="t-card tk2-card' + (x.done ? ' done' : '') + (x.prio === 'hi' && !x.done ? ' hot' : '') + '">' + circle + '<span class="tk2-bar" style="background:' + acc + '"></span><' + (x.sys ? 'a href="' + x.href + '"' : 'button type="button" data-do="tdOpen" data-id="' + x.id + '"') + ' class="t-main"><span class="tk-l"><b>' + esc(x.title) + '</b><span class="t-tags">' + x.tags.slice(0, 3).map(tagChip).join('') +
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
      field('备注', '<textarea name="note" rows="2">' + esc(t.note) + '</textarea>') : '<div class="lead" style="font-size:18px">' + esc(t.title) + '</div><p class="muted">' + esc(nm(t.ownerId)) + ' 的待办，' + esc(tdTime({ date: t.date, time: t.time })) + '</p>') +
      (t.people.length ? '<div class="fld"><span>相关人</span><div class="who">' + t.people.map(function (u) { return '<label style="cursor:default">' + av(u, true) + esc(nm(u)) + '</label>'; }).join('') + '</div></div>' : '') +
      '<div class="fld"><span>评论 ' + t.comments.length + '</span>' + t.comments.map(function (c) { return '<div class="sug"><div class="h">' + av(c.by, true) + '<b>' + esc(nm(c.by)) + '</b><span>' + ago(c.at) + '</span></div><p class="b">' + esc(c.body) + '</p></div>'; }).join('') +
      '<div class="row2 mt"><input type="text" id="tdc" placeholder="写评论"><button type="button" class="btn" style="flex:0 0 auto" data-do="tdComment" data-id="' + t.id + '">发送</button></div></div>' +
      (own ? '<button type="button" class="btn danger block mt" data-do="tdDelete" data-id="' + t.id + '">删除待办</button>' : ''), own ? '保存' : '关闭',
      function (o) { if (!own) return closeSheet(); act('todo.update', { id: t.id, title: o.title, date: o.date, time: o.time, priority: o.priority, note: o.note }, '已保存'); });
  }
  /* 新建待办：入口 */
  var TPLS = [
    { key: 'work', name: '工作任务', sub: '项目 / 任务 / 执行', icon: 'bag', c: 'c-blue', tags: ['工作'], scope: 'mine' },
    { key: 'meeting', name: '会议纪要', sub: '讨论 / 决策 / 跟进', icon: 'team', c: 'c-indigo', tags: ['会议'], scope: 'team', note: '【讨论】\n【决策】\n【跟进】', title: '会议纪要：' },
    { key: 'study', name: '学习计划', sub: '课程 / 阅读 / 练习', icon: 'grad', c: 'c-teal', tags: ['学习'], scope: 'mine' },
    { key: 'content', name: '内容创作', sub: '文案 / 视频 / 设计', icon: 'brush', c: 'c-pink', tags: ['内容'], scope: 'mine' },
    { key: 'personal', name: '个人事项', sub: '生活 / 健康 / 其他', icon: 'person', c: 'c-orange', tags: ['个人成长'], scope: 'other' },
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
    if (m && d == null) { var map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 }, target = map[m[2]], cur = base.getDay(); var diff = (target - cur + 7) % 7; if (m[1] === '下周') diff += 7; else if (diff === 0) diff = 0; d = diff; }
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
    tdToggle: function (el) { var r = TM.act(S, me, 'todo.toggle', { id: el.dataset.id }); if (!r.ok) return toast(r.error, true); save(); var t = S.todos.find(function (x) { return x.id === el.dataset.id; }); toast(t && t.done ? '已完成' : '已恢复为未完成'); render(); },
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
  /* ---------- 分配任务：手动分配 / AI 智能分配 ---------- */
  var TTYPE = [['开发', 'code'], ['设计', 'palette'], ['产品', 'search'], ['运营', 'chat'], ['测试', 'bug'], ['文档', 'doc2'], ['其他', 'flagO']];
  var AI2 = {
    code: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9.5 10l-2 2 2 2M14.5 10l2 2-2 2"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.5-1-2.6 0-1 .8-1.7 1.8-1.7h2.2a3.7 3.7 0 0 0 3.7-3.7C20.5 6.6 16.7 3.5 12 3.5z" fill="currentColor" stroke="none"/><circle cx="8" cy="11" r="1.2" fill="#fff" stroke="none"/><circle cx="10.5" cy="7.5" r="1.2" fill="#fff" stroke="none"/><circle cx="14.5" cy="7.5" r="1.2" fill="#fff" stroke="none"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8.5 11a2.5 2.5 0 0 1 2.5-2.5"/>', chat: '<path d="M4.5 12a7.5 7.5 0 1 1 3.4 6.3L4 19.5l1.2-3.6A7.4 7.4 0 0 1 4.5 12z"/><path d="M8.5 13.5c1.8 1.6 5.2 1.6 7 0"/>',
    bug: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>', doc2: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M9.5 12h6M9.5 15.5h6"/>',
    flagO: '<path d="M5.5 21V4.5"/><path d="M5.5 5h11l-2 3.5 2 3.5h-11"/>', cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8.5 3v3.5M15.5 3v3.5"/>',
    q: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.1-2.4 3.6M12 17v.1"/>', x: '<path d="M7 7l10 10M17 7L7 17"/>', proj: '<rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" stroke="none"/><path d="M8.5 12l2.5 2.5 4.5-5" stroke="#fff"/>',
    refresh: '<path d="M19 12a7 7 0 1 1-2.1-5M19 4v4h-4"/>', edit: '<path d="M4.5 19.5l1-4.2L15.8 5a2.1 2.1 0 0 1 3 3L8.6 18.4z"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
    up: '<path d="M6 15l6-6 6 6"/>', downc: '<path d="M6 9l6 6 6-6"/>', robot: '', timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 3h5"/>', ctx: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'
  };
  function ai2(k, sw) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (AI2[k] || TI[k] || PI[k] || NI[k] || HI[k]) + '</svg>'; }
  var ROBOT = '<svg viewBox="0 0 160 140" aria-hidden="true"><defs><radialGradient id="rbg" cx="40%" cy="30%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#DCD7FF"/></radialGradient><linearGradient id="rvis" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A2F5E"/><stop offset="1" stop-color="#151935"/></linearGradient></defs><ellipse cx="82" cy="128" rx="46" ry="8" fill="#B9AEF5" opacity=".35"/><rect x="48" y="86" width="64" height="40" rx="18" fill="url(#rbg)"/><circle cx="80" cy="56" r="40" fill="url(#rbg)"/><rect x="50" y="38" width="60" height="38" rx="19" fill="url(#rvis)"/><circle cx="68" cy="56" r="5.5" fill="#6FA8FF"/><circle cx="92" cy="56" r="5.5" fill="#6FA8FF"/><path d="M73 66c4 3.5 10 3.5 14 0" stroke="#6FA8FF" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="36" y="48" width="10" height="20" rx="5" fill="#C9C0FF"/><rect x="114" y="48" width="10" height="20" rx="5" fill="#C9C0FF"/><circle cx="80" cy="14" r="5" fill="#B9AEF5"/><path d="M80 18v6" stroke="#B9AEF5" stroke-width="3"/></svg>';
  var asg = null;
  function myWorks() { return S.workItems.filter(function (w) { return ['planning', 'active', 'acceptance', 'blocked'].indexOf(w.status) >= 0 && (w.leadId === me || w.operatorId === me || isOwner()); }); }
  function freshAsg(wid) { var ws = myWorks(), w = (wid && ws.find(function (x) { return x.id === wid; })) || ws[0]; return { tab: 'manual', title: '', desc: '', workId: w ? w.id : '', ttype: w && w.kind === 'product' ? '设计' : '其他', priority: 'mid', due: TM.dateAdd(S, 4), dueSet: false, milestone: false, ownerId: '', collabs: [], pick: '', aiCollabs: null, more: false, seed: 0 }; }
  function canAssign() { return myWorks().length > 0; }
  function fullDate(ds) { if (!ds) return '未设置'; var p = ds.split('-'), d = new Date(+p[0], p[1] - 1, +p[2]); return p[0] + '年' + +p[1] + '月' + +p[2] + '日 ' + WK[d.getDay()]; }
  function asgPeople() { return TM.activeUsers(S).filter(function (u) { return u.roles.some(function (a) { return a.role === 'executor' || a.role === 'lead' || a.role === 'operator'; }); }).map(function (u) { return u.id; }); }
  var SKILL = { '设计': /设计|UI/, '开发': /开发/, '测试': /开发|测试/, '产品': /负责人|产品/, '运营': /运营/, '文档': /./, '其他': /./ };
  function scoreOf(uid) {
    var u = TM.user(S, uid), w = W(asg.workId) || {}, rx = SKILL[asg.ttype] || /./;
    var role = asg.ttype === '产品' ? TM.hasRole(S, uid, 'lead') : asg.ttype === '运营' ? TM.hasRole(S, uid, 'operator') : rx.test(u.title);
    var generic = asg.ttype === '文档' || asg.ttype === '其他';
    var sameDept = w.dept && u.roles.some(function (a) { return a.dept === w.dept; });
    var load = S.tasks.filter(function (t) { return t.ownerId === uid && ['assigned', 'accepted', 'in_progress', 'blocked', 'submitted'].indexOf(t.status) >= 0; }).length;
    var hist = S.tasks.filter(function (t) { return t.ownerId === uid && t.status === 'done' && (t.ttype ? t.ttype === asg.ttype : (W(t.workId) || {}).kind === w.kind); }).length;
    var pct = Math.round(52 + (role ? 30 : generic ? 16 : 4) + (sameDept ? 8 : 0) - Math.min(load, 4) * 5 + Math.min(hist, 3) * 4 + ((asg.seed * 7 + uid.length * 3) % 5));
    pct = Math.max(35, Math.min(96, pct));
    var why = [];
    why.push(role ? '擅长' + (asg.ttype === '设计' ? '视觉与 UI 设计' : asg.ttype === '开发' ? '开发实现' : asg.ttype === '产品' ? '产品规划与验收' : asg.ttype === '运营' ? '运营推进' : asg.ttype + '工作') : generic ? '可承担' + asg.ttype + '类工作' : '与' + asg.ttype + '方向不完全匹配');
    why.push(load === 0 ? '当前没有进行中的任务' : load === 1 ? '当前有 1 个进行中任务' : '当前有 ' + load + ' 个进行中任务' + (load >= 3 ? '，负载偏高' : ''));
    why.push(hist ? '有 ' + hist + ' 个相似任务完成记录' : sameDept ? '在本项目所属部门' : '暂无相似任务记录');
    return { uid: uid, pct: pct, load: load, why: why.join('，') + '。' };
  }
  function ranked() { return asgPeople().map(scoreOf).sort(function (a, b) { return b.pct - a.pct; }); }
  function estDays(uid) { var base = { '开发': 5, '设计': 3, '产品': 3, '运营': 2, '测试': 2, '文档': 2, '其他': 3 }[asg.ttype] || 3; var load = uid ? scoreOf(uid).load : 0; return Math.max(1, base + Math.ceil(load / 2) - (asg.priority === 'hi' ? 1 : 0)); }
  function pRole(uid) { return TM.user(S, uid).title; }
  function viewAssign(wid) {
    if (!canAssign()) return pHead('分配任务', '让合适的人做合适的事') + emptyBox('你目前没有可以分配任务的项目。分配任务由项目负责人、跟进的运营者或老板完成。');
    if (!asg || (wid && asg.workId !== wid && !asg.title)) asg = freshAsg(wid);
    if (asg.ownerId && !TM.live(S, asg.ownerId)) asg.ownerId = ''; // 预选的人已停用
    asg.collabs = (asg.collabs || []).filter(function (c) { return TM.live(S, c); });
    var h = pHead('分配任务', asg.tab === 'manual' ? '让合适的人做合适的事' : '', '<button class="n-ai p-aibtn" data-do="quickAI">' + hi('spark', 1.6) + 'AI 助手</button>') +
      '<div class="as-tabs"><button class="' + (asg.tab === 'manual' ? 'on' : '') + '" data-do="asTab" data-t="manual">' + ti('person', 1.8) + '手动分配</button><button class="' + (asg.tab === 'ai' ? 'on ai' : '') + '" data-do="asTab" data-t="ai">' + hi('spark', 1.6) + 'AI 智能分配</button></div>';
    return h + (asg.tab === 'manual' ? viewAsgManual() : viewAsgAI());
  }
  function viewAsgManual() {
    var w = W(asg.workId);
    return '<section class="p-card as-card"><h3 class="as-h">任务信息</h3>' +
      '<label class="p-fld"><span>任务标题 <em>*</em></span><input type="text" data-as="title" maxlength="50" placeholder="例如：完成 App 首页视觉优化" value="' + esc(asg.title) + '"></label><div class="n-cnt" id="asc-title">' + asg.title.length + '/50</div>' +
      '<label class="p-fld"><span>任务描述</span><textarea data-as="desc" rows="4" maxlength="500" placeholder="写清楚要做什么、做到什么程度。会作为验收标准。">' + esc(asg.desc) + '</textarea></label><div class="n-cnt" id="asc-desc">' + asg.desc.length + '/500</div>' +
      '<div class="as-tools"><button class="ai" data-do="asWrite">' + hi('spark', 1.6) + 'AI 帮我写</button><button data-do="asFromIdea">' + ai2('doc2', 1.7) + '从想法生成</button><button data-do="asTpl">' + ai2('cal', 1.7) + '参考模板</button></div>' +
      '<div class="p-fld"><span>所属项目</span><button class="as-row" data-do="asPickWork"><i class="as-pic">' + ai2('proj', 1.6) + '</i><b>' + esc(w ? w.title : '选择项目') + '</b>' + hi('chev', 2) + '</button></div>' +
      '<div class="p-fld"><span>任务类型</span><div class="as-types">' + TTYPE.map(function (t) { return '<button class="' + (asg.ttype === t[0] ? 'on' : '') + '" data-do="asSet" data-k="ttype" data-v="' + t[0] + '">' + ai2(t[1], 1.7) + t[0] + '</button>'; }).join('') + '</div></div>' +
      '<div class="p-fld"><span>优先级</span><div class="as-pri">' + [['hi', '高', '#F03E50'], ['mid', '中', '#F59E0B'], ['lo', '低', '#7A8394']].map(function (p) { return '<button class="' + (asg.priority === p[0] ? 'on' : '') + '" data-do="asSet" data-k="priority" data-v="' + p[0] + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4" stroke="' + p[2] + '" stroke-width="2.2" stroke-linecap="round"/><path d="M6 4h12l-3 4.5 3 4.5H6z" fill="' + p[2] + '"/></svg>' + p[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="p-fld"><span>截止时间</span><label class="as-row">' + ai2('cal', 1.7) + '<b>' + fullDate(asg.due) + '</b>' + hi('chev', 2) + '<input type="date" data-as="due" value="' + asg.due + '"></label></div>' +
      '<label class="as-switch"><span>设为里程碑任务<button type="button" class="as-q" data-do="asMsHelp" aria-label="什么是里程碑">' + ai2('q', 1.7) + '</button></span><input type="checkbox" data-as="milestone"' + (asg.milestone ? ' checked' : '') + '></label>' +
      '<div class="p-fld"><span>负责人 <em>*</em></span><div class="as-owner">' + (asg.ownerId ? '<span class="as-chip">' + av(asg.ownerId) + '<b>' + esc(nm(asg.ownerId)) + '（' + esc(pRole(asg.ownerId)) + '）</b><button data-do="asClearOwner" aria-label="移除负责人">' + ai2('x', 2) + '</button></span>' : '<button class="as-chip empty" data-do="asPickOwner">选择负责人</button>') + '<button class="as-plus" data-do="asPickOwner" aria-label="选择负责人">' + ti('plus2', 2.2) + '</button></div></div>' +
      '<div class="as-collab"><span>协作者</span><span class="h-stack">' + asg.collabs.map(function (u) { return av(u); }).join('') + '</span><button class="as-plus sm" data-do="asPickCollab" aria-label="添加协作者">' + ti('plus2', 2.2) + '</button></div>' +
      '</section><button class="n-next" data-do="asCreate">创建任务</button>';
  }
  function viewAsgAI() {
    if (!asg.title.trim()) return '<section class="as-hero">' + '<div><h2>让 AI 帮你分配任务</h2><p>基于团队成员的能力、工作负载和历史表现<br>智能推荐最合适的人选</p></div>' + ROBOT + '</section>' + emptyBox('先在「手动分配」里写好任务标题和描述，AI 再为你推荐人选。') + '<button class="n-next" data-do="asTab" data-t="manual">去填写任务</button>';
    var rk = ranked(); if (!asg.pick || !rk.some(function (r) { return r.uid === asg.pick; })) asg.pick = rk[0].uid;
    if (!asg.aiCollabs) asg.aiCollabs = rk.filter(function (r) { return r.uid !== asg.pick; }).slice(0, 3).map(function (r) { return r.uid; });
    var colOpts = TM.activeUsers(S).filter(function (u) { return u.id !== asg.pick && !u.roles.every(function (a) { return a.role === 'admin'; }); }).map(function (u) { return u.id; });
    var colShow = asg.aiCollabs.concat(colOpts.filter(function (u) { return asg.aiCollabs.indexOf(u) < 0; })).slice(0, 3);
    var days = estDays(asg.pick), due = asg.dueSet ? asg.due : TM.dateAdd(S, days);
    var tone = function (p) { return p >= 85 ? 'm-g' : p >= 75 ? 'm-o' : 'm-b'; };
    var lines = asg.desc.split('\n').filter(function (x) { return x.trim(); });
    return '<section class="as-hero"><div><h2>让 AI 帮你分配任务</h2><p>基于团队成员的能力、工作负载和历史表现<br>智能推荐最合适的人选</p><button data-do="asRe">' + ai2('refresh', 2) + '重新推荐</button></div>' + ROBOT + '</section>' +
      '<section class="p-card"><div class="as-ph"><h3>任务预览</h3><button data-do="asTab" data-t="manual">' + ai2('edit', 1.8) + '编辑</button></div><div class="as-prev"><b>' + esc(asg.title) + '</b><span class="t-tags"><i class="k-violet">' + asg.ttype + '</i>' + (asg.priority === 'hi' ? '<i class="k-red">高优先级</i>' : asg.priority === 'mid' ? '<i class="k-gray">中优先级</i>' : '<i class="k-gray">低优先级</i>') + '</span>' +
      (lines.length ? '<ol>' + lines.map(function (l) { return '<li>' + esc(l.replace(/^\d+[.、]\s*/, '')) + '</li>'; }).join('') + '</ol>' : '<p class="muted">没有任务描述。</p>') + '</div>' +
      '<div class="as-ph mt"><h3>AI 推荐人选 ' + ai2('info', 1.7) + '</h3><button data-do="asSet" data-k="more" data-v="' + (asg.more ? '' : '1') + '" aria-label="展开或收起">' + ai2(asg.more ? 'up' : 'downc', 2) + '</button></div><span class="as-basis">' + ai2('ctx', 1.7) + '基于能力匹配 · 当前负载 · 历史表现</span>' +
      rk.slice(0, asg.more ? rk.length : 3).map(function (r) { return '<button class="as-cand' + (asg.pick === r.uid ? ' on' : '') + '" data-do="asPick" data-u="' + r.uid + '">' + av(r.uid) + '<span class="as-cb"><span class="as-cn"><b>' + esc(nm(r.uid)) + '</b><i class="k-gray">' + esc(pRole(r.uid)) + '</i><i class="' + tone(r.pct) + '">匹配度 ' + r.pct + '%</i></span><small><b>推荐理由：</b>' + esc(r.why) + '</small></span><span class="as-radio"></span></button>'; }).join('') +
      (rk.length > 3 ? '<button class="as-more" data-do="asSet" data-k="more" data-v="' + (asg.more ? '' : '1') + '">' + (asg.more ? '收起候选人' : '展开更多候选人') + ai2(asg.more ? 'up' : 'downc', 2) + '</button>' : '') +
      '<h3 class="as-h2">同时推荐协作者</h3><div class="as-cols">' + colShow.map(function (u) { var on = asg.aiCollabs.indexOf(u) >= 0; return '<button class="' + (on ? 'on' : '') + '" data-do="asAiCollab" data-u="' + u + '">' + av(u) + '<span><b>' + esc(nm(u)) + '</b><small>' + esc(pRole(u)) + '</small></span><i>' + (on ? ni('check', 2.6) : '') + '</i></button>'; }).join('') + '</div>' +
      '<div class="as-eta"><small>预计完成时间</small><div>' + ai2('cal', 1.7) + '<b>' + fullDate(due).replace(/ 周.$/, '') + '（' + Math.max(1, (dayDiff(due) || 0)) + '天）</b><span>' + ai2('timer', 1.7) + (asg.dueSet ? '按你设的截止时间' : '按负载与类型估算') + '</span></div></div></section>' +
      '<button class="n-next" data-do="asConfirm">确认分配</button><p class="c-hint">AI 只做推荐，点「确认分配」才会派出任务（演示版推荐由规则计算）。</p>';
  }
  function asgCreate(ownerId, collabs, due, by) {
    var w = W(asg.workId); if (!w) return toast('请选择所属项目', true);
    if (!asg.title.trim()) return toast('请填写任务标题', true);
    if (!ownerId) return toast('请选择负责人', true);
    var r = TM.act(S, me, 'work.plan', { id: w.id, tasks: [{ title: asg.title, description: asg.desc, ttype: asg.ttype, priority: asg.priority, milestone: asg.milestone, ownerId: ownerId, collabs: collabs, due: due, expected: asg.desc.trim() ? '按任务描述交付成果' : '完成「' + asg.title.trim() + '」并提交成果', criteria: asg.desc.trim() || '由验收人确认达到任务要求', assignedBy: by }] });
    if (!r.ok) return toast(r.error, true);
    save(); var wid = w.id; asg = null; navFinish('#/work/' + wid); toast('任务已派出，' + nm(ownerId) + ' 已收到通知');
  }
  var TPL_T = [['设计稿交付', '设计', '1. 按需求完成页面设计；\n2. 与整体风格保持一致；\n3. 输出设计稿并与开发对齐。'], ['功能开发', '开发', '1. 完成功能开发并自测；\n2. 处理边界和异常情况；\n3. 提交可演示的版本。'], ['文档整理', '文档', '1. 收集相关资料；\n2. 整理成结构清晰的文档；\n3. 发给相关同事确认。'], ['活动执行', '运营', '1. 确认时间、地点和人数；\n2. 准备物资并分工；\n3. 活动后提交总结和照片。']];
  function pickSheet(title, ids, sel, multi, onPick) {
    openSheet(title, '<div class="as-plist">' + ids.map(function (u) { var s2 = scoreOf(u); var on = multi ? sel.indexOf(u) >= 0 : sel === u; return '<label class="as-pi">' + '<input type="' + (multi ? 'checkbox' : 'radio') + '" name="p" value="' + u + '"' + (on ? ' checked' : '') + '>' + av(u) + '<span><b>' + esc(nm(u)) + '</b><small>' + esc(pRole(u)) + '，' + (s2.load ? '进行中 ' + s2.load + ' 项' : '空闲') + '</small></span></label>'; }).join('') + '</div>', '确定', function (o) { onPick([].concat(o.p || [])); closeSheet(); render(); });
  }
  var AS = {
    goAssign: function () { if (!canAssign()) return toast('分配任务由项目负责人、跟进的运营者或老板完成', true); asg = freshAsg(); location.hash = '#/assign'; },
    asTab: function (el) { asg.tab = el.dataset.t; render(); window.scrollTo(0, 0); },
    asSet: function (el) { var k = el.dataset.k, v = el.dataset.v; asg[k] = k === 'more' ? !!v : v; if (k === 'ttype' || k === 'priority') { asg.aiCollabs = null; asg.pick = ''; } render(); },
    asWrite: function () {
      if (!asg.title.trim()) return toast('先写任务标题，AI 再帮你写描述', true); var t = asg.title.trim();
      var rule = function () { asg.desc = ('1. 明确「' + t + '」的目标、范围和要求；\n2. 完成' + t.replace(/^完成/, '') + '，与项目整体方案保持一致；\n3. 输出成果并与相关同事对齐、确认。').slice(0, 500); render(); toast('已生成描述（演示：规则模拟）'); };
      if (!AI_ON) return rule();
      // Claude 写：带上项目名称和目标，让描述贴合项目
      var w = W(asg.workId), b = document.querySelector('[data-do=asWrite]'); if (b) { b.disabled = true; b.textContent = 'Claude 正在写…'; }
      TMS.aiWrite('task', t, w ? '所属项目：' + w.title + (w.goal ? '；项目目标：' + w.goal : '') : '', asg.due || '').then(function (r) { asg.desc = String(r.text || '').slice(0, 500); render(); toast('Claude 已写好描述，可以再改'); }, function (e) { toast((e && e.error) || 'AI 暂时不可用，先用规则生成', true); rule(); });
    },
    asFromIdea: function () {
      var xs = vIdeas().filter(function (d) { return d.status !== 'draft' && d.status !== 'declined'; });
      if (!xs.length) return toast('没有可用的想法', true);
      openSheet('从想法生成', '<div class="as-plist">' + xs.map(function (d) { return '<label class="as-pi"><input type="radio" name="i" value="' + d.id + '">' + '<span><b>' + esc(d.title || d.note.slice(0, 20)) + '</b><small>' + esc(L.idea[d.status]) + '</small></span></label>'; }).join('') + '</div>', '使用', function (o) {
        var d = I(o.i); if (!d) return toast('请选择一个想法', true);
        var sm = TM.latestSummary(S, d.id, 'analysis'), p = sm ? sm.payload : {}, st = (p.suggested_tasks || [])[0];
        asg.title = (st ? st.title : d.title || '').slice(0, 50); asg.desc = ([p.background || d.note].concat(st ? ['预期成果：' + st.expected_output, '验收标准：' + st.acceptance_criteria] : [])).filter(Boolean).map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n').slice(0, 500);
        var w = S.workItems.find(function (x) { return x.ideaId === d.id && myWorks().indexOf(x) >= 0; }); if (w) asg.workId = w.id;
        closeSheet(); render(); toast('已从想法填入');
      });
    },
    asTpl: function () { openSheet('参考模板', '<div class="as-plist">' + TPL_T.map(function (t, i) { return '<label class="as-pi"><input type="radio" name="t" value="' + i + '"><span><b>' + t[0] + '</b><small>' + t[1] + '</small></span></label>'; }).join('') + '</div>', '使用', function (o) { var t = TPL_T[+o.t]; if (!t) return toast('请选择模板', true); if (!asg.title.trim()) asg.title = t[0]; asg.ttype = t[1]; asg.desc = t[2]; closeSheet(); render(); }); },
    asPickWork: function () { var ws = myWorks(); openSheet('所属项目', '<div class="as-plist">' + ws.map(function (w) { return '<label class="as-pi"><input type="radio" name="w" value="' + w.id + '"' + (w.id === asg.workId ? ' checked' : '') + '><span><b>' + esc(w.title) + '</b><small>' + (w.ptype || L.kind[w.kind]) + '，' + L.work[w.status] + '</small></span></label>'; }).join('') + '</div>', '确定', function (o) { if (o.w) asg.workId = o.w; closeSheet(); render(); }); },
    asPickOwner: function () { var ids = ranked().map(function (r) { return r.uid; }); pickSheet('选择负责人', ids, asg.ownerId, false, function (v) { asg.ownerId = v[0] || ''; asg.collabs = asg.collabs.filter(function (c) { return c !== asg.ownerId; }); }); },
    asClearOwner: function () { asg.ownerId = ''; render(); },
    asPickCollab: function () { var ids = asgPeople().filter(function (u) { return u !== asg.ownerId; }); pickSheet('选择协作者', ids, asg.collabs, true, function (v) { asg.collabs = v; }); },
    asMsHelp: function () { openSheet('什么是里程碑任务', '<p>里程碑是项目推进中的关键节点，比如「原型评审通过」「正式上线」。标为里程碑后，在项目和操作记录里会特别标注，方便老板和负责人一眼看到关键进展。</p>', '知道了', function () { closeSheet(); }); },
    asCreate: function () { asgCreate(asg.ownerId, asg.collabs, asg.due, 'manual'); },
    asPick: function (el) { asg.pick = el.dataset.u; asg.aiCollabs = (asg.aiCollabs || []).filter(function (u) { return u !== asg.pick; }); render(); },
    asAiCollab: function (el) { var u = el.dataset.u, i = asg.aiCollabs.indexOf(u); if (i >= 0) asg.aiCollabs.splice(i, 1); else asg.aiCollabs.push(u); render(); },
    asRe: function () { asg.seed++; asg.pick = ''; asg.aiCollabs = null; render(); toast('已重新计算推荐'); },
    asConfirm: function () { var due = asg.dueSet ? asg.due : TM.dateAdd(S, estDays(asg.pick)); asgCreate(asg.pick, asg.aiCollabs || [], due, 'ai'); }
  };
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
    var d = dc.ideaId ? I(dc.ideaId) : null, sm = d && TM.latestSummary(S, d.id, 'analysis'), u = TM.user(S, dc.requestedBy);
    var ctx = (sm && sm.payload.background) || (d && d.note) || '';
    var rel = []; if (d) rel.push(['doc2', '想法：' + (d.title || '未命名'), '#/idea/' + d.id]); if (sm) rel.push(['spark', '整理稿 v' + sm.version + (sm.authorType === 'agent' ? '（AI 模拟）' : ''), '#/idea/' + d.id]);
    if (d) d.media.forEach(function (m) { rel.push([m.kind === 'audio' ? 'mic' : 'clip', m.name, '#/idea/' + d.id]); });
    S.workItems.filter(function (w) { return d && w.ideaId === d.id; }).forEach(function (w) { rel.push(['proj', '项目：' + w.title, '#/work/' + w.id]); });
    return '<article class="s-dec"><a class="s-dec-h" href="' + (d ? '#/idea/' + d.id : '#/stat/decide') + '"><b>' + esc(dc.question) + '</b>' + hi('chev', 2) + '</a><div class="t-tags"><i class="k-blue">' + esc(L.decision[dc.kind]) + '</i><i class="k-red">高优先级</i></div>' +
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
    return sHead('今天到期', '<button class="circle s-more" data-do="sDueMore" aria-label="更多">' + ti('more', 1.6) + '</button>') + sHero('s-green', ai2('cal', 1.8), items.length, '今天到期', '其中已逾期 ' + items.filter(function (x) { return x.time === '已逾期'; }).length + ' 项 · 进行中共 ' + open + ' 项', DECO.cal) +
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
      sHero('s-purple', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3.1A9 9 0 1 0 20.9 13H11z" fill="currentColor"/><path d="M13 2.1V11h8.9A9 9 0 0 0 13 2.1z" fill="currentColor" opacity=".55"/></svg>', rate + '%', off ? '上周完成率' : '本周完成率', deltaHTML(dlt, '%', false), '', '<span class="s-frac">' + doneW.length + ' / ' + total + '</span>').replace('</section>', chart + '</section>') +
      '<section class="wd-card"><div class="wd-ph"><b>任务完成情况</b><small class="muted" style="font-size:12.5px">按截止日</small></div><div class="s-legend"><span><i class="d-green"></i>已完成 <b>' + doneW.length + '</b></span><span><i class="d-blue"></i>进行中 <b>' + inprog.length + '</b></span><span><i class="d-gray"></i>未开始 <b>' + notyet.length + '</b></span></div>' +
      (perDay.every(function (x) { return !(x.d + x.p + x.n); }) ? '<p class="muted s-empty">这一周没有到截止日的任务。</p>' : '<div class="s-bars">' + perDay.map(function (x, i) { var h3 = function (v) { return Math.round(v / mx * 86); }; return '<div><span class="s-col"><i class="g" style="height:' + h3(x.d) + 'px"></i><i class="b" style="height:' + h3(x.p) + 'px"></i><i class="n" style="height:' + Math.max(x.d + x.p + x.n ? 0 : 6, h3(x.n)) + 'px"></i></span><small>' + days[i] + '</small></div>'; }).join('') + '</div>') + '</section>' +
      '<section class="wd-card"><div class="wd-ph"><b>按项目统计</b><a class="wd-link" href="#/work">查看全部</a></div>' + (projs.length ? '' : '<p class="muted s-empty">还没有项目。<a href="#/project">去新建一个</a></p>') + projs.map(function (x) { return '<a class="s-prow" href="#/work/' + x.w.id + '">' + wIcon(x.w) + '<span class="s-pn">' + esc(x.w.title) + '<i><em class="' + (x.pct >= 75 ? 'g' : '') + '" style="width:' + x.pct + '%"></em></i></span><span class="s-pp">' + x.pct + '%</span><span class="s-pf">' + x.p.done + '/' + x.p.total + '</span></a>'; }).join('') + '</section>' +
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
  /* ---------- 团队 ---------- */
  var tm = { group: 'all' };
  var SKC = ['k-blue', 'k-violet', 'k-green'];
  var PRES = { online: ['在线', '#16C47F'], away: ['离开', '#F59E0B'], busy: ['忙碌', '#F03E50'], offline: ['离线', '#9AA3B2'] };
  function hoCount(uid) { var o = TM.openWorkOf(S, uid); return o.tasks.length + o.works.length + o.ideas.length; }
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
      pill: '<button class="tk-month tm-count" data-do="tmMembers">' + ai2('team', 1.6) + '<b>' + us.length + '</b> 位伙伴' + ai2('downc', 1.8) + '</button>' }) +
      '<div class="w-chips tm-chips"><button class="' + (sel === 'all' ? 'on' : '') + '" data-do="tmGroup" data-g="all">全部 <i>' + us.length + '</i></button>' + G.slice(1).concat(G.slice(0, 1)).map(function (g) { var n = us.filter(function (u) { return u.group === g; }).length; return n ? '<button class="' + (sel === g ? 'on' : '') + '" data-do="tmGroup" data-g="' + g + '">' + g + ' <i>' + n + '</i></button>' : ''; }).join('') + '</div>' +
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
      var u = TM.user(S, el.dataset.u), self = u.id === me, mg = self || isOwner() || TM.hasRole(S, me, 'admin'), c = tCounts(u.id), p = PRES[u.presence || 'offline'];
      var ts = S.tasks.filter(function (t) { return t.ownerId === u.id && ['done', 'cancelled'].indexOf(t.status) < 0 && TM.canViewTask(S, me, t); });
      openSheet(u.name, '<div class="tm-prof">' + av(u.id) + '<div><b>' + esc(u.name) + '</b><small>' + esc(u.title) + '，' + u.roles.map(function (a) { return L.role[a.role]; }).join('、') + '</small><small><i style="background:' + p[1] + '"></i>' + p[0] + '　' + esc(u.group || '') + '</small></div></div>' +
        (mg ? field('一句话', '<input type="text" name="motto" maxlength="30" value="' + esc(u.motto || '') + '">') + field('擅长领域（最多 3 个，用顿号分隔）', '<input type="text" name="skills" value="' + esc((u.skills || []).join('、')) + '">') +
          '<div class="fld"><span>状态</span><div class="opts tdpr">' + Object.keys(PRES).map(function (k) { return opt('presence', k, PRES[k][0], '', (u.presence || 'offline') === k); }).join('') + '</div></div>' : '<p class="tm-motto">“' + esc(u.motto || '') + '”</p>') +
        '<div class="fld"><span>手上的任务（' + c.prog + ' 项进行中，你能看到 ' + ts.length + ' 项）</span>' + (ts.length ? '<div class="list">' + ts.map(function (t) { return taskRow(t); }).join('') + '</div>' : '<p class="muted" style="font-size:13.5px">没有你能看到的进行中任务。</p>') + '</div>' +
        (isOwner() && !TM.hasRole(S, u.id, 'owner') && !u.inactive ? '<button type="button" class="btn block mt" data-do="tmRole" data-u="' + u.id + '">调整角色</button>' : '') +
        ((isOwner() || TM.hasRole(S, me, 'admin')) && u.id !== me && hoCount(u.id) ? '<button type="button" class="btn block mt' + (u.inactive ? ' pri' : '') + '" data-do="tmHandover" data-u="' + u.id + '">交接 TA 手上的工作（' + hoCount(u.id) + ' 项）</button>' : '') +
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
      openSheet('交接 ' + u.name + ' 的工作', '<div class="callout">' + [ow.tasks.length && ow.tasks.length + ' 个未完成任务', ow.works.length && ow.works.length + ' 个项目里的负责人 / 跟进 / 验收角色', ow.ideas.length && ow.ideas.length + ' 条跟进中的想法'].filter(Boolean).join('、') + '，一起转给下面这位。接手人没有相应角色的部分会保留并告诉你。</div>' +
        field('接手人', userSelect('to', to.map(function (x) { return x.id; }), (to[0] || {}).id)), '交接', function (o) {
          var r = act('member.handover', { from: u.id, to: o.to }); if (!r.ok) return;
          toast('已交接给 ' + nm(o.to) + (r.skipped && r.skipped.length ? '；未转：' + r.skipped.join('；') : ''), !!(r.skipped && r.skipped.length));
        }, true);
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
      (SRV ? '' : '<button class="me-team me-demo" data-do="demoStart"><span class="me-ic dk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5l12 7-12 7z"/></svg></span><span class="me-tt"><b>演示向导</b><small>一键走完 想法 → 整理 → 事项 → 执行 → 验收</small></span>' + hi('chev', 2) + '</button>') +
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
      '<button class="me-info" data-do="quickAI">' + hi('spark', 1.7) + '<span>AI 助手</span><b>整理、分析、建议、创作</b>' + hi('chev', 2) + '</button>' +
      '<a class="me-info" href="#/inbox">' + hi('bell', 1.7) + '<span>通知中心</span><b>' + (nU ? nU + ' 条未读' : '全部已读') + '</b>' + hi('chev', 2) + '</a>' +
      (can ? '<a class="me-info" href="#/settings">' + ai2('ctx', 1.7) + '<span>更多设置</span><b>终验、标签、提醒、演示工具</b>' + hi('chev', 2) + '</a>' : '') +
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
  /* ---------- AI 助手（底部大面板 + 对话） ---------- */
  var AIC = [['rec', '推荐', 'spark'], ['org', '整理', 'doc2'], ['ana', '分析', 'ops'], ['adv', '建议', 'bulb'], ['cre', '创作', 'edit']];
  var CAPS = {
    minutes: ['会议纪要整理', '上传或粘贴会议内容，帮我生成结构化纪要', 'g', 'doc2', 'input'],
    split: ['任务拆解与分配', '把想法变成可执行的任务清单，并建议负责人', 'v', 'check', 'input'],
    progress: ['项目进度分析', '分析当前项目进展，识别风险并给出建议', 'b', 'ops', 'now'],
    options: ['方案建议与优化', '针对我的想法，提供多种可行方案', 'o', 'bulb', 'input'],
    weekly: ['写周报', '根据本周真实数据生成周报', 'b', 'doc2', 'now'],
    todos: ['待办整理', '把一段话拆成带时间、优先级的待办', 'g', 'check', 'input'],
    ideas: ['想法整理稿', '查看 AI 已整理过的想法', 'v', 'spark', 'now'],
    recall: ['找回记忆', '找回记过的想法、录音、视频和文件', 'b', 'search', 'input'],
    load: ['团队负载分析', '谁忙、谁有空，哪里需要支援', 'v', 'team', 'now'],
    rate: ['本周完成率', '查看完成情况与按项目统计', 'b', 'ops', 'go'],
    priority: ['今日优先级建议', '今天先做哪几件事', 'o', 'flagO', 'now'],
    notice: ['写团队通知', '帮你起草一条发给团队的通知', 'g', 'edit', 'input'],
    agenda: ['写会议议程', '根据主题生成会议议程', 'v', 'cal', 'input']
  };
  var CATS = { rec: [['minutes', 'split', 'progress', 'options'], ['recall', 'weekly', 'load', 'priority']], org: [['recall', 'minutes', 'todos', 'ideas']], ana: [['progress', 'load', 'rate']], adv: [['options', 'priority']], cre: [['weekly', 'notice', 'agenda']] };
  var CHIPS = [['weekly', '写周报', '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4"/>'], ['plan', '项目规划', '<circle cx="12" cy="12" r="8.5" stroke="#F03E50"/><circle cx="12" cy="12" r="4.5" stroke="#F03E50"/><circle cx="12" cy="12" r="1.2" fill="#F03E50" stroke="none"/>'], ['load', '团队协作', '<circle cx="9" cy="8" r="3" fill="#3B6FE8" stroke="none"/><path d="M3.5 19c.7-3.2 2.8-4.8 5.5-4.8s4.8 1.6 5.5 4.8z" fill="#3B6FE8" stroke="none"/><circle cx="16.5" cy="8.5" r="2.4" fill="#8DB0F7" stroke="none"/>'], ['rate', '数据分析', '<path d="M5 20v-6M10 20V9M15 20v-9M20 20V5" stroke="#2F6FEB" stroke-width="2.4"/>'], ['brain', '头脑风暴', '<path d="M9 17.5h6M10 20.5h4" stroke="#F5A623"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v1h5v-1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5z" fill="#FFE08A" stroke="#F5A623"/>']];
  var aiS = { open: false, cat: 'rec', page: 0, msgs: [], mode: null, input: '', listening: false, sr: null };
  function aiIcon(k) { return ai2(k === 'ops' ? 'ops' : k, 1.8); }
  AI2.ops = '<path d="M5 20v-6M10 20V9M15 20v-9M20 20V5" stroke-width="2.6"/>';
  AI2.team = TI.team || PI.team;
  function renderAI() {
    var L3 = document.getElementById('ai-layer'); if (!L3) { L3 = document.createElement('div'); L3.id = 'ai-layer'; document.body.appendChild(L3); }
    if (!aiS.open) { L3.innerHTML = ''; document.body.classList.remove('ai-open'); return; }
    document.body.classList.add('ai-open');
    var u = TM.user(S, me), chat = aiS.msgs.length > 0;
    var sets = CATS[aiS.cat], set = sets[aiS.page % sets.length];
    var head = '<div class="ai-grab"></div><button class="ai-x" data-do="aiClose" aria-label="关闭">' + ai2('x', 2.2) + '</button>';
    var body;
    if (!chat) {
      body = '<section class="ai-hero"><div><h2>' + hi('spark', 1.4).replace('<svg ', '<svg class="ai-star" ') + 'AI 助手</h2><h3>你的团队智能助理</h3><p>帮你整理、分析、拆解和推进工作<br>让想法更快变成可见的结果</p></div><div class="ai-bot">' + ROBOT.replace('<circle cx="68" cy="56" r="5.5" fill="#6FA8FF"/><circle cx="92" cy="56" r="5.5" fill="#6FA8FF"/><path d="M73 66c4 3.5 10 3.5 14 0" stroke="#6FA8FF" stroke-width="3" fill="none" stroke-linecap="round"/>', '<path d="M60 60c3-6 11-6 14 0M86 60c3-6 11-6 14 0" stroke="#6FA8FF" stroke-width="4.5" fill="none" stroke-linecap="round"/>') + '<span class="ai-hello">Hello<br>' + esc(u.name) + '! 👋</span><span class="ai-bt">Better<br>&nbsp;Together</span></div></section>' +
        '<nav class="ai-cats">' + AIC.map(function (c) { return '<button class="' + (aiS.cat === c[0] ? 'on' : '') + '" data-do="aiCat" data-c="' + c[0] + '">' + (c[0] === 'rec' ? hi('spark', 1.6) : ai2(c[2] === 'ops' ? 'ops' : c[2], 1.8)) + c[1] + '</button>'; }).join('') + '</nav>' +
        '<div class="ai-sh"><h4>你可以试着问我</h4>' + (sets.length > 1 ? '<button data-do="aiShuffle">' + ai2('refresh', 1.8) + '换一换</button>' : '') + '</div>' +
        set.map(function (k) { var c = CAPS[k]; return '<div class="ai-cap"><span class="ai-ci t-' + c[2] + '">' + aiIcon(c[3]) + '</span><div><b>' + c[0] + '</b><small>' + c[1] + '</small></div><button data-do="aiUse" data-k="' + k + '">使用</button></div>'; }).join('') +
        '<div class="ai-chips">' + CHIPS.filter(function (c) { var cp = myCaps(); return c[0] === 'plan' ? cp.createProject : c[0] === 'brain' ? cp.recordIdea : c[0] === 'load' ? cp.work : true; }).map(function (c) { return '<button data-do="aiChip" data-k="' + c[0] + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + c[2] + '</svg>' + c[1] + '</button>'; }).join('') + '</div>';
    } else {
      body = '<div class="ai-chathead">' + hi('spark', 1.4).replace('<svg ', '<svg class="ai-star" ') + '<b>AI 助手</b><button data-do="aiReset">新对话</button></div><div class="ai-msgs" id="aimsgs">' + aiS.msgs.map(function (m) { return '<div class="ai-m ' + m.who + '">' + (m.who === 'bot' ? '<span class="ai-av">' + hi('spark', 1.6) + '</span>' : '') + '<div class="ai-b">' + m.html + '</div></div>'; }).join('') + '</div>';
    }
    L3.innerHTML = wordsFix('<div class="ai-scrim" data-do="aiClose"></div><section class="ai-panel' + (chat ? ' chat' : '') + '" role="dialog" aria-modal="true" aria-label="AI 助手">' + head + '<div class="ai-scroll">' + body + '</div>' +
      '<form class="ai-input" data-aiform="1"><div class="ai-field">' + hi('spark', 1.5) + '<input type="text" name="q" autocomplete="off" placeholder="' + (aiS.mode === 'recall' ? '想找什么？说个关键词或时间，比如「上周的录音」' : aiS.mode ? esc(CAPS[aiS.mode] ? '粘贴或输入内容，用于「' + CAPS[aiS.mode][0] + '」' : '输入内容') : '有什么想法？尽管告诉我…') + '" value="' + esc(aiS.input) + '"><button type="submit" class="ai-send" aria-label="发送">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/></svg></button></div>' +
      '<div class="ai-tools"><label>' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>' + '上传文件<input type="file" accept=".txt,.md,text/plain,text/markdown" data-aifile="1"></label><button type="button" data-do="aiVoice"' + (aiS.listening ? ' class="on"' : '') + '>' + ni('mic', 1.7) + (aiS.listening ? '正在听…' : '语音输入') + '</button><button type="button" data-do="aiPhoto">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/></svg>' + '拍照识别</button></div></form>' +
      '<p class="ai-disc">AI 可能会生成不准确的信息，请结合实际情况判断' + (AI_ON ? '（由 Claude 回答）' : '（演示版为规则模拟）') + '</p></section>');
    requestAnimationFrame(function () { var p = L3.querySelector('.ai-panel'); if (p) p.classList.add('on'); var m = document.getElementById('aimsgs'); if (m) m.scrollTop = m.scrollHeight; });
  }
  function botSay(html, real) { aiS.msgs.push({ who: 'bot', html: html + (real === 'ai' ? '<span class="ai-sim ai-real">Claude 回答 · 依据你能看到的数据</span>' : real ? '<span class="ai-sim">检索自你能看到的真实数据</span>' : '<span class="ai-sim">模拟输出</span>') }); }
  function userSay(t) { aiS.msgs.push({ who: 'me', html: esc(t).replace(/\n/g, '<br>') }); }
  function li(arr) { return arr.length ? '<ul>' + arr.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '<p class="muted">无</p>'; }
  /* —— 能力：基于真实数据 —— */
  function capWeekly() {
    var ws = weekStart(0).getTime(), sc = scopeTasks(), passAt = {};
    S.reviews.forEach(function (r) { if (r.taskId && (r.verdict === 'pass' || r.verdict === 'owner_pass')) passAt[r.taskId] = Math.max(passAt[r.taskId] || 0, r.at); });
    var done = sc.filter(function (t) { return t.status === 'done' && passAt[t.id] >= ws; });
    var prog = sc.filter(function (t) { return ['accepted', 'in_progress', 'submitted', 'owner_review'].indexOf(t.status) >= 0; });
    var risk = sc.filter(function (t) { return t.status === 'blocked' || TM.isOverdue(S, t) || TM.isStale(S, t); });
    var decs = isOwner() ? S.decisions.filter(function (d) { return d.decidedAt && d.decidedAt >= ws; }) : [];
    var nxt = []; vWork().forEach(function (w) { (w.milestones || []).forEach(function (m) { var n = dayDiff(m.date); if (!m.done && n != null && n >= 0 && n <= 14) nxt.push(esc(w.title) + '：' + esc(m.title) + '（' + mdTxt(m.date) + '）'); }); });
    var txt2 = '【本周周报】' + TM.user(S, me).name + '\n一、本周完成（' + done.length + '）\n' + (done.map(function (t) { return '· ' + t.title; }).join('\n') || '· 无') + '\n二、进行中（' + prog.length + '）\n' + (prog.map(function (t) { return '· ' + t.title + '（' + L.task[t.status] + '）'; }).join('\n') || '· 无') + '\n三、风险与阻碍（' + risk.length + '）\n' + (risk.map(function (t) { return '· ' + t.title + (t.blockedReason ? '：' + t.blockedReason : TM.isOverdue(S, t) ? '：已逾期' : '：多天无动态'); }).join('\n') || '· 无') + (decs.length ? '\n四、本周决策\n' + decs.map(function (d) { return '· ' + d.question + '：' + L.decisionStatus[d.status]; }).join('\n') : '') + '\n' + (decs.length ? '五' : '四') + '、接下来两周的里程碑\n' + (nxt.map(function (x) { return '· ' + x.replace(/&[^;]+;/g, ''); }).join('\n') || '· 无');
    aiS.lastCopy = txt2;
    botSay('<b>根据本周真实数据生成的周报：</b><pre class="ai-pre">' + esc(txt2) + '</pre><button class="ai-act" data-do="aiCopy">复制周报</button>');
  }
  function capProgress() {
    var ws2 = vWork().filter(function (w) { return ['done', 'cancelled'].indexOf(w.status) < 0; });
    if (!ws2.length) return botSay('目前没有进行中的项目。');
    var rows = ws2.map(function (w) {
      var pct = wPct(w), fl = wFlags(w), left = w.due ? dayDiff(w.due) : null, ms = (w.milestones || []).find(function (m) { return !m.done; }), risks = [];
      if (fl) risks.push(fl + ' 个任务受阻、逾期或无动态');
      if (left != null && left < 0) risks.push('项目已逾期 ' + (-left) + ' 天');
      else if (left != null && left <= 7 && pct < 60) risks.push('距截止 ' + left + ' 天，进度仅 ' + pct + '%');
      if (ms && dayDiff(ms.date) < 0) risks.push('里程碑「' + esc(ms.title) + '」已过期未完成');
      if (w.status === 'planning') risks.push('还没有安排任务');
      return '<div class="ai-proj"><b>' + esc(w.title) + '</b><span>进度 ' + pct + '%' + (w.due ? '，截止 ' + mdTxt(w.due) : '') + (ms ? '，下一个里程碑：' + esc(ms.title) : '') + '</span>' + (risks.length ? '<em class="bad">风险：' + risks.join('；') + '</em>' : '<em class="good">暂无明显风险</em>') + '<a href="#/work/' + w.id + '" data-do="aiGo" data-h="#/work/' + w.id + '">查看项目</a></div>';
    });
    var hiRisk = ws2.filter(function (w) { return wFlags(w) || (w.due && dayDiff(w.due) <= 7 && wPct(w) < 60); });
    botSay('<b>项目进度分析（' + ws2.length + ' 个）</b>' + rows.join('') + '<p><b>建议：</b>' + (hiRisk.length ? '优先处理「' + hiRisk.map(function (w) { return esc(w.title); }).join('」「') + '」，先解除受阻任务，再确认截止时间是否需要调整。' : '各项目节奏正常，保持每周检查里程碑即可。') + '</p>');
  }
  function capLoad() {
    var ppl = TM.activeUsers(S).filter(function (u) { return u.roles.some(function (a) { return a.role === 'executor' || a.role === 'lead' || a.role === 'operator'; }); }).map(function (u) { var c = tCounts(u.id); var bl = S.tasks.filter(function (t) { return t.ownerId === u.id && t.status === 'blocked'; }).length; return { u: u, n: c.prog, bl: bl }; }).sort(function (a, b) { return b.n - a.n; });
    var busy = ppl.filter(function (x) { return x.n >= 3; }), idle = ppl.filter(function (x) { return x.n === 0; });
    botSay('<b>团队负载</b>' + li(ppl.map(function (x) { return esc(x.u.name) + '（' + esc(x.u.title) + '）：进行中 ' + x.n + ' 项' + (x.bl ? '，受阻 ' + x.bl + ' 项' : ''); })) + '<p><b>建议：</b>' + (busy.length ? esc(busy.map(function (x) { return x.u.name; }).join('、')) + ' 负载偏高，新任务可优先给 ' : '整体负载均衡，新任务可优先给 ') + (idle.length ? esc(idle.map(function (x) { return x.u.name; }).join('、')) : '手上任务最少的人') + '。' + (ppl.some(function (x) { return x.bl; }) ? '有受阻任务，跟进人需要尽快协助解除。' : '') + '</p>');
  }
  function capPriority() {
    var xs = homeTodos().filter(function (x) { return !x.done; }).slice(0, 5);
    botSay(xs.length ? '<b>今天建议按这个顺序做：</b><ol>' + xs.map(function (x) { return '<li><a href="' + x.href + '" data-do="aiGo" data-h="' + x.href + '">' + esc(x.title) + '</a>（' + PRIO[x.prio][0] + '）</li>'; }).join('') + '</ol><p class="muted">排序依据：优先级、是否逾期、是否卡住别人。</p>' : '今天没有等你处理的事，可以去推进进行中的项目。');
  }
  function capIdeas() {
    var xs = vIdeas().filter(function (d) { return TM.latestSummary(S, d.id, 'analysis') || d.aiStatus === 'failed'; });
    botSay(xs.length ? '<b>AI 整理过的想法：</b><ol>' + xs.slice(0, 6).map(function (d) { var sm = TM.latestSummary(S, d.id, 'analysis'); return '<li><a href="#/idea/' + d.id + '" data-do="aiGo" data-h="#/idea/' + d.id + '">' + esc(d.title || '未命名') + '</a>' + (d.aiStatus === 'failed' ? '（AI 失败，可重试）' : sm && L.route[sm.payload.suggested_route] ? '：建议' + L.route[sm.payload.suggested_route] : '') + '</li>'; }).join('') + '</ol>' : '还没有 AI 整理过的想法。');
  }
  function capMinutes(text, given) {
    var sents = text.split(/[。！？!?\n；;]/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 3; });
    var dec = sents.filter(function (x) { return /决定|确定|同意|通过|定了|拍板/.test(x); });
    var todos = given || parseTodos(text); aiS.pendingTodos = todos;
    var ppl = S.users.filter(function (u) { return text.indexOf(u.name) >= 0; }).map(function (u) { return u.name; });
    botSay('<b>会议纪要</b><h5>参会/提到的人</h5><p>' + (ppl.length ? esc(ppl.join('、')) : '未识别出') + '</p><h5>讨论要点</h5>' + li(sents.filter(function (x) { return dec.indexOf(x) < 0; }).slice(0, 6).map(esc)) + '<h5>决定</h5>' + li(dec.map(esc)) + '<h5>待办（' + todos.length + '）</h5>' + li(todos.map(function (t) { return esc(t.title) + '（' + relDay(t.date) + (t.time ? ' ' + t.time : '') + (t.people.length ? '，' + t.people.map(function (u) { return esc(nm(u)); }).join('、') : '') + '）'; })) + (todos.length ? '<button class="ai-act" data-do="aiAddTodos">把 ' + todos.length + ' 条待办加入今日待办</button>' : ''));
  }
  function capTodos(text, given) { var todos = given || parseTodos(text); aiS.pendingTodos = todos; botSay(todos.length ? '<b>拆出 ' + todos.length + ' 条待办：</b>' + li(todos.map(function (t) { return esc(t.title) + '（' + relDay(t.date) + (t.time ? ' ' + t.time : '') + '，' + ({ hi: '高', mid: '中', lo: '低' })[t.priority] + '优先级）'; })) + '<button class="ai-act" data-do="aiAddTodos">全部加入今日待办</button>' : '没有识别出待办。试试「明天上午10点和陈立开周会，周五前回复邮件，紧急」。'); }
  function capSplit(text) {
    var r = parseTranscript(text); aiS.pendingSplit = r;
    botSay('<b>「' + esc(r.title) + '」可以拆成：</b><ol>' + (r.tasks.length ? r.tasks.map(function (t) { return '<li>' + esc(t.title) + '　<span class="muted">建议负责人：' + esc(nm(t.ownerId)) + '</span></li>'; }).join('') : '<li>没有识别出明确步骤，建议补充「先…再…然后…」这样的描述</li>') + '</ol>' + (canAssign() && r.tasks.length ? '<button class="ai-act" data-do="aiToAssign">分配第一个任务</button>' : '') + (canCreateProject() ? '<button class="ai-act ghost" data-do="aiToProject">建成项目</button>' : ''));
  }
  function capOptions(text) {
    var t = text.slice(0, 40);
    botSay('<b>针对「' + esc(t) + '」的三种做法：</b><h5>方案 A · 小步试点</h5><p>先用最小成本在一个小范围试 2 周，收集反馈再决定是否扩大。风险最低，见效较慢。</p><h5>方案 B · 分阶段推进</h5><p>拆成准备、执行、复盘三个阶段，每阶段设里程碑和负责人。节奏可控，适合多数情况。</p><h5>方案 C · 集中攻坚</h5><p>抽调人手集中一到两周完成。见效最快，但会挤占其他项目，需要老板确认资源。</p><p class="muted">演示版为模板化建议；接入大模型后会结合你的公司方向和历史项目给出具体方案。</p>');
  }
  function capNotice(text) { botSay('<b>通知草稿：</b><pre class="ai-pre">各位同工平安：\n\n' + esc(text) + '\n\n请大家留意时间安排，有问题可以在群里或 App 里留言。谢谢大家的配搭！\n\n' + esc(TM.user(S, me).name) + '</pre>'); aiS.lastCopy = '各位同工平安：\n\n' + text + '\n\n请大家留意时间安排，有问题可以在群里或 App 里留言。谢谢大家的配搭！\n\n' + TM.user(S, me).name; aiS.msgs[aiS.msgs.length - 1].html = aiS.msgs[aiS.msgs.length - 1].html.replace('<span class="ai-sim">', '<button class="ai-act" data-do="aiCopy">复制</button><span class="ai-sim">'); }
  function capAgenda(text) { var t = text.slice(0, 30); botSay('<b>「' + esc(t) + '」会议议程（建议 45 分钟）：</b><ol><li>开场与目标说明（5 分钟）</li><li>现状与数据回顾（10 分钟）</li><li>关键问题讨论（15 分钟）</li><li>形成决定与分工（10 分钟）</li><li>确认待办、负责人和截止时间（5 分钟）</li></ol><p class="muted">会后可以把会议内容发给我，用「会议纪要整理」自动拆成待办。</p>'); }
  /* 找回记忆：在你看得到的所有内容里检索 */
  var RECALL_STOP = /我的|我|的|找一下|找找|帮我|找到|找|一下|之前|上次|以前|曾经|忘了|忘记|那个|那条|那段|关于|有关|有没有|有|吗|呢|什么|哪个|哪里|在哪|放在|传过|录过|记过|说过|上传|过|了|内容|一个|一些|所有|全部|给我|看看|请/g;
  function recallIndex() {
    var out = [], add = function (o) { out.push(o); };
    vIdeas().forEach(function (d) {
      add({ type: 'idea', icon: 'bulb', title: d.title || d.note.slice(0, 20) || '未命名想法', text: (d.title || '') + ' ' + d.note + ' ' + (d.tags || []).join(' '), at: d.lastActivity || d.createdAt, href: '#/idea/' + d.id, src: L.idea[d.status] + (d.creatorId === me ? '，你发起' : '，' + TM.name(S, d.creatorId) + ' 发起') });
      if (TM.canViewMedia(S, me, d)) d.media.forEach(function (m) { if (!TM.canSeeMediaItem(S, me, d, m)) return; add({ type: m.kind === 'audio' ? 'audio' : m.kind === 'video' ? 'video' : m.kind === 'image' ? 'image' : 'file', icon: m.kind === 'audio' ? 'mic' : m.kind === 'video' ? 'vcam' : m.kind === 'image' ? 'img' : 'doc2', title: m.name, text: m.name + ' ' + (d.title || '') + ' ' + d.note, at: d.createdAt, href: '#/idea/' + d.id, src: '在想法「' + (d.title || '未命名') + '」里', blob: m.localId && blobUrl(m.localId) ? m : null }); });
      S.suggestions.filter(function (x) { return x.ideaId === d.id; }).forEach(function (x) { add({ type: 'note', icon: 'cmt', title: '建议：' + x.body.slice(0, 24), text: x.body, at: x.at, href: '#/idea/' + d.id, src: TM.name(S, x.authorId) + ' 在「' + (d.title || '') + '」' }); });
    });
    vWork().forEach(function (w) { add({ type: 'project', icon: 'proj', title: w.title, text: w.title + ' ' + (w.goal || '') + ' ' + (w.desc || '') + ' ' + (w.keyResults || ''), at: w.lastActivity || w.createdAt, href: '#/work/' + w.id, src: '项目，' + L.work[w.status] }); });
    vTasks().forEach(function (t) {
      add({ type: 'task', icon: 'check', title: t.title, text: t.title + ' ' + (t.description || '') + ' ' + t.expected + ' ' + t.criteria, at: t.lastActivity || t.createdAt, href: '#/task/' + t.id, src: '任务，' + L.task[t.status] });
      S.deliverables.filter(function (f) { return f.taskId === t.id; }).forEach(function (f) { add({ type: 'file', icon: 'doc2', title: '交付物：' + (f.note || f.url).slice(0, 24), text: f.note + ' ' + f.url + ' ' + t.title, at: f.at, href: '#/task/' + t.id, src: '任务「' + t.title + '」的交付物' }); });
      S.comments.filter(function (c2) { return c2.taskId === t.id; }).forEach(function (c2) { add({ type: 'note', icon: 'cmt', title: '留言：' + c2.body.slice(0, 24), text: c2.body, at: c2.at, href: '#/task/' + t.id, src: TM.name(S, c2.authorId) + ' 在任务「' + t.title + '」' }); });
    });
    TM.ensureTodos(S); S.todos.filter(function (x) { return x.ownerId === me || x.people.indexOf(me) >= 0; }).forEach(function (x) { add({ type: 'todo', icon: 'check', title: x.title, text: x.title + ' ' + x.note + ' ' + x.tags.join(' '), at: x.at, href: '#/tasks', src: '待办，' + relDay(x.date) + (x.done ? '，已完成' : '') }); });
    (S.fileRecent || []).forEach(function (f) { add({ type: f.kind === 'video' ? 'video' : f.kind === 'image' ? 'image' : 'file', icon: f.kind === 'video' ? 'vcam' : f.kind === 'image' ? 'img' : 'doc2', title: f.name, text: f.name, at: f.at, href: '#/new/file', src: '导入过的文件' + (f.size ? '，' + f.size : '') + (f.demo ? '（示例）' : '') }); });
    TM.kbVisible(S, me).forEach(function (k) { add({ type: 'file', icon: 'doc2', title: k.title, text: k.title + ' ' + k.body.slice(0, 4000), at: k.at, href: '#/kb/' + k.id, src: 'AI 知识库资料' + (k.on ? '' : '（已停用）') }); });
    if (isOwner()) S.decisions.forEach(function (dc) { add({ type: 'decision', icon: 'flagO', title: dc.question, text: dc.question + ' ' + (dc.note || ''), at: dc.decidedAt || dc.at, href: dc.ideaId ? '#/idea/' + dc.ideaId : '#/stat/decide', src: '决策，' + L.decisionStatus[dc.status] }); });
    return out;
  }
  function capRecall(q) {
    var types = [], since = 0, until = Infinity, now2 = new Date(), d0 = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate()).getTime();
    [[/录音|语音|音频/, ['audio']], [/视频|影片/, ['video']], [/文件|文档|PDF|Word|资料|附件|交付/i, ['file']], [/图片|照片|截图/, ['image']], [/想法|点子/, ['idea']], [/项目/, ['project']], [/任务/, ['task']], [/待办/, ['todo']], [/决策|决定/, ['decision']], [/建议|留言|评论/, ['note']]].forEach(function (r) { if (r[0].test(q)) types = types.concat(r[1]); });
    var ws0 = weekStart(0).getTime();
    if (/今天/.test(q)) since = d0; else if (/昨天/.test(q)) { since = d0 - 864e5; until = d0; } else if (/本周|这周/.test(q)) since = ws0; else if (/上周/.test(q)) { since = ws0 - 7 * 864e5; until = ws0; } else if (/本月|这个月/.test(q)) since = new Date(now2.getFullYear(), now2.getMonth(), 1).getTime(); else if (/上个月|上月/.test(q)) { since = new Date(now2.getFullYear(), now2.getMonth() - 1, 1).getTime(); until = new Date(now2.getFullYear(), now2.getMonth(), 1).getTime(); }
    var mm = q.match(/(\d{1,2})月/); if (mm && !/上个月|本月|这个月/.test(q)) { since = new Date(now2.getFullYear(), +mm[1] - 1, 1).getTime(); until = new Date(now2.getFullYear(), +mm[1], 1).getTime(); }
    var rest = q.replace(/录音|语音|音频|视频|影片|文件|文档|PDF|Word|资料|附件|图片|照片|截图|想法|点子|项目|任务|待办|决策|决定|建议|留言|评论|今天|昨天|本周|这周|上周|本月|这个月|上个月|上月|\d{1,2}月|交付物?/gi, ' ').replace(RECALL_STOP, ' ').replace(/[，。？?！!、,.「」“”"]/g, ' ');
    var kws = rest.split(/\s+/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length >= 2 || /[A-Za-z0-9]/.test(x) && x.length >= 1; });
    var idx = recallIndex();
    var hits = idx.filter(function (o) { if (types.length && types.indexOf(o.type) < 0) return false; if (o.at < since || o.at >= until) return false; return true; }).map(function (o) {
      var sc = 0; kws.forEach(function (k) { if (o.title.indexOf(k) >= 0) sc += 3; else if (o.text.indexOf(k) >= 0) sc += 1; else { var part = 0; for (var i = 0; i + 1 < k.length; i++) if (o.text.indexOf(k.slice(i, i + 2)) >= 0) part++; if (part && part >= Math.ceil((k.length - 1) / 2)) sc += 0.5; } });
      return { o: o, sc: sc };
    }).filter(function (x) { return !kws.length || x.sc > 0; }).sort(function (a, b) { return b.sc - a.sc || b.o.at - a.o.at; });
    var desc = (types.length ? '类型：' + types.map(function (t) { return { audio: '录音', video: '视频', file: '文件', image: '图片', idea: '想法', project: '项目', task: '任务', todo: '待办', decision: '决策', note: '建议/留言' }[t]; }).join('、') + '；' : '') + (since || until < Infinity ? '时间已限定；' : '') + (kws.length ? '关键词：' + kws.join('、') : '');
    if (!hits.length) return botSay('没找到相关内容' + (desc ? '（' + esc(desc) + '）' : '') + '。可以换个说法，比如只说一个关键词「年会」，或「上周的录音」。', true);
    botSay('<b>找到 ' + hits.length + ' 条相关内容</b>' + (desc ? '<p class="muted" style="font-size:12.5px">' + esc(desc) + '</p>' : '') + '<div class="rc-list">' + hits.slice(0, 8).map(function (x) {
      var o = x.o, b2 = o.blob && blobUrl(o.blob.localId);
      return '<a class="rc-item" href="' + o.href + '" data-do="aiGo" data-h="' + o.href + '"><span class="rc-ic">' + ai2(o.icon, 1.6) + '</span><span class="rc-t"><b>' + esc(o.title) + '</b><small>' + esc(o.src) + ' · ' + whenTxt(o.at) + '</small></span></a>' + (b2 ? (o.type === 'audio' ? '<audio controls src="' + b2 + '"></audio>' : o.type === 'video' ? '<video controls playsinline src="' + b2 + '" style="width:100%;border-radius:10px"></video>' : '') : '');
    }).join('') + '</div>' + (hits.length > 8 ? '<p class="muted" style="font-size:12.5px">还有 ' + (hits.length - 8) + ' 条，说得具体一点能更快找到。</p>' : ''), true);
  }
  var CAP_RUN = { recall: capRecall, minutes: capMinutes, todos: capTodos, split: capSplit, options: capOptions, notice: capNotice, agenda: capAgenda };
  var CAP_ASK = { recall: '想找什么？比如「上周的录音」「年会相关的文件」「关于清醒的想法」。', minutes: '把会议内容粘贴给我，或点「上传文件」上传 TXT 记录。', todos: '说说要做的事，比如「明天上午10点和陈立开周会，周五前回复邮件，紧急」。', split: '描述一下这个想法要做什么，我来拆成任务并建议负责人。', options: '说说你的想法或遇到的问题。', notice: '通知的主要内容是什么？', agenda: '会议主题是什么？' };
  function aiHandle(text) {
    userSay(text);
    if (aiS.mode === 'recall') { capRecall(text); return; }
    if (aiS.mode && CAP_RUN[aiS.mode]) { var m = aiS.mode; aiS.mode = null; CAP_RUN[m](text); return; }
    if (/找回|找一下|在哪|忘了|上次.*(录|传|说)|之前.*(录|传|记)/.test(text)) return capRecall(text);
    var mins = /纪要|会议记录/.test(text), tds = !mins && parseTodos(text).some(function (t) { return t.time || t.people.length; });
    if (AI_ON && (mins || tds)) {
      // 纪要 / 拆待办：待办部分交给 Claude 拆（日期、相关人更准），展示和一键添加按钮不变
      var msg = { who: 'bot', html: '<span class="ai-typing"><i></i><i></i><i></i></span> 正在拆分…', pending: true }; aiS.msgs.push(msg); aiS.lastText = text;
      TMS.aiTodos(text).then(function (r) { aiS.msgs.splice(aiS.msgs.indexOf(msg), 1); mins ? capMinutes(text, r.items) : capTodos(text, r.items); var m = aiS.msgs[aiS.msgs.length - 1]; if (m) m.html = m.html.replace('<span class="ai-sim">模拟输出</span>', '<span class="ai-sim ai-real">待办由 Claude 拆分</span>'); renderAI(); },
        function (e) { aiS.msgs.splice(aiS.msgs.indexOf(msg), 1); toast((e && e.error) || 'AI 暂时不可用', true); mins ? capMinutes(text) : capTodos(text); renderAI(); });
      return;
    }
    if (/纪要|会议记录/.test(text) || /拆解|拆成|分配/.test(text) || parseTodos(text).some(function (t) { return t.time || t.people.length; })) { /* 结构化动作：继续用规则版（会生成可点击按钮） */ }
    else if (AI_ON) return aiReal(text, function () { aiRuleAnswer(text); });
    aiRuleAnswer(text);
  }
  /* 交给 Claude：先显示「思考中」，回来后替换；失败退回规则答案 */
  // 照片压缩到长边 1600 像素以内（JPEG），再交给 Claude 识别
  function shrinkImage(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { var k = Math.min(1, 1600 / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); ok(cv.toDataURL('image/jpeg', 0.85).split(',')[1]); };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('这张图片打不开')); };
      img.src = url;
    });
  }
  function aiImageRead(file) {
    aiS.open = true;
    var me1 = { who: 'me', html: '<p>拍照识别：' + esc(file.name || '照片') + '</p>' }, msg = { who: 'bot', html: '<span class="ai-typing"><i></i><i></i><i></i></span> 正在识别照片…', pending: true };
    aiS.msgs.push(me1, msg); renderAI();
    shrinkImage(file).then(function (b64) { return TMS.aiImage(b64, 'image/jpeg'); }).then(function (r) {
      msg.pending = false; msg.html = '<div class="ai-md">' + kbMd(r.text || '') + '</div><span class="ai-sim ai-real">Claude 识别 · 请核对原文</span>'; aiS.lastCopy = r.text || ''; aiS.lastText = r.text || ''; renderAI();
    }, function (e) { aiS.msgs.splice(aiS.msgs.indexOf(msg), 1); toast((e && (e.error || e.message)) || '识别失败', true); renderAI(); });
  }
  function aiReal(text, fallback) {
    var hist = aiS.msgs.slice(0, -1).filter(function (m) { return !m.pending; }).slice(-8).map(function (m) { var d = document.createElement('div'); d.innerHTML = m.html; var x = d.querySelector('.ai-sim'); if (x) x.remove(); return { role: m.who === 'me' ? 'user' : 'assistant', text: d.textContent.trim() }; });
    var msg = { who: 'bot', html: '<span class="ai-typing"><i></i><i></i><i></i></span> 正在思考…', pending: true }; aiS.msgs.push(msg); aiS.lastText = text;
    TMS.aiAsk(text, hist).then(function (r) {
      msg.pending = false; msg.html = '<div class="ai-md">' + kbMd(r.text || '') + '</div>' + (r.truncated ? '<p class="muted">（回答较长，已截断）</p>' : '') + '<span class="ai-sim ai-real">Claude 回答 · 依据你能看到的数据</span>';
      aiS.lastCopy = r.text || ''; renderAI();
    }, function (e) {
      aiS.msgs.splice(aiS.msgs.indexOf(msg), 1); toast((e && e.error) || 'AI 暂时不可用', true); fallback(); renderAI();
    });
  }
  function aiRuleAnswer(text) {
    if (/周报/.test(text)) return capWeekly();
    if (/进度|风险|项目怎么样/.test(text)) return capProgress();
    if (/负载|谁有空|谁忙|协作/.test(text)) return capLoad();
    if (/先做|优先|今天做什么/.test(text)) return capPriority();
    if (/纪要|会议记录/.test(text)) return capMinutes(text);
    if (/拆解|拆成|分配/.test(text)) return capSplit(text);
    if (/方案|怎么做|建议/.test(text)) return capOptions(text);
    if (parseTodos(text).some(function (t) { return t.time || t.people.length; })) return capTodos(text);
    if (AI_ON) { botSay('AI 暂时没回应，可以换个说法再问一次。'); aiS.lastText = text; return; }
    botSay('我先帮你记下了。演示版能做这些：写周报、项目进度分析、团队负载、今日优先级、会议纪要、拆待办、任务拆解、方案建议、写通知和议程。' + (myCaps().recordIdea ? '<br><button class="ai-act" data-do="aiSaveIdea">把这句话存成想法草稿</button>' : ''));
    aiS.lastText = text;
  }
  var AIX = {
    quickAI: function () { aiS.open = true; renderAI(); },
    aiClose: function () { aiS.open = false; if (aiS.sr) { try { aiS.sr.stop(); } catch (e) {} aiS.sr = null; aiS.listening = false; } renderAI(); },
    recallOpen: function () { aiS.open = true; aiS.msgs = []; aiS.mode = 'recall'; botSay('我是你的 AI 助手。你记过的想法、录音、视频、文件、任务和待办，我都能帮你找回来。<div class="rc-chips">' + ['我录过的语音', '上传过的视频', '年会相关的文件', '本周的想法', '清醒'].map(function (q) { return '<button class="ai-act ghost" data-do="aiRecallQ" data-q="' + q + '">' + q + '</button>'; }).join('') + '</div>', true); renderAI(); },
    aiRecallQ: function (el) { aiS.mode = 'recall'; userSay(el.dataset.q); capRecall(el.dataset.q); renderAI(); },
    aiCat: function (el) { aiS.cat = el.dataset.c; aiS.page = 0; renderAI(); },
    aiShuffle: function () { aiS.page++; renderAI(); },
    aiReset: function () { aiS.msgs = []; aiS.mode = null; renderAI(); },
    aiUse: function (el) { var k = el.dataset.k, c = CAPS[k]; if (c[4] === 'go') { aiS.open = false; renderAI(); location.hash = '#/stat/rate'; return; } userSay(c[0]); if (c[4] === 'now') { ({ weekly: capWeekly, progress: capProgress, load: capLoad, priority: capPriority, ideas: capIdeas })[k](); } else { aiS.mode = k; botSay(CAP_ASK[k]); } renderAI(); },
    aiChip: function (el) { var k = el.dataset.k; if (k === 'plan') { aiS.open = false; renderAI(); return canCreateProject() ? (location.hash = '#/project/ai') : toast('新建项目由老板、运营者或负责人完成', true); } if (k === 'rate') { aiS.open = false; renderAI(); location.hash = '#/stat/rate'; return; } if (k === 'brain') { aiS.open = false; renderAI(); return TM.canInitiate(S, me) ? DO.goNew() : toast('只有老板和有发起权的负责人可以记录想法', true); } AIX.aiUse({ dataset: { k: k } }); },
    aiCopy: function () { var t = aiS.lastCopy || ''; try { navigator.clipboard.writeText(t).then(function () { toast('已复制'); }, function () { toast('复制失败，请长按文字复制', true); }); } catch (e) { toast('复制失败，请长按文字复制', true); } },
    aiAddTodos: function () { var n = 0; (aiS.pendingTodos || []).forEach(function (x) { var r = TM.act(S, me, 'todo.create', { title: x.title, date: x.date, time: x.time, priority: x.priority, people: x.people, tags: x.tags, scope: x.scope, source: 'ai' }); if (r.ok) n++; }); aiS.pendingTodos = []; save(); botSay('已加入 ' + n + ' 条待办。<a href="#/tasks" data-do="aiGo" data-h="#/tasks">去看看</a>'); renderAI(); render(); },
    aiToAssign: function () { var r = aiS.pendingSplit, t = r.tasks[0]; asg = freshAsg(); asg.title = t.title.slice(0, 50); asg.desc = r.summary.slice(0, 500); asg.ownerId = t.ownerId; aiS.open = false; renderAI(); location.hash = '#/assign'; },
    aiToProject: function () { var r = aiS.pendingSplit; pd = freshPD(); pd.title = r.title; pd.note = r.summary; pd.ptype = r.ptype; pd.leadId = r.leadId; pd.source = 'ai'; pd.tasks = r.tasks; pd.aiNote = 'AI 助手已按你的描述生成草稿，请核对。'; aiS.open = false; renderAI(); location.hash = '#/project'; },
    aiSaveIdea: function () { if (!TM.canInitiate(S, me)) return toast('只有老板和有发起权的负责人可以记录想法', true); var r = TM.act(S, me, 'idea.create', { note: aiS.lastText || '' }); if (!r.ok) return toast(r.error, true); save(); aiS.open = false; renderAI(); location.hash = '#/idea/' + r.id; toast('已存为私人草稿'); },
    aiGo: function (el) { aiS.open = false; renderAI(); location.hash = el.dataset.h; },
    aiVoice: function () {
      if (!SR) return toast('当前浏览器不支持语音输入（安卓 Chrome 支持）', true);
      if (aiS.sr) { try { aiS.sr.stop(); } catch (e) {} return; }
      try { var r = new SR(); r.lang = 'zh-CN'; r.interimResults = false; r.onresult = function (e) { var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; aiS.input = (aiS.input + t).slice(0, 2000); }; r.onend = function () { aiS.sr = null; aiS.listening = false; renderAI(); }; r.start(); aiS.sr = r; aiS.listening = true; renderAI(); } catch (e) { toast('无法启动语音输入', true); }
    },
    // 拍照识别（白板、纸质记录、手写便签）：服务器启用 Claude 时可用；照片在手机上先压缩再发
    aiPhoto: function () {
      if (!AI_ON) return toast('演示版暂不支持识别图片内容，正式版接入后可识别白板和纸质记录', true);
      if (AI_LOCAL) return toast('看照片需要 Claude：请老板在服务器上配置 Claude 密钥。现在可以把照片里的文字打出来发给我', true);
      openSheet('拍照识别', '<p class="muted" style="margin:0 0 12px;font-size:14px">拍白板、纸质会议记录、手写便签或截图，Claude 会把上面的字整理出来，并列出要点和可以变成待办的事。</p><div class="ix2-opts"><label class="ix2-opt"><input type="file" accept="image/*" capture="environment" data-aiimg="1"><span class="ix2-oi">' + ai2('img', 1.7) + '</span><b>拍照</b><small>用相机拍一张</small></label><label class="ix2-opt"><input type="file" accept="image/*" data-aiimg="1"><span class="ix2-oi">' + ai2('doc2', 1.7) + '</span><b>从相册选</b><small>选一张照片或截图</small></label></div>', '关闭', function () { closeSheet(); });
    }
  };
  /* ---------- 页面：想法详情 ---------- */
  function trailIdea(d) {
    var ws = S.workItems.filter(function (w) { return w.ideaId === d.id; });
    var ts = S.tasks.filter(function (t) { return ws.some(function (w) { return w.id === t.workId; }); });
    var steps = [['想法', d.status !== 'draft'], ['整理', ['planned'].indexOf(d.status) >= 0], ['事项', ws.length > 0], ['执行', ts.length && ts.every(function (t) { return t.status === 'done' || t.status === 'cancelled'; })], ['验收', ws.length && ws.every(function (w) { return w.status === 'done'; })]];
    return trail(steps);
  }
  function trail(steps) {
    var cur = steps.findIndex(function (s) { return !s[1]; });
    return '<div class="trail" aria-label="流转轨迹">' + steps.map(function (s, i) {
      var c = s[1] ? 'done' : i === cur ? 'cur' : '';
      var inner = '<div class="dot"></div>' + esc(s[0]);
      return s[2] ? '<a class="st ' + c + '" href="' + s[2] + '">' + inner + '</a>' : '<div class="st ' + c + '">' + inner + '</div>';
    }).join('') + '</div>';
  }
  function analysisHTML(d) {
    var sm = TM.latestSummary(S, d.id, 'analysis');
    if (d.aiStatus === 'failed' && !sm) return '<div class="callout bad">AI 整理失败。跟进人可以重试，或直接手写整理稿继续推进，不会卡住流程。</div>';
    if (!sm) return d.status === 'draft' || d.status === 'discussing' || d.status === 'summary_ready' ? '' : emptyBox('整理稿生成中。');
    var p = sm.payload;
    var vers = S.summaries.filter(function (x) { return x.ideaId === d.id && x.kind === 'analysis'; }).length;
    var rowsKV = [['类别', L.kind[p.category] || p.category], ['背景', p.background], ['真实问题', p.problem], ['目标', p.goal], ['与方向关系', p.relation_to_direction]];
    return '<div class="card"><h3>整理稿 v' + sm.version + (vers > 1 ? '（共 ' + vers + ' 版）' : '') + '　' + (sm.authorType === 'agent' ? '<span class="tag sim">AI 模拟输出</span>' : '<span class="tag">' + esc(TM.name(S, sm.authorId)) + ' 修改</span>') + '</h3>' +
      '<div class="lead">' + esc(p.title) + '</div><dl class="kv">' + rowsKV.filter(function (x) { return x[1]; }).map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>' +
      ((p.open_questions || []).length ? '<div class="callout warn"><b>待澄清</b><br>' + p.open_questions.map(esc).join('<br>') + '</div>' : '') +
      ((p.exception_flags || []).length ? '<div class="callout warn">AI 提示可能属于例外：' + p.exception_flags.map(function (f) { return L.decision[f]; }).join('、') + '。是否上报由跟进人决定。</div>' : '') +
      (p.suggested_route ? '<div class="callout ai">AI 建议：' + esc(L.route[p.suggested_route]) + '。只是建议，派发由人来点。</div>' : '') + '</div>';
  }
  function cocreateHTML(d, only) {
    var sug = S.suggestions.filter(function (x) { return x.ideaId === d.id; });
    var h = '';
    var sm = TM.latestSummary(S, d.id, 'cocreate');
    if (sm) {
      var p = sm.payload, src = function (a) { return (a || []).map(function (id) { return '<span class="src">' + esc(id) + '</span>'; }).join(''); };
      var li = function (arr) { return arr.length ? '<ul>' + arr.map(function (x) { return '<li>' + esc(x.point) + src(x.src) + '</li>'; }).join('') + '</ul>' : '<p class="muted">无</p>'; };
      h += '<div class="card sum"><h3>共创汇总 v' + sm.version + '　' + (sm.authorType === 'agent' ? '<span class="tag sim">AI 模拟输出</span>' : '<span class="tag">发起人已确认</span>') + '</h3>' +
        '<h4>共识</h4>' + li(p.consensus) + '<h4>分歧</h4>' + (p.divergences.length ? '<ul>' + p.divergences.map(function (x) { return '<li>' + esc(x.point) + '<ul>' + x.positions.map(function (q) { return '<li>' + esc(q.view) + src(q.src) + '</li>'; }).join('') + '</ul></li>'; }).join('') + '</ul>' : '<p class="muted">无</p>') +
        '<h4>风险</h4>' + li(p.risks) + '<h4>待澄清</h4>' + li(p.open_questions) +
        '<div class="callout ' + (p.confirmed_direction ? '' : 'ai') + '"><b>' + (p.confirmed_direction ? '发起人确认的方向' : '建议方向') + '</b><br>' + esc(p.confirmed_direction || p.proposed_direction) + '</div></div>';
    }
    if (d.path === 'cocreate' && !only) {
      var tops = sug.filter(function (x) { return !x.replyTo; });
      var can = TM.canSuggest(S, me, d);
      var one = function (x, isReply) {
        return '<div class="sug' + (isReply ? ' reply' : '') + '"><div class="h">' + av(x.authorId, true) + '<b>' + esc(nm(x.authorId)) + '</b><span>' + ago(x.at) + '</span><span class="id">' + esc(x.id) + '</span></div><p class="b">' + esc(x.body) + '</p>' +
          (can && !isReply ? '<button class="btn ghost" style="min-height:36px;padding:0;margin-top:2px" data-do="reply" data-id="' + x.id + '" data-name="' + esc(nm(x.authorId)) + '">回复</button>' : '') + '</div>';
      };
      h += '<div class="card"><h3>团队建议 ' + sug.length + (d.shareAll ? '　分享给全体' : '　分享给 ' + d.shares.map(nm).join('、')) + '</h3>' +
        (sug.length ? tops.map(function (x) { return one(x) + sug.filter(function (r) { return r.replyTo === x.id; }).map(function (r) { return one(r, true); }).join(''); }).join('') : '<p class="muted">还没有建议。</p>') +
        (can ? '<form data-form="suggest" class="mt"><input type="hidden" name="replyTo" value=""><div id="replyHint" class="muted" style="font-size:13.5px"></div><textarea name="body" rows="3" placeholder="写下你的建议。讨论中的建议不等于已批准的需求。"></textarea><button class="btn pri block mt" type="submit">发送建议</button></form>' : '') +
        '</div>';
    }
    return h;
  }
  function eventsHTML(evs) {
    if (!evs.length) return '';
    return '<div class="card"><h3>操作记录（只追加，不可修改）</h3><ul class="tl">' + evs.slice().sort(function (a, b) { return b.at - a.at; }).map(function (e) {
      return '<li>' + av(e.actorId, true) + '<div><div><b style="font-weight:600">' + esc(TM.name(S, e.actorId)) + '</b> <span class="x">' + esc(e.text || e.action) + '</span></div><div class="w">' + ago(e.at) + '</div></div></li>';
    }).join('') + '</ul></div>';
  }
  function ideaStep(d) {
    var ws = S.workItems.filter(function (w) { return w.ideaId === d.id; });
    if (['draft', 'discussing', 'summary_ready'].indexOf(d.status) >= 0) return 0;
    if (['triage', 'awaiting_owner', 'on_hold', 'declined'].indexOf(d.status) >= 0) return 1;
    var w = ws[0]; if (!w) return 2;
    return w.status === 'done' ? 5 : w.status === 'acceptance' ? 4 : ['active', 'blocked', 'paused'].indexOf(w.status) >= 0 ? 3 : 2;
  }
  function fileKind(m) { var n = (m.name || '').toLowerCase(); return m.kind === 'audio' ? ['ix-a', 'mic'] : m.kind === 'video' ? ['ix-v', 'vcam'] : m.kind === 'image' || /\.(png|jpe?g|gif|webp)/.test(n) ? ['ix-i', 'img'] : /\.pdf/.test(n) ? ['ix-p', 'doc2'] : /\.(xlsx?|csv)/.test(n) ? ['ix-x', 'doc2'] : ['ix-d', 'doc2']; }
  function ixHead(t, sub, more) { return '<header class="ix-hd ix2-hd"><button class="circle" data-do="back" aria-label="返回">' + hi('chev', 2.2).replace('M9 6l6 6-6 6', 'M15 6l-6 6 6 6') + '</button><div><h1>' + t + '</h1><p>' + sub + '</p></div>' + (more ? '<button class="circle ix-dots" data-do="ixMore" aria-label="更多">' + ti('more', 1.6) + '</button>' : '<span></span>') + '</header>'; }
  function ixSteps(d) { var st = ideaStep(d); return '<section class="ix-steps ix2-steps">' + ['想法', '整理', '事项', '执行', '验收'].map(function (t, i) { return '<div class="' + (i < st ? 'done' : i === st ? 'cur' : '') + '"><i>' + (i < st ? ni('check', 2.6) : '') + '</i><span>' + t + '</span></div>'; }).join('') + '</section>'; }
  function ixDate(ts) { var d = new Date(ts), y = d.getFullYear() !== new Date().getFullYear(); return (y ? d.getFullYear() + '年' : '') + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); } // 和全站「10月6日」写法一致
  function ixSource(d) { var k = (d.media || []).map(function (m) { return m.kind; }); return k.indexOf('audio') >= 0 ? '语音记录' : k.indexOf('video') >= 0 ? '视频记录' : k.length ? '文件导入' : '想法记录'; }
  function ixDenied() { return ixHead('想法详情', '把想法变成行动') + emptyBox('这个想法不存在，或你没有查看权限。'); }
  function viewIdea(id, sub) {
    var d = I(id);
    if (!d || !TM.canViewIdea(S, me, d)) return ixDenied();
    if (sub === 'ai') return viewIdeaAI(d);
    if (sub === 'talk') { setTimeout(function () { location.replace('#/idea/' + d.id); }, 0); return ''; }
    if (sub === 'talk-old') return ixHead('讨论与建议', '大家的想法都在这里') + ixSteps(d) + '<div id="ix-disc">' + (cocreateHTML(d) || emptyBox('还没有讨论。')) + '</div>';
    if (sub === 'log') return ixHead('操作记录', '每一步是谁、什么时候做的') + (ixCanLog(d) ? eventsHTML(S.events.filter(function (e) { return e.ideaId === d.id && !e.taskId; })) : emptyBox('只有发起人、跟进人和老板能看操作记录。'));
    var nx = TM.nextForIdea(S, d), acts = ideaActions(d);
    var sm = TM.latestSummary(S, d.id, 'analysis'), ws = S.workItems.filter(function (w) { return w.ideaId === d.id && TM.canViewWork(S, me, w); });
    var sugg = S.suggestions.filter(function (x) { return x.ideaId === d.id; });
    var canMedia = TM.canViewMedia(S, me, d), canAttach = (d.creatorId === me || d.followerId === me || isOwner()) && !TM.ideaLocked(d);
    var canEdit = acts.some(function (x) { return x[1] === 'editIdea'; }), canTag = d.creatorId === me || d.followerId === me || isOwner();
    var h = ixHead('想法详情', '把想法变成行动', true) + ixSteps(d) +
      '<section class="ix2-card ix2-main"><div class="ix2-row">' + pill('idea', d.status) + '<span class="ix2-date">创建于 ' + ixDate(d.createdAt) + '</span></div>' +
      '<h2>' + esc(d.title || '未命名想法') + (d.titleSource === 'ai' ? '<span class="ix2-ait">AI 拟题</span>' : '') + '</h2>' +
      '<div class="ix2-who">' + av(d.creatorId) + '<span><b>' + esc(nm(d.creatorId)) + '</b><small>来自　' + ixSource(d) + '</small></span>' + (d.creatorId === me || d.followerId === me || isOwner() ? '<button class="ix2-round" data-do="ixTitle" aria-label="修改标题">' + ai2('edit', 1.8) + '</button>' : '') + '</div>' +
      (nx ? '<div class="ix-next ix2-next">' + '<i></i>下一步：' + esc(nx.queue ? '等待运营者认领' : (nx.who === me ? '你' : nm(nx.who)) + ' ' + nx.what) + '</div>' : '') + '</section>' +
      '<section class="ix2-card ix2-fold' + (ixLong(d.note) ? '' : ' short') + '"><div class="ix2-sh"><b>' + pi('clip') + '想法原文</b>' + (canEdit ? '<button class="ix2-btn" data-do="editIdea">' + ai2('edit', 1.7) + '编辑</button>' : '') + '</div><div class="ix2-box">' + (d.note ? esc(d.note).replace(/\n/g, '<br>') : '<span class="muted">没有文字内容' + (d.media.length ? '，见下方附件。' : '。') + '</span>') + '</div>' + (ixLong(d.note) ? '<button class="ix2-more" data-do="ixFold" aria-expanded="false"><span>展开全文</span>' + hi('chev', 2) + '</button>' : '') + '</section>';
    if (sm || d.aiStatus === 'failed') h += sm ? ixAIBlock(d, sm, false) : '<a class="ix2-card ix2-ai" href="#/idea/' + d.id + '/ai"><span class="ix2-spark">' + hi('spark', 1.6) + '</span><span class="ix2-at"><b>AI 整理结果</b><small>AI 整理失败，进去可以重试或手写</small></span>' + hi('chev', 2) + '</a>';
    S.decisions.filter(function (x) { return x.ideaId === d.id; }).forEach(function (dc) { h += '<section class="ix2-card"><div class="ix2-sh"><b>' + ai2('flagO', 1.7) + '老板决策</b>' + pill('decision', dc.status) + '</div><p class="ix-q">' + esc(dc.question) + '</p><p class="ix2-dm">' + esc(L.decision[dc.kind] || '') + ' · ' + esc(TM.name(S, dc.requestedBy)) + ' 上报 · ' + ago(dc.at) + '</p>' + (dc.note ? '<div class="callout">' + (dc.decidedBy ? '<b>' + esc(TM.name(S, dc.decidedBy)) + '：</b>' : '') + esc(dc.note) + '</div>' : '') + (dc.status === 'pending' && (isOwner() || d.followerId === me || d.creatorId === me) ? advHTML(dc, true) : '') + '</section>'; });
    if (d.path === 'cocreate' || sugg.length) h += discHTML(d);
    if (d.status === 'summary_ready') h += cocreateHTML(d, true);
    if (d.media.length || canAttach) h += ixFiles(d, canAttach, canMedia);
    if (ws.length) h += '<section class="ix2-card"><div class="ix2-sh"><b>' + ai2('flagO', 1.7) + '形成的事项（' + ws.length + '）</b></div><div class="ix2-wks">' + ws.map(ixWorkRow).join('') + '</div></section>';
    h += flowHTML(d);
    return h;
  }
  function ixWorkRow(w) {
    var p = TM.workProgress(S, w.id), pc = p.total ? Math.round(p.done / p.total * 100) : 0;
    var flags = S.tasks.filter(function (t) { return t.workId === w.id && (t.status === 'blocked' || TM.isOverdue(S, t) || TM.isStale(S, t)); }).length;
    var nx = w.status === 'planning' ? [w.leadId, '安排任务'] : w.status === 'acceptance' ? [w.reviewerId, '确认事项完成'] : null;
    return '<a class="ix2-wk" href="#/work/' + w.id + '"><span class="ix2-wkt"><b>' + esc(w.title) + '</b>' + pill('work', w.status) + '</span>' +
      '<span class="ix2-wkm">' + L.kind[w.kind] + ' · ' + esc(TM.stageName(w.kind, w.stage)) + ' · 任务 ' + p.done + '/' + p.total + (flags ? '<em>' + flags + ' 项需关注</em>' : '') + '</span>' +
      (p.total ? '<span class="ix2-wkb"><i style="width:' + pc + '%"></i></span>' : '') +
      (nx ? '<span class="ix2-wkn">下一步：' + esc(nx[0] === me ? '你' : nm(nx[0])) + ' ' + nx[1] + '</span>' : '') + hi('chev', 2) + '</a>';
  }
  function ixLong(t) { t = String(t || ''); return t.length > 90 || t.split('\n').length > 4; }
  function ixFiles(d, canAttach, canMedia) {
    var h = '<section class="ix2-card ix2-files"><div class="ix2-sh"><b>' + pi('clip') + '相关附件（' + d.media.length + '）</b>' + (canAttach ? '<button class="ix2-btn" data-do="ixAttach">' + ti('plus2', 2) + '添加</button>' : '') + '</div>';
    if (!d.media.length) return h.replace('ix2-card ix2-files', 'ix2-card ix2-files empty') + '</section>';
    if (!canMedia) return h + '<div class="callout">原始录音、录像和附件仅发起人、老板和跟进人可见。</div></section>';
    var all = d.media.map(function (m, i) { return [m, i]; }).filter(function (x) { return TM.canSeeMediaItem(S, me, d, x[0]); });
    var nHide = d.media.filter(function (m) { return m.hidden; }).length;
    if (!all.length) return h + '<p class="ix2-empty">发起人没有呈现附件。</p></section>';
    if (nHide && all.length === d.media.length) h += '<p class="ix2-hint">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c5 0 8.5 4.5 9.5 6-.5.8-1.6 2.2-3.1 3.5M6.6 7.6C4.6 9 3.3 10.9 2.5 12c1 1.5 4.5 6 9.5 6 1.6 0 3-.4 4.3-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>' + '有 ' + nHide + ' 个附件设为「不呈现」，只有你、上传人和老板能看到。</p>';
    var imgs = all.filter(function (x) { return x[0].kind === 'image' && !x[0].hidden && x[0].localId && blobUrl(x[0].localId); });
    if (imgs.length) h += '<div class="ix2-thumbs">' + imgs.map(function (x) { return '<button data-do="ixOpen" data-i="' + x[1] + '" aria-label="查看 ' + esc(x[0].name) + '"><img src="' + blobUrl(x[0].localId) + '" alt=""></button>'; }).join('') + '</div>';
    h += all.map(function (x) { var m = x[0], i = x[1];
      var k = m.kind === 'link' ? ['ix-l', 'link'] : fileKind(m), b = m.localId && blobUrl(m.localId), canDel = (m.by === me || d.creatorId === me || isOwner()) && !TM.ideaLocked(d);
      var meta = [m.kind === 'link' ? String(m.url || m.name || '').replace(/^https?:\/\//, '').slice(0, 28) : m.size, m.durationSec ? fmtSec(m.durationSec) : '', m.by ? nm(m.by) : '', m.at ? ago(m.at) : ago(d.createdAt)].filter(Boolean).join(' · ');
      var canShow = d.creatorId === me || m.by === me || isOwner(), orig = !m.by;
      return '<div class="ix-file ix2-file' + (m.hidden ? ' off' : '') + '"><button class="ix2-fo" data-do="ixOpen" data-i="' + i + '"><span class="ix-fi ' + k[0] + '">' + (k[1] === 'link' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>' : ai2(k[1], 1.7)) + '</span><span class="ix-ft"><b>' + esc(m.name) + '</b><small>' + esc(meta) + (m.kind !== 'link' && !b ? ' · 本机未缓存' : '') + '</small>' + (orig || m.hidden ? '<span class="ix2-fl">' + (orig ? '<em>记录时上传</em>' : '') + (m.hidden ? '<em class="h">不呈现</em>' : '') + '</span>' : '') + '</span></button>' +
        (canShow ? '<button class="ix2-eye' + (m.hidden ? '' : ' on') + '" data-do="ixShow" data-i="' + i + '" role="switch" aria-checked="' + !m.hidden + '" aria-label="' + (m.hidden ? '点击呈现' : '点击不呈现') + ' ' + esc(m.name) + '"><i></i><span>' + (m.hidden ? '不呈现' : '呈现') + '</span></button>' : '') +
        (canDel ? '<button class="ix2-del" data-do="ixDetach" data-i="' + i + '" aria-label="删除 ' + esc(m.name) + '">×</button>' : '') +
        (b && m.kind === 'audio' ? '<audio controls src="' + b + '"></audio>' : b && m.kind === 'video' ? '<video controls playsinline src="' + b + '"></video>' : '') + trBlock(m) + '</div>';
    }).join('');
    var wk = TM.ideaLocked(d) && S.workItems.find(function (w) { return w.ideaId === d.id && TM.canViewWork(S, me, w); });
    return h + (TM.ideaLocked(d) ? '<p class="ix2-note lock">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' + '已形成项目，附件已锁定。' + (wk ? '新资料请加到<a href="#/work/' + wk.id + '">项目</a>里。' : '') + '</p>' : '<p class="ix2-note">' + (SRV ? '附件会上传到团队服务器。' : '演示版：附件只保存在这台设备，刷新后只保留文件名。') + '</p>') + '</section>';
  }
  function refsHTML(refs, title) { if (!refs || !refs.length) return ''; return '<div class="kb-refs"><h5>' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>' + (title || '参考的公司资料') + '</h5>' + refs.map(function (r) { return '<a class="kb-ref" href="#/kb/' + r.id + '"><b>《' + esc(r.title.replace(/（示例）$/, '')) + '》' + (r.head ? ' · ' + esc(r.head) : '') + '</b><span>' + esc(r.text) + '</span></a>'; }).join('') + '</div>'; }
  function advHTML(dc, fold) {
    var real = dc.ai && dc.ai.label, r = real ? Object.assign({ refs: [] }, dc.ai) : TM.decisionAdvice(S, dc), tone = r.verdict === 'approved' ? 'ok' : 'wait';
    var li = function (arr) { return '<ul>' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; };
    return '<div class="ix2-adv' + (fold ? ' ix2-fold' : ' open') + '"><div class="ix2-advh"><span class="ix2-spark">' + hi('spark', 1.6) + '</span><span><small>AI 给老板的建议</small><b class="' + tone + '">' + esc(r.label) + '</b></span></div>' +
      '<div class="ix2-advb">' + (r.reasons.length ? '<h5>理由</h5>' + li(r.reasons) : '') + (r.risks.length ? '<h5>要注意</h5>' + li(r.risks) : '') + (r.checks.length ? '<h5>拍板前确认</h5>' + li(r.checks) : '') +
      refsHTML(r.refs, '依据的公司资料') + '<h5>建议批语</h5><p class="ix2-advn">' + esc(r.note) + '</p><p class="ix2-advf">' + (real ? 'Claude 建议 · ' + ago(dc.ai.at) + ' · 仅供参考，决定由老板做。' : 'AI 模拟建议，仅供参考，决定由老板做。') + '</p>' + (!real && AI_ON && isOwner() && dc.status === 'pending' ? '<button type="button" class="ix2-adopt" data-do="advAI" data-arg="' + dc.id + '">' + hi('spark', 1.6) + '让 Claude 分析</button>' : '') + '</div>' +
      (fold ? '<button class="ix2-more" data-do="ixFold" aria-expanded="false"><span>看理由</span>' + hi('chev', 2) + '</button>' : '') + '</div>';
  }
  /* 落实过程：谁在什么时候接手了这件事 */
  var FLOW_STAGE = ['想法', '整理', '事项', '执行', '验收'];
  function flowMap(e, d) {
    var a = e.action, who = e.actorType === 'agent' ? 'AI 助理' : e.actorType === 'system' ? '系统' : nm(e.actorId), T = e.taskId ? T_(e.taskId) : null, tt = T ? '「' + T.title + '」' : '';
    var m = {
      'idea.create': [0, '记录了这个想法'], 'idea.submit': [0, e.to === 'discussing' ? '提交，开启团队共创' : '提交，直接推进'], 'idea.suggest': [0, '提了建议'], 'idea.close_discussion': [0, '结束讨论，AI 汇总'], 'idea.confirm_direction': [0, '确认了方向'], 'idea.reopen': [0, '重新开放讨论'],
      'ai.analyze.ready': [1, '生成整理稿'], 'ai.reanalyze': [1, '重新整理'], 'idea.claim': [1, '认领跟进'], 'decision.request': [1, '报老板决策'], 'idea.to_owner': [1, '送老板确认'], 'decision.approved': [1, '批准'], 'decision.rejected': [1, '否决'], 'decision.needs_info': [1, '要求补充'], 'idea.status': [1, e.text || '改了状态'],
      'idea.route': [2, e.text || '形成事项'], 'task.assign': [2, '派任务' + tt + '：' + (e.text || '')], 'work.stage': [2, e.text || '推进阶段'], 'work.status': [2, e.text || '事项状态变化'], 'work.resume': [2, '恢复事项'],
      'task.accept': [3, '接收任务' + tt], 'task.start': [3, '开始做' + tt], 'task.submit': [3, '提交成果' + tt], 'task.block': [3, '报阻碍' + tt + (e.reason ? '：' + e.reason : '')], 'task.unblock': [3, '解除阻碍' + tt], 'task.cancel': [3, '取消任务' + tt],
      'task.review.pass': [4, '验收通过' + tt], 'task.review.return': [4, '退回' + tt + (e.reason ? '：' + e.reason : '')], 'task.owner_pass': [4, '终验通过' + tt], 'task.owner_return': [4, '终验退回' + tt], 'work.done': [4, '确认事项完成'], 'work.attach': [3, e.text || '上传文件']
    }[a];
    if (!m && a === 'decision.request') m = [1, '报老板决策'];
    if (!m) return null;
    var txt2 = m[1].replace(/派任务「([^」]*)」：派给 /, '派「$1」给 ');
    return { stage: m[0], who: e.actorId, whoName: who, agent: e.actorType !== 'human', text: txt2, at: e.at };
  }
  function T_(id) { return S.tasks.find(function (x) { return x.id === id; }); }
  function flowHTML(d) {
    var ws = S.workItems.filter(function (w) { return w.ideaId === d.id && TM.canViewWork(S, me, w); }), wid = ws.map(function (w) { return w.id; });
    var evs = S.events.filter(function (e) { if (e.ideaId === d.id && !e.taskId) return true; if (e.workId && wid.indexOf(e.workId) >= 0) { if (!e.taskId) return true; var t = T_(e.taskId); return t && TM.canViewTask(S, me, t); } return false; })
      .map(function (e) { return flowMap(e, d); }).filter(Boolean).sort(function (x, y) { return x.at - y.at; });
    if (!evs.length) return '';
    var st = ideaStep(d), now = ws.length ? ws[0] : null, hand = '';
    var ts = S.tasks.filter(function (t) { return wid.indexOf(t.workId) >= 0 && TM.canViewTask(S, me, t); });
    var tn = ts.map(function (t) { return TM.nextForTask(S, t); }).filter(Boolean)[0], inx = TM.nextForIdea(S, d);
    if (now && now.status === 'done') hand = '已全部完成';
    else if (tn) hand = (tn.who === me ? '你' : nm(tn.who)) + '：' + tn.what;
    else if (now && now.status === 'planning') hand = nm(now.leadId) + '：拆分任务';
    else if (inx) hand = inx.queue ? '等待运营者认领' : (inx.who === me ? '你' : nm(inx.who)) + '：' + inx.what;
    return flowRender(evs, st, hand);
  }
  function flowRender(evs, st, hand) {
    var groups = FLOW_STAGE.map(function (n, i) { return evs.filter(function (x) { return x.stage === i; }); });
    var summary = FLOW_STAGE.map(function (n, i) {
      var g = groups[i], ppl = g.filter(function (x) { return !x.agent; }).map(function (x) { return x.who; }).filter(function (x, k, arr) { return arr.indexOf(x) === k; });
      var cls = i < st ? 'done' : i === st ? 'cur' : '';
      var line = g.length ? g.filter(function (x) { return !x.agent; }).slice(-2).map(function (x) { return x.whoName + ' ' + x.text; }).join(' → ') || g[g.length - 1].whoName + ' ' + g[g.length - 1].text : (i === st ? '进行中' : i < st ? '已完成' : '还没到这一步');
      return '<div class="fl-s ' + cls + '"><i></i><b>' + n + '</b><span class="fl-av">' + ppl.slice(0, 3).map(function (u) { return av(u, true); }).join('') + '</span><small>' + esc(line) + '</small></div>';
    }).join('');
    var full = groups.map(function (g, i) { if (!g.length) return ''; return '<div class="fl-g"><h5>' + FLOW_STAGE[i] + '</h5>' + g.map(function (x) { return '<div class="fl-e">' + (x.agent ? '<span class="av agent sm">' + (x.whoName === '系统' ? '系' : 'AI') + '</span>' : av(x.who, true)) + '<span><b>' + esc(x.whoName) + '</b> ' + esc(x.text) + '<small>' + ixDate(x.at) + '</small></span></div>'; }).join('') + '</div>'; }).join('');
    return '<section class="ix2-card ix2-fold fl-card"><div class="ix2-sh"><b>' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5v3a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3"/></svg>' + '落实过程</b><span class="ix2-date">' + evs.length + ' 步</span></div>' +
      '<div class="fl-now"><span>现在</span>' + esc(hand || '—') + '</div><div class="fl-sum">' + summary + '</div><div class="fl-full">' + full + '</div>' +
      '<button class="ix2-more" data-do="ixFold" aria-expanded="false"><span>展开完整过程</span>' + hi('chev', 2) + '</button></section>';
  }
  /* 想法里的 AI 对话（规则模拟，基于本想法的讨论、整理稿和公司资料） */
  var ichat = {}, ichatOpen = {};
  function ichatCan(d) { return isOwner() || d.creatorId === me || d.followerId === me || S.workItems.some(function (w) { return w.ideaId === d.id && w.leadId === me; }); }
  function ichatAnswer(d, q) {
    var dg = TM.discussionDigest(S, d), sug = S.suggestions.filter(function (x) { return x.ideaId === d.id; });
    var sm = TM.latestSummary(S, d.id, 'analysis'), an = sm ? ixAnalysis(d, sm.payload) : null;
    var li = function (arr) { return '<ul>' + arr.join('') + '</ul>'; }, w = function (a2) { return a2 && a2.length ? '<em>' + esc(a2.join('、')) + '</em>' : ''; };
    var src = [];
    var t = q.replace(/[？?。！!\s]/g, '');
    if (/分歧|不同意|争议|反对|意见不一/.test(t)) { src.push('讨论'); return { html: dg.divergences.length ? '<p>有 ' + dg.divergences.length + ' 处分歧：</p>' + li(dg.divergences.map(function (v) { return '<li>' + esc(v.point) + li(v.sides.map(function (s2) { return '<li>' + esc(s2.view) + w(s2.who) + '</li>'; })) + '</li>'; })) : '<p>目前没有明显的分歧，大家的意见基本一致。</p>', src: src }; }
    if (/共识|一致|都同意|大家同意/.test(t)) return { html: dg.consensus.length ? '<p>大家基本同意的是：</p>' + li(dg.consensus.map(function (c) { return '<li>' + esc(c.point) + w(c.who) + '</li>'; })) : '<p>还没有形成明确的共识。</p>', src: ['讨论'] };
    if (/风险|担心|顾虑|隐患|问题在哪/.test(t)) { var rs = dg.risks.map(function (c) { return '<li>' + esc(c.point) + w(c.who) + '</li>'; }).concat(an ? an.issues.map(function (x) { return '<li>' + esc(x) + '<em>AI 整理</em></li>'; }) : []); return { html: rs.length ? '<p>需要注意的地方：</p>' + li(rs) : '<p>讨论里没人提到风险。</p>', src: ['讨论', 'AI 整理稿'] }; }
    if (/谁|没发言|没说话|没表态|参与|哪些人/.test(t)) { var said = dg.people.map(function (p2) { return p2.name; }); var pool = (d.shareAll ? S.users.map(function (u) { return u.id; }) : (d.shares || [])).filter(function (u) { return u !== d.creatorId && !TM.hasRole(S, u, 'admin'); }).map(nm); var quiet = pool.filter(function (n2) { return said.indexOf(n2) < 0; }); return { html: '<p>已经发言的有 ' + (said.length ? '<b>' + esc(said.join('、')) + '</b>' : '0 人') + '。</p>' + (quiet.length ? '<p>还没表态的：<b>' + esc(quiet.join('、')) + '</b>。可以点名请他们说说看法。</p>' : '<p>分享范围内的人都已经发言了。</p>'), src: ['讨论'] }; }
    if (/下一步|怎么做|怎么办|建议|该做什么|接下来/.test(t)) return { html: '<p>建议这样推进：</p><ol>' + dg.next.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' + (an ? '<p class="muted">AI 整理稿里的方向：' + esc(an.directions.slice(0, 3).join('；')) + '</p>' : ''), src: ['讨论', 'AI 整理稿'] };
    if (/资料|规定|制度|原则|公司|老板怎么看|价值观/.test(t)) { var r = TM.kbMatch(S, (d.title || '') + ' ' + d.note + ' ' + q, 3); return { html: r.length ? '<p>公司资料里相关的内容：</p>' + refsHTML(r, '') : '<p>AI 知识库里没有找到相关资料。可以去「我的 → AI 知识库」补充。</p>', src: ['AI 知识库'] }; }
    if (/进度|现在|到哪|状态|谁在跟/.test(t)) { var nx = TM.nextForIdea(S, d); return { html: '<p>当前状态：<b>' + esc(L.idea[d.status]) + '</b>。' + (d.followerId ? '跟进人是 ' + esc(nm(d.followerId)) + '。' : '还没有运营者认领。') + '</p>' + (nx ? '<p>下一步：' + esc(nx.queue ? '等待运营者认领' : nm(nx.who) + ' ' + nx.what) + '</p>' : ''), src: ['想法状态'] }; }
    if (/总结|概括|说了什么|讨论了什么|梳理/.test(t)) return { html: '<p>共 ' + dg.count + ' 条讨论、' + dg.people.length + ' 人参与。</p>' + li(dg.people.map(function (p2) { return '<li><b>' + esc(p2.name) + '</b>：' + esc(p2.points.join('；')) + '</li>'; })) + (an ? '<p>AI 整理的核心：' + esc(an.overview) + '</p>' : ''), src: ['讨论', 'AI 整理稿'] };
    var terms = t.replace(/AI|ai|大家|我们|这个|一下|关于|有没有|什么|怎么|吗|呢|的/g, ' ').split(/\s+/).filter(function (x) { return x.length >= 2; });
    var bi = []; terms.forEach(function (x) { for (var i = 0; i < x.length - 1; i++) bi.push(x.slice(i, i + 2)); });
    var hits = sug.filter(function (x) { return bi.some(function (b) { return x.body.indexOf(b) >= 0; }); });
    var kr = TM.kbMatch(S, q, 2);
    if (hits.length || kr.length) return { html: (hits.length ? '<p>讨论里提到的：</p>' + li(hits.slice(0, 4).map(function (x) { return '<li>' + esc(x.body) + '<em>' + esc(nm(x.authorId)) + '</em></li>'; })) : '') + (kr.length ? refsHTML(kr, '公司资料') : ''), src: hits.length ? ['讨论'] : ['AI 知识库'] };
    return { html: '<p>这个问题我在讨论和资料里没找到直接的内容。可以试试问：「大家的分歧是什么」「有哪些风险」「谁还没发言」「下一步怎么做」「公司资料怎么说」。</p>', src: [] };
  }
  function ichatHTML(d) {
    if (!ichatCan(d) || !ichatOpen[d.id]) return '';
    var ms = ichat[d.id] || [];
    var chips = ['大家的分歧是什么', '有哪些风险', '谁还没发言', '下一步怎么做', '公司资料怎么说'];
    return '<div class="ic-panel" id="ic-panel"><div class="ic-hd"><span class="ix2-spark">' + hi('spark', 1.6) + '</span><b>问 AI</b><small>基于这条想法的讨论、整理稿和公司资料回答</small><button class="ic-x" data-do="icClose" aria-label="收起对话">×</button></div>' +
      '<div class="ic-list" id="ic-list">' + (ms.length ? ms.map(function (m) { return m.me ? '<div class="ic-q">' + esc(m.text) + '</div>' : '<div class="ic-a">' + m.html + (m.src && m.src.length ? '<span class="ic-src">依据：' + esc(m.src.join('、')) + '</span>' : '') + '</div>'; }).join('') : '<p class="ic-hi">你好，关于「' + esc(d.title || '这个想法') + '」想问什么？</p>') + '</div>' +
      '<div class="ic-chips">' + chips.map(function (c) { return '<button data-do="icAsk" data-q="' + c + '">' + c + '</button>'; }).join('') + '</div>' +
      '<div class="ic-in"><input type="text" id="ic-q" maxlength="80" placeholder="输入问题，或点话筒说话"><button class="ic-mic" data-do="icMic" aria-label="语音提问">' + ai2('mic', 1.8) + '</button><button class="ic-go" data-do="icSend" aria-label="发送">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' + '</button></div><p class="ix2-advf">AI 模拟回答，按关键词从讨论和资料里找答案。</p></div>';
  }
  /* 想法 / 项目里的「问 AI」：AI 已启用时交给 Claude（带上这条想法 / 项目的背景），失败退回规则回答 */
  function aiChatPush(store, key, ctx, q, rule, after, focus) {
    var list = store[key] = store[key] || [];
    var hist = list.filter(function (m) { return !m.pending; }).slice(-6).map(function (m) { var dd = document.createElement('div'); dd.innerHTML = m.html || ''; return { role: m.me ? 'user' : 'assistant', text: m.me ? m.text : dd.textContent }; });
    var msg = { html: '<span class="ai-typing"><i></i><i></i><i></i></span> 正在思考…', src: [], pending: true };
    list.push({ me: true, text: q }, msg); render(); after();
    TMS.aiAsk(ctx + '\n问题：' + q, hist, focus).then(function (r) { msg.pending = false; msg.html = '<div class="ai-md">' + kbMd(r.text || '') + '</div>'; msg.src = ['Claude 回答，只读你能看到的数据']; render(); after(); },
      function (e) { var a = rule(); msg.pending = false; msg.html = a.html; msg.src = a.src; toast((e && e.error) || 'AI 暂时不可用', true); render(); after(); });
  }
  function icPush(d, q) {
    var after = function () { setTimeout(function () { var l = document.getElementById('ic-list'); if (l) l.scrollTop = l.scrollHeight; }, 30); };
    if (AI_ON) return aiChatPush(ichat, d.id, '关于想法「' + (d.title || '') + '」（' + L.idea[d.status] + '，发起人 ' + nm(d.creatorId) + '）。原文：' + String(d.note || '').slice(0, 800), q, function () { return ichatAnswer(d, q); }, after, { type: 'idea', id: d.id });
    var a2 = ichatAnswer(d, q); (ichat[d.id] = ichat[d.id] || []).push({ me: true, text: q }, { html: a2.html, src: a2.src }); render(); setTimeout(function () { var l = document.getElementById('ic-list'); if (l) l.scrollTop = l.scrollHeight; var pn = document.getElementById('ic-panel'); if (pn) pn.scrollIntoView({ block: 'nearest' }); }, 30); }
  function digestHTML(d) {
    if (!isOwner()) return '';
    var n = S.suggestions.filter(function (x) { return x.ideaId === d.id; }).length; if (!n) return '';
    var sm = TM.latestSummary(S, d.id, 'digest');
    var newer = sm ? S.suggestions.filter(function (x) { return x.ideaId === d.id && x.at > (sm.payload.lastSugAt || 0); }).length : 0;
    var btn = '<button class="ix2-adopt dg-btn" data-do="ixDigest">' + hi('spark', 1.6) + (sm ? '重新总结' + (newer ? '（有 ' + newer + ' 条新讨论）' : '') : 'AI 总结全部讨论') + '</button>';
    if (!sm) return '<div class="dg">' + btn + '<p class="dg-tip">只有老板能用。AI 会把所有讨论整理成：各人观点、共识、分歧、顾虑和建议下一步。</p></div>';
    var p = sm.payload, w = function (arr) { return arr && arr.length ? '<em>' + esc(arr.join('、')) + '</em>' : ''; };
    var sec = function (t, cls, items) { return items.length ? '<h5 class="' + cls + '">' + t + '</h5><ul>' + items.join('') + '</ul>' : ''; };
    return '<div class="dg ix2-fold"><div class="ix2-advh"><span class="ix2-spark">' + hi('spark', 1.6) + '</span><span><small>AI 讨论总结 · 仅老板可见</small><b>' + p.count + ' 条讨论，' + p.people.length + ' 人参与</b></span></div>' +
      '<h5 class="nx">建议下一步</h5><ol class="dg-next">' + p.next.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' +
      '<div class="dg-body">' +
      sec('共识', 'ok', p.consensus.map(function (c) { return '<li>' + esc(c.point) + w(c.who) + '</li>'; })) +
      sec('分歧', 'bad', p.divergences.map(function (v) { return '<li>' + esc(v.point) + '<ul>' + v.sides.map(function (x) { return '<li>' + esc(x.view) + w(x.who) + '</li>'; }).join('') + '</ul></li>'; })) +
      sec('顾虑与风险', 'warn', p.risks.map(function (c) { return '<li>' + esc(c.point) + w(c.who) + '</li>'; })) +
      sec('待回答的问题', 'warn', p.questions.map(function (c) { return '<li>' + esc(c.point) + w(c.who) + '</li>'; })) +
      '<h5>各人观点</h5>' + p.people.map(function (x) { return '<div class="dg-p"><b>' + esc(x.name) + '</b>' + x.points.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>'; }).join('') +
      refsHTML(p.refs, '相关的公司资料') + '<p class="ix2-advf">第 ' + sm.version + ' 版 · ' + ago(sm.at) + ' · ' + (p.simulated === false ? 'Claude 总结' : 'AI 模拟总结') + '，仅供参考</p></div>' +
      '<button class="ix2-more" data-do="ixFold" aria-expanded="false"><span>展开完整总结</span>' + hi('chev', 2) + '</button>' + btn + '</div>';
  }
  function discHTML(d) {
    var sug = S.suggestions.filter(function (x) { return x.ideaId === d.id; }), can = TM.canSuggest(S, me, d);
    var tops = sug.filter(function (x) { return !x.replyTo; }).sort(function (x, y) { return y.at - x.at; });
    var one = function (x, isReply) { return '<div class="dz-m' + (isReply ? ' re' : '') + '">' + av(x.authorId, true) + '<div><div class="dz-h"><b>' + esc(nm(x.authorId)) + '</b><span>' + ago(x.at) + '</span></div><p>' + esc(x.body) + '</p>' + (can && !isReply ? '<button class="dz-rep" data-do="reply" data-id="' + x.id + '" data-name="' + esc(nm(x.authorId)) + '">回复</button>' : '') + '</div></div>'; };
    var threads = tops.map(function (x, k) { return '<div class="dz-t' + (k >= 2 ? ' more' : '') + '">' + one(x) + sug.filter(function (r) { return r.replyTo === x.id; }).sort(function (p, q) { return p.at - q.at; }).map(function (r) { return one(r, true); }).join('') + '</div>'; }).join('');
    var sm = TM.latestSummary(S, d.id, 'cocreate'), sumHTML = sm && d.status !== 'summary_ready' ? '<div class="dz-more">' + cocreateHTML(d, true) + '</div>' : '';
    var hidden = Math.max(0, tops.length - 2);
    return '<section class="ix2-card ix2-fold dz-card" id="ix-disc"><div class="ix2-sh"><b>' + ti('cmt', 1.7) + '讨论与建议（' + sug.length + '）</b>' + (ichatCan(d) ? '<button class="ic-open' + (ichatOpen[d.id] ? ' on' : '') + '" data-do="icOpen" aria-label="问 AI">' + hi('spark', 1.6) + '<span>问 AI</span></button>' : '<span class="ix2-date">' + (d.shareAll ? '分享给全体' : d.shares && d.shares.length ? '分享给 ' + d.shares.map(nm).join('、') : '') + '</span>') + '</div>' + ichatHTML(d) +
      digestHTML(d) + (tops.length ? '<div class="dz-list">' + threads + '</div>' : '<p class="ix2-empty">还没有人提建议。</p>') + sumHTML +
      (hidden || sumHTML ? '<button class="ix2-more" data-do="ixFold" aria-expanded="false"><span>' + (hidden ? '展开其余 ' + hidden + ' 条讨论' : '展开讨论汇总') + '</span>' + hi('chev', 2) + '</button>' : '') +
      (can ? '<form data-form="suggest" class="dz-form"><input type="hidden" name="replyTo" value=""><div id="replyHint" class="muted" style="font-size:13.5px"></div><textarea name="body" rows="2" placeholder="写下你的建议。讨论中的建议不等于已批准的需求。"></textarea><button class="ix2-btn blue" type="submit">发送</button></form>' : '') + '</section>';
  }
  function ixCanLog(d) { return isOwner() || d.creatorId === me || d.followerId === me; }
  function ixAnalysis(d, p) { var dv = TM.deriveAnalysis(d); return { overview: p.overview || dv.overview, goal: p.goal && p.goal !== '待确认' ? p.goal : dv.goal, issues: p.issues || dv.issues, directions: p.directions || dv.directions }; }
  function viewIdeaAI(d) {
    var sm = TM.latestSummary(S, d.id, 'analysis'), can = (d.followerId === me || isOwner()) && ['triage', 'awaiting_owner'].indexOf(d.status) >= 0;
    var h = ixHead('AI 整理结果', '基于你的想法，整理成清晰的内容') + ixSteps(d);
    if (!sm) return h + (d.aiStatus === 'failed' ? '<div class="callout bad">AI 整理失败。跟进人可以重试，或直接手写整理稿继续推进，不会卡住流程。</div>' : emptyBox('整理稿还没生成。想法提交后，AI 会自动整理。'));
    return h + ixAIBlock(d, sm, true);
  }
  function ixAIBlock(d, sm, page) {
    var fold = !page, can = (d.followerId === me || isOwner()) && ['triage', 'awaiting_owner'].indexOf(d.status) >= 0;
    var p = sm.payload, v = ixAnalysis(d, p), vers = S.summaries.filter(function (x) { return x.ideaId === d.id && x.kind === 'analysis'; }).length;
    var ic = function (path) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>'; };
    var h = '<section class="ix2-card ix2-aiwrap' + (fold ? ' ix2-fold' : '') + '"><div class="ix2-aibar"><span class="ix2-spark">' + hi('spark', 1.6) + '</span><b>AI 智能整理</b>' + (sm.authorType === 'agent' && p.simulated === false ? '<span class="tag ai-real-tag">Claude 整理</span>' : '') + (can ? '<button data-do="ixReAI">' + ic('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>') + '重新整理</button>' : '') + '</div>' +
      '<div class="ix2-sec"><h4>' + ic('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>') + '核心概述</h4><p>' + esc(v.overview) + '</p></div>' +
      '<div class="ix2-sec"><h4>' + ic('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l7-7M16 5h3v3"/>') + '目标</h4><p>' + esc(v.goal) + '</p></div>' +
      '<div class="ix2-sec"><h4>' + ic('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.3v.2"/>') + '当前问题</h4><ul>' + v.issues.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="ix2-sec"><h4>' + ic('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v.5h5V16c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>') + '建议方向</h4><ol>' + v.directions.map(function (x, i) { return '<li><i class="' + (i % 2 ? '' : 'b') + '">' + (i + 1) + '</i>' + esc(x) + '</li>'; }).join('') + '</ol></div>' +
      ((p.open_questions || []).length ? '<div class="ix2-sec warn"><h4>' + ic('<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.2"/>') + '还需要确认</h4><ul>' + p.open_questions.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '') +
      ((p.exception_flags || []).length ? '<div class="callout warn">可能属于例外：' + p.exception_flags.map(function (f) { return L.decision[f]; }).join('、') + '，建议报老板决策。是否上报由跟进人决定。</div>' : p.suggested_route ? '<div class="callout ai">AI 建议：' + esc(L.route[p.suggested_route]) + '。只是建议，派发由人来点。</div>' : '') +
      (TM.kbMatch(S, (d.title || '') + ' ' + d.note, 3).length ? '<div class="ix2-sec kbsec">' + refsHTML(TM.kbMatch(S, (d.title || '') + ' ' + d.note, 3)) + '</div>' : '') + (fold ? '<button class="ix2-more" data-do="ixFold" aria-expanded="false"><span>展开全部</span>' + hi('chev', 2) + '</button>' : '') + '<p class="ix2-foot">整理稿 v' + sm.version + (vers > 1 ? '（共 ' + vers + ' 版）' : '') + ' · ' + (sm.authorType === 'agent' ? 'AI 模拟输出' : esc(TM.name(S, sm.authorId)) + ' 修改') + '</p></section>';
    return h;
  }

  function ideaActions(d) {
    if (!d || !TM.canViewIdea(S, me, d)) return [];
    var a = [], cr = d.creatorId === me, fo = d.followerId === me, ow = isOwner();
    if (d.status === 'draft' && cr) { a.push(['编辑', 'editIdea']); a.push(['提交', 'submitIdea', 'pri']); }
    if (d.status === 'discussing' && cr) a.push(['结束讨论并汇总', 'closeDisc', 'pri']);
    if (d.status === 'summary_ready' && cr) { a.push(['重新讨论', 'reopen']); a.push(['确认方向', 'confirmDir', 'pri']); }
    if (d.status === 'triage' && !d.followerId && TM.canFollow(S, me)) a.push(['认领跟进', 'claim', 'pri']);
    if (d.status === 'triage' && fo) {
      if (d.aiStatus === 'failed') a.push(['重试 AI', 'retryAi']);
      a.push(['改整理稿', 'editSummary']);
      a.push(['更多', 'ideaMore', 'more']);
      a.push(['派发', 'route', 'pri']);
    } else if (d.status === 'triage' && ow) a.push(['暂缓或不做', 'ideaMore']);
    if (d.status === 'awaiting_owner' && ow) { var dc = S.decisions.find(function (x) { return x.ideaId === d.id && x.status === 'pending'; }); if (dc) a.push(['做决定', 'decide', 'pri', dc.id]); }
    if (d.status === 'on_hold' && (fo || ow)) a.push(['重新启用', 'revive', 'pri']);
    return a;
  }

  /* ---------- 页面：事项 ---------- */
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

  var wd = { id: null, tab: 'ov' };
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
      '<section class="wx-hero"><span class="wx-logo">' + '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="14" rx="4" fill="#fff"/><path d="M7.5 15l3-3.2 2.3 2.2 3.7-4" stroke="#4F7BEF" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>' + '</span><div><h1>' + esc(w.title) + '</h1><div class="wx-chips"><i>' + esc(wKindLabel(w)) + '</i><i>' + esc(TM.stageName(w.kind, w.stage)) + '阶段</i><span class="ws ' + st[1] + '">' + st[0] + '</span></div></div></section>' +
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
    if (/进度|到哪|状态|多少|完成了|情况/.test(t)) return { html: '<p>完成 <b>' + p.done + '/' + p.total + '</b> 项任务（' + wPct(w) + '%），当前在<b>' + esc(TM.stageName(w.kind, w.stage)) + '</b>阶段。' + (left == null ? '' : left >= 0 ? '离截止还有 ' + left + ' 天。' : '已超过截止 ' + (-left) + ' 天。') + '</p>' + (open.length ? '<p>还没完成的：</p>' + li(open.slice(0, 5).map(tl)) : ''), src: ['任务'] };
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
  function wTasksTab(w) {
    var vts = S.tasks.filter(function (t) { return t.workId === w.id && TM.canViewTask(S, me, t); });
    var ord = { blocked: 0, submitted: 1, owner_review: 1, in_progress: 2, accepted: 2, assigned: 3, done: 5, cancelled: 6 };
    vts.sort(function (a, b) { return (wtFlag(b) && b.status !== 'done') - (wtFlag(a) && a.status !== 'done') || (ord[a.status] || 4) - (ord[b.status] || 4); });
    var f = wd.tf || 'all', rows = vts.filter(function (t) { return wtIn(f, t); });
    var h = '<div class="wt-chips">' + WTF.map(function (x) { var n = vts.filter(function (t) { return wtIn(x[0], t); }).length; return '<button class="' + (f === x[0] ? 'on' : '') + (x[0] === 'flag' && n ? ' warn' : '') + '" data-do="wTf" data-f="' + x[0] + '">' + x[1] + '<i>' + n + '</i></button>'; }).join('') + '</div>';
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
    if (w.status === 'acceptance' && (w.reviewerId === me || ow)) a.push([w.reviewerId === me ? '确认事项完成' : '老板代验收（确认完成）', 'closeWork']);
    if ((w.leadId === me || (w.kind !== 'product' && w.operatorId === me) || ow) && TM.STAGES[w.kind].length > 1 && ['done', 'cancelled'].indexOf(w.status) < 0) a.push(['推进阶段', 'stage']);
    if (ow && ['planning', 'active', 'acceptance', 'blocked'].indexOf(w.status) >= 0) a.push(['暂停', 'pause']);
    if (ow && w.status === 'paused') a.push(['恢复', 'resume']);
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
    wfOpen: function (el) { var w = W(cur().id), m = (w.files || []).find(function (f) { return f.id === el.dataset.fid; }); if (!m) return;
      if (m.kind === 'link') { if (m.url) openLink(m.url); return; }
      var b = m.localId && blobUrl(m.localId); if (!b) return toast('演示版没有上传，这个文件只在添加它的设备上、刷新前能打开', true);
      if (m.kind === 'image') return openSheet(m.name, '<img src="' + b + '" alt="' + esc(m.name) + '" style="width:100%;border-radius:14px">', '关闭', function () { closeSheet(); });
      if (m.kind === 'audio') return openSheet(m.name, '<audio controls src="' + b + '" style="width:100%"></audio>', '关闭', function () { closeSheet(); });
      if (m.kind === 'video') return openSheet(m.name, '<video controls playsinline src="' + b + '" style="width:100%;border-radius:14px"></video>', '关闭', function () { closeSheet(); });
      openFile(b, m.name); },
    wfDel: function (el) { var w = W(cur().id), m = (w.files || []).find(function (f) { return f.id === el.dataset.fid; }); if (!m) return; openSheet('删除文件', '<p style="margin:0;font-size:14px">确定删除「' + esc(m.name) + '」？删除后项目成员都看不到了。</p>', '删除', function () { act('work.detach', { id: w.id, fid: m.id }, '已删除'); }, true); },
    wShare: function () { var u = location.href; try { navigator.clipboard.writeText(u).then(function () { toast('链接已复制，同事登录后可查看（需有权限）'); }, function () { toast('请手动复制地址栏链接'); }); } catch (e) { toast('请手动复制地址栏链接'); } },
    wMore: function () {
      // 没有可执行的操作时也给可做的事：复制链接、看动态（以前是一个空面板）
      var w = W(cur().id), ops = moreOps(w).concat([['复制项目链接', 'wShare'], ['查看项目动态', 'wLog']]);
      openSheet('更多操作', '<div class="wd-ops">' + ops.map(function (o) { return '<button type="button" class="btn block' + (o[1] === 'pause' || o[1] === 'cancelWork' ? ' danger' : '') + '" data-do="' + o[1] + '">' + o[0] + '</button>'; }).join('') + '</div>', '关闭', function () { closeSheet(); });
    },
    wLog: function () { closeSheet(); var b = document.querySelector('[data-do=wTab][data-t=log]'); if (b) b.click(); },
    wCardMore: function (el) { var w = W(el.dataset.id); openSheet(w.title, '<div class="wd-ops"><a class="btn block" href="#/work/' + w.id + '">打开项目</a>' + (workActions(w).some(function (a) { return a[1] === 'goAssignWork'; }) ? '<button type="button" class="btn block" data-do="goAssignWork" data-arg="' + w.id + '">新建任务</button>' : '') + '</div>', '关闭', function () { closeSheet(); }); },
    wPri: function () { var w = W(cur().id); openSheet('项目优先级', '<div class="opts">' + [['hi', '高'], ['mid', '中'], ['lo', '低']].map(function (p) { return opt('priority', p[0], p[1], '', (w.priority || 'mid') === p[0]); }).join('') + '</div>', '保存', function (o) { act('work.update', { id: w.id, priority: o.priority }, '已更新优先级'); }); },
    wEditText: function (el) { var w = W(cur().id), k = el.dataset.k; openSheet(k === 'goal' ? '项目目标' : '关键成果', field(k === 'goal' ? '项目目标' : '关键成果', '<textarea name="v" rows="3" maxlength="200">' + esc(w[k] || '') + '</textarea>'), '保存', function (o) { var p = { id: w.id }; p[k] = o.v; act('work.update', p, '已保存'); }); },
    wAddMs: function () { var w = W(cur().id); openSheet('添加里程碑', field('名称', '<input type="text" name="title" maxlength="30" placeholder="例如：内部评审">') + field('日期', '<input type="date" name="date" value="' + (w.due || TM.dateAdd(S, 7)) + '">'), '添加', function (o) { act('work.milestone.add', { id: w.id, title: o.title, date: o.date }, '已添加里程碑'); }); },
    wMs: function (el) { act('work.milestone.toggle', { id: cur().id, mid: el.dataset.mid }, '里程碑已更新，成员已收到通知'); }
  };

  /* ---------- 页面：任务详情 ---------- */
  function reviewLine(r) {
    var tone = r.verdict === 'pass' || r.verdict === 'owner_pass' ? 'ok' : r.verdict === 'comment' ? 'prog' : 'bad';
    return '<div class="sug"><div class="h">' + av(r.reviewerId, true) + '<b>' + esc(nm(r.reviewerId)) + '</b><span class="pill t-' + tone + '">' + esc(L.verdict[r.verdict]) + '</span><span>' + ago(r.at) + '</span></div>' + (r.note ? '<p class="b">' + esc(r.note) + '</p>' : '') + '</div>';
  }
  function viewTask(id) {
    var t = T(id);
    if (!t || !TM.canViewTask(S, me, t)) return ixHead('任务详情', '把事情做完、做好') + emptyBox('这个任务不存在，或你没有查看权限。');
    var w = W(t.workId), d = w && w.ideaId ? I(w.ideaId) : null;
    var stp = t.status === 'done' ? 5 : ['submitted', 'owner_review'].indexOf(t.status) >= 0 ? 4 : 3;
    var steps = '<section class="ix-steps ix2-steps">' + ['想法', '整理', '事项', '执行', '验收'].map(function (n, i) { var href = i === 0 && d && TM.canViewIdea(S, me, d) ? '#/idea/' + d.id : i === 2 ? '#/work/' + w.id : null; return '<div ' + (href ? 'role="link" tabindex="0" data-do="goH" data-h="' + href + '" style="cursor:pointer" ' : '') + 'class="' + (i < stp ? 'done' : i === stp ? 'cur' : '') + '"><i>' + (i < stp ? ni('check', 2.6) : '') + '</i><span>' + n + '</span></div>'; }).join('') + '</section>';
    var od = TM.isOverdue(S, t), st = TM.isStale(S, t), nx = TM.nextForTask(S, t), mine = t.ownerId === me;
    var IC = function (path, c) { return '<svg viewBox="0 0 24 24" fill="none" stroke="' + (c || 'currentColor') + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>'; };
    var h = ixHead('任务详情', '把事情做完、做好') + steps +
      '<section class="ix2-card ix2-main"><div class="tx-chips">' + pill('task', t.status) + '<i>' + esc(L.kind[w.kind]) + '</i>' + (t.priority === 'hi' ? '<i class="r">高优先级</i>' : '') + (od ? '<i class="r">已逾期</i>' : '') + (st ? '<i class="r">' + S.settings.staleDays + ' 天以上无动态</i>' : '') + '</div>' +
      '<h2>' + esc(t.title) + '</h2>' + ((w.leadId === me || w.operatorId === me || isOwner()) && ['done', 'cancelled'].indexOf(t.status) < 0 && w.status !== 'paused' ? '<button type="button" class="btn ghost tx-edit" data-do="taskEdit">编辑任务</button>' : '') + '<a class="tx-work" href="#/work/' + w.id + '">' + IC('<path d="M3.8 8.2a2.7 2.7 0 0 1 2.7-2.7h3l2 2.2h6a2.7 2.7 0 0 1 2.7 2.7v6.9a2.7 2.7 0 0 1-2.7 2.7h-11a2.7 2.7 0 0 1-2.7-2.7z"/>') + '<span>属于项目</span><b>' + esc(w.title) + '</b>' + hi('chev', 2) + '</a>' +
      (t.status === 'blocked' ? '<div class="callout bad" style="margin-top:10px">受阻：' + esc(t.blockedReason) + '</div>' : '') +
      (nx ? '<div class="ix-next ix2-next tx-next">' + av(nx.who, true) + '下一步：<b>' + esc(nx.who === me ? '你' : nm(nx.who)) + '</b> ' + esc(nx.what) + '</div>' : '') + '</section>';
    var row = function (icon, label, val, full) { return '<div class="wx-r' + (full ? ' full' : '') + '"><span class="wx-ri">' + icon + '</span><span class="wx-rl">' + label + '</span><span class="wx-rv">' + val + '</span></div>'; };
    h += '<section class="ix2-card"><div class="ix2-sh"><b>' + IC('<path d="M9 5h10M9 12h10M9 19h10M4.5 5l.8.8L7 4M4.5 12l.8.8L7 11M4.5 19l.8.8L7 18"/>') + (mine ? '你负责什么' : '任务要求') + '</b></div>' +
      '<div class="tx-req"><div><small>预期成果</small><p>' + esc(t.expected) + '</p></div><div><small>验收标准</small><p>' + esc(t.criteria) + '</p></div>' + (t.description ? '<div><small>说明</small><p>' + esc(t.description) + '</p></div>' : '') + '</div>' +
      '<div class="wx-grid tx-grid"><div>' + row(IC('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-3.6 3.6-5.5 7-5.5s6 1.9 7 5.5"/>'), '负责人', av(t.ownerId, true) + esc(nm(t.ownerId))) + row(IC('<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>'), '截止', t.due ? esc(dueTxt(t.due)) : '<em>未设置</em>') + '</div><div>' +
      row(IC('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'), '验收人', av(t.reviewerId, true) + esc(nm(t.reviewerId))) + row(IC('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5"/>'), '协作者', t.collabs.length ? esc(t.collabs.map(nm).join('、')) : '<em>无</em>') + '</div></div></section>';
    var cl = S.checklist.filter(function (c) { return c.taskId === t.id; });
    var canCheck = (mine || t.collabs.indexOf(me) >= 0) && ['accepted', 'in_progress', 'blocked'].indexOf(t.status) >= 0;
    var canAdd = (mine || t.collabs.indexOf(me) >= 0 || w.leadId === me || w.operatorId === me) && t.status !== 'done' && t.status !== 'cancelled';
    if (cl.length || canAdd) {
      var nd = cl.filter(function (c) { return c.done; }).length;
      h += '<section class="ix2-card"><div class="ix2-sh"><b>' + IC('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.2l2.3 2.3 4.6-4.8"/>') + '子任务</b><span class="ix2-date">' + nd + ' / ' + cl.length + '</span></div>' + (cl.length ? '<div class="wx-bar tx-bar"><i style="width:' + Math.round(nd / cl.length * 100) + '%"></i></div>' : '') +
        cl.map(function (c) { return '<div class="chk tx-chk' + (c.done ? ' on' : '') + '" ' + (canCheck ? 'role="checkbox" tabindex="0" aria-checked="' + c.done + '" data-do="check" data-id="' + c.id + '"' : 'style="cursor:default"') + '><i></i><span>' + esc(c.title) + '</span></div>'; }).join('') +
        (canAdd ? '<form data-form="addCheck" class="tx-add"><input type="text" name="title" placeholder="加一个子任务" aria-label="子任务"><button class="ix2-btn" type="submit">添加</button></form>' : '') +
        (!canCheck && cl.length && mine && t.status === 'assigned' ? '<p class="ix2-empty" style="margin-top:6px">接收任务后可以勾选。</p>' : '') + '</section>';
    }
    var dv = S.deliverables.filter(function (x) { return x.taskId === t.id; });
    if (dv.length) h += '<section class="ix2-card"><div class="ix2-sh"><b>' + pi('clip') + '交付物（' + dv.length + '）</b></div>' + dv.map(function (x) { return '<div class="dz-m tx-dv">' + av(x.by, true) + '<div><div class="dz-h"><b>' + esc(nm(x.by)) + '</b><span>' + ago(x.at) + '</span></div>' + (x.note ? '<p>' + esc(x.note) + '</p>' : '') + dvMediaHTML(x) + (x.url ? '<a class="tx-url" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.url) + '</a>' : '') + '</div></div>'; }).join('') + '</section>';
    var rv = S.reviews.filter(function (r) { return r.taskId === t.id; });
    if (rv.length) h += '<section class="ix2-card"><div class="ix2-sh"><b>' + IC('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>') + '验收记录</b><span class="ix2-date">只追加，不可改</span></div><div class="tx-rv">' + rv.map(reviewLine).join('') + '</div></section>';
    var cm = S.comments.filter(function (c) { return c.taskId === t.id; });
    h += '<section class="ix2-card"><div class="ix2-sh"><b>' + ti('cmt', 1.7) + '沟通（' + cm.length + '）</b></div>' + (cm.length ? cm.map(function (c) { return '<div class="dz-t"><div class="dz-m">' + av(c.authorId, true) + '<div><div class="dz-h"><b>' + esc(nm(c.authorId)) + '</b><span>' + ago(c.at) + '</span></div><p>' + esc(c.body) + '</p></div></div></div>'; }).join('') : '<p class="ix2-empty">还没有沟通记录。</p>') +
      '<form data-form="comment" class="dz-form"><textarea name="body" rows="2" placeholder="反馈问题或补充说明"></textarea><button class="ix2-btn blue" type="submit">发送</button></form></section>';
    var evs = S.events.filter(function (e) { return e.taskId === t.id; }).sort(function (x, y) { return y.at - x.at; });
    if (evs.length) h += '<section class="ix2-card ix2-fold tx-log"><div class="ix2-sh"><b>' + IC('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>') + '动态</b><span class="ix2-date">' + evs.length + ' 条</span></div><ol class="wx-tl">' + evs.map(function (e, i) { return '<li class="' + (i ? '' : 'on') + (i >= 3 ? ' more' : '') + '"><b>' + esc(e.text || e.action) + '</b><small>' + esc(e.actorType === 'human' ? nm(e.actorId) : e.actorType === 'agent' ? 'AI 助理' : '系统') + ' · ' + ago(e.at) + '</small></li>'; }).join('') + '</ol>' + (evs.length > 3 ? '<button class="ix2-more" data-do="ixFold" aria-expanded="false"><span>展开全部动态</span>' + hi('chev', 2) + '</button>' : '') + '</section>';
    return h;
  }
  function taskActions(t) {
    if (!t || !TM.canViewTask(S, me, t)) return [];
    var w = W(t.workId), a = [], o = t.ownerId === me, ow = isOwner();
    if (w.status === 'paused') return ow ? [['恢复事项', 'resume', 'pri', w.id]] : [];
    if (o && t.status === 'assigned') { a.push(['报阻碍', 'block']); a.push(['接收任务', 'tt', 'pri', 'accept']); }
    if (o && t.status === 'accepted') { a.push(['报阻碍', 'block']); a.push(['开始执行', 'tt', 'pri', 'start']); }
    if (o && t.status === 'in_progress') { a.push(['报阻碍', 'block']); a.push(['提交成果', 'submit', 'pri']); }
    if (t.status === 'blocked' && (o || w.operatorId === me || w.leadId === me || ow)) a.push(['解除阻碍', 'tt', 'pri', 'unblock']);
    if (t.status === 'submitted' && t.reviewerId === me) { a.push(['退回', 'review', 'danger', 'return']); a.push(['验收通过', 'review', 'pri', 'pass']); }
    if (t.status === 'owner_review' && ow) { a.push(['退回', 'ownerReview', 'danger', 'owner_return']); a.push(['终验通过', 'ownerReview', 'pri', 'owner_pass']); }
    if (ow && t.status !== 'cancelled') a.push(['纠偏', 'override', 'danger']);
    if ((w.operatorId === me || w.leadId === me || ow) && ['done', 'cancelled', 'owner_review'].indexOf(t.status) < 0 && !(ow && a.length > 2)) a.push(['取消任务', 'cancelTask']);
    return a;
  }

  /* ---------- 页面：通知、设置 ---------- */
  function nKind(n) { var t = n.title + n.body; return /决策/.test(t) ? 'dec' : /@|提到了你/.test(t) ? 'at' : /邀请|加入|新成员/.test(t) ? 'team' : /进度|完成|里程碑|阶段|事项/.test(n.title) ? 'proj' : /待办|评论|留言|建议|提醒/.test(t) ? 'cmt' : 'sys'; }
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
    h += sec('报表') + '<div class="card"><p class="muted" style="margin:0 0 10px;font-size:14px">导出成表格，用 Excel、WPS 或 Numbers 打开。</p><button class="btn block" data-do="csvTasks">导出任务表</button><button class="btn block mt" data-do="csvWorks">导出项目表</button></div>';
    h += SRV ? sec('数据') + '<div class="card"><p class="muted" style="margin:0 0 10px;font-size:14px">服务器：' + esc(TMS.serverUrl()) + '</p><button class="btn block" data-do="srvUsage">使用情况（AI 费用、设备、空间）</button><button class="btn block mt" data-do="srvOps">操作日志（谁做了什么）</button>' + (isOwner() ? '<button class="btn block mt" data-do="srvExportFull">完整备份（含全部附件，压缩包）</button><button class="btn block mt" data-do="srvExport">只导出团队数据（JSON）</button>' : '') + '<div class="mt"></div>' + (isOwner() && !S.real ? '<button class="btn danger block" data-do="clearDemo">清理演示数据</button>' : '<p class="muted" style="margin:0;font-size:13.5px">数据每天自动备份在服务器的 backups 目录。</p>') + '</div>' :
      sec('演示工具') + '<div class="card">' + sw('demoAiFail', '模拟 AI 失败', '用来演示「AI 失败后运营者手写整理稿继续推进」。') +
      '<div class="callout">演示版里：账号是预设的；AI 整理和共创汇总由规则模拟生成，界面都标了「AI 模拟输出」；录音只在本机，不上传、不转写；通知只在 App 内。</div>' +
      (isOwner() ? '<button class="btn block" data-do="clearDemo">清理演示数据（保留成员）</button>' : '') + '<button class="btn danger block mt" data-do="reset">重置全部演示数据</button></div>';
    if (TM.hasRole(S, me, 'admin') || isOwner()) h += membersHTML();
    h += '</div>';
    return h;
  }

  /* ---------- 弹层 ---------- */
  var sheetHandler = null;
  function openSheet(title, body, submitLabel, onSubmit, danger) {
    var layer = document.getElementById('layer');
    layer.innerHTML = '<div class="scrim" data-do="closeSheet"></div><form class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><header><h2>' + esc(title) + '</h2><button type="button" class="circle" data-do="closeSheet" aria-label="关闭">×</button></header><div class="body">' + wordsFix(body) + '</div>' +
      // 只用来查看的面板（主按钮就是「关闭」）：不再多放一个作用相同的「取消」
      '<footer>' + (/^(关闭|知道了|好的)$/.test(submitLabel) ? '' : '<button type="button" class="btn" data-do="closeSheet">' + (/取消/.test(submitLabel) ? '返回' : '取消') + '</button>') + '<button type="submit" class="btn ' + (danger ? 'danger' : 'pri') + '">' + esc(submitLabel) + '</button></footer></form>';
    sheetHandler = onSubmit;
    requestAnimationFrame(function () { var sc = layer.querySelector('.scrim'), sh = layer.querySelector('.sheet'); if (!sc || !sh) return; sc.classList.add('on'); sh.classList.add('on'); var f = layer.querySelector('.sheet .body input:not([type=hidden]):not([type=radio]):not([type=checkbox]),.sheet .body textarea'); if (f && window.innerWidth > 700) f.focus(); });
  }
  // 应用内的确认面板（代替系统对话框：系统对话框按钮跟手机语言走，样式也不统一）。确认 → true；取消 / 关闭 → false
  var askDone = null;
  function askSheet(title, html, okLabel, danger) {
    return new Promise(function (resolve) {
      openSheet(title, '<p style="margin:0;font-size:15px;line-height:1.6">' + html + '</p>', okLabel || '确定', function () { askDone = null; closeSheet(); resolve(true); }, danger);
      askDone = function () { resolve(false); };
    });
  }
  function closeSheet() {
    if (askDone) { var ad = askDone; askDone = null; ad(); }
    var l = document.getElementById('layer'), sh = l.querySelector('.sheet.on');
    // 关闭时先把弹窗移到一个只负责播放收起动画的层里，原来的层立刻清空（后续逻辑和新弹窗不受影响）
    if (sh && animOK()) {
      var g = document.getElementById('layer-out');
      if (!g) { g = document.createElement('div'); g.id = 'layer-out'; g.setAttribute('aria-hidden', 'true'); document.body.appendChild(g); }
      g.innerHTML = ''; while (l.firstChild) g.appendChild(l.firstChild);
      requestAnimationFrame(function () { Array.prototype.forEach.call(g.querySelectorAll('.scrim,.sheet'), function (e) { e.classList.remove('on'); }); });
      clearTimeout(closeSheet.t); closeSheet.t = setTimeout(function () { g.innerHTML = ''; }, 300);
    }
    l.innerHTML = ''; sheetHandler = null;
  }
  function fd(form) { var o = {}; new FormData(form).forEach(function (v, k) { if (o[k] !== undefined) { o[k] = [].concat(o[k], v); } else o[k] = v; }); return o; }
  function opt(name, val, title, desc, checked) { return '<label class="opt"><input type="radio" name="' + name + '" value="' + val + '"' + (checked ? ' checked' : '') + '><span><b>' + title + '</b>' + (desc ? '<small>' + desc + '</small>' : '') + '</span></label>'; }
  function userSelect(name, uids, sel) { return '<select name="' + name + '">' + uids.map(function (id) { return '<option value="' + id + '"' + (id === sel ? ' selected' : '') + '>' + esc(nm(id)) + '（' + esc(TM.user(S, id).title) + '）</option>'; }).join('') + '</select>'; }
  function field(label, inner, help) { return '<label class="fld"><span>' + label + '</span>' + inner + (help ? '<small>' + help + '</small>' : '') + '</label>'; }
  function taskFields(prefix, def) {
    def = def || {};
    var execs = TM.activeUsers(S).filter(function (u) { return u.roles.some(function (a) { return a.role === 'executor' || a.role === 'lead' || a.role === 'operator'; }); }).map(function (u) { return u.id; });
    return field('任务', '<input type="text" name="' + prefix + 'title" value="' + esc(def.title || '') + '" required>') +
      field('主负责人', userSelect(prefix + 'ownerId', execs, def.ownerId)) +
      field('预期成果', '<input type="text" name="' + prefix + 'expected" value="' + esc(def.expected || '') + '" placeholder="比如：照片 + 测速截图">') +
      field('验收标准', '<textarea name="' + prefix + 'criteria" rows="2" placeholder="怎样算通过">' + esc(def.criteria || '') + '</textarea>') +
      field('截止日期', '<input type="date" name="' + prefix + 'due" value="' + esc(def.due || TM.dateAdd(S, 3)) + '">');
  }

  var DO = {
    login: function (el) { me = el.dataset.id; try { localStorage.setItem(KU, me); } catch (e) {} filt = { ideas: 'all', work: null }; location.hash = '#/home'; render(); },
    switch: function () { if (SRV) return DO.srvLogout();
      me = null; try { localStorage.removeItem(KU); } catch (e) {} location.hash = '#/login'; render(); },
    closeSheet: closeSheet,
    ideasFilter: function (el) { filt.ideas = el.dataset.f; if (location.hash !== '#/ideas') location.hash = '#/ideas'; else render(); },
    workFilter: function (el) { filt.work = el.dataset.f; if (location.hash !== '#/work') location.hash = '#/work'; else render(); },
    goMe: function () { location.hash = '#/me'; },
    readAll: function () { act('notif.read', {}); },
    readOne: function (el) { TM.act(S, me, 'notif.read', { id: el.dataset.id }); save(); return true; },
    reset: function () { if (!myCaps().resetData) return toast('只有老板或管理员可以重置数据', true); askSheet('重置演示数据', '重置后，所有演示操作都会清空，回到初始示例数据。确定吗？', '重置', true).then(function (y) { if (y) { S = TM.seed(); save(); toast('已重置演示数据'); render(); } }); },
    recStart: startRec, recStop: stopRec,
    rmMedia: function (el) { newMedia.splice(+el.dataset.i, 1); render(); },
    reply: function (el) { var f = document.querySelector('form[data-form=suggest]'); if (!f) return; f.replyTo.value = el.dataset.id; document.getElementById('replyHint').innerHTML = '回复 ' + esc(el.dataset.name || '') + ' <button type="button" class="link" data-do="replyCancel">取消回复</button>'; f.body.focus(); },
    replyCancel: function () { var f = document.querySelector('form[data-form=suggest]'); if (f) f.replyTo.value = ''; var h = document.getElementById('replyHint'); if (h) h.textContent = ''; },
    check: function (el) { act('task.check', { id: cur().id, itemId: el.dataset.id }); },

    editIdea: function () { var d = I(cur().id); openSheet('编辑草稿', field('标题', '<input type="text" name="title" value="' + esc(d.title) + '">') + field('想法', '<textarea name="note" rows="6">' + esc(d.note) + '</textarea>'), '保存', function (o) { act('idea.update', { id: d.id, title: o.title, note: o.note }, '已保存'); }); },
    submitIdea: function () { submitSheet(cur().id); },
    closeDisc: function () { var d = I(cur().id); openSheet('结束讨论', '<p>结束后不能再提建议。AI 会汇总共识、分歧、风险和待澄清点，每条都标注来源建议，交给你确认方向。</p><div class="callout">演示版的汇总由规则模拟生成，会标明「AI 模拟输出」。</div>', '结束并汇总', function () { act('idea.close', { id: d.id }, '汇总完成，请确认方向'); }); },
    reopen: function () { act('idea.reopen', { id: cur().id }, '已重新开放讨论'); },
    confirmDir: function () {
      var d = I(cur().id), sm = TM.latestSummary(S, d.id, 'cocreate');
      openSheet('确认最终方向', '<p class="muted" style="font-size:14.5px">只需确认一次。确认后进入运营整理，由运营者认领推进。</p>' + field('最终方向', '<textarea name="direction" rows="4">' + esc(sm ? sm.payload.proposed_direction.replace('（供发起人确认，不代表团队共识）', '') : '') + '</textarea>', '请根据汇总改写成你认可的方向。'), '确认方向', function (o) { act('idea.confirm', { id: d.id, direction: o.direction }, '方向已确认，已交运营整理'); });
    },
    claim: function () { act('idea.claim', { id: cur().id }, '已认领，你是跟进人'); },
    retryAi: function () { act('idea.retryAi', { id: cur().id }, '已重试'); },
    editSummary: function () {
      var d = I(cur().id), sm = TM.latestSummary(S, d.id, 'analysis'), p = sm ? sm.payload : { title: d.title, category: 'admin' };
      openSheet('修改整理稿', field('标题', '<input type="text" name="title" value="' + esc(p.title || d.title) + '">') +
        '<div class="fld"><span>类别</span><div class="opts">' + opt('category', 'admin', '行政', '运营者可直接派发', p.category === 'admin') + opt('category', 'product', '产品', '交项目负责人', p.category === 'product') + opt('category', 'other', '其他', '', p.category === 'other') + '</div></div>' +
        field('背景', '<textarea name="background" rows="2">' + esc(p.background || '') + '</textarea>') + field('真实问题', '<textarea name="problem" rows="2">' + esc(p.problem || '') + '</textarea>') +
        field('目标', '<input type="text" name="goal" value="' + esc(p.goal || '') + '">') + field('与公司方向的关系', '<textarea name="relation" rows="2">' + esc(p.relation_to_direction || '') + '</textarea>') +
        field('待澄清（每行一条）', '<textarea name="oq" rows="2">' + esc((p.open_questions || []).join('\n')) + '</textarea>'), '保存为新版本',
        function (o) {
          var np = Object.assign({}, p, { title: o.title, category: o.category, background: o.background, problem: o.problem, goal: o.goal, relation_to_direction: o.relation, open_questions: (o.oq || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean) });
          act('idea.saveSummary', { id: d.id, payload: np }, '已保存新版本整理稿');
        });
    },
    route: function () { routeSheet(cur().id); },
    ideaMore: function () {
      var d = I(cur().id), fo = d.followerId === me, ow = isOwner();
      openSheet('还可以', '<div class="opts">' + (fo ? opt('what', 'escalate', '上报老板决策', '属于战略变更、超预算、人事、重要对外发布', true) : '') +
        opt('what', 'on_hold', '暂缓', '先放一放，之后可重新启用', !fo) + opt('what', 'declined', '不做', ow ? '老板可直接决定' : '需要已征得发起人同意') + '</div>' +
        '<div id="moreExtra">' + (fo ? escalateFields(d) : '') + '</div>' + field('原因', '<textarea name="reason" rows="2" placeholder="暂缓或不做时必填"></textarea>') +
        (!ow ? '<label class="opt mt"><input type="checkbox" name="agreed" value="1"><span><b>已征得发起人同意</b><small>选择「不做」时需要</small></span></label>' : ''), '确定',
        function (o) {
          if (o.what === 'escalate') act('idea.requestDecision', { id: d.id, kind: o.kind, question: o.question }, '已上报老板');
          else act('idea.setStatus', { id: d.id, status: o.what, reason: o.reason, creatorAgreed: !!o.agreed }, o.what === 'on_hold' ? '已暂缓' : '已标记为不做');
        });
    },
    revive: function () { var d = I(cur().id); openSheet('重新启用', field('原因', '<textarea name="reason" rows="2"></textarea>'), '重新启用', function (o) { act('idea.setStatus', { id: d.id, status: 'triage', reason: o.reason }, '已重新启用'); }); },
    decide: function (el) {
      var dc = S.decisions.find(function (x) { return x.id === el.dataset.arg; });
      var adv = TM.decisionAdvice(S, dc);
      openSheet('老板决策', '<div class="lead" style="font-size:17px">' + esc(dc.question) + '</div><p class="muted" style="font-size:14px">' + esc(L.decision[dc.kind]) + '，' + esc(TM.name(S, dc.requestedBy)) + ' 上报</p>' + advHTML(dc, false) + '<button type="button" class="ix2-adopt" data-do="advAdopt" data-v="' + adv.verdict + '" data-n="' + esc(adv.note) + '">' + hi('spark', 1.6) + '采用 AI 建议（' + esc(adv.label) + '）</button><div class="opts">' +
        opt('status', 'approved', '批准', '回到运营者继续派发', true) + opt('status', 'needs_info', '要求补充', '回到运营者补充后再推进') + opt('status', 'rejected', '否决', '想法标记为不做') + '</div>' + field('意见', '<textarea name="note" rows="3" placeholder="否决或要求补充时必填"></textarea>'), '提交决定',
        function (o) { act('decision.decide', { id: dc.id, status: o.status, note: o.note }, '决定已记录，相关人已收到通知'); });
    },
    plan: function () {
      var w = W(cur().id);
      openSheet('添加任务', taskFields('', { reviewerId: w.reviewerId }) + field('验收人', userSelect('reviewerId', TM.activeUsers(S).filter(function (u) { return u.roles.some(function (a) { return a.role !== 'admin'; }); }).map(function (u) { return u.id; }), w.reviewerId)), '派出任务',
        function (o) { act('work.plan', { id: w.id, tasks: [{ title: o.title, ownerId: o.ownerId, expected: o.expected, criteria: o.criteria, due: o.due, reviewerId: o.reviewerId }] }, '任务已派出'); });
    },
    stage: function () {
      var w = W(cur().id);
      openSheet('推进阶段', '<div class="opts">' + TM.STAGES[w.kind].map(function (x) { return opt('stage', x[0], x[1], x[0] === w.stage ? '当前阶段' : '', x[0] === w.stage); }).join('') + '</div>' + field('说明（可选）', '<input type="text" name="note">'), '更新阶段',
        function (o) { act('work.stage', { id: w.id, stage: o.stage, note: o.note }, '阶段已更新'); });
    },
    closeWork: function () { var w = W(cur().id); openSheet('确认事项完成', '<p>事项下的任务已全部验收通过。确认后事项完成，老板和发起人会收到通知。</p>' + field('验收意见（可选）', '<textarea name="note" rows="2"></textarea>'), '确认完成', function (o) { act('work.close', { id: w.id, note: o.note }, '事项已完成'); }); },
    taskEdit: function () {
      var t = T(cur().id), w = W(t.workId), revs = TM.activeUsers(S).filter(function (u) { return u.id !== t.ownerId && !u.roles.every(function (a) { return a.role === 'admin'; }); }).map(function (u) { return u.id; });
      openSheet('编辑任务', field('任务', '<input type="text" name="title" maxlength="50" value="' + esc(t.title) + '" required>') +
        field('截止日期', '<input type="date" name="due" value="' + esc(t.due || '') + '">') +
        '<div class="fld"><span>优先级</span><div class="opts">' + [['hi', '高'], ['mid', '中'], ['lo', '低']].map(function (x) { return opt('priority', x[0], x[1], '', (t.priority || 'mid') === x[0]); }).join('') + '</div></div>' +
        field('验收人', userSelect('reviewerId', revs, t.reviewerId)) +
        field('预期成果', '<input type="text" name="expected" value="' + esc(t.expected || '') + '" required>') +
        field('验收标准', '<textarea name="criteria" rows="2" required>' + esc(t.criteria || '') + '</textarea>') +
        field('说明（可选）', '<textarea name="description" rows="3">' + esc(t.description || '') + '</textarea>'), '保存', function (o) {
          act('task.update', { id: t.id, title: o.title, due: o.due || null, priority: o.priority, reviewerId: o.reviewerId, expected: o.expected, criteria: o.criteria, description: o.description }, '任务已修改，执行人已收到通知');
        });
    },
    wReassign: function () {
      var w = W(cur().id), ow = isOwner(), act0 = TM.activeUsers(S);
      var leads = TM.leadUsers(S), ops = act0.filter(function (u) { return TM.canFollow(S, u.id); }).map(function (u) { return u.id; }), revs = act0.filter(function (u) { return !u.roles.every(function (a) { return a.role === 'admin'; }); }).map(function (u) { return u.id; });
      openSheet('更换项目人员', '<div class="callout">更换后会写进项目动态，并通知新旧双方。</div>' +
        (ow && w.leadId ? field('项目负责人', userSelect('leadId', leads, w.leadId)) : '') + (ow ? field('跟进运营', userSelect('operatorId', ops, w.operatorId)) : '') +
        field('验收人', userSelect('reviewerId', revs, w.reviewerId)), '保存', function (o) {
          var pl = { id: w.id }; ['leadId', 'operatorId', 'reviewerId'].forEach(function (k) { if (o[k] && o[k] !== w[k]) pl[k] = o[k]; });
          if (Object.keys(pl).length === 1) return closeSheet();
          act('work.reassign', pl, '已更换，相关人已收到通知');
        });
    },
    cancelWork: function () { var w = W(cur().id), n = S.tasks.filter(function (t) { return t.workId === w.id && ['done', 'cancelled'].indexOf(t.status) < 0; }).length;
      openSheet('取消项目', '<div class="callout warn">取消后项目不能再操作' + (n ? '，' + n + ' 个未完成的任务会一并取消' : '') + '，相关人会收到通知，记录保留。来源想法会转为「暂缓」。</div>' + field('原因', '<textarea name="reason" rows="3" required></textarea>'), '确认取消', function (o) { act('work.cancel', { id: w.id, reason: o.reason }, '项目已取消'); }, true); },
    pause: function () { var w = W(cur().id); openSheet('暂停事项（纠偏）', '<div class="callout warn">暂停后所有任务不能操作，相关人会收到通知，原记录保留。</div>' + field('原因', '<textarea name="reason" rows="3"></textarea>'), '暂停', function (o) { act('work.pause', { id: w.id, reason: o.reason }, '已暂停'); }, true); },
    resume: function (el) { act('work.resume', { id: el.dataset.arg || cur().id }, '已恢复'); },
    tt: function (el) { var a = el.dataset.arg; act('task.transition', { id: cur().id, action: a }, { accept: '已接收', start: '已开始', unblock: '阻碍已解除' }[a]); },
    block: function () { openSheet('报阻碍', field('卡在哪里', '<textarea name="note" rows="3" placeholder="写清楚原因和需要谁帮忙"></textarea>', '跟进人和负责人会收到通知。'), '报阻碍', function (o) { act('task.transition', { id: cur().id, action: 'block', note: o.note }, '已报阻碍，跟进人已收到通知'); }, true); },
    submit: function () {
      var t = T(cur().id);
      dvPick = [];
      openSheet('提交成果', '<div class="callout">验收标准：' + esc(t.criteria) + '</div>' + field('成果说明', '<textarea name="note" rows="3" placeholder="做了什么、结果如何"></textarea>') +
        '<div class="fld"><span>照片 / 文件（可选）</span><div class="dv-pick"><label class="btn">' + ai2('img', 1.6) + '拍照<input type="file" accept="image/*" capture="environment" data-dvfile="1" hidden></label><label class="btn">' + ai2('doc2', 1.6) + '选照片或文件<input type="file" multiple data-dvfile="1" hidden></label></div><div id="dv-files"></div><small>' + (SRV ? '会上传到团队服务器，验收人能直接打开。' : '演示版：文件只保存在这台设备。') + '</small></div>' +
        field('链接（可选）', '<input type="url" name="url" placeholder="https://">'), '提交给 ' + nm(t.reviewerId),
        function (o) { var media = dvPick.slice(); dvPick = []; act('task.transition', { id: t.id, action: 'submit', note: o.note, url: o.url, media: media }, '已提交，等待验收'); });
    },
    review: function (el) {
      var v = el.dataset.arg, t = T(cur().id);
      openSheet(v === 'pass' ? '验收通过' : '退回修改', '<div class="callout">验收标准：' + esc(t.criteria) + '</div>' + field('意见', '<textarea name="note" rows="3" placeholder="' + (v === 'pass' ? '比如：符合标准' : '写清楚哪里不达标') + '"></textarea>', '验收记录只追加，不能修改。'), v === 'pass' ? '通过' : '退回',
        function (o) { act('task.review', { id: t.id, verdict: v, note: o.note }, v === 'pass' ? '验收通过' : '已退回'); }, v !== 'pass');
    },
    ownerReview: function (el) { var v = el.dataset.arg; openSheet(v === 'owner_pass' ? '终验通过' : '终验退回', field('意见', '<textarea name="note" rows="3"></textarea>'), v === 'owner_pass' ? '通过' : '退回', function (o) { act('task.ownerReview', { id: cur().id, verdict: v, note: o.note }, '终验已记录'); }, v !== 'owner_pass'); },
    override: function () {
      var t = T(cur().id), done = t.status === 'done';
      var people = TM.activeUsers(S).filter(function (u) { return u.id !== t.ownerId && u.roles.some(function (a) { return a.role !== 'admin' && a.role !== 'owner'; }); }).map(function (u) { return u.id; });
      openSheet('老板纠偏', '<div class="callout warn">纠偏必须填写原因。相关人都会收到通知，原记录保留。</div><div class="opts">' + (done ? opt('action', 'revoke', '撤销验收', '任务回到执行中，事项重新打开', true) : '') +
        (!done ? opt('action', 'reassign', '改派', '换一个主负责人，任务回到待接收', true) : '') + '</div>' + (!done ? field('改派给', userSelect('ownerId', people)) : '') + field('原因', '<textarea name="reason" rows="3"></textarea>'), '执行纠偏',
        function (o) { act('owner.override', { id: t.id, action: o.action, ownerId: o.ownerId, reason: o.reason }, '纠偏已执行，相关人已收到通知'); }, true);
    },
    cancelTask: function () { openSheet('取消任务', field('原因', '<textarea name="reason" rows="3"></textarea>'), '确认取消任务', function (o) { act('task.transition', { id: cur().id, action: 'cancel', note: o.reason }, '任务已取消'); }, true); }
  };
  function escalateFields(d) {
    var sm = TM.latestSummary(S, d.id, 'analysis'), fl = sm && sm.payload.exception_flags && sm.payload.exception_flags[0];
    return field('例外类型', '<select name="kind">' + ['strategy_change', 'over_budget', 'personnel', 'major_release', 'other'].map(function (k) { return '<option value="' + k + '"' + (k === fl ? ' selected' : '') + '>' + L.decision[k] + '</option>'; }).join('') + (S.settings.ownerApprovalMode === 'all' ? '<option value="approval_all" selected>派发前确认</option>' : '') + '</select>') +
      field('要老板决定什么', '<textarea name="question" rows="2">' + esc('是否同意推进：' + d.title) + '</textarea>');
  }
  function submitSheet(id) {
    var d = I(id), others = TM.activeUsers(S).filter(function (u) { return u.id !== me && !u.roles.every(function (a) { return a.role === 'admin'; }); });
    openSheet('提交想法', '<div class="opts">' + opt('path', 'direct', '直接推进', 'AI 整理后进入运营待认领队列', true) + opt('path', 'cocreate', '先给团队共创', '团队提建议，结束后 AI 汇总，你确认一次方向') + '</div>' +
      '<div id="coBox" hidden><div class="fld"><span>分享给</span><div class="opts">' + opt('share', 'all', '全体成员', '', true) + opt('share', 'some', '指定人员', '') + '</div></div>' +
      '<div class="fld"><span>指定人员</span><div class="who">' + others.map(function (u) { return '<label><input type="checkbox" name="shares" value="' + u.id + '">' + av(u.id, true) + esc(u.name) + '</label>'; }).join('') + '</div></div>' +
      field('截止时间（可选）', '<input type="date" name="deadline">', '不填则由你手动结束讨论。') + '<div class="callout">参与者默认看不到你的原始录音，只看文字说明和 AI 整理稿。</div></div>', '提交',
      function (o) {
        var p = { id: d.id, path: o.path };
        if (o.path === 'cocreate') { p.shareAll = o.share !== 'some'; p.shares = [].concat(o.shares || []); p.deadline = o.deadline || null; }
        var r = act('idea.submit', p, o.path === 'direct' ? '已提交，AI 已整理，等待运营者认领' : '已开启共创，团队已收到邀请');
        if (r.ok) location.hash = '#/idea/' + d.id;
      });
  }
  function routeSheet(id) {
    var d = I(id), sm = TM.latestSummary(S, d.id, 'analysis'), p = sm ? sm.payload : {}, st = (p.suggested_tasks || [])[0] || {};
    var cat = p.category || 'admin';
    var leads = TM.leadUsers(S); // 没有负责人的小团队：老板自任
    var mustOwner = S.settings.ownerApprovalMode === 'all' && !d.ownerApproved;
    var ai = S.settings.agentDirectRoute && p.suggested_route ? '<div class="callout ai">AI 已按整理稿预填：' + esc(L.route[p.suggested_route]) + '。核对后点「派发」，派发由你决定。</div>' : '';
    openSheet('派发', (mustOwner ? '<div class="callout warn">当前设置为「每条都送老板」。请先通过「更多」上报老板，批准后才能派发。</div>' : '') + ai +
      '<div class="fld"><span>事项类型</span><div class="opts">' + opt('kind', 'admin', '行政：直接派任务', '你来派执行人，并负责验收', cat !== 'product') + opt('kind', 'product', '产品：交项目负责人', '由负责人拆任务、派执行人、验收', cat === 'product') + '</div></div>' +
      field('事项标题', '<input type="text" name="title" value="' + esc(p.title || d.title) + '">') + field('目标', '<input type="text" name="goal" value="' + esc(p.goal && p.goal !== '待确认' ? p.goal : '') + '">') +
      '<div id="leadBox">' + field('项目负责人', userSelect('leadId', leads)) + '</div>' +
      '<div id="taskBox">' + taskFields('t_', { title: st.title, expected: st.expected_output, criteria: st.acceptance_criteria, due: TM.dateAdd(S, st.suggested_due_days || 3) }) + '</div>', '派发',
      function (o) {
        var pl = { id: d.id, kind: o.kind, title: o.title, goal: o.goal };
        if (o.kind === 'product') pl.leadId = o.leadId;
        else pl.tasks = [{ title: o.t_title, ownerId: o.t_ownerId, expected: o.t_expected, criteria: o.t_criteria, due: o.t_due }];
        var r = act('idea.route', pl, o.kind === 'product' ? '已交项目负责人' : '任务已派出');
        if (r.ok) location.hash = '#/work/' + r.workId;
      });
    syncRoute();
  }
  function syncRoute() {
    var f = document.querySelector('.sheet'); if (!f || !f.kind) return;
    var k = (f.querySelector('input[name=kind]:checked') || {}).value;
    var lb = document.getElementById('leadBox'), tb = document.getElementById('taskBox');
    if (lb) { lb.hidden = k !== 'product'; tb.hidden = k === 'product'; tb.querySelectorAll('input,select,textarea').forEach(function (x) { x.disabled = k === 'product'; }); lb.querySelector('select').disabled = k !== 'product'; }
  }

  /* ---------- 录音 ---------- */
  function startRec(onBlob) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [], mr = new MediaRecorder(stream), t0 = Date.now();
      rec = { mr: mr, t0: t0, timer: setInterval(function () { var e = document.getElementById('rectime'); if (e) { var s = Math.round((Date.now() - t0) / 1000); e.textContent = '录音中 ' + Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); } }, 500) };
      mr.ondataavailable = function (e) { chunks.push(e.data); };
      mr.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var sec = Math.round((Date.now() - t0) / 1000), lid = rid('b');
        var rblob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        blobs[lid] = keepBlob(lid, rblob);
        var am = { kind: 'audio', name: '录音 ' + Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2), durationSec: sec, localId: lid };
        if (cur().name === 'project' && pd) pd.files.push(am); else newMedia.push(am);
        clearInterval(rec.timer); rec = null; render();
        if (onBlob) onBlob(rblob);
      };
      mr.start(); render();
    }).catch(function () { toast('没有拿到麦克风权限，请在浏览器设置里允许后再试', true); });
  }
  function stopRec() { if (rec) rec.mr.stop(); }

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
    var cp = myCaps(), to = null;
    if (c.name === 'new' && !cp.recordIdea) to = '#/home';
    else if (c.name === 'project' && !cp.createProject) to = '#/home';
    else if (c.name === 'assign' && !cp.assign) to = '#/home';
    else if (c.name === 'settings' && !cp.settings) to = '#/me';
    else if (c.name === 'kb' && c.id === 'voice' && !cp.kbEdit) to = '#/kb';
    else if ((c.name === 'ideas' || c.name === 'idea') && !cp.ideas) to = '#/home';
    else if (c.name === 'work' && !cp.work) to = '#/home';
    if (to) { history.replaceState(null, '', to); if (typeof navStack !== 'undefined' && navStack.length) navStack[navStack.length - 1] = to; return render(); }
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
      case 'settings': body = viewSettings(); back = true; title = '更多设置'; break;
      default: body = viewHome(); c.name = 'home';
    }
    // 演示模式下的录音 / 视频 / AI 页面：说清楚这里是模拟的，一键连接团队服务器（用户曾在演示模式里试视频，以为功能坏了）
    if (!SRV && /^#\/(new\/(voice|video|file)|project\/ai|todo\/new\/ai|kb\/voice)/.test(location.hash)) { var dtip = '<div class="demo-tip"><b>你正在用演示模式</b><span>这里的录音不会上传，视频里的话不会转成文字，AI 也是规则模拟。连接团队服务器后，录音和视频会自动转成文字，AI 会真正读懂内容。</span><button type="button" class="btn pri" data-do="srvConnect">连接团队服务器</button></div>';
      body = body + dtip; } // 放在页面最后：以前插在第一个区块后面，会把录音页的「话筒—计时—按钮」切开
    var u = TM.user(S, me);
    var tabKey = { idea: 'ideas', new: 'ideas', project: 'work', stat: 'home', settings: 'me', kb: 'me', todo: 'tasks', ideas: 'ideas', task: 'tasks', inbox: 'home', team: 'me', assign: 'work' }[c.name] || c.name;
    var nT = vTasks().filter(function (t) { var nx = TM.nextForTask(S, t); return nx && nx.who === me; }).length;
    var home = c.name === 'home' || c.name === 'new' || c.name === 'project' || c.name === 'tasks' || c.name === 'todo' || c.name === 'assign' || c.name === 'work' || c.name === 'ideas' || c.name === 'stat' || c.name === 'team' || c.name === 'me' || c.name === 'inbox' || c.name === 'idea' || c.name === 'kb' || c.name === 'task' || c.name === 'settings';
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
  [VO, CAP, TD, AS, WD, SD, TMD, ME, AIX].forEach(function (g) { Object.keys(g).forEach(function (k) { DO[k] = g[k]; }); });
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
      field('新密码', '<input type="password" name="password" minlength="8" autocomplete="new-password" required>', '至少 8 位，别用生日、连续数字') + field('再输一次', '<input type="password" name="again" minlength="6" autocomplete="new-password" required>'), '保存', function (o) {
      if (o.password !== o.again) return toast('两次输入的新密码不一样', true);
      TMS.changePassword(o.old || '', o.password).then(function () { closeSheet(); toast('密码已修改'); }, function (e) { toast(e.error || '修改失败', true); });
    }); };
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
  function showCred(u, login, pw) {
    var join = 'teamops://join?server=' + encodeURIComponent(TMS.serverUrl()) + '&login=' + encodeURIComponent(login), qr = '';
    try { var qq = qrcode(0, 'M'); qq.addData(join); qq.make(); qr = '<div class="cred-qr">' + qq.createSvgTag(4, 2) + '<small>让 TA 用手机相机扫一下，自动打开 App 并填好服务器和账号（密码请单独告诉 TA）</small></div>'; } catch (e) {}
    if (appUpd.meta) qr += '<p class="muted" style="font-size:13.5px;margin:0 0 12px">TA 还没装 App？安卓手机扫「我的 → 给同事安装 App」里的码下载。</p>';
    openSheet('账号已就绪', qr + '<p style="margin:0 0 10px">把下面的信息发给 <b>' + esc(u.name) + '</b>：</p><div class="cred"><div><span>服务器</span><b>' + esc(TMS.serverUrl()) + '</b></div><div><span>账号</span><b id="cred-l">' + esc(login) + '</b></div><div><span>初始密码</span><b id="cred-p">' + esc(pw) + '</b></div></div><p class="muted" style="font-size:13.5px;margin:10px 0 0">密码只显示这一次。对方首次登录后需要改成自己的密码。</p>', '复制并关闭', function () {
      var t = '团队协同 登录信息\n服务器：' + TMS.serverUrl() + '\n账号：' + login + '\n初始密码：' + pw + '\n在手机上点这个链接直接打开 App：' + join;
      try { navigator.clipboard.writeText(t).then(function () { toast('已复制，可以发给对方'); }, function () { toast('请手动记下账号和密码'); }); } catch (e) { toast('请手动记下账号和密码'); }
      closeSheet(); });
  }
  DO.srvAccount = function (el) { var uid = el.dataset ? el.dataset.u : el, u = TM.user(S, uid); if (!u) return;
    TMS.accounts().then(function (res) { var a = res.accounts.find(function (x) { return x.uid === uid; });
      openSheet(a ? '登录账号 · ' + u.name : '给 ' + u.name + ' 分派登录账号',
        (a ? '<div class="callout">当前账号 <b>' + esc(a.login) + '</b>' + (a.disabled ? '（已停用）' : '') + (a.mustChange ? ' · 还没改初始密码' : '') + (a.lastLogin ? ' · 最近登录 ' + ago(a.lastLogin) : ' · 还没登录过') + '</div>' : '<p class="muted" style="margin:0 0 10px;font-size:14px">' + esc(u.name) + ' 还没有登录账号。设置后把账号和初始密码告诉对方，对方首次登录时需要修改密码。</p>') +
        field('登录账号', '<input type="text" name="login" value="' + esc(a ? a.login : '') + '" placeholder="例如：xiaoli 或手机号" autocapitalize="off" autocorrect="off" autocomplete="off" required>', '3–32 位字母、数字或 _ . @ -') +
        field(a ? '新密码（可选）' : '初始密码（可选）', '<input type="text" name="password" placeholder="留空自动生成" autocomplete="off" autocapitalize="off">', a ? '填写后旧密码立即失效' : '') +
        (a ? '<label class="sw"><span><b>重置密码</b><small>自动生成新密码，旧密码立即失效</small></span><input type="checkbox" name="reset" value="1"></label>' + (uid !== me && !TM.hasRole(S, uid, 'owner') ? '<button type="button" class="btn block mt' + (a.disabled ? '' : ' danger') + '" data-do="srvDisable" data-u="' + uid + '" data-d="' + (a.disabled ? '0' : '1') + '">' + (a.disabled ? '恢复这个账号' : '停用这个账号') + '</button>' : '') : ''),
        a ? '保存' : '创建账号', function (o) {
          TMS.setAccount({ uid: uid, login: (o.login || '').trim(), password: o.password || undefined, reset: !!o.reset }).then(function (r) { if (r.password) showCred(u, r.login, r.password); else { closeSheet(); toast('已保存'); } }, function (e) { toast(e.error || '保存失败', true); });
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
    'member.add': '添加成员', 'member.update': '修改资料', 'member.role': '调整角色', 'member.handover': '交接工作', 'settings.update': '修改设置', 'todo.create': '新建待办', 'todo.update': '修改待办', 'notif.read': '已读通知' };
  var opsS = { uid: '', fail: false, rows: [], more: false };
  function opsHTML() {
    var ppl = S.users.map(function (u) { return '<option value="' + u.id + '"' + (opsS.uid === u.id ? ' selected' : '') + '>' + esc(u.name) + '</option>'; }).join('');
    return '<div class="ops-f"><select data-ops="uid"><option value="">全部成员</option>' + ppl + '</select><label class="ops-c"><input type="checkbox" data-ops="fail"' + (opsS.fail ? ' checked' : '') + '> 只看失败</label></div>' +
      (opsS.rows.length ? '<div class="ops-l">' + opsS.rows.map(function (r) { return '<div class="ops-r' + (r.ok ? '' : ' bad') + '"><b>' + esc(TM.name(S, r.uid)) + '</b><span>' + esc(OPN[r.action] || r.action) + (r.ok ? '' : '（失败：' + esc(r.error) + '）') + '</span><small>' + new Date(r.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + '</small></div>'; }).join('') + '</div>' : '<p class="muted">没有记录。</p>') +
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
  function uaName(a) { a = String(a || ''); return /iPhone|iPad/.test(a) ? 'iPhone / iPad' : /Android/.test(a) ? '安卓手机' : /Macintosh/.test(a) ? 'Mac 电脑浏览器' : /Windows/.test(a) ? 'Windows 电脑浏览器' : '其他设备'; }
  DO.srvSessions = function () {
    TMS.sessions().then(function (r) {
      var xs = r.sessions || [], others = xs.filter(function (x) { return !x.current; }).length;
      openSheet('登录设备', '<div class="list">' + xs.map(function (x) { return '<div class="row ses-r"><div class="t"><span><b>' + uaName(x.agent) + '</b>' + (x.current ? '<span class="tag soft">这台</span>' : '') + '<small class="muted">最近使用 ' + ago(x.seen) + ' · 登录于 ' + ixDate(x.created) + '</small></span>' + (x.current ? '' : '<button type="button" class="btn ghost" data-do="sesOut" data-id="' + x.id + '">退出</button>') + '</div></div>'; }).join('') + '</div>' +
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
  var dstr = function (t) { return t ? ixDate(t) : ''; }, today = function () { return new Date().toISOString().slice(0, 10); };
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
      '<label class="sw mt"><span><b>推送到手机</b><small>' + (SRV ? '需要管理员配置推送（iPhone）' : '演示版只有 App 内通知') + '</small></span><input type="checkbox" name="push" value="1"' + (p.notifyImportant !== false ? ' checked' : '') + '></label>' +
      '<label class="sw"><span><b>免打扰时段</b><small>这段时间只记在 App 里，不推送</small></span><input type="checkbox" name="quietOn" value="1"' + (p.quietOn ? ' checked' : '') + '></label>' +
      '<div class="n-quiet"><input type="time" name="quietFrom" value="' + esc(p.quietFrom || '22:00') + '"><span>到</span><input type="time" name="quietTo" value="' + esc(p.quietTo || '08:00') + '"></div>', '保存', function (o) {
        var m2 = Object.keys(TM.NCATS).filter(function (k) { return !o['c_' + k]; });
        act('member.update', { id: me, prefs: { mute: m2, notifyImportant: !!o.push, quietOn: !!o.quietOn, quietFrom: o.quietFrom || '22:00', quietTo: o.quietTo || '08:00' } }, '通知设置已保存');
      });
  };
  DO.srvUsage = function () {
    TMS.usage().then(function (u) {
      var mb = function (n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; };
      var K = { ask: 'AI 助手提问', kb: '口述整理', analyze: '想法整理稿', digest: '讨论总结', advice: '决策建议', project: '新建项目解析', image: '拍照识别', doc: '读 PDF', todos: '拆待办', write: '写描述 / 目标', brief: '老板早报' };
      var row = function (a, b) { return '<div class="cred-r"><span>' + a + '</span><b>' + b + '</b></div>'; };
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
      var blob = new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' }), name = '团队协同备份-' + new Date().toISOString().slice(0, 10) + '.json';
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
  DO.ixMore = function () { var d = I(cur().id), acts = ideaActions(d).filter(function (x) { return x[2] !== 'pri'; }); openSheet('更多操作', '<div class="wd-ops">' + acts.map(function (x) { return '<button type="button" class="btn block" data-do="' + x[1] + '"' + (x[3] ? ' data-arg="' + x[3] + '"' : '') + '>' + x[0] + '</button>'; }).join('') + (ixCanLog(d) ? '<button type="button" class="btn block" data-do="ixLog">查看操作记录</button>' : '') + '<button type="button" class="btn block" data-do="ixCopy">复制链接</button>' + (isOwner() || (d.creatorId === me && d.status === 'draft') ? '<button type="button" class="btn block danger" data-do="ixDelete">删除这个想法</button>' : '') + '</div>', '关闭', function () { closeSheet(); }); };
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
  /* ---------- AI 知识库 ---------- */
  var kbTry = '';
  function kbSize(n) { return n >= 10000 ? (n / 10000).toFixed(1) + ' 万字' : n + ' 字'; }
  function kbMd(t) { return esc(t).split('\n').map(function (l) { var m; if ((m = l.match(/^(#{1,3})\s+(.*)/))) return '<h' + (m[1].length + 2) + '>' + m[2] + '</h' + (m[1].length + 2) + '>'; if ((m = l.match(/^\s*[-*]\s+(.*)/))) return '<p class="kb-li">• ' + m[1] + '</p>'; return l.trim() ? '<p>' + l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</p>' : ''; }).join(''); }
  function viewKB(id) {
    TM.kbInit(S); var can = TM.kbCan(S, me), docs = TM.kbVisible(S, me);
    if (id === 'voice') return viewKBVoice(can);
    if (kbv.rec) kbvStop(true);
    if (id) {
      var k = docs.find(function (x) { return x.id === id; });
      if (!k) return ixHead('AI 知识库', '资料') + emptyBox('这份资料不存在，或你没有查看权限。');
      return ixHead('资料详情', esc(k.title)) + '<section class="ix2-card"><div class="ix2-row"><span class="kb-tag' + (k.on ? ' on' : '') + '">' + (k.on ? 'AI 使用中' : '已停用') + '</span><span class="ix2-date">' + kbSize(k.size) + ' · ' + ago(k.at) + '</span></div><h2 class="kb-h">' + esc(k.title) + '</h2><div class="kb-md">' + kbMd(k.body) + '</div></section>' +
        (can ? '<div class="kb-ops"><button class="ix2-btn" data-do="kbEdit" data-id="' + k.id + '">' + ai2('edit', 1.7) + '编辑</button><button class="ix2-btn" data-do="kbToggle" data-id="' + k.id + '">' + (k.on ? '停用' : '启用') + '</button><button class="ix2-btn red" data-do="kbDel" data-id="' + k.id + '">删除</button></div>' : '');
    }
    var on = docs.filter(function (k) { return k.on; }).length;
    var h = ixHead('AI 知识库', '让 AI 更了解公司和老板的想法') +
      '<section class="ix2-card kb-intro"><span class="ix2-spark">' + hi('spark', 1.6) + '</span><div><b>AI 会参考这里的资料</b><p>把公司方向、规章制度、老板的思想和做事原则写成文档放在这里。AI 整理想法、给决策建议、找回记忆时，会引用相关的段落，并注明出自哪份资料。</p></div></section>' +
      (can ? '<a class="kb-voice" href="#/kb/voice"><span class="kb-vmic">' + ai2('mic', 1.8) + '</span><span class="kb-vt"><b>录音口述，AI 整理成规则</b><small>直接说出你的想法和做事原则，AI 自动分类成条，核对后存入知识库</small></span>' + hi('chev', 2) + '</a>' : '') +
      (can ? '<div class="kb-add"><label class="kb-addb">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>' + '<b>上传文档</b><small>' + (AI_ON ? 'Word、PDF、MD、TXT' : 'Word、MD、TXT') + '，可多选</small><input type="file" accept="' + (AI_ON ? '.pdf,application/pdf,' : '') + '.md,.markdown,.txt,.docx,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple data-kbfile="1"></label><button class="kb-addb" data-do="kbNew">' + ai2('edit', 1.7) + '<b>直接写 / 粘贴</b><small>老板的想法、口述整理</small></button></div>' : '<p class="ix2-empty" style="margin:0 4px 12px">资料由老板和管理员维护，你可以查看公开给团队的资料。</p>') +
      '<section class="ix2-card"><div class="ix2-sh"><b>' + pi('clip') + '资料（' + docs.length + '）</b><span class="ix2-date">' + on + ' 份启用</span></div>' +
      (docs.length ? docs.map(function (k) { return '<div class="kb-row' + (k.on ? '' : ' off') + '"><a href="#/kb/' + k.id + '"><span class="ix-fi ix-d">' + ai2('doc2', 1.7) + '</span><span class="ix-ft"><b>' + esc(k.title) + '</b><small>' + (k.source === 'voice' ? '口述整理 · ' : '') + kbSize(k.size) + ' · ' + (k.scope === 'ai_only' ? '仅 AI 参考，成员看不到' : '全员可看') + ' · ' + ago(k.at) + '</small></span></a>' + (can ? '<button class="ix2-eye' + (k.on ? ' on' : '') + '" data-do="kbToggle" data-id="' + k.id + '" role="switch" aria-checked="' + k.on + '" aria-label="' + (k.on ? '停用' : '启用') + ' ' + esc(k.title) + '"><i></i><span>' + (k.on ? '启用' : '停用') + '</span></button>' : '') + '</div>'; }).join('') : '<p class="ix2-empty">还没有资料。</p>') + '</section>' +
      '<section class="ix2-card"><div class="ix2-sh"><b>' + hi('spark', 1.6) + '试一试：AI 会引用什么</b></div><div class="kb-try"><input type="text" id="kbq" value="' + esc(kbTry) + '" placeholder="例如：明年要不要招两个开发" maxlength="60"><button class="ix2-btn blue" data-do="kbAsk">查一下</button></div>' +
      (kbTry ? (TM.kbMatch(S, kbTry, 3).length ? refsHTML(TM.kbMatch(S, kbTry, 3), 'AI 会引用这些段落') : '<p class="ix2-empty" style="margin-top:10px">没有找到相关段落。可以补充资料，或换个说法。</p>') : '') + '</section>' +
      '<p class="ix2-note" style="margin:0 6px 20px">演示版：AI 按关键词匹配资料段落，不是真正读懂全文。连接团队服务器并启用 AI 后，AI 会通读这些资料来理解公司和老板的思路。</p>';
    return h;
  }
  /* ---------- 口述成规则：老板录音 → 转文字 → AI 归类整理成条（演示：规则模拟） ---------- */
  function kbvFresh() { return { topic: '', text: '', interim: '', rec: false, sr: null, t0: 0, timer: null, out: null, mdMode: false, scope: 'ai_only', raw: true }; }
  var kbv = kbvFresh();
  var KBV_SECS = [
    ['quote', '我常说的话', /「[^」]{2,}」|“[^”]{2,}”|我常说|常挂在嘴边/],
    ['decide', '我怎么做决定', /决定|拍板|先问我|问过我|试点|审批|批准|同意|做主|请示|定下来/],
    ['people', '用人', /招人|招聘|新人|兼职|全职|试用|面试|品格|人品|用人|员工|同工|培养/],
    ['money', '钱和预算', /钱|预算|块|元|花费|报销|比价|成本|费用|支出|采购|分期/],
    ['public', '对外发布与品牌', /对外|发布|官网|品牌|宣传|公众号|口吻|海报|媒体/],
    ['team', '团队相处', /沟通|配搭|批评|表扬|指责|相处|合作|开会|会议|出了问题|彼此|互相/],
    ['why', '方向与初心', /初心|方向|目标|今年|三年|使命|异象|为什么|愿景/]
  ];
  var KBV_TOPICS = [['', '不限'], ['decide', '做决定'], ['people', '用人'], ['money', '钱和预算'], ['public', '对外发布'], ['team', '团队相处'], ['why', '方向初心']];
  var KBV_SAMPLE = '嗯，我说几点。新的想法我习惯先小步试点两周，看大家的反馈再决定要不要全面推开。人事的事情、单笔超过五千块的支出、还有对外发布的东西，这三类必须先问我。其他日常的事，运营者可以直接做主，事后跟我说一声就行。招人的话，我先看品格再看能力，新人先兼职试用三个月。花钱之前至少比价两家，长期的固定支出我会更谨慎。出了问题，我希望大家先说事实，再说原因，最后说怎么改进，不要互相指责。我常说一句话，「凡事凭爱心而做」，就是做事要从爱出发，不是为了表现自己。';
  function kbvClean(x) {
    var t = String(x || '').trim(), prev;
    do { prev = t; t = t.replace(/^(嗯+|啊+|呃+|那个|就是说|就是|然后|所以|另外|还有|对了|我说几点|我讲几点|第[一二三四五六七八九十]+点?|首先|其次)[，,、\s。]*/, ''); } while (t !== prev);
    t = t.replace(/[，,、\s]+$/, ''); if (t.length < 6) return '';
    return t + '。';
  }
  function kbOrganize(text, topic) {
    var parts = String(text).replace(/\r/g, '').split(/[。！？!?；;\n]+/), secs = {}, n = 0;
    parts.forEach(function (raw) {
      var t = kbvClean(raw); if (!t) return;
      var key = (KBV_SECS.find(function (x) { return x[2].test(t); }) || [topic || 'other'])[0];
      if (key === 'quote') { var q = t.match(/「([^」]+)」|“([^”]+)”/); if (q) { var mean = t.slice(t.indexOf(q[0]) + q[0].length).replace(/^[，,、\s]*(就是说|就是|意思是|也就是说|也就是)?[，,、\s]*/, '').replace(/。$/, ''); t = '「' + (q[1] || q[2]) + '」' + (mean ? '——' + mean + '。' : '。'); } }
      (secs[key] = secs[key] || []).push(t); n++;
    });
    var order = KBV_SECS.map(function (x) { return x[0]; }).filter(function (k) { return k !== 'quote'; }).concat(['other', 'quote']);
    var name = function (k) { var x = KBV_SECS.find(function (y) { return y[0] === k; }); return x ? x[1] : '其他原则'; };
    var list = order.filter(function (k) { return secs[k]; }).map(function (k) { return { key: k, name: name(k), items: secs[k] }; });
    var main = list.filter(function (x) { return x.key !== 'quote' && x.key !== 'other'; }).slice(0, 2).map(function (x) { return x.name.replace(/^我/, ''); });
    return { title: ('老板口述：' + (main.length ? main.join('、') : '做事原则')).slice(0, 40), secs: list, count: n };
  }
  function kbvMd(o) { return '# ' + o.title + '\n\n> 来源：老板口述录音，' + (o.real ? 'Claude 整理成条' : 'AI 整理成条（演示：规则模拟）') + '，已由老板核对。\n' + o.secs.filter(function (x) { return x.items.length; }).map(function (x) { return '\n## ' + x.name + '\n' + x.items.map(function (t) { return '- ' + t; }).join('\n'); }).join('\n') + '\n'; }
  function kbvSyncText() { var ta = document.getElementById('kbv-text'); if (ta && !kbv.rec) kbv.text = ta.value; }
  function kbvKeep() { var o = kbv.out; if (!o) return; var tl = document.getElementById('kbv-title'), md = document.getElementById('kbv-md'), rw = document.getElementById('kbv-raw'); if (tl) o.title = tl.value; if (md) o.md = md.value; if (rw) kbv.raw = rw.checked; }
  // 手机不能实时转文字、但服务器能转：先录音，停止后交给服务器转，追加到口述内容
  function kbvRecStart() {
    if (!(navigator.mediaDevices && window.MediaRecorder)) return toast('当前浏览器不支持录音', true);
    kbvSyncText();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [], mr = new MediaRecorder(stream);
      mr.ondataavailable = function (e) { chunks.push(e.data); };
      mr.onstop = function () { stream.getTracks().forEach(function (t) { t.stop(); }); srvTr(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), '口述录音').then(function (t) { if (!t) return toast('录音里没有识别到说话', true); kbv.text = (kbv.text + (kbv.text ? '\n' : '') + t).slice(0, 20000); render(); }, function () {}); };
      kbv.mr = mr; kbv.rec = true; kbv.t0 = Date.now(); mr.start();
      kbv.timer = setInterval(function () { var el = document.getElementById('kbv-t'); if (el) { var s2 = Math.round((Date.now() - kbv.t0) / 1000); el.textContent = '正在录音 ' + Math.floor(s2 / 60) + ':' + ('0' + s2 % 60).slice(-2) + '（停止后转文字）'; } }, 500);
      render();
    }).catch(function () { toast('没有拿到麦克风权限，请在浏览器设置里允许后再试', true); });
  }
  function kbvStart() {
    if ((!SR || kbv.srvMode) && canSrvTr()) return kbvRecStart();
    if (!SR) { toast('这个浏览器不支持语音转文字。可以点输入法上的话筒，直接说到下方文本框里', true); var t = document.getElementById('kbv-text'); if (t) t.focus(); return; }
    kbvSyncText();
    var r = new SR(); r.lang = 'zh-CN'; r.continuous = true; r.interimResults = true;
    r.onresult = function (e) { var it = ''; for (var i = e.resultIndex; i < e.results.length; i++) { var x = e.results[i][0].transcript.trim(); if (!x) continue; if (e.results[i].isFinal) kbv.text += (kbv.text && !/[。！？，\n]$/.test(kbv.text) ? '。' : '') + x; else it += x; }
      kbv.interim = it; var ta = document.getElementById('kbv-text'); if (ta) { ta.value = kbv.text + (it ? (kbv.text ? '。' : '') + it : ''); ta.scrollTop = ta.scrollHeight; } var nn = document.getElementById('kbv-n'); if (nn) nn.textContent = (kbv.text + it).length + ' 字'; };
    r.onerror = function (ev) { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { toast('没有麦克风权限，可以改用输入法的语音键', true); kbvStop(); } };
    srKeep(r, function () { return kbv.rec && kbv.sr === r; }, function (fatal) { if (kbv.rec) { kbvStop(); if (canSrvTr()) { kbv.srvMode = true; toast('这台手机的实时转写用不了，已改为「录完由服务器转文字」，请再点一次开始', true); } else if (!fatal) toast('这台手机的语音转文字连不上' + srCodeText() + '，可以用输入法的语音键说到下方文本框里', true); } });
    kbv.sr = r; kbv.rec = true; kbv.t0 = Date.now(); try { r.start(); } catch (e) {}
    kbv.timer = setInterval(function () { var el = document.getElementById('kbv-t'); if (el) { var s2 = Math.round((Date.now() - kbv.t0) / 1000); el.textContent = '正在听 ' + Math.floor(s2 / 60) + ':' + ('0' + s2 % 60).slice(-2); } }, 500);
    render();
  }
  function kbvStop(silent) {
    kbv.rec = false; clearInterval(kbv.timer); var r = kbv.sr; kbv.sr = null; if (r) { try { r.stop(); } catch (e) {} }
    if (kbv.mr) { var mr = kbv.mr; kbv.mr = null; try { if (silent) mr.onstop = function () { try { mr.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }; mr.stop(); } catch (e) {} }
    if (kbv.interim) { kbv.text += (kbv.text ? '。' : '') + kbv.interim; kbv.interim = ''; }
    if (!silent) render();
  }
  function viewKBVoice(can) {
    if (!can) return ixHead('口述成规则', 'AI 知识库') + emptyBox('只有老板和管理员可以录入规则。');
    if (kbv.out) {
      var o = kbv.out, n = o.secs.reduce(function (a, x) { return a + x.items.length; }, 0);
      return ixHead('确认规则', 'AI 已整理好，核对后保存') +
        '<section class="ix2-card kbv-out"><div class="ix2-row"><span class="kb-tag on">AI 整理（模拟）</span><span class="ix2-date">' + n + ' 条 · ' + o.secs.length + ' 个主题</span></div>' +
        '<label class="kbv-tl"><span>标题</span><input type="text" id="kbv-title" maxlength="40" value="' + esc(o.title) + '"></label>' +
        (kbv.mdMode ? '<textarea id="kbv-md" class="kbv-md" rows="14">' + esc(o.md || kbvMd(o)) + '</textarea>' :
          o.secs.map(function (x, si) { return '<div class="kbv-sec"><h3>' + esc(x.name) + '<i>' + x.items.length + '</i></h3>' + x.items.map(function (t, ii) { return '<div class="kbv-rule"><span>' + esc(t) + '</span><button type="button" data-do="kbvDel" data-s="' + si + '" data-i="' + ii + '" aria-label="删掉这条">×</button></div>'; }).join('') + '</div>'; }).join('')) +
        '<button type="button" class="kbv-mode" data-do="kbvMode">' + ai2('edit', 1.7) + (kbv.mdMode ? '回到分条预览（会丢掉全文里的改动）' : '改全文') + '</button></section>' +
        '<section class="ix2-card"><div class="ix2-sh"><b>谁能看到</b></div><div class="kbv-scope">' + [['ai_only', '仅 AI 参考', '成员看不到原文，只在 AI 建议里引用'], ['team', '全员可看', '团队成员可以阅读这份规则']].map(function (x) { return '<button type="button" class="' + (kbv.scope === x[0] ? 'on' : '') + '" data-do="kbvScope" data-v="' + x[0] + '"><b>' + x[1] + '</b><small>' + x[2] + '</small></button>'; }).join('') + '</div>' +
        '<label class="kbv-raw"><input type="checkbox" id="kbv-raw"' + (kbv.raw ? ' checked' : '') + '><span>附上口述原文，方便以后对照</span></label></section>' +
        '<div class="p-btns kbv-btns"><button class="p-prev" data-do="kbvRedo">重新说</button><button class="n-next" data-do="kbvSave">保存到知识库' + ni('check', 2.4) + '</button></div>';
    }
    var len = (kbv.text + kbv.interim).length;
    return ixHead('口述成规则', '说出你的想法，AI 整理成团队规则') +
      '<section class="ix2-card kbv-rec' + (kbv.rec ? ' on' : '') + '"><div class="kbv-topics"><span>这次主要说</span>' + KBV_TOPICS.map(function (x) { return '<button type="button" class="' + (kbv.topic === x[0] ? 'on' : '') + '" data-do="kbvTopic" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<button type="button" class="kbv-mic' + (kbv.rec ? ' on' : '') + '" data-do="kbvRec" aria-label="' + (kbv.rec ? '停止' : '开始说') + '">' + (kbv.rec ? '<i class="kbv-sq"></i>' : ai2('mic', 1.8)) + '</button>' +
      '<b class="kbv-st">' + (kbv.rec ? '<span id="kbv-t">正在听 0:00</span>' : len ? '可以继续说，或者点下方整理' : '点一下，开始说') + '</b>' +
      '<small class="kbv-hint">' + (kbv.rec ? '说完点中间按钮停止。像平时讲话一样说就行，不用组织语言' : SR ? '一次说几条你的做事原则：遇到什么情况、你怎么想、怎么做' : '当前浏览器不支持语音转文字，可以用输入法的话筒说到下方文本框') + '</small>' +
      (!len && !kbv.rec ? '<div class="kbv-eg"><span>可以这样说</span><p>「新想法我习惯先试点两周，看反馈再决定。」</p><p>「单笔超过五千块的支出，必须先问我。」</p><p>「出了问题先说事实，再说原因，最后说改进。」</p></div>' : '') + '</section>' +
      '<section class="ix2-card"><div class="ix2-sh"><b>' + ai2('doc2', 1.7) + '口述内容</b><span class="ix2-date" id="kbv-n">' + len + ' 字</span></div><textarea id="kbv-text" class="kbv-ta" rows="7" maxlength="20000" placeholder="说的话会自动转成文字出现在这里，也可以直接打字或粘贴…">' + esc(kbv.text + (kbv.interim ? '。' + kbv.interim : '')) + '</textarea>' +
      '<div class="kbv-ops"><button type="button" data-do="kbvSample">' + hi('spark', 1.5) + '用示例口述</button>' + (len ? '<button type="button" data-do="kbvClear">清空</button>' : '') + '</div></section>' +
      '<button class="vr-next kbv-go" data-do="kbvMake">' + hi('spark', 1.6) + 'AI 整理成规则</button>';
  }
  DO.kbvRec = function () { if (kbv.rec) kbvStop(); else kbvStart(); };
  DO.kbvTopic = function (el) { kbvSyncText(); kbv.topic = el.dataset.v; render(); };
  DO.kbvSample = function () { if (kbv.rec) kbvStop(true); kbv.text = KBV_SAMPLE; render(); toast('已填入一段示例口述'); };
  DO.kbvClear = function () { if (kbv.rec) kbvStop(true); kbv.text = ''; kbv.interim = ''; render(); };
  DO.kbvMake = function () {
    if (kbv.rec) kbvStop(true); kbvSyncText();
    var t = kbv.text.trim(); if (t.length < 15) { render(); return toast('先说几句，内容太少整理不出规则', true); }
    if (AI_ON && !kbv.ruleOnly) {
      openSheet('AI 正在整理', '<ol class="a-prog"><li class="ok">读取口述内容</li><li id="kp-ai">Claude 正在断句、去口头语、按主题归类…</li></ol>', '请稍候', function () {});
      var b0 = document.querySelector('.sheet footer button[type=submit]'); if (b0) b0.disabled = true;
      TMS.aiKb(kbv.topic, t).then(function (o2) {
        if (!o2.count) { closeSheet(); return toast('没有找到能整理成规则的句子，再说具体一点', true); }
        o2.real = true; kbv.out = o2; kbv.mdMode = false; closeSheet(); render(); window.scrollTo(0, 0);
      }, function (e) { closeSheet(); toast(((e && e.error) || 'AI 暂时不可用') + '，已改用规则整理', true); kbv.ruleOnly = true; DO.kbvMake(); kbv.ruleOnly = false; });
      return;
    }
    var o = kbOrganize(t, kbv.topic); if (!o.count) return toast('没有找到能整理成规则的句子，再说具体一点', true);
    var steps = ['断句、去掉口头语', '按主题归类', '整理成条'];
    openSheet('AI 正在整理', '<ol class="a-prog">' + steps.map(function (x, i) { return '<li id="kp' + i + '">' + x + '</li>'; }).join('') + '</ol><div class="callout">演示版：整理由规则模拟完成，不调用真实大模型。</div>', '请稍候', function () {});
    var btn = document.querySelector('.sheet footer button[type=submit]'); if (btn) btn.disabled = true;
    steps.forEach(function (_, i) { setTimeout(function () { var li = document.getElementById('kp' + i); if (li) li.className = 'ok'; }, 250 * (i + 1)); });
    setTimeout(function () { kbv.out = o; kbv.mdMode = false; closeSheet(); render(); window.scrollTo(0, 0); }, 900);
  };
  DO.kbvDel = function (el) { kbvKeep(); var si = +el.dataset.s, x = kbv.out.secs[si]; x.items.splice(+el.dataset.i, 1); if (!x.items.length) kbv.out.secs.splice(si, 1); render(); };
  DO.kbvMode = function () { kbvKeep(); if (kbv.mdMode) kbv.out.md = ''; else kbv.out.md = kbvMd(kbv.out); kbv.mdMode = !kbv.mdMode; render(); };
  DO.kbvScope = function (el) { kbvKeep(); kbv.scope = el.dataset.v; render(); };
  DO.kbvRedo = function () { kbv.out = null; render(); window.scrollTo(0, 0); };
  DO.kbvSave = function () {
    kbvKeep(); var o = kbv.out; o.title = String(o.title || '').trim();
    if (!kbv.mdMode && !o.secs.some(function (x) { return x.items.length; })) return toast('规则都删光了，重新说一次吧', true);
    var body = kbv.mdMode ? o.md : kbvMd(o);
    if (kbv.raw && kbv.text.trim()) body += '\n## 口述原文\n> ' + kbv.text.trim().replace(/\n+/g, ' ') + '\n';
    var r = act('kb.add', { title: o.title, body: body, scope: kbv.scope, source: 'voice' }, '已存入知识库，AI 之后会按这些规则给建议');
    if (r.ok) { kbv = kbvFresh(); navFinish('#/kb/' + r.id); }
  };
  function kbForm(k) { k = k || { title: '', body: '', scope: 'team' }; return field('标题', '<input type="text" name="title" maxlength="40" value="' + esc(k.title) + '" placeholder="例如：老板谈团队文化" required>') + field('内容（支持 Markdown）', '<textarea name="body" rows="10" placeholder="# 标题&#10;- 原则一&#10;- 原则二">' + esc(k.body) + '</textarea>') + '<div class="fld"><span>谁能看到</span><div class="opts">' + opt('scope', 'team', '全员可看', '团队成员可以阅读这份资料', k.scope !== 'ai_only') + opt('scope', 'ai_only', '仅 AI 参考', '成员看不到原文，只在 AI 建议里引用片段', k.scope === 'ai_only') + '</div></div>'; }
  var KB_TPL = "# 老板的想法与做事原则（模板）\n\n> 写法提示：一条一句话，说清楚「遇到什么情况 → 我怎么想 / 怎么做」。\n> 每个小标题下写 3–6 条就够了，AI 会按小标题和句子去找依据。\n> 不确定的地方可以先空着，以后再补。\n\n## 我们为什么做这件事\n- 我们做事的初心是：（一句话写清楚）\n- 我希望三年后团队变成：\n- 今年最重要的三件事是：\n\n## 我怎么做决定\n- 新想法我习惯先：（例如：小步试点两周，看反馈再决定）\n- 这些事必须先问我：（例如：人事、单笔超过 5000 元、对外发布）\n- 这些事运营者可以直接做主：\n- 我拒绝一件事，通常是因为：\n\n## 用人\n- 招人之前我会先看：\n- 我看重一个人的：\n- 新人先怎么安排：（例如：兼职试用三个月）\n- 我不能接受的行为：\n\n## 钱和预算\n- 花钱前要先：（例如：比价至少两家）\n- 长期支出和一次性支出，我更谨慎的是：\n- 超预算时我希望看到：（例如：明细、替代方案、能否分期）\n\n## 对外发布与品牌\n- 对外发的内容要谁审核：\n- 我们对外说话的口吻是：\n- 绝对不能发的内容：\n\n## 团队相处\n- 我希望大家沟通的方式是：\n- 出了问题我希望大家：（例如：先说事实，再说原因，最后说改进）\n- 批评和表扬的原则：\n\n## 我常说的话\n- 「凡事凭爱心而做」——意思是：\n- （把你常挂在嘴边、希望团队记住的话写在这里，并解释它的意思）\n";
  DO.kbTpl = function (el) { var f = el.closest('form'), b = f.querySelector('textarea[name=body]'), t = f.querySelector('input[name=title]'); if (b.value.trim() && !confirm('会覆盖已经写的内容，继续吗？')) return; b.value = KB_TPL; if (!t.value) t.value = '老板的想法与做事原则'; f.querySelector('input[name=scope][value=ai_only]').checked = true; b.focus(); b.setSelectionRange(0, 0); toast('已填入模板，把冒号后面补完整就行'); };
  DO.kbNew = function () { openSheet('添加资料', '<button type="button" class="ix2-adopt" data-do="kbTpl">' + hi('spark', 1.6) + '用「老板思想」模板开始</button>' + kbForm(), '保存', function (o) { var r = act('kb.add', { title: o.title, body: o.body, scope: o.scope }, '已添加，AI 之后会参考这份资料'); }); };
  DO.kbEdit = function (el) { var k = S.knowledge.find(function (x) { return x.id === el.dataset.id; }); openSheet('编辑资料', kbForm(k), '保存', function (o) { act('kb.update', { id: k.id, title: o.title, body: o.body, scope: o.scope }, '已保存'); }); };
  DO.kbToggle = function (el) { var k = S.knowledge.find(function (x) { return x.id === el.dataset.id; }); act('kb.update', { id: k.id, on: !k.on }, k.on ? '已停用，AI 不再参考' : '已启用，AI 会参考这份资料'); };
  DO.kbDel = function (el) { var k = S.knowledge.find(function (x) { return x.id === el.dataset.id; }); openSheet('删除资料', '<p style="margin:0">确定删除「<b>' + esc(k.title) + '</b>」？AI 之后不会再参考它。</p>', '删除', function () { var r = act('kb.delete', { id: k.id }, '已删除'); if (r.ok) location.hash = '#/kb'; }, true); };
  DO.kbAsk = function () { var v = (document.getElementById('kbq') || {}).value || ''; kbTry = v.trim(); if (!kbTry) return toast('先输入一个问题', true); render(); };
  DO.icOpen = function () { var id = cur().id; ichatOpen[id] = !ichatOpen[id]; render(); setTimeout(function () { var pn = document.getElementById('ic-panel'); if (pn) { pn.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 30); };
  DO.icClose = function () { ichatOpen[cur().id] = false; render(); };
  DO.icAsk = function (el) { icPush(I(cur().id), el.dataset.q); };
  DO.icSend = function () { var v = ((document.getElementById('ic-q') || {}).value || '').trim(); if (!v) return toast('先输入问题', true); icPush(I(cur().id), v); };
  DO.icMic = function (el) { if (!SR) return toast('这个浏览器不支持语音输入，可以用输入法自带的语音键', true); var r = new SR(); r.lang = 'zh-CN'; r.interimResults = false; el.classList.add('on'); r.onresult = function (e) { var t2 = e.results[0][0].transcript; var i2 = document.getElementById('ic-q'); if (i2) i2.value = t2; icPush(I(cur().id), t2); }; r.onend = function () { el.classList.remove('on'); }; r.onerror = function () { el.classList.remove('on'); toast('没听清，再试一次', true); }; try { r.start(); toast('请说出你的问题'); } catch (e) { el.classList.remove('on'); } };
  DO.wInfo = function () { var w = W(cur().id); if (!w) return;
    openSheet('编辑项目信息', field('截止时间', '<input type="date" name="due" value="' + (w.due || '') + '">') +
      '<div class="fld"><span>优先级</span><div class="opts">' + opt('priority', 'hi', '高', '', w.priority === 'hi') + opt('priority', 'mid', '中', '', (w.priority || 'mid') === 'mid') + opt('priority', 'lo', '低', '', w.priority === 'lo') + '</div></div>' +
      field('项目目标', '<textarea name="goal" rows="2" maxlength="200" placeholder="这个项目要达成什么">' + esc(w.goal || '') + '</textarea>') +
      field('关键成果', '<textarea name="keyResults" rows="2" maxlength="200" placeholder="怎样算做成了">' + esc(w.keyResults || '') + '</textarea>') +
      field('标签', '<input type="text" name="tags" value="' + esc((w.tags || []).join('、')) + '" placeholder="用顿号或逗号分开，最多 5 个">'), '保存',
      function (o) { act('work.update', { id: w.id, due: o.due || null, priority: o.priority, goal: o.goal, keyResults: o.keyResults, tags: (o.tags || '').split(/[、,，\s]+/).filter(Boolean) }, '项目信息已更新'); }); };
  /* ---------- 演示向导：一键走完「想法 → 验收」 ---------- */
  var dm = null;
  var DM_ROLE = { u_owner: '老板', u_op: '运营者', u_lead: '项目负责人', u_dev: '执行者' };
  function dmSteps() {
    var g = function () { return dm; };
    return [
      { who: null, t: '演示开始', d: '接下来用一个例子「明年开发团队扩编」，自动切换不同的人，一步一步走完从想法到验收的全过程。每一步你都能看到页面变化。' },
      { who: 'u_owner', t: '老板写想法并提交', d: '老板记录想法，AI 先帮他理顺；点提交后，想法进入「待整理」，摆到运营者面前。', run: function () {
        var r = TM.act(S, me, 'idea.create', { title: '【演示】明年开发团队扩编', note: '考虑明年再招两名开发，一攻一守。先出一份招聘方案。', tags: ['演示'] }); if (!r.ok) return r; g().idea = r.id;
        r = TM.act(S, me, 'idea.submit', { id: g().idea, path: 'direct' }); return r.ok ? { ok: true, hash: '#/idea/' + g().idea } : r; } },
      { who: 'u_op', t: '运营者认领', d: '林晓在待整理里看到这条想法，点「认领跟进」，这件事就归她盯了，同时生成正式的 AI 整理稿。', run: function () { var r = TM.act(S, me, 'idea.claim', { id: g().idea }); return r.ok ? { ok: true, hash: '#/idea/' + g().idea } : r; } },
      { who: 'u_op', t: '运营者报老板决策', d: '扩编属于「人事决定」，是例外情况，运营者不能自己做主，要先报给老板拍板。', run: function () { var r = TM.act(S, me, 'idea.requestDecision', { id: g().idea, kind: 'personnel', question: '是否同意明年增招两名开发（一攻一守）？' }); if (r.ok) g().dec = r.id; return r.ok ? { ok: true, hash: '#/idea/' + g().idea } : r; } },
      { who: 'u_owner', t: '老板批准', d: '老板收到「待决策」通知，看完后点批准。想法回到运营者手里，可以派发了。', run: function () { var r = TM.act(S, me, 'decision.decide', { id: g().dec, status: 'approved' }); return r.ok ? { ok: true, hash: '#/idea/' + g().idea } : r; } },
      { who: 'u_op', t: '运营者派发，形成事项', d: '林晓把它派给项目负责人陈立。想法正式变成「事项」：负责人陈立、运营者林晓、验收人陈立。', run: function () { var r = TM.act(S, me, 'idea.route', { id: g().idea, kind: 'product', leadId: 'u_lead', title: '明年开发团队扩编' }); if (r.ok) g().work = r.workId; return r.ok ? { ok: true, hash: '#/work/' + g().work } : r; } },
      { who: 'u_lead', t: '负责人拆任务', d: '陈立把事项拆成具体任务，写清：谁做、交什么、怎样算合格、哪天截止。这里派给刘洋写招聘方案。', run: function () {
        var due = TM.todayStr ? TM.todayStr(S) : null;
        var r = TM.act(S, me, 'work.plan', { id: g().work, tasks: [{ title: '写开发岗位招聘方案', ownerId: 'u_dev', expected: '一份招聘方案文档', criteria: '包含岗位职责、预算和时间表', priority: 'hi', due: due }] }); if (!r.ok) return r;
        var t = S.tasks.filter(function (x) { return x.workId === g().work; }).pop(); g().task = t.id; return { ok: true, hash: '#/work/' + g().work }; } },
      { who: 'u_dev', t: '执行者接收并开始', d: '刘洋在自己的任务页看到这条任务，点「接收」，再点「开始」，状态变成进行中，跟进的人都能看到。', run: function () { var r = TM.act(S, me, 'task.transition', { id: g().task, action: 'accept' }); if (!r.ok) return r; r = TM.act(S, me, 'task.transition', { id: g().task, action: 'start' }); return r.ok ? { ok: true, hash: '#/task/' + g().task } : r; } },
      { who: 'u_dev', t: '执行者提交成果', d: '刘洋做完，点「提交成果」，附上说明。球踢到验收人那边。', run: function () { var r = TM.act(S, me, 'task.transition', { id: g().task, action: 'submit', note: '招聘方案已完成：两个岗位职责、预算、三个月时间表' }); return r.ok ? { ok: true, hash: '#/task/' + g().task } : r; } },
      { who: 'u_lead', t: '验收人验收任务', d: '陈立看成果，觉得可以就点「通过」（不行就「退回」并写原因，执行者改完再交）。', run: function () { var r = TM.act(S, me, 'task.review', { id: g().task, verdict: 'pass', note: '方案清楚，可以执行' }); return r.ok ? { ok: true, hash: '#/task/' + g().task } : r; } },
      { who: 'u_owner', t: '老板终验', d: '设置里开了「老板终验」，所以负责人验收后还要老板再过一道。', skip: function () { var t = S.tasks.find(function (x) { return x.id === dm.task; }); return !t || t.status !== 'owner_review'; }, run: function () { var r = TM.act(S, me, 'task.ownerReview', { id: g().task, verdict: 'owner_pass', note: '同意' }); return r.ok ? { ok: true, hash: '#/task/' + g().task } : r; } },
      { who: 'u_lead', t: '确认事项完成', d: '所有任务都通过了，事项自动进入「待验收」。验收人点「确认事项完成」，整件事收尾。', run: function () { var r = TM.act(S, me, 'work.close', { id: g().work, note: '招聘方案通过，进入执行' }); return r.ok ? { ok: true, hash: '#/idea/' + g().idea } : r; } },
      { who: 'u_owner', t: '流程走完了', d: '已切回老板。看顶部进度条：想法 → 整理 → 事项 → 执行 → 验收，五格全部完成。点「查看操作记录」可以看到每一步是谁、什么时候做的。', end: true }
    ];
  }
  function dmGo(h) { if (location.hash === h) render(); else location.hash = h; }
  function dmPanel() {
    var el = document.getElementById('demo-coach');
    if (!dm) { if (el) el.remove(); document.body.classList.remove('demo-on'); return; }
    var st = dmSteps(), s = st[dm.i], total = st.filter(function (x) { return x.run; }).length, n = st.slice(0, dm.i + 1).filter(function (x) { return x.run; }).length;
    if (!el) { el = document.createElement('div'); el.id = 'demo-coach'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '演示向导'); document.body.appendChild(el); }
    document.body.classList.add('demo-on');
    var u = s.who ? TM.user(S, s.who) : null;
    var done = dm.ran;
    el.innerHTML = '<div class="dc-top"><span class="dc-step">' + (s.run ? '第 ' + n + ' / ' + total + ' 步' : s.end ? '完成' : '演示向导') + '</span>' +
      '<button class="dc-x" data-do="demoExit" aria-label="退出演示">退出</button></div>' +
      (u ? '<div class="dc-who">' + av(u.id, true) + '<span>' + (done ? '刚才' : '现在') + '是 <b>' + esc(u.name) + '</b>（' + (DM_ROLE[u.id] || '') + '）</span></div>' : '') +
      '<h3>' + (done ? '✓ ' : '') + esc(s.t) + '</h3><p>' + esc(s.d) + '</p>' +
      '<div class="dc-bar"><i style="width:' + Math.round(n / total * 100) + '%"></i></div>' +
      '<button class="dc-go" data-do="' + (s.end ? 'demoExit' : 'demoNext') + '">' + (s.end ? '结束演示' : !s.run ? '开始' : done ? '下一步' : '执行这一步') + '</button>';
  }
  DO.demoStart = function () {
    if (!TM.user(S, 'u_dev') || !TM.user(S, 'u_lead') || !TM.user(S, 'u_op')) return toast('演示需要默认团队成员，请先在设置里重置演示数据', true);
    dm = { i: 0, ran: false }; dmPanel();
  };
  DO.demoExit = function () { dm = null; dmPanel(); render(); };
  DO.demoNext = function () {
    var st = dmSteps(), s = st[dm.i];
    if (s.run && !dm.ran) {
      me = s.who; try { localStorage.setItem(KU, me); } catch (e) {}
      var r = s.run(); if (!r.ok) { toast(r.error, true); return; }
      save(); dm.ran = true; dmGo(r.hash); dmPanel(); return;
    }
    var j = dm.i + 1; while (st[j] && st[j].skip && st[j].skip()) j++;
    dm.i = j; dm.ran = false; var ns = st[j];
    if (ns.who && !ns.run) { me = ns.who; try { localStorage.setItem(KU, me); } catch (e) {} render(); }
    dmPanel();
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-do]'); if (!el) return;
    var f = DO[el.dataset.do]; if (!f) return;
    if (el.tagName === 'A' && el.dataset.do === 'readOne') { f(el); return; }
    e.preventDefault(); f(el);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'kbq') { e.preventDefault(); DO.kbAsk(); return; }
    if (e.key === 'Enter' && e.target.id === 'ic-q') { e.preventDefault(); DO.icSend(); return; }
    if (e.key === 'Enter' && e.target.id === 'wc-q') { e.preventDefault(); WD.wcSend(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-do],[role=checkbox][data-do]')) { e.preventDefault(); e.target.click(); }
    if (e.key === 'Escape' && sheetHandler) closeSheet(); else if (e.key === 'Escape' && aiS.open) DO.aiClose();
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.name === 'q' && el.closest && el.closest('.ai-input')) { aiS.input = el.value; return; }
    if (el.id === 'kbv-text' && !kbv.rec) { kbv.text = el.value; var kn = document.getElementById('kbv-n'); if (kn) kn.textContent = el.value.length + ' 字'; return; }
    if (el.dataset && el.dataset.pd && pd) { pd[el.dataset.pd] = el.value; var pc = document.getElementById('pc-' + el.dataset.pd); if (pc) pc.textContent = el.value.length + '/' + (el.dataset.pd === 'title' ? 50 : 500); return; }
    if (el.dataset && el.dataset.pt != null && pd) { pd.tasks[+el.dataset.pt][el.dataset.f] = el.value; return; }
    if (el.dataset && el.dataset.as && asg && el.type !== 'checkbox' && el.type !== 'date') { asg[el.dataset.as] = el.value; var ac = document.getElementById('asc-' + el.dataset.as); if (ac) ac.textContent = el.value.length + '/' + (el.dataset.as === 'title' ? 50 : 500); return; }
    if (el.dataset && el.dataset.tf && tf) { tf[el.dataset.tf] = el.value; if (el.dataset.tf === 'title') { var tc = document.getElementById('tfc'); if (tc) tc.textContent = el.value.length + '/50'; } return; }
    if (el.dataset && el.dataset.ta) { ta[el.dataset.ta] = el.value; var gb = document.querySelector('[data-do=taGen]'); if (gb) gb.disabled = !ta.text.trim(); return; }
    if (el.dataset && el.dataset.cap) { var kk = el.dataset.cap.split('.'), obj = kk[0] === 'vo' ? vo : kk[0] === 'cam' ? cam : kk[0] === 'fi' ? fi : tx; obj[kk[1]] = el.value; if (obj === vo && vo.state === 'idle') { var vcb = document.querySelector('.vr-c[data-do=voCancel]'); if (vcb) vcb.disabled = !vo.clips.length && !vo.text; } if (obj === tx) { txPersist(); if (kk[1] === 'note' && tx.hist && tx.hist.length) { tx.hist = []; var ub = document.querySelector('.cx-undo'); if (ub) ub.remove(); } } var cc = document.getElementById('cc-' + kk[0] + '-' + kk[1]); if (cc) cc.textContent = el.value.length + '/' + (el.maxLength > 0 ? el.maxLength : 1000); var ab = document.getElementById('cx-ait-' + kk[0]); if (ab) ab.innerHTML = aitInner(kk[0]); return; }
    draft[el.name] = el.value; var c = document.getElementById('cnt-' + el.name); if (c) c.textContent = el.value.length + '/' + el.dataset.count;
  });
  // 手机相机 / 相册给的文件名没有意义（JPEG_20261005_065601_…、IMG_1234、1000000019.mp4）：换成「照片 10月5日 06:56」这样的名字
  function niceFileName(f) {
    var n = String(f && f.name || ''), ext = (n.match(/\.[A-Za-z0-9]{1,5}$/) || [''])[0], base = n.slice(0, n.length - ext.length);
    if (!/^(IMG|VID|PXL|JPEG|MVIMG|image|video|photo|DSC|MOV)[_-]?[0-9_-]*$/i.test(base) && !/^\d{6,}$/.test(base) && !/^(IMG|VID|PXL)_\d{8}_\d{6}/i.test(base)) return n;
    var kind = /^video\//.test(f.type) || /^(VID|MOV)/i.test(base) ? '视频' : /^audio\//.test(f.type) ? '录音' : '照片';
    var d = new Date(f.lastModified || Date.now()), p2 = function (x) { return (x < 10 ? '0' : '') + x; };
    return kind + ' ' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ext.toLowerCase();
  }
  // 选项卡片的选中样式：新浏览器靠 CSS :has(input:checked)，旧版安卓 WebView / iOS 15.3 以前不支持，用 is-checked 类兜底
  var CHECK_SEL = '.opt, .who label, .as-pi, .np-po';
  function markChecked(root) { Array.prototype.forEach.call((root || document).querySelectorAll(CHECK_SEL), function (l) { var i = l.querySelector('input'); l.classList.toggle('is-checked', !!(i && i.checked)); }); }
  // flex 布局的 gap：Chrome 84 以前（没更新过的 Android 11 等）不支持，元素会挤在一起。检测到不支持时，把 gap 换成子元素的外边距（子元素自己已有外边距的那一边不动）
  var flexGapOK = null;
  function hasFlexGap() {
    if (window.__tmNoFlexGap) return false;
    if (flexGapOK === null) { var d = document.createElement('div'); d.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden'; d.appendChild(document.createElement('div')); d.appendChild(document.createElement('div')); document.body.appendChild(d); flexGapOK = d.scrollHeight === 1; d.parentNode.removeChild(d); }
    return flexGapOK;
  }
  function flexGapFix(root) {
    if (hasFlexGap()) return;
    Array.prototype.forEach.call((root || document).querySelectorAll('*'), function (el) {
      if (el.dataset.fg) return;
      var cs = getComputedStyle(el); if (cs.display.indexOf('flex') < 0) return;
      var cg = parseFloat(cs.columnGap) || 0, rg = parseFloat(cs.rowGap) || 0; if (!cg && !rg) return;
      var col = cs.flexDirection.indexOf('column') === 0, wrap = cs.flexWrap !== 'nowrap', first = true;
      el.dataset.fg = '1';
      Array.prototype.forEach.call(el.children, function (k) {
        var ks = getComputedStyle(k); if (ks.position === 'absolute' || ks.position === 'fixed' || ks.display === 'none') return;
        if (wrap) { if (!parseFloat(ks.marginRight) && cg) k.style.marginRight = cg + 'px'; if (!parseFloat(ks.marginBottom) && rg) k.style.marginBottom = rg + 'px'; return; }
        if (first) { first = false; return; }
        if (col) { if (ks.marginTop === '0px' && rg) k.style.marginTop = rg + 'px'; }
        else if (ks.marginLeft === '0px' && cg) k.style.marginLeft = cg + 'px';
      });
    });
  }
  new MutationObserver(function () { markChecked(); flexGapFix(document.getElementById('layer')); }).observe(document.getElementById('layer'), { childList: true });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.type === 'radio' || el.type === 'checkbox') markChecked();
    if (el.type === 'file' && el.files) Array.prototype.forEach.call(el.files, function (f) { var nn = niceFileName(f); if (nn !== f.name) try { Object.defineProperty(f, 'name', { value: nn }); } catch (x) {} });
    if (el.dataset && el.dataset.dvfile && el.files.length) {
      Array.prototype.forEach.call(el.files, function (f) { if (dvPick.length >= 9) return; var lid = rid('b'); blobs[lid] = keepBlob(lid, f); dvPick.push({ kind: /^image\//.test(f.type) ? 'image' : /^video\//.test(f.type) ? 'video' : /^audio\//.test(f.type) ? 'audio' : 'file', name: f.name, localId: lid, size: fmtSize(f.size) }); });
      el.value = ''; dvRender(); if (dvPick.length >= 9) toast('每次提交最多 9 个文件'); return;
    }
    if (el.dataset && (el.dataset.pd || el.dataset.pt != null) && pd) { if (el.dataset.pd) pd[el.dataset.pd] = el.value; else pd.tasks[+el.dataset.pt][el.dataset.f] = el.value; if (el.dataset.pd === 'leadId' || el.dataset.pd === 'due') render(); return; }
    if (el.dataset && el.dataset.camfile && el.files.length) { addVideos(el.files); return; }
    if (el.dataset && el.dataset.aiimg && el.files[0]) { var imf = el.files[0]; el.value = ''; closeSheet(); aiImageRead(imf); return; }
    if (el.dataset && el.dataset.aifile && el.files[0]) { var af = el.files[0]; if (!/\.(txt|md)$/i.test(af.name) && !/^text\//.test(af.type)) { toast('演示版只能读取 TXT、Markdown 文本文件', true); return; } var rd = new FileReader(); rd.onload = function () { var tx2 = String(rd.result).slice(0, 4000); if (!aiS.mode) aiS.mode = 'minutes'; aiHandle(tx2); renderAI(); }; rd.readAsText(af); return; }
    if (el.dataset && el.dataset.pref) { var pp = {}; pp[el.dataset.pref] = el.checked; act('member.update', { id: me, prefs: pp }, el.checked ? '已开启' : '已关闭'); return; }
    if (el.dataset && el.dataset.kbfile && el.files.length) { var fs = Array.prototype.slice.call(el.files), n = 0, bad = []; var next = function () { var f = fs.shift(); if (!f) { save(); render(); toast(n ? '已添加 ' + n + ' 份资料' + (bad.length ? '；' + bad.join('、') + ' 没读到内容' : '') : '没有添加成功：' + bad.join('、'), !n); return; } if (f.size > (/\.(docx|pdf)$/i.test(f.name) ? 10000000 : 600000)) { bad.push(f.name + '（太大）'); return next(); } var f2title = ''; var addKb = function (body) { var r = TM.act(S, me, 'kb.add', { title: f.name.replace(/\.(md|markdown|txt|docx|pdf)$/i, '').slice(0, 40) + f2title, body: body, scope: 'team' }); if (r.ok) n++; else bad.push(f.name + '（' + r.error + '）'); next(); }; if (/\.docx$/i.test(f.name)) { docxToMd(f).then(addKb, function (e) { bad.push(f.name + '（' + (e && e.message || '读不出来') + '）'); next(); }); return; } if (/\.pdf$/i.test(f.name)) { if (!AI_ON) { bad.push(f.name + '（PDF 需要启用 AI 才能读取）'); return next(); } toast('Claude 正在读「' + f.name + '」…'); var fr2 = new FileReader(); fr2.onerror = function () { bad.push(f.name + '（读不出来）'); next(); }; fr2.onload = function () { TMS.aiDoc(f.name, String(fr2.result).split(',')[1] || '').then(function (r) { if (r.truncated) f2title = '（内容不完整）'; addKb(r.text || ''); }, function (e) { bad.push(f.name + '（' + ((e && e.error) || 'AI 读取失败') + '）'); next(); }); }; fr2.readAsDataURL(f); return; } var rd = new FileReader(); rd.onload = function () { addKb(String(rd.result || '')); }; rd.onerror = function () { bad.push(f.name); next(); }; rd.readAsText(f); }; next(); el.value = ''; return; }
    if (el.dataset && el.dataset.avatar && el.files.length) { avatarPick(el.files[0]); el.value = ''; return; }
    if (el.dataset && el.dataset.wfile && el.files.length) { var wm = Array.prototype.map.call(el.files, function (f) { var o = { kind: /^image\//.test(f.type) ? 'image' : /^video\//.test(f.type) ? 'video' : /^audio\//.test(f.type) ? 'audio' : 'file', name: f.name, size: fmtSize(f.size) }; o.localId = rid('w'); blobs[o.localId] = keepBlob(o.localId, f); return o; }); act('work.attach', { id: el.dataset.wfile, media: wm }, '已上传 ' + wm.length + ' 个文件' + (SRV ? '' : '（演示版不上传）')); return; }
    if (el.dataset && el.dataset.ixfile && el.files.length) { var media = Array.prototype.map.call(el.files, function (f) { var o = { kind: /^image\//.test(f.type) ? 'image' : /^video\//.test(f.type) ? 'video' : /^audio\//.test(f.type) ? 'audio' : 'file', name: f.name, size: fmtSize(f.size) }; o.localId = rid('x'); blobs[o.localId] = keepBlob(o.localId, f); return o; }); act('idea.attach', { id: el.dataset.ixfile, media: media }, '已添加 ' + media.length + ' 个附件' + (SRV ? '' : '（演示版不上传）')); return; }
    if (el.dataset && el.dataset.speriod) { st.period = +el.value; render(); return; }
    if (el.dataset && el.dataset.wdue) { act('work.update', { id: el.dataset.wdue, due: el.value }, '已更新截止时间'); return; }
    if (el.dataset && el.dataset.as === 'milestone' && asg) { asg.milestone = el.checked; return; }
    if (el.dataset && el.dataset.as === 'due' && asg) { asg.due = el.value; asg.dueSet = true; render(); return; }
    if (el.dataset && el.dataset.tf === 'date' && tf) { tf.date = el.value; render(); return; }
    if (el.dataset && el.dataset.ta === 'lang') { ta.lang = el.value; return; }
    if (el.dataset && el.dataset.tafile && el.files[0]) { var tfl = el.files[0]; if (!/\.(txt|md)$/i.test(tfl.name) && !/^text\//.test(tfl.type)) { toast('演示版只能读取 TXT、Markdown 文本文件', true); return; } var fr = new FileReader(); fr.onload = function () { ta.text = String(fr.result).slice(0, 3000); render(); toast('已读取「' + tfl.name + '」，点「生成待办」'); }; fr.readAsText(tfl); return; }
    if (el.dataset && el.dataset.tavideo && el.files[0] && canSrvTr()) { var tvf = el.files[0]; el.value = ''; srvTr(tvf, '视频').then(function (t) { if (t) { ta.text = (ta.text + (ta.text ? '\n' : '') + t).slice(0, 3000); render(); toast('已转成文字，可以点「AI 生成待办」'); } else toast('视频里没有识别到说话', true); }, function () {}); return; }
    if (el.dataset && el.dataset.tavideo && el.files[0]) { openSheet('视频已选择', '<p>' + esc(el.files[0].name) + '</p><p class="muted" style="font-size:14px">演示版无法读取视频里的语音。正式版会提取音轨并自动转写。现在可以改用录音、上传文本文件，或在下方直接输入文字。</p>', '知道了', function () { closeSheet(); }); return; }
    if (el.dataset && el.dataset.fifile && el.files.length) { addFiles(el.files); return; }
    if (el.dataset && el.dataset.txai) { tx.ai = el.checked; txPersist(); render(); return; }
    if (el.dataset && el.dataset.txfile) { Array.prototype.forEach.call(el.files, function (f) { tx.files.push({ kind: /^image/.test(f.type) ? 'image' : 'file', name: f.name + '（' + Math.max(1, Math.round(f.size / 1024)) + ' KB）' }); }); render(); return; }
    if (el.dataset && el.dataset.pfile && pd) { Array.prototype.forEach.call(el.files, function (f) { pd.files.push({ kind: /^image/.test(f.type) ? 'image' : 'file', name: f.name + '（' + Math.max(1, Math.round(f.size / 1024)) + ' KB）' }); }); render(); return; }
    if (el.dataset && el.dataset.aivideo && el.files[0] && canSrvTr()) { var vf2 = el.files[0], vl = rid('b'); blobs[vl] = keepBlob(vl, vf2); ai.pending = { kind: 'video', name: vf2.name, size: fmtSize(vf2.size), localId: vl }; el.value = '';
      srvTr(vf2, '视频').then(function (t) { if (t) runParse(t, '视频「' + vf2.name + '」，服务器转写 ' + t.length + ' 字'); else toast('视频里没有识别到说话，可以去手动填写', true); }, function () {}); return; }
    if (el.dataset && el.dataset.aivideo && el.files[0]) { var vf = el.files[0]; ai.pending = { kind: 'video', name: vf.name + '（' + Math.round(vf.size / 1048576 * 10) / 10 + ' MB）' }; openSheet('视频已选择', '<p>' + esc(vf.name) + '</p><p class="muted" style="font-size:14px">演示版不会上传视频，也无法读取视频里的语音。正式版会提取音轨并自动转写。现在可以把视频作为附件，去手动填写项目信息。</p>', '去手动填写', function () { pd = freshPD(); pd.files = [ai.pending]; ai.pending = null; closeSheet(); location.hash = '#/project'; render(); }); return; }
    if (el.dataset.set) {
      var k = el.dataset.set, v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? null : +el.value) : el.value;
      if (k === 'staleDays') v = Math.max(1, Math.min(30, v || 3));
      act('settings.update', (function () { var o = {}; o[k] = v; return o; })(), '设置已保存');
      return;
    }
    if (el.dataset.doChange === 'pickFile' && el.files[0]) { var fl = el.files[0]; newMedia.push({ kind: /^audio/.test(fl.type) ? 'audio' : /^video/.test(fl.type) ? 'video' : 'file', name: fl.name + '（' + Math.round(fl.size / 1024) + ' KB）' }); render(); return; }
    if (el.name === 'path') { var b = document.getElementById('coBox'); if (b) b.hidden = el.value !== 'cocreate'; }
    if (el.name === 'kind') syncRoute();
    if (el.name === 'what') { var x = document.getElementById('moreExtra'); if (x) x.hidden = el.value !== 'escalate'; x && x.querySelectorAll('select,textarea').forEach(function (n) { n.disabled = el.value !== 'escalate'; }); }
  });
  document.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (f.dataset && f.dataset.aiform) { var q = (f.q.value || '').trim(); aiS.input = ''; if (!q) return toast('先输入点内容', true); aiHandle(q); renderAI(); return; }
    if (f.classList.contains('sheet')) { if (sheetHandler) sheetHandler(fd(f)); return; }
    var o = fd(f), name = f.dataset.form, c = cur();
    if (SRVF[name]) { if (f.server && !f.server.checkValidity()) return toast('服务器地址格式不对', true); return SRVF[name](o, f); }
    if (name === 'newIdea') {
      if (rec) { toast('请先停止录音', true); return; }
      var go = e.submitter ? e.submitter.value : 'draft';
      var r = TM.act(S, me, 'idea.create', { title: o.title, note: o.note, dept: o.dept || null, media: newMedia.slice() });
      if (!r.ok) { toast(r.error, true); return; }
      save(); newMedia = []; draft = { title: '', note: '', mode: 'text', big: false }; navFinish('#/idea/' + r.id);
      if (go === 'submit') setTimeout(function () { submitSheet(r.id); }, 50); else toast('已保存为私人草稿');
    } else if (name === 'suggest') act('idea.suggest', { id: c.id, body: o.body, replyTo: o.replyTo || null }, '建议已发送');
    else if (name === 'addCheck') act('task.addCheck', { id: c.id, title: o.title });
    else if (name === 'comment') act('task.comment', { id: c.id, body: o.body }, '已发送');
    else if (name === 'wComment') { var rr = act('work.comment', { id: c.id, body: o.body }, '已发送'); if (rr.ok) { var ta = document.querySelector('form[data-form=wComment] textarea'); if (ta) ta.value = ''; } }
  });
  /* 页面切换动画（像原生 App）：进入下一级从右滑入，返回反向滑出，切换底部标签淡入淡出。
     有 View Transitions（iOS 18+、Android WebView 111+）时新旧两页一起动；没有时只给新页一个进入动画。
     自动化测试（navigator.webdriver）里默认关闭，避免改变页面更新的时机；window.__tmAnim = true 可强制打开。 */
  var ROOTS = { home: 1, ideas: 1, tasks: 1, work: 1, me: 1 }, navStack = [location.hash || '#/home'], lastTap = 0;
  document.addEventListener('pointerdown', function () { lastTap = Date.now(); }, true);
  document.addEventListener('keydown', function () { lastTap = Date.now(); }, true);
  function navDepth(h) { var p = String(h || '').replace(/^#\/?/, '').split('/').filter(Boolean); if (!p.length || (p.length === 1 && ROOTS[p[0]])) return 0; return p.length; }
  // 返回：有来源页面就回来源页面（浏览历史），没有（例如重新打开 App 后）就回到这个页面的上一级
  function navParent(h) {
    var p = String(h || '').replace(/^#\/?/, '').split('/'), n = p[0], id = p[1];
    if (n === 'idea') return id && p[2] ? '#/idea/' + id : '#/ideas';
    if (n === 'task') return '#/tasks';
    if (n === 'work') return id && p[2] ? '#/work/' + id : '#/work';
    if (n === 'assign') return id ? '#/work/' + id : '#/work';
    if (n === 'new') return id ? '#/new' : '#/ideas';
    if (n === 'project') return id ? '#/project' : '#/home';
    if (n === 'todo') return p[2] ? '#/todo/new' : '#/tasks';
    if (n === 'kb') return id ? '#/kb' : '#/me';
    if (n === 'settings' || n === 'team') return '#/me';
    return '#/home';
  }
  var navReplacing = false;
  function navReplace(h) { navReplacing = true; location.replace(h); }
  function goBack() {
    if (navStack.length > 1) { history.back(); return; }
    navReplace(navParent(location.hash));
  }
  // 手机返回键（Android）：先关弹窗 / AI 面板，再返回上一页；在底部标签页先回首页，在首页才退出
  function hardBack() {
    if (document.querySelector('#layer .sheet')) { closeSheet(); return true; }
    if (aiS.open) { aiS.open = false; renderAI(); return true; }
    if (!me) return false;
    if (navDepth(location.hash) > 0) { DO.back(); return true; }
    if (cur().name !== 'home') { location.hash = '#/home'; return true; }
    // 首页：防止误触，2 秒内再按一次才退出
    if (Date.now() - (hardBack.t || 0) > 2000) { hardBack.t = Date.now(); toast('再按一次退出'); return true; }
    return false;
  }
  // 完成一个表单（提交想法、新建项目、派任务、加待办……）后跳到结果页：把表单页从返回路径里去掉，
  // 结果页按返回直接回到开始填表之前的页面。dropCurrent：当前页也去掉（例如删除了正在看的想法）
  function navForm(h) { var c = String(h).replace(/^#\/?/, '').split('/'); return c[0] === 'new' || c[0] === 'project' || c[0] === 'assign' || (c[0] === 'todo' && c[1] === 'new') || (c[0] === 'kb' && c[1] === 'voice'); }
  var navAfter = null;
  function navFinish(h, dropCurrent) {
    var k = 0; for (var i = navStack.length - 1; i > 0 && navForm(navStack[i]); i--) k++;
    if (!k && dropCurrent && navStack.length > 1) k = 1;
    if (!k) { location.hash = h; return; }
    var base = navStack[navStack.length - 1 - k];
    navStack = navStack.slice(0, navStack.length - k);
    if (base !== h) navAfter = h;
    history.go(-k);
    // 万一浏览历史和记录对不上（没有触发跳转），直接过去
    setTimeout(function () { if (navAfter) { var t = navAfter; navAfter = null; location.hash = t; } }, 700);
  }
  function navKind(h) {
    if (navReplacing) { navReplacing = false; navStack[navStack.length - 1] = h; return 'pop'; }
    if (navStack[navStack.length - 1] === h) return 'pop';
    var prev = navStack[navStack.length - 1], d0 = navDepth(prev), d1 = navDepth(h), k;
    if (navStack.length > 1 && navStack[navStack.length - 2] === h) { navStack.pop(); k = 'pop'; }
    else if (d1 === 0 && d0 === 0) { navStack = [h]; k = 'fade'; }
    else if (d1 < d0) { var i = navStack.lastIndexOf(h); navStack = i >= 0 ? navStack.slice(0, i + 1) : (d1 === 0 ? [h] : navStack.slice(0, -1).concat(h)); k = 'pop'; }
    else { navStack.push(h); if (navStack.length > 30) navStack.shift(); k = 'push'; }
    return k;
  }
  function animOK() {
    if (navigator.webdriver && !window.__tmAnim) return false;
    try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false; } catch (e) {}
    return true;
  }
  function navTo(update) {
    var kind = navKind(location.hash), root = document.documentElement;
    // iOS 侧滑返回时系统已经播过滑动动画，不再重复
    var gesture = kind === 'pop' && Date.now() - lastTap > 800 && typeof TMN !== 'undefined' && TMN.platform === 'ios';
    if (!animOK() || gesture || !me) return update();
    if (document.startViewTransition) {
      root.setAttribute('data-nav', kind);
      try {
        var t = document.startViewTransition(update);
        t.finished.then(done, done);
      } catch (e) { done(); update(); }
      return;
    }
    update();
    var app = document.getElementById('app');
    app.classList.remove('pg-push', 'pg-pop', 'pg-fade'); void app.offsetWidth; app.classList.add('pg-' + kind);
    clearTimeout(navTo.t); navTo.t = setTimeout(function () { app.classList.remove('pg-' + kind); }, 400);
    function done() { root.removeAttribute('data-nav'); }
  }
  window.addEventListener('scroll', function () { var t = document.querySelector('.top'); if (t) t.classList.toggle('stuck', window.scrollY > 8); }, { passive: true });
  window.addEventListener('hashchange', function () { if (navAfter) { var na = navAfter; navAfter = null; navStack[navStack.length - 1] = location.hash; location.hash = na; return; } if (aiS.open) { aiS.open = false; renderAI(); } if (ai.recording && cur().id !== 'ai') aiStop(); if (ta.recording && cur().sub !== 'ai') taStop(); var cc0 = cur(); if (!(cc0.name === 'new' && cc0.id === 'voice') && (vo.state === 'rec' || vo.state === 'pause')) VO.voStop(); closeSheet(); navTo(function () { render(); window.scrollTo(0, 0); }); });
  if (!me) location.hash = '#/login';
  render();
  // 启动后查一次有没有新版本（安卓）；老板 / 管理员也顺便拿到安装包信息
  setTimeout(function () { appCheck(false); }, 3000);
  // 上次 App 意外关闭（Android 记录的原因）：提示一次，可复制发给开发者
  if (typeof TMN !== 'undefined' && TMN.lastCrash) TMN.lastCrash().then(function (t) {
    if (!t) return;
    if (SRV && TMS.loggedIn() && TMS.diag) TMS.diag({ kind: 'crash', text: t.slice(0, 3000) }); // 登录了团队服务器：同时发一份给服务器
    // 稍等一下再弹（刚打开时用户可能马上点进别的页面，切页会关掉弹窗）；已有弹窗时等它关掉
    setTimeout(function show() {
      if (document.querySelector('#layer .sheet')) return setTimeout(show, 1000);
      openSheet('App 上次意外关闭', '<p style="margin:0 0 10px">很抱歉，App 上次意外关闭了。数据已自动保存，不会丢失。把下面的信息复制发给负责维护的同事，可以帮助尽快修好。</p><textarea readonly rows="7" style="width:100%;font-size:12px;font-family:ui-monospace,monospace" id="crashText">' + esc(t) + '</textarea>', '复制信息', function () {
        var tx = document.getElementById('crashText'), v = tx ? tx.value : t;
        (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { toast('已复制'); closeSheet(); }, function () { if (tx) { tx.select(); } toast('请长按文字手动复制', true); });
      });
    }, 1200);
  });
  window.__tm = { ask: askSheet, back: hardBack, as: function (uid) { if (SRV || !TM.user(S, uid)) return false; me = uid; try { localStorage.setItem(KU, me); } catch (e) {} closeSheet(); if (aiS.open) { aiS.open = false; renderAI(); } render(); return true; }, get S() { return S; }, get me() { return me; }, setState: function (ns) { S = TM.migrate(ns); save(); if (me && !TM.user(S, me)) { me = null; } render(); }, toast: toast };
})();
