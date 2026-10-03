/* 真实 AI（Claude）：服务端代理，API Key 只在服务器上。
   - 只把提问人自己能看到的数据（TM.viewFor）交给模型
   - 默认只给老板和管理员用（AI_FOR_ALL=1 时全员可用），每人每天有调用上限（AI_DAILY_LIMIT，默认 200）
   - 没有配置 ANTHROPIC_API_KEY 时 enabled() 为 false，客户端继续用规则模拟
   环境变量：ANTHROPIC_API_KEY、AI_MODEL（默认 claude-opus-5-5）、AI_FOR_ALL、AI_DAILY_LIMIT、ANTHROPIC_BASE_URL（测试用） */
'use strict';
const Anthropic = require('@anthropic-ai/sdk');
const TM = require('../engine.js');

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const LIMIT = +process.env.AI_DAILY_LIMIT || 200;
const SYSTEM_LIMIT = +process.env.AI_SYSTEM_LIMIT || 100; // 后台自动整理 / 总结的全队每日上限
let client = null;
const enabled = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const cli = () => client || (client = new Anthropic());
const allowed = (S, uid) => process.env.AI_FOR_ALL === '1' || TM.hasRole(S, uid, 'owner') || TM.hasRole(S, uid, 'admin');

/* ---------- 上下文：稳定部分（说明 + 知识库）在前并缓存，经常变的团队快照在后 ---------- */
const BASE = `你是一个基督教事工团队协同 App 里的 AI 助手，主要服务团队的老板（创始人）。
团队的使命是「用科技让福音走得更远」。你帮老板看清全局、做判断、写东西。
回答要求：
- 用简体中文，直接、具体、可执行；先给结论，再给依据。
- 只依据下面提供的团队数据和资料回答；数据里没有的就说没有，不要编造人名、数字、日期。
- 提到具体事项时写出它的名称和负责人；涉及风险时说明原因和建议的下一步。
- 手机上阅读：段落短，适当用列表；不要用表格。`;
function kbBlock(view, uid, S) {
  // viewFor 已按身份裁剪：老板 / 管理员能拿到「仅 AI 可见」的资料，员工只有公开给团队的
  const all = (view.knowledge || []).filter(k => k.on !== false);
  if (!all.length) return '';
  let out = '\n\n# 公司与老板的资料（知识库）\n', budget = 60000;
  for (const k of all) { const t = `\n## ${k.title}\n${String(k.body || '').slice(0, 12000)}\n`; if (t.length > budget) break; out += t; budget -= t.length; }
  return out;
}
const day = (t) => t ? new Date(t).toISOString().slice(0, 10) : '';
function snapshot(view, uid) {
  const nm = (id) => TM.name(view, id);
  const L = TM.L, lines = [];
  const u = TM.user(view, uid);
  lines.push(`# 团队快照（今天 ${TM.todayStr(view)}；提问人：${u ? u.name + '，' + u.roles.map(r => L.role[r.role]).join('、') : uid}）`);
  if (view.settings.direction) lines.push('公司方向：' + view.settings.direction);
  lines.push('\n## 成员'); view.users.forEach(x => lines.push(`- ${x.name}（${x.title || ''}；${x.roles.map(r => L.role[r.role]).join('、')}${x.group ? '；' + x.group : ''}）`));
  lines.push('\n## 项目'); view.workItems.forEach(w => { const p = TM.workProgress(view, w.id); lines.push(`- 「${w.title}」${L.work[w.status] || w.status}；负责人 ${w.leadId ? nm(w.leadId) : '无'}，跟进 ${w.operatorId ? nm(w.operatorId) : '无'}；截止 ${w.due || '未定'}；任务完成 ${p.done}/${p.total}${w.goal ? '；目标：' + w.goal : ''}`); });
  lines.push('\n## 任务'); view.tasks.filter(t => t.status !== 'cancelled').forEach(t => lines.push(`- 「${t.title}」${L.task[t.status] || t.status}；执行 ${nm(t.ownerId)}；截止 ${t.due || '未定'}；最近动态 ${day(t.lastActivity)}${t.blockedReason ? '；受阻：' + t.blockedReason : ''}${TM.isOverdue(view, t) ? '；已逾期' : ''}`));
  lines.push('\n## 想法'); view.ideas.forEach(d => lines.push(`- 「${d.title || String(d.note || '').slice(0, 30)}」${L.idea[d.status] || d.status}；发起 ${nm(d.creatorId)}${d.followerId ? '，跟进 ' + nm(d.followerId) : ''}：${String(d.note || '').replace(/\s+/g, ' ').slice(0, 160)}`));
  const dec = view.decisions.filter(x => x.status === 'pending'); if (dec.length) { lines.push('\n## 等老板决策'); dec.forEach(x => lines.push(`- ${x.question}（提出人 ${nm(x.requestedBy)}）`)); }
  const td = (view.todos || []).filter(t => !t.done); if (td.length) { lines.push('\n## 提问人的个人待办'); td.slice(0, 40).forEach(t => lines.push(`- ${t.title}（${t.date || ''} ${t.time || ''}）`)); }
  return lines.join('\n');
}

