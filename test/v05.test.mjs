import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCatalog, mergePrompts, validateImportedPrompts } from '../lib/catalog.mjs';
import { validateImportProvenance, sha256, ORIGINAL_PROMPTS_SHA256 } from '../lib/import-provenance.mjs';
import { buildSite } from '../build.mjs';
import { renderCard, renderPostMedia, renderPromptDetail, promptHtml } from '../lib/cards.mjs';
import { loadI18n, cardUI, localizeEntry, validateI18n } from '../lib/i18n.mjs';
import { getCopyText, filterEntries } from '../lib/prompts.mjs';
import { getEmbedUrl, getPostNotice } from '../lib/posts.mjs';
import { renderAffiliates } from '../lib/affiliates.mjs';
import { escapeHtml as e } from '../lib/markdown.mjs';
import { localizedCopyText } from '../web/language.mjs';
import { runFetchThumbs } from '../scripts/fetch-thumbs.mjs';
import { validateSiteText, validateLocalizedHtml } from '../scripts/verify-v04.mjs';
import { verifyV05 } from '../scripts/verify-v05.mjs';
import { createEmbeds } from '../web/embeds.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const json=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const {original,imported,entries}=await loadCatalog(root);
const manifest=await json('test/fixtures/v05-source-manifest.json');
const i18n=await loadI18n(root);
const x=imported.entries.find(entry=>entry.source==='x');
const official=imported.entries.find(entry=>entry.source==='official');

test('v0.5 两档精确合并 192；原档 63 字节不变，新档 129（X106／官方23、Wan113／MiniMax16、精选26）',async()=>{
  // v0.5.1 spec change (boss 2026-10-22): full prompt text on every page
  assert.equal(sha256(await readFile(join(root,'data/prompts.json'),'utf8')),ORIGINAL_PROMPTS_SHA256);
  assert.equal(original.count,63);assert.equal(original.entries.length,63);
  assert.equal(imported.count,129);assert.equal(entries.length,192);
  assert.equal(new Set(entries.map(row=>row.id)).size,192);
  assert.deepEqual(entries.slice(0,63),original.entries);
  assert.deepEqual(entries.slice(63),imported.entries);
  assert.equal(imported.entries.filter(row=>row.source==='official').length,23);
  assert.equal(imported.entries.filter(row=>row.source==='x').length,106);
  assert.equal(filterEntries(imported.entries,{models:['Wan']}).length,113);
  assert.equal(filterEntries(imported.entries,{models:['MiniMax']}).length,16);
  assert.equal(imported.entries.filter(row=>row.featured).length,26);
  assert.equal(imported.entries.filter(row=>row.modelVersion==='Wan 3.0 Prime').length,5);
  assert.throws(()=>mergePrompts(original.entries,[original.entries[0]]),/Duplicate/);
});

test('v0.5 所有原文／300字摘录、长度、作者、出处、日期与来源指纹精确一致；坏原文与长度会失败',()=>{
  validateImportProvenance(imported,manifest);
  for(const entry of imported.entries) {
    const row=manifest.find(row=>row.id===entry.id);
    assert.equal(entry.isLong,row.fullLength>1500);
    // v0.5.1 spec change (boss 2026-10-22): full prompt text on every page
    assert.equal(sha256(entry.prompt),row.promptSha256);
    // v0.5.1 spec change (boss 2026-10-22): full prompt text on every page
    assert.equal(getCopyText(entry),entry.prompt);
  }
  const short=imported.entries.findIndex(row=>!row.isLong);
  const long=imported.entries.findIndex(row=>row.isLong);
  for(const index of [short,long]) {
    const fixture=structuredClone(imported),entry=fixture.entries[index],key='prompt';
    entry[key]='x'+entry[key].slice(1);
    assert.throws(()=>validateImportProvenance(fixture,manifest),/verbatim/);
  }
  const fixture=structuredClone(imported);fixture.entries[long].promptLength++;fixture.entries[long].prompt+='x';
  assert.throws(()=>validateImportProvenance(fixture,manifest),/source length/);
});

test('v0.5.1 1500／1501字符仅影响版面标记；两者完整保留和复制',()=>{
  for(const template of [x,official])for(const length of [1500,1501]) {
    const full='字'.repeat(length);
    const entry={...template,promptLength:length,isLong:length>1500,prompt:full,promptExcerpt:null};
    validateImportedPrompts({...imported,count:1,entries:[entry]});
    // v0.5.1 spec change (boss 2026-10-22): full prompt text on every page
    assert.equal(getCopyText(entry),full);
    const invalid=structuredClone(entry);invalid.isLong=!entry.isLong;
    assert.throws(()=>validateImportedPrompts({...imported,count:1,entries:[invalid]}));
  }
});

