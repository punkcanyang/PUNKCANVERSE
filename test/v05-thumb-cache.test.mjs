import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateImportedThumbnails, IMPORT_NO_MEDIA_POST_ID } from '../lib/import-thumbnails.mjs';
import { normalizeThumb } from '../lib/thumbs.mjs';

const read=async file=>JSON.parse(await readFile(new URL('../'+file,import.meta.url),'utf8'));
const {entries}=await read('data/prompts-wan-minimax.json');
const cache=await read('data/thumbs.json');
const sample=entries.find(entry=>entry.source==='x');

function cacheFixture() {
  return {entries:{[sample.id]:{postId:sample.embedId||sample.id,status:'ok',source:'syndication',mediaType:'video',thumb:'https://pbs.twimg.com/media/offline-fixture.jpg',width:1280,height:720,durationMs:19783}}};
}

test('v0.5 发布缓存精确有105条新X原图；唯一无媒体原帖占位，23条官方不进缓存',()=>{
  validateImportedThumbnails(entries,cache);
  assert.equal(entries.filter(entry=>entry.source==='x'&&normalizeThumb(cache.entries[entry.id])).length,105);
  assert.deepEqual(entries.filter(entry=>entry.source==='x'&&!normalizeThumb(cache.entries[entry.id])).map(entry=>entry.id),[IMPORT_NO_MEDIA_POST_ID]);
  for(const entry of entries.filter(entry=>entry.source==='official'))assert.ok(!Object.hasOwn(cache.entries,entry.id));
});

test('v0.5 缺记录、missing、非法图片网址或错postId必须被发布检查拒绝，不能只等商務gate',()=>{
  for(const mutate of [
    data=>delete data.entries[sample.id],
    data=>data.entries[sample.id].status='missing',
    data=>data.entries[sample.id].thumb='https://example.test/image.jpg',
    data=>data.entries[sample.id].thumb='http://pbs.twimg.com/media/image.jpg',
    data=>data.entries[sample.id].thumb='https://pbs.twimg.com.evil.test/media/image.jpg',
    data=>data.entries[sample.id].postId='123',
  ]) {
    const fixture=cacheFixture();mutate(fixture);
    assert.throws(()=>validateImportedThumbnails([sample],fixture));
  }
  assert.doesNotThrow(()=>validateImportedThumbnails([sample],cacheFixture()));
});

test('v0.5 仅已确认无媒体的Pixel原帖可missing；例外不能扩及其他帖、官方或分段错配',()=>{
  const pixel=entries.find(entry=>entry.id===IMPORT_NO_MEDIA_POST_ID);
  const missing={entries:{[pixel.id]:{postId:pixel.id,status:'missing',source:'syndication'}}};
  assert.doesNotThrow(()=>validateImportedThumbnails([pixel],missing));
  const other={entries:{[sample.id]:{postId:sample.id,status:'missing',source:'syndication'}}};
  assert.throws(()=>validateImportedThumbnails([sample],other),/required cached thumbnail/);
  const official=entries.find(entry=>entry.source==='official');
  assert.throws(()=>validateImportedThumbnails([official],{entries:{[official.id]:cacheFixture().entries[sample.id]}}),/official/);
  const second=entries.find(entry=>entry.id==='2104507931337400770-2');
  assert.equal(second.embedId,'2104507931337400770');
  assert.equal(cache.entries[second.id].postId,second.embedId);
  for(const key of ['postId','thumb','durationMs'])assert.equal(cache.entries[second.id][key],cache.entries[second.embedId][key]);
  const invalid={entries:{[second.id]:{...cache.entries[second.id],postId:second.id}}};
  assert.throws(()=>validateImportedThumbnails([second],invalid),/post ID mismatch/);
});
