import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCatalog } from '../lib/catalog.mjs';
import { loadI18n, localizeEntry } from '../lib/i18n.mjs';
import { OFFICIAL_FRAMES, validateOfficialFrame, validateFrameBytes } from '../lib/official-frames.mjs';
import { escapeHtml as e } from '../lib/markdown.mjs';

export function verifyOfficialFrameHtml(html, entry, credit) {
  validateOfficialFrame(entry, true);
  assert.doesNotMatch(html, /twitter-tweet|tweet-template|tweet-mount|data-play-embed|platform\.twitter\.com|widgets\.js|pbs\.twimg\.com|class="affiliate-button"/);
  const images=[...html.matchAll(/<img\b[^>]*>/g)].map(match=>match[0]);
  if (!entry.officialThumb) {
    assert.equal(entry.id, 'aliyun-wan3-example-17');
    assert.deepEqual(images, []);
    assert.ok(html.includes('class="official-preview"'));
    return;
  }
  assert.equal(images.length, 1);
  const frame=entry.officialThumb, image=images[0];
  for (const attribute of [`src="${frame.src}"`,`width="${frame.width}"`,`height="${frame.height}"`,'loading="lazy"','decoding="async"']) assert.ok(image.includes(attribute), attribute);
  assert.ok(image.includes(`alt="${e(entry.title)}"`), `${entry.id}: localized title alt`);
  assert.ok(html.includes('class="official-frame"'));
  assert.ok(!html.includes('class="official-preview"'));
  assert.ok(html.includes(`<a href="${e(entry.officialUrl)}" target="_blank" rel="noopener noreferrer">${e(credit)}</a>`), `${entry.id}: localized source credit`);
}

export async function verifyV052(root=fileURLToPath(new URL('..',import.meta.url)), dist=join(root,'dist')) {
  const {imported}=await loadCatalog(root);
  const entries=imported.entries.filter(entry=>entry.source==='official');
  assert.equal(entries.length,23);
  assert.deepEqual(Object.keys(OFFICIAL_FRAMES),Array.from({length:23},(_,n)=>`aliyun-wan3-example-${String(n+1).padStart(2,'0')}`));
  assert.equal(Object.values(OFFICIAL_FRAMES).filter(Boolean).length,22);
  assert.equal(OFFICIAL_FRAMES['aliyun-wan3-example-17'],null);
  const expectedFiles=Object.values(OFFICIAL_FRAMES).filter(Boolean).map(frame=>frame.src.split('/').at(-1)).sort();
  for(const directory of [join(root,'web/img/official'),join(dist,'img/official')])assert.deepEqual((await readdir(directory)).sort(),expectedFiles);
  for(const entry of entries) {
    validateOfficialFrame(entry,true);
    const frame=OFFICIAL_FRAMES[entry.id];
    if(!frame)continue;
    assert.equal(frame.sourceKind,'video-frame');
    const original=await readFile(join(root,'web',frame.src));
    const published=await readFile(join(dist,frame.src));
    validateFrameBytes(original,frame);validateFrameBytes(published,frame);
    assert.deepEqual(published,original,`${entry.id}: byte-for-byte asset copy`);
  }
  const i18n=await loadI18n(root);
  for(const locale of ['zh','en','ja']) {
    const prefix=locale==='zh'?'':`${locale}/`;
    const listings=await Promise.all(['prompts/video/index.html'].map(file=>readFile(join(dist,prefix,file),'utf8')));
    for(const entry of entries) {
      const detail=await readFile(join(dist,prefix,'prompts/video',entry.id,'index.html'),'utf8');
      const cards=listings.map(html=>html.match(new RegExp(`<article class="prompt-card" data-entry-id="${entry.id}"[^>]*>[\\s\\S]*?</article>`))?.[0]);
      for(const html of [...cards,detail]) {
        assert.ok(html,`${locale}/${entry.id}: official card/detail missing`);
        verifyOfficialFrameHtml(html,localizeEntry(entry,locale,i18n.content[locale]),i18n.ui[locale].officialFrameCredit);
      }
    }
  }
  console.log('✓ v0.5.2：22 张官方原始 WebP、三语列表与详情、图片来源、第17条占位及无X媒体通过');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await verifyV052();
