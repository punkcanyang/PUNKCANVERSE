import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { renderAffiliates, AFFILIATE_DISCLOSURE } from '../lib/affiliates.mjs';
import { renderCard } from '../lib/cards.mjs';
import { buildSite } from '../build.mjs';
const affiliates = JSON.parse(await readFile(new URL('../data/affiliates.json', import.meta.url), 'utf8'));
const prompts = JSON.parse(await readFile(new URL('../data/prompts.json', import.meta.url), 'utf8'));
const seedance = prompts.entries.find(entry => entry.models.includes('Seedance'));
const liveAffiliateUrls = new Set(Object.values(affiliates).map(platform => platform.url).filter(url => url !== ''));
const livePlatforms = Object.values(affiliates).filter(platform => platform.url !== '');
const liveModels = new Set(livePlatforms.flatMap(platform => platform.models));

function checkAffiliateButtons(html, page) {
  assert.ok(!/<div class="affiliate-(?:links|item)">\s*<\/div>/.test(html), `empty affiliate container in ${page}`);
  // v0.5.3 spec change (boss 2026-10-23): tool list page
  for(const section of html.matchAll(/<section class="recommended-tools">[\s\S]*?<\/section>/g)) {
    assert.equal((section[0].match(/class="affiliate-button"/g)||[]).length,0);
    const prefix=html.includes('<html lang="en"')?'/en':html.includes('<html lang="ja"')?'/ja':'';
    assert.deepEqual([...section[0].matchAll(/<a href="([^"]+)"/g)].map(m=>m[1]),[`${prefix}/tools#higgsfield`,`${prefix}/tools#magnific`,`${prefix}/tools#pixverse`,`${prefix}/tools`]);
  }
  const buttons = html.match(/<a\b[^>]*class="affiliate-button"[^>]*>/g) || [];
  for (const button of buttons) {
    const href = (button.match(/href="([^"]*)"/) || [])[1];
    assert.ok(liveAffiliateUrls.has(href), `unexpected affiliate href ${href} in ${page}`);
    assert.match(button, /rel="sponsored noopener noreferrer"/, page);
  }
  assert.equal((html.match(/class="affiliate-item"/g) || []).length, buttons.length, `affiliate item without button in ${page}`);
  return buttons.length;
}
test('真实推广配置只启用指定平台，按模型输出 sponsored 按钮', () => {
  // v0.5.3 spec change (boss 2026-10-23): PixVerse affiliate approved
  assert.deepEqual([...liveAffiliateUrls].sort(), ['https://higgsfield.ai?fpr=tsungmin-dab6c3', 'https://motivaiprivatelimited.sjv.io/qW3aLn', 'https://referral.magnific.com/mzYHTuc']);
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


test('真实推广构建无空容器，推荐属性完整，下架与地区页保持零推广按钮', async () => {
  const out = await mkdtemp(path.join(tmpdir(), 'pcv-live-affiliates-'));
  try {
    await buildSite({out});
    for (const page of ['index', 'tips', 'takedown', 'regions']) {
      const html = await readFile(path.join(out, `${page}.html`), 'utf8');
      assert.ok(html.includes(AFFILIATE_DISCLOSURE));
      checkAffiliateButtons(html, page);
      if (['takedown', 'regions'].includes(page)) assert.ok(!/class="affiliate-(?:links|item|button)"/.test(html), `${page}: affiliate buttons forbidden`);
      assert.ok(!/class="newsletter"|id="newsletter-title"/.test(html));
      assert.ok(html.includes('href="regions.html"'));
      assert.ok(html.includes('https://x.com/punkcan'));
    }
    const pages = (await readdir(out, {recursive:true})).filter(file => file.endsWith('.html'));
    assert.ok(pages.length > 4);
    let buttonCount = 0;
    for (const file of pages) buttonCount += checkAffiliateButtons(await readFile(path.join(out, file), 'utf8'), file);
    assert.ok(buttonCount > 0, 'live affiliate URLs must render at least one button in dist');
  } finally { await rm(out, {recursive:true,force:true}); }
});
