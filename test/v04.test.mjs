import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { buildSite } from '../build.mjs';
import { loadI18n, validateI18n, localizeEntry } from '../lib/i18n.mjs';
import { validateWorkflows, WORKFLOW_BANNED_TERMS } from '../lib/workflows.mjs';
import { REGION_BANNED_TERMS_EN, REGION_BANNED_TERMS_JA, validateRegionText } from '../lib/regions.mjs';
import { renderMediaTabs } from '../lib/media-tabs.mjs';
import { listPages, switchHref, fileForPublic } from '../lib/routes.mjs';
import { loadEssays } from '../lib/essays.mjs';
import { runFetchThumbs } from '../scripts/fetch-thumbs.mjs';
import { validateLocalizedHtml, validateSiteText } from '../scripts/verify-v04.mjs';
import { initLanguage, LANGUAGE_KEY } from '../web/language.mjs';
import { SITE_PAGES } from '../lib/site-pages.mjs';
import { escapeHtml } from '../lib/markdown.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const json=async file=>JSON.parse(await readFile(join(root,file),'utf8'));
const {entries}=await json('data/prompts.json');
const {entries:workflows}=await json('data/workflows.json');
const regions=await json('data/regions.json');
const i18n=await loadI18n(root);
const sample=workflows[0];

test('正式工作流使用 entries 外层，与外部 gate 一致且五条来源完整',async()=>{
  const data=await json('data/workflows.json');
  assert.deepEqual(Object.keys(data),['entries']);
  assert.ok(Array.isArray(data.entries));
  assert.equal(data.entries.length,5);
  assert.deepEqual(data.entries,workflows);
  assert.equal(validateWorkflows(data.entries),true);
});

