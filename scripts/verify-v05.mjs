import { promptHtml } from '../lib/cards.mjs';
import { loadWorks } from '../lib/works.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCatalog } from '../lib/catalog.mjs';
import { validateImportProvenance, sha256, ORIGINAL_PROMPTS_SHA256 } from '../lib/import-provenance.mjs';
import { escapeHtml as e } from '../lib/markdown.mjs';
import { loadI18n, validateI18n } from '../lib/i18n.mjs';
import { getCopyText } from '../lib/prompts.mjs';
import { getEmbedUrl } from '../lib/posts.mjs';
import { normalizeThumb } from '../lib/thumbs.mjs';
import { validateImportedThumbnails } from '../lib/import-thumbnails.mjs';
import { validateSiteText } from './verify-v04.mjs';

export async function verifyV05(root=fileURLToPath(new URL('..',import.meta.url))) {
  const read=path=>readFile(join(root,path),'utf8');
  const json=async path=>JSON.parse(await read(path));
  const {original,imported,entries}=await loadCatalog(root);
  const manifest=await json('test/fixtures/v05-source-manifest.json');
  // v0.5.1 spec change (boss 2026-10-22): full prompt text on every page
  assert.equal(sha256(await read('data/prompts.json')),ORIGINAL_PROMPTS_SHA256,'Original 63-entry file must stay byte-for-byte unchanged');
  assert.equal(original.entries.length,63);
  assert.equal(entries.length,192);
  assert.equal(new Set(entries.map(entry=>entry.id)).size,192);
  validateImportProvenance(imported,manifest);
  validateSiteText(JSON.stringify(imported));
  const published=await json('dist/catalog.json');
  assert.deepEqual(published.entries,entries);
  assert.deepEqual(await json('dist/data.json'),{entries:original.entries});
  const i18n=await loadI18n(root);
  validateI18n(i18n,entries,(await json('data/workflows.json')).entries,await json('data/regions.json'));
  const thumbs=await json('data/thumbs.json');
  validateImportedThumbnails(imported.entries,thumbs);
  const sitemap=await read('dist/sitemap.xml');
  const locs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(row=>row[1]);
  // v0.5.3 spec change (boss 2026-10-23): tool list page
  assert.equal(locs.length,633 + 3 * (await loadWorks(root)).length);
  for(const locale of ['zh','en','ja']) {
    const prefix=locale==='zh'?'':locale+'/';
    const urlPrefix=locale==='zh'?'':`/${locale}`;
    const home=await read(`dist/${prefix}index.html`);
    const listing=await read(`dist/${prefix}prompts/video/index.html`);
    const fight=await read(`dist/${prefix}prompts/fight/index.html`);
    const getCards=html=>new Map([...html.matchAll(/<article class="prompt-card" data-entry-id="([^"]+)"[\s\S]*?<\/article>/g)].map(row=>[row[1],row[0]]));
    const cards=getCards(home);
    assert.equal(cards.size,192);
    assert.deepEqual([...getCards(listing).keys()],entries.map(entry=>entry.id));
    assert.deepEqual([...getCards(fight).keys()],original.entries.map(entry=>entry.id));
    let featured=0;
    for(const entry of imported.entries) {
      const card=cards.get(entry.id);
      const detail=await read(`dist/${prefix}prompts/video/${entry.id}/index.html`);
      const url=`https://punkcanverse.com${urlPrefix}/prompts/video/${entry.id}/`;
      assert.ok(locs.includes(url));
      assert.ok(detail.includes(`<link rel="canonical" href="${url}">`));
      // v0.5.1 spec change (boss 2026-10-22): full prompt text on every page
      assert.ok(card.includes(`<pre class="prompt-text" tabindex="0">${promptHtml(entry)}</pre>`));
      // v0.5.1 spec change (boss 2026-10-22): full prompt text on every page
      assert.equal(getCopyText(entry),entry.prompt);
      for(const html of [card,detail]) {
        assert.ok(!/class="affiliate-(?:links|item|button)"/.test(html),`${entry.id}: imported entries cannot promote tools`);
        assert.ok(html.includes('>VIDEO<')||html.includes('>VIDEO / '));
        validateSiteText(html);
      }
      if(entry.featured) {featured++;assert.ok(card.includes(e(i18n.ui[locale].importFeaturedMark)));assert.ok(detail.includes('class="featured-badge"'));}
      else assert.ok(!detail.includes('class="featured-badge"'));
      if(entry.source==='official') {
        assert.ok(!Object.hasOwn(thumbs.entries,entry.id),'Official examples never enter thumbnail cache');
        for(const html of [card,detail]) {
          // v0.5.2 spec change (boss 2026-10-22): real official sample frames
          assert.ok(!/twitter-tweet|tweet-template|tweet-mount|data-play-embed|platform\.twitter\.com|widgets\.js|pbs\.twimg\.com/.test(html),`${entry.id}: official examples must not have X media`);
          if(entry.officialThumb) {
            assert.equal((html.match(/<img\b/g)||[]).length,1);
            assert.ok(html.includes(`<img src="${e(entry.officialThumb.src)}"`));
            assert.ok(!html.includes('class="official-preview"'));
          } else {assert.ok(html.includes('class="official-preview"'));assert.ok(!/<img\b/.test(html));}
          assert.ok(html.includes(e(i18n.ui[locale].officialAuthor)));
          assert.ok(html.includes(`href="${e(entry.officialUrl)}" target="_blank" rel="noopener noreferrer"`));
        }
        if(entry.isLong)assert.ok(detail.includes(e(i18n.ui[locale].officialLink)));
      } else {
        const record=thumbs.entries[entry.id];
        assert.ok(record,`${entry.id}: thumbnail fetch attempt must be recorded`);
        assert.equal(record.postId,entry.embedId||entry.id);
        assert.ok(['ok','missing'].includes(record.status));
        const fields=['postId','status','source','mediaType','thumb','width','height','durationMs','lastError','staleSince'];
        assert.ok(Object.keys(record).every(key=>fields.includes(key)),'Thumbnail cache cannot contain author or account data');
        if(record.status==='ok')assert.ok(normalizeThumb(record),'Cached image must be a valid public X image');
        for(const html of [card,detail]) {
          assert.ok(html.includes(`href="${e(getEmbedUrl(entry))}" target="_blank" rel="noopener noreferrer"`));
          assert.equal((html.match(/class="tweet-template"/g)||[]).length,1);
          const thumb=normalizeThumb(thumbs.entries[entry.id]);
          if(thumb)assert.ok(html.includes(`<img src="${e(thumb.thumb)}"`));
          else assert.ok(!/<img\b/.test(html));
        }
      }
    }
    assert.equal(featured,26);
  }
  console.log('✓ v0.5：192 条影片、129 条来源指纹、23 条官方无嵌入、三语详情、26 条精选与原 63 条栏目通过');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await verifyV05();
