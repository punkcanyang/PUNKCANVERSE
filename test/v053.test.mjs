import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../lib/catalog.mjs';
import { renderAffiliates, renderRecommendedTools } from '../lib/affiliates.mjs';
import { loadI18n, cardUI, formatText } from '../lib/i18n.mjs';
import { buildSite } from '../build.mjs';
import { PIXVERSE_URL, verifyV053, verifyRecommendedToolsHtml } from '../scripts/verify-v053.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const affiliates=JSON.parse(await readFile(join(root,'data/affiliates.json'),'utf8'));
const {entries}=await loadCatalog(root),i18n=await loadI18n(root);

test('v0.5.3 PixVerse配置逐字正确，192条无匹配模型故零按钮，Higgsfield仍仅原4条',()=>{
  assert.deepEqual(affiliates.pixverse,{name:'PixVerse',url:'https://motivaiprivatelimited.sjv.io/qW3aLn',models:['PixVerse']});
  assert.equal(entries.length,192);
  assert.equal(entries.filter(entry=>entry.models.includes('PixVerse')).length,0);
  let higgsfield=0;
  for(const entry of entries) {
    const html=renderAffiliates(entry,affiliates);
    assert.ok(!html.includes(PIXVERSE_URL));
    if(html.includes(affiliates.higgsfield.url))higgsfield++;
    if(entry.collection==='wan-minimax')assert.equal(html,'');
  }
  assert.equal(higgsfield,4);
});

test('v0.5.3 PixVerse模型fixture才出现三语按钮、标示和本语言揭露，wan-minimax仍禁止推广',()=>{
  for(const locale of ['zh','en','ja']) {
    const ui=cardUI(locale,i18n.ui[locale],i18n.content[locale]);
    const fixture={models:['PixVerse']};
    const html=renderAffiliates(fixture,affiliates,ui.affiliate);
    assert.ok(html.includes(`href="${PIXVERSE_URL}" target="_blank" rel="sponsored noopener noreferrer"`));
    assert.ok(html.includes(`>${formatText(i18n.ui[locale].tryPlatform,{name:'PixVerse'})}</a>`));
    assert.ok(html.includes(`<a href="${locale==='zh'?'':`/${locale}`}/affiliate-disclosure/" class="affiliate-label"><small>${i18n.ui[locale].promoLabel}</small></a>`));
    assert.equal((html.match(/class="affiliate-button"/g)||[]).length,1);
    assert.ok(!html.includes('class="affiliate-code"'));
    assert.equal(renderAffiliates({models:['unmatched']},affiliates,ui.affiliate),'');
    assert.equal(renderAffiliates({...fixture,collection:'wan-minimax'},affiliates,ui.affiliate),'');
  }
});

test('v0.5.3 推荐工具按Magnific、PixVerse排序，共用既有样式，空或不安全网址完全不输出',()=>{
  const html=renderRecommendedTools(affiliates);
  assert.ok(html.indexOf(affiliates.magnific.url)<html.indexOf(PIXVERSE_URL));
  assert.equal((html.match(/class="recommended-tools"/g)||[]).length,1);
  assert.equal((html.match(/class="affiliate-button"/g)||[]).length,2);
  assert.equal((html.match(/class="affiliate-code"/g)||[]).length,1);
  assert.ok(html.includes('推广码 GMRPOCT43296'));
  for(const url of ['', 'javascript:alert(1)', 'data:text/html,bad']) {
    const fixture={pixverse:{...affiliates.pixverse,url}};
    assert.equal(renderRecommendedTools(fixture),'');
    const remaining=renderRecommendedTools({...fixture,magnific:affiliates.magnific});
    assert.equal((remaining.match(/class="affiliate-button"/g)||[]).length,1);
    assert.ok(remaining.includes(affiliates.magnific.url));assert.ok(!remaining.includes('PixVerse'));
  }
  assert.ok(renderRecommendedTools({pixverse:affiliates.pixverse}).includes(PIXVERSE_URL));
});

test('v0.5.3 离线构建三语tips各一链接、其余所有页面零链接，错顺序/属性/标示/推广码fixture会失败',async()=>{
  const out=await mkdtemp(join(tmpdir(),'pcv-pixverse-'));const previous=globalThis.fetch;
  globalThis.fetch=()=>{throw Error('Network forbidden');};
  try {
    await buildSite({out});await verifyV053(root,out);
    for(const locale of ['zh','en','ja']) {
      const prefix=locale==='zh'?'':`${locale}/`;
      const html=(await readFile(join(out,prefix,'tips.html'),'utf8')).match(/<section class="recommended-tools">[\s\S]*?<\/section>/)[0];
      for(const invalid of [
        html.replace('rel="sponsored noopener noreferrer"','rel="noopener noreferrer"'),
        html.replace('target="_blank"','target="_self"'),
        html.replace(PIXVERSE_URL,'https://example.com/wrong'),
        html.replace(PIXVERSE_URL,affiliates.magnific.url),
        html.replace(`>${i18n.ui[locale].promoLabel}<`,'>wrong label<'),
        html.replace('</small></a></div>','</small></a><small class="affiliate-code">FAKE</small></div>'),
      ])assert.throws(()=>verifyRecommendedToolsHtml(invalid,affiliates,i18n.ui[locale],locale));
    }
    const detail=join(out,`prompts/video/${entries[0].id}/index.html`);
    await writeFile(detail,(await readFile(detail,'utf8'))+PIXVERSE_URL);
    await assert.rejects(()=>verifyV053(root,out),/PixVerse must appear only on the three tips pages/);
  }finally{globalThis.fetch=previous;await rm(out,{recursive:true,force:true});}
});
