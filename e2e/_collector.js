// 设备爬虫（device_ios.js / device_android.js）共用：本机起一个 HTTP 服务，提供 inpage_crawl.js，并接收它发回的结果
const http = require('http'), fs = require('fs'), path = require('path');
module.exports = function collector(onReady) {
  const st = { bad: [], last: Date.now(), total: 0, finished: null };
  const srv = http.createServer((q, s) => {
    s.setHeader('Access-Control-Allow-Origin', '*');
    if (q.method === 'GET' && q.url.startsWith('/crawl.js')) { s.setHeader('Content-Type', 'text/javascript'); return s.end(fs.readFileSync(path.join(__dirname, 'inpage_crawl.js'))); }
    let b = ''; q.on('data', c => b += c); q.on('end', () => {
      st.last = Date.now(); let o = {}; try { o = JSON.parse(b || '{}'); } catch (e) {}
      if (q.url === '/r') {
        if (o.ok === false) st.bad.push(`${o.who} ${o.r} 点「${o.d}」：${(o.errs || []).join(' | ').slice(0, 240)}`);
        if (o.n) st.total = o.n;
        process.stdout.write(o.role ? ` ${o.role}✓` : o.ok === false ? 'x' : '.');
      }
      if (q.url === '/done') st.finished = o;
      s.end('ok');
    });
  });
  srv.listen(0, '127.0.0.1', () => onReady(srv.address().port, st, srv));
};
