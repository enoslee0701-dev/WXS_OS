/* app/12_idea_detail.js — 想法详情。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
  /* ---------- 页面：想法详情 ---------- */
  function trailIdea(d) {
    var ws = S.workItems.filter(function (w) { return w.ideaId === d.id; });
    var ts = S.tasks.filter(function (t) { return ws.some(function (w) { return w.id === t.workId; }); });
    var steps = [['想法', d.status !== 'draft'], ['整理', ['planned'].indexOf(d.status) >= 0], ['项目', ws.length > 0], ['执行', ts.length && ts.every(function (t) { return t.status === 'done' || t.status === 'cancelled'; })], ['验收', ws.length && ws.every(function (w) { return w.status === 'done'; })]];
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
  function ixSteps(d) { var st = ideaStep(d); return '<section class="ix-steps ix2-steps">' + ['想法', '整理', '项目', '执行', '验收'].map(function (t, i) { return '<div class="' + (i < st ? 'done' : i === st ? 'cur' : '') + '"><i>' + (i < st ? ni('check', 2.6) : '') + '</i><span>' + t + '</span></div>'; }).join('') + '</section>'; }
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
    if (ws.length) h += '<section class="ix2-card"><div class="ix2-sh"><b>' + ai2('flagO', 1.7) + '形成的项目（' + ws.length + '）</b></div><div class="ix2-wks">' + ws.map(ixWorkRow).join('') + '</div></section>';
    h += flowHTML(d);
    return h;
  }
  function ixWorkRow(w) {
    var p = TM.workProgress(S, w.id), pc = p.total ? Math.round(p.done / p.total * 100) : 0;
    var flags = S.tasks.filter(function (t) { return t.workId === w.id && (t.status === 'blocked' || TM.isOverdue(S, t) || TM.isStale(S, t)); }).length;
    var nx = w.status === 'planning' ? [w.leadId, '安排任务'] : w.status === 'acceptance' ? [w.reviewerId, '确认项目完成'] : null;
    return '<a class="ix2-wk" href="#/work/' + w.id + '"><span class="ix2-wkt"><b>' + esc(w.title) + '</b>' + pill('work', w.status) + '</span>' +
      '<span class="ix2-wkm">' + L.kind[w.kind] + ' · ' + esc(wStage(w)) + ' · 任务 ' + p.done + '/' + p.total + (flags ? '<em>' + flags + ' 项需关注</em>' : '') + '</span>' +
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
  var FLOW_STAGE = ['想法', '整理', '项目', '执行', '验收'];
  function flowMap(e, d) {
    var a = e.action, who = e.actorType === 'agent' ? 'AI 助理' : e.actorType === 'system' ? '系统' : nm(e.actorId), T = e.taskId ? T_(e.taskId) : null, tt = T ? '「' + T.title + '」' : '';
    var m = {
      'idea.create': [0, '记录了这个想法'], 'idea.submit': [0, e.to === 'discussing' ? '提交，开启团队共创' : '提交，直接推进'], 'idea.suggest': [0, '提了建议'], 'idea.close_discussion': [0, '结束讨论，AI 汇总'], 'idea.confirm_direction': [0, '确认了方向'], 'idea.reopen': [0, '重新开放讨论'],
      'ai.analyze.ready': [1, '生成整理稿'], 'ai.reanalyze': [1, '重新整理'], 'idea.claim': [1, '认领跟进'], 'decision.request': [1, '报老板决策'], 'idea.to_owner': [1, '送老板确认'], 'decision.approved': [1, '批准'], 'decision.rejected': [1, '否决'], 'decision.needs_info': [1, '要求补充'], 'idea.status': [1, e.text || '改了状态'],
      'idea.route': [2, e.text || '形成项目'], 'task.assign': [2, '派任务' + tt + '：' + (e.text || '')], 'work.stage': [2, e.text || '推进阶段'], 'work.status': [2, e.text || '项目状态变化'], 'work.resume': [2, '恢复项目'],
      'task.accept': [3, '接收任务' + tt], 'task.start': [3, '开始做' + tt], 'task.submit': [3, '提交成果' + tt], 'task.block': [3, '报阻碍' + tt + (e.reason ? '：' + e.reason : '')], 'task.unblock': [3, '解除阻碍' + tt], 'task.cancel': [3, '取消任务' + tt],
      'task.review.pass': [4, '验收通过' + tt], 'task.review.return': [4, '退回' + tt + (e.reason ? '：' + e.reason : '')], 'task.owner_pass': [4, '终验通过' + tt], 'task.owner_return': [4, '终验退回' + tt], 'work.done': [4, '确认项目完成'], 'work.attach': [3, e.text || '上传文件']
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
      // 讨论中：说明分享给谁、什么时候截止（截止日过后自动汇总）
      (d.status === 'discussing' ? '<p class="dz-meta">分享给' + (d.shareAll ? '全体成员' : ' ' + (d.shares || []).length + ' 位同事') + ' · ' + (d.deadline ? (d.deadline === TM.todayStr(S) ? '今天截止' : mdTxt(d.deadline) + ' 截止') + '，之后自动汇总' : '由发起人手动结束') + '</p>' : '') +
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

