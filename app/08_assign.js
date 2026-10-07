/* app/08_assign.js — 分配任务：手动 / AI。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
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
      // 验收人（默认项目验收人）和验收标准：以前只能建完再去「编辑任务」改
      (function () { var w0 = W(asg.workId), revs = TM.activeUsers(S).filter(function (u) { return u.id !== asg.ownerId && !u.roles.every(function (a) { return a.role === 'admin'; }); }).map(function (u) { return u.id; }), dv = asg.reviewerId || (w0 && w0.reviewerId !== asg.ownerId ? w0.reviewerId : w0 && (w0.leadId !== asg.ownerId ? w0.leadId : w0.operatorId));
        return '<label class="p-fld"><span>验收人</span><select data-as="reviewerId">' + revs.map(function (id) { return '<option value="' + id + '"' + (id === dv ? ' selected' : '') + '>' + esc(nm(id)) + '（' + esc(pRole(id)) + '）</option>'; }).join('') + '</select></label>' +
          '<label class="p-fld"><span>验收标准（可选）</span><input type="text" data-as="criteria" maxlength="200" value="' + esc(asg.criteria || '') + '" placeholder="怎样算做完，例如：能正常投屏、发票已上传"></label>'; })() +
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
    if (!asg.title.trim()) return fieldErr('[data-as="title"]', '请填写任务标题');
    if (!ownerId) return toast('请选择负责人', true);
    var r = TM.act(S, me, 'work.plan', { id: w.id, tasks: [{ title: asg.title, description: asg.desc, ttype: asg.ttype, priority: asg.priority, milestone: asg.milestone, ownerId: ownerId, collabs: collabs, due: due, reviewerId: (function () { var sel = document.querySelector('[data-as="reviewerId"]'), v = asg.reviewerId || (sel && sel.value); return v && v !== ownerId ? v : undefined; })(), expected: '完成「' + asg.title.trim() + '」并提交成果说明', criteria: (asg.criteria || '').trim() || '验收人确认达到任务要求', assignedBy: by }] });
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
