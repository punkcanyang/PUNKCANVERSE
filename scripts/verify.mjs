import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, relative, extname } from 'node:path';
import { getCopyText } from '../lib/prompts.mjs';
import { escapeHtml } from '../lib/markdown.mjs';
import { validatePostMetadata } from '../lib/posts.mjs';
import { validateAffiliates, AFFILIATE_DISCLOSURE, renderAffiliates } from '../lib/affiliates.mjs';
import { validateSite, newsletterUrl } from '../lib/newsletter.mjs';
import { validateMedia, availableMedia } from '../lib/media.mjs';
import { validateRegions, validateRegionText, REGION_DISCLAIMER } from '../lib/regions.mjs';
import { withMediumBaseline } from '../lib/data-migration.mjs';
import { verifyV03 } from './verify-v03.mjs';
import { GA_SCRIPT_URL, CONSENT_BOOTSTRAP, GA_CONFIG, verifyAnalyticsHtml } from '../lib/analytics.mjs';
import { loadEssays } from '../lib/essays.mjs';
import { SITE_PAGES } from '../lib/site-pages.mjs';
import { promptPath, MEDIUM_NAMES } from '../lib/media-tabs.mjs';
import { pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const read = path => readFile(path, 'utf8');
const run = promisify(execFile);
const git = async args => (await run('git', args, { cwd: root, encoding: 'utf8' })).stdout;
const data = JSON.parse(await read(join(root, 'data/prompts.json')));
const published = JSON.parse(await read(join(dist, 'data.json')));
const entries = published.entries;
const affiliates = JSON.parse(await read(join(root, 'data/affiliates.json')));
const site = JSON.parse(await read(join(root, 'data/site.json')));
const regionsRaw = await read(join(root, 'data/regions.json'));
const regions = JSON.parse(regionsRaw);
// The three new v0.2 files are validated below; the pre-existing data stays
// protected by the original path checks and exact baseline comparison.
const protectedDataPaths = ['data/', ':(exclude)data/affiliates.json', ':(exclude)data/regions.json', ':(exclude)data/site.json'];
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
await check('每个 HTML 都含指定 GA4 ID、先行 denied 默认值与 Cookie 设置入口', async () => {
  for (const file of distFiles.filter(path => extname(path) === '.html')) verifyAnalyticsHtml(await read(file));
});
await verifyV03(root);

await check('发布文件齐全，Cloudflare 安全标头正确', async () => {
  for (const file of ['index.html', 'tips.html', 'takedown.html', 'assets/site.css', 'assets/app.mjs', 'assets/prompts.mjs', 'assets/clipboard.mjs', 'assets/embeds.mjs', 'data.json', '_headers', 'sitemap.xml', 'robots.txt']) assert.ok((await stat(join(dist, file))).isFile(), file);
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
    validatePostMetadata(entry);
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

await check('每页仅预载指定 GA4，内联脚本严格匹配同意模板，X 嵌入按需载入', async () => {
  let externalScripts = 0;
  for (const file of distFiles) {
    if (extname(file) !== '.html') continue;
    const html = await read(file);
    for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const src = script[1].match(/\bsrc="([^"]+)"/)?.[1];
      if (!src) {
        assert.ok([CONSENT_BOOTSTRAP, GA_CONFIG].includes(script[2]), `${file}: unapproved inline script`);
        continue;
      }
      assert.ok(src, `${file}: inline script`);
      if (/^(?:https?:)?\/\//i.test(src)) {
        assert.equal(src, GA_SCRIPT_URL);
        assert.match(script[1], /\basync\b/);
        externalScripts++;
      } else assert.ok((await stat(join(dist, src))).isFile(), src);
    }
    assert.ok(!/\son\w+\s*=/i.test(html), `${file}: inline event handler`);
  }
  assert.equal(externalScripts, distFiles.filter(path => extname(path) === '.html').length);
  const home = await read(join(dist, 'index.html'));
  assert.equal((home.match(/class="prompt-card"/g) || []).length, 63);
  const availableCount = entries.filter(entry => !['removed', 'sensitive'].includes(entry.postStatus)).length;
  assert.equal((home.match(/<template class="tweet-template"><blockquote class="twitter-tweet" data-dnt="true"/g) || []).length, availableCount);
  assert.equal((home.match(/class="watch-link"/g) || []).length, availableCount);
  assert.ok(!/<blockquote class="twitter-tweet"/.test(home.replace(/<template\b[^>]*>[\s\S]*?<\/template>/g, '')), 'Live blockquotes must start inside templates');
});

await check('失效卡片无嵌入或空挂载点，其他卡片逐条校验嵌入地址与来源说明', async () => {
  const home = await read(join(dist, 'index.html'));
  const cards = new Map([...home.matchAll(/<article\b[^>]*data-entry-id="([^"]+)"[^>]*>[\s\S]*?<\/article>/g)].map(match => [match[1], match[0]]));
  assert.equal(cards.size, 63);
  for (const entry of entries) {
    const card = cards.get(entry.id);
    assert.ok(card, `${entry.id}: missing card`);
    assert.ok(card.includes(`data-copy-entry="${entry.id}"`), `${entry.id}: missing copy button`);
    assert.ok(card.includes(`href="${escapeHtml(entry.authorUrl)}"`), `${entry.id}: missing author`);
    const sourceLink = `<a href="${escapeHtml(entry.postUrl)}" target="_blank" rel="noopener noreferrer">`;
    if (['removed', 'sensitive'].includes(entry.postStatus)) {
      assert.ok(!/tweet-template|twitter-tweet|tweet-mount|data-embed|watch-link/.test(card), `${entry.id}: removed post must never embed`);
      if (entry.postStatus === 'removed') {
        assert.ok(card.includes(`<div class="post-unavailable"><p>原帖已删除或不可用（${entry.postCheckedAt} 检查），无法显示成片</p></div>`));
        assert.ok(card.includes(`${sourceLink}原帖（已失效）</a>`));
      } else {
        assert.ok(card.includes('原帖含敏感内容，请到 X 观看'));
        assert.ok(card.includes(`${sourceLink}原帖 ↗</a>`));
        assert.ok(!card.includes('已失效'));
      }
    } else {
      assert.equal((card.match(/class="tweet-template"/g) || []).length, 1, `${entry.id}: missing/duplicate embed`);
      assert.equal((card.match(/class="watch-link"/g) || []).length, 1, `${entry.id}: missing/duplicate watch link`);
      const embedUrl = entry.embedId ? entry.postUrl.replace(/\/\d+$/, `/${entry.embedId}`) : entry.postUrl;
      assert.ok(card.includes(`<blockquote class="twitter-tweet" data-dnt="true" data-conversation="none"><a href="${escapeHtml(embedUrl)}"`));
      assert.ok(card.includes(`<a href="${escapeHtml(embedUrl)}" target="_blank" rel="noopener noreferrer" class="watch-link">`));
      assert.ok(card.includes(`${sourceLink}原帖 ↗</a>`));
      if (entry.embedId) assert.ok(card.includes('<p class="embed-note">影片取自同作者的串首帖</p>'));
      if (entry.replyNoVideo) assert.ok(card.includes('<p class="embed-note">此帖为回复，影片见原串</p>'));
    }
  }
  const techie = entries.find(entry => entry.id === '2086124547376341346');
  assert.equal(techie.embedId, '2086124536253043164');
  assert.equal(techie.postUrl, 'https://x.com/TechieBySA/status/2086124547376341346');
  assert.ok(getCopyText(techie).endsWith(`\n完整版：${techie.postUrl}`));
});

await check('下架入口与 issue 模板齐全，原资料仅允许批准的 medium 迁移与嵌入信息', async () => {
  const html = await read(join(dist, 'takedown.html'));
  assert.match(html, /无需先证明身份/);
  assert.ok(html.includes('https://github.com/punkcanyang/fight-prompts/issues/new?template=takedown.md&amp;title=%E4%B8%8B%E6%9E%B6%E7%94%B3%E8%AF%B7'));
  const template = await read(join(root, '.github/ISSUE_TEMPLATE/takedown.md'));
  for (const field of ['原帖链接', '你的 X 账号', '说明']) assert.ok(template.includes(field));
  const changedPaths = (await git(['diff', '--name-only', 'HEAD', '--', ...protectedDataPaths])).trim().split('\n').filter(Boolean);
  assert.ok(changedPaths.every(path => path === 'data/prompts.json'), 'Read-only data files were modified');
  const baseline = withMediumBaseline(JSON.parse(await git(['show', 'HEAD:data/prompts.json'])));
  const techie = baseline.entries.find(entry => entry.id === '2086124547376341346');
  assert.ok(techie, 'Missing TechieBySA baseline entry');
  if (Object.hasOwn(techie, 'embedId')) assert.equal(techie.embedId, '2086124536253043164');
  techie.embedId = '2086124536253043164';
  assert.deepEqual(data, baseline, 'Only the approved medium migration and TechieBySA embedId are allowed; all original prompt fields must match HEAD');
});

await check('三页 canonical 与 Open Graph 使用正式网址且内容完整', async () => {
  for (const [file, path] of [['index.html', '/'], ['tips.html', '/tips.html'], ['takedown.html', '/takedown.html']]) {
    const html = await read(join(dist, file));
    const expectedUrl = `https://punkcanverse.com${path}`;
    const canonical = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/g)].map(match => match[1]);
    assert.deepEqual(canonical, [expectedUrl], `${file}: canonical`);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1];
    assert.ok(title && description, `${file}: title/description`);
    const properties = [...html.matchAll(/<meta property="([^"]+)" content="([^"]*)">/g)];
    for (const [property, expected] of [
      ['og:url', expectedUrl], ['og:title', title], ['og:description', description],
      ['og:type', 'website'], ['og:site_name', 'PUNKCANVERSE'],
    ]) assert.deepEqual(properties.filter(match => match[1] === property).map(match => match[2]), [expected], `${file}: ${property}`);
  }
});

