import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { fetchThumbs, runFetchThumbs } from '../scripts/fetch-thumbs.mjs';
import { formatDuration } from '../lib/thumbs.mjs';
import { renderCard, renderPostMedia, renderPromptDetail } from '../lib/cards.mjs';
import { renderMediaTabs, relatedPrompts } from '../lib/media-tabs.mjs';
import { getEmbedUrl, validatePostMetadata } from '../lib/posts.mjs';
import { renderRecommendedTools } from '../lib/affiliates.mjs';
import { parseEssay, renderEssay } from '../lib/essays.mjs';
import { buildSite } from '../build.mjs';
import { bindClickEmbeds, loadOfficialWidgets } from '../web/embeds.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const prompts = JSON.parse(await readFile(join(root, 'data/prompts.json'), 'utf8'));
const affiliates = JSON.parse(await readFile(join(root, 'data/affiliates.json'), 'utf8'));
const thumbs = JSON.parse(await readFile(join(root, 'data/thumbs.json'), 'utf8'));
const sample = prompts.entries[0];
const record = thumbs.entries[sample.id];
const reply = prompts.entries.find(entry => entry.embedId);
const sensitive = prompts.entries.find(entry => entry.postStatus === 'sensitive');
const ok = data => ({ status: 200, async json() { return data; } });

test('缩图 API 路径每批最多 100，解析视频预览、照片及片长，不走 syndication', async () => {
  const entries = Array.from({length: 101}, (_, index) => ({id: String(index + 1)}));
  const batches = [];
  const result = await fetchThumbs({entries, bearerToken:'fixture-only', fetchImpl: async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://api.x.com');
    assert.equal(options.headers.Authorization, 'Bearer fixture-only');
    assert.equal(parsed.searchParams.get('expansions'), 'attachments.media_keys');
    assert.ok(parsed.searchParams.get('media.fields').includes('duration_ms'));
    const ids = parsed.searchParams.get('ids').split(','); batches.push(ids.length);
    return ok({data:ids.map(id => ({id,attachments:{media_keys:[id]}})),includes:{media:ids.map(id => ({media_key:id,type:id==='1'?'photo':'video',url:'https://pbs.twimg.com/media/photo.jpg',preview_image_url:'https://pbs.twimg.com/media/video.jpg',duration_ms:19783,width:1280,height:720}))}});
  }});
  assert.deepEqual(batches,[100,1]);
  assert.equal(result.entries['1'].thumb,'https://pbs.twimg.com/media/photo.jpg');
  assert.equal(result.entries['2'].thumb,'https://pbs.twimg.com/media/video.jpg');
  assert.equal(result.entries['2'].durationMs,19783);
  assert.equal(result.entries['2'].width,1280);
});

test('无 token 使用 syndication，优先 embedId，间隔至少 250ms', async () => {
  const calls = [], delays = [];
  const result = await fetchThumbs({entries:[reply,sample],wait:async ms=>delays.push(ms),fetchImpl:async url=>{
    const parsed=new URL(url);calls.push(parsed);
    assert.equal(parsed.origin,'https://cdn.syndication.twimg.com');assert.equal(parsed.searchParams.get('token'),'a');
    return ok({mediaDetails:[{type:'video',media_url_https:record.thumb,original_info:{width:1280,height:720},video_info:{duration_millis:65000}}]});
  }});
  assert.equal(calls[0].searchParams.get('id'),reply.embedId);
  assert.deepEqual(delays,[250]);assert.equal(result.entries[reply.id].durationMs,65000);
});

test('抛错、500、tombstone、无 media 均保留旧缩图、状态、尺寸与片长', async () => {
  for (const fetchImpl of [async()=>{throw Error('network')},async()=>({status:500}),async()=>ok({__typename:'TweetTombstone'}),async()=>ok({})]) {
    const result=await fetchThumbs({entries:[sample],previous:{entries:{[sample.id]:record,orphan:record}},fetchImpl});
    for (const key of Object.keys(record)) assert.deepEqual(result.entries[sample.id][key],record[key]);
    assert.ok(result.entries[sample.id].lastError);assert.deepEqual(result.entries.orphan,record);
    const missing=await fetchThumbs({entries:[sample],fetchImpl});assert.equal(missing.entries[sample.id].status,'missing');
  }
  const api=await fetchThumbs({entries:[sample],previous:{entries:{[sample.id]:record}},bearerToken:'fixture',fetchImpl:async()=>({status:500})});
  assert.equal(api.entries[sample.id].thumb,record.thumb);
});