test('v0.5 官方与 X 分支严格分离：坏 handle／官方网址／重复 ID／官方带 postUrl／假来源都拒绝',()=>{
  const cases=[
    entry=>entry.authorHandle='some_other_author',entry=>entry.authorUrl='https://x.com/other',
    entry=>entry.postUrl=entry.postUrl.replace('/status/','/photo/'),entry=>entry.id='123-1',
    entry=>entry.id='123-02',entry=>entry.id='123-2-more',entry=>entry.embedId='999',
    entry=>entry.officialUrl='https://help.aliyun.com/anything',entry=>entry.source='invented',
  ];
  for(const mutate of cases) {const fixture=structuredClone(imported);mutate(fixture.entries.find(row=>row.id===x.id));assert.throws(()=>validateImportedPrompts(fixture));}
  for(const mutate of [
    entry=>entry.officialUrl='https://help.aliyun.com.evil.test/x',
    entry=>entry.officialUrl='http://help.aliyun.com/x',
    entry=>entry.officialUrl='https://user@help.aliyun.com/x',
    entry=>entry.officialUrl='https://help.aliyun.com:443/x',
    entry=>entry.postUrl='https://x.com/creator/status/123',
    entry=>entry.authorHandle='creator',entry=>entry.embedId='123',entry=>entry.author='Other',
    entry=>entry.id='aliyun-wan3-Uppercase',entry=>entry.tags=['官方示例'],
  ]) {
    const fixture=structuredClone(imported);mutate(fixture.entries[0]);assert.throws(()=>validateImportedPrompts(fixture));
  }
  const duplicate=structuredClone(imported);duplicate.entries[1].id=duplicate.entries[0].id;assert.throws(()=>validateImportedPrompts(duplicate),/duplicate/);
  const invalidDate=structuredClone(imported);invalidDate.entries[0].date='2026-02-30';assert.throws(()=>validateImportedPrompts(invalidDate),/date/);
});

test('v0.5 Kangaikroto 两段提示词独立 ID、同帖嵌入与链接；错 embedId、缺段一、错作者失败',()=>{
  const first=entries.find(row=>row.id==='2104507931337400770');
  const second=entries.find(row=>row.id==='2104507931337400770-2');
  assert.ok(first&&second);
  // v0.5.1 spec change (boss 2026-10-22): full prompt text on every page
  assert.notEqual(first.prompt,second.prompt);
  assert.equal(first.embedId,'2104507931337400770');assert.equal(second.embedId,first.embedId);
  assert.equal(first.postUrl,second.postUrl);
  assert.equal(getEmbedUrl(first),first.postUrl);assert.equal(getEmbedUrl(second),first.postUrl);
  assert.equal(getPostNotice(first),'');assert.ok(getPostNotice(second).includes('同帖不同段'));
  for(const mutate of [
    data=>data.entries.find(row=>row.id===second.id).embedId='2104507931337400771',
    data=>{data.entries=data.entries.filter(row=>row.id!==first.id);data.count--;},
    data=>{const row=data.entries.find(row=>row.id===second.id);row.authorHandle='other';row.authorUrl='https://x.com/other';row.postUrl='https://x.com/other/status/2104507931337400770';},
  ]) {const fixture=structuredClone(imported);mutate(fixture);assert.throws(()=>validateImportedPrompts(fixture));}
});

