/* app/14_task_detail.js — 任务详情。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
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
    var steps = '<section class="ix-steps ix2-steps">' + ['想法', '整理', '项目', '执行', '验收'].map(function (n, i) { var href = i === 0 && d && TM.canViewIdea(S, me, d) ? '#/idea/' + d.id : i === 2 ? '#/work/' + w.id : null; return '<div ' + (href ? 'role="link" tabindex="0" data-do="goH" data-h="' + href + '" style="cursor:pointer" ' : '') + 'class="' + (i < stp ? 'done' : i === stp ? 'cur' : '') + '"><i>' + (i < stp ? ni('check', 2.6) : '') + '</i><span>' + n + '</span></div>'; }).join('') + '</section>';
    var od = TM.isOverdue(S, t), st = TM.isStale(S, t), nx = TM.nextForTask(S, t), mine = t.ownerId === me;
    var IC = function (path, c) { return '<svg viewBox="0 0 24 24" fill="none" stroke="' + (c || 'currentColor') + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>'; };
    var h = ixHead('任务详情', '把事情做完、做好') + steps + (w.status === 'paused' ? '<div class="callout warn" style="margin:0 0 12px">老板暂停了这个项目，恢复前任务不能操作。</div>' : w.status === 'cancelled' ? '<div class="callout" style="margin:0 0 12px">这个项目已取消。</div>' : '') +
      '<section class="ix2-card ix2-main"><div class="tx-chips">' + pill('task', t.status) + '<i>' + esc(L.kind[w.kind]) + '</i>' + (t.priority === 'hi' ? '<i class="r">高优先级</i>' : '') + (od ? '<i class="r">已逾期</i>' : '') + (st ? '<i class="r">' + S.settings.staleDays + ' 天以上无动态</i>' : '') + '</div>' +
      '<h2>' + esc(t.title) + '</h2>' + ((w.leadId === me || w.operatorId === me || isOwner()) && ['done', 'cancelled'].indexOf(t.status) < 0 && w.status !== 'paused' ? '<button type="button" class="wx-edit tx-edit" data-do="taskEdit">' + ai2('edit', 1.8) + '编辑</button>' : '') + '<a class="tx-work" href="#/work/' + w.id + '">' + IC('<path d="M3.8 8.2a2.7 2.7 0 0 1 2.7-2.7h3l2 2.2h6a2.7 2.7 0 0 1 2.7 2.7v6.9a2.7 2.7 0 0 1-2.7 2.7h-11a2.7 2.7 0 0 1-2.7-2.7z"/>') + '<span>属于项目</span><b>' + esc(w.title) + '</b>' + hi('chev', 2) + '</a>' +
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
    if (w.status === 'paused') return ow ? [['恢复项目', 'resume', 'pri', w.id]] : [];
    if (o && t.status === 'assigned') { a.push(['报阻碍', 'block']); a.push(['接收任务', 'tt', 'pri', 'accept']); }
    if (o && t.status === 'accepted') { a.push(['报阻碍', 'block']); a.push(['开始执行', 'tt', 'pri', 'start']); }
    if (o && t.status === 'in_progress') { a.push(['报阻碍', 'block']); a.push(['提交成果', 'submit', 'pri']); }
    if (t.status === 'blocked' && (o || w.operatorId === me || w.leadId === me || ow)) a.push(['解除阻碍', 'tt', 'pri', 'unblock']);
    if (t.status === 'submitted' && t.reviewerId === me) { a.push(['退回', 'review', 'danger', 'return']); a.push(['验收通过', 'review', 'pri', 'pass']); }
    if (t.status === 'owner_review' && ow) { a.push(['退回', 'ownerReview', 'danger', 'owner_return']); a.push(['终验通过', 'ownerReview', 'pri', 'owner_pass']); }
    if (ow && ['submitted', 'owner_review', 'done'].indexOf(t.status) >= 0) a.push(['复核意见', 'reviewNote']);
    if (ow && t.status !== 'cancelled') a.push(['纠偏', 'override', 'danger']);
    if ((w.operatorId === me || w.leadId === me || ow) && ['done', 'cancelled', 'owner_review'].indexOf(t.status) < 0 && !(ow && a.length > 2)) a.push(['取消任务', 'cancelTask']);
    return a;
  }

