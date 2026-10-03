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

module.exports = { enabled, allowed, ask, kbOrganize, snapshot, MODEL, LIMIT };
