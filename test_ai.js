// 真实 AI 代理测试：用本地模拟的 Anthropic API（ANTHROPIC_BASE_URL）验证请求内容、隐私、权限、上限和出错处理，不花钱
const http = require('http'), path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗ ' + m); } };
const rnd = () => 22000 + Math.floor(Math.random() * 3000);

// ---- 模拟 Anthropic API
const seen = []; let mode = 'ok';
const mock = http.createServer((req, res) => {
  let b = ''; req.on('data', d => b += d); req.on('end', () => {
    const body = JSON.parse(b || '{}'); seen.push({ url: req.url, headers: req.headers, body });
    const reply = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (mode === 'drop') return req.socket.destroy(); // 模拟连不上 AI 服务
    if (mode === '500') return reply(500, { type: 'error', error: { type: 'api_error', message: 'boom' } });
    { const f1 = body.output_config && body.output_config.format; if (f1 && f1.schema.properties.items && f1.schema.properties.items.items.properties.owner) return reply(200, { id: 'msg_m', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify({ items: [{ title: '做报名页面', owner: '刘洋', due: '2099-01-02', expected: '页面链接', criteria: '能报名' }, { title: '订餐盒', owner: '不存在的人', due: 'bad', expected: '', criteria: '' }] }) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }); }
    { const f0 = body.output_config && body.output_config.format; if (f0 && f0.schema.properties.proposed_direction) { const txt0 = JSON.stringify(body.messages || []); const id = (txt0.match(/\[(s\d+)\]/) || [])[1] || 'none';
      return reply(200, { id: 'msg_c', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify({ consensus: [{ point: 'Claude：大家同意先试点', src: [id] }, { point: '没有来源的结论', src: ['s_fake'] }], divergences: [], risks: [], open_questions: [{ point: '预算多少？', src: [] }], proposed_direction: 'Claude 建议：先做两周试点' }) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }); } }
    if (mode === '429') return reply(429, { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } });
    const fmt0 = body.output_config && body.output_config.format;
    if (fmt0 && fmt0.schema.properties.items) return reply(200, { id: 'msg_t', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify({ items: [{ title: '和林晓开会', date: '2026-10-04', time: '15:00', priority: 'mid', people: ['林晓', '外人', 'Enos'], tag: '会议' }, { title: '发报价', date: 'next friday', time: '25:00', priority: 'urgent', people: [], tag: '其他' }] }) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 100, output_tokens: 50 } });
    const hasDoc = (body.messages || []).some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'document'));
    if (hasDoc) return reply(200, { id: 'msg_pdf', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: '# 年度计划\n- 第一季度：试点' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 900, output_tokens: 30 } });
    const fmt = body.output_config && body.output_config.format;
    if (fmt && fmt.schema.properties.ptype) return reply(200, { id: 'msg_p', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify({ title: '年底感恩聚会', summary: '十二月办一次全队感恩聚会。', ptype: 'event', lead: '林晓', tasks: [{ title: '订场地', owner: '周敏', expected: '场地确认单', criteria: '老板确认' }, { title: '做海报', owner: '没这个人', expected: '海报', criteria: '好看' }], people: ['林晓', '周敏', '外人'], tags: ['聚会'] }) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 300, output_tokens: 80 } });
    if (fmt && fmt.schema.properties.divergences) return setTimeout(() => reply(200, { id: 'msg_g', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify({ people: [{ name: '何静', points: ['内容成本高'] }, { name: '路人甲', points: ['x'] }], consensus: [{ point: '值得做', who: ['何静', '不存在的人'] }], divergences: [{ point: '先做哪个', sides: [{ view: '先做语音', who: ['刘洋'] }] }], risks: [], questions: [], next: ['Claude：先小范围试点'] }) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 400, output_tokens: 120 } }), 30);
    if (fmt && fmt.schema.properties.verdict) return setTimeout(() => reply(200, { id: 'msg_d', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify({ verdict: 'needs_info', label: '建议先补充信息', reasons: ['原文没有写预算'], risks: ['招错人代价高'], checks: ['每月预算上限'], note: '请先出招聘方案再报我。' }) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 600, output_tokens: 90 } }), 30);
    if (fmt && fmt.schema.properties.suggested_route) return setTimeout(() => reply(200, { id: 'msg_a', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: JSON.stringify({ title: '全队退修会', summary: '十二月办退修会', background: '团队需要休整', problem: '日期未定', goal: '定下日期和场地', overview: 'Claude：建议十二月中旬办两天一夜的退修会。', issues: ['场地未定'], directions: ['先定日期', '再订场地'], category: 'admin', relation_to_direction: '无', open_questions: ['具体日期？'], exception_flags: ['over_budget'], suggested_route: 'to_owner', suggested_tasks: [{ title: '找三个场地', expected_output: '候选清单', acceptance_criteria: '老板选定', suggested_due_days: 7 }], confidence: 0.8 }) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 500, output_tokens: 200 } }), mode === 'slow' ? 1500 : 50);
    const isKb = fmt;
    const text = isKb ? JSON.stringify({ title: '老板口述：做决定、钱和预算', secs: [{ key: 'decide', items: ['新想法先试点两周，再决定是否推开。'] }, { key: 'money', items: ['单笔超过五千元的支出要先问老板。'] }, { key: 'bogus', items: ['x'] }] }) : '结论：「新官网」进度落后，建议本周和小李对一下首页设计。';
    reply(200, { id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text }], stop_reason: mode === 'refusal' ? 'refusal' : 'end_turn', stop_sequence: null, stop_details: mode === 'refusal' ? { type: 'refusal', category: null, explanation: '' } : null, usage: { input_tokens: 1200, output_tokens: 80 } });
  });
});
function start(env, dir) {
  const DIR = dir || fs.mkdtempSync(path.join(os.tmpdir(), 'tm-ai-')), PORT = rnd();
  const p = spawn(process.execPath, [path.join(__dirname, 'server', 'server.js')], { env: { ...process.env, LLM: '0', TRANSCRIBE: '0', ANTHROPIC_API_KEY: '', PORT, HOST: '127.0.0.1', DATA_DIR: DIR, SETUP_CODE: 'code-1234', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stderr.on('data', d => { if (!/ExperimentalWarning|AI 出错/.test(String(d))) process.stderr.write(d); });
  p.B = 'http://127.0.0.1:' + PORT; p.DIR = DIR; p.env = env;
  return new Promise(r => p.stdout.on('data', d => { if (/已启动/.test(String(d))) r(p); }));
}
const mkApi = (B) => async (method, u, body, tok) => { const r = await fetch(B + u, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json()) }; };
async function team(api) {
  const st = await api('POST', '/api/setup', { name: 'Enos', login: 'enos', password: 'enos1234', demo: true, code: 'code-1234' });
  const boss = st.token;
  await api('POST', '/api/act', { name: 'idea.create', payload: { note: '老板私人草稿：考虑明年换办公室' } }, boss);
  await api('POST', '/api/accounts', { uid: 'u_sys', login: 'sun', password: 'sun12345' }, boss);
  await api('POST', '/api/accounts', { uid: 'u_dev', login: 'liu', password: 'liu12345' }, boss);
  const adm = (await api('POST', '/api/login', { login: 'sun', password: 'sun12345' })).token;
  const dev = (await api('POST', '/api/login', { login: 'liu', password: 'liu12345' })).token;
  // 老板分派的是初始密码：先改密码才能用
  await api('POST', '/api/password', { password: 'sun-new-1' }, adm); await api('POST', '/api/password', { password: 'liu-new-1' }, dev);
  return { boss, adm, dev };
}

(async () => {
  await new Promise(r => mock.listen(0, '127.0.0.1', r));
  const MOCK = 'http://127.0.0.1:' + mock.address().port;

  // 1. 没配置密钥：未启用，客户端走规则模拟
  let s1 = await start({}); let api = mkApi(s1.B); let t = await team(api);
  let st = await api('GET', '/api/ai/status', null, t.boss);
  ok(st.enabled === false && st.configured === false, '没配置密钥时 AI 未启用');
  ok((await api('POST', '/api/ai/ask', { q: '项目怎么样' }, t.boss)).status === 503, '未启用时提问返回 503');
  s1.kill(); fs.rmSync(s1.DIR, { recursive: true, force: true });

  // 2. 配置了密钥（指向模拟服务）
  const s2 = await start({ ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_BASE_URL: MOCK, AI_DAILY_LIMIT: '7', BRIEF_NOW: '1' }); api = mkApi(s2.B); t = await team(api);
  // 早报：启动后立即发一次（BRIEF_NOW），附 Claude 要点
  let brief = null; for (let i = 0; i < 30 && !brief; i++) { brief = ((await api('GET', '/api/state', null, t.boss)).state.notifications || []).find(n => n.title === '今日早报'); if (!brief) await new Promise(z => setTimeout(z, 100)); }
  ok(brief && /等你决策/.test(brief.body) && /新官网/.test(brief.body), '老板收到早报（数字 + Claude 要点）');
  ok((await api('GET', '/api/ai/status', null, t.boss)).enabled === true, '老板可用真实 AI');
  ok((await api('GET', '/api/ai/status', null, t.adm)).enabled === true, '管理员可用真实 AI');
  ok((await api('GET', '/api/ai/status', null, t.dev)).enabled === false, '执行者默认不用真实 AI（走规则模拟）');
  ok((await api('POST', '/api/ai/ask', { q: 'x' }, t.dev)).status === 403, '执行者调用被拒');

  let r = await api('POST', '/api/ai/ask', { q: '我们的项目现在有什么风险？', history: [{ role: 'assistant', text: '你好' }, { role: 'user', text: '上一个问题' }, { role: 'assistant', text: '上一个回答' }] }, t.boss);
  ok(r.status === 200 && /新官网/.test(r.text), '老板提问拿到 AI 回答');
  let q = seen[seen.length - 1], sys = q.body.system.map(x => x.text).join('\n');
  ok(q.url.startsWith('/v1/messages') && q.body.model === 'claude-opus-5-5', '请求用 claude-opus-5-5');
  ok(q.body.fallbacks === 'default' && /server-side-fallback-2026-07-01/.test(q.headers['anthropic-beta'] || ''), '开启服务端拒答回退');
  ok(q.headers['x-api-key'] === 'sk-test', '密钥只在服务器端发出');
  ok(q.body.system[0].cache_control && q.body.system[0].cache_control.type === 'ephemeral' && !q.body.system[1].cache_control, '稳定部分缓存，团队快照不缓存');
  ok(/「清醒」App 第一版原型/.test(sys) && /老板私人草稿/.test(sys), '老板的请求带上团队快照（含老板自己的草稿）');
  ok(q.body.messages[0].role === 'user' && q.body.messages[q.body.messages.length - 1].content === '我们的项目现在有什么风险？', '对话历史从用户开始，最后是这次的问题');
  ok(!q.body.thinking && q.body.output_config.effort === 'medium', '不手动关闭思考，用 effort 控制');

  r = await api('POST', '/api/ai/ask', { q: '团队情况' }, t.adm);
  sys = seen[seen.length - 1].body.system.map(x => x.text).join('\n');
  ok(r.status === 200 && !/老板私人草稿/.test(sys) && !/清醒/.test(sys), '管理员提问：AI 拿不到管理员看不到的想法和项目');

  r = await api('POST', '/api/ai/kb', { topic: 'decide', text: '嗯，新的想法我习惯先试点两周。然后单笔超过五千块的支出要先问我。' }, t.boss);
  q = seen[seen.length - 1];
  ok(r.status === 200 && r.secs.length === 2 && r.secs[0].name === '我怎么做决定' && r.count === 2, '口述整理成规则（未知分类被丢弃）');
  ok(q.body.output_config.format.type === 'json_schema' && q.body.output_config.format.schema.required.includes('secs'), '口述整理用结构化输出');
  ok((await api('POST', '/api/ai/kb', { text: 'x' }, t.dev)).status === 403, '执行者不能整理知识库');

  // 决策建议：只给老板，写到决策上
  const pend = (await api('GET', '/api/state', null, t.boss)).state.decisions.find(x => x.status === 'pending');
  ok(!!pend, '演示数据里有待决策');
  ok((await api('POST', '/api/ai/advice', { id: pend.id }, t.adm)).status === 403, '管理员不能要决策建议');
  r = await api('POST', '/api/ai/advice', { id: pend.id }, t.boss);
  const dcA = r.state && r.state.decisions.find(x => x.id === pend.id);
  ok(r.status === 200 && dcA.ai && dcA.ai.verdict === 'needs_info' && dcA.ai.note.includes('招聘方案'), 'Claude 决策建议写到决策上');
  const advQ = seen[seen.length - 1];
  ok(advQ.body.output_config.format.schema.required.includes('verdict') && advQ.body.output_config.effort === 'high', '决策建议用结构化输出、较高思考强度');
  ok((await api('POST', '/api/ai/advice', { id: 'D-none' }, t.boss)).status === 404, '决策不存在');
  mode = 'refusal'; r = await api('POST', '/api/ai/ask', { q: 'x' }, t.adm);
  ok(r.status === 422 && /没有回答/.test(r.error), '拒答有友好提示');
  mode = '429'; r = await api('POST', '/api/ai/ask', { q: 'x' }, t.adm);
  ok(r.status === 429 && /太忙/.test(r.error), '限流有友好提示');
  mode = 'ok';
  // 新建项目解析
  r = await api('POST', '/api/ai/project', { text: '年底想办个感恩聚会，林晓负责，周敏去订场地' }, t.adm);
  ok(r.status === 403, '纯管理员不能新建项目，也不能用项目解析');
  r = await api('POST', '/api/ai/project', { text: '年底想办个感恩聚会，林晓负责，周敏去订场地' }, t.boss);
  ok(r.status === 200 && r.title === '年底感恩聚会' && r.ptype === 'event' && r.leadId === 'u_op' && r.tasks[0].ownerId === 'u_admin_ex' && r.tasks[1].ownerId === '' && JSON.stringify(r.people) === '["u_op","u_admin_ex"]', 'Claude 解析项目草稿，人名转成成员 ID（不存在的人被忽略）');
  r = await api('POST', '/api/ai/ask', { q: 'x' }, t.boss); ok(r.status === 200, '老板第 5 次');
  r = await api('POST', '/api/ai/ask', { q: 'x' }, t.boss); ok(r.status === 200, '老板第 6 次');
  r = await api('POST', '/api/ai/ask', { q: 'x' }, t.boss); ok(r.status === 200, '老板第 7 次');
  r = await api('POST', '/api/ai/ask', { q: 'x' }, t.boss); ok(r.status === 429 && /用完/.test(r.error), '超过每日上限');
  // 后台整理稿：提交想法后规则稿立刻出现，随后换成 Claude 稿
  let idea = await api('POST', '/api/act', { name: 'idea.create', payload: { note: '想办一次全队退修会，预算两万元' } }, t.boss);
  r = await api('POST', '/api/act', { name: 'idea.submit', payload: { id: idea.r.id, path: 'direct' } }, t.boss);
  const sum0 = r.state.summaries.filter(x => x.ideaId === idea.r.id && x.kind === 'analysis').pop();
  ok(sum0 && sum0.payload.simulated === true, '提交后立刻有规则版整理稿（不用等 AI）');
  const waitSum = async (id) => { for (let i = 0; i < 40; i++) { const st2 = await api('GET', '/api/state', null, t.boss); const x = st2.state.summaries.filter(y => y.ideaId === id && y.kind === 'analysis').pop(); if (x && x.payload.simulated === false) return { x, st2 }; await new Promise(z => setTimeout(z, 100)); } return {}; };
  let w = await waitSum(idea.r.id);
  ok(w.x && /Claude/.test(w.x.payload.overview) && w.x.payload.suggested_route === 'to_owner', '后台换成 Claude 整理稿');
  ok(w.st2 && w.st2.state.ideas.find(d => d.id === idea.r.id).title === '全队退修会', 'Claude 拟的标题生效');
  ok(w.st2 && w.st2.state.events.some(e => e.action === 'ai.analyze.real'), '动态里记录 Claude 完成整理');
  // 新建项目小帮手：不带团队数据
  r = await api('POST', '/api/ai/write', { kind: 'goal', title: '年底感恩聚会', note: '十二月办' }, t.adm);
  const wq = seen[seen.length - 1];
  ok(r.status === 200 && r.text && wq.body.system.length === 1 && !/团队快照/.test(JSON.stringify(wq.body)) && /可以验收/.test(wq.body.system[0].text), '拟目标只用项目自己的文字');
  // 一段话 → 待办
  r = await api('POST', '/api/ai/todos', { text: '明天下午三点和林晓开会，周五前发报价' }, t.adm);
  const tq = seen[seen.length - 1];
  ok(r.status === 200 && r.items.length === 2 && r.items[0].time === '15:00' && JSON.stringify(r.items[0].people) === '["u_op","u_owner"]' && r.items[1].time === '' && r.items[1].priority === 'mid' && /^\d{4}-\d{2}-\d{2}$/.test(r.items[1].date) && r.items[1].tags[0] === '工作', 'Claude 拆待办：人名转 ID、非法日期时间优先级被纠正');
  ok(/今天是 \d{4}-\d{2}-\d{2}（星期/.test(tq.body.system[0].text), '提示里带今天的日期和星期');
  // PDF → 知识库正文
  const pdf = require('fs').readFileSync(require('path').join(__dirname, 'e2e', 'fixtures', 'plan.pdf')).toString('base64');
  ok((await api('POST', '/api/ai/doc', { name: 'plan.pdf', data: pdf }, t.dev)).status === 403, '执行者不能让 AI 读 PDF');
  ok((await api('POST', '/api/ai/doc', { name: 'x.pdf', data: Buffer.from('hello world, not a pdf at all, just some text padding padding padding padding padding').toString('base64') }, t.adm)).status === 400, '不是 PDF 被拒');
  r = await api('POST', '/api/ai/doc', { name: 'plan.pdf', data: pdf }, t.adm);
  const docQ = seen[seen.length - 1], blk = docQ.body.messages[0].content[0];
  ok(r.status === 200 && r.text.includes('# 年度计划') && blk.type === 'document' && blk.source.media_type === 'application/pdf' && blk.source.data === pdf, 'Claude 读 PDF 整理成 Markdown');
  // 讨论总结：老板让 AI 总结 → 规则版立刻有 → 后台换成 Claude 版
  const coIdea = (await api('GET', '/api/state', null, t.boss)).state.suggestions[0].ideaId;
  r = await api('POST', '/api/act', { name: 'idea.digest', payload: { id: coIdea } }, t.boss);
  ok(r.ok, '老板让 AI 总结讨论');
  let dg = null; for (let i = 0; i < 40 && !dg; i++) { const st3 = await api('GET', '/api/state', null, t.boss); const x = st3.state.summaries.filter(y => y.ideaId === coIdea && y.kind === 'digest').pop(); if (x && x.payload.simulated === false) dg = x; else await new Promise(z => setTimeout(z, 100)); }
  ok(dg && dg.payload.next[0].includes('Claude') && dg.payload.people.length === 1 && JSON.stringify(dg.payload.consensus[0].who) === '["何静"]', '讨论总结换成 Claude 版（不存在的人名被过滤）');
  // 人工先改了整理稿：AI 结果不覆盖
  mode = 'slow';
  idea = await api('POST', '/api/act', { name: 'idea.create', payload: { note: '会议室投影仪坏了，换一台' } }, t.boss);
  r = await api('POST', '/api/act', { name: 'idea.submit', payload: { id: idea.r.id, path: 'direct' } }, t.boss);
  const sm1 = r.state.summaries.filter(x => x.ideaId === idea.r.id && x.kind === 'analysis').pop();
  r = await api('POST', '/api/act', { name: 'idea.saveSummary', payload: { id: idea.r.id, payload: Object.assign({}, sm1.payload, { overview: '运营者手写的整理稿' }) } }, t.boss);
  ok(r.ok, '人工改写整理稿 ' + (r.error || ''));
  await new Promise(z => setTimeout(z, 2200)); mode = 'ok';
  const last = (await api('GET', '/api/state', null, t.boss)).state.summaries.filter(x => x.ideaId === idea.r.id && x.kind === 'analysis').pop();
  ok(last.payload.overview === '运营者手写的整理稿', '人工改过的整理稿不被 AI 覆盖');
  // 管理员已用 6 次（提问 + 拒答 + 限流 + 读 PDF + 拆待办 + 拟目标），上限 7：并发 3 个请求只能成功 1 个
  const conc = await Promise.all([1, 2, 3].map(() => api('POST', '/api/ai/ask', { q: '并发' }, t.adm)));
  ok(conc.filter(x => x.status === 200).length === 1 && conc.filter(x => x.status === 429).length === 2, '并发请求也不会超过每日上限');
  const us = await api('GET', '/api/usage', null, t.adm);
  ok(us.ai.enabled && us.ai.month.calls >= 5 && us.ai.month.usd > 0 && us.ai.byKind.ask >= 1 && us.ai.byKind.analyze >= 1, '使用情况统计 AI 次数和估算费用');
  // 后台 AI 进行中服务器被杀：重启后只补做这一个
  mode = 'slow';
  const ri = await api('POST', '/api/act', { name: 'idea.create', payload: { note: '重启补做测试：会议室换窗帘' } }, t.boss);
  await api('POST', '/api/act', { name: 'idea.submit', payload: { id: ri.r.id, path: 'direct' } }, t.boss);
  await new Promise(z => setTimeout(z, 200)); s2.kill('SIGKILL'); await new Promise(z => setTimeout(z, 300));
  mode = 'ok'; const c0 = seen.length;
  const s3 = await start({ ...s2.env, BRIEF_NOW: '' }, s2.DIR); const api3 = mkApi(s3.B);
  let fixed = null; for (let i = 0; i < 80 && !fixed; i++) { const st4 = await api3('GET', '/api/state', null, t.boss); const x = st4.state && st4.state.summaries.filter(y => y.ideaId === ri.r.id && y.kind === 'analysis').pop(); if (x && x.payload.simulated === false) fixed = x; else await new Promise(z => setTimeout(z, 100)); }
  ok(!!fixed, '重启后补做没做完的后台整理');
  ok(seen.slice(c0).length === 1, '只补做没做完的那一个（不会去整理其他规则版内容）');
  s3.kill();
  // 在想法 / 项目页面里问（新起一个实例，不受前面用掉的每日额度影响）
  // AI 失败重试 3 次后通知跟进人（文档 8.1）：重试间隔测试里缩短到 0.2 秒
  { const s6 = await start({ ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_BASE_URL: MOCK, AI_RETRY_MS: '200,200,200' }); const api6 = mkApi(s6.B), t6 = await team(api6);
    const n0 = seen.length; mode = '500';
    const id6 = await api6('POST', '/api/act', { name: 'idea.create', payload: { note: '换一批办公椅' } }, t6.boss); await api6('POST', '/api/act', { name: 'idea.submit', payload: { id: id6.r.id, path: 'direct' } }, t6.boss);
    let fail6 = null; for (let i = 0; i < 60 && !fail6; i++) { await new Promise(r => setTimeout(r, 100)); const st = (await api6('GET', '/api/state', null, t6.boss)).state; fail6 = st.events.find(e => e.ideaId === id6.r.id && e.action === 'ai.failed'); }
    mode = 'ok';
    const calls = seen.slice(n0).filter(x => x.body.output_config && x.body.output_config.format && x.body.output_config.format.schema.properties.suggested_route).length;
    ok(fail6 && calls >= 4, 'AI 失败后重试 3 次（共调用 ' + calls + ' 次），然后记录失败并通知');
    // 连不上 AI 服务（网络断）也要重试并最终通知（以前被当成配置问题直接放弃）
    mode = 'drop'; const id7 = await api6('POST', '/api/act', { name: 'idea.create', payload: { note: '换打印纸' } }, t6.boss); await api6('POST', '/api/act', { name: 'idea.submit', payload: { id: id7.r.id, path: 'direct' } }, t6.boss);
    let fail7 = null; for (let i = 0; i < 150 && !fail7; i++) { await new Promise(r => setTimeout(r, 200)); const st = (await api6('GET', '/api/state', null, t6.boss)).state; fail7 = st.events.find(e => e.ideaId === id7.r.id && e.action === 'ai.failed'); }
    mode = 'ok'; ok(!!fail7, '连不上 AI 服务时也会重试，最后通知');
    s6.kill(); }
  const s5 = await start({ ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_BASE_URL: MOCK }); const api5 = mkApi(s5.B), t5 = await team(api5);
  { let r; const st = (await api5('GET', '/api/state', null, t5.boss)).state, d = st.ideas.find(x => x.status !== 'draft' && x.note), w = st.workItems[0];
    r = await api5('POST', '/api/ai/ask', { q: '这个想法有什么风险？', focus: { type: 'idea', id: d.id } }, t5.boss);
    let fs = seen[seen.length - 1].body.system.map(x => x.text).join('\n');
    ok(r.status === 200 && fs.includes('# 当前讨论的想法') && fs.includes(String(d.note).slice(0, 10)), '想法页问 AI：带上这条想法的原文');
    r = await api5('POST', '/api/ai/ask', { q: '进度怎么样？', focus: { type: 'work', id: w.id } }, t5.boss);
    fs = seen[seen.length - 1].body.system.map(x => x.text).join('\n');
    ok(r.status === 200 && fs.includes('# 当前讨论的项目「' + w.title + '」') && /- 任务「/.test(fs), '项目页问 AI：带上项目的任务');
    r = await api5('POST', '/api/ai/ask', { q: 'x', focus: { type: 'idea', id: 'I_nope' } }, t5.boss);
    fs = seen[seen.length - 1].body.system.map(x => x.text).join('\n');
    ok(r.status === 200 && !fs.includes('# 当前讨论的想法'), '看不到 / 不存在的想法：不带详情'); }
  // 共创汇总交给 Claude（文档 8.4）：每条结论带真实来源，没有来源的被丢掉；发起人确认前替换规则版
  { const ci = await api5('POST', '/api/act', { name: 'idea.create', payload: { note: '年会要不要改成户外' } }, t5.boss);
    await api5('POST', '/api/act', { name: 'idea.submit', payload: { id: ci.r.id, path: 'cocreate', shareAll: true } }, t5.boss);
    await api5('POST', '/api/act', { name: 'idea.suggest', payload: { id: ci.r.id, body: '同意，先试点一次户外' } }, t5.dev);
    await api5('POST', '/api/act', { name: 'idea.close', payload: { id: ci.r.id } }, t5.boss);
    let co = null; for (let i = 0; i < 40 && !co; i++) { const st = (await api5('GET', '/api/state', null, t5.boss)).state; const x = st.summaries.filter(y => y.ideaId === ci.r.id && y.kind === 'cocreate').pop(); if (x && !x.payload.simulated) co = x; else await new Promise(r => setTimeout(r, 100)); }
    ok(co && co.payload.consensus.length === 1 && /^s\d+$/.test(co.payload.consensus[0].src[0]) && /Claude/.test(co.payload.proposed_direction) && co.payload.open_questions.length === 1, '共创汇总换成 Claude 版，来源可追溯、无来源结论被丢掉 ' + JSON.stringify(co && co.payload.consensus)); }
  // 会议拆任务：负责人也能用；人名换成成员、日期校验
  { const st = (await api5('GET', '/api/state', null, t5.boss)).state, w = st.workItems.find(x => x.status === 'active');
    let r = await api5('POST', '/api/ai/meeting', { workId: w.id, text: '周五前刘洋做报名页面，再订餐盒' }, t5.boss);
    ok(r.status === 200 && r.items.length === 2 && r.items[0].ownerId === 'u_dev' && r.items[0].due === '2099-01-02' && r.items[1].ownerId === '' && r.items[1].due === '', '会议拆任务：Claude 拆出任务，人名换成成员、无效日期清空');
    r = await api5('POST', '/api/ai/meeting', { workId: w.id, text: '周五前做报名页面' }, t5.dev); ok(r.status === 403, '执行者不能用会议拆任务'); }
  // 拍照识别：只收图片；图片作为 image 块交给 Claude
  ok((await api5('POST', '/api/ai/image', { data: 'aGVsbG8gd29ybGQgaGVsbG8=', type: 'application/pdf' }, t5.boss)).status === 400, '拍照识别：不是图片被拒');
  { const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const ri = await api5('POST', '/api/ai/image', { data: png, type: 'image/png' }, t5.boss), rq = seen[seen.length - 1].body;
    ok(ri.status === 200 && rq.messages[0].content[0].type === 'image' && rq.messages[0].content[0].source.media_type === 'image/png' && /## 原文/.test(rq.system[0].text), '拍照识别：图片交给 Claude，要求转录原文、要点、待办'); }
  { const rw = await api5('POST', '/api/ai/write', { kind: 'task', title: '布置会场', note: '所属项目：感恩晚会' }, t5.boss), rq = seen[seen.length - 1].body;
    ok(rw.status === 200 && /任务描述/.test(rq.system[0].text) && /感恩晚会/.test(rq.messages[0].content), '分配任务：Claude 写任务描述（带上所属项目）'); }
  s5.kill(); fs.rmSync(s5.DIR, { recursive: true, force: true });
  s2.kill(); fs.rmSync(s2.DIR, { recursive: true, force: true }); mock.close();
  console.log(`\nAI 代理 通过 ${pass}，失败 ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