await check('sitemap 精确列出全部正式页面，robots 允许抓取并指向正式 sitemap', async () => {
  const sitemap = await read(join(dist, 'sitemap.xml'));
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(sitemap, /<\/urlset>\s*$/);
  const essays = await loadEssays(pathToFileURL(join(root, 'content/essays') + '/'));
  const expectedPaths = ['/', '/tips.html', '/takedown.html', '/regions.html', ...Object.keys(MEDIUM_NAMES).filter(medium => entries.some(entry => entry.medium === medium)).map(medium => `/prompts/${medium}/`), ...entries.map(promptPath), '/essays/', ...essays.map(essay => `/essays/${essay.slug}/`), ...SITE_PAGES.map(page => page.path)];
  assert.equal((sitemap.match(/<url>/g) || []).length, expectedPaths.length);
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]), expectedPaths.map(path => `https://punkcanverse.com${path}`));
  assert.equal(await read(join(dist, 'robots.txt')), 'User-agent: *\nAllow: /\nSitemap: https://punkcanverse.com/sitemap.xml\n');
});

await check('dist 与 README 无旧 Pages 绝对网址，原资料在授权迁移范围之外未修改', async () => {
  for (const file of [...distFiles, join(root, 'README.md')]) {
    assert.ok(!/https?:\/\/fight-prompts\.pages\.dev\b/i.test(await read(file)), `Old Pages URL in ${relative(root, file)}`);
  }
  assert.equal(await git(['diff', 'HEAD', '--', ...protectedDataPaths, ':(exclude)data/prompts.json']), '', 'Pre-existing data outside the checked prompt migration must not change');
});

