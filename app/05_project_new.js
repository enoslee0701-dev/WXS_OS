/* app/05_project_new.js — 新建项目（手动 / AI 解析 / 模板）。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
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
      h += '<button class="np-ailink np-tpl" data-do="pTpl">' + ai2('doc2', 1.5) + (pd.tplName ? '已套用模板「' + esc(pd.tplName) + '」，点这里换一个' : '从模板开始：活动、课程、采购等常用项目，一键带出任务和里程碑') + hi('chev', 2) + '</button>';
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
    pTpl: function () {
      var ts = TM.allTemplates(S);
      openSheet('从模板开始', '<p class="muted" style="margin:0 0 10px;font-size:14px">选一个模板，自动带出项目类型、目标、首批任务和里程碑，日期从今天算起，都可以再改。</p><div class="tp-list">' + ts.map(function (t) {
        return '<div class="tp-it"><button type="button" class="tp-pick" data-do="pTplUse" data-id="' + t.id + '"><b>' + esc(t.name) + (t.custom ? '<em>团队模板</em>' : '') + '</b><small>' + esc((TM.PTYPE[t.ptype] || ['其他'])[0] + ' · ' + t.tasks.length + ' 个任务 · ' + (t.milestones || []).length + ' 个里程碑 · 约 ' + t.days + ' 天') + '</small>' + (t.desc ? '<span>' + esc(t.desc) + '</span>' : '') + '</button>' +
          (t.custom && (isOwner() || t.by === me) ? '<button type="button" class="tp-del" data-do="pTplDel" data-id="' + t.id + '" aria-label="删除模板 ' + esc(t.name) + '">' + ai2('x', 2) + '</button>' : '') + '</div>';
      }).join('') + '</div>', '关闭', function () { closeSheet(); });
    },
    pTplUse: function (el) {
      var t = TM.allTemplates(S).find(function (x) { return x.id === el.dataset.id; }); if (!t) return;
      var day = function (n) { return TM.dateAdd(S, +n || 0); }, ex = TM.usersWith(S, 'executor')[0] || TM.leadUsers(S)[0];
      if (!pd.title.trim()) pd.title = t.name; if (!pd.note.trim()) pd.note = t.desc || ''; pd.ptype = TM.PTYPE[t.ptype] ? t.ptype : pd.ptype; if (!pd.goal) pd.goal = t.goal || ''; pd.due = day(t.days);
      pd.tasks = t.tasks.map(function (x) { return { title: x[0], ownerId: ex, due: day(x[1]), expected: x[2] || '完成说明 + 成果链接或照片', criteria: x[3] || '验收人确认达到要求' }; });
      pd.milestones = (t.milestones || []).map(function (m) { return { title: m[0], date: day(m[1]) }; }); pd.tplName = t.name;
      closeSheet(); render(); toast('已套用「' + t.name + '」：' + pd.tasks.length + ' 个任务、' + pd.milestones.length + ' 个里程碑，第 2 步可以改执行人');
    },
    pTplDel: function (el) { var r = act('template.delete', { id: el.dataset.id }, '模板已删除'); if (r.ok) DO.pTpl(); },
    pAddTask: function () { pd.tasks.push({ title: '', ownerId: TM.usersWith(S, 'executor')[0], expected: '', criteria: '' }); render(); },
    pRmTask: function (el) { pd.tasks.splice(+el.dataset.i, 1); render(); },
    pPrev: function () { pd.step = Math.max(1, pd.step - 1); render(); window.scrollTo(0, 0); },
    pNext: function () {
      if (rec) return toast('请先停止录音', true);
      if (pd.step === 1) { if (!pd.title.trim()) return fieldErr('[data-pd="title"]', '请填写项目名称'); if (!pd.note.trim()) return fieldErr('[data-pd="note"]', '请简单描述一下项目'); }
      if (pd.step === 2) {
        if (TM.PTYPE[pd.ptype][1] === 'product' && !pd.leadId) return toast('产品开发项目请指定项目负责人', true);
        var bad = pd.tasks.find(function (t) { return t.title.trim() && (!t.expected.trim() || !t.criteria.trim()); });
        if (bad) return toast('「' + bad.title + '」请写预期成果和验收标准', true);
      }
      pd.step++; render(); window.scrollTo(0, 0);
    },
    pCreate: function () {
      var r = TM.act(S, me, 'project.create', { title: pd.title, note: pd.note, ptype: pd.ptype, leadId: pd.leadId, operatorId: pd.operatorId, reviewerId: pd.reviewerId, due: pd.due, tasks: pd.tasks, goal: pd.goal, priority: pd.priority, milestones: pd.milestones || [], media: pd.files.map(function (f) { return { kind: f.kind, name: f.name, durationSec: f.durationSec, localId: f.localId }; }), source: pd.source });
      if (!r.ok) return toast(r.error, true);
      save(); pd = null; navFinish('#/work/' + r.workId); toast('项目已创建，相关的人已收到通知');
    },
    aiTab: function (el) { if (ai.recording) aiStop(); ai.tab = el.dataset.t; render(); },
    aiStart: aiStart, aiStop: aiStop,
    aiSample: function (el) { var x = SAMPLES.find(function (s) { return s.k === el.dataset.k; }); ai.pending = null; runParse(x.text, '示例视频「' + x.t + '」' + x.d + '（示例素材）'); }
  };