test('更新脚本全部失败仍正常返回，旧文件不清空；坏缓存保留原字节', async () => {
  const dir=await mkdtemp(join(tmpdir(),'punkcan-fetch-'));
  try {
    await mkdir(join(dir,'data'));
    await writeFile(join(dir,'data/prompts.json'),JSON.stringify({entries:[sample]}));
    await writeFile(join(dir,'data/thumbs.json'),JSON.stringify({entries:{[sample.id]:record}}));
    await runFetchThumbs({root:pathToFileURL(dir+'/'),bearerToken:'',fetchImpl:async()=>{throw Error('fixture')},wait:async()=>{}});
    const updated=JSON.parse(await readFile(join(dir,'data/thumbs.json'),'utf8'));
    assert.equal(updated.entries[sample.id].thumb,record.thumb);
    await writeFile(join(dir,'data/thumbs.json'),'{broken');
    await runFetchThumbs({root:pathToFileURL(dir+'/'),bearerToken:'',fetchImpl:async()=>assert.fail('Bad cache must not fetch')});
    assert.equal(await readFile(join(dir,'data/thumbs.json'),'utf8'),'{broken');
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('片长格式、VIDEO 标记、尺寸、alt、署名与占位', () => {
  assert.equal(formatDuration(19783),'0:19');assert.equal(formatDuration(65000),'1:05');assert.equal(formatDuration(null),'');
  const html=renderCard(sample,0,{},record);
  assert.ok(html.includes('>VIDEO</span>'));assert.ok(html.includes('>0:19</span>'));
  assert.ok(html.includes('loading="lazy" decoding="async" alt="'));assert.ok(html.includes(`width="${record.width}" height="${record.height}"`));
  assert.ok(html.includes(`缩图来自 @${sample.authorHandle} 原帖`));assert.ok(html.includes(`href="${sample.postUrl}"`));
  assert.ok(!renderPostMedia(sample,{status:'missing'}).includes('<img'));
  assert.ok(renderPostMedia(sample).includes('thumbnail-placeholder'));
});

test('敏感原帖显示缓存缩图、外开说明，不嵌入且不标成失效', () => {
  validatePostMetadata(sensitive);assert.equal(getEmbedUrl(sensitive),null);
  const html=renderCard(sensitive,0,{},thumbs.entries[sensitive.id]);
  assert.ok(html.includes('<img'));assert.ok(html.includes('原帖含敏感内容，请到 X 观看'));
  assert.ok(html.includes(`href="${sensitive.postUrl}" target="_blank" rel="noopener noreferrer" class="thumbnail-button"`));
  assert.ok(!/tweet-template|twitter-tweet|tweet-mount|data-embed|watch-link|已失效/.test(html));
});

test('新媒介分页面向三个类别计数，缺 medium 默认 video；旧筛选组件不变', () => {
  const html=renderMediaTabs([{id:'a'},{medium:'video'},{medium:'image'}]);
  assert.ok(html.includes('视频 <b>2</b>'));assert.ok(html.includes('图像 <b>1</b>'));assert.ok(html.includes('音乐 <b>0</b>'));
  assert.ok(html.includes('href="/prompts/music/"'));
});

test('原创拆解与实测只在有内容时渲染，相关提示词排除自身', () => {
  const empty=renderPromptDetail(sample,prompts.entries,{},record);
  assert.ok(!/原创拆解|实测心得|即将推出/.test(empty));
  const html=renderPromptDetail({...sample,breakdown:'**镜头**：保持连续。',notes:'实测记录。'},prompts.entries,{},record);
  assert.ok(html.includes('原创拆解'));assert.ok(html.includes('实测心得'));assert.ok(html.includes('<strong>镜头</strong>'));assert.ok(html.includes('撰文 / Punkcan'));
  assert.equal(relatedPrompts(sample,prompts.entries).length,3);
  assert.ok(relatedPrompts(sample,prompts.entries).every(entry=>entry.id!==sample.id));
});

test('Higgsfield 仅四条有推广，Magnific 只用于推荐工具并显示推广码', () => {
  const ids=[];
  for (const entry of prompts.entries) {
    const html=renderCard(entry,0,affiliates,thumbs.entries[entry.id]);
    if (html.includes('去 Higgsfield 试试')) {ids.push(entry.id);assert.ok(html.includes('rel="sponsored noopener noreferrer"'));}
    assert.ok(!html.includes('referral.magnific.com'));
  }
  assert.deepEqual(ids.sort(),['2093988861496168653','2086494563347398669','2051610377306116575','1996925385184104893'].sort());
  const html=renderRecommendedTools(affiliates);assert.ok(html.includes('推荐工具'));assert.ok(html.includes('推广码 GMRPOCT43296'));assert.ok(html.includes('rel="sponsored noopener noreferrer"'));
});

test('文章 front matter 安全解析，AI 揭露只在 true 时显示', () => {
  const source='---\ntitle: 测试\ndate: 2026-10-21\nsummary: 测试摘要\n---\n正文。';
  const essay=parseEssay(source,'fixture.md');assert.equal(essay.slug,'fixture');
  assert.ok(!renderEssay(essay).includes('AI 辅助整理，作者审校'));
  assert.ok(renderEssay({...essay,aiAssisted:true}).includes('AI 辅助整理，作者审校'));
  assert.throws(()=>parseEssay(source.replace('summary: 测试摘要','slug: ../escape'),'fixture.md'));
});

test('离线 build：63 条独立页、完整 sitemap、无示例文章或模型入口', async () => {
  const dir=await mkdtemp(join(tmpdir(),'punkcan-build-'));const saved=globalThis.fetch;
  globalThis.fetch=()=>assert.fail('Build must not use the network');
  try {
    const result=await buildSite({out:dir});
    for (const entry of prompts.entries) {
      const path=`/prompts/${entry.medium}/${entry.id}/`;
      assert.ok(result.pages.includes(path));assert.ok(result.sitemapUrls.includes('https://punkcanverse.com'+path));
      const html=await readFile(join(dir,path,'index.html'),'utf8');
      assert.ok(html.includes(`<link rel="canonical" href="https://punkcanverse.com${path}">`));
      assert.ok(html.includes(`<meta property="og:url" content="https://punkcanverse.com${path}">`));
      assert.ok(!/白模|\/models\//.test(html));
      assert.ok(html.includes('PUNKCANVERSE'));assert.ok(!html.includes('src="https://platform.twitter.com/widgets.js"'));
    }
    assert.ok((await readFile(join(dir,'essays/index.html'),'utf8')).includes('作品整理中'));
    assert.equal(result.pages.filter(path=>path.startsWith('/essays/')).length,1);
    assert.ok((await readFile(join(dir,'prompts/image/index.html'),'utf8')).includes('图像提示词整理中'));
    assert.ok(!result.sitemapUrls.some(url=>/\/models\/|\/prompts\/(image|music)\/$/.test(url)));
  } finally { globalThis.fetch=saved;await rm(dir,{recursive:true,force:true}); }
});

test('thumbs 缺失、损坏、missing 记录都不阻止构建且输出占位；文章 fixture 进入列表和 sitemap', async () => {
  const dir=await mkdtemp(join(tmpdir(),'punkcan-fallback-'));
  try {
    const cache=join(dir,'cache.json');const out=join(dir,'out');
    for (const value of [null,'broken',JSON.stringify({entries:{[sample.id]:{status:'missing'}}})]) {
      if (value!==null) await writeFile(cache,value);
      await buildSite({out,thumbPath:cache});
      const html=await readFile(join(out,'index.html'),'utf8');
      // v0.5.2 spec change (boss 2026-10-22): real official sample frames
      const images=[...html.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(match=>match[1]);
      assert.deepEqual(images,Array.from({length:23},(_,i)=>i+1).filter(n=>n!==17).map(n=>`/img/official/aliyun-wan3-example-${String(n).padStart(2,'0')}.webp`));
      assert.ok(html.includes('thumbnail-placeholder'));
    }
    const result=await buildSite({out,essayDirectory:fileURLToPath(new URL('fixtures/essays/',import.meta.url))});
    assert.ok(result.pages.includes('/essays/production-notes/'));
    assert.ok(result.sitemapUrls.includes('https://punkcanverse.com/essays/production-notes/'));
    const html=await readFile(join(out,'essays/production-notes/index.html'),'utf8');assert.ok(html.includes('AI 辅助整理，作者审校'));assert.ok(html.includes('<link rel="canonical" href="https://punkcanverse.com/essays/production-notes/">'));
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('widgets.js 只在请求播放时创建且并发只加载一次', async () => {
  const handlers={};const scripts=[];const window={setTimeout:()=>1,clearTimeout(){}};
  const document={head:{append(script){scripts.push(script)}},createElement(){return {addEventListener(name,fn){handlers[name]=fn},remove(){}}}};
  assert.equal(scripts.length,0);
  const a=loadOfficialWidgets({window,document}),b=loadOfficialWidgets({window,document});
  assert.equal(a,b);assert.equal(scripts.length,1);assert.equal(scripts[0].src,'https://platform.twitter.com/widgets.js');
  window.twttr={widgets:{load(){}}};handlers.load();assert.equal(await a,window.twttr);
});

test('图片加载失败切回同一占位，不使用内联 onerror', () => {
  const listeners={};bindClickEmbeds({window:{},document:{addEventListener(name,fn){listeners[name]=fn}}});
  let failed=false;const button={classList:{add(name){failed=name==='image-failed'}}};
  const img={tagName:'IMG',hidden:false,closest(){return button}};
  listeners.error({target:img});assert.equal(img.hidden,true);assert.equal(failed,true);
});
