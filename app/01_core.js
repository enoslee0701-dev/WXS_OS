/* app/01_core.js — 存储、工具、卡片组件、全局状态。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
  'use strict';
  var K = 'tm_demo_v3', KU = 'tm_user_v3';
  var APPICON = '__APPICON__'; /* 构建时换成 img/app-icon-192.png 的 data URI（只嵌一次） */
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
  var AI_ON = false, AI_CFG = false; var TR_ON = false, APPV = '', AI_LOCAL = false, AI_MODEL = ''; // AI_LOCAL：没有 Claude 密钥，用的是服务器本机的开源模型 // APPV：安装的 App 版本号（原生 App 才有）
  if (typeof TMN !== 'undefined' && TMN.appInfo) TMN.appInfo().then(function (i) { if (i && i.version) APPV = i.version; });
  // 团队服务器装了语音转写（录音 / 视频自动转文字）
  if (typeof TMS !== 'undefined' && TMS.loggedIn()) TMS.aiStatus().then(function (r) { AI_ON = !!(r && r.enabled); AI_CFG = !!(r && r.configured); TR_ON = !!(r && r.transcribe); AI_LOCAL = !!(r && r.provider === 'local'); AI_MODEL = r && r.model || ''; if (AI_ON && aiS && aiS.open) renderAI(); else if (AI_ON || TR_ON) { var fe = document.activeElement; if (!fe || !/^(INPUT|TEXTAREA|SELECT)$/.test(fe.tagName)) render(); } /* 拿到 AI 状态后刷新一次：「本机 AI」字样、AI 按钮 */ });
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
  // 打开一个附件（项目文件、交付物、想法附件通用）：图片 / 录音 / 视频在面板里看，其他交给系统
  function openMedia(m) {
    if (m.kind === 'link') { if (m.url) openLink(m.url); return; }
    var b = m.localId && blobUrl(m.localId); if (!b) return toast(SRV ? '这个文件还没上传完，稍后再试' : '演示版没有上传，这个文件只在添加它的设备上、刷新前能打开', true);
    if (m.kind === 'image') return openSheet(m.name, '<img src="' + b + '" alt="' + esc(m.name) + '" style="width:100%;border-radius:14px">', '关闭', function () { closeSheet(); });
    if (m.kind === 'audio') return openSheet(m.name, '<audio controls src="' + b + '" style="width:100%"></audio>', '关闭', function () { closeSheet(); });
    if (m.kind === 'video') return openSheet(m.name, '<video controls playsinline src="' + b + '" style="width:100%;border-radius:14px"></video>', '关闭', function () { closeSheet(); });
    openFile(b, m.name);
  }
  /* 全部文件：我能看到的项目文件、交付物附件、想法附件，按类型筛选、按名字搜 */
  var fl = { k: 'all', q: '' };
  function allFiles() {
    var out = [];
    vWork().forEach(function (w) { (w.files || []).forEach(function (m) { out.push({ m: m, src: '项目「' + w.title + '」', href: '#/work/' + w.id, at: m.at || w.createdAt, by: m.by }); }); });
    var vt = {}; vTasks().forEach(function (t) { vt[t.id] = t; });
    (S.deliverables || []).forEach(function (f) { var t = vt[f.taskId]; if (!t) return; (f.media || []).forEach(function (m) { out.push({ m: m, src: '交付物 · 任务「' + t.title + '」', href: '#/task/' + t.id, at: f.at, by: f.by }); }); });
    vIdeas().forEach(function (d) { if (!TM.canViewMedia(S, me, d)) return; (d.media || []).forEach(function (m) { if (TM.canSeeMediaItem(S, me, d, m)) out.push({ m: m, src: '想法「' + (d.title || '未命名') + '」', href: '#/idea/' + d.id, at: m.at || d.createdAt, by: m.by || d.creatorId }); }); });
    return out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
  }
  function flKind(m) { var n = (m.name || '').toLowerCase(); return m.kind === 'link' ? 'link' : m.kind === 'image' || /\.(png|jpe?g|gif|webp|heic)$/.test(n) ? 'img' : m.kind === 'audio' || m.kind === 'video' ? 'av' : 'doc'; }
  function viewFiles() {
    var all = allFiles(), K = [['all', '全部'], ['doc', '文档'], ['img', '图片'], ['av', '录音视频'], ['link', '链接']], q = fl.q.trim().toLowerCase();
    var rows = all.filter(function (x) { return (fl.k === 'all' || flKind(x.m) === fl.k) && (!q || (x.m.name + ' ' + x.src).toLowerCase().indexOf(q) >= 0); });
    return ixHead('全部文件', '我能看到的项目文件、交付物和想法附件') + '<div class="fl-top"><input type="search" id="flq" placeholder="按文件名或项目名找" value="' + esc(fl.q) + '"></div>' +
      '<div class="w-chips">' + K.map(function (k) { var n = all.filter(function (x) { return k[0] === 'all' || flKind(x.m) === k[0]; }).length; return '<button class="' + (fl.k === k[0] ? 'on' : '') + '" data-do="flKind" data-k="' + k[0] + '">' + k[1] + ' <i>' + n + '</i></button>'; }).join('') + '</div>' +
      (rows.length ? '<div class="list wf-list fl-list">' + rows.slice(0, 200).map(function (x, i) { var meta = [x.src, x.by ? nm(x.by) : '', x.at ? ago(x.at) : ''].filter(Boolean).join(' · ');
        return '<div class="row wf"><button class="wf-o" data-do="flOpen" data-i="' + all.indexOf(x) + '">' + wfIcon(x.m) + '<span class="wf-t"><b>' + esc(x.m.name) + '</b><small>' + esc(meta) + '</small></span></button><a class="fl-go" href="' + x.href + '" aria-label="去所在的地方">' + hi('chev', 2) + '</a></div>'; }).join('') + '</div>' : emptyBox(all.length ? '没有符合条件的文件。' : '还没有文件。在项目、任务交付或想法里上传后，会集中显示在这里。'));
  }
  /* 表单错误：标红那个输入框、在下面写明原因、滚过去并聚焦（规范 §45：错误要明确，不能只靠一闪而过的提示） */
  function fieldErr(sel, msg) {
    var el = document.querySelector(sel); toast(msg, true); if (!el) return;
    el.classList.add('f-err'); el.setAttribute('aria-invalid', 'true');
    var tip = el.parentNode.querySelector('.f-msg'); if (!tip) { tip = document.createElement('small'); tip.className = 'f-msg'; tip.setAttribute('role', 'alert'); el.insertAdjacentElement('afterend', tip); } tip.textContent = msg;
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); } setTimeout(function () { try { el.focus({ preventScroll: true }); } catch (e) {} }, 250);
    el.addEventListener('input', function clr() { el.classList.remove('f-err'); el.removeAttribute('aria-invalid'); if (tip.parentNode) tip.remove(); el.removeEventListener('input', clr); });
  }
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
    var meta = ['<span>' + L.kind[w.kind] + '</span>', '<span>阶段：' + esc(wStage(w)) + '</span>', '<span>任务 ' + p.done + '/' + p.total + '</span>'];
    if (flags) meta.push('<span class="r">' + flags + ' 项需关注</span>');
    var nx = w.status === 'planning' ? { who: w.leadId, what: '安排任务' } : w.status === 'acceptance' ? { who: w.reviewerId, what: '确认项目完成' } : null;
    return '<a class="row' + (flags ? ' flag' : '') + '" href="#/work/' + w.id + '"><div class="t"><span>' + esc(w.title) + '</span>' + pill('work', w.status) + '</div><div class="m">' + meta.join('') + '</div>' +
      (p.total ? '<div class="bar"><i style="width:' + Math.round(p.done / p.total * 100) + '%"></i></div>' : '') + batonHTML(nx) + '</a>';
  }
  function decisionRow(dc) {
    var d = dc.ideaId ? I(dc.ideaId) : null;
    return '<a class="row" href="#/idea/' + (d ? d.id : '') + '"><div class="t"><span>' + esc(dc.question) + '</span><span class="pill t-wait">' + esc(L.decision[dc.kind]) + '</span></div><div class="m"><span>' + esc(TM.name(S, dc.requestedBy)) + ' 上报</span><span>' + ago(dc.at) + '</span></div></a>';
  }
  var INBOX = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/></svg>';
  // 启动时还在从服务器 / 本机缓存读数据：显示骨架，不显示「没有…」（规范 §35：空状态不能当加载用）
  function emptyBox(msg) { if (S.loading) return '<div class="skel" aria-busy="true" aria-label="正在载入"><i></i><i></i><i></i></div>'; return '<div class="empty">' + INBOX + '<span>' + esc(msg) + '</span></div>'; }
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

