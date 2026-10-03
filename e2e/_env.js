// 端到端测试共用：被测页面 = dist/team-ops.html（先 npm run build）
const path = require('path'), { pathToFileURL } = require('url');
exports.URL = pathToFileURL(path.join(__dirname, '..', 'dist', 'team-ops.html')).href;
