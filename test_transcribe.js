// 录音 / 视频转文字（服务器端）：用假的 ffmpeg / whisper 脚本代替真程序，验证整条链路
//   附件传上来 → 自动转写 → 写回想法 → 整理稿按转写重新生成；失败标记；重启后不重做；先传文件后同步想法也能转
const path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗ ' + m); } };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-tr-')), BIN = path.join(DIR, 'bin'); fs.mkdirSync(BIN);
const PORT = 21000 + Math.floor(Math.random() * 2000), B = 'http://127.0.0.1:' + PORT;
// 假 ffmpeg：把 -f wav 后面的输出文件写成 4KB；输入文件内容是 silent 时写空文件（模拟没有声音轨）
fs.writeFileSync(path.join(BIN, 'ffmpeg'), `#!/bin/sh
for a in "$@"; do last="$a"; done
for a in "$@"; do if [ -f "$a" ] && [ "$a" != "$last" ]; then in="$a"; fi; done
if grep -q silent "$in"; then : > "$last"; else head -c 4096 /dev/zero > "$last"; fi
`);
// 假 whisper：输入文件名不重要；prompt 里有团队成员名字时原样带出一个，证明 prompt 传进去了；环境变量 FAIL=1 时失败
fs.writeFileSync(path.join(BIN, 'whisper'), `#!/bin/sh
if [ -f "${DIR}/fail" ]; then echo "model error" >&2; exit 1; fi
p=""; while [ $# -gt 0 ]; do if [ "$1" = "--prompt" ]; then p="$2"; fi; shift; done
case "$p" in *王老板*) who="王老板";; *) who="某人";; esac
echo "下周二开同工会, 讨论感恩晚会的预算和场地, \${who}请林晓整理方案."
`);
fs.chmodSync(path.join(BIN, 'ffmpeg'), 0o755); fs.chmodSync(path.join(BIN, 'whisper'), 0o755);
const MODEL = path.join(DIR, 'model.bin'); fs.writeFileSync(MODEL, 'm');
function start() {
  const p = spawn(process.execPath, [path.join(__dirname, 'server', 'server.js')], { env: { ...process.env, PORT, HOST: '127.0.0.1', DATA_DIR: path.join(DIR, 'data'), SETUP_CODE: 'c', WHISPER_BIN: path.join(BIN, 'whisper'), WHISPER_MODEL: MODEL, FFMPEG: path.join(BIN, 'ffmpeg') }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stderr.on('data', d => { const t = String(d); if (!/ExperimentalWarning|转写失败/.test(t)) process.stderr.write(t); });
  return new Promise(r => { let out = ''; p.stdout.on('data', d => { out += d; if (/已启动/.test(out) && /语音转写/.test(out)) r([p, out]); }); });
}
const call = async (method, url, body, tok, raw) => { const r = await fetch(B + url, { method, headers: { ...(raw ? { 'Content-Type': 'audio/mp4', 'X-File-Name': encodeURIComponent('录音.m4a') } : { 'Content-Type': 'application/json' }), ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: raw || (body ? JSON.stringify(body) : undefined) }); const j = await r.json().catch(() => ({})); j.status = r.status; return j; };
const act = (tok, name, payload) => call('POST', '/api/act', { name, payload }, tok);
const idea = async (tok, id) => (await call('GET', '/api/state', null, tok)).state.ideas.find(d => d.id === id);
const until = async (fn, ms) => { for (let t = 0; t < (ms || 8000); t += 100) { const v = await fn(); if (v) return v; await new Promise(r => setTimeout(r, 100)); } return null; };
(async () => {
  let [srv, out] = await start();
  ok(/语音转写：已启用/.test(out), '启动时显示语音转写已启用');
  const tok = (await call('POST', '/api/setup', { name: '王老板', login: 'boss', password: 'boss123456', code: 'c' })).token;
  ok((await call('GET', '/api/ai/status', null, tok)).transcribe === true, 'AI 状态里告诉 App：服务器能转写');
  // 1. 先记想法（带录音），再传文件：传上来后自动转写
  const r1 = await act(tok, 'idea.create', { note: '', media: [{ kind: 'audio', name: '录音 0:12', localId: 'b_aud_001' }] });
  await act(tok, 'idea.submit', { id: r1.r.id, path: 'direct' });
  ok((await call('PUT', '/api/files/b_aud_001', null, tok, Buffer.from('audio-bytes'))).status === 200, '上传录音');
  let d = await until(async () => { const x = await idea(tok, r1.r.id); return x.media[0].transcriptStatus === 'done' && x; });
  ok(d && d.media[0].transcript === '下周二开同工会，讨论感恩晚会的预算和场地，王老板请林晓整理方案。', '录音自动转成文字（中文标点、团队成员名字作提示）：' + (d && d.media[0].transcript));
  const st = await call('GET', '/api/state', null, tok), sm = st.state.summaries.filter(x => x.ideaId === r1.r.id && x.kind === 'analysis').pop();
  ok(sm && JSON.stringify(sm.payload).includes('同工会'), '整理稿按转写重新生成');
  ok(st.state.events.some(e => e.ideaId === r1.r.id && /转写完成/.test(e.text)), '动态记一条转写完成');
  // 2. 先传文件，后同步想法（手机离线时的顺序）：想法同步上来后转写
  await call('PUT', '/api/files/b_vid_002', null, tok, Buffer.from('video-bytes'));
  const r2 = await act(tok, 'idea.create', { note: '视频想法', media: [{ kind: 'video', name: '视频 10月5日.mp4', localId: 'b_vid_002' }] });
  d = await until(async () => { const x = await idea(tok, r2.r.id); return x.media[0].transcriptStatus === 'done' && x; });
  ok(d && /同工会/.test(d.media[0].transcript), '先传文件后同步想法：也会转写');
  // 3. 没有声音轨：标记为「没有识别到说话」（done + 空文字）
  await call('PUT', '/api/files/b_aud_003', null, tok, Buffer.from('silent'));
  const r3 = await act(tok, 'idea.create', { note: '静音', media: [{ kind: 'audio', name: '录音 0:02', localId: 'b_aud_003' }] });
  d = await until(async () => { const x = await idea(tok, r3.r.id); return x.media[0].transcriptStatus === 'done' && x; });
  ok(d && !d.media[0].transcript, '没有声音：标记完成、没有文字');
  // 4. whisper 出错：标记失败
  fs.writeFileSync(path.join(DIR, 'fail'), '1');
  await call('PUT', '/api/files/b_aud_004', null, tok, Buffer.from('audio'));
  const r4 = await act(tok, 'idea.create', { note: '会失败的', media: [{ kind: 'audio', name: '录音 0:05', localId: 'b_aud_004' }] });
  d = await until(async () => { const x = await idea(tok, r4.r.id); return x.media[0].transcriptStatus === 'failed' && x; });
  ok(!!d, '转写出错：标记失败');
  fs.rmSync(path.join(DIR, 'fail'));
  // 5. 图片、链接不转写
  await call('PUT', '/api/files/b_img_005', null, tok, Buffer.from('img'));
  const r5 = await act(tok, 'idea.create', { note: '图片', media: [{ kind: 'image', name: '照片.jpg', localId: 'b_img_005' }] });
  await new Promise(r => setTimeout(r, 600));
  ok(!(await idea(tok, r5.r.id)).media[0].transcriptStatus, '图片不转写');
  // 5b. 直接转文字接口（AI 建项目 / 拆待办 / 手机识别不了时）：要登录；返回文字
  ok((await fetch(B + '/api/transcribe', { method: 'POST', body: 'x' })).status === 401, '直接转文字：没登录不行');
  { const r = await fetch(B + '/api/transcribe', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'audio/webm' }, body: Buffer.from('audio') }); const j = await r.json();
    ok(r.status === 200 && /同工会/.test(j.text) && j.text.includes('，'), '直接转文字：返回中文文字 ' + j.text); }
  // 5c. App 已经让服务器转过、写进正文的录音（intext）：上传后不再重复转
  await call('PUT', '/api/files/b_aud_006', null, tok, Buffer.from('audio'));
  const r6 = await act(tok, 'idea.create', { note: '已经转过：下周开会', media: [{ kind: 'audio', name: '录音 0:09', localId: 'b_aud_006', transcriptStatus: 'intext' }] });
  await new Promise(r => setTimeout(r, 800));
  ok((await idea(tok, r6.r.id)).media[0].transcriptStatus === 'intext', '已写进正文的录音不重复转写');
  // 6. 重启：转过的、失败的都不重做
  const v0 = (await call('GET', '/api/state', null, tok)).version;
  srv.kill(); await new Promise(r => srv.on('exit', r));
  [srv] = await start(); await new Promise(r => setTimeout(r, 5000));
  const tok2 = (await call('POST', '/api/login', { login: 'boss', password: 'boss123456' })).token;
  const s2 = await call('GET', '/api/state', null, tok2);
  ok(s2.version === v0 && s2.state.ideas.find(x => x.id === r4.r.id).media[0].transcriptStatus === 'failed', '重启后不重做（失败的也不自动重试）');
  srv.kill(); fs.rmSync(DIR, { recursive: true, force: true });
  console.log(`语音转写 通过 ${pass}，失败 ${fail}`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