/* ---------- 调用 ---------- */
async function call({ system, messages, schema, effort, maxTokens }) {
  const req = {
    model: MODEL, max_tokens: maxTokens || 16000,
    system, messages,
    output_config: Object.assign({ effort: effort || 'medium' }, schema ? { format: { type: 'json_schema', schema } } : {}),
    // 拒答时由服务端自动换模型重试
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default'
  };
  let res;
  try { res = await cli().beta.messages.create(req); }
  catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw { status: 429, error: 'AI 现在太忙，请稍后再试' };
    if (e instanceof Anthropic.AuthenticationError) throw { status: 503, error: 'AI 的密钥无效，请老板检查服务器配置' };
    if (e instanceof Anthropic.APIConnectionError) throw { status: 503, error: '服务器连不上 AI 服务' };
    if (e instanceof Anthropic.APIError) throw { status: 502, error: 'AI 服务出错（' + e.status + '）' };
    throw e;
  }
  if (res.stop_reason === 'refusal') throw { status: 422, error: 'AI 没有回答这个请求' };
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return { text, usage: res.usage, truncated: res.stop_reason === 'max_tokens' };
}

/* 自由提问（AI 助手面板） */
async function ask(S, uid, q, history) {
  const view = TM.viewFor(S, uid);
  const system = [
    { type: 'text', text: BASE + kbBlock(view, uid, S), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: snapshot(view, uid) }
  ];
  const msgs = [];
  (Array.isArray(history) ? history : []).slice(-8).forEach(h => { if (h && (h.role === 'user' || h.role === 'assistant') && h.text) msgs.push({ role: h.role, content: String(h.text).slice(0, 4000) }); });
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  msgs.push({ role: 'user', content: String(q).slice(0, 4000) });
  return call({ system, messages: msgs, effort: 'medium', maxTokens: 8000 });
}

/* 老板口述 → 分类规则（结构化输出） */
const KB_SECS = { decide: '我怎么做决定', people: '用人', money: '钱和预算', public: '对外发布与品牌', team: '团队相处', why: '方向与初心', other: '其他原则', quote: '我常说的话' };
const KB_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'secs'],
  properties: {
    title: { type: 'string', description: '资料标题，以「老板口述：」开头，40 字以内' },
    secs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'items'], properties: {
      key: { type: 'string', enum: Object.keys(KB_SECS) },
      items: { type: 'array', items: { type: 'string' } } } } }
  }
};
async function kbOrganize(S, uid, topic, text) {
  const system = [{ type: 'text', text: `你把老板的口述录音整理成团队可执行的规则条目。
要求：
- 去掉口头语（嗯、那个、就是说）、重复和跑题内容，每条一句完整的话，保留老板的原意和具体数字，不添加原文没有的内容。
- 按主题归类：decide=怎么做决定，people=用人，money=钱和预算，public=对外发布与品牌，team=团队相处，why=方向与初心，quote=老板常说的话（用「原话」——意思 的格式），other=其他。
- 没法归类的放进${topic && KB_SECS[topic] ? ' ' + topic + '（老板选择的主题）' : ' other'}。
- 只输出有内容的分类。` }];
  const r = await call({ system, messages: [{ role: 'user', content: String(text).slice(0, 20000) }], schema: KB_SCHEMA, effort: 'low', maxTokens: 8000 });
  let o; try { o = JSON.parse(r.text); } catch (e) { throw { status: 502, error: 'AI 返回的格式不对，请重试' }; }
  const secs = (o.secs || []).filter(x => KB_SECS[x.key] && x.items && x.items.length).map(x => ({ key: x.key, name: KB_SECS[x.key], items: x.items.map(String).filter(Boolean) }));
  return { title: String(o.title || '老板口述').slice(0, 40), secs, count: secs.reduce((n, x) => n + x.items.length, 0), usage: r.usage };
}

