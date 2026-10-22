import { promptHtml } from '../lib/cards.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadCatalog, validateImportedPrompts } from '../lib/catalog.mjs';
import { validateFullPromptSources, validateFullPrompt, textSha256 } from '../lib/fulltext.mjs';
import { withFullPromptBaseline } from '../lib/data-migration.mjs';
import { getCopyText } from '../lib/prompts.mjs';
import { localizedCopyText } from '../web/language.mjs';
import { renderPromptDetail } from '../lib/cards.mjs';
import { buildSite } from '../build.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const json=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const {original,imported,entries}=await loadCatalog(root);
const manifest=await json('test/fixtures/v051-source-manifest.json');

test('v0.5.1 192条均为逐字来源全文，精确长度与其他元数据不变；20＋74恢复、其余98保持原文',()=>{
  validateFullPromptSources(entries,manifest);
  assert.equal(entries.length,192);
  assert.equal(entries.filter(entry=>entry.isLong).length,94);
  assert.equal(manifest.entries.filter(row=>row.group==='fight'&&row.restored).length,20);
  assert.equal(manifest.entries.filter(row=>row.group==='wan-minimax'&&row.restored).length,74);
  assert.equal(manifest.entries.filter(row=>!row.restored).length,98);
  for(const [index,entry] of entries.entries()) {
    assert.equal(typeof entry.prompt,'string');assert.ok(entry.prompt.length>0);
    assert.equal(entry.promptExcerpt,null);
    assert.equal(entry.promptLength,entry.prompt.length);
    assert.equal(textSha256(entry.prompt),manifest.entries[index].sha256);
  }
});

test('v0.5.1 篡改全文、长度、摘录、元数据、顺序或来源fixture一律失败',()=>{
  for(const mutate of [
    data=>data[0].prompt+='x',data=>data[0].promptLength++,
    data=>data[0].prompt=null,data=>data[0].prompt=data[0].prompt.slice(0,300),
    data=>data[0].promptExcerpt=data[0].prompt.slice(0,300),
    data=>data[0].description+='改写',data=>data[0].tags.push('new'),
    data=>data.reverse(),data=>data[0].isLong=false,
  ]) {const fixture=structuredClone(entries);mutate(fixture);assert.throws(()=>validateFullPromptSources(fixture,manifest));}
  const sources=structuredClone(manifest);sources.entries[0].sha256='0'.repeat(64);
  assert.throws(()=>validateFullPromptSources(entries,sources),/verbatim source/);
});

test('v0.5.1 全文迁移只改旧null长条目的prompt与promptExcerpt，不放过其他字段或短文更改',()=>{
  for(const current of [original,imported]) {
    const previous=structuredClone(current);
    for(const entry of previous.entries.filter(entry=>entry.isLong)) {entry.promptExcerpt=entry.prompt.slice(0,300);entry.prompt=null;}
    assert.deepEqual(withFullPromptBaseline(previous,current.entries,manifest),current);
    const validate=candidate=>assert.deepEqual(candidate,withFullPromptBaseline(previous,candidate.entries,manifest));
    for(const mutate of [
      data=>data.entries[0].title+='x',data=>data.entries[0].description+='x',
      data=>data.entries[0].author='another creator',data=>data.entries[0].tags.push('new'),
      data=>data.entries.find(entry=>!entry.isLong).prompt+='x',
      data=>data.entries.find(entry=>entry.isLong).prompt+='x',
    ]) {const fixture=structuredClone(current);mutate(fixture);assert.throws(()=>validate(fixture));}
  }
});

test('v0.5.1 schema拒绝长条目null／摘录、错误字数；1501字符也必须是全文',()=>{
  for(const mutate of [
    data=>data.entries.find(entry=>entry.isLong).prompt=null,
    data=>data.entries.find(entry=>entry.isLong).promptExcerpt='excerpt',
    data=>data.entries.find(entry=>entry.isLong).promptLength++,
  ]) {const fixture=structuredClone(imported);mutate(fixture);assert.throws(()=>validateImportedPrompts(fixture));}
  const row=manifest.entries[0];assert.doesNotThrow(()=>validateFullPrompt(entries[0],row));
});