test('v0.5 三语官方占位无图片／X 模板／推广；原文保留，长文复制与阅读全文都指官方出处',()=>{
  for(const locale of ['zh','en','ja']) {
    const ui=cardUI(locale,i18n.ui[locale],i18n.content[locale]);
    for(const entry of imported.entries.filter(row=>row.source==='official')) {
      const localized=localizeEntry(entry,locale,i18n.content[locale]);
      const card=renderCard(localized,0,{},undefined,ui);
      const detail=renderPromptDetail(localized,[],{},undefined,ui);
      for(const html of [card,detail]) {
        // v0.5.2 spec change (boss 2026-10-22): real official sample frames
        if(entry.officialThumb) {
          assert.equal((html.match(/<img\b/g)||[]).length,1);
          assert.ok(html.includes(`<img src="${entry.officialThumb.src}"`));
          assert.ok(!html.includes('class="official-preview"'));
        } else {assert.ok(html.includes('class="official-preview"'));assert.ok(!/<img\b/.test(html));}
        assert.ok(html.includes(e(i18n.ui[locale].officialAuthor)));
        assert.ok(html.includes(`href="${entry.officialUrl}" target="_blank" rel="noopener noreferrer"`));
        // v0.5.2 spec change (boss 2026-10-22): real official sample frames
        assert.ok(!/twitter-tweet|tweet-template|tweet-mount|data-play-embed|pbs\.twimg\.com|widgets\.js|platform\.twitter\.com|class="affiliate-button"/.test(html));
        // v0.5.1 spec change (boss 2026-10-22): full prompt text on every page
        assert.ok(html.includes(promptHtml(entry)));
      }
      assert.equal(getEmbedUrl(entry),null);
      // v0.5.1 spec change (boss 2026-10-22): full prompt text on every page
      assert.equal(localizedCopyText(entry,i18n.ui[locale].fullVersion),entry.prompt);
      if(entry.isLong)assert.ok(detail.includes(e(i18n.ui[locale].officialLink)));
    }
  }
});

test('v0.5 新资料一律零推广，即使 fixture 给 Wan/MiniMax 配网址；原有 Higgsfield 四条不变',async()=>{
  const affiliates=await json('data/affiliates.json');
  const fixture={...affiliates,wan:{name:'Wan',url:'https://example.test/wan',models:['Wan']},minimax:{name:'MiniMax',url:'https://example.test/minimax',models:['MiniMax']}};
  for(const entry of imported.entries)assert.equal(renderAffiliates(entry,fixture),'');
  assert.deepEqual(original.entries.filter(entry=>renderAffiliates(entry,affiliates)).map(row=>row.id),['2093988861496168653','2086494563347398669','2051610377306116575','1996925385184104893']);
});

test('v0.5 三语完整覆盖 192、标签及新 UI；精选只标26条新卡，缺图照常占位',async()=>{
  validateI18n(i18n,entries,(await json('data/workflows.json')).entries,await json('data/regions.json'));
  validateSiteText(JSON.stringify(imported));
  for(const locale of ['zh','en','ja']) {
    const ui=cardUI(locale,i18n.ui[locale],i18n.content[locale]);let featured=0;
    for(const entry of imported.entries) {
      const localized=localizeEntry(entry,locale,i18n.content[locale]);
      const html=renderCard(localized,0,{},undefined,ui);
      validateSiteText(html);validateLocalizedHtml(html,locale,i18n.ui.zh,entries);
      assert.equal(html.includes(e(i18n.ui[locale].importFeaturedMark)),entry.featured);
      if(entry.featured)featured++;
    }
    assert.equal(featured,26);
    const pixel=entries.find(row=>row.id==='2110747397441917172');
    const html=renderPostMedia(localizeEntry(pixel,locale,i18n.content[locale]),{status:'missing'},ui);
    assert.ok(html.includes('thumbnail-placeholder'));assert.ok(!html.includes('<img'));
    assert.ok(html.includes('class="tweet-template"'));
  }
  assert.ok(i18n.content.en.prompts['2104269342275698713'].description.includes('couch co-op'));
  assert.ok(!/球場|court/.test(i18n.content.zh.prompts['2104269342275698713'].description));
});

