import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateImportedPrompts, sourceUrl } from './catalog.mjs';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const ORIGINAL_PROMPTS_SHA256 = '05f91fb5ae33b25cbb7db685db7c405206c94f25fe7bc2f4c2447f36a2375c08';

// The offline manifest was derived once from the approved source. Full long
// prompts remain outside this repository; their published excerpts have hashes.
export function validateImportProvenance(data, manifest) {
  validateImportedPrompts(data);
  assert.equal(data.count,129);
  assert.equal(manifest.length,129);
  assert.deepEqual(manifest.map(row=>row.sourceIndex),Array.from({length:129},(_,i)=>i));
  assert.equal(new Set(manifest.map(row=>row.id)).size,129);
  assert.equal(data.entries.filter(row=>row.source==='x').length,106);
  assert.equal(data.entries.filter(row=>row.source==='official').length,23);
  assert.equal(data.entries.filter(row=>row.models[0]==='Wan').length,113);
  assert.equal(data.entries.filter(row=>row.models[0]==='MiniMax').length,16);
  assert.equal(data.entries.filter(row=>row.modelVersion==='Wan 3.0 Prime').length,5);
  assert.equal(data.entries.filter(row=>row.featured).length,26);
  for(const [index,entry] of data.entries.entries()) {
    const row=manifest[index];
    for(const key of ['id','source','title','modelVersion','featured','author','authorUrl','date'])assert.deepEqual(entry[key],row[key],`${entry.id}: source ${key}`);
    assert.equal(entry.authorHandle??null,row.authorHandle,`${entry.id}: source handle`);
    assert.equal(sourceUrl(entry),row.url,`${entry.id}: source URL`);
    assert.equal(entry.promptLength,row.fullLength,`${entry.id}: source length`);
    assert.equal(sha256(entry.isLong?entry.promptExcerpt:entry.prompt),entry.isLong?row.excerptSha256:row.promptSha256,`${entry.id}: verbatim prompt/excerpt`);
  }
}
