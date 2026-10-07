/* app/11_ai_chat.js — AI 助手面板。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
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
