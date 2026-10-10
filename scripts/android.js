// 生成安卓正式版 APK：构建网页 → 同步进安卓工程 → 编译签名的 release → 复制到桌面「WXS OS.apk」
// → 放到本机团队服务器的数据目录（DATA_DIR/app/），同事的 App 会提示有新版本，扫码页也能下载。
// 用法：npm run android [-- "这次更新的说明"]   （发新版前先把 android/app/build.gradle 里的 versionCode 加 1）
const { execSync } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..'), AND = path.join(ROOT, 'android');
const run = (c, cwd) => execSync(c, { cwd: cwd || ROOT, stdio: 'inherit', env: { ...process.env, JAVA_HOME: execSync('/usr/libexec/java_home -v 21').toString().trim(), ANDROID_HOME: process.env.ANDROID_HOME || path.join(os.homedir(), 'Library/Android/sdk') } });
const g = fs.readFileSync(path.join(AND, 'app/build.gradle'), 'utf8');
const versionCode = +(g.match(/versionCode\s+(\d+)/) || [])[1], versionName = (g.match(/versionName\s+"([^"]+)"/) || [])[1];
run('node build.js'); run('npx cap sync android');
run('./gradlew assembleRelease -q', AND);
const apk = path.join(AND, 'app/build/outputs/apk/release/app-release.apk');
const desk = path.join(os.homedir(), 'Desktop', 'WXS OS.apk'); fs.copyFileSync(apk, desk);
console.log(`已生成：桌面/WXS OS.apk（${versionName}，versionCode ${versionCode}）`);
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'server', 'data'));
if (fs.existsSync(DATA)) {
  const dir = path.join(DATA, 'app'); fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(apk, path.join(dir, 'teamops.apk'));
  fs.writeFileSync(path.join(dir, 'android.json'), JSON.stringify({ versionName, versionCode, at: Date.now(), notes: process.argv.slice(2).join(' ') }, null, 1));
  console.log('已放到团队服务器（' + dir + '）：同事打开 App 会提示更新；安装页 <服务器地址>/app');
}
