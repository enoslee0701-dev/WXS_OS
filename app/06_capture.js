/* app/06_capture.js — 记录想法：语音 / 视频 / 文字 / 文件。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
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
  function cxNext(k, label, hint) { return aitBar(k) + '<button class="vr-next" data-do="capNext" data-k="' + k + '">' + hi('spark', 1.6) + label + ni('arrow', 2) + '</button><p class="c-hint">' + hint + ' <button type="button" class="cx-draft" data-do="capSave" data-k="' + k + '">存为私人草稿</button></p>'; } // 先不提交，只存草稿（只有自己能看到）
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
    if (SRV && me && TMS.mustChange && !mustAsked && !document.querySelector('#layer .sheet')) { mustAsked = true; setTimeout(function () { mustAsked = false; if (TMS.mustChange && !document.querySelector('#layer .sheet')) DO.srvPassword(); }, 300); } // 没改完初始密码，面板被关掉也会再弹
    if (SRV && me && isOwner() && S.real && !S.loading && cur().name === 'home' && !onboardAsked && !document.querySelector('#layer .sheet') && !onboardDone()) { onboardAsked = true; setTimeout(function () { DO.onboard(); }, 400); }
    // 新成员第一次进来（改完初始密码后）：按角色欢迎一次，说清楚在哪里做事
    if (SRV && me && !isOwner() && !TMS.mustChange && !S.loading && cur().name === 'home' && !welcomeAsked && !document.querySelector('#layer .sheet') && !welcomed()) { welcomeAsked = true; setTimeout(function () { DO.welcome(); }, 400); }
    var strip = document.getElementById('tkdays');
    if (strip) { if (td.stripScroll != null) strip.scrollLeft = td.stripScroll; else { var tg = strip.querySelector('.today') || strip.querySelector('.on'); if (tg) strip.scrollLeft = tg.offsetLeft - strip.firstElementChild.offsetLeft; } strip.onscroll = function () { td.stripScroll = strip.scrollLeft; }; }
    document.querySelectorAll('video[data-vmeta]').forEach(function (v) { v.onloadedmetadata = function () { var m = cam.clips[+v.dataset.vmeta]; if (m && !m.durationSec && isFinite(v.duration)) { m.durationSec = Math.round(v.duration); render(); } }; });
  }
  document.addEventListener('wheel', function (e) { var r = e.target.closest && e.target.closest('.np-types, .tk-days'); if (r && Math.abs(e.deltaY) > Math.abs(e.deltaX) && r.scrollWidth > r.clientWidth) { r.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  (function () { var dr = null; document.addEventListener('mousedown', function (e) { var r = e.target.closest && e.target.closest('.np-types, .tk-days'); if (r) dr = { r: r, x: e.clientX, l: r.scrollLeft, moved: false }; }); document.addEventListener('mousemove', function (e) { if (!dr) return; var dx = e.clientX - dr.x; if (Math.abs(dx) > 4) dr.moved = true; dr.r.scrollLeft = dr.l - dx; }); document.addEventListener('mouseup', function () { if (dr && dr.moved) { var stop = function (ev) { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click', stop, true); }; document.addEventListener('click', stop, true); setTimeout(function () { document.removeEventListener('click', stop, true); }, 0); } dr = null; }); })();
  ['dragover', 'drop'].forEach(function (ev2) { document.addEventListener(ev2, function (e) { var z = e.target.closest && e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); if (ev2 === 'drop' && e.dataTransfer && e.dataTransfer.files.length) { if (z.dataset.drop === 'cam') addVideos(e.dataTransfer.files); else addFiles(e.dataTransfer.files); } }); });
