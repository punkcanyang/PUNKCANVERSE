import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildSite} from '../build.mjs';

test('阅读更新：三语精简首页、完整库、页面主标题、导航状态与分享图片',async()=>{
  const out=await mkdtemp(join(tmpdir(),'pcv-reading-'));
  try {
    await buildSite({out});
    for(const lang of ['', 'en/', 'ja/']) {
      const home=await readFile(join(out,lang,'index.html'),'utf8');
      const archive=await readFile(join(out,lang,'prompts/video/index.html'),'utf8');
      assert.equal((home.match(/class="prompt-card"/g)||[]).length,6);
      assert.ok(Buffer.byteLength(home)<100000,'Home has a bounded six-entry payload');
      assert.equal((archive.match(/class="prompt-card"/g)||[]).length,192);
      assert.match(home,new RegExp(`action="/${lang}prompts/video/"`));
      assert.match(archive,/id="prompt-search"/);assert.match(archive,/id="prompt-sort"/);
      assert.equal((archive.match(/data-filter-entry=/g)||[]).length,192);
      for(const file of ['index.html','prompts/video/index.html','prompts/fight/index.html','prompts/image/index.html','prompts/music/index.html','tips.html','tools.html','regions.html','works/index.html']) {
        const html=await readFile(join(out,lang,file),'utf8');
        assert.equal((html.match(/<h1\b/g)||[]).length,1,`${lang}${file}: one page title`);
        assert.match(html,/<meta property="og:image" content="https:\/\/punkcanverse.com\/img\/site\/share.png">/);
        const nav=html.match(/<nav class="primary-nav"[^>]*>[\s\S]*?<\/nav>/)[0];
        assert.equal((nav.match(/aria-current="page"/g)||[]).length,file==='index.html'?0:1);
        if(file==='tools.html')assert.ok(nav.includes(`href="/${lang}tools" aria-current="page"`));
      }
    }
    const image=await readFile(join(out,'img/site/share.png'));
    assert.equal(image.readUInt32BE(16),1200);assert.equal(image.readUInt32BE(20),630);
    assert.deepEqual(image,await readFile(new URL('../web/img/site/share.png',import.meta.url)));
  } finally {await rm(out,{recursive:true,force:true});}
});