test('v0.5 抓图合并两档与工作流、排除官方，分段用 embedId；失败保留旧值且 missing-only 跳过缓存',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pcv-v05-thumbs-'));
  try {
    await mkdir(join(dir,'data'));
    await writeFile(join(dir,'data/prompts.json'),JSON.stringify({entries:[{id:'1'}]}));
    await writeFile(join(dir,'data/prompts-wan-minimax.json'),JSON.stringify({entries:[{id:'2',source:'x'},{id:'2-2',embedId:'2',source:'x'},{id:'aliyun-wan3-test',source:'official'}]}));
    await writeFile(join(dir,'data/workflows.json'),JSON.stringify({entries:[{id:'3'}]}));
    const cached={postId:'1',status:'ok',source:'syndication',thumb:'https://pbs.twimg.com/media/fixture.jpg',width:1280,height:720,durationMs:19783};
    await writeFile(join(dir,'data/thumbs.json'),JSON.stringify({entries:{'1':cached}}));
    const calls=[],waits=[];
    const fetchImpl=async url=>{
      const id=new URL(url).searchParams.get('id');calls.push(id);
      if(id==='2')return {status:200,json:async()=>({mediaDetails:[{type:'video',media_url_https:'https://pbs.twimg.com/media/second.jpg',original_info:{width:1280,height:720},video_info:{duration_millis:65000}}]})};
      return {status:500};
    };
    await runFetchThumbs({root:pathToFileURL(dir+'/'),bearerToken:'',fetchImpl,wait:async ms=>waits.push(ms)});
    assert.deepEqual(calls,['1','2','2','3']);assert.deepEqual(waits,[250,250,250]);
    let updated=JSON.parse(await readFile(join(dir,'data/thumbs.json'),'utf8'));
    for(const [key,value] of Object.entries(cached))assert.deepEqual(updated.entries['1'][key],value);
    assert.equal(updated.entries['1'].lastError,'fetch-unavailable');
    assert.deepEqual(updated.entries['2'],updated.entries['2-2']);
    assert.equal(updated.entries['2'].durationMs,65000);assert.equal(updated.entries['3'].status,'missing');
    assert.ok(!Object.hasOwn(updated.entries,'aliyun-wan3-test'));
    calls.length=0;
    await runFetchThumbs({root:pathToFileURL(dir+'/'),bearerToken:'',fetchImpl,wait:async()=>{},missingOnly:true});
    assert.deepEqual(calls,['3']);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('v0.5 192卡不批量渲染：官方／敏感卡不观察，仅接近画面的X卡载入，图片仍lazy',()=>{
  const observed=new Set(),loads=[];let intersect;
  const window={twttr:{widgets:{load:mount=>loads.push(mount)}},IntersectionObserver:class {
    constructor(callback,options){intersect=callback;assert.equal(options.rootMargin,'320px 0px');}
    observe(card){observed.add(card);}unobserve(card){observed.delete(card);}
  }};
  const document={querySelector:()=>null};
  const slots=entries.map(entry=>{
    const embed=getEmbedUrl(entry);const mount={replaceChildren(value){this.child=value;}};
    return {hidden:false,entry,mount,querySelector:selector=>!embed?null:selector==='.tweet-mount'?mount:{content:{cloneNode:()=>entry.id}}};
  });
  const embeds=createEmbeds({window,document});embeds.update(slots);
  assert.equal(slots.length,192);assert.equal(observed.size,168);assert.equal(loads.length,0);
  const nearby=[slots[0],slots[1]];
  intersect(nearby.map(target=>({target,isIntersecting:true})));
  assert.deepEqual(loads,nearby.map(slot=>slot.mount));
  embeds.update(slots);intersect([{target:slots[0],isIntersecting:true}]);assert.equal(loads.length,2);
  const thumb={status:'ok',thumb:'https://pbs.twimg.com/media/offline-fixture.jpg',width:1280,height:720,durationMs:19783};
  for(const entry of entries.filter(entry=>entry.source!=='official')) {
    const media=renderPostMedia(entry,thumb);
    assert.ok(media.includes('loading="lazy" decoding="async"'));
    assert.ok(media.includes('class="duration">0:19</span>'));
    assert.ok(!/<script\b/.test(media));
  }
});

test('v0.5 离线 build：636页／630 sitemap，首页与视频192、FIGHT原63，129条三语详情通过专用 verify',async()=>{
  const out=await mkdtemp(join(tmpdir(),'pcv-v05-build-'));
  const fixtureRoot=await mkdtemp(join(tmpdir(),'pcv-v05-verify-'));
  const originalFetch=globalThis.fetch;
  globalThis.fetch=()=>assert.fail('Build and verify must not make network requests');
  try {
    const result=await buildSite({out});
    // v0.5.3 spec change (boss 2026-10-23): tool list page
    assert.equal(result.localizedPages.length,639);assert.equal(result.sitemapUrls.length,633);
    const {symlink}=await import('node:fs/promises');
    await symlink(out,join(fixtureRoot,'dist'));
    await symlink(join(root,'data'),join(fixtureRoot,'data'));
    await symlink(join(root,'test'),join(fixtureRoot,'test'));
    await verifyV05(fixtureRoot);
  } finally {globalThis.fetch=originalFetch;await rm(fixtureRoot,{recursive:true,force:true});await rm(out,{recursive:true,force:true});}
});
