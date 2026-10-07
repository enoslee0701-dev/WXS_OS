// 本机 AI（没有 Claude 密钥时，用服务器本机的开源模型）：用假的 OpenAI 兼容服务代替 llama-server
//   提问带团队数据；想法整理按 JSON Schema 输出并写回；看图片 / 读 PDF 给出明确提示；不计费
const http = require('http'), path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗ ' + m); } };
const seen = [];
// 按 JSON Schema 造一个合规的对象
const fake = (sc) => sc.enum ? sc.enum[0] : sc.type === 'object' ? Object.fromEntries(Object.keys(sc.properties || {}).map(k => [k, fake(sc.properties[k])])) : sc.type === 'array' ? [] : sc.type === 'number' || sc.type === 'integer' ? 0.8 : sc.type === 'boolean' ? false : '本机模型的输出';
const llm = http.createServer((q, r) => { let b = ''; q.on('data', d => b += d); q.on('end', () => {
  if (q.url === '/health') { r.writeHead(200); return r.end('{"status":"ok"}'); }
  const body = JSON.parse(b || '{}'); seen.push(body);
  const rf = body.response_format, text = rf ? JSON.stringify(Object.assign(fake(rf.json_schema.schema), rf.json_schema.schema.properties.title ? { title: '本机模型拟的标题' } : {})) : '本机模型的回答：先看「清醒」App 原型。';
  r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 1000, completion_tokens: 200 } }));
}); });
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-llm-'));
(async () => {
  await new Promise(r => llm.listen(0, '127.0.0.1', r));
  const PORT = 24000 + Math.floor(Math.random() * 2000), B = 'http://127.0.0.1:' + PORT;
  const env = { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: DIR, SETUP_CODE: 'c', LLM_URL: 'http://127.0.0.1:' + llm.address().port, LLM_NAME: 'Qwen2.5 7B Instruct', TRANSCRIBE: '0' };
  delete env.ANTHROPIC_API_KEY; delete env.ANTHROPIC_AUTH_TOKEN;
  const srv = spawn(process.execPath, [path.join(__dirname, 'server', 'server.js')], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => { let o = ''; srv.stdout.on('data', d => { o += d; if (/已启动/.test(o)) r(); }); });
  const api = async (m, u, b, t) => { const x = await fetch(B + u, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); const j = await x.json().catch(() => ({})); j.status = x.status; return j; };
  const tok = (await api('POST', '/api/setup', { name: 'Philip', login: 'enos', password: 'enos123456', code: 'c', demo: true })).token;
  const st = await api('GET', '/api/ai/status', null, tok);
  ok(st.enabled && st.provider === 'local' && st.model === '本机 Qwen2.5 7B Instruct', '没有 Claude 密钥时启用本机 AI ' + JSON.stringify(st));
  const a = await api('POST', '/api/ai/ask', { q: '这周最该关注什么？' }, tok), q1 = seen[seen.length - 1];
  ok(a.status === 200 && /本机模型的回答/.test(a.text) && q1.messages[0].role === 'system' && /团队快照/.test(q1.messages[0].content) && q1.messages[q1.messages.length - 1].content.includes('最该关注'), '提问：系统提示带团队数据，回答返回 App');
  // 想法整理：按 JSON Schema 输出，写回整理稿
  const r = await api('POST', '/api/act', { name: 'idea.create', payload: { note: '年底办一场感恩晚会，预算两万。' } }, tok);
  await api('POST', '/api/act', { name: 'idea.submit', payload: { id: r.r.id, path: 'direct' } }, tok);
  let sm = null; for (let i = 0; i < 40 && !sm; i++) { await new Promise(z => setTimeout(z, 150)); const s = (await api('GET', '/api/state', null, tok)).state; const x = s.summaries.filter(y => y.ideaId === r.r.id && y.kind === 'analysis').pop(); if (x && x.payload.simulated === false) sm = x; }
  const aq = seen.find(x => x.response_format);
  ok(!!sm && sm.payload.title === '本机模型拟的标题' && sm.payload.model === '本机 Qwen2.5 7B Instruct', '想法整理稿由本机 AI 生成并写回');
  ok(aq && aq.response_format.type === 'json_schema' && /只输出符合要求的 JSON/.test(aq.messages[0].content), '结构化输出：把 JSON Schema 交给本机模型');
  // 看图片、读 PDF：本机模型做不了，给出明确提示
  const im = await api('POST', '/api/ai/image', { data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', type: 'image/png' }, tok);
  ok(im.status === 501 && /Claude/.test(im.error), '看图片：提示需要 Claude 密钥 ' + im.error);
  const us = await api('GET', '/api/usage', null, tok);
  ok(us.ai.enabled && us.ai.month.calls >= 2 && us.ai.month.usd === 0, '本机运行不计费 ' + JSON.stringify(us.ai.month));
  srv.kill(); llm.close(); fs.rmSync(DIR, { recursive: true, force: true });
  console.log(`本机 AI 通过 ${pass}，失败 ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
