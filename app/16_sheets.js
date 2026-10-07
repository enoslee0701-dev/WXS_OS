/* app/16_sheets.js — 弹层（DO 处理器表）、录音。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
  /* ---------- 弹层 ---------- */
  var sheetHandler = null;
  function openSheet(title, body, submitLabel, onSubmit, danger) {
    var layer = document.getElementById('layer'), tEl = document.getElementById('toast'); if (tEl && /\bon\b/.test(tEl.className)) tEl.className = 'toast'; // 打开面板时收起上一条提示，免得压住输入框
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
  // 密码框自动带「显示 / 隐藏」按钮
  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  function field(label, inner, help) { if (/<input type="password"/.test(inner)) inner = '<span class="pw-w">' + inner + '<button type="button" class="pw-eye" data-do="pwEye" aria-label="显示密码">' + EYE + '</button></span>'; return '<label class="fld"><span>' + label + '</span>' + inner + (help ? '<small>' + help + '</small>' : '') + '</label>'; }
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
        (dc.workId ? opt('status', 'approved', '批准', '按上报的方案继续推进项目', true) + opt('status', 'needs_info', '要求补充', '请上报人补充说明后再报') + opt('status', 'rejected', '否决', '不同意，项目按原计划进行') : opt('status', 'approved', '批准', '回到运营者继续派发', true) + opt('status', 'needs_info', '要求补充', '回到运营者补充后再推进') + opt('status', 'rejected', '否决', '想法标记为不做')) + '</div>' + field('意见', '<textarea name="note" rows="3" placeholder="否决或要求补充时必填"></textarea>'), '提交决定',
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
    closeWork: function () { var w = W(cur().id); openSheet('确认项目完成', '<p>项目下的任务已全部验收通过。确认后项目完成，老板和发起人会收到通知。</p>' + field('验收意见（可选）', '<textarea name="note" rows="2"></textarea>'), '确认完成', function (o) { act('work.close', { id: w.id, note: o.note }, '项目已完成'); }); },
    wEscalate: function () { var w = W(cur().id);
      openSheet('上报老板决策', '<p class="muted" style="margin:0 0 8px;font-size:14px">项目里遇到超预算、人事、战略调整、重要对外发布这类事，交老板拍板。</p>' + field('例外类型', '<select name="kind">' + ['over_budget', 'personnel', 'strategy_change', 'major_release', 'other'].map(function (k) { return '<option value="' + k + '">' + L.decision[k] + '</option>'; }).join('') + '</select>') +
        field('要老板决定什么', '<textarea name="question" rows="3" maxlength="500" placeholder="例如：场地费超出预算 3000 元，是否同意？" required></textarea>'), '上报', function (o) { act('work.requestDecision', { id: w.id, kind: o.kind, question: o.question }, '已上报老板'); }); },
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
      openSheet(ow ? '更换项目人员' : '更换验收人', '<div class="callout">更换后会写进项目动态，并通知新旧双方。</div>' +
        (ow && w.leadId ? field('项目负责人', userSelect('leadId', leads, w.leadId)) : '') + (ow ? field('跟进运营', userSelect('operatorId', ops, w.operatorId)) : '') +
        field('验收人', userSelect('reviewerId', revs, w.reviewerId)), '保存', function (o) {
          var pl = { id: w.id }; ['leadId', 'operatorId', 'reviewerId'].forEach(function (k) { if (o[k] && o[k] !== w[k]) pl[k] = o[k]; });
          if (Object.keys(pl).length === 1) return closeSheet();
          act('work.reassign', pl, '已更换，相关人已收到通知');
        });
    },
    cancelWork: function () { var w = W(cur().id), n = S.tasks.filter(function (t) { return t.workId === w.id && ['done', 'cancelled'].indexOf(t.status) < 0; }).length;
      openSheet('取消项目', '<div class="callout warn">取消后项目不能再操作' + (n ? '，' + n + ' 个未完成的任务会一并取消' : '') + '，相关人会收到通知，记录保留。来源想法会转为「暂缓」。</div>' + field('原因', '<textarea name="reason" rows="3" required></textarea>'), '确认取消', function (o) { act('work.cancel', { id: w.id, reason: o.reason }, '项目已取消'); }, true); },
    pause: function () { var w = W(cur().id); openSheet('暂停项目（纠偏）', '<div class="callout warn">暂停后所有任务不能操作，相关人会收到通知，原记录保留。</div>' + field('原因', '<textarea name="reason" rows="3"></textarea>'), '暂停', function (o) { act('work.pause', { id: w.id, reason: o.reason }, '已暂停'); }, true); },
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
      openSheet('老板纠偏', '<div class="callout warn">纠偏必须填写原因。相关人都会收到通知，原记录保留。</div><div class="opts">' + (done ? opt('action', 'revoke', '撤销验收', '任务回到执行中，项目重新打开', true) : '') +
        (!done ? opt('action', 'reassign', '改派', '换一个主负责人，任务回到待接收', true) : '') + '</div>' + (!done ? field('改派给', userSelect('ownerId', people)) : '') + field('原因', '<textarea name="reason" rows="3"></textarea>'), '执行纠偏',
        function (o) { act('owner.override', { id: t.id, action: o.action, ownerId: o.ownerId, reason: o.reason }, '纠偏已执行，相关人已收到通知'); }, true);
    },
    reviewNote: function () { openSheet('复核意见', '<p class="muted" style="margin:0 0 8px;font-size:14px">只给执行人和验收人提意见，不改变任务状态；要推翻验收请用「纠偏」。</p>' + field('意见', '<textarea name="note" rows="3" maxlength="1000" required></textarea>'), '发送', function (o) { act('task.reviewComment', { id: cur().id, note: o.note }, '复核意见已发送'); }); },
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
        var r = act('idea.submit', p, o.path === 'direct' ? (SRV && AI_ON ? '已提交，AI 正在整理，稍后进入运营待认领' : '已提交，AI 已整理，等待运营者认领') : '已开启共创，团队已收到邀请');
        if (r.ok) location.hash = '#/idea/' + d.id;
      });
  }
  function routeSheet(id) {
    var d = I(id), sm = TM.latestSummary(S, d.id, 'analysis'), p = sm ? sm.payload : {}, st = (p.suggested_tasks || [])[0] || {};
    var cat = p.category || 'admin';
    /* AI 建议的其余任务也一起带出来，一次派完（闭环实测：之前只带第一个，其余要运营者再手动加） */
    var more = (p.suggested_tasks || []).slice(1, 6).filter(function (x) { return x && x.title; }), execs = TM.activeUsers(S).filter(function (u) { return u.roles.some(function (a) { return a.role === 'executor'; }); }).map(function (u) { return u.id; });
    var leads = TM.leadUsers(S); // 没有负责人的小团队：老板自任
    var mustOwner = S.settings.ownerApprovalMode === 'all' && !d.ownerApproved;
    var ai = S.settings.agentDirectRoute && p.suggested_route ? '<div class="callout ai">AI 已按整理稿预填：' + esc(L.route[p.suggested_route]) + '。核对后点「派发」，派发由你决定。</div>' : '';
    openSheet('派发', (mustOwner ? '<div class="callout warn">当前设置为「每条都送老板」。请先通过「更多」上报老板，批准后才能派发。</div>' : '') + ai +
      '<div class="fld"><span>项目类型</span><div class="opts">' + opt('kind', 'admin', '行政：直接派任务', '你来派执行人，并负责验收', cat !== 'product') + opt('kind', 'product', '产品：交项目负责人', '由负责人拆任务、派执行人、验收', cat === 'product') + '</div></div>' +
      field('项目标题', '<input type="text" name="title" value="' + esc(p.title || d.title) + '">') + field('目标', '<input type="text" name="goal" value="' + esc(p.goal && p.goal !== '待确认' ? p.goal : '') + '">') +
      '<div id="leadBox">' + field('项目负责人', userSelect('leadId', leads)) + '</div>' +
      '<div id="taskBox">' + (more.length ? '<p class="rt-h">任务 1 / ' + (more.length + 1) + '</p>' : '') + taskFields('t_', { title: st.title, expected: st.expected_output, criteria: st.acceptance_criteria, due: TM.dateAdd(S, st.suggested_due_days || 3), ownerId: execs[0] }) +
        more.map(function (x, i) { var k = 't' + (i + 1) + '_'; return '<div class="rt-more"><label class="rt-h rt-on"><input type="checkbox" name="' + k + 'on" checked>任务 ' + (i + 2) + ' / ' + (more.length + 1) + '（AI 建议，不需要就取消勾选）</label>' + taskFields(k, { title: x.title, expected: x.expected_output, criteria: x.acceptance_criteria, due: TM.dateAdd(S, x.suggested_due_days || 3), ownerId: execs[(i + 1) % (execs.length || 1)] }) + '</div>'; }).join('') + '</div>', more.length ? '派发 ' + (more.length + 1) + ' 个任务' : '派发',
      function (o) {
        var pl = { id: d.id, kind: o.kind, title: o.title, goal: o.goal };
        if (o.kind === 'product') pl.leadId = o.leadId;
        else pl.tasks = [{ title: o.t_title, ownerId: o.t_ownerId, expected: o.t_expected, criteria: o.t_criteria, due: o.t_due }].concat(more.map(function (x, i) { var k = 't' + (i + 1) + '_'; return o[k + 'on'] && String(o[k + 'title'] || '').trim() ? { title: o[k + 'title'], ownerId: o[k + 'ownerId'], expected: o[k + 'expected'], criteria: o[k + 'criteria'], due: o[k + 'due'] } : null; }).filter(Boolean));
        var r = act('idea.route', pl, o.kind === 'product' ? '已交项目负责人' : pl.tasks.length > 1 ? pl.tasks.length + ' 个任务已派出' : '任务已派出');
        if (r.ok) location.hash = '#/work/' + r.workId; return;
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