/* 想法整理稿（后台自动）：和规则版同样的字段，服务器以系统身份写回 */
const ANALYSIS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'summary', 'background', 'problem', 'goal', 'overview', 'issues', 'directions', 'category', 'relation_to_direction', 'open_questions', 'exception_flags', 'suggested_route', 'suggested_tasks', 'confidence'],
  properties: {
    title: { type: 'string', description: '一眼能看出是什么事的标题，20 字以内，不要照抄原文开头' },
    summary: { type: 'string', description: '一句话摘要，60 字以内' },
    background: { type: 'string' }, problem: { type: 'string' }, goal: { type: 'string', description: '要达成的结果，可验收' },
    overview: { type: 'string', description: '核心概述，2–3 句' },
    issues: { type: 'array', items: { type: 'string' }, description: '目前的问题或没说清楚的地方，最多 5 条' },
    directions: { type: 'array', items: { type: 'string' }, description: '推进的步骤或方向，最多 5 条' },
    category: { type: 'string', enum: ['admin', 'product', 'other'], description: 'admin=行政事务，product=产品开发，other=其他' },
    relation_to_direction: { type: 'string', description: '和公司方向、老板资料的关系；没有就说没有' },
    open_questions: { type: 'array', items: { type: 'string' }, description: '需要发起人补充的问题' },
    exception_flags: { type: 'array', items: { type: 'string', enum: ['strategy_change', 'over_budget', 'personnel', 'major_release'] }, description: '需要老板决策的例外：战略调整、超预算、人事、重要对外发布' },
    suggested_route: { type: 'string', enum: ['operator_direct', 'to_lead', 'to_owner'], description: '有例外送老板；产品开发交负责人；其余运营直接派发' },
    suggested_tasks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'expected_output', 'acceptance_criteria', 'suggested_due_days'], properties: { title: { type: 'string' }, expected_output: { type: 'string' }, acceptance_criteria: { type: 'string' }, suggested_due_days: { type: 'integer' } } } },
    confidence: { type: 'number' }
  }
};
async function analyzeIdea(S, ideaId) {
  const d = S.ideas.find(x => x.id === ideaId); if (!d) throw { status: 404, error: '想法不存在' };
  const owner = TM.usersWith(S, 'owner')[0];
  // 整理稿会给想法的所有查看者看：只用公开给团队的资料，不能带出「仅 AI 可见」的老板资料
  const view = Object.assign({}, TM.viewFor(S, owner)); view.knowledge = (view.knowledge || []).filter(k => k.scope === 'team');
  const L = TM.L;
  const system = [
    { type: 'text', text: `你是团队协同 App 的 AI 助理，负责把成员提交的想法整理成清楚的「整理稿」，交给运营者跟进、老板决策。
要求：用简体中文；忠于原文，不编造人名、金额、日期；原文没说的写进 open_questions；预算超过 ${S.settings.budgetThreshold || '（未设置）'} 元算 over_budget。
团队成员：${S.users.map(u => u.name + '（' + u.roles.map(r => L.role[r.role]).join('、') + '）').join('，')}。
公司方向：${S.settings.direction || '（未填写）'}` + kbBlock(view, owner, S), cache_control: { type: 'ephemeral' } }
  ];
  const media = (d.media || []).map(m => m.name).filter(Boolean).join('、');
  const msg = `想法标题：${d.title || '（无）'}\n发起人：${TM.name(S, d.creatorId)}\n标签：${(d.tags || []).join('、') || '无'}\n附件：${media || '无'}\n原文：\n${String(d.note || '').slice(0, 8000)}`;
  const r = await call({ system, messages: [{ role: 'user', content: msg }], schema: ANALYSIS_SCHEMA, effort: 'medium', maxTokens: 8000 });
  let o; try { o = JSON.parse(r.text); } catch (e) { throw { status: 502, error: 'AI 返回的格式不对' }; }
  return { payload: o, usage: r.usage };
}

