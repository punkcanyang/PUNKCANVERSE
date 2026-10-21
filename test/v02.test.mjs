import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
const newsletterFixture = (enabled, embedUrl, provider = 'beehiiv') => ({ newsletter: { enabled, embedUrl, provider } });

test('推广网址全空时无按钮、空容器或占位', () => {
  assert.ok(Object.values(affiliates).every(platform => platform.url === ''));
  for (const entry of prompts.entries) assert.equal(renderAffiliates(entry, affiliates), '');
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
    assert.ok(!/class="affiliate-(?:links|item|button)"/.test(html));
    assert.ok(!/class="newsletter"|id="newsletter-title"/.test(html));
    assert.ok(html.includes('href="regions.html"'));
    assert.ok(html.includes('https://x.com/punkcan'));
  }
  const home = await read('../dist/index.html');
  assert.ok(!home.includes('name="medium"'));
  const regionsHtml = await read('../dist/regions.html');
  assert.doesNotThrow(() => validateRegionText(regionsHtml));
  assert.ok(regionsHtml.includes(REGION_DISCLAIMER));
});
