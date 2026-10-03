// 编译 iOS App 并在模拟器启动（先 npm run build && npx cap copy ios；npm run ios 已包含）
// 用法：node scripts/ios.js [模拟器名称，默认 iPhone 18 Pro]
const { execSync } = require('child_process'), path = require('path');
const sh = (c, o) => execSync(c, { stdio: o || "pipe", encoding: "utf8", cwd: c.startsWith("xcodebuild") ? path.join(__dirname, "..", "ios", "App") : undefined });
const name = process.argv[2] || 'iPhone 18 Pro';
const list = JSON.parse(sh('xcrun simctl list devices available -j')).devices;
const dev = Object.values(list).flat().find(d => d.name === name) || Object.values(list).flat().find(d => /iPhone/.test(d.name));
if (!dev) { console.error('没有可用的 iPhone 模拟器'); process.exit(1); }
const proj = path.join(__dirname, '..', 'ios', 'App');
console.log('编译中…（' + dev.name + '）');
sh(`xcodebuild -project App.xcodeproj -scheme App -configuration Debug -destination 'platform=iOS Simulator,id=${dev.udid}' -derivedDataPath build CODE_SIGNING_ALLOWED=NO build -quiet`, ['ignore', 'ignore', 'inherit']);
try { sh(`xcrun simctl boot ${dev.udid}`); } catch (e) {}
try { sh('open "' + sh('xcode-select -p').trim() + '/Applications/Simulator.app"'); } catch (e) {}
sh(`xcrun simctl install ${dev.udid} "${path.join(proj, 'build/Build/Products/Debug-iphonesimulator/App.app')}"`);
sh(`xcrun simctl launch ${dev.udid} com.teamops.app`);
console.log('已在模拟器启动：' + dev.name);