/* 老板决策建议（按需）：只是建议，决定由老板做 */
const ADVICE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['verdict', 'label', 'reasons', 'risks', 'checks', 'note'],
  properties: {
    verdict: { type: 'string', enum: ['approved', 'needs_info', 'rejected'] },
    label: { type: 'string', description: '一句话结论，例如「建议有条件批准」，12 字以内' },
    reasons: { type: 'array', items: { type: 'string' }, description: '理由，2–4 条，引用原文或资料里的事实' },
    risks: { type: 'array', items: { type: 'string' }, description: '要注意的风险，1–3 条' },
    checks: { type: 'array', items: { type: 'string' }, description: '老板拍板前需要确认的问题，2–4 条' },
    note: { type: 'string', description: '可以直接用的批语，口吻是老板对团队说话，60 字以内' }
  }
};
async function adviseDecision(S, decisionId) {
  const dc = S.decisions.find(x => x.id === decisionId); if (!dc) throw { status: 404, error: '决策不存在' };
  const owner = TM.usersWith(S, 'owner')[0], view = TM.viewFor(S, owner), L = TM.L;
  const d = dc.ideaId ? S.ideas.find(x => x.id === dc.ideaId) : null;
  const sm = d ? TM.latestSummary(S, d.id, 'analysis') : null;
  const disc = d ? S.suggestions.filter(x => x.ideaId === d.id).map(x => '- ' + TM.name(S, x.authorId) + '：' + String(x.body).slice(0, 300)).join('\n') : '';
  const system = [
    { type: 'text', text: BASE + `\n这次的任务：给老板一份决策建议。只是建议，决定由老板做；依据老板自己的资料和原则判断，信息不够就建议先补充。` + kbBlock(view, owner, S), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: snapshot(view, owner) }
  ];
  const msg = `需要老板决策：${dc.question}\n类型：${L.decision[dc.kind] || dc.kind}\n上报人：${TM.name(S, dc.requestedBy)}\n超预算阈值：${S.settings.budgetThreshold || '未设置'} 元` +
    (d ? `\n\n想法：${d.title || ''}\n原文：${String(d.note || '').slice(0, 6000)}` : '') +
    (sm ? `\n\n整理稿：${JSON.stringify({ overview: sm.payload.overview, goal: sm.payload.goal, issues: sm.payload.issues, open_questions: sm.payload.open_questions })}` : '') +
    (disc ? `\n\n团队讨论：\n${disc}` : '');
  const r = await call({ system, messages: [{ role: 'user', content: msg }], schema: ADVICE_SCHEMA, effort: 'high', maxTokens: 8000 });
  let o; try { o = JSON.parse(r.text); } catch (e) { throw { status: 502, error: 'AI 返回的格式不对' }; }
  return { advice: o, usage: r.usage };
}

