const { chromium } = require('playwright');
const URL=(require('./_env').URL);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs=[]; p.on('pageerror', e => errs.push(e.message)); let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('✗',m));};
  await p.goto(URL); await p.evaluate(()=>{localStorage.clear();localStorage.setItem('tm_user_v3','u_owner');}); await p.reload();
  await p.goto(URL+'#/me'); await p.waitForTimeout(200); ok(await p.locator('.me-kb').count()===1, '我的页有 AI 知识库入口');
  await p.click('.me-kb'); await p.waitForTimeout(200); ok((await p.textContent('main')).includes('AI 会参考这里的资料') && await p.locator('.kb-row').count()===2, '知识库页 + 两份示例');
  await p.setInputFiles('[data-kbfile]', {name:'老板谈招聘.md', mimeType:'text/markdown', buffer:Buffer.from('# 招聘\n- 开发岗位优先招全栈，前端后端都能做的人。\n- 新人先兼职试用三个月再转正。')}); await p.waitForTimeout(400);
  ok(await p.locator('.kb-row').count()===3 && (await p.textContent('main')).includes('老板谈招聘'), '上传 MD 文件');
  await p.fill('#kbq','明年要不要招两个开发'); await p.click('[data-do=kbAsk]'); await p.waitForTimeout(150);
  ok(await p.locator('.kb-ref').count()>=1, '试一试命中引用');
  await p.click('.kb-row:has-text("老板谈招聘") a'); await p.waitForTimeout(150); ok((await p.textContent('.kb-md')).includes('全栈'), '资料详情渲染 Markdown');
  await p.click('[data-do=kbToggle]'); await p.waitForTimeout(150); ok((await p.textContent('.kb-tag')).includes('已停用'), '停用');
  await p.click('[data-do=kbToggle]'); await p.waitForTimeout(150);
  await p.goto(URL+'#/kb'); await p.click('[data-do=kbNew]'); await p.fill('.sheet input[name=title]','老板谈团队'); await p.fill('.sheet textarea[name=body]','团队要彼此配搭，批评对事不对人，凡事凭爱心而做。'); await p.click('.sheet footer button[type=submit]'); await p.waitForTimeout(150);
  ok(await p.locator('.kb-row').count()===4, '直接写资料');
  await p.goto(URL+'#/idea/I4'); await p.waitForTimeout(150); await p.click('.ix2-adv [data-do=ixFold]'); ok(true,'');
  await p.goto(URL+'#/me'); await p.evaluate(()=>localStorage.setItem('tm_user_v3','u_design')); await p.reload(); await p.goto(URL+'#/kb'); await p.waitForTimeout(150);
  ok(!(await p.locator('[data-kbfile]').count()) && !(await p.locator('.kb-row .ix2-eye').count()), '执行者只能查看');
  await p.evaluate(()=>localStorage.setItem('tm_user_v3','u_owner')); await p.reload(); await p.goto(URL+'#/kb'); await p.click('[data-do=kbNew]'); await p.click('.sheet [data-do=kbTpl]'); ok((await p.inputValue('.sheet textarea[name=body]')).includes('## 我怎么做决定') && await p.isChecked('.sheet input[name=scope][value=ai_only]'), '模板填入且默认仅 AI 参考');
  // Word 文档：在手机上解析成 Markdown（标题、列表）
  await p.goto(URL+'#/kb'); await p.waitForTimeout(150);
  await p.setInputFiles('[data-kbfile]', require('path').join(__dirname,'fixtures','rules.docx')); await p.waitForTimeout(600);
  const wd = await p.evaluate(()=>{ const k = window.__tm.S.knowledge.find(x=>x.title==='rules'); return k && k.body; });
  ok(wd && wd.includes('# 团队做事原则') && wd.includes('## 花钱') && wd.includes('- 单笔超过五千元要先问老板') && wd.includes('试点两周'), '上传 Word 转成 Markdown：' + JSON.stringify(wd||'').slice(0,80));
  ok(!errs.length,'无脚本错误 '+errs.join(';')); console.log('知识库 E2E 通过',pass,'失败',fail); await b.close();
})();
