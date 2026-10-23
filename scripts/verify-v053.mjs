import { selectHomeEntries } from '../lib/prompts.mjs';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCatalog } from '../lib/catalog.mjs';
import { loadI18n, formatText } from '../lib/i18n.mjs';
import { escapeHtml as e } from '../lib/markdown.mjs';
import { validateTools } from '../lib/tools.mjs';

export const PIXVERSE_URL='https://motivaiprivatelimited.sjv.io/qW3aLn';
const TIP_FILES=['en/tips.html','ja/tips.html','tips.html'];
const TOOL_FILES=['en/tools.html','ja/tools.html','tools.html'];

// v0.5.3 spec change (boss 2026-10-23): tool list page
export function verifyRecommendedToolsHtml(html, affiliates, ui, locale) {
  const sections=[...html.matchAll(/<section class="recommended-tools">[\s\S]*?<\/section>/g)];
  assert.equal(sections.length,1,'Exactly one recommended-tools section');
  const section=sections[0][0],prefix=locale==='zh'?'':`/${locale}`;
  assert.equal((section.match(/class="affiliate-button"/g)||[]).length,0,'Tips has no affiliate buttons');
  assert.ok(!section.includes('GMRPOCT43296'));
  for(const platform of Object.values(affiliates))if(platform.url)assert.ok(!section.includes(platform.url));
  assert.deepEqual([...section.matchAll(/<a href="([^"]+)"/g)].map(m=>m[1]),['higgsfield','magnific','pixverse'].map(id=>`${prefix}/tools#${id}`).concat(`${prefix}/tools`));
  assert.ok(section.includes(ui.tools.viewAll));
}

// v0.5.3 spec change (boss 2026-10-23): tool list page
// The existing sponsored, target, disclosure and referral-code checks now apply to each tools card.
export function verifyToolCardHtml(html,id,data,affiliates,ui,locale) {
  const p=data.facts.platforms[id],copy=data.content[locale][id];
  assert.ok(html.startsWith(`<article class="tool-card" id="${id}">`));
  assert.ok(html.includes(e(copy.summary.value))&&html.includes(e(copy.launch.value)));
  for(const field of [...copy.features,copy.freeTier,copy.bestFor,...copy.credits,...copy.pricingNotes])assert.ok(html.includes(e(field.value)));
  assert.equal((html.match(/<li\b/g)||[]).length,p.features.length);
  assert.equal((html.match(/<tr data-plan=/g)||[]).length,Array.isArray(p.plans)?p.plans.length:0);
  if(Array.isArray(p.plans))assert.deepEqual([...html.matchAll(/<td data-price>([^<]+)<\/td>/g)].map(m=>m[1]),p.plans.map(plan=>typeof plan.monthlyPriceUSD==='number'?`${plan.monthlyPriceUSD} ${e(ui.tools.unit)}`:e(ui.tools.undisclosed)));
  else assert.ok(html.includes(`<p class="undisclosed">${e(ui.tools.undisclosed)}</p>`));
  assert.ok(html.includes(e(ui.tools.checked.replace('{date}',data.facts.checkedAt))));
  const pricing=[...html.matchAll(/<a\b[^>]*>/g)].map(m=>m[0]).find(a=>a.includes(`href="${e(p.pricingUrl.value)}"`));
  assert.ok(pricing,'Exact official pricing link');assert.match(pricing,/target="_blank"/);assert.match(pricing,/rel="noopener noreferrer"/);assert.ok(!pricing.includes('sponsored'));
  const cta=html.match(/<div class="tool-cta">([\s\S]*?)<\/div><\/article>$/)?.[1];
  assert.ok(cta,'The affiliate component must be the last card element');
  const buttons=[...cta.matchAll(/<a\b[^>]*class="affiliate-button"[^>]*>/g)].map(m=>m[0]);
  assert.equal(buttons.length,1);assert.ok(buttons[0].includes(`href="${e(affiliates[id].url)}"`));
  assert.match(buttons[0],/target="_blank"/);assert.match(buttons[0],/rel="sponsored noopener noreferrer"/);
  const disclosure=`${locale==='zh'?'':`/${locale}`}/affiliate-disclosure/`;
  assert.ok(cta.includes(`>${e(formatText(ui.tryPlatform,{name:affiliates[id].name}))}</a>`),'Localized button text');
  assert.ok(cta.includes(`<a href="${disclosure}" class="affiliate-label"><small>${e(ui.promoLabel)}</small></a>`),'Localized disclosure link');
  if(id==='magnific')assert.ok(cta.includes(`<small class="affiliate-code">${e(ui.codeLabel)} GMRPOCT43296</small>`));
  else assert.ok(!cta.includes('class="affiliate-code"'),'Only Magnific has a referral code');
}

export async function verifyV053(root=fileURLToPath(new URL('..',import.meta.url)),dist=join(root,'dist')) {
  const affiliates=JSON.parse(await readFile(join(root,'data/affiliates.json'),'utf8'));
  assert.deepEqual(affiliates.pixverse,{name:'PixVerse',url:PIXVERSE_URL,models:['PixVerse']});
  assert.equal(affiliates.magnific.code,'GMRPOCT43296');
  assert.deepEqual(Object.values(affiliates).map(platform=>platform.url).filter(Boolean).sort(),[
    'https://higgsfield.ai?fpr=tsungmin-dab6c3',PIXVERSE_URL,'https://referral.magnific.com/mzYHTuc',
  ]);
  const {entries}=await loadCatalog(root);
  assert.equal(entries.length,192);
  assert.equal(entries.filter(entry=>entry.models.includes('PixVerse')).length,0);
  const i18n=await loadI18n(root),locations=[],magnificLocations=[];
  const toolsData=JSON.parse(await readFile(join(root,'data/tools.json'),'utf8'));
  validateTools(toolsData,i18n.ui);
  const higgsIds=entries.filter(entry=>entry.models.includes('Higgsfield（平台）')).map(entry=>entry.id);
  assert.equal(higgsIds.length,4);
  async function walk(directory) {
    for(const item of await readdir(directory,{withFileTypes:true})) {
      const path=join(directory,item.name);
      if(item.isDirectory()){await walk(path);continue;}
      if(!item.name.endsWith('.html'))continue;
      const file=relative(dist,path),html=await readFile(path,'utf8');
      if(html.includes(PIXVERSE_URL))locations.push(file);
      if(html.includes(affiliates.magnific.url))magnificLocations.push(file);
      const locale=file.startsWith('en/')?'en':file.startsWith('ja/')?'ja':'zh';
      const prefix=locale==='zh'?'':`${locale}/`;
      const nav=html.match(/<nav class="primary-nav"[^>]*>[\s\S]*?<\/nav>/)?.[0];
      assert.ok(nav?.includes(`href="/${prefix}tools"`),'Localized tools navigation');
      assert.equal((nav.match(/<a\b/g)||[]).length,5);
      const isListing=['prompts/video/index.html','prompts/fight/index.html'].some(p=>file===prefix+p);
      const isHiggsDetail=higgsIds.some(id=>file===`${prefix}prompts/video/${id}/index.html`);
      const homeCount=selectHomeEntries(entries).filter(entry=>higgsIds.includes(entry.id)).length;
      const higgsCount=TOOL_FILES.includes(file)?1:file===prefix+'index.html'?homeCount:isListing?4:isHiggsDetail?1:0;
      assert.equal(html.split(affiliates.higgsfield.url).length-1,higgsCount,`${file}: original Higgsfield distribution plus one per tools page`);
      if(!TOOL_FILES.includes(file))assert.equal((html.match(/class="tool-about"/g)||[]).length,higgsCount);
      if(TIP_FILES.includes(file)) {
        const locale=file.startsWith('en/')?'en':file.startsWith('ja/')?'ja':'zh';
        verifyRecommendedToolsHtml(html,affiliates,i18n.ui[locale],locale);
        // v0.5.3 spec change (boss 2026-10-23): tool list page
        assert.equal(html.split(PIXVERSE_URL).length-1,0,'No PixVerse URL on tips');
        assert.ok(!html.includes('GMRPOCT43296'));
        assert.ok(!html.includes('class="affiliate-button"'));
      } else assert.ok(!html.includes('class="recommended-tools"'),`${file}: recommended tools belong on tips only`);
      if(TOOL_FILES.includes(file)) {
        const cards=[...html.matchAll(/<article class="tool-card" id="([^"]+)">[\s\S]*?<\/article>/g)];
        assert.deepEqual(cards.map(m=>m[1]),['higgsfield','magnific','pixverse']);
        for(const card of cards)verifyToolCardHtml(card[0],card[1],toolsData,affiliates,i18n.ui[locale],locale);
        assert.equal(html.split(PIXVERSE_URL).length-1,1);
        assert.equal(html.split(affiliates.magnific.url).length-1,1);
        assert.equal(html.split('GMRPOCT43296').length-1,1);
      } else assert.ok(!html.includes('GMRPOCT43296'));
    }
  }
  await walk(dist);
  // v0.5.3 spec change (boss 2026-10-23): tool list page
  assert.deepEqual(locations.sort(),TOOL_FILES,'PixVerse must appear only on the three tools pages; no prompt or workflow buttons');
  assert.deepEqual(magnificLocations.sort(),TOOL_FILES,'Magnific belongs only on the three tools pages');
  console.log('✓ v0.5.3：三语工具清单、逐项来源与价格、tips 零推广、三家精确分布及 Higgsfield 说明链接通过');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await verifyV053();
