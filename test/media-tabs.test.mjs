import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMediaTabs } from '../lib/media-tabs.mjs';

const entries = [{ id:'a', medium:'video' }, { id:'b', medium:'image' }];

test('首页及非媒介列表不标记 aria-current="page"', () => {
  for (const path of ['', '/', '/tips.html', '/prompts/video/a/']) {
    assert.ok(!renderMediaTabs(entries,path).includes('aria-current="page"'), path);
  }
});

test('仅当前媒介列表的链接标记 aria-current，计数与其他链接保留', () => {
  for (const medium of ['video','image','music']) {
    const path = `/prompts/${medium}/`;
    const html = renderMediaTabs(entries,path);
    assert.equal((html.match(/aria-current="page"/g) || []).length,1);
    assert.ok(html.includes(`<a href="${path}" aria-current="page">`));
    assert.ok(html.includes('视频 <b>1</b>'));
    assert.ok(html.includes('图像 <b>1</b>'));
    assert.ok(html.includes('音乐 <b>0</b>'));
  }
});
