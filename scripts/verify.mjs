import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, relative, extname } from 'node:path';
import { getCopyText } from '../lib/prompts.mjs';
import { escapeHtml } from '../lib/markdown.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const read = path => readFile(path, 'utf8');
const run = promisify(execFile);
const git = async args => (await run('git', args, { cwd: root, encoding: 'utf8' })).stdout;
const data = JSON.parse(await read(join(root, 'data/prompts.json')));
const published = JSON.parse(await read(join(dist, 'data.json')));
const entries = published.entries;
const forbiddenMedia = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico', '.mp4', '.webm', '.mov']);
const forbiddenDomains = ['so', 'site'].map(tld => ['notion', tld].join('.')).concat([['app', 'notion', 'com'].join('.')]);
const postPattern = /^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/;
let passed = 0;
async function check(name, fn) {
  await fn();
  console.log(`✓ ${name}`);
  passed++;
}
async function walk(directory) {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) files.push(...await walk(path));
    else {
      assert.ok(item.isFile(), `Unexpected symlink: ${path}`);
      files.push(path);
    }
  }
  return files;
}
const distFiles = await walk(dist);
const repoPaths = (await git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean);
const trackedPaths = (await git(['ls-files', '-z'])).split('\0').filter(Boolean);

await check('发布文件齐全，Cloudflare 安全标头正确', async () => {
  for (const file of ['index.html', 'tips.html', 'takedown.html', 'assets/site.css', 'assets/app.mjs', 'assets/prompts.mjs', 'assets/clipboard.mjs', 'assets/embeds.mjs', 'data.json', '_headers']) assert.ok((await stat(join(dist, file))).isFile(), file);
  const headers = await read(join(dist, '_headers'));
  assert.match(headers, /X-Content-Type-Options:\s*nosniff/);
  assert.match(headers, /Referrer-Policy:\s*strict-origin-when-cross-origin/);
});

await check('entries 恰好 63 条，数据原样发布，id 不重复', () => {
  assert.equal(data.count, 63);
  assert.equal(data.entries.length, 63);
  assert.equal(entries.length, 63);
  assert.deepEqual(entries, data.entries);
  assert.equal(new Set(entries.map(entry => String(entry.id))).size, 63);
  assert.equal(data.lengthThreshold, 1500);
  assert.equal(data.excerptLength, 300);
});

await check('每条必填字段完整，原帖只允许 X status 链接，无官方文档条目', () => {
  for (const entry of entries) {
    for (const field of ['id', 'title', 'description', 'author', 'authorUrl', 'postUrl']) assert.ok(typeof entry[field] === 'string' && entry[field].trim(), `${entry.id}: ${field}`);
    for (const field of ['models', 'tags']) assert.ok(Array.isArray(entry[field]) && entry[field].length && entry[field].every(value => typeof value === 'string' && value.trim()), `${entry.id}: ${field}`);
    assert.match(entry.postUrl, postPattern);
    assert.match(entry.authorUrl, /^https:\/\/x\.com\/[A-Za-z0-9_]+\/?$/);
  }
});

