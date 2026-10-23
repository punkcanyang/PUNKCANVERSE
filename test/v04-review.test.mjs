import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildSite } from '../build.mjs';
import { loadI18n, translateModelName, localizeEntry, validateGuideTranslation } from '../lib/i18n.mjs';
import { validateLocalizedHtml } from '../scripts/verify-v04.mjs';
import { initLanguage, LANGUAGE_KEY, LANGUAGE_HINT_DISMISS_KEY } from '../web/language.mjs';
import { escapeHtml } from '../lib/markdown.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const i18n=await loadI18n(root);
const {entries}=JSON.parse(await readFile(join(root,'data/prompts.json'),'utf8'));

test('模型显示名按语言翻译，原模型键与版本资料保留；短模型名残留也会失败',()=>{
  const display={en:{'可靈 Kling':'Kling','海螺 Hailuo':'Hailuo','Midjourney 影片':'Midjourney Video','Higgsfield（平台）':'Higgsfield (platform)'},ja:{'可靈 Kling':'Kling','海螺 Hailuo':'Hailuo','Midjourney 影片':'Midjourney 動画','Higgsfield（平台）':'Higgsfield（プラットフォーム）'}};
  for(const locale of ['en','ja']) {
    for(const [source,label] of Object.entries(display[locale]))assert.equal(translateModelName(source,locale),label);
    for(const entry of entries) {
      const localized=localizeEntry(entry,locale,i18n.content[locale]);
      assert.deepEqual(localized.models,entry.models);
      assert.deepEqual(localized.displayModels,entry.models.map(model=>display[locale][model] || model));
    }
    for(const text of ['可靈','海螺','可靈 Kling','海螺 Hailuo','Midjourney 影片']) {
      assert.throws(()=>validateLocalizedHtml(`<span>${text}</span>`,locale,i18n.ui.zh,entries));
      assert.throws(()=>validateLocalizedHtml(`<img alt="${text}">`,locale,i18n.ui.zh,entries));
    }
    assert.doesNotThrow(()=>validateLocalizedHtml('<input value="海螺 Hailuo"><span>Hailuo</span>',locale,i18n.ui.zh,entries));
  }
});

