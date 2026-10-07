const fs=require('fs'),path=require('path');
// 旧版安卓 WebView（Chrome 87 以前，例如没更新过的 Android 11）不认识 inset 简写：在它前面补上 top/right/bottom/left
function cssCompat(css){return css.replace(/(^|[;{\s])inset:([^;}!]+)(!important)?/g,(m,pre,v,imp)=>{const p=v.trim().split(/\s+/);if(p.some(x=>x.includes('(')))return m;const [t,r=t,b=t,l=r]=p,i=imp||'';return pre+`top:${t}${i};right:${r}${i};bottom:${b}${i};left:${l}${i};inset:${v}${i}`;});}
process.chdir(__dirname);
// 界面代码在 app/ 目录，按文件名顺序拼进同一个闭包（各文件共享变量，和以前的单个 app.js 完全一样）
const APP_PARTS = fs.readdirSync('app').filter(f => /^\d\d_.*\.js$/.test(f)).sort();
if (!APP_PARTS.length) { console.error('app/ 目录里没有界面代码'); process.exit(1); }
const APP_SRC = '(function () {\n' + APP_PARTS.map(f => fs.readFileSync(path.join('app', f), 'utf8').replace(/\s*$/, '\n')).join('') + '})();\n';
// 同名函数会被后定义的悄悄覆盖（曾因此把 W(id) 覆盖掉）：构建时直接拦下，并说明在哪个文件
{ const seen = {}, dup = [];
  APP_PARTS.forEach(f => { for (const m of fs.readFileSync(path.join('app', f), 'utf8').matchAll(/^\s*function ([A-Za-z_$][\w$]*)\s*\(/gm)) { if (seen[m[1]]) dup.push(m[1] + '（' + seen[m[1]] + ' 和 ' + f + '）'); else seen[m[1]] = f; } });
  if (dup.length) { console.error('app/ 有同名函数（后定义的会覆盖前面的）：' + [...new Set(dup)].join('、')); process.exit(1); }
  // 每个文件都不该自己再包一层闭包（变量会被隔开，别的文件就用不到了）
  APP_PARTS.forEach(f => { if (/^\s*\(function\s*\(\)\s*\{/m.test(fs.readFileSync(path.join('app', f), 'utf8').split('\n').slice(0, 3).join('\n'))) { console.error('app/' + f + ' 自己包了一层 function，去掉'); process.exit(1); } }); }
// DO.xxx = ... 写在 `var DO =` 之前，加载时就会报错、整个 App 打不开（发生过两次）：构建时拦下
{ const def = APP_SRC.search(/^\s*var DO\s*=/m), early = [...APP_SRC.slice(0, def).matchAll(/^\s*DO\.(\w+)\s*=/gm)].map(m => m[1]);
  if (def < 0 || early.length) { console.error('app/ 在 var DO 定义之前给 DO 赋值：' + early.join('、')); process.exit(1); } }
const OUT=process.env.OUT_DIR?path.resolve(process.env.OUT_DIR):path.join(__dirname,'dist');
let h=fs.readFileSync('shell.html','utf8');
const hero='data:image/jpeg;base64,'+fs.readFileSync('img/hero.jpg').toString('base64');
const homebg='data:image/jpeg;base64,'+fs.readFileSync('img/homebg.jpg').toString('base64');
h=h.replace('/*__FONTS__*/',()=>fs.readFileSync('fonts/fonts.css','utf8').replace(/__FONT_(\w+)__/g,(m,k)=>'data:font/woff2;base64,'+fs.readFileSync('fonts/'+k+'.woff2').toString('base64'))).replace('/*__NATIVE__*/',()=>fs.readFileSync('node_modules/@capacitor/core/dist/capacitor.js','utf8').replace(/\/\/# sourceMappingURL=.*$/m,'')+'\n'+fs.readFileSync('node_modules/qrcode-generator/qrcode.js','utf8')+'\n'+fs.readFileSync('native.js','utf8')).replace('/*__CSS__*/',()=>cssCompat(fs.readFileSync('style.css','utf8')).replace(/__IT_(\w+)__/g,(m,k)=>'data:image/jpeg;base64,'+fs.readFileSync('img/it_'+k+'.jpg').toString('base64')).split('__HERO__').join(hero).split('__HOMEBG__').join(homebg).split('__PT_product__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_product.jpg').toString('base64')).split('__PT_ops__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_ops.jpg').toString('base64')).split('__PT_market__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_market.jpg').toString('base64')).split('__PT_admin__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_admin.jpg').toString('base64')).split('__PT_content__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_content.jpg').toString('base64')).split('__PT_event__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_event.jpg').toString('base64')).split('__PT_research__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_research.jpg').toString('base64')).split('__PT_training__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_training.jpg').toString('base64')).split('__PT_mission__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_mission.jpg').toString('base64')).split('__PT_care__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_care.jpg').toString('base64')).split('__PT_finance__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_finance.jpg').toString('base64')).split('__PT_tech__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_tech.jpg').toString('base64')).split('__PT_media__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_media.jpg').toString('base64')).split('__PT_worship__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_worship.jpg').toString('base64')).split('__PT_hr__').join('data:image/jpeg;base64,'+fs.readFileSync('img/pt_hr.jpg').toString('base64')).split('__WC_desk__').join('data:image/jpeg;base64,'+fs.readFileSync('img/wc_desk.jpg').toString('base64')).split('__WC_lake__').join('data:image/jpeg;base64,'+fs.readFileSync('img/wc_lake.jpg').toString('base64')).split('__PROJHERO__').join('data:image/jpeg;base64,'+fs.readFileSync('img/proj_hero.jpg').toString('base64')).split('__G4_voice__').join('data:image/jpeg;base64,'+fs.readFileSync('img/g4_voice.jpg').toString('base64')).split('__G4_video__').join('data:image/jpeg;base64,'+fs.readFileSync('img/g4_video.jpg').toString('base64')).split('__G4_text__').join('data:image/jpeg;base64,'+fs.readFileSync('img/g4_text.jpg').toString('base64')).split('__G4_ai__').join('data:image/jpeg;base64,'+fs.readFileSync('img/g4_ai.jpg').toString('base64')).split('__G4_file__').join('data:image/jpeg;base64,'+fs.readFileSync('img/g4_file.jpg').toString('base64'))).replace('/*__ENGINE__*/',()=>fs.readFileSync('engine.js','utf8')).replace('/*__SYNC__*/',()=>fs.readFileSync('sync.js','utf8')).replace('/*__APP__*/',()=>APP_SRC.replace('__ENOS__','data:image/jpeg;base64,'+fs.readFileSync('img/enos.jpg').toString('base64')));
fs.mkdirSync(OUT,{recursive:true});
fs.writeFileSync(path.join(OUT,'team-ops.html'),h);
fs.writeFileSync(path.join(OUT,'index.html'),h); // Netlify 拖拽部署用
fs.mkdirSync(path.join(OUT,'app'),{recursive:true});
fs.writeFileSync(path.join(OUT,'app','index.html'),h); // Capacitor webDir（iOS/Android App）
// syntax check every inline script
const scripts=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
scripts.forEach((s,i)=>{ new Function(s); });
console.log('built',h.length,'bytes, scripts ok:',scripts.length);