/* 讨论总结（后台自动，只给老板看） */
const PT = { type: 'object', additionalProperties: false, required: ['point', 'who'], properties: { point: { type: 'string' }, who: { type: 'array', items: { type: 'string' }, description: '提出人的姓名' } } };
const DIGEST_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['people', 'consensus', 'divergences', 'risks', 'questions', 'next'],
  properties: {
    people: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'points'], properties: { name: { type: 'string' }, points: { type: 'array', items: { type: 'string' } } } }, description: '每个人的主要观点' },
    consensus: { type: 'array', items: PT }, risks: { type: 'array', items: PT }, questions: { type: 'array', items: PT },
    divergences: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['point', 'sides'], properties: { point: { type: 'string' }, sides: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['view', 'who'], properties: { view: { type: 'string' }, who: { type: 'array', items: { type: 'string' } } } } } } } },
    next: { type: 'array', items: { type: 'string' }, description: '建议老板的下一步，2–4 条' }
  }
};
async function digestDiscussion(S, ideaId) {
  const d = S.ideas.find(x => x.id === ideaId); if (!d) throw { status: 404, error: '想法不存在' };
  const sug = S.suggestions.filter(x => x.ideaId === d.id).sort((a, b) => a.at - b.at);
  const byId = Object.fromEntries(sug.map(x => [x.id, x]));
  const lines = sug.map(x => '- ' + TM.name(S, x.authorId) + (x.replyTo && byId[x.replyTo] ? '（回复 ' + TM.name(S, byId[x.replyTo].authorId) + '）' : '') + '：' + String(x.body).slice(0, 500)).join('\n');
  const system = [{ type: 'text', text: `你把团队对一个想法的讨论总结给老板看。用简体中文；忠于原话，不替任何人加观点；who 只填讨论里出现过的人名；分歧要写清各方立场。` }];
  const r = await call({ system, messages: [{ role: 'user', content: `想法：${d.title || ''}\n原文：${String(d.note || '').slice(0, 3000)}\n\n讨论（按时间）：\n${lines}` }], schema: DIGEST_SCHEMA, effort: 'medium', maxTokens: 8000 });
  let o; try { o = JSON.parse(r.text); } catch (e) { throw { status: 502, error: 'AI 返回的格式不对' }; }
  return { payload: o, usage: r.usage };
}

/* 新建项目：把一段口述 / 文字解析成项目草稿（老板核对后再建） */
async function parseProject(S, uid, text) {
  const L = TM.L, PT = TM.PTYPE;
  const schema = {
    type: 'object', additionalProperties: false, required: ['title', 'summary', 'ptype', 'lead', 'tasks', 'people', 'tags'],
    properties: {
      title: { type: 'string', description: '项目名称，20 字以内' },
      summary: { type: 'string', description: '项目概要：背景、要解决的问题、目标，3–5 句' },
      ptype: { type: 'string', enum: Object.keys(PT), description: Object.keys(PT).map(k => k + '=' + PT[k][0]).join('，') },
      lead: { type: 'string', description: '项目负责人的姓名（必须是团队成员；没提到就留空）' },
      tasks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'owner', 'expected', 'criteria'], properties: { title: { type: 'string' }, owner: { type: 'string', description: '执行人姓名，没提到留空' }, expected: { type: 'string', description: '预期成果' }, criteria: { type: 'string', description: '验收标准' } } }, description: '首批任务，最多 6 个' },
      people: { type: 'array', items: { type: 'string' }, description: '提到的团队成员姓名' },
      tags: { type: 'array', items: { type: 'string' }, description: '2–4 个关键词' }
    }
  };
  const team = S.users.map(u => u.name + '（' + (u.title || '') + '；' + u.roles.map(r => L.role[r.role]).join('、') + '；' + (u.group || '') + '）').join('，');
  const system = [{ type: 'text', text: `你把老板口述或贴进来的一段话，整理成一个可以直接创建的项目草稿。用简体中文；不编造原文没有的事实；人名只用团队成员里的。\n团队成员：${team}` }];
  const r = await call({ system, messages: [{ role: 'user', content: String(text).slice(0, 12000) }], schema, effort: 'medium', maxTokens: 8000 });
  let o; try { o = JSON.parse(r.text); } catch (e) { throw { status: 502, error: 'AI 返回的格式不对' }; }
  const id = (n) => { const u = S.users.find(x => x.name === String(n || '').trim()); return u ? u.id : ''; };
  return {
    title: String(o.title || '').slice(0, 50), summary: String(o.summary || '').slice(0, 1000), ptype: PT[o.ptype] ? o.ptype : 'other', leadId: id(o.lead),
    tasks: (o.tasks || []).slice(0, 6).map(t => ({ title: String(t.title || '').slice(0, 50), ownerId: id(t.owner), expected: String(t.expected || '').slice(0, 100), criteria: String(t.criteria || '').slice(0, 100) })).filter(t => t.title),
    people: [...new Set((o.people || []).map(id).filter(Boolean))], tags: (o.tags || []).map(x => String(x).slice(0, 8)).slice(0, 4), usage: r.usage
  };
}

