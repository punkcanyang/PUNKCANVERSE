import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateOfficialFrame } from './official-frames.mjs';
export const textSha256=value=>createHash('sha256').update(value).digest('hex');

export function validateFullPrompt(entry, source) {
  assert.ok(source,`${entry.id}: missing full-text source`);
  assert.equal(entry.id,source.id);
  assert.ok(typeof entry.prompt==='string'&&entry.prompt.length>0,`${entry.id}: full prompt required`);
  assert.equal(entry.promptLength,entry.prompt.length,`${entry.id}: prompt length`);
  assert.equal(entry.promptLength,source.length,`${entry.id}: source length`);
  assert.equal(textSha256(entry.prompt),source.sha256,`${entry.id}: verbatim source text`);
  assert.equal(entry.promptExcerpt,null,`${entry.id}: obsolete excerpt`);
  assert.equal(entry.isLong,entry.promptLength>1500,`${entry.id}: layout flag`);
}

export function validateFullPromptSources(entries, manifest) {
  assert.equal(manifest.count,192);
  assert.equal(manifest.entries.length,192);
  assert.equal(new Set(manifest.entries.map(row=>row.id)).size,192);
  assert.equal(entries.length,192);
  assert.deepEqual(entries.map(entry=>entry.id),manifest.entries.map(row=>row.id));
  for(const group of ['fight','wan-minimax']) {
    const rows=manifest.entries.filter(row=>row.group===group);
    assert.equal(rows.length,group==='fight'?63:129);
    assert.equal(rows.filter(row=>row.restored).length,group==='fight'?20:74);
  }
  for(const [index,entry] of entries.entries()) {
    const row=manifest.entries[index];validateFullPrompt(entry,row);
    // v0.5.2 spec change (boss 2026-10-22): real official sample frames
    // Verify the new field exactly, then retain the original hash of ALL old fields.
    validateOfficialFrame(entry, true);
    const {prompt,promptExcerpt,officialThumb,...metadata}=entry;
    assert.equal(textSha256(JSON.stringify(metadata)),row.metadataSha256,`${entry.id}: original metadata changed`);
  }
}