test('v0.5.1 所有复制内容逐字为全文，长文不追加原帖／官方链接，HTML数据键能取到全文',()=>{
  for(const entry of entries) {
    assert.equal(getCopyText(entry),entry.prompt);
    for(const prefix of ['完整版：','Full version: ','全文：'])assert.equal(localizedCopyText(entry,prefix),entry.prompt);
    const html=renderPromptDetail(entry,entries,{});
    const id=html.match(/data-copy-entry="([^"]+)"/)?.[1];
    assert.equal(id,entry.id);
    assert.equal(getCopyText(entries.find(candidate=>candidate.id===id)),entry.prompt);
  }
});

test('v0.5.1 长文保留文本中的引号，安全转义标签及实体，不能结束pre或注入脚本',()=>{
  const prompt='Line "one" & </pre><script>alert(1)</script> \'quote\' &quot;\n'+'x'.repeat(1501);
  const entry={...entries[0],prompt,promptExcerpt:null,promptLength:prompt.length,isLong:true};
  const expected='Line "one" &amp; &lt;/pre&gt;&lt;script&gt;alert(1)&lt;/script&gt; \'quote\' &amp;quot;\n'+'x'.repeat(1501);
  assert.equal(promptHtml(entry),expected);
  const html=renderPromptDetail(entry,[entry],{});
  assert.ok(html.includes(`<pre class="prompt-text" tabindex="0">${expected}</pre>`));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.equal(getCopyText(entry),prompt);
});

test('v0.5.1 离线build全部576详情含完整pre；最长3条三语逐字比对，禁JS仍默认可读',async()=>{
  const out=await mkdtemp(join(tmpdir(),'pcv-v051-'));const saved=globalThis.fetch;
  globalThis.fetch=()=>assert.fail('No network in build or verification');
  try {
    await buildSite({out});
    const {entries:published}=JSON.parse(await readFile(join(out,'catalog.json'),'utf8'));
    assert.deepEqual(published,entries);
    const longest=[...entries].sort((a,b)=>b.promptLength-a.promptLength).slice(0,3);
    assert.deepEqual(longest.map(entry=>entry.id),['2092548780658708526','2105346237038043532','2101303256173650396']);
    for(const entry of entries)for(const locale of ['zh','en','ja']) {
      const html=await readFile(join(out,locale==='zh'?'':locale,`prompts/video/${entry.id}/index.html`),'utf8');
      const section=html.match(/<section class="full-prompt">([\s\S]*?)<\/section>/)?.[1];
      assert.ok(section?.includes(`<pre class="prompt-text" tabindex="0">${promptHtml(entry)}</pre>`));
      const markup=section.replace(/(<pre\b[^>]*>)[\s\S]*?(<\/pre>)/g,'$1$2');
      assert.ok(!/<details\b|\shidden\b|aria-hidden="true"|display\s*:\s*none/i.test(markup));
      assert.ok(!section.includes('class="excerpt-note"'));
    }
    for(const entry of longest)for(const locale of ['zh','en','ja']) {
      const html=await readFile(join(out,locale==='zh'?'':locale,`prompts/video/${entry.id}/index.html`),'utf8');
      assert.ok(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').includes(promptHtml(entry)));
    }
    const css=await readFile(join(out,'assets/site.css'),'utf8');
    const rules=[...css.matchAll(/\.full-prompt \.prompt-text\{([^}]+)\}/g)].map(match=>match[1]).join(';');
    assert.match(rules,/overflow:auto/);assert.match(rules,/white-space:pre-wrap/);assert.match(rules,/overflow-wrap:anywhere/);assert.match(rules,/max-block-size:/);
    assert.doesNotMatch(rules,/display\s*:\s*none|visibility\s*:\s*hidden/);
  } finally {globalThis.fetch=saved;await rm(out,{recursive:true,force:true});}
});
