import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GA_ID, GA_SCRIPT_URL, CONSENT_BOOTSTRAP, GA_CONFIG, renderAnalytics, renderConsentBanner, verifyAnalyticsHtml } from '../lib/analytics.mjs';
import { initConsent, consentValues } from '../web/consent.mjs';
import { SITE_PAGES } from '../lib/site-pages.mjs';
import { renderAffiliates, renderRecommendedTools } from '../lib/affiliates.mjs';
import { buildSite } from '../build.mjs';

function bootstrap(value, throws = false) {
  const context = { localStorage:{getItem(){if(throws)throw Error('blocked');return value}} };
  context.window = context;
  runInNewContext(CONSENT_BOOTSTRAP + '\n' + GA_CONFIG,context);
  return context.dataLayer.map(args=>JSON.parse(JSON.stringify(Array.from(args))));
}

test('Consent Mode 默认四项 denied 先于 config，已保存接受则立即恢复 granted', () => {
  for(const value of [null,'denied','invalid']) {
    const calls=bootstrap(value);
    assert.deepEqual(calls[0],['consent','default',consentValues('denied')]);
    assert.ok(!calls.some(call=>call[0]==='consent'&&call[1]==='update'));
    assert.deepEqual(calls.at(-1),['config',GA_ID]);
  }
  const accepted=bootstrap('granted');
  assert.deepEqual(accepted[0],['consent','default',consentValues('denied')]);
  assert.deepEqual(accepted[1],['consent','update',consentValues('granted')]);
  assert.deepEqual(accepted.at(-1),['config',GA_ID]);
  assert.deepEqual(bootstrap(null,true)[0],['consent','default',consentValues('denied')]);
});

test('verify fixture 缺 ID、缺 denied 或顺序错误必须失败', () => {
  const html=`<html><head>${renderAnalytics()}</head><body>${renderConsentBanner()}<button data-cookie-settings>设置</button></body></html>`;
  assert.equal(verifyAnalyticsHtml(html),true);
  assert.throws(()=>verifyAnalyticsHtml(html.replaceAll(GA_ID,'G-WRONG')),/Analytics verification/);
  assert.throws(()=>verifyAnalyticsHtml(html.replace("analytics_storage:'denied'","analytics_storage:'granted'")),/Analytics verification/);
  assert.throws(()=>verifyAnalyticsHtml(html.replace(renderAnalytics(),`<script>${GA_CONFIG}</script><script async src="${GA_SCRIPT_URL}"></script><script>${CONSENT_BOOTSTRAP}</script>`)));
  assert.throws(()=>verifyAnalyticsHtml(html.replace('async src=','src=')));
});

function consentEnvironment(initial=null, blocked=false) {
  let stored=initial;
  const handlers={},events={},updates=[],space=[];
  let focused=false,restored=false;
  const firstButton={focus(){focused=true}};
  const banner={hidden:true,getBoundingClientRect(){return {height:180}},querySelector(){return firstButton}};
  const document={querySelector(){return banner},body:{style:{setProperty(key,value){space.push([key,value])}}},addEventListener(name,fn){handlers[name]=fn}};
  const window={localStorage:{getItem(){if(blocked)throw Error('blocked');return stored},setItem(key,value){if(blocked)throw Error('blocked');assert.equal(key,'pcv-consent');stored=value},removeItem(){if(blocked)throw Error('blocked');stored=null}},gtag(...args){updates.push(args)},addEventListener(name,fn){events[name]=fn}};
  const controller=initConsent({window,document});
  return {controller,banner,updates,space,events,get stored(){return stored},get focused(){return focused},get restored(){return restored},open(){const button={focus(){restored=true}};handlers.click({target:{closest(selector){return selector==='[data-cookie-settings]'?button:null}}})},click(value){handlers.click({target:{closest(selector){return selector==='[data-consent]'?{dataset:{consent:value}}:null}}})}};
}

