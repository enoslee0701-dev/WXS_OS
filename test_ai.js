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
    const isKb = body.output_config && body.output_config.format;
    const text = isKb ? JSON.stringify({ title: '老板口述：做决定、钱和预算', secs: [{ key: 'decide', items: ['新想法先试点两周，再决定是否推开。'] }, { key: 'money', items: ['单笔超过五千元的支出要先问老板。'] }, { key: 'bogus', items: ['x'] }] }) : '结论：「新官网」进度落后，建议本周和小李对一下首页设计。';
    reply(200, { id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text }], stop_reason: mode === 'refusal' ? 'refusal' : 'end_turn', stop_sequence: null, stop_details: mode === 'refusal' ? { type: 'refusal', category: null, explanation: '' } : null, usage: { input_tokens: 1200, output_tokens: 80 } });
  });
});
function start(env) {
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-ai-')), PORT = rnd();
  const p = spawn(process.execPath, [path.join(__dirname, 'server', 'server.js')], { env: { ...process.env, ANTHROPIC_API_KEY: '', PORT, HOST: '127.0.0.1', DATA_DIR: DIR, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stderr.on('data', d => { if (!/ExperimentalWarning|AI 出错/.test(String(d))) process.stderr.write(d); });
  p.B = 'http://127.0.0.1:' + PORT; p.DIR = DIR;
  return new Promise(r => p.stdout.on('data', d => { if (/已启动/.test(String(d))) r(p); }));
}
const mkApi = (B) => async (method, u, body, tok) => { const r = await fetch(B + u, { method, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json()) }; };
async function team(api) {
  const st = await api('POST', '/api/setup', { name: 'Enos', login: 'enos', password: 'enos123', demo: true });
  const boss = st.token;
  await api('POST', '/api/act', { name: 'idea.create', payload: { note: '老板私人草稿：考虑明年换办公室' } }, boss);
  await api('POST', '/api/accounts', { uid: 'u_sys', login: 'sun', password: 'sun12345' }, boss);
  await api('POST', '/api/accounts', { uid: 'u_dev', login: 'liu', password: 'liu12345' }, boss);
  const adm = (await api('POST', '/api/login', { login: 'sun', password: 'sun12345' })).token;
  const dev = (await api('POST', '/api/login', { login: 'liu', password: 'liu12345' })).token;
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
  const s2 = await start({ ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_BASE_URL: MOCK, AI_DAILY_LIMIT: '4' }); api = mkApi(s2.B); t = await team(api);
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

  mode = 'refusal'; r = await api('POST', '/api/ai/ask', { q: 'x' }, t.adm);
  ok(r.status === 422 && /没有回答/.test(r.error), '拒答有友好提示');
  mode = '429'; r = await api('POST', '/api/ai/ask', { q: 'x' }, t.adm);
  ok(r.status === 429 && /太忙/.test(r.error), '限流有友好提示');
  mode = 'ok';
  r = await api('POST', '/api/ai/ask', { q: 'x' }, t.boss); ok(r.status === 200, '老板第 3 次');
  r = await api('POST', '/api/ai/ask', { q: 'x' }, t.boss); ok(r.status === 200, '老板第 4 次');
  r = await api('POST', '/api/ai/ask', { q: 'x' }, t.boss); ok(r.status === 429 && /用完/.test(r.error), '超过每日上限');
  s2.kill(); fs.rmSync(s2.DIR, { recursive: true, force: true }); mock.close();
  console.log(`\nAI 代理 通过 ${pass}，失败 ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
