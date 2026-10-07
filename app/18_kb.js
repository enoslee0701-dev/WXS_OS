/* app/18_kb.js — AI 知识库、口述成规则。所有 app/*.js 按文件名顺序拼进同一个闭包（build.js），共享变量；不要在这里再包一层 function */
  /* ---------- AI 知识库 ---------- */
  var kbTry = '';
  function kbSize(n) { return n >= 10000 ? (n / 10000).toFixed(1) + ' 万字' : n + ' 字'; }
  function kbMd(t) { return esc(t).split('\n').map(function (l) { var m; if ((m = l.match(/^(#{1,3})\s+(.*)/))) return '<h' + (m[1].length + 2) + '>' + m[2] + '</h' + (m[1].length + 2) + '>'; if ((m = l.match(/^\s*[-*]\s+(.*)/))) return '<p class="kb-li">• ' + m[1] + '</p>'; return l.trim() ? '<p>' + l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</p>' : ''; }).join(''); }
  function viewKB(id) {
    TM.kbInit(S); var can = TM.kbCan(S, me), docs = TM.kbVisible(S, me);
    if (id === 'voice') return viewKBVoice(can);
    if (kbv.rec) kbvStop(true);
    if (id) {
      var k = docs.find(function (x) { return x.id === id; });
      if (!k) return ixHead('AI 知识库', '资料') + emptyBox('这份资料不存在，或你没有查看权限。');
      return ixHead('资料详情', esc(k.title)) + '<section class="ix2-card"><div class="ix2-row"><span class="kb-tag' + (k.on ? ' on' : '') + '">' + (k.on ? 'AI 使用中' : '已停用') + '</span><span class="ix2-date">' + kbSize(k.size) + ' · ' + ago(k.at) + '</span></div><h2 class="kb-h">' + esc(k.title) + '</h2><div class="kb-md">' + kbMd(k.body) + '</div></section>' +
        (can ? '<div class="kb-ops"><button class="ix2-btn" data-do="kbEdit" data-id="' + k.id + '">' + ai2('edit', 1.7) + '编辑</button><button class="ix2-btn" data-do="kbToggle" data-id="' + k.id + '">' + (k.on ? '停用' : '启用') + '</button><button class="ix2-btn red" data-do="kbDel" data-id="' + k.id + '">删除</button></div>' : '');
    }
    var on = docs.filter(function (k) { return k.on; }).length;
    var h = ixHead('AI 知识库', '让 AI 更了解公司和老板的想法') +
      '<section class="ix2-card kb-intro"><span class="ix2-spark">' + hi('spark', 1.6) + '</span><div><b>AI 会参考这里的资料</b><p>把公司方向、规章制度、老板的思想和做事原则写成文档放在这里。AI 整理想法、给决策建议、找回记忆时，会引用相关的段落，并注明出自哪份资料。</p></div></section>' +
      (can ? '<a class="kb-voice" href="#/kb/voice"><span class="kb-vmic">' + ai2('mic', 1.8) + '</span><span class="kb-vt"><b>录音口述，AI 整理成规则</b><small>直接说出你的想法和做事原则，AI 自动分类成条，核对后存入知识库</small></span>' + hi('chev', 2) + '</a>' : '') +
      (can ? '<div class="kb-add"><label class="kb-addb">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>' + '<b>上传文档</b><small>' + (AI_ON ? 'Word、PDF、MD、TXT' : 'Word、MD、TXT') + '，可多选</small><input type="file" accept="' + (AI_ON ? '.pdf,application/pdf,' : '') + '.md,.markdown,.txt,.docx,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple data-kbfile="1"></label><button class="kb-addb" data-do="kbNew">' + ai2('edit', 1.7) + '<b>直接写 / 粘贴</b><small>老板的想法、口述整理</small></button></div>' : '<p class="ix2-empty" style="margin:0 4px 12px">资料由老板和管理员维护，你可以查看公开给团队的资料。</p>') +
      '<section class="ix2-card"><div class="ix2-sh"><b>' + pi('clip') + '资料（' + docs.length + '）</b><span class="ix2-date">' + on + ' 份启用</span></div>' +
      (docs.length ? docs.map(function (k) { return '<div class="kb-row' + (k.on ? '' : ' off') + '"><a href="#/kb/' + k.id + '"><span class="ix-fi ix-d">' + ai2('doc2', 1.7) + '</span><span class="ix-ft"><b>' + esc(k.title) + '</b><small>' + (k.source === 'voice' ? '口述整理 · ' : '') + kbSize(k.size) + ' · ' + (k.scope === 'ai_only' ? '仅 AI 参考，成员看不到' : '全员可看') + ' · ' + ago(k.at) + '</small></span></a>' + (can ? '<button class="ix2-eye' + (k.on ? ' on' : '') + '" data-do="kbToggle" data-id="' + k.id + '" role="switch" aria-checked="' + k.on + '" aria-label="' + (k.on ? '停用' : '启用') + ' ' + esc(k.title) + '"><i></i><span>' + (k.on ? '启用' : '停用') + '</span></button>' : '') + '</div>'; }).join('') : '<p class="ix2-empty">还没有资料。</p>') + '</section>' +
      '<section class="ix2-card"><div class="ix2-sh"><b>' + hi('spark', 1.6) + '试一试：AI 会引用什么</b></div><div class="kb-try"><input type="text" id="kbq" value="' + esc(kbTry) + '" placeholder="例如：明年要不要招两个开发" maxlength="60"><button class="ix2-btn blue" data-do="kbAsk">查一下</button></div>' +
      (kbTry ? (TM.kbMatch(S, kbTry, 3).length ? refsHTML(TM.kbMatch(S, kbTry, 3), 'AI 会引用这些段落') : '<p class="ix2-empty" style="margin-top:10px">没有找到相关段落。可以补充资料，或换个说法。</p>') : '') + '</section>' +
      '<p class="ix2-note" style="margin:0 6px 20px">演示版：AI 按关键词匹配资料段落，不是真正读懂全文。连接团队服务器并启用 AI 后，AI 会通读这些资料来理解公司和老板的思路。</p>';
    return h;
  }
  /* ---------- 口述成规则：老板录音 → 转文字 → AI 归类整理成条（演示：规则模拟） ---------- */
  function kbvFresh() { return { topic: '', text: '', interim: '', rec: false, sr: null, t0: 0, timer: null, out: null, mdMode: false, scope: 'ai_only', raw: true }; }
  var kbv = kbvFresh();
  var KBV_SECS = [
    ['quote', '我常说的话', /「[^」]{2,}」|“[^”]{2,}”|我常说|常挂在嘴边/],
    ['decide', '我怎么做决定', /决定|拍板|先问我|问过我|试点|审批|批准|同意|做主|请示|定下来/],
    ['people', '用人', /招人|招聘|新人|兼职|全职|试用|面试|品格|人品|用人|员工|同工|培养/],
    ['money', '钱和预算', /钱|预算|块|元|花费|报销|比价|成本|费用|支出|采购|分期/],
    ['public', '对外发布与品牌', /对外|发布|官网|品牌|宣传|公众号|口吻|海报|媒体/],
    ['team', '团队相处', /沟通|配搭|批评|表扬|指责|相处|合作|开会|会议|出了问题|彼此|互相/],
    ['why', '方向与初心', /初心|方向|目标|今年|三年|使命|异象|为什么|愿景/]
  ];
  var KBV_TOPICS = [['', '不限'], ['decide', '做决定'], ['people', '用人'], ['money', '钱和预算'], ['public', '对外发布'], ['team', '团队相处'], ['why', '方向初心']];
  var KBV_SAMPLE = '嗯，我说几点。新的想法我习惯先小步试点两周，看大家的反馈再决定要不要全面推开。人事的事情、单笔超过五千块的支出、还有对外发布的东西，这三类必须先问我。其他日常的事，运营者可以直接做主，事后跟我说一声就行。招人的话，我先看品格再看能力，新人先兼职试用三个月。花钱之前至少比价两家，长期的固定支出我会更谨慎。出了问题，我希望大家先说事实，再说原因，最后说怎么改进，不要互相指责。我常说一句话，「凡事凭爱心而做」，就是做事要从爱出发，不是为了表现自己。';
  function kbvClean(x) {
    var t = String(x || '').trim(), prev;
    do { prev = t; t = t.replace(/^(嗯+|啊+|呃+|那个|就是说|就是|然后|所以|另外|还有|对了|我说几点|我讲几点|第[一二三四五六七八九十]+点?|首先|其次)[，,、\s。]*/, ''); } while (t !== prev);
    t = t.replace(/[，,、\s]+$/, ''); if (t.length < 6) return '';
    return t + '。';
  }
  function kbOrganize(text, topic) {
    var parts = String(text).replace(/\r/g, '').split(/[。！？!?；;\n]+/), secs = {}, n = 0;
    parts.forEach(function (raw) {
      var t = kbvClean(raw); if (!t) return;
      var key = (KBV_SECS.find(function (x) { return x[2].test(t); }) || [topic || 'other'])[0];
      if (key === 'quote') { var q = t.match(/「([^」]+)」|“([^”]+)”/); if (q) { var mean = t.slice(t.indexOf(q[0]) + q[0].length).replace(/^[，,、\s]*(就是说|就是|意思是|也就是说|也就是)?[，,、\s]*/, '').replace(/。$/, ''); t = '「' + (q[1] || q[2]) + '」' + (mean ? '——' + mean + '。' : '。'); } }
      (secs[key] = secs[key] || []).push(t); n++;
    });
    var order = KBV_SECS.map(function (x) { return x[0]; }).filter(function (k) { return k !== 'quote'; }).concat(['other', 'quote']);
    var name = function (k) { var x = KBV_SECS.find(function (y) { return y[0] === k; }); return x ? x[1] : '其他原则'; };
    var list = order.filter(function (k) { return secs[k]; }).map(function (k) { return { key: k, name: name(k), items: secs[k] }; });
    var main = list.filter(function (x) { return x.key !== 'quote' && x.key !== 'other'; }).slice(0, 2).map(function (x) { return x.name.replace(/^我/, ''); });
    return { title: ('老板口述：' + (main.length ? main.join('、') : '做事原则')).slice(0, 40), secs: list, count: n };
  }
  function kbvMd(o) { return '# ' + o.title + '\n\n> 来源：老板口述录音，' + (o.real ? 'Claude 整理成条' : 'AI 整理成条（演示：规则模拟）') + '，已由老板核对。\n' + o.secs.filter(function (x) { return x.items.length; }).map(function (x) { return '\n## ' + x.name + '\n' + x.items.map(function (t) { return '- ' + t; }).join('\n'); }).join('\n') + '\n'; }
  function kbvSyncText() { var ta = document.getElementById('kbv-text'); if (ta && !kbv.rec) kbv.text = ta.value; }
  function kbvKeep() { var o = kbv.out; if (!o) return; var tl = document.getElementById('kbv-title'), md = document.getElementById('kbv-md'), rw = document.getElementById('kbv-raw'); if (tl) o.title = tl.value; if (md) o.md = md.value; if (rw) kbv.raw = rw.checked; }
  // 手机不能实时转文字、但服务器能转：先录音，停止后交给服务器转，追加到口述内容
  function kbvRecStart() {
    if (!(navigator.mediaDevices && window.MediaRecorder)) return toast('当前浏览器不支持录音', true);
    kbvSyncText();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [], mr = new MediaRecorder(stream);
      mr.ondataavailable = function (e) { chunks.push(e.data); };
      mr.onstop = function () { stream.getTracks().forEach(function (t) { t.stop(); }); srvTr(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), '口述录音').then(function (t) { if (!t) return toast('录音里没有识别到说话', true); kbv.text = (kbv.text + (kbv.text ? '\n' : '') + t).slice(0, 20000); render(); }, function () {}); };
      kbv.mr = mr; kbv.rec = true; kbv.t0 = Date.now(); mr.start();
      kbv.timer = setInterval(function () { var el = document.getElementById('kbv-t'); if (el) { var s2 = Math.round((Date.now() - kbv.t0) / 1000); el.textContent = '正在录音 ' + Math.floor(s2 / 60) + ':' + ('0' + s2 % 60).slice(-2) + '（停止后转文字）'; } }, 500);
      render();
    }).catch(function () { toast('没有拿到麦克风权限，请在浏览器设置里允许后再试', true); });
  }
  function kbvStart() {
    if ((!SR || kbv.srvMode) && canSrvTr()) return kbvRecStart();
    if (!SR) { toast('这个浏览器不支持语音转文字。可以点输入法上的话筒，直接说到下方文本框里', true); var t = document.getElementById('kbv-text'); if (t) t.focus(); return; }
    kbvSyncText();
    var r = new SR(); r.lang = 'zh-CN'; r.continuous = true; r.interimResults = true;
    r.onresult = function (e) { var it = ''; for (var i = e.resultIndex; i < e.results.length; i++) { var x = e.results[i][0].transcript.trim(); if (!x) continue; if (e.results[i].isFinal) kbv.text += (kbv.text && !/[。！？，\n]$/.test(kbv.text) ? '。' : '') + x; else it += x; }
      kbv.interim = it; var ta = document.getElementById('kbv-text'); if (ta) { ta.value = kbv.text + (it ? (kbv.text ? '。' : '') + it : ''); ta.scrollTop = ta.scrollHeight; } var nn = document.getElementById('kbv-n'); if (nn) nn.textContent = (kbv.text + it).length + ' 字'; };
    r.onerror = function (ev) { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { toast('没有麦克风权限，可以改用输入法的语音键', true); kbvStop(); } };
    srKeep(r, function () { return kbv.rec && kbv.sr === r; }, function (fatal) { if (kbv.rec) { kbvStop(); if (canSrvTr()) { kbv.srvMode = true; toast('这台手机的实时转写用不了，已改为「录完由服务器转文字」，请再点一次开始', true); } else if (!fatal) toast('这台手机的语音转文字连不上' + srCodeText() + '，可以用输入法的语音键说到下方文本框里', true); } });
    kbv.sr = r; kbv.rec = true; kbv.t0 = Date.now(); try { r.start(); } catch (e) {}
    kbv.timer = setInterval(function () { var el = document.getElementById('kbv-t'); if (el) { var s2 = Math.round((Date.now() - kbv.t0) / 1000); el.textContent = '正在听 ' + Math.floor(s2 / 60) + ':' + ('0' + s2 % 60).slice(-2); } }, 500);
    render();
  }
  function kbvStop(silent) {
    kbv.rec = false; clearInterval(kbv.timer); var r = kbv.sr; kbv.sr = null; if (r) { try { r.stop(); } catch (e) {} }
    if (kbv.mr) { var mr = kbv.mr; kbv.mr = null; try { if (silent) mr.onstop = function () { try { mr.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }; mr.stop(); } catch (e) {} }
    if (kbv.interim) { kbv.text += (kbv.text ? '。' : '') + kbv.interim; kbv.interim = ''; }
    if (!silent) render();
  }
  function viewKBVoice(can) {
    if (!can) return ixHead('口述成规则', 'AI 知识库') + emptyBox('只有老板和管理员可以录入规则。');
    if (kbv.out) {
      var o = kbv.out, n = o.secs.reduce(function (a, x) { return a + x.items.length; }, 0);
      return ixHead('确认规则', 'AI 已整理好，核对后保存') +
        '<section class="ix2-card kbv-out"><div class="ix2-row"><span class="kb-tag on">AI 整理（模拟）</span><span class="ix2-date">' + n + ' 条 · ' + o.secs.length + ' 个主题</span></div>' +
        '<label class="kbv-tl"><span>标题</span><input type="text" id="kbv-title" maxlength="40" value="' + esc(o.title) + '"></label>' +
        (kbv.mdMode ? '<textarea id="kbv-md" class="kbv-md" rows="14">' + esc(o.md || kbvMd(o)) + '</textarea>' :
          o.secs.map(function (x, si) { return '<div class="kbv-sec"><h3>' + esc(x.name) + '<i>' + x.items.length + '</i></h3>' + x.items.map(function (t, ii) { return '<div class="kbv-rule"><span>' + esc(t) + '</span><button type="button" data-do="kbvDel" data-s="' + si + '" data-i="' + ii + '" aria-label="删掉这条">×</button></div>'; }).join('') + '</div>'; }).join('')) +
        '<button type="button" class="kbv-mode" data-do="kbvMode">' + ai2('edit', 1.7) + (kbv.mdMode ? '回到分条预览（会丢掉全文里的改动）' : '改全文') + '</button></section>' +
        '<section class="ix2-card"><div class="ix2-sh"><b>谁能看到</b></div><div class="kbv-scope">' + [['ai_only', '仅 AI 参考', '成员看不到原文，只在 AI 建议里引用'], ['team', '全员可看', '团队成员可以阅读这份规则']].map(function (x) { return '<button type="button" class="' + (kbv.scope === x[0] ? 'on' : '') + '" data-do="kbvScope" data-v="' + x[0] + '"><b>' + x[1] + '</b><small>' + x[2] + '</small></button>'; }).join('') + '</div>' +
        '<label class="kbv-raw"><input type="checkbox" id="kbv-raw"' + (kbv.raw ? ' checked' : '') + '><span>附上口述原文，方便以后对照</span></label></section>' +
        '<div class="p-btns kbv-btns"><button class="p-prev" data-do="kbvRedo">重新说</button><button class="n-next" data-do="kbvSave">保存到知识库' + ni('check', 2.4) + '</button></div>';
    }
    var len = (kbv.text + kbv.interim).length;
    return ixHead('口述成规则', '说出你的想法，AI 整理成团队规则') +
      '<section class="ix2-card kbv-rec' + (kbv.rec ? ' on' : '') + '"><div class="kbv-topics"><span>这次主要说</span>' + KBV_TOPICS.map(function (x) { return '<button type="button" class="' + (kbv.topic === x[0] ? 'on' : '') + '" data-do="kbvTopic" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<button type="button" class="kbv-mic' + (kbv.rec ? ' on' : '') + '" data-do="kbvRec" aria-label="' + (kbv.rec ? '停止' : '开始说') + '">' + (kbv.rec ? '<i class="kbv-sq"></i>' : ai2('mic', 1.8)) + '</button>' +
      '<b class="kbv-st">' + (kbv.rec ? '<span id="kbv-t">正在听 0:00</span>' : len ? '可以继续说，或者点下方整理' : '点一下，开始说') + '</b>' +
      '<small class="kbv-hint">' + (kbv.rec ? '说完点中间按钮停止。像平时讲话一样说就行，不用组织语言' : SR ? '一次说几条你的做事原则：遇到什么情况、你怎么想、怎么做' : '当前浏览器不支持语音转文字，可以用输入法的话筒说到下方文本框') + '</small>' +
      (!len && !kbv.rec ? '<div class="kbv-eg"><span>可以这样说</span><p>「新想法我习惯先试点两周，看反馈再决定。」</p><p>「单笔超过五千块的支出，必须先问我。」</p><p>「出了问题先说事实，再说原因，最后说改进。」</p></div>' : '') + '</section>' +
      '<section class="ix2-card"><div class="ix2-sh"><b>' + ai2('doc2', 1.7) + '口述内容</b><span class="ix2-date" id="kbv-n">' + len + ' 字</span></div><textarea id="kbv-text" class="kbv-ta" rows="7" maxlength="20000" placeholder="说的话会自动转成文字出现在这里，也可以直接打字或粘贴…">' + esc(kbv.text + (kbv.interim ? '。' + kbv.interim : '')) + '</textarea>' +
      '<div class="kbv-ops"><button type="button" data-do="kbvSample">' + hi('spark', 1.5) + '用示例口述</button>' + (len ? '<button type="button" data-do="kbvClear">清空</button>' : '') + '</div></section>' +
      '<button class="vr-next kbv-go" data-do="kbvMake">' + hi('spark', 1.6) + 'AI 整理成规则</button>';
  }
  DO.kbvRec = function () { if (kbv.rec) kbvStop(); else kbvStart(); };
  DO.kbvTopic = function (el) { kbvSyncText(); kbv.topic = el.dataset.v; render(); };
  DO.kbvSample = function () { if (kbv.rec) kbvStop(true); kbv.text = KBV_SAMPLE; render(); toast('已填入一段示例口述'); };
  DO.kbvClear = function () { if (kbv.rec) kbvStop(true); kbv.text = ''; kbv.interim = ''; render(); };
  DO.kbvMake = function () {
    if (kbv.rec) kbvStop(true); kbvSyncText();
    var t = kbv.text.trim(); if (t.length < 15) { render(); return toast('先说几句，内容太少整理不出规则', true); }
    if (AI_ON && !kbv.ruleOnly) {
      openSheet('AI 正在整理', '<ol class="a-prog"><li class="ok">读取口述内容</li><li id="kp-ai">Claude 正在断句、去口头语、按主题归类…</li></ol>', '请稍候', function () {});
      var b0 = document.querySelector('.sheet footer button[type=submit]'); if (b0) b0.disabled = true;
      TMS.aiKb(kbv.topic, t).then(function (o2) {
        if (!o2.count) { closeSheet(); return toast('没有找到能整理成规则的句子，再说具体一点', true); }
        o2.real = true; kbv.out = o2; kbv.mdMode = false; closeSheet(); render(); window.scrollTo(0, 0);
      }, function (e) { closeSheet(); toast(((e && e.error) || 'AI 暂时不可用') + '，已改用规则整理', true); kbv.ruleOnly = true; DO.kbvMake(); kbv.ruleOnly = false; });
      return;
    }
    var o = kbOrganize(t, kbv.topic); if (!o.count) return toast('没有找到能整理成规则的句子，再说具体一点', true);
    var steps = ['断句、去掉口头语', '按主题归类', '整理成条'];
    openSheet('AI 正在整理', '<ol class="a-prog">' + steps.map(function (x, i) { return '<li id="kp' + i + '">' + x + '</li>'; }).join('') + '</ol><div class="callout">演示版：整理由规则模拟完成，不调用真实大模型。</div>', '请稍候', function () {});
    var btn = document.querySelector('.sheet footer button[type=submit]'); if (btn) btn.disabled = true;
    steps.forEach(function (_, i) { setTimeout(function () { var li = document.getElementById('kp' + i); if (li) li.className = 'ok'; }, 250 * (i + 1)); });
    setTimeout(function () { kbv.out = o; kbv.mdMode = false; closeSheet(); render(); window.scrollTo(0, 0); }, 900);
  };
  DO.kbvDel = function (el) { kbvKeep(); var si = +el.dataset.s, x = kbv.out.secs[si]; x.items.splice(+el.dataset.i, 1); if (!x.items.length) kbv.out.secs.splice(si, 1); render(); };
  DO.kbvMode = function () { kbvKeep(); if (kbv.mdMode) kbv.out.md = ''; else kbv.out.md = kbvMd(kbv.out); kbv.mdMode = !kbv.mdMode; render(); };
  DO.kbvScope = function (el) { kbvKeep(); kbv.scope = el.dataset.v; render(); };
  DO.kbvRedo = function () { kbv.out = null; render(); window.scrollTo(0, 0); };
  DO.kbvSave = function () {
    kbvKeep(); var o = kbv.out; o.title = String(o.title || '').trim();
    if (!kbv.mdMode && !o.secs.some(function (x) { return x.items.length; })) return toast('规则都删光了，重新说一次吧', true);
    var body = kbv.mdMode ? o.md : kbvMd(o);
    if (kbv.raw && kbv.text.trim()) body += '\n## 口述原文\n> ' + kbv.text.trim().replace(/\n+/g, ' ') + '\n';
    var r = act('kb.add', { title: o.title, body: body, scope: kbv.scope, source: 'voice' }, '已存入知识库，AI 之后会按这些规则给建议');
    if (r.ok) { kbv = kbvFresh(); navFinish('#/kb/' + r.id); }
  };
  function kbForm(k) { k = k || { title: '', body: '', scope: 'team' }; return field('标题', '<input type="text" name="title" maxlength="40" value="' + esc(k.title) + '" placeholder="例如：老板谈团队文化" required>') + field('内容（支持 Markdown）', '<textarea name="body" rows="10" placeholder="# 标题&#10;- 原则一&#10;- 原则二">' + esc(k.body) + '</textarea>') + '<div class="fld"><span>谁能看到</span><div class="opts">' + opt('scope', 'team', '全员可看', '团队成员可以阅读这份资料', k.scope !== 'ai_only') + opt('scope', 'ai_only', '仅 AI 参考', '成员看不到原文，只在 AI 建议里引用片段', k.scope === 'ai_only') + '</div></div>'; }
  var KB_TPL = "# 老板的想法与做事原则（模板）\n\n> 写法提示：一条一句话，说清楚「遇到什么情况 → 我怎么想 / 怎么做」。\n> 每个小标题下写 3–6 条就够了，AI 会按小标题和句子去找依据。\n> 不确定的地方可以先空着，以后再补。\n\n## 我们为什么做这件事\n- 我们做事的初心是：（一句话写清楚）\n- 我希望三年后团队变成：\n- 今年最重要的三件事是：\n\n## 我怎么做决定\n- 新想法我习惯先：（例如：小步试点两周，看反馈再决定）\n- 这些事必须先问我：（例如：人事、单笔超过 5000 元、对外发布）\n- 这些事运营者可以直接做主：\n- 我拒绝一件事，通常是因为：\n\n## 用人\n- 招人之前我会先看：\n- 我看重一个人的：\n- 新人先怎么安排：（例如：兼职试用三个月）\n- 我不能接受的行为：\n\n## 钱和预算\n- 花钱前要先：（例如：比价至少两家）\n- 长期支出和一次性支出，我更谨慎的是：\n- 超预算时我希望看到：（例如：明细、替代方案、能否分期）\n\n## 对外发布与品牌\n- 对外发的内容要谁审核：\n- 我们对外说话的口吻是：\n- 绝对不能发的内容：\n\n## 团队相处\n- 我希望大家沟通的方式是：\n- 出了问题我希望大家：（例如：先说事实，再说原因，最后说改进）\n- 批评和表扬的原则：\n\n## 我常说的话\n- 「凡事凭爱心而做」——意思是：\n- （把你常挂在嘴边、希望团队记住的话写在这里，并解释它的意思）\n";
  DO.kbTpl = function (el) { var f = el.closest('form'), b = f.querySelector('textarea[name=body]'), t = f.querySelector('input[name=title]'); if (b.value.trim() && !confirm('会覆盖已经写的内容，继续吗？')) return; b.value = KB_TPL; if (!t.value) t.value = '老板的想法与做事原则'; f.querySelector('input[name=scope][value=ai_only]').checked = true; b.focus(); b.setSelectionRange(0, 0); toast('已填入模板，把冒号后面补完整就行'); };
  DO.kbNew = function () { openSheet('添加资料', '<button type="button" class="ix2-adopt" data-do="kbTpl">' + hi('spark', 1.6) + '用「老板思想」模板开始</button>' + kbForm(), '保存', function (o) { var r = act('kb.add', { title: o.title, body: o.body, scope: o.scope }, '已添加，AI 之后会参考这份资料'); }); };
  DO.kbEdit = function (el) { var k = S.knowledge.find(function (x) { return x.id === el.dataset.id; }); openSheet('编辑资料', kbForm(k), '保存', function (o) { act('kb.update', { id: k.id, title: o.title, body: o.body, scope: o.scope }, '已保存'); }); };
  DO.kbToggle = function (el) { var k = S.knowledge.find(function (x) { return x.id === el.dataset.id; }); act('kb.update', { id: k.id, on: !k.on }, k.on ? '已停用，AI 不再参考' : '已启用，AI 会参考这份资料'); };
  DO.kbDel = function (el) { var k = S.knowledge.find(function (x) { return x.id === el.dataset.id; }); openSheet('删除资料', '<p style="margin:0">确定删除「<b>' + esc(k.title) + '</b>」？AI 之后不会再参考它。</p>', '删除', function () { var r = act('kb.delete', { id: k.id }, '已删除'); if (r.ok) location.hash = '#/kb'; }, true); };
  DO.kbAsk = function () { var v = (document.getElementById('kbq') || {}).value || ''; kbTry = v.trim(); if (!kbTry) return toast('先输入一个问题', true); render(); };
  DO.icOpen = function () { var id = cur().id; ichatOpen[id] = !ichatOpen[id]; render(); setTimeout(function () { var pn = document.getElementById('ic-panel'); if (pn) { pn.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 30); };
  DO.icClose = function () { ichatOpen[cur().id] = false; render(); };
  DO.icAsk = function (el) { icPush(I(cur().id), el.dataset.q); };
  DO.icSend = function () { var v = ((document.getElementById('ic-q') || {}).value || '').trim(); if (!v) return toast('先输入问题', true); icPush(I(cur().id), v); };
  DO.icMic = function (el) { if (!SR) return toast('这个浏览器不支持语音输入，可以用输入法自带的语音键', true); var r = new SR(); r.lang = 'zh-CN'; r.interimResults = false; el.classList.add('on'); r.onresult = function (e) { var t2 = e.results[0][0].transcript; var i2 = document.getElementById('ic-q'); if (i2) i2.value = t2; icPush(I(cur().id), t2); }; r.onend = function () { el.classList.remove('on'); }; r.onerror = function () { el.classList.remove('on'); toast('没听清，再试一次', true); }; try { r.start(); toast('请说出你的问题'); } catch (e) { el.classList.remove('on'); } };
  DO.wInfo = function () { var w = W(cur().id); if (!w) return;
    openSheet('编辑项目信息', field('截止时间', '<input type="date" name="due" value="' + (w.due || '') + '">') +
      '<div class="fld"><span>优先级</span><div class="opts">' + opt('priority', 'hi', '高', '', w.priority === 'hi') + opt('priority', 'mid', '中', '', (w.priority || 'mid') === 'mid') + opt('priority', 'lo', '低', '', w.priority === 'lo') + '</div></div>' +
      field('项目目标', '<textarea name="goal" rows="2" maxlength="200" placeholder="这个项目要达成什么">' + esc(w.goal || '') + '</textarea>') +
      field('关键成果', '<textarea name="keyResults" rows="2" maxlength="200" placeholder="怎样算做成了">' + esc(w.keyResults || '') + '</textarea>') +
      field('标签', '<input type="text" name="tags" value="' + esc((w.tags || []).join('、')) + '" placeholder="用顿号或逗号分开，最多 5 个">') +
      field('研发工具链接（可选）', '<input type="url" name="externalLink" value="' + esc(w.externalLink || '') + '" placeholder="例如 GitHub、Figma、禅道的项目地址">'), '保存',
      function (o) { act('work.update', { id: w.id, due: o.due || null, priority: o.priority, goal: o.goal, keyResults: o.keyResults, tags: (o.tags || '').split(/[、,，\s]+/).filter(Boolean), externalLink: o.externalLink || '' }, '项目信息已更新'); }); };
