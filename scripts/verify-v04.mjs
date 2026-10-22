import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { listPages, switchHref, publicPath, HTML_LANG, OG_LOCALE } from '../lib/routes.mjs';
import { loadI18n, validateI18n } from '../lib/i18n.mjs';
import { validateWorkflows } from '../lib/workflows.mjs';
import { validateRegionText } from '../lib/regions.mjs';
import { loadEssays } from '../lib/essays.mjs';
import { SITE_PAGES } from '../lib/site-pages.mjs';
import { escapeHtml as e } from '../lib/markdown.mjs';
import { normalizeThumb } from '../lib/thumbs.mjs';
import { verifyAnalyticsHtml } from '../lib/analytics.mjs';

export const SITE_BANNED_TERMS = Object.freeze([/\bweb3\b/i,/\bcrypto\b/i,/\bnft\b/i,/token\s*(?:economy|經濟|经济)/i,/トークン経済/]);
export function validateSiteText(html) {
  for (const term of SITE_BANNED_TERMS) assert.ok(!term.test(html),`Forbidden site term: ${term}`);
}
// Japanese contains kanji, so match actual Chinese UI phrases rather than a
// Unicode block. Exempt original prompts/settings and credited names.
export function validateLocalizedHtml(html, locale, uiZh, entries, {essayFallback=false}={}) {
  if (locale==='zh') return;
  let visible=html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi,'')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  if (essayFallback) visible=visible.replace(/<article class="essay-page">[\s\S]*?<\/article>/,'');
  const accessible=[...visible.matchAll(/\b(?:aria-label|alt|title|placeholder)="([^"]*)"/g)].map(match=>match[1]).join(' ');
  visible=visible.replace(/<[^>]+>/g,' ')+' '+accessible;
  for (const entry of entries) visible=visible.split(e(entry.author)).join('');
  visible=visible.replace(/中文/g,'');
  const chinese=Object.entries(uiZh).filter(([key,value])=>typeof value==='string' && /[\u3400-\u9fff]/u.test(value) && value.length>=4 && !['languageHint','copyright'].includes(key)).map(([,value])=>value);
  // Include short, unambiguous UI terms and complete source titles/notes.
  chinese.push('清除筛选','提示词库','复制失败','查看提示词','原文提示词','推广码','原帖含敏感内容',...entries.map(x=>x.title),...entries.flatMap(x=>x.models).filter(model=>/[\u3400-\u9fff]/u.test(model)),'可靈','海螺');
  for (const value of chinese) assert.ok(!visible.includes(e(value)),`${locale}: Chinese interface residue: ${value}`);
}

export async function verifyV04(root=fileURLToPath(new URL('..',import.meta.url))) {
  const read=path=>readFile(join(root,path),'utf8');
  const {entries}=JSON.parse(await read('data/prompts.json'));
  const {entries:workflows}=JSON.parse(await read('data/workflows.json'));
  const regions=JSON.parse(await read('data/regions.json'));
  const thumbs=JSON.parse(await read('data/thumbs.json'));
  const i18n=await loadI18n(root);
  validateI18n(i18n,entries,workflows,regions);validateWorkflows(workflows);
  const essays=await loadEssays(pathToFileURL(join(root,'content/essays')+'/'));
  const pages=listPages({entries,workflows,essays,sitePages:SITE_PAGES});
  const allFiles=await readdir(join(root,'dist'),{recursive:true});
  assert.deepEqual(allFiles.filter(x=>x.endsWith('.html')).sort(),pages.map(x=>x.file).sort(),'Exact multilingual HTML files');
  for (const page of pages) {
    const html=await read('dist/'+page.file),u=i18n.ui[page.locale];
    assert.match(html,new RegExp(`<html lang="${HTML_LANG[page.locale]}">`));
    const canonicals=[...html.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map(x=>x[1]);
    assert.deepEqual(canonicals,['https://punkcanverse.com'+page.canonical]);
    assert.ok(html.includes(`<meta property="og:url" content="https://punkcanverse.com${page.canonical}">`));
    assert.ok(html.includes(`<meta property="og:locale" content="${OG_LOCALE[page.locale]}">`));
    const alternate=[...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(x=>[x[1],x[2]]);
    assert.deepEqual(alternate,[...page.alternates.map(locale=>[HTML_LANG[locale],'https://punkcanverse.com'+publicPath(locale,page.route)]),['x-default','https://punkcanverse.com'+publicPath(page.essay?.lang||'zh',page.route)]]);
    assert.ok(canonicals.every(url=>!url.endsWith('.html')));
    const switcher=html.match(/<nav class="language-switch"[\s\S]*?<\/nav>/)?.[0];
    for(const locale of ['zh','en','ja']) assert.ok(switcher?.includes(`href="${switchHref(locale,page.route)}" data-language="${locale}"${locale===page.locale?' aria-current="page"':''}`));
    assert.equal((switcher.match(/aria-current="page"/g)||[]).length,1);
    verifyAnalyticsHtml(html);validateSiteText(html);
    validateLocalizedHtml(html,page.locale,i18n.ui.zh,entries,{essayFallback:page.canonical!==page.path});
    assert.match(html, /name='impact-site-verification' value='15021707-94fc-4527-ab33-87c6066da7fd'/);
    const footer=html.match(/<footer\b[\s\S]*?<\/footer>/)?.[0];
    assert.ok(footer.includes(e(u.affiliateDisclosure)) && footer.includes(e(u.copyright)));
    for (const info of SITE_PAGES) assert.ok(footer.includes(`href="${switchHref(page.locale,info.path)}"`));
    for(const disclosure of html.matchAll(/<a href="([^"]+)" class="affiliate-label">/g)) assert.equal(disclosure[1],publicPath(page.locale,'/affiliate-disclosure/'));
    if(page.route.startsWith('/prompts/workflow/')) assert.ok(!/class="affiliate-(links|item|button)"/.test(html));
    if(page.route==='/regions') {
      validateRegionText(JSON.stringify(i18n.content[page.locale].regions));validateRegionText(html);
      assert.ok(html.includes(e(u.regionDisclaimer)));
    }
  }
  for(const workflow of workflows) {
    assert.ok(normalizeThumb(thumbs.entries[workflow.id]),`Workflow requires cached thumbnail: ${workflow.id}`);
    for(const locale of ['zh','en','ja']) {
      const prefix=locale==='zh'?'':locale+'/';
      const detail=await read(`dist/${prefix}prompts/workflow/${workflow.id}/index.html`);
      const listing=await read(`dist/${prefix}prompts/workflow/index.html`);
      assert.ok(detail.includes(`<img src="${e(thumbs.entries[workflow.id].thumb)}"`));
      assert.ok(listing.includes(`<img src="${e(thumbs.entries[workflow.id].thumb)}"`));
      for(const step of workflow.steps) {
        for(const key of ['prompt','settings']) if(step[key]) assert.ok(detail.includes(`<pre class="prompt-text${key==='settings'?' step-settings':''}" tabindex="0">${e(step[key])}</pre>`));
        if(step.prompt===null) assert.ok(detail.includes(e(i18n.ui[locale].promptMissing)));
      }
    }
  }
  const sitemap=await read('dist/sitemap.xml');
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]),pages.filter(x=>x.sitemap).map(x=>'https://punkcanverse.com'+x.path));
  assert.ok(!/<loc>[^<]*\.html<\/loc>/.test(sitemap));
  console.log(`✓ v0.4：${pages.length} 页、三语互指、${workflows.length} 个工作流、翻译完整性与内容边界通过`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await verifyV04();
