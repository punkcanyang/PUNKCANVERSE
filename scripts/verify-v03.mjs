import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promptPath, MEDIUM_NAMES } from '../lib/media-tabs.mjs';
import { loadEssays } from '../lib/essays.mjs';
import { normalizeThumb } from '../lib/thumbs.mjs';
import { AFFILIATE_DISCLOSURE } from '../lib/affiliates.mjs';
import { escapeHtml } from '../lib/markdown.mjs';
import { validateRegions, validateRegionText } from '../lib/regions.mjs';
import { GA_SCRIPT_URL, verifyAnalyticsHtml } from '../lib/analytics.mjs';
import { listPages, fileForPublic } from '../lib/routes.mjs';
import { loadI18n } from '../lib/i18n.mjs';
import { SITE_PAGES } from '../lib/site-pages.mjs';

export async function verifyV03(root = fileURLToPath(new URL('..', import.meta.url))) {
  const dist = join(root,'dist');
  const read = path => readFile(path,'utf8');
  const { entries } = JSON.parse(await read(join(root,'data/prompts.json')));
  const affiliates = JSON.parse(await read(join(root,'data/affiliates.json')));
  const site = JSON.parse(await read(join(root,'data/site.json')));
  const essays = await loadEssays(pathToFileURL(join(root,'content/essays')+'/'));
  const workflows=JSON.parse(await read(join(root,'data/workflows.json'))).entries;
  const translations=await loadI18n(root);
  // v0.4 spec change (boss 2026-10-22): exact final URLs, all three locales and workflows.
  const descriptors=listPages({entries,workflows,essays,sitePages:SITE_PAGES});
  const expected=descriptors.filter(page=>page.sitemap).map(page=>page.path);
  const urls = [...(await read(join(dist,'sitemap.xml'))).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]);
  assert.deepEqual(urls,expected.map(path=>'https://punkcanverse.com'+path),'Sitemap must list every real public page exactly once');
  const paths=descriptors.map(page=>page.path);
  const affiliateUrls = new Set(Object.values(affiliates).map(platform=>platform.url).filter(Boolean).map(escapeHtml));
  const htmlFiles=[];
  async function walk(dir) {
    for (const file of await readdir(dir,{withFileTypes:true})) {
      const path=join(dir,file.name);
      if(file.isDirectory()) await walk(path); else if(file.name.endsWith('.html'))htmlFiles.push(path);
    }
  }
  await walk(dist);
  assert.equal(htmlFiles.length,paths.length,'No unexpected HTML pages');
  for (const path of paths) {
    const file=join(dist,fileForPublic(path));
    const locale=descriptors.find(page=>page.path===path).locale;
    const ui=translations.ui[locale];
    // v0.4 spec change (boss 2026-10-22): untranslated essays point to their original.
    const canonicalPath=descriptors.find(page=>page.path===path).canonical;
    assert.ok((await stat(file)).isFile());
    const html=await read(file);
    assert.ok(html.includes(`<link rel="canonical" href="https://punkcanverse.com${canonicalPath}">`),path);
    assert.ok(html.includes(`<meta property="og:url" content="https://punkcanverse.com${canonicalPath}">`),path);
    assert.match(html,/<title>[^<]+ · PUNKCANVERSE<\/title>/);
    assert.ok(html.includes('<meta property="og:site_name" content="PUNKCANVERSE">'));
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
    if(locale==='zh') {
      assert.ok(html.includes('https://x.com/punkcan') && html.includes(AFFILIATE_DISCLOSURE));
      assert.ok(html.includes('缩图同样直接引用 X 原图，不转存。'));
    } else {
      assert.ok(html.includes('https://x.com/punkcan') && html.includes(escapeHtml(ui.affiliateDisclosure)));
      assert.ok(html.includes(escapeHtml(ui.copyright)));
    }
    verifyAnalyticsHtml(html);
    const external=[...html.matchAll(/<script\b[^>]*src="(https?:\/\/[^"]+)"[^>]*>/gi)].map(match=>match[1]);
    assert.deepEqual(external,[GA_SCRIPT_URL],'Only the approved Google tag may be preloaded; X remains interaction-only');
    assert.ok(!/<video\b|<source\b|\sonerror\s*=/i.test(html));
    for(const mail of html.matchAll(/mailto:([^"'<>\s]+)/gi))assert.equal(mail[1],'hello@punkcanverse.com');
    const footer=html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0];
    if(locale==='zh') {
      for(const info of SITE_PAGES)assert.ok(footer?.includes(`href="${info.path}"`));
    } else for(const info of SITE_PAGES)assert.ok(footer?.includes(`href="/${locale}${info.path}"`));
    if(site.models?.enabled===false)assert.ok(!/白模|\/models\//.test(html),path);
    if(!site.newsletter.enabled)assert.ok(!/class="newsletter"|href="[^"]*newsletter/.test(html));
    for (const match of html.matchAll(/<img\b[^>]*>/g)) {
      assert.match(match[0],/src="https:\/\/pbs\.twimg\.com\//);
      for(const attribute of ['width="','height="','alt="','loading="lazy"','decoding="async"'])assert.ok(match[0].includes(attribute));
    }
    for(const match of html.matchAll(/<a\b[^>]*>/g)) {
      const href=match[0].match(/href="([^"]+)"/)?.[1];
      if(affiliateUrls.has(href)) {
        assert.match(match[0],/rel="[^"]*\bsponsored\b[^\"]*"/);
        assert.match(match[0],/target="_blank"/);
        assert.match(match[0],/rel="sponsored noopener noreferrer"/);
      }
    }
    if(locale==='zh') {
      if(html.includes(affiliates.magnific.url))assert.equal(relative(dist,file),'tips.html','Magnific belongs only in recommended tools');
    } else if(html.includes(affiliates.magnific.url))assert.equal(relative(dist,file),`${locale}/tips.html`,'Magnific belongs only in localized recommended tools');
  }
  for(const entry of entries) {
    const html=await read(join(dist,promptPath(entry),'index.html'));
    assert.ok(html.includes(`data-copy-entry="${entry.id}"`));
    assert.ok(html.includes(escapeHtml(entry.isLong?entry.promptExcerpt:entry.prompt)));
    if(['removed','sensitive'].includes(entry.postStatus))assert.ok(!/tweet-template|twitter-tweet|tweet-mount|data-embed|watch-link/.test(html));
    if(entry.postStatus==='sensitive')assert.ok(html.includes('原帖含敏感内容，请到 X 观看')&&!html.includes('已失效'));
    assert.equal(html.includes('去 Higgsfield 试试'),entry.models.includes('Higgsfield（平台）'));
    if(!entry.breakdown?.trim())assert.ok(!html.includes('原创拆解'));
    if(!entry.notes?.trim())assert.ok(!html.includes('实测心得'));
    assert.equal((html.match(/<section class="related">[\s\S]*?<\/section>/)?.[0].match(/<a href=/g)||[]).length,3);
  }
  const cache=JSON.parse(await read(join(root,'data/thumbs.json')));
  const allowed=new Set(['postId','status','source','mediaType','thumb','width','height','durationMs','lastError','staleSince']);
  for(const entry of entries) {
    const record=cache.entries[entry.id];assert.ok(normalizeThumb(record),`Initial thumbnail missing: ${entry.id}`);
    assert.ok(Object.keys(record).every(key=>allowed.has(key)),'Thumbnail metadata must not contain author/account fields');
    assert.equal(record.postId,entry.embedId||entry.id);
  }
  const regionData=JSON.parse(await read(join(root,'data/regions.json')));
  validateRegions(regionData);validateRegionText(await read(join(dist,'regions.html')));
  if(!essays.length)assert.ok((await read(join(dist,'essays/index.html'))).includes('即将推出'));
  const script=await read(join(dist,'assets/embeds.mjs'));
  assert.ok(script.includes("script.src = 'https://platform.twitter.com/widgets.js'"));
  console.log(`✓ v0.3：${paths.length} 页、63 条详情、缩图、延迟嵌入、推广属性、sitemap 与内容边界校验通过`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await verifyV03();
