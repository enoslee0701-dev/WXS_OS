// 真实 AI 端到端：服务器 + 模拟 Anthropic API。老板在 AI 助手里提问拿到 Claude 回答；口述整理走 Claude；出错自动退回规则版；员工仍是规则模拟
const { chromium, devices } = require('playwright');
const http = require('http'), path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
const until = async (fn, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise(z => setTimeout(z, 100)); } return false; };
let mode = 'ok', calls = 0, srv = null;
const mock = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => {
  calls++; const body = JSON.parse(b || '{}');
  if (mode === 'down') { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'x' } })); }
  const kb = body.output_config && body.output_config.format;
  const text = kb && kb.schema.properties.verdict ? JSON.stringify({ verdict: 'needs_info', label: '建议先补充信息', reasons: ['没写预算'], risks: ['成本高'], checks: ['预算上限'], note: '先出方案再报我。' }) : kb && kb.schema.properties.suggested_route ? JSON.stringify({ title: '整理', summary: 's', background: 'b', problem: 'p', goal: 'g', overview: 'o', issues: [], directions: [], category: 'other', relation_to_direction: '', open_questions: [], exception_flags: [], suggested_route: 'operator_direct', suggested_tasks: [], confidence: 0.5 }) : kb ? JSON.stringify({ title: '老板口述：做决定', secs: [{ key: 'decide', items: ['新想法先小步试点两周，看反馈再决定。'] }, { key: 'money', items: ['单笔超过五千元的支出要先问老板。'] }] })
    : '**结论**：本周最需要关注的是「清醒」App 原型。\n\n- 负责人陈立，进度 0%\n- 建议今天和何静对一下首页设计';
  setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } })); }, 300);
}); });
(async () => {
  await new Promise(r => mock.listen(0, '127.0.0.1', r));
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-air-')), PORT = 25000 + Math.floor(Math.random() * 2000), URL = 'http://127.0.0.1:' + PORT + '/';
  srv = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: DIR, SETUP_CODE: 'code-1234', ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_BASE_URL: 'http://127.0.0.1:' + mock.address().port }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.on('data', d => { if (/已启动/.test(String(d))) r(); }));
  const api = async (m, u, body, tok) => (await fetch(URL.slice(0, -1) + u, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined })).json();
  const boss = (await api('POST', '/api/setup', { name: 'Enos', login: 'enos', password: 'enos123', demo: true, code: 'code-1234' })).token;
  await api('POST', '/api/accounts', { uid: 'u_dev', login: 'liu', password: 'liu12345' }, boss);

  const b = await chromium.launch(); const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const login = async (l, pw) => { if (!(await p.locator('form[data-form=srvLogin]').count())) await p.goto(URL); await p.waitForSelector('form[data-form=srvLogin]'); await p.fill('input[name=login]', l); await p.fill('input[name=password]', pw); await p.click('form[data-form=srvLogin] button[type=submit]'); await p.waitForSelector('.hm-card'); await p.waitForTimeout(300); };
  const send = async (t) => { await p.fill('.ai-input input[name=q]', t); await p.click('.ai-send'); };
  await login('enos', 'enos123');

  // ---- AI 助手：自由提问交给 Claude
  await p.goto(URL + '#/me'); await p.waitForTimeout(150); await p.click('.me-info[data-do=quickAI]'); await p.waitForSelector('.ai-panel');
  ok((await p.textContent('.ai-disc')).includes('Claude'), '面板标明由 Claude 回答');
  const n0 = calls; await send('这周我最该关注什么？');
  ok(await until(async () => (await p.locator('.ai-typing').count()) > 0, 1000), '先显示正在思考');
  ok(await until(async () => (await p.locator('.ai-m.bot .ai-real').count()) >= 1), '收到 Claude 回答');
  const last = await p.locator('.ai-m.bot').last().innerHTML();
  ok(/<b>结论<\/b>/.test(last) && /清醒/.test(last) && /kb-li|•/.test(last), '回答按格式渲染（加粗、列表）');
  ok(calls === n0 + 1, '只调用一次 AI');
  // 结构化动作仍用规则版（有可点按钮）
  await send('明天下午3点和林晓开会，周五前交报价'); await p.waitForTimeout(300);
  ok(calls === n0 + 1 && (await p.locator('.ai-m.bot').last().textContent()).includes('模拟输出'), '拆待办仍走规则版');
  // 出错 → 自动退回规则答案
  mode = 'down'; await send('项目进度怎么样');
  ok(await until(async () => (await p.textContent('#toast')).includes('AI'), 15000), 'AI 出错有提示');
  ok(await until(async () => (await p.locator('.ai-m.bot').last().textContent()).includes('模拟输出')), '出错后退回规则版回答');
  mode = 'ok';
  await p.evaluate(() => document.querySelectorAll('.ai-scrim').forEach(x => x.click())); await p.waitForTimeout(200);

  // ---- 老板决策：让 Claude 分析
  const dId = await p.evaluate(() => { const d = window.__tm.S.decisions.find(x => x.status === 'pending'); return d && d.ideaId; });
  await p.goto(URL + '#/idea/' + dId); await p.waitForTimeout(300);
  await p.locator('[data-do=decide]').first().click(); await p.waitForSelector('.sheet [data-do=advAI]');
  ok((await p.textContent('.sheet .ix2-advf')).includes('模拟'), '先显示规则版建议，并有「让 Claude 分析」');
  const n3 = calls; await p.click('.sheet [data-do=advAI]');
  ok(await until(async () => (await p.locator('.sheet .ix2-advf').textContent().catch(() => '')).includes('Claude 建议')), '弹窗里换成 Claude 建议');
  ok(calls === n3 + 1 && (await p.textContent('.sheet .ix2-advh b')).includes('建议先补充信息') && await p.locator('.sheet [data-do=advAI]').count() === 0, '显示 Claude 的结论，按钮消失');
  await p.evaluate(() => document.querySelectorAll('.scrim.on').forEach(x => x.click())); await p.waitForTimeout(150);

  // ---- 口述整理成规则：Claude 结构化输出
  await p.goto(URL + '#/kb/voice'); await p.waitForTimeout(200);
  await p.fill('#kbv-text', '嗯，我说两点。新想法先试点两周看反馈。然后单笔超过五千块的支出要先问我。');
  const n1 = calls; await p.click('[data-do=kbvMake]');
  await p.waitForSelector('.kbv-out', { timeout: 8000 });
  ok(calls === n1 + 1, '口述整理调用了 Claude');
  const secs = await p.locator('.kbv-sec h3').allTextContents();
  ok(secs.some(x => x.includes('怎么做决定')) && secs.some(x => x.includes('钱和预算')), '按 Claude 返回的主题显示');
  await p.click('[data-do=kbvMode]'); ok((await p.inputValue('#kbv-md')).includes('Claude 整理成条'), '来源标注为 Claude 整理');
  await p.click('[data-do=kbvMode]');
  await p.screenshot({ path: 'aireal-kb.png', fullPage: true });

  // ---- 员工：AI 仍是规则模拟，不调用 Claude
  await p.goto(URL + '#/me'); await p.waitForTimeout(100); await p.click('[data-do=srvLogout]'); await p.click('.sheet footer button[type=submit]');
  await p.waitForSelector('form[data-form=srvLogin]'); await p.waitForTimeout(300);
  await login('liu', 'liu12345');
  await p.evaluate(() => document.querySelectorAll('.scrim.on').forEach(x => x.click()));
  await p.goto(URL + '#/me'); await p.waitForTimeout(150); await p.click('.me-info[data-do=quickAI]'); await p.waitForSelector('.ai-panel');
  const n2 = calls; await send('项目进度怎么样'); await p.waitForTimeout(500);
  ok(calls === n2 && (await p.locator('.ai-m.bot').last().textContent()).includes('模拟输出'), '员工不调用 Claude，用规则模拟');
  ok(errs.length === 0, '无报错 ' + errs.join('|'));
  console.log(`真实 AI E2E 通过 ${pass}，失败 ${fail}`);
  await b.close(); srv.kill(); mock.close(); fs.rmSync(DIR, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); if (srv) srv.kill(); process.exit(1); });
