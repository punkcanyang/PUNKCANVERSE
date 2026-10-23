import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildSite } from '../build.mjs';
import { publishedWorks } from '../lib/works.mjs';
import { loadI18n } from '../lib/i18n.mjs';
import { diskPath, switchHref } from '../lib/routes.mjs';

const translated = value => ({zh:`中 ${value}`,en:`EN ${value}`,ja:`日 ${value}`});
const fixture = () => ({
  slug:'test-project', published:true,
  copy:Object.fromEntries(['zh','en','ja'].map(locale => [locale,{title:`${locale} <Test>`,summary:`${locale} Summary`,description:'First line\n<script>not executable</script>'}])),
  media:[
    {type:'image',src:'https://example.invalid/test.jpg',width:1600,height:900,alt:translated('image')},
    {type:'video',src:'https://example.invalid/test.mp4',width:1920,height:1080,alt:translated('video')},
  ],
  links:[{url:'https://example.invalid/project?a=1&b=2',label:translated('project')}],
});

test('works: explicit publication, complete translations, safe slugs and media URLs', () => {
  assert.deepEqual(publishedWorks({entries:[]}),[]);
  assert.deepEqual(publishedWorks({entries:[{slug:'draft',published:false}]}),[]);
  assert.equal(publishedWorks({entries:[fixture()]}).length,1);
  for (const change of [
    w=>delete w.published, w=>w.slug='../escape', w=>delete w.copy.ja.title,
    w=>w.media[0].src='javascript:alert(1)', w=>w.media[0].src='file:///private/image.jpg',
    w=>w.media[0].src='https://user:password@example.invalid/image.jpg',
    w=>w.media[1].poster='data:image/png;base64,AA', w=>w.media[0].width=0,
    w=>w.media[0].type='iframe', w=>w.links[0].url='//example.invalid/',
  ]) {
    const work=fixture();change(work);assert.throws(()=>publishedWorks({entries:[work]}));
  }
  assert.throws(()=>publishedWorks({entries:[fixture(),fixture()]}));
  assert.equal(diskPath('zh','/works/tools/'),'/works/tools/');
  assert.equal(switchHref('en','/works/tips/'),'/en/works/tips/');
  assert.equal(diskPath('zh','/tools'),'/tools.html');
});

test('works: empty production data, localized navigation, legacy aliases and no invented cards', async () => {
  const out=await mkdtemp(join(tmpdir(),'pcv-works-empty-'));
  const saved=globalThis.fetch;globalThis.fetch=()=>assert.fail('Offline build only');
  try {
    const result=await buildSite({out});
    const i18n=await loadI18n(new URL('..',import.meta.url).pathname);
    assert.equal(result.localizedPages.length,642);assert.equal(result.sitemapUrls.length,633);
    for (const locale of ['zh','en','ja']) {
      const prefix=locale==='zh'?'':`${locale}/`,url=`/${prefix}works/`;
      const listing=await readFile(join(out,prefix,'works/index.html'),'utf8');
      const old=await readFile(join(out,prefix,'essays/index.html'),'utf8');
      assert.ok(listing.includes(i18n.ui[locale].works.emptyBody));
      assert.ok(listing.includes(`href="${url}" aria-current="page"`));
      assert.doesNotMatch(listing, /class="work-card"|<video\b|<img\b/);
      assert.ok(old.includes('class="works-empty"'));
      assert.ok(old.includes(`<link rel="canonical" href="https://punkcanverse.com${url}">`));
      assert.ok(result.sitemapUrls.includes(`https://punkcanverse.com${url}`));
      assert.ok(!result.sitemapUrls.includes(`https://punkcanverse.com/${prefix}essays/`));
    }
    for (const file of (await readdir(out,{recursive:true})).filter(f=>f.endsWith('.html'))) {
      const html=await readFile(join(out,file),'utf8');
      assert.doesNotMatch(html,/AI 工作论|Working with AI|AIと働く|AIとの働き方/);
      const nav=html.match(/<nav class="primary-nav"[^>]*>[\s\S]*?<\/nav>/)[0];
      assert.doesNotMatch(nav,/\/essays\//);assert.match(nav,/\/works\//);
    }
  } finally {globalThis.fetch=saved;await rm(out,{recursive:true,force:true});}
});

test('works: published cards/details render media and links; drafts never leave the source', async () => {
  const out=await mkdtemp(join(tmpdir(),'pcv-works-published-'));
  const saved=globalThis.fetch;globalThis.fetch=()=>assert.fail('Offline build only');
  try {
    const published=fixture(),draft={...fixture(),slug:'private-draft',published:false,privateNote:'NEVER_PUBLISH_THIS'};
    const result=await buildSite({out,works:[published,draft]});
    assert.equal(result.localizedPages.length,645);assert.equal(result.sitemapUrls.length,636);
    for (const locale of ['zh','en','ja']) {
      const prefix=locale==='zh'?'':`${locale}/`;
      const listing=await readFile(join(out,prefix,'works/index.html'),'utf8');
      const detail=await readFile(join(out,prefix,'works/test-project/index.html'),'utf8');
      assert.equal((listing.match(/class="work-card"/g)||[]).length,1);
      assert.ok(listing.includes(`href="/${prefix}works/test-project/"`));
      assert.ok(detail.includes(`${locale} &lt;Test&gt;`));
      assert.ok(detail.includes('&lt;script&gt;not executable&lt;/script&gt;'));
      assert.match(detail,/<video controls playsinline preload="none"/);
      assert.doesNotMatch(detail,/\bautoplay\b|<iframe\b/);
      assert.match(detail,/src="https:\/\/example.invalid\/test.jpg"/);
      assert.ok(detail.includes('href="https://example.invalid/project?a=1&amp;b=2" target="_blank" rel="noopener noreferrer"'));
      assert.ok(result.sitemapUrls.includes(`https://punkcanverse.com/${prefix}works/test-project/`));
    }
    for (const file of (await readdir(out,{recursive:true})).filter(f=>/\.(html|json|xml)$/.test(f))) {
      assert.doesNotMatch(await readFile(join(out,file),'utf8'),/private-draft|NEVER_PUBLISH_THIS/);
    }
    // A video-only project without a supplied poster has no invented cover.
    const videoOnly=fixture();videoOnly.media=videoOnly.media.filter(m=>m.type==='video');
    await buildSite({out,works:[videoOnly]});
    assert.doesNotMatch(await readFile(join(out,'works/index.html'),'utf8'),/<img\b/);
  } finally {globalThis.fetch=saved;await rm(out,{recursive:true,force:true});}
});
