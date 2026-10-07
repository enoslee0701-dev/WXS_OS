/* app/19_demo_tour.js — 演示向导、window.__tm。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
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
      { who: 'u_op', t: '运营者派发，形成项目', d: '林晓把它派给项目负责人陈立。想法正式变成「项目」：负责人陈立、运营者林晓、验收人陈立。', run: function () { var r = TM.act(S, me, 'idea.route', { id: g().idea, kind: 'product', leadId: 'u_lead', title: '明年开发团队扩编' }); if (r.ok) g().work = r.workId; return r.ok ? { ok: true, hash: '#/work/' + g().work } : r; } },
      { who: 'u_lead', t: '负责人拆任务', d: '陈立把项目拆成具体任务，写清：谁做、交什么、怎样算合格、哪天截止。这里派给刘洋写招聘方案。', run: function () {
        var due = TM.todayStr ? TM.todayStr(S) : null;
        var r = TM.act(S, me, 'work.plan', { id: g().work, tasks: [{ title: '写开发岗位招聘方案', ownerId: 'u_dev', expected: '一份招聘方案文档', criteria: '包含岗位职责、预算和时间表', priority: 'hi', due: due }] }); if (!r.ok) return r;
        var t = S.tasks.filter(function (x) { return x.workId === g().work; }).pop(); g().task = t.id; return { ok: true, hash: '#/work/' + g().work }; } },
      { who: 'u_dev', t: '执行者接收并开始', d: '刘洋在自己的任务页看到这条任务，点「接收」，再点「开始」，状态变成进行中，跟进的人都能看到。', run: function () { var r = TM.act(S, me, 'task.transition', { id: g().task, action: 'accept' }); if (!r.ok) return r; r = TM.act(S, me, 'task.transition', { id: g().task, action: 'start' }); return r.ok ? { ok: true, hash: '#/task/' + g().task } : r; } },
      { who: 'u_dev', t: '执行者提交成果', d: '刘洋做完，点「提交成果」，附上说明。球踢到验收人那边。', run: function () { var r = TM.act(S, me, 'task.transition', { id: g().task, action: 'submit', note: '招聘方案已完成：两个岗位职责、预算、三个月时间表' }); return r.ok ? { ok: true, hash: '#/task/' + g().task } : r; } },
      { who: 'u_lead', t: '验收人验收任务', d: '陈立看成果，觉得可以就点「通过」（不行就「退回」并写原因，执行者改完再交）。', run: function () { var r = TM.act(S, me, 'task.review', { id: g().task, verdict: 'pass', note: '方案清楚，可以执行' }); return r.ok ? { ok: true, hash: '#/task/' + g().task } : r; } },
      { who: 'u_owner', t: '老板终验', d: '设置里开了「老板终验」，所以负责人验收后还要老板再过一道。', skip: function () { var t = S.tasks.find(function (x) { return x.id === dm.task; }); return !t || t.status !== 'owner_review'; }, run: function () { var r = TM.act(S, me, 'task.ownerReview', { id: g().task, verdict: 'owner_pass', note: '同意' }); return r.ok ? { ok: true, hash: '#/task/' + g().task } : r; } },
      { who: 'u_lead', t: '确认项目完成', d: '所有任务都通过了，项目自动进入「待验收」。验收人点「确认项目完成」，整件事收尾。', run: function () { var r = TM.act(S, me, 'work.close', { id: g().work, note: '招聘方案通过，进入执行' }); return r.ok ? { ok: true, hash: '#/idea/' + g().idea } : r; } },
      { who: 'u_owner', t: '流程走完了', d: '已切回老板。看顶部进度条：想法 → 整理 → 项目 → 执行 → 验收，五格全部完成。点「查看操作记录」可以看到每一步是谁、什么时候做的。', end: true }
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
    if (el.dataset && el.dataset.mtfile && el.files.length) { /* 会议拆任务：上传已有的会议录音（手机录音机、微信语音导出等）→ 服务器转文字 */
      var mf = el.files[0]; el.value = ''; var ta0 = document.getElementById('mt-text'); if (ta0) mt.text = ta0.value;
      if (!canSrvTr()) return toast('这里没法转文字：请连接团队服务器，或把会议纪要粘贴进来', true);
      srvTr(mf, '会议录音').then(function (t) { if (!t) { mtOpen(); return toast('录音里没有识别到说话', true); } mt.text = (mt.text ? mt.text + '\n' : '') + t; mtOpen(); toast('已转成文字，可以点「拆成任务」'); }, function () { mtOpen(); /* 转失败也回到会议面板，已写的内容还在 */ });
      return;
    }
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
    if (el.dataset && el.dataset.as === 'reviewerId' && asg) { asg.reviewerId = el.value; return; }
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
        t.finished.then(done, done); if (t.ready) t.ready.catch(function () {}); if (t.updateCallbackDone) t.updateCallbackDone.catch(function () {}); // 连点两次时上一个动画被打断：不算错误
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