/* 新建项目的小帮手：整理描述 / 拟写目标（只用这个项目自己的文字，不带团队数据，省 token） */
async function writeHelper(kind, title, note, due) {
  const sys = kind === 'goal'
    ? '根据项目名称和描述，拟一句可以验收的项目目标：做成什么样、到什么时候、怎么算完成。60 字以内，只输出这一句。'
    : '把项目描述整理成四段，格式严格是：\n【背景】…\n【要解决的问题】…\n【目标】…\n【关键要点】…\n忠于原文，原文没说的写「待补充」，总共不超过 400 字，只输出这四段。';
  const r = await call({ system: [{ type: 'text', text: sys }], messages: [{ role: 'user', content: `项目名称：${String(title || '').slice(0, 50)}\n截止：${due || '未定'}\n描述：${String(note || '').slice(0, 2000)}` }], effort: 'low', maxTokens: 2000 });
  return { text: r.text.trim().slice(0, kind === 'goal' ? 200 : 500), usage: r.usage };
}

/* 一段话 → 待办（日期、时间、优先级、相关人） */
const TAGS = ['工作', '沟通', '会议', '数据', '事工', '运维', '学习'];
async function parseTodos(S, uid, text) {
  const today = TM.todayStr(S), wd = '日一二三四五六'[new Date(today + 'T00:00:00').getDay()];
  const schema = { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'date', 'time', 'priority', 'people', 'tag'], properties: {
    title: { type: 'string', description: '去掉时间词后的待办内容，20 字以内' }, date: { type: 'string', description: 'YYYY-MM-DD；没说日期就是今天' }, time: { type: 'string', description: 'HH:MM，24 小时制；没说就留空' },
    priority: { type: 'string', enum: ['hi', 'mid', 'lo'], description: '紧急 / 重要为 hi，不急为 lo' }, people: { type: 'array', items: { type: 'string' }, description: '提到的团队成员姓名' }, tag: { type: 'string', enum: TAGS } } } } } };
  const others = S.users.filter(u => u.id !== uid).map(u => u.name).join('、');
  const r = await call({ system: [{ type: 'text', text: `你把一段话拆成待办清单。今天是 ${today}（星期${wd}）。「周五」指本周或下一个周五；「下周一」指下周的周一。每件事一条，最多 8 条；不编造原文没有的事。团队成员：${others}` }], messages: [{ role: 'user', content: String(text).slice(0, 4000) }], schema, effort: 'low', maxTokens: 4000 });
  let o; try { o = JSON.parse(r.text); } catch (e) { throw { status: 502, error: 'AI 返回的格式不对' }; }
  const byName = (n) => { const u = S.users.find(x => x.name === String(n || '').trim() && x.id !== uid); return u ? u.id : null; };
  const items = (o.items || []).slice(0, 8).map(x => {
    const people = [...new Set((x.people || []).map(byName).filter(Boolean))];
    return { title: String(x.title || '').slice(0, 50), date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : today, time: /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) ? x.time : '', priority: ['hi', 'mid', 'lo'].includes(x.priority) ? x.priority : 'mid', people, tags: [TAGS.includes(x.tag) ? x.tag : '工作'], scope: people.length ? 'team' : 'mine', on: true };
  }).filter(x => x.title);
  return { items, usage: r.usage };
}

/* PDF → Markdown（知识库上传 PDF）：Claude 读文档，整理出正文 */
async function pdfToMarkdown(base64, name) {
  const r = await call({
    system: [{ type: 'text', text: '你把上传的 PDF 文档的正文整理成 Markdown，存进团队的知识库。保留标题层级（#、##）、列表和要点；去掉页眉页脚、页码、目录；不总结、不改写、不加评论，只整理原文。' }],
    messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 }, title: String(name || '').slice(0, 100) }, { type: 'text', text: '请输出这份文档整理后的 Markdown 正文。' }] }],
    effort: 'low', maxTokens: 16000
  });
  return { text: r.text, truncated: r.truncated, usage: r.usage };
}

module.exports = { enabled, allowed, ask, kbOrganize, analyzeIdea, adviseDecision, digestDiscussion, parseProject, parseTodos, writeHelper, pdfToMarkdown, snapshot, MODEL, LIMIT, SYSTEM_LIMIT };
