// Run both offline browser suites with the same installed Chrome/Chromium.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const candidates = process.env.CHROME_BIN
  ? [process.env.CHROME_BIN]
  : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : process.platform === 'win32'
      ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
        .filter(Boolean).map(base => join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'))
      : ['google-chrome', 'chromium', 'chromium-browser'];

const chrome = candidates.find(binary => {
  const result = spawnSync(binary, ['--version'], { encoding: 'utf8', timeout: 10000 });
  return !result.error && result.status === 0;
});
if (!chrome) {
  console.error('找不到可執行的 Chrome／Chromium。請安裝瀏覽器或用 CHROME_BIN 指定執行檔；瀏覽器檢查未通過。');
  process.exit(1);
}
console.log(`Offline browser checks: ${chrome}`);
for (const script of ['check-layout.mjs', 'check-reading-ux.mjs']) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', script)], {
    cwd: root,
    env: { ...process.env, CHROME_BIN: chrome },
    stdio: 'inherit',
    timeout: 180000,
  });
  if (result.error || result.signal || result.status !== 0) {
    console.error(`${script} 未通過：${result.error?.message || result.signal || `exit ${result.status}`}`);
    process.exit(result.status || 1);
  }
}
