/* app/04_ideas_new.js — 想法列表、新建想法入口。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
  /* ---------- 页面：想法列表 ---------- */
  var IF = [['all', '全部'], ['draft', '草稿'], ['cocreate', '共创'], ['triage', '待整理'], ['awaiting', '等决策'], ['planned', '进行中'], ['finished', '已完成'], ['closed', '暂缓/不做']];
  function ideaMatch(d, f) {
    switch (f) {
      case 'draft': return d.status === 'draft'; case 'cocreate': return d.status === 'discussing' || d.status === 'summary_ready';
      case 'triage': return d.status === 'triage'; case 'awaiting': return d.status === 'awaiting_owner';
      case 'planned': return d.status === 'planned' && TM.ideaProgress(S, d.id) !== 1; case 'finished': return d.status === 'planned' && TM.ideaProgress(S, d.id) === 1;
      case 'closed': return d.status === 'on_hold' || d.status === 'declined';
      case 'follow': return d.followerId === me && ['triage', 'awaiting_owner', 'planned'].indexOf(d.status) >= 0; // 运营者：我跟进的
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
    planned: ['进行中', '已形成项目', '<circle cx="12" cy="12" r="8.5"/><path d="M10 8.8v6.4l5-3.2z"/>', 'ib-blue'],
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
  // 阶段名：项目完成 / 取消后不再显示最初的阶段（以前产品项目完成后仍显示「需求澄清阶段」）
  function wStage(w) { return w.status === 'done' ? '已完成' : w.status === 'cancelled' ? '已取消' : TM.stageName(w.kind, w.stage); }
  // 字体大小（每台设备自己记）
  function fsGet() { try { return localStorage.getItem('tm_fs') || ''; } catch (e) { return ''; } }
  function fsApply() { var v = fsGet(), h = document.documentElement; h.classList.toggle('fs-l', v === 'l'); h.classList.toggle('fs-xl', v === 'xl'); }
  fsApply();
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
    var title = open ? (f === 'follow' ? '我跟进的' : (IDEA_TILE.concat(EXEC_TILE).find(function (t) { return t[0] === f; }) || IDEA_TILE[0])[1]) : '最近动态';
    var nf = cp.claimIdeas ? all.filter(function (d) { return ideaMatch(d, 'follow'); }).length : 0;
    if (nf && !(open && f === 'follow')) h += '<button class="id-follow" data-do="ideasTile" data-f="follow">我跟进的想法 <b>' + nf + '</b>' + hi('chev', 2) + '</button>';
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

