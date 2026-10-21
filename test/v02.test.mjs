import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { renderAffiliates, AFFILIATE_DISCLOSURE } from '../lib/affiliates.mjs';
import { renderNewsletter, newsletterUrl } from '../lib/newsletter.mjs';
import { renderMediumFilter, validateMedia } from '../lib/media.mjs';
import { filterEntries, parseFilters, filtersToSearch, clearFilters } from '../lib/prompts.mjs';
import { renderCard } from '../lib/cards.mjs';
import { withMediumBaseline } from '../lib/data-migration.mjs';
import { validateRegions, validateRegionText, renderRegions, REGION_BANNED_TERMS, REGION_DISCLAIMER } from '../lib/regions.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const affiliates = JSON.parse(await read('../data/affiliates.json'));
const site = JSON.parse(await read('../data/site.json'));
const prompts = JSON.parse(await read('../data/prompts.json'));
const regions = JSON.parse(await read('../data/regions.json'));
const seedance = prompts.entries.find(entry => entry.models.includes('Seedance'));
function checkAffiliateButtons(html, page) {
  assert.ok(!/<div class="affiliate-(?:links|item)">\s*<\/div>/.test(html), `empty affiliate container in ${page}`);
  assert.ok(!/<section class="recommended-tools">(?:(?!affiliate-button)[\s\S])*?<\/section>/.test(html), `empty recommended-tools in ${page}`);
  const buttons = html.match(/<a\b[^>]*class="affiliate-button"[^>]*>/g) || [];
  for (const button of buttons) {
    const href = (button.match(/href="([^"]*)"/) || [])[1];
    assert.ok(liveAffiliateUrls.has(href), `unexpected affiliate href ${href} in ${page}`);
    assert.match(button, /rel="sponsored noopener noreferrer"/, page);
  }
  assert.equal((html.match(/class="affiliate-item"/g) || []).length, buttons.length, `affiliate item without button in ${page}`);
  return buttons.length;
}
const newsletterFixture = (enabled, embedUrl, provider = 'beehiiv') => ({ newsletter: { enabled, embedUrl, provider } });

// 规格于 v0.3 变更：v0.2 时所有推广网址必须为空；v0.3 起 data/affiliates.json 填入 Higgsfield 与 Magnific 的真实推广网址。
// 新规格：只匹配空网址平台的条目完全不输出（无按钮、无空容器）；有网址的平台输出带 sponsored 属性与“推广连结”标签的按钮。
const liveAffiliateUrls = new Set(Object.values(affiliates).map(platform => platform.url).filter(url => url !== ''));
const livePlatforms = Object.values(affiliates).filter(platform => platform.url !== '');
const liveModels = new Set(livePlatforms.flatMap(platform => platform.models));

test('空推广网址平台无按钮、空容器或占位；有网址的平台显示 sponsored 按钮与推广标签', () => {
  assert.deepEqual([...liveAffiliateUrls].sort(), ['https://higgsfield.ai?fpr=tsungmin-dab6c3', 'https://referral.magnific.com/mzYHTuc']);
  for (const platform of Object.values(affiliates)) assert.equal(typeof platform.url, 'string');
  let emptyOnly = 0;
  let withLive = 0;
  for (const entry of prompts.entries) {
    const html = renderAffiliates(entry, affiliates);
    const expected = livePlatforms.filter(platform => platform.models.some(model => entry.models.includes(model)));
    if (!expected.length) {
      emptyOnly++;
      assert.equal(html, '', entry.id);
      assert.ok(!renderCard(entry, 0, affiliates).includes('class="affiliate-'), entry.id);
      continue;
    }
    withLive++;
    assert.ok(!/<div class="affiliate-links">\s*<\/div>/.test(html), entry.id);
    const buttons = html.match(/<a class="affiliate-button"[^>]*>/g) || [];
    assert.equal(buttons.length, expected.length, entry.id);
    for (const platform of expected) {
      assert.ok(html.includes(`href="${platform.url}" target="_blank" rel="sponsored noopener noreferrer"`), `${entry.id} ${platform.name}`);
      assert.ok(html.includes(`去 ${platform.name} 试试`), `${entry.id} ${platform.name}`);
    }
    for (const button of buttons) assert.match(button, /rel="sponsored noopener noreferrer"/);
    assert.equal((html.match(/<small>推广连结<\/small>/g) || []).length, expected.length, entry.id);
  }
  assert.ok(emptyOnly > 0 && withLive > 0, 'live data must cover both empty-only and live-platform entries');
  assert.ok(!liveModels.has('Seedance'));
  assert.ok(!renderCard(seedance, 0, affiliates).includes('class="affiliate-'));
});