test('缩图脚本读取正式 entries 工作流，不漏抓或清除失败条目的旧缩图',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pcv-workflow-entries-'));
  const calls=[];
  const previous={entries:{'2':{postId:'2',status:'ok',source:'provided-preview',thumb:'https://pbs.twimg.com/media/fixture.jpg',durationMs:19000}}};
  try {
    await mkdir(join(dir,'data'));
    await writeFile(join(dir,'data/prompts.json'),JSON.stringify({entries:[]}));
    await writeFile(join(dir,'data/workflows.json'),JSON.stringify({entries:[{id:'2'}]}));
    await writeFile(join(dir,'data/thumbs.json'),JSON.stringify(previous));
    await runFetchThumbs({root:pathToFileURL(dir+'/'),bearerToken:'',fetchImpl:async url=>{
      calls.push(new URL(url).searchParams.get('id'));
      return {status:500};
    },wait:async()=>{}});
    assert.deepEqual(calls,['2']);
    const updated=JSON.parse(await readFile(join(dir,'data/thumbs.json'),'utf8'));
    for(const [key,value] of Object.entries(previous.entries['2']))assert.deepEqual(updated.entries['2'][key],value);
    assert.equal(updated.entries['2'].lastError,'fetch-unavailable');
    assert.ok(updated.entries['2'].staleSince);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('三语 UI 精确同键、非空、无占位，63 条提示/工作流/地区/标签完整且译文不照搬中文',()=>{
  assert.equal(validateI18n(i18n,entries,workflows,regions),undefined);
  for(const mutate of [d=>delete d.ui.en.copy,d=>d.ui.ja.copy='',d=>d.ui.en.copy='TODO',d=>d.ui.en.copy=d.ui.zh.copy,d=>delete d.content.en.prompts[entries[0].id],d=>delete d.content.ja.workflows[sample.id].steps['1'],d=>delete d.content.en.regions[regions.entries[0].id],d=>delete d.content.ja.tags[entries[0].tags[0]]]) {
    const fixture=structuredClone(i18n);mutate(fixture);assert.throws(()=>validateI18n(fixture,entries,workflows,regions));
  }
  for(const entry of entries)for(const locale of ['en','ja']) {
    const translated=localizeEntry(entry,locale,i18n.content[locale]);
    assert.equal(translated.prompt,entry.prompt);assert.equal(translated.promptExcerpt,entry.promptExcerpt);
  }
});

test('工作流五条来源指纹：步骤工具、原文 prompt/settings/sourcePost 未改写',()=>{
  assert.deepEqual(workflows.map(x=>x.id),['2083839617237757960','2064046116656586888','2079886296953008156','2079916857403048097','2062650742180114644']);
  const provenance=workflows.map(w=>({id:w.id,steps:w.steps.map(s=>Object.fromEntries(['n','tool','prompt','settings','sourcePost'].map(key=>[key,s[key]??null])))}));
  assert.equal(createHash('sha256').update(JSON.stringify(provenance)).digest('hex'),'e31a2f4c7502389652b0e580272508e42a77e7e581b48d95a1d7970e72f759f5');
  assert.equal(validateWorkflows(workflows),true);assert.equal(validateWorkflows([]),true);
});

test('工作流坏 fixture：ID/作者/原帖/时间/步序/工具链/空内容/异作者来源一律拒绝',()=>{
  for(const mutate of [
    x=>x.push(structuredClone(x[0])),x=>x[0].id='../bad',x=>x[0].id=123,
    x=>x[0].author.handle='@wrong',x=>x[0].author.name='',x=>x[0].author.url='https://x.com/other',
    x=>x[0].postUrl=x[0].postUrl.replace(x[0].id,'123'),x=>x[0].postUrl=x[0].postUrl.replace('x.com','example.com'),
    x=>x[0].date='bad',x=>x[0].title='',x=>x[0].fieldNote='',x=>x[0].steps=x[0].steps.slice(0,1),
    x=>x[0].steps[0].n=2,x=>x[0].steps[0].tool='',x=>x[0].steps[0].role='',
    x=>Object.assign(x[0].steps[0],{prompt:null,settings:' '}),x=>x[0].steps[0].prompt=42,
    x=>x[0].steps[0].settings={},x=>x[0].tools.reverse(),x=>x[0].tools=[],
    x=>x[0].steps[0].sourcePost='https://x.com/other/status/123',x=>x[0].steps[0].sourcePost='javascript:alert(1)',
    x=>x[0].tags=[],x=>x[0].tags=[null],
  ]) {const fixture=structuredClone(workflows);mutate(fixture);assert.throws(()=>validateWorkflows(fixture));}
  for(const word of WORKFLOW_BANNED_TERMS) {
    const fixture=structuredClone(workflows);fixture[0].extra={nested:word};assert.throws(()=>validateWorkflows(fixture));
  }
});

test('英日每个新增禁词出现在翻译资料或 HTML 都失败；全站内容禁词也失败',()=>{
  for(const locale of ['en','ja'])for(const word of [...REGION_BANNED_TERMS_EN,...REGION_BANNED_TERMS_JA]) {
    assert.throws(()=>validateRegionText(JSON.stringify({[locale]:{summary:`Official ${word}`}})));
    assert.throws(()=>validateRegionText(`<article lang="${locale}">${word}</article>`));
  }
  for(const word of ['Web3','crypto','NFT','token economy','token 經濟','トークン経済'])assert.throws(()=>validateSiteText(`<p>${word}</p>`));
  for(const locale of ['en','ja']) assert.throws(()=>validateLocalizedHtml('<p>清除筛选</p>',locale,i18n.ui.zh,entries));
  assert.doesNotThrow(()=>validateLocalizedHtml(`<pre>清除筛选</pre><a>中文</a>`, 'en',i18n.ui.zh,entries));
  assert.throws(()=>validateLocalizedHtml('<button aria-label="清除筛选">Clear</button>','en',i18n.ui.zh,entries));
});

test('路由保持旧文件、canonical 最终路径，四分页面计数且只标记当前列表',()=>{
  assert.equal(switchHref('zh','/tips'),'/tips.html');assert.equal(switchHref('en','/tips'),'/en/tips.html');
  assert.equal(fileForPublic('/ja/regions'),'ja/regions.html');
  const html=renderMediaTabs(entries,'/prompts/workflow/',{workflow:{href:'/prompts/workflow/',label:'工作流',count:5}});
  assert.ok(html.includes('工作流 <b>5</b>'));assert.ok(html.includes('href="/prompts/workflow/" aria-current="page"'));
  assert.equal((html.match(/aria-current/g)||[]).length,1);
});

test('离线三语 build：246 页、五工作流有图/VIDEO/片长/原文复制，零推广，元数据与法律迁移',async()=>{
  const out=await mkdtemp(join(tmpdir(),'pcv-v04-'));const originalFetch=globalThis.fetch;
  globalThis.fetch=()=>assert.fail('No network in build/test');
  try {
    const result=await buildSite({out});assert.equal(result.localizedPages.length,246);
    const files=await readdir(out,{recursive:true});assert.equal(files.filter(x=>x.endsWith('.html')).length,246);
    for(const page of result.localizedPages) {
      const html=await readFile(join(out,page.file),'utf8');
      assert.ok(html.includes(`<link rel="canonical" href="https://punkcanverse.com${page.canonical}">`));
      validateLocalizedHtml(html,page.locale,i18n.ui.zh,entries);validateSiteText(html);
      const alternates=[...html.matchAll(/hreflang="([^"]+)"/g)].map(x=>x[1]);assert.deepEqual(alternates,['zh-CN','en','ja','x-default']);
    }
    for(const locale of ['zh','en','ja']) {
      const prefix=locale==='zh'?'':locale+'/';const ui=i18n.ui[locale];
      const listing=await readFile(join(out,prefix,'prompts/workflow/index.html'),'utf8');
      assert.equal((listing.match(/class="prompt-card workflow-card"/g)||[]).length,5);
      assert.equal((listing.match(/<img /g)||[]).length,5);
      assert.ok(!/class="affiliate-(links|item|button)"/.test(listing));
      for(const workflow of workflows) {
        const html=await readFile(join(out,prefix,`prompts/workflow/${workflow.id}/index.html`),'utf8');
        assert.ok(html.includes('>VIDEO</span>'));assert.ok(/class="duration">\d+:\d{2}<\/span>/.test(html));
        assert.ok(html.includes(`href="${workflow.postUrl}"`));assert.ok(html.includes(`@${workflow.author.handle}`));
        assert.ok(html.includes('data-copy-block'));assert.ok(html.includes('data-play-embed'));
        for(const step of workflow.steps)for(const key of ['prompt','settings'])if(step[key])assert.ok(html.includes(escapeHtml(step[key])));
        if(workflow.steps.some(s=>s.prompt===null))assert.ok(html.includes(escapeHtml(ui.promptMissing)));
        assert.ok(!/class="affiliate-(links|item|button)"/.test(html));
      }
      const about=await readFile(join(out,prefix,'about/index.html'),'utf8');assert.ok(about.includes(ui.legal.about.title));
      assert.ok(about.includes('2026-10-22'));
      const tips=await readFile(join(out,prefix,'tips.html'),'utf8');assert.ok(tips.includes('GMRPOCT43296'));
      assert.ok(tips.includes(`href="/${prefix}affiliate-disclosure/" class="affiliate-label"`));
    }
    const english=await readFile(join(out,'en/about/index.html'),'utf8');assert.ok(english.includes(i18n.ui.en.legal.about.body));
    assert.ok(result.sitemapUrls.every(url=>!url.endsWith('.html')));
    assert.equal(result.sitemapUrls.filter(url=>/\/prompts\/workflow\/\d+\/$/.test(url)).length,15);
  } finally {globalThis.fetch=originalFetch;await rm(out,{recursive:true,force:true});}
});

test('空工作流 fixture：三语仍有第4分页与0计数、即将推出说明、无空卡片和详情 sitemap',async()=>{
  const out=await mkdtemp(join(tmpdir(),'pcv-no-workflows-'));
  try {
    const result=await buildSite({out,workflows:[]});
    for(const locale of ['zh','en','ja']) {
      const prefix=locale==='zh'?'':locale+'/';
      const html=await readFile(join(out,prefix,'prompts/workflow/index.html'),'utf8');
      assert.ok(html.includes(`${i18n.ui[locale].workflow} <b>0</b>`));assert.ok(html.includes(i18n.ui[locale].comingSoon));
      assert.ok(!html.includes('workflow-card'));
    }
    assert.ok(!result.sitemapUrls.some(url=>/\/prompts\/workflow\/\d+\//.test(url)));
  } finally {await rm(out,{recursive:true,force:true});}
});

test('文章 fixture：翻译不额外变文章、缺译显示原文且 canonical 指原文，hreflang 只含真实译本',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pcv-essay-languages-'));const content=join(dir,'essays');const out=join(dir,'out');
  const essay=(title,body,lang='zh')=>`---\ntitle: ${title}\nsummary: ${title}\ndate: 2026-10-22\nlang: ${lang}\n---\n${body}`;
  try {
    await mkdir(content);await writeFile(join(content,'field.md'),essay('原文标题','原文内容。'));
    let essays=await loadEssays(pathToFileURL(content+'/'));assert.equal(essays.length,1);
    let result=await buildSite({out,essayDirectory:content});
    let fallback=await readFile(join(out,'en/essays/field/index.html'),'utf8');
    assert.ok(fallback.includes(escapeHtml(i18n.ui.en.untranslated)));
    assert.ok(fallback.includes('<link rel="canonical" href="https://punkcanverse.com/essays/field/">'));
    assert.ok(!fallback.includes('hreflang="en"'));assert.ok(!result.sitemapUrls.includes('https://punkcanverse.com/en/essays/field/'));
    await writeFile(join(content,'field.en.md'),essay('Field notes','The translated essay.','en'));
    essays=await loadEssays(pathToFileURL(content+'/'));assert.equal(essays.length,1);assert.equal(essays[0].translations.en.lang,'en');
    result=await buildSite({out,essayDirectory:content});
    const english=await readFile(join(out,'en/essays/field/index.html'),'utf8');
    assert.ok(english.includes('The translated essay.'));assert.ok(!english.includes('untranslated-notice'));
    assert.ok(english.includes('<link rel="canonical" href="https://punkcanverse.com/en/essays/field/">'));
    assert.ok(english.includes('hreflang="en"'));assert.ok(!english.includes('hreflang="ja"'));
    assert.ok(result.sitemapUrls.includes('https://punkcanverse.com/en/essays/field/'));
    fallback=await readFile(join(out,'ja/essays/field/index.html'),'utf8');assert.ok(fallback.includes(escapeHtml(i18n.ui.ja.untranslated)));
    assert.ok(!result.sitemapUrls.includes('https://punkcanverse.com/ja/essays/field/'));
    const descriptors=listPages({entries,workflows,essays,sitePages:SITE_PAGES});
    assert.equal(descriptors.filter(x=>x.essay&&x.sitemap).length,2);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('缩图更新包含工作流，与影片共用 syndication、250ms 与失败保留规则',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pcv-workflow-thumbs-'));const calls=[],waits=[];
  try {
    await mkdir(join(dir,'data'));await writeFile(join(dir,'data/prompts.json'),JSON.stringify({entries:[{id:'1'}]}));
    await writeFile(join(dir,'data/workflows.json'),JSON.stringify({workflows:[{id:'2'}]}));
    await writeFile(join(dir,'data/thumbs.json'),JSON.stringify({entries:{'2':{postId:'2',status:'ok',source:'provided-preview',thumb:'https://pbs.twimg.com/media/fixture.jpg',durationMs:19000}}}));
    const fetchImpl=async url=>{calls.push(new URL(url).searchParams.get('id'));return {status:500};};
    await runFetchThumbs({root:pathToFileURL(dir+'/'),bearerToken:'',fetchImpl,wait:async n=>waits.push(n)});
    assert.deepEqual(calls,['1','2']);assert.deepEqual(waits,[250]);
    const data=JSON.parse(await readFile(join(dir,'data/thumbs.json'),'utf8'));
    assert.equal(data.entries['1'].status,'missing');assert.equal(data.entries['2'].thumb,'https://pbs.twimg.com/media/fixture.jpg');assert.equal(data.entries['2'].durationMs,19000);
  } finally {await rm(dir,{recursive:true,force:true});}
});

function languageFixture(preferred,{throws=false,current='zh'}={}) {
  const handlers={},writes=[];const make=(locale,href)=>({dataset:{language:locale},href,addEventListener(type,fn){handlers[locale]=fn;}});
  const links=[make('zh','/tips.html'),make('en','/en/tips.html'),make('ja','/ja/tips.html')];
  const target={};const hint={hidden:true,querySelector:selector=>selector==='[data-preferred-language]'?target:{addEventListener(type,fn){handlers.dismiss=fn;}}};
  const document={body:{dataset:{locale:current}},querySelectorAll:()=>links,querySelector:()=>hint};
  const window={localStorage:{getItem(key){assert.equal(key,LANGUAGE_KEY);if(throws)throw Error();return preferred;},setItem(key,value){if(throws)throw Error();writes.push([key,value]);}}};
  Object.defineProperty(window,'location',{get(){assert.fail('Language code must never redirect');}});
  initLanguage({window,document});return {handlers,writes,hint,target};
}
test('语言切换只存偏好，不自动转址；提示同页目标、可关闭、存储不可用也正常',()=>{
  const f=languageFixture('ja');assert.equal(f.hint.hidden,false);assert.equal(f.target.href,'/ja/tips.html');assert.equal(f.target.textContent,'日本語版で見る →');
  f.handlers.dismiss();assert.equal(f.hint.hidden,true);f.handlers.en();assert.deepEqual(f.writes,[[LANGUAGE_KEY,'en']]);
  for(const preferred of ['zh','invalid',null])assert.equal(languageFixture(preferred).hint.hidden,true);
  const blocked=languageFixture('ja',{throws:true});assert.equal(blocked.hint.hidden,true);assert.doesNotThrow(()=>blocked.handlers.en());
});

test('步骤和代码复制原文；短/长提示词仅在链接前缀使用本语言',async()=>{
  const {workflowCopyText,localizedCopyText}=await import('../web/language.mjs');
  const raw='Original 原文\n  keep spaces';
  assert.equal(workflowCopyText({querySelector:selector=>{assert.equal(selector,'pre');return {textContent:raw};}}),raw);
  const short=entries.find(x=>!x.isLong),long=entries.find(x=>x.isLong);
  for(const locale of ['zh','en','ja']) {
    assert.equal(localizedCopyText(short,i18n.ui[locale].fullVersion),short.prompt);
    assert.equal(localizedCopyText(long,i18n.ui[locale].fullVersion),`${long.promptExcerpt}\n${i18n.ui[locale].fullVersion}${long.postUrl}`);
  }
});

test('X 失败提示与 Markdown 工具列使用当前语言，保留手动观看与图片回退',async()=>{
  const {bindClickEmbeds}=await import('../web/embeds.mjs');
  const {markdownToHtml}=await import('../lib/markdown.mjs');
  for(const locale of ['en','ja']) {
    const ui=i18n.ui[locale],handlers={};let error;
    const mount={hidden:false,replaceChildren(){}};
    const slot={querySelector(selector){return selector==='.tweet-mount'?mount:selector==='.tweet-template'?{}:error;},append(node){error=node;}};
    const button={disabled:false,hidden:false,closest(){return slot;},setAttribute(){},removeAttribute(){}};
    bindClickEmbeds({window:{},document:{addEventListener(name,fn){handlers[name]=fn;},createElement(){return {setAttribute(){}};}},loadWidgets:async()=>{throw Error('fixture');},errorText:ui.embedFailed});
    await handlers.click({target:{closest(){return button;}}});
    assert.equal(error.textContent,ui.embedFailed);assert.equal(button.disabled,false);assert.equal(button.hidden,false);assert.equal(mount.hidden,true);
    const html=markdownToHtml('```\noriginal\n```\n\n| A | B |\n|---|---|\n| a | b |',{copyLabel:ui.copy,codeLabel:ui.codeExample,tableLabel:ui.tableAria});
    assert.ok(html.includes(`>${ui.copy}</button>`));assert.ok(html.includes(`aria-label="${ui.tableAria}"`));assert.ok(html.includes(ui.codeExample));
  }
});

test('五页英文法律标题、摘要、正文与 v0.3 指纹一致，输出只调整本语言连结',async()=>{
  const copy=SITE_PAGES.map(page=>i18n.ui.en.legal[page.path.slice(1,-1)]);
  assert.equal(createHash('sha256').update(JSON.stringify(copy)).digest('hex'),'39fd339712e7e10465018e5fbf05e7ba8eddb5f13dcbac9be782030bfa4c2201');
  const out=await mkdtemp(join(tmpdir(),'pcv-legal-languages-'));
  try {
    await buildSite({out});
    for(const page of SITE_PAGES) {
      const legal=i18n.ui.en.legal[page.path.slice(1,-1)];
      const html=await readFile(join(out,'en',page.path,'index.html'),'utf8');
      const scoped=legal.body.replace(/href="\/(?!\/)([^"]*)"/g,'href="/en/$1"');
      assert.ok(html.includes(scoped),page.path);
    }
  } finally {await rm(out,{recursive:true,force:true});}
});