await check('短提示词不超过 1500 字，长提示词只含最多 300 字摘录，实际复制内容也不超过门槛', async () => {
  const home = await read(join(dist, 'index.html'));
  for (const entry of entries) {
    assert.ok(Number.isInteger(entry.promptLength) && entry.promptLength > 0, entry.id);
    assert.equal(entry.isLong, entry.promptLength > 1500, entry.id);
    if (entry.isLong) {
      assert.equal(entry.prompt, null, entry.id);
      assert.ok(typeof entry.promptExcerpt === 'string' && entry.promptExcerpt.length > 0 && entry.promptExcerpt.length <= 300, entry.id);
      assert.match(getCopyText(entry), /\n完整版：https:\/\/x\.com\//);
    } else {
      assert.ok(typeof entry.prompt === 'string' && entry.prompt.length > 0 && entry.prompt.length <= 1500, entry.id);
      assert.equal(entry.promptExcerpt, null, entry.id);
    }
    assert.ok(getCopyText(entry).length <= 1500, entry.id);
    const visibleText = escapeHtml(entry.isLong ? entry.promptExcerpt : entry.prompt);
    assert.ok(home.includes(`<pre class="prompt-text" tabindex="0">${visibleText}</pre>`), `${entry.id}: visible prompt differs`);
  }
});

await check('dist 与 Git 追踪／待追踪文件中无图片、影片或禁止域名', async () => {
  for (const path of new Set([...distFiles, ...repoPaths.map(path => join(root, path)), ...trackedPaths.map(path => join(root, path))])) {
    assert.ok(!forbiddenMedia.has(extname(path).toLowerCase()), `Forbidden media: ${relative(root, path)}`);
    const content = (await read(path)).toLowerCase();
    for (const domain of forbiddenDomains) assert.ok(!content.includes(domain), `Forbidden domain in ${relative(root, path)}`);
  }
});

await check('三个页面的页尾均含下架入口、48 小时、作者与版权说明，所有 X 外链均安全', async () => {
  for (const page of ['index.html', 'tips.html', 'takedown.html']) {
    const html = await read(join(dist, page));
    const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1];
    assert.ok(footer, `${page}: footer`);
    assert.match(footer, /href="takedown\.html"[^>]*>[^<]*48 小时内处理/);
    assert.match(footer, /href="https:\/\/x\.com\/punkcan"[^>]*>作者：@punkcan/);
    assert.match(footer, /提示词版权归原作者/);
    assert.match(footer, /影片以 X 官方嵌入显示，不转存/);
    for (const anchor of html.matchAll(/<a\b[^>]*href="https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)(?:\/|"|\?)[^>]*>/gi)) {
      assert.match(anchor[0], /target="_blank"/);
      assert.match(anchor[0], /rel="noopener noreferrer"/);
    }
  }
});

await check('仅首页载入唯一允许的第三方脚本，全部嵌入使用惰性模板与永久观看链接', async () => {
  let externalScripts = 0;
  for (const file of distFiles) {
    if (extname(file) !== '.html') continue;
    const html = await read(file);
    for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const src = script[1].match(/\bsrc="([^"]+)"/)?.[1];
      assert.ok(src, `${file}: inline script`);
      if (/^(?:https?:)?\/\//i.test(src)) {
        assert.equal(src, 'https://platform.twitter.com/widgets.js');
        assert.match(script[1], /\basync\b/);
        externalScripts++;
      } else assert.ok((await stat(join(dist, src))).isFile(), src);
    }
    assert.ok(!/\son\w+\s*=/i.test(html), `${file}: inline event handler`);
  }
  assert.equal(externalScripts, 1);
  const home = await read(join(dist, 'index.html'));
  assert.equal((home.match(/class="prompt-card"/g) || []).length, 63);
  assert.equal((home.match(/<template class="tweet-template"><blockquote class="twitter-tweet" data-dnt="true"/g) || []).length, 63);
  assert.equal((home.match(/class="watch-link"/g) || []).length, 63);
  assert.ok(!/<blockquote class="twitter-tweet"/.test(home.replace(/<template\b[^>]*>[\s\S]*?<\/template>/g, '')), 'Live blockquotes must start inside templates');
});

await check('下架入口与 issue 模板齐全，data/ 未修改', async () => {
  const html = await read(join(dist, 'takedown.html'));
  assert.match(html, /无需先证明身份/);
  assert.ok(html.includes('https://github.com/punkcanyang/fight-prompts/issues/new?template=takedown.md&amp;title=%E4%B8%8B%E6%9E%B6%E7%94%B3%E8%AF%B7'));
  const template = await read(join(root, '.github/ISSUE_TEMPLATE/takedown.md'));
  for (const field of ['原帖链接', '你的 X 账号', '说明']) assert.ok(template.includes(field));
  const changes = await git(['diff', 'HEAD', '--', 'data/']);
  assert.equal(changes, '', 'Read-only data/ was modified');
});

console.log(`\n${passed}/${passed} verification checks passed.`);