test('fixture 有推广网址时只按模型匹配，显示推广标签及 sponsored 外链属性', () => {
  const fixture = structuredClone(affiliates);
  fixture.seedance.url = 'https://example.com/try?ref=test&source=fixture';
  const html = renderCard(seedance, 0, fixture);
  assert.match(html, /去 Seedance 试试/);
  assert.match(html, /<small>推广连结<\/small>/);
  assert.match(html, /target="_blank" rel="sponsored noopener noreferrer"/);
  assert.ok(html.includes('https://example.com/try?ref=test&amp;source=fixture'));
  assert.equal(renderAffiliates({ models: ['Other model'] }, fixture), '');
  assert.equal(affiliates.seedance.url, '', 'Fixture must not modify live settings');
});

test('非 HTTP(S) 与属性注入推广网址不渲染，平台名转义且同一平台只出现一次', () => {
  for (const url of ['', '  ', 'javascript:alert(1)', 'data:text/html,test', '//example.com', '/relative', 'ftp://example.com', 'https://example.com/\nunsafe']) {
    assert.equal(renderAffiliates({ models: ['A'] }, { platform: { name: 'Test', url, models: ['A'] } }), '');
  }
  const html = renderAffiliates({ models: ['A', 'B'] }, { platform: { name: '<Test>', url: 'http://example.com', models: ['A', 'B'] } });
  assert.match(html, /去 &lt;Test&gt; 试试/);
  assert.equal((html.match(/class="affiliate-button"/g) || []).length, 1);
});

test('beehiiv 默认关闭；启用但地址为空也完全不输出', () => {
  assert.deepEqual(site.newsletter, { enabled: false, provider: 'beehiiv', embedUrl: '' });
  assert.equal(renderNewsletter(site), '');
  assert.equal(renderNewsletter(newsletterFixture(false, 'https://embeds.beehiiv.com/test')), '');
  assert.equal(renderNewsletter(newsletterFixture(true, '')), '');
});

test('合法 beehiiv fixture 输出说明与 iframe，URL 安全转义', () => {
  for (const host of ['beehiiv.com', 'embeds.beehiiv.com']) {
    const html = renderNewsletter(newsletterFixture(true, `https://${host}/test?one=1&two=2`));
    assert.match(html, /class="newsletter"/);
    assert.match(html, /订阅提示词周报/);
    assert.match(html, /<iframe[^>]+loading="lazy"/);
    assert.ok(html.includes('one=1&amp;two=2'));
    assert.ok(!html.includes('<script'));
  }
});

test('非 HTTPS、非精确 beehiiv 域名及携带凭据的订阅地址全部隐藏', () => {
  for (const url of ['http://beehiiv.com/test', 'https://example.com/test', 'https://notbeehiiv.com/test', 'https://beehiiv.com.example.com/test', 'https://other.beehiiv.com/test', 'https://user:pass@beehiiv.com/test', 'https://beehiiv.com:8443/test', 'javascript:alert(1)']) {
    assert.equal(newsletterUrl(newsletterFixture(true, url)), null, url);
    assert.equal(renderNewsletter(newsletterFixture(true, url)), '', url);
  }
  assert.equal(renderNewsletter(newsletterFixture(true, 'https://beehiiv.com/test', 'other')), '');
});

test('medium 必填，只接受 video/image/music，非法 fixture 必须失败', () => {
  validateMedia(prompts.entries);
  assert.ok(prompts.entries.every(entry => entry.medium === 'video'));
  for (const medium of ['video', 'image', 'music']) assert.doesNotThrow(() => validateMedia([{ id: 'test', medium }]));
  for (const medium of [undefined, null, '', 'audio', 'Video', ['video'], 1]) assert.throws(() => validateMedia([{ id: 'test', medium }]));
});

test('单一类别无切换，多类别 fixture 显示可用类别与全部选项', () => {
  assert.equal(renderMediumFilter(prompts.entries), '');
  assert.equal(renderMediumFilter([]), '');
  const html = renderMediumFilter([{ medium: 'video' }, { medium: 'image' }]);
  assert.match(html, /<legend>类别<\/legend>/);
  assert.match(html, /name="medium" value="video"/);
  assert.match(html, /name="medium" value="image"/);
  assert.ok(!html.includes('value="music"'));
  assert.match(html, /value="" checked><span>全部/);
});

test('类别筛选与模型、标签取交集，URL 可恢复且清除能移除 medium', () => {
  const fixture = [
    { id: 'v', medium: 'video', models: ['Wan'], tags: ['冷兵器'] },
    { id: 'i', medium: 'image', models: ['Wan'], tags: ['冷兵器'] },
    { id: 'm', medium: 'music', models: ['Other'], tags: ['配乐'] },
  ];
  const filters = parseFilters('?medium=image&model=Wan&tag=冷兵器');
  assert.deepEqual(filterEntries(fixture, filters).map(entry => entry.id), ['i']);
  assert.deepEqual(parseFilters(filtersToSearch(filters)), filters);
  assert.deepEqual(filterEntries(fixture, { medium: 'music' }).map(entry => entry.id), ['m']);
  assert.deepEqual(filterEntries(fixture, { medium: 'invalid' }), []);
  assert.equal(filtersToSearch(clearFilters(), '?medium=image&ref=test'), '?ref=test');
  assert.deepEqual(filterEntries(fixture, clearFilters()), fixture);
});

