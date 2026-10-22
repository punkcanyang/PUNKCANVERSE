import { promptHtml } from '../lib/cards.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCatalog } from '../lib/catalog.mjs';
import { validateFullPromptSources } from '../lib/fulltext.mjs';
import { getCopyText } from '../lib/prompts.mjs';
import { localizedCopyText } from '../web/language.mjs';

export async function verifyV051(root=fileURLToPath(new URL('..',import.meta.url))) {
  const read=path=>readFile(join(root,path),'utf8');
  const json=async path=>JSON.parse(await read(path));
  const {entries}=await loadCatalog(root);
  const manifest=await json('test/fixtures/v051-source-manifest.json');
  validateFullPromptSources(entries,manifest);
  const {entries:published}=await json('dist/catalog.json');
  assert.deepEqual(published,entries);
  for(const entry of published) {
    assert.equal(getCopyText(entry),entry.prompt);
    assert.equal(localizedCopyText(entry,'unused prefix'),entry.prompt);
    for(const locale of ['zh','en','ja']) {
      const prefix=locale==='zh'?'':`${locale}/`;
      const html=await read(`dist/${prefix}prompts/video/${entry.id}/index.html`);
      const section=html.match(/<section class="full-prompt">([\s\S]*?)<\/section>/)?.[1];
      assert.ok(section,`${locale}/${entry.id}: full prompt section missing`);
      assert.ok(section.includes(`<pre class="prompt-text" tabindex="0">${promptHtml(entry)}</pre>`),`${locale}/${entry.id}: complete source text must be server-rendered`);
      assert.ok(section.includes(`data-copy-entry="${entry.id}"`));
      const markup=section.replace(/(<pre\b[^>]*>)[\s\S]*?(<\/pre>)/g,'$1$2');
      assert.ok(!/<details\b|\shidden\b|aria-hidden="true"|display\s*:\s*none|visibility\s*:\s*hidden/i.test(markup),'No-JS full text cannot be collapsed or hidden');
      assert.ok(!section.includes('class="excerpt-note"'),'No excerpt-only warning');
    }
  }
  console.log('✓ v0.5.1：192 条全文来源、精确元数据、576 个三语详情全文、完整复制与无 JS 阅读通过');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await verifyV051();
