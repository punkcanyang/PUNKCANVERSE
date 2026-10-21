import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderCard } from '../lib/cards.mjs';
import { getCopyText, filterEntries } from '../lib/prompts.mjs';
import { escapeHtml } from '../lib/markdown.mjs';
import { getEmbedUrl, validatePostMetadata } from '../lib/posts.mjs';

const { entries } = JSON.parse(await readFile(new URL('../data/prompts.json', import.meta.url), 'utf8'));
const removed = entries.find(entry => entry.id === '1949860456958398844');
const techie = entries.find(entry => entry.id === '2086124547376341346');

test('已删除原帖保留完整卡片、提示词、作者、复制和失效原帖链接，无嵌入空框', () => {
  const html = renderCard(removed, 0);
  assert.ok(html.includes('原帖已删除或不可用（2026-10-21 检查），无法显示成片'));
  assert.ok(!/tweet-template|twitter-tweet|tweet-mount|data-embed|watch-link/.test(html));
  assert.ok(html.includes(escapeHtml(removed.title)));
  assert.ok(html.includes(escapeHtml(removed.description)));
  assert.ok(html.includes(`<pre class="prompt-text" tabindex="0">${escapeHtml(removed.prompt)}</pre>`));
  assert.ok(html.includes(`data-copy-entry="${removed.id}"`));
  assert.ok(html.includes(`href="${removed.authorUrl}" target="_blank" rel="noopener noreferrer">${removed.author}</a>`));
  assert.ok(html.includes(`href="${removed.postUrl}" target="_blank" rel="noopener noreferrer">原帖（已失效）</a>`));
  assert.equal(getCopyText(removed), removed.prompt);
  assert.deepEqual(filterEntries([removed]), [removed]);
  assert.equal(getEmbedUrl({ ...removed, embedId: '123' }), null);
});

test('TechieBySA 嵌入使用同作者串首，原帖、全文入口和复制仍指向原回复', () => {
  assert.equal(techie.embedId, '2086124536253043164');
  const html = renderCard(techie, 0);
  const embedUrl = 'https://x.com/TechieBySA/status/2086124536253043164';
  assert.equal(getEmbedUrl(techie), embedUrl);
  assert.ok(html.includes(`<blockquote class="twitter-tweet" data-dnt="true" data-conversation="none"><a href="${embedUrl}"`));
  assert.ok(html.includes(`href="${embedUrl}" target="_blank" rel="noopener noreferrer" class="watch-link"`));
  assert.ok(html.includes('<p class="embed-note">影片取自同作者的串首帖</p>'));
  assert.ok(html.includes(`href="${techie.postUrl}" target="_blank" rel="noopener noreferrer">原帖 ↗</a>`));
  assert.ok(html.includes(`href="${techie.postUrl}" target="_blank" rel="noopener noreferrer">查看完整提示词 ↗</a>`));
  assert.equal(getCopyText(techie), `${techie.promptExcerpt}\n完整版：${techie.postUrl}`);
});

test('未指定 embedId 时沿用原帖，不出现串首说明', () => {
  const { embedId, ...original } = techie;
  const html = renderCard(original, 0);
  assert.equal(getEmbedUrl(original), original.postUrl);
  assert.ok(html.includes(`<blockquote class="twitter-tweet" data-dnt="true" data-conversation="none"><a href="${original.postUrl}"`));
  assert.ok(!html.includes('影片取自同作者的串首帖'));
});

test('上层作者不同时 replyNoVideo 仅显示提示，保持原帖嵌入与复制', () => {
  const { embedId, ...original } = techie;
  const reply = { ...original, replyNoVideo: true };
  const html = renderCard(reply, 0);
  assert.equal(getEmbedUrl(reply), reply.postUrl);
  assert.ok(html.includes(`<blockquote class="twitter-tweet" data-dnt="true" data-conversation="none"><a href="${reply.postUrl}"`));
  assert.ok(html.includes('<p class="embed-note">此帖为回复，影片见原串</p>'));
  assert.ok(!html.includes('影片取自同作者的串首帖'));
  assert.equal(getCopyText(reply), getCopyText(original));
});

test('元数据只接受 removed、有效 YYYY-MM-DD、数字串首 ID 和 replyNoVideo:true', () => {
  for (const entry of [{}, removed, techie, { replyNoVideo: true }, { postCheckedAt: '2024-02-29' }]) assert.doesNotThrow(() => validatePostMetadata(entry));
  for (const metadata of [
    { postStatus: 'available' }, { postStatus: null }, { postStatus: 'removed' },
    { postCheckedAt: '2026-2-01' }, { postCheckedAt: '2026-02-30' }, { postCheckedAt: '2026-13-01' },
    { postCheckedAt: 20261021 }, { postCheckedAt: '2026-10-21<script>' },
    { embedId: 'https://x.com/other/status/123' }, { embedId: '123/other' }, { embedId: 123 }, { embedId: '' },
    { replyNoVideo: 'true' }, { replyNoVideo: false }, { replyNoVideo: true, embedId: '123' },
  ]) assert.throws(() => validatePostMetadata({ id: 'test', ...metadata }));
});