test('medium 迁移只扩充旧资料的缺失字段，不掩盖原文或既有类别修改', () => {
  const baseline = { count: 1, entries: [{ id: 'original', prompt: '原文', embedId: '123' }] };
  const expected = withMediumBaseline(baseline);
  assert.deepEqual(expected, { count: 1, entries: [{ id: 'original', prompt: '原文', embedId: '123', medium: 'video' }] });
  assert.ok(!Object.hasOwn(baseline.entries[0], 'medium'));
  assert.equal(withMediumBaseline({ entries: [{ medium: 'image' }] }).entries[0].medium, 'image');
  const changed = structuredClone(expected);
  changed.entries[0].prompt = '改写';
  assert.notDeepEqual(changed, expected);
});

test('官方地区资料与免责声明通过校验，正文安全转义', () => {
  assert.doesNotThrow(() => validateRegions(regions));
  assert.doesNotThrow(() => validateRegionText(REGION_DISCLAIMER));
  const fixture = structuredClone(regions);
  fixture.entries[0].title = '<unsafe> & title';
  const html = renderRegions(fixture);
  assert.ok(html.includes('&lt;unsafe&gt; &amp; title'));
  assert.ok(!html.includes('<unsafe>'));
  assert.ok(html.includes(REGION_DISCLAIMER));
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});

test('禁词常数中的每一词出现在数据、额外字段或 HTML 都必须失败', () => {
  for (const term of REGION_BANNED_TERMS) {
    const fixture = structuredClone(regions);
    fixture.entries[0].summary += term;
    assert.throws(() => validateRegions(fixture), /forbidden term/, term);
    assert.throws(() => validateRegions({ ...regions, extra: term }), /forbidden term/);
    assert.throws(() => validateRegionText(`<p>${term}</p>`), /forbidden term/);
  }
  assert.throws(() => validateRegions(regions, `${JSON.stringify(regions)}\nVpN`), /forbidden term/);
});

test('地区资料不足五条、重复 id、缺字段、非 HTTPS 或未授权来源必须失败', () => {
  assert.throws(() => validateRegions({ entries: regions.entries.slice(0, 4) }));
  for (const mutate of [
    data => { data.entries[1].id = data.entries[0].id; },
    data => { delete data.entries[0].vendor; },
    data => { data.entries[0].sourceUrl = 'http://www.anthropic.com/legal/aup'; },
    data => { data.entries[0].officialUrl = 'https://example.com/unverified'; },
    data => { data.entries[0].checked = '2026-10-22'; },
    data => { data.entries[0].summary = '只有一句。'; },
  ]) {
    const fixture = structuredClone(regions);
    mutate(fixture);
    assert.throws(() => validateRegions(fixture));
  }
});

test('实际 build：四页均有揭露，空推广和关闭周报不留下容器，单类不显示切换', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  await promisify(execFile)(process.execPath, ['build.mjs'], { cwd: root });
  for (const page of ['index', 'tips', 'takedown', 'regions']) {
    const html = await read(`../dist/${page}.html`);
    assert.ok(html.includes(AFFILIATE_DISCLOSURE));
    // 规格于 v0.3 变更：按钮只能出现在有网址的平台，且仍不得留下空容器（见 checkAffiliateButtons）。
    checkAffiliateButtons(html, page);
    assert.ok(!/class="newsletter"|id="newsletter-title"/.test(html));
    assert.ok(html.includes('href="regions.html"'));
    assert.ok(html.includes('https://x.com/punkcan'));
  }
  const distRoot = fileURLToPath(new URL('../dist/', import.meta.url));
  const pages = (await readdir(distRoot, { recursive: true })).filter(file => file.endsWith('.html'));
  assert.ok(pages.length > 4);
  let buttonCount = 0;
  for (const file of pages) buttonCount += checkAffiliateButtons(await readFile(path.join(distRoot, file), 'utf8'), file);
  assert.ok(buttonCount > 0, 'live affiliate URLs must render at least one button in dist');
  const home = await read('../dist/index.html');
  assert.ok(!home.includes('name="medium"'));
  const regionsHtml = await read('../dist/regions.html');
  assert.doesNotThrow(() => validateRegionText(regionsHtml));
  assert.ok(regionsHtml.includes(REGION_DISCLAIMER));
});
