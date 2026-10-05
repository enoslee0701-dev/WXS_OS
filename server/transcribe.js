/* 录音 / 视频转文字：在服务器这台电脑上离线运行（whisper.cpp，不上传到任何第三方）。
   需要：ffmpeg（取出音轨）、whisper-cli 和模型文件。scripts/whisper-mac.sh 一键安装到 ~/Library/TeamOps。
   环境变量（可选）：WHISPER_BIN、WHISPER_MODEL、FFMPEG；TRANSCRIBE=0 关闭。 */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { spawn } = require('child_process');
const HOME = os.homedir();
const pick = (env, list) => [process.env[env]].concat(list).find(p => p && fs.existsSync(p)) || null;
const BIN = pick('WHISPER_BIN', [path.join(HOME, 'Library/TeamOps/whisper.cpp/build/bin/whisper-cli'), '/opt/homebrew/bin/whisper-cli', '/usr/local/bin/whisper-cli']);
const MODEL = pick('WHISPER_MODEL', ['ggml-large-v3-turbo-q5_0.bin', 'ggml-large-v3-turbo.bin', 'ggml-small.bin', 'ggml-base.bin'].map(f => path.join(HOME, 'Library/TeamOps/models', f)));
const FFMPEG = pick('FFMPEG', ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg', path.join(HOME, 'bin/ffmpeg')]);
const MAX_SEC = +process.env.TRANSCRIBE_MAX_SEC || 3600; // 最长转写 1 小时

function enabled() { return process.env.TRANSCRIBE !== '0' && !!(BIN && MODEL && FFMPEG); }
function status() { return { enabled: enabled(), bin: !!BIN, model: MODEL ? path.basename(MODEL) : null, ffmpeg: !!FFMPEG }; }

function run(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('超时')); }, timeoutMs);
    p.stdout.on('data', d => { out += d; if (out.length > 5e6) out = out.slice(-5e6); });
    p.stderr.on('data', d => { err += d; if (err.length > 2e4) err = err.slice(-2e4); });
    p.on('error', e => { clearTimeout(t); reject(e); });
    p.on('close', code => { clearTimeout(t); code === 0 ? resolve(out) : reject(new Error((err.trim().split('\n').pop() || '退出码 ' + code).slice(0, 200))); });
  });
}

// whisper 输出的半角标点换成中文标点；去掉首尾空白和重复空格
function tidy(t) {
  return String(t || '').replace(/\[[^\]]*\]/g, '').replace(/\s*\n\s*/g, '\n').replace(/([一-鿿])\s*,\s*/g, '$1，').replace(/([一-鿿])\s*\?\s*/g, '$1？')
    .replace(/([一-鿿])\s*!\s*/g, '$1！').replace(/([一-鿿])\s*;\s*/g, '$1；').replace(/([一-鿿])\s*:\s*/g, '$1：').replace(/([一-鿿])\.(?=\s|$)/g, '$1。').replace(/[ \t]{2,}/g, ' ').trim();
}

// 一次只转一个（模型占内存，并发反而更慢）
let chain = Promise.resolve();
function transcribe(file, prompt) {
  const job = chain.then(async () => {
    if (!enabled()) throw new Error('服务器没有安装语音转写');
    const wav = path.join(os.tmpdir(), 'tm-tr-' + process.pid + '-' + Date.now() + '.wav');
    try {
      await run(FFMPEG, ['-loglevel', 'error', '-y', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-t', String(MAX_SEC), '-f', 'wav', wav], 10 * 60e3);
      if (!fs.existsSync(wav) || fs.statSync(wav).size < 3200) return ''; // 没有声音轨或太短
      const args = ['-m', MODEL, '-f', wav, '-l', 'zh', '-nt', '-np', '-t', String(Math.max(2, Math.min(8, os.cpus().length - 2)))];
      if (prompt) args.push('--prompt', String(prompt).slice(0, 600));
      return tidy(await run(BIN, args, 30 * 60e3));
    } finally { fs.rm(wav, { force: true }, () => {}); }
  });
  chain = job.catch(() => {});
  return job;
}

module.exports = { enabled, status, transcribe, tidy };
