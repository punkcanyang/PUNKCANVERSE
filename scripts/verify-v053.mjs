import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCatalog } from '../lib/catalog.mjs';
import { loadI18n, formatText } from '../lib/i18n.mjs';
import { escapeHtml as e } from '../lib/markdown.mjs';

export const PIXVERSE_URL='https://motivaiprivatelimited.sjv.io/qW3aLn';
const TIP_FILES=['en/tips.html','ja/tips.html','tips.html'];

export function verifyRecommendedToolsHtml(html, affiliates, ui, locale) {
  const sections=[...html.matchAll(/<section class="recommended-tools">[\s\S]*?<\/section>/g)];
  assert.equal(sections.length,1,'Exactly one recommended-tools section');
  const items=[...sections[0][0].matchAll(/<div class="affiliate-item">[\s\S]*?<\/div>/g)].map(match=>match[0]);
  const buttons=items.map(item=>item.match(/<a\b[^>]*class="affiliate-button"[^>]*>/)?.[0]);
  assert.ok(buttons.every(Boolean),'Each recommended item must contain a button');
  assert.deepEqual(buttons.map(button=>button.match(/href="([^"]+)"/)?.[1]),[affiliates.magnific.url,PIXVERSE_URL],'Exact recommended tool order: Magnific, PixVerse');
  const disclosure=`${locale==='zh'?'':`/${locale}`}/affiliate-disclosure/`;
  for(const [index,item] of items.entries()) {
    assert.match(buttons[index],/target="_blank"/);
    assert.match(buttons[index],/rel="sponsored noopener noreferrer"/);
    assert.ok(item.includes(`>${e(formatText(ui.tryPlatform,{name:index===0?'Magnific':'PixVerse'}))}</a>`),'Localized button text');
    assert.ok(item.includes(`<a href="${disclosure}" class="affiliate-label"><small>${e(ui.promoLabel)}</small></a>`),'Localized disclosure link');
    if(index===0)assert.ok(item.includes(`<small class="affiliate-code">${e(ui.codeLabel)} GMRPOCT43296</small>`));
    else assert.ok(!item.includes('class="affiliate-code"'),'PixVerse must not display a referral code');
  }
  assert.equal((sections[0][0].match(/class="affiliate-button"/g)||[]).length,2);
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
  const i18n=await loadI18n(root),locations=[];
  async function walk(directory) {
    for(const item of await readdir(directory,{withFileTypes:true})) {
      const path=join(directory,item.name);
      if(item.isDirectory()){await walk(path);continue;}
      if(!item.name.endsWith('.html'))continue;
      const file=relative(dist,path),html=await readFile(path,'utf8');
      if(html.includes(PIXVERSE_URL))locations.push(file);
      if(TIP_FILES.includes(file)) {
        const locale=file.startsWith('en/')?'en':file.startsWith('ja/')?'ja':'zh';
        verifyRecommendedToolsHtml(html,affiliates,i18n.ui[locale],locale);
        assert.equal(html.split(PIXVERSE_URL).length-1,1,'One PixVerse button on each tips page');
      } else assert.ok(!html.includes('class="recommended-tools"'),`${file}: recommended tools belong on tips only`);
    }
  }
  await walk(dist);
  assert.deepEqual(locations.sort(),TIP_FILES,'PixVerse must appear only on the three tips pages; no prompt or workflow buttons');
  console.log('✓ v0.5.3：PixVerse 精确网址、三语 tips 顺序与揭露、完整 sponsored 属性、零单条按钮通过');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await verifyV053();
