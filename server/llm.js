/* 本机 AI（没有 Claude 密钥时用）：在服务器这台电脑上运行开源中文模型（llama.cpp + Qwen2.5 7B），数据不出这台电脑、不花钱。
   - 团队服务器启动时在后台拉起 llama-server（只监听本机 127.0.0.1），崩溃会自动重启
   - 一次只处理一个请求（模型占内存，排队反而更快）
   - 只能读文字：看图片、读 PDF 仍需要 Claude
   scripts/llm-mac.sh 一键安装到 ~/Library/TeamOps。环境变量：LLM=0 关闭；LLM_BIN、LLM_MODEL、LLM_PORT（默认 8791）、LLM_URL（测试用：直接用现成的服务） */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { spawn } = require('child_process');
const HOME = os.homedir();
const pick = (env, list) => [process.env[env]].concat(list).find(p => p && fs.existsSync(p)) || null;
const BIN = pick('LLM_BIN', [path.join(HOME, 'Library/TeamOps/llama.cpp/build/bin/llama-server'), '/opt/homebrew/bin/llama-server']);
const MODEL = pick('LLM_MODEL', ['Qwen2.5-7B-Instruct-Q4_K_M.gguf'].map(f => path.join(HOME, 'Library/TeamOps/models', f)));
const PORT = +process.env.LLM_PORT || 8791;
const URL = process.env.LLM_URL || ('http://127.0.0.1:' + PORT);
const NAME = process.env.LLM_NAME || (MODEL ? path.basename(MODEL).replace(/-Q\d.*$|\.gguf$/i, '').replace(/-/g, ' ') : '本机模型');

let proc = null, ready = false, stopping = false, restarts = 0;
function configured() { return process.env.LLM !== '0' && (!!process.env.LLM_URL || !!(BIN && MODEL)); }
function enabled() { return configured() && ready; }
function start() {
  if (!configured()) return;
  if (process.env.LLM_URL) { ready = true; return; } // 测试：用外部现成的服务
  if (proc) return;
  // 上次没关干净、端口上已经有一个在跑：直接接着用，不再起第二个（会抢端口失败）
  fetch(URL + '/health').then(r => { if (r.ok) { ready = true; console.log('本机 AI：沿用已在运行的服务（' + NAME + '）'); } else spawnIt(); }, () => spawnIt());
}
function spawnIt() {
  if (proc) return;
  const args = ['-m', MODEL, '--host', '127.0.0.1', '--port', String(PORT), '-c', '16384', '-ngl', '99', '--jinja', '-t', String(Math.max(2, Math.min(8, os.cpus().length - 2))), '--no-webui'];
  proc = spawn(BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  proc.stderr.on('data', d => { err = (err + d).slice(-4000); });
  // 模型加载要十几秒：轮询 /health，就绪后才对外启用
  const me = proc, poll = setInterval(async () => {
    if (proc !== me) return clearInterval(poll);
    try { const r = await fetch(URL + '/health'); if (r.ok) { clearInterval(poll); ready = true; restarts = 0; console.log('本机 AI：已启动（' + NAME + '）'); } } catch (e) {}
  }, 1000);
  proc.on('exit', code => {
    proc = null; ready = false;
    if (stopping) return;
    console.error('本机 AI 退出（' + code + '）', err.split('\n').slice(-3).join(' '));
    if (++restarts <= 5) setTimeout(spawnIt, 5000 * restarts); // 崩溃了过一会儿再拉起来，最多 5 次
  });
}
function stop() { stopping = true; if (proc) proc.kill(); }
process.on('exit', stop);
// 服务器被正常停止（launchd / Ctrl+C）时 'exit' 事件不会触发：先关掉本机模型再退出，避免留下孤儿进程
['SIGTERM', 'SIGINT'].forEach(sig => process.once(sig, () => { stop(); process.exit(0); }));

// 一次只跑一个
let chain = Promise.resolve();
function chat({ system, messages, schema, maxTokens }) {
  const job = chain.then(async () => {
    if (!enabled()) throw { status: 503, error: '本机 AI 还没准备好，请稍后再试' };
    const msgs = [{ role: 'system', content: system }].concat(messages);
    const body = { messages: msgs, temperature: 0.3, max_tokens: Math.min(maxTokens || 4000, 6000) };
    if (schema) body.response_format = { type: 'json_schema', json_schema: { name: 'out', schema, strict: true } };
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8 * 60e3);
    let r;
    try { r = await fetch(URL + '/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }); }
    catch (e) { throw { status: 503, error: '本机 AI 没有响应' }; }
    finally { clearTimeout(t); }
    if (!r.ok) throw { status: 502, error: '本机 AI 出错（' + r.status + '）' };
    const j = await r.json(), c = j.choices && j.choices[0];
    const text = String(c && c.message && c.message.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return { text, usage: { input_tokens: (j.usage && j.usage.prompt_tokens) || 0, output_tokens: (j.usage && j.usage.completion_tokens) || 0 }, truncated: c && c.finish_reason === 'length' };
  });
  chain = job.catch(() => {});
  return job;
}

module.exports = { configured, enabled, start, stop, chat, NAME };