test('三份技术译文逐段保留结构、所有出处、数字与原文范例，删节 fixture 必须失败',async()=>{
  for(const name of ['fight','wan3','minimax-h3']) {
    const source=await readFile(join(root,`data/tips/${name}.md`),'utf8');
    assert.equal(i18n.ui.zh.tipArticles[name],source);
    for(const locale of ['en','ja']) {
      const translated=i18n.ui[locale].tipArticles[name];
      assert.doesNotThrow(()=>validateGuideTranslation(source,translated));
      assert.equal(translated.split('\n').length,source.split('\n').length);
      assert.throws(()=>validateGuideTranslation(source,translated.replace(/^## .+\n/m,'')));
    }
  }
  for(const locale of ['en','ja']) {
    const {fight,wan3,'minimax-h3':minimax}=i18n.ui[locale].tipArticles;
    for(const item of ['61493863','56562880','29310472','15236754','26','7724bart','CuriousRefuge','godswayfoundinc','1/500s shutter'])assert.ok(fight.includes(item),`${locale}: ${item}`);
    for(const item of ['HKD16.47','HKD25.6','1000fps','360p','480p','5600K','85mm','8mm','@Alibaba_Wan','Ukiyo_il','Langby2','hii_roto','johnAGI168','Inshrah_ali_','PrometheanAIX'])assert.ok(wan3.includes(item),`${locale}: ${item}`);
    for(const item of ['4.2','4.3','4.4','4.6','4.7','550+','subject_definitions','retention_analysis','<Picture 1>','<Video 1>','<Audio 1>'])assert.ok(minimax.includes(item),`${locale}: ${item}`);
    assert.throws(()=>validateGuideTranslation(i18n.ui.zh.tipArticles.fight,fight.replace('61493863','omitted')));
    assert.throws(()=>validateGuideTranslation(i18n.ui.zh.tipArticles.wan3,wan3.replace('HKD16.47','omitted')));
    assert.throws(()=>validateGuideTranslation(i18n.ui.zh.tipArticles.wan3,wan3.replace('https://x.com/Langby2/status/2100161820988440853','https://example.com')));
    assert.throws(()=>validateGuideTranslation(i18n.ui.zh.tipArticles.fight,fight.replace('Shot 1 [0-4s]','Changed example')));
  }
});

test('英日筛选说明明确 OR/AND，译文保留字幕、台客语、单镜头与工作流署名',()=>{
  assert.equal(i18n.ui.en.filterHelp,'Pick several in one group to match any of them; choosing a model and a tag shows prompts that match both.');
  assert.equal(i18n.ui.ja.filterHelp,'同じ項目で複数選ぶといずれかに一致するもの、モデルとタグを組み合わせると両方に一致するものに絞り込みます。');
  for(const locale of ['en','ja']) {
    const p=i18n.content[locale].prompts;
    for(const id of ['2041772197799236033','2095175917412962628'])assert.ok(p[id].title.includes(locale==='en'?'single take':'ワンカット'));
    for(const phrase of locale==='en'?['English subtitles','Taiwanese Hokkien','Hakka']:['英語字幕','台湾語','客家語'])assert.ok(p['2060421985608597798'].description.includes(phrase));
  }
  for(const locale of ['zh','en','ja']) {
    const role=i18n.content[locale].workflows['2064046116656586888'].steps['3'].role;
    assert.ok(role.includes('@aimikoda') && role.includes('Storyboard Skill'));
  }
});

test('三语实际输出：模型选项保持原值、可见名翻译，中文导语换行与 Cookie/H 期号恢复',async()=>{
  const out=await mkdtemp(join(tmpdir(),'pcv-v04-review-'));
  try {
    const result=await buildSite({out});
    for(const page of result.localizedPages) {
      const html=await readFile(join(out,page.file),'utf8');
      if(page.locale==='zh')assert.ok(html.includes('<strong>COOKIE / YOUR CHOICE</strong>'));
      else validateLocalizedHtml(html,page.locale,i18n.ui.zh,entries);
    }
    const chinese=await readFile(join(out,'index.html'),'utf8');
    assert.ok(chinese.includes('AI 视频、图像、音乐的创作入口。<br>收藏提示词，拆解镜头，留下制作笔记。'));
    for(const fragment of ['PRODUCTION No. 003','COPY<br>003','EDITION 03','<span>TAKE</span><strong>03</strong>'])assert.ok(chinese.includes(fragment));
    for(const locale of ['en','ja']) {
      const home=await readFile(join(out,locale,'prompts/video/index.html'),'utf8');
      for(const model of ['可靈 Kling','海螺 Hailuo','Midjourney 影片'])assert.ok(home.includes(`value="${model}"><span>${translateModelName(model,locale)}</span>`));
      const detail=await readFile(join(out,locale,'prompts/video/1935098801410158601/index.html'),'utf8');
      assert.ok(detail.includes(`<dd>${translateModelName('海螺 Hailuo',locale)}</dd>`));
      const workflow=await readFile(join(out,locale,'prompts/workflow/2064046116656586888/index.html'),'utf8');
      assert.ok(workflow.includes('@aimikoda') && workflow.includes('Storyboard Skill'));
      const tips=await readFile(join(out,locale,'tips.html'),'utf8');
      for(const item of ['61493863','HKD16.47','1000fps','480p','7724bart','550+'])assert.ok(tips.includes(item));
    }
    const fixture=structuredClone(i18n);fixture.ui.zh.heroBody='before<img src=x>\nafter';
    await buildSite({out,i18n:fixture});
    const escaped=await readFile(join(out,'index.html'),'utf8');
    assert.ok(escaped.includes(`<p>${escapeHtml('before<img src=x>')}<br>after</p>`));
    assert.ok(!escaped.includes('<img src=x>'));
  } finally {await rm(out,{recursive:true,force:true});}
});

test('关闭语言提示在当前分页会话跨页保留，主动切换后重置，储存失败不影响关闭',()=>{
  const local=new Map([[LANGUAGE_KEY,'ja']]),session=new Map();
  function openPage(path,{blocked=false}={}) {
    const listeners={};const target={};
    const links=['zh','en','ja'].map(locale=>({dataset:{language:locale},href:`/${locale}${path}`,addEventListener(type,fn){listeners[locale]=fn;}}));
    const hint={hidden:true,querySelector:selector=>selector==='[data-preferred-language]'?target:{addEventListener(type,fn){listeners.dismiss=fn;}}};
    const storage=map=>({getItem(key){if(blocked)throw Error('blocked');return map.get(key)||null;},setItem(key,value){if(blocked)throw Error('blocked');map.set(key,value);},removeItem(key){if(blocked)throw Error('blocked');map.delete(key);}});
    initLanguage({window:{localStorage:storage(local),sessionStorage:storage(session)},document:{body:{dataset:{locale:'zh'}},querySelectorAll:()=>links,querySelector:()=>hint}});
    return {hint,listeners,target};
  }
  const first=openPage('/tips.html');assert.equal(first.hint.hidden,false);first.listeners.dismiss();
  assert.equal(first.hint.hidden,true);assert.equal(local.get(LANGUAGE_KEY),'ja');assert.equal(session.get(LANGUAGE_HINT_DISMISS_KEY),'ja');
  const second=openPage('/regions.html');assert.equal(second.hint.hidden,true);
  second.listeners.en();assert.equal(session.has(LANGUAGE_HINT_DISMISS_KEY),false);assert.equal(local.get(LANGUAGE_KEY),'en');
  const third=openPage('/tips.html');assert.equal(third.hint.hidden,false);assert.equal(third.target.href,'/en/tips.html');
  const blocked=openPage('/tips.html',{blocked:true});assert.doesNotThrow(()=>blocked.listeners.dismiss());assert.equal(blocked.hint.hidden,true);
});
