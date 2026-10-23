import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTools, renderToolCard, TOOL_IDS } from '../lib/tools.mjs';
import { cardUI, loadI18n } from '../lib/i18n.mjs';
import { buildSite } from '../build.mjs';
import { verifyToolCardHtml, verifyV053 } from '../scripts/verify-v053.mjs';
import { verifyAnalyticsHtml } from '../lib/analytics.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const json=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const data=await json('data/tools.json'),affiliates=await json('data/affiliates.json'),i18n=await loadI18n(root);

test('工具事实与逐值source固定对应批准来源，译文不增加价格、数字或日期，未公开值三语精确显示',async()=>{
  validateTools(data,i18n.ui);
  try {
    const original=JSON.parse(await readFile('/workspace/bd-punkcan/v053-tools-facts.json','utf8'));
    assert.deepEqual(data.facts,original);
  }catch(error){if(error.code!=='ENOENT')throw error;}
  for(const mutate of [
    d=>d.facts.platforms.magnific.plans[1].monthlyPriceUSD=99,
    d=>d.facts.platforms.pixverse.features[0].source='https://example.com/',
    d=>d.facts.checkedAt='2026-10-24',
    d=>d.content.en.magnific.credits[0].value='999 credits',
    d=>d.content.ja.higgsfield.launch.value='2024年設立',
    d=>d.content.en.pixverse.features[0].source='https://example.com/',
    d=>d.content.en.pixverse.credits[0].fact='plans.1.credits',
    d=>d.content.ja.magnific.credits[4].value='200クレジット',
  ]){const fixture=structuredClone(data);mutate(fixture);assert.throws(()=>validateTools(fixture,i18n.ui));}
  assert.deepEqual(data.facts.platforms.higgsfield.plans.value,'未公開');
  for(const p of Object.values(data.facts.platforms))if(Array.isArray(p.plans))for(const plan of p.plans)assert.ok(typeof plan.monthlyPriceUSD==='number'||plan.monthlyPriceUSD==='未公開');
});

test('三语每张工具卡先介绍/时间/特色/价格/适合谁，最后是推广组件；官方价格链接无sponsored，年缴和每席不误写',()=>{
  for(const locale of ['zh','en','ja'])for(const id of TOOL_IDS) {
    const ui=i18n.ui[locale],copy=cardUI(locale,ui,i18n.content[locale]);
    const html=renderToolCard(id,data,affiliates,locale,ui.tools,copy.affiliate);
    verifyToolCardHtml(html,id,data,affiliates,ui,locale);
    assert.ok(html.indexOf('data-fact="summary"')<html.indexOf('data-fact="launch"'));
    assert.ok(html.indexOf('data-fact="launch"')<html.indexOf('class="tool-features"'));
    assert.ok(html.indexOf('class="tool-pricing"')<html.indexOf('data-fact="bestFor"'));
    assert.ok(html.indexOf('data-fact="bestFor"')<html.indexOf('class="tool-price-source"'));
    assert.ok(html.indexOf('class="tool-price-source"')<html.indexOf('class="tool-cta"'));
    if(Array.isArray(data.facts.platforms[id].plans))assert.ok(html.includes(ui.tools.annual));
    if(id==='pixverse')assert.ok(html.includes(data.content[locale].pixverse.pricingNotes[1].value));
    const invalid=html.replace('rel="noopener noreferrer"','rel="sponsored noopener noreferrer"');
    assert.throws(()=>verifyToolCardHtml(invalid,id,data,affiliates,ui,locale));
    const wrongPrice=html.replace('14.5 ', '999 ');
    if(id==='magnific')assert.throws(()=>verifyToolCardHtml(wrongPrice,id,data,affiliates,ui,locale));
  }
});

test('离线build三语tools进入sitemap/导航/hreflang/GA，tips零推广，原4条Higgsfield有本语言了解入口',async()=>{
  const out=await mkdtemp(join(tmpdir(),'pcv-tools-'));const previous=globalThis.fetch;
  globalThis.fetch=()=>{throw Error('Network forbidden');};
  try {
    const result=await buildSite({out});assert.equal(result.localizedPages.length,642);assert.equal(result.sitemapUrls.length,633);
    await verifyV053(root,out);
    for(const locale of ['zh','en','ja']) {
      const prefix=locale==='zh'?'':`/${locale}`;
      const html=await readFile(join(out,prefix,'tools.html'),'utf8');
      assert.ok(result.sitemapUrls.includes(`https://punkcanverse.com${prefix}/tools`));
      assert.ok(html.includes(`<link rel="canonical" href="https://punkcanverse.com${prefix}/tools">`));
      assert.ok(html.includes(`<meta property="og:url" content="https://punkcanverse.com${prefix}/tools">`));
      for(const [lang,pre] of [['zh-CN',''],['en','/en'],['ja','/ja'],['x-default','']])assert.ok(html.includes(`<link rel="alternate" hreflang="${lang}" href="https://punkcanverse.com${pre}/tools">`));
      assert.equal(verifyAnalyticsHtml(html),true);assert.ok(html.includes('impact-site-verification'));
      const tips=await readFile(join(out,prefix,'tips.html'),'utf8');
      assert.ok(!tips.includes('class="affiliate-button"'));assert.ok(!tips.includes('GMRPOCT43296'));
      for(const platform of Object.values(affiliates))if(platform.url)assert.ok(!tips.includes(platform.url));
      for(const id of TOOL_IDS)assert.ok(tips.includes(`href="${prefix}/tools#${id}"`));
      for(const id of ['2093988861496168653','2086494563347398669','2051610377306116575','1996925385184104893']) {
        const detail=await readFile(join(out,prefix,'prompts/video',id,'index.html'),'utf8');
        assert.ok(detail.includes(`class="tool-about" href="${prefix}/tools#higgsfield">${i18n.ui[locale].aboutTool}</a>`));
        assert.equal(detail.split(affiliates.higgsfield.url).length-1,1);
      }
    }
  }finally{globalThis.fetch=previous;await rm(out,{recursive:true,force:true});}
});

test('工具页沿用空值和危险网址不渲染推广组件的规则，既有推广码不凭空出现',()=>{
  for(const locale of ['zh','en','ja'])for(const url of ['', 'javascript:alert(1)','data:text/html,no']) {
    const fixture=structuredClone(affiliates);fixture.magnific.url=url;
    const html=renderToolCard('magnific',data,fixture,locale,i18n.ui[locale].tools,cardUI(locale,i18n.ui[locale],i18n.content[locale]).affiliate);
    assert.ok(!html.includes('class="affiliate-button"'));assert.ok(!html.includes('class="tool-cta"'));assert.ok(!html.includes('GMRPOCT43296'));
    assert.ok(html.includes(data.facts.platforms.magnific.pricingUrl.value));
  }
});