await check('发布页面只保留 Impact 站点验证标签（老板要求不能删），无其他第三方验证标签', async () => {
  const impact = /<meta\b[^>]*\bname\s*=\s*["']impact-site-verification["'][^>]*\b(?:value|content)\s*=\s*["']15021707-94fc-4527-ab33-87c6066da7fd["'][^>]*>/i;
  const index = await read(join(dist, 'index.html'));
  assert.match(index, impact, 'index.html must keep impact-site-verification meta');
  for (const file of distFiles.filter(path => extname(path) === '.html')) {
    const html = (await read(file)).replace(new RegExp(impact.source, 'gi'), '');
    assert.doesNotMatch(html, /<meta\b[^>]*\b(?:name|property)\s*=\s*["'][^"']*(?:site-verification|msvalidate\.01)[^"']*["']/i, `Unexpected verification tag in ${relative(root, file)}`);
  }
});

await check('v0.2 数据与页面齐全，medium 必填且限定三种类别', async () => {
  for (const file of ['regions.html']) assert.ok((await stat(join(dist, file))).isFile(), file);
  validateMedia(entries);
  assert.ok(entries.every(entry => entry.medium === 'video'), 'The current 63 entries must all remain video');
  const home = await read(join(dist, 'index.html'));
  if (availableMedia(entries).length <= 1) assert.ok(!home.includes('name="medium"'), 'Single-medium collection must not show a category switch');
});

await check('推广平台映射完整、空网址无按钮，所有页面包含推广揭露', async () => {
  validateAffiliates(affiliates);
  for (const key of ['hailuo', 'pixverse', 'higgsfield', 'magnific', 'kling']) assert.ok(affiliates[key], `Missing affiliate platform: ${key}`);
  for (const model of new Set(entries.flatMap(entry => entry.models))) assert.ok(Object.values(affiliates).some(platform => platform.models.includes(model)), `Missing platform for ${model}`);
  const home = await read(join(dist, 'index.html'));
  for (const entry of entries) {
    const expected = renderAffiliates(entry, affiliates);
    if (expected) assert.ok(home.includes(expected), `${entry.id}: missing sponsored link`);
  }
  if (Object.values(affiliates).every(platform => !platform.url.trim())) assert.ok(!/class="affiliate-(?:links|item|button)"/.test(home), 'Empty affiliate URLs must leave no container or button');
  for (const file of distFiles.filter(path => extname(path) === '.html')) {
    const html = await read(file);
    const footer = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0];
    assert.ok(footer?.includes(AFFILIATE_DISCLOSURE), `${file}: missing disclosure`);
    assert.ok(footer.includes('48 小时内处理') && footer.includes('href="takedown.html"') && footer.includes('https://x.com/punkcan'));
    assert.ok(html.includes('href="regions.html"'), `${file}: missing regions navigation`);
    for (const link of html.matchAll(/<a\b[^>]*class="affiliate-button"[^>]*>/g)) {
      assert.match(link[0], /rel="sponsored noopener noreferrer"/);
      assert.match(link[0], /target="_blank"/);
      assert.match(link[0], /href="https?:\/\//);
    }
  }
});

await check('地区数据及整页 HTML 通过官方来源、字段、日期与禁词校验', async () => {
  validateRegions(regions, regionsRaw);
  const html = await read(join(dist, 'regions.html'));
  validateRegionText(html);
  assert.ok(html.includes(REGION_DISCLAIMER));
  assert.equal((html.match(/class="region-card"/g) || []).length, regions.entries.length);
  for (const entry of regions.entries) {
    assert.ok(html.includes(escapeHtml(entry.summary)));
    assert.ok(html.includes(`href="${escapeHtml(entry.sourceUrl)}"`));
    assert.ok(html.includes(`href="${escapeHtml(entry.officialUrl)}"`));
  }
  assert.ok(html.includes('<link rel="canonical" href="https://punkcanverse.com/regions.html">'));
  assert.ok(html.includes('<meta property="og:url" content="https://punkcanverse.com/regions.html">'));
});

await check('beehiiv 周报关闭或地址无效时无区块，有效地址才允许嵌入', async () => {
  validateSite(site);
  const url = newsletterUrl(site);
  for (const file of distFiles.filter(path => extname(path) === '.html')) {
    const html = await read(file);
    if (!url) assert.ok(!/class="newsletter"|id="newsletter-title"/.test(html), `${file}: hidden newsletter must leave no empty block`);
    else {
      assert.ok(html.includes(`src="${escapeHtml(url)}" title="订阅提示词周报"`));
      assert.ok(html.indexOf('class="newsletter"') < html.indexOf('<footer'));
    }
  }
});

console.log(`\n${passed}/${passed} verification checks passed.`);
