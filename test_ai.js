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
  const p = spawn(process.execPath, [path.join(__dirname, 'server', 'server.js')], { env: { ...process.env, ANTHROPIC_API_KEY: '', PORT, HOST: '127.0.0.1', DATA_DIR: DIR, SETUP_CODE: 'code-1234', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stderr.on('data', d => { if (!/ExperimentalWarning|AI 出错/.test(String(d))) process.stderr.write(d); });
  p.B = 'http://127.0.0.1:' + PORT; p.DIR = DIR; p.env = env;
  return new Promise(r => p.stdout.on('data', d => { if (/已启动/.test(String(d))) r(p); }));
}
const mkApi = (B) => async (method, u, body, tok) => { const r = await fetch(B + u, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json()) }; };
async function team(api) {
  const st = await api('POST', '/api/setup', { name: 'Enos', login: 'enos', password: 'enos123', demo: true, code: 'code-1234' });
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
  const s2 = await start({ ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_BASE_URL: MOCK, AI_DAILY_LIMIT: '6', BRIEF_NOW: '1' }); api = mkApi(s2.B); t = await team(api);
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
  // 管理员已用 5 次（提问 + 拒答 + 限流 + 读 PDF + 拆待办），上限 6：并发 3 个请求只能成功 1 个
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
  s2.kill(); fs.rmSync(s2.DIR, { recursive: true, force: true }); mock.close();
  console.log(`\nAI 代理 通过 ${pass}，失败 ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
