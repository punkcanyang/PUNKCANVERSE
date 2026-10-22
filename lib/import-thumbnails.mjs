import assert from 'node:assert/strict';
import { normalizeThumb } from './thumbs.mjs';

// This source post is confirmed to contain text only. Every other imported X
// entry must retain its real image in the release cache, even after fetch errors.
export const IMPORT_NO_MEDIA_POST_ID = '2110747397441917172';

export function validateImportedThumbnails(entries, cache) {
  assert.ok(cache?.entries && typeof cache.entries==='object' && !Array.isArray(cache.entries),'Invalid thumbnail cache');
  for(const entry of entries) {
    if(entry.source==='official') {
      assert.ok(!Object.hasOwn(cache.entries,entry.id),`${entry.id}: official examples cannot have cached X images`);
      continue;
    }
    const record=cache.entries[entry.id];
    const postId=entry.embedId||entry.id;
    assert.ok(record,`${entry.id}: required thumbnail cache record missing`);
    assert.equal(record.postId,postId,`${entry.id}: thumbnail post ID mismatch`);
    assert.ok(['ok','missing'].includes(record.status),`${entry.id}: invalid thumbnail status`);
    if(postId===IMPORT_NO_MEDIA_POST_ID && record.status==='missing')continue;
    assert.ok(normalizeThumb(record),`${entry.id}: required cached thumbnail missing or invalid`);
  }
}