test('首次出现、接受存储、拒绝存储和固定条留空不遮内容', () => {
  const env=consentEnvironment();
  assert.equal(env.banner.hidden,false);assert.deepEqual(env.space.at(-1),['--consent-space','196px']);
  env.click('granted');assert.equal(env.stored,'granted');assert.equal(env.banner.hidden,true);
  assert.deepEqual(env.updates.at(-1),['consent','update',consentValues('granted')]);
  assert.deepEqual(env.space.at(-1),['--consent-space','0px']);
  const reject=consentEnvironment();reject.click('denied');assert.equal(reject.stored,'denied');
  assert.deepEqual(reject.updates.at(-1),['consent','update',consentValues('denied')]);
});

test('已选不出现，Cookie 设置立即撤回并重新打开，可键盘聚焦再拒绝', () => {
  for(const value of ['granted','denied'])assert.equal(consentEnvironment(value).banner.hidden,true);
  const env=consentEnvironment('granted');env.open();
  assert.equal(env.stored,null);assert.equal(env.banner.hidden,false);assert.equal(env.focused,true);
  assert.deepEqual(env.updates.at(-1),['consent','update',consentValues('denied')]);
  env.click('denied');assert.equal(env.stored,'denied');assert.equal(env.restored,true);
  assert.equal(env.banner.hidden,true);
});

test('localStorage 不可用时不崩溃，当前拒绝仍生效；跨标签清除会撤回', () => {
  const env=consentEnvironment(null,true);assert.equal(env.banner.hidden,false);env.click('denied');
  assert.deepEqual(env.updates.at(-1),['consent','update',consentValues('denied')]);
  const clear=consentEnvironment();clear.events.storage({key:null});
  assert.equal(clear.banner.hidden,false);
  assert.deepEqual(clear.updates.at(-1),['consent','update',consentValues('denied')]);
});

test('推广按钮及推荐工具旁的揭露都链接到说明页，sponsored 保留', () => {
  const fixture={test:{name:'Fixture',url:'https://example.com/affiliate',models:['Fixture']},magnific:{name:'Magnific',url:'https://example.com/tools',models:[],code:'TEST'}};
  for(const html of [renderAffiliates({models:['Fixture']},fixture),renderRecommendedTools(fixture)]) {
    assert.ok(html.includes('<a href="/affiliate-disclosure/" class="affiliate-label"><small>推广连结</small></a>'));
    assert.ok(html.includes('rel="sponsored noopener noreferrer"'));
  }
});

test('离线 build：每页 GA4、五页 canonical/日期/sitemap、全站页脚入口与唯一邮箱', async () => {
  const dir=await mkdtemp(join(tmpdir(),'pcv-consent-'));
  const oldFetch=globalThis.fetch;globalThis.fetch=()=>assert.fail('Build must not use network');
  try {
    const result=await buildSite({out:dir});
    assert.equal(SITE_PAGES.length,5);
    for(const path of result.pages) {
      const file=join(dir,path.endsWith('.html')?path.slice(1):path.slice(1)+'index.html');
      const html=await readFile(file,'utf8');assert.equal(verifyAnalyticsHtml(html),true);
      const footer=html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0];
      for(const info of SITE_PAGES)assert.ok(footer.includes(`href="${info.path}"`));
      assert.ok(footer.includes('data-cookie-settings'));
      if(SITE_PAGES.some(info=>info.path===path)) {
        assert.ok(result.sitemapUrls.includes('https://punkcanverse.com'+path));
        assert.ok(html.includes(`<link rel="canonical" href="https://punkcanverse.com${path}">`));
        assert.match(html,/Last updated: <time datetime="2026-10-21">2026-10-21<\/time>/);
        assert.ok(html.includes('class="essay-body"'));
      }
      for(const mail of html.matchAll(/mailto:([^"'<>\s]+)/gi))assert.equal(mail[1],'hello@punkcanverse.com');
    }
    const privacy=await readFile(join(dir,'privacy/index.html'),'utf8');
    for(const text of ['Consent Mode v2','Resend','AdSense','X embeds','partner-sites','Cookie Settings'])assert.ok(privacy.includes(text));
    const contact=await readFile(join(dir,'contact/index.html'),'utf8');
    assert.ok(contact.includes('href="mailto:hello@punkcanverse.com"'));
  } finally { globalThis.fetch=oldFetch;await rm(dir,{recursive:true,force:true}); }
});
