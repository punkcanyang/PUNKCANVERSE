import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseFilters, filterEntries, clearFilters, filtersToSearch, getCopyText } from '../lib/prompts.mjs';

const entries = [
  { id: '1', models: ['Seedance', 'Wan'], tags: ['冷兵器', '夜战'] },
  { id: '2', models: ['Wan'], tags: ['徒手'] },
  { id: '3', models: ['Veo'], tags: ['冷兵器'] },
];
const ids = result => result.map(entry => entry.id);

test('模型筛选：单选与同类多选取并集', () => {
  assert.deepEqual(ids(filterEntries(entries, { models: ['Wan'] })), ['1', '2']);
  assert.deepEqual(ids(filterEntries(entries, { models: ['Wan', 'Veo'] })), ['1', '2', '3']);
});

test('标签筛选：单选与同类多选', () => {
  assert.deepEqual(ids(filterEntries(entries, { tags: ['冷兵器'] })), ['1', '3']);
  assert.deepEqual(ids(filterEntries(entries, { tags: ['冷兵器', '徒手'] })), ['1', '2', '3']);
});

test('模型与标签组合取交集，未知筛选和不匹配组合返回空数组', () => {
  assert.deepEqual(ids(filterEntries(entries, { models: ['Wan'], tags: ['冷兵器'] })), ['1']);
  assert.deepEqual(filterEntries(entries, { models: ['Veo'], tags: ['夜战'] }), []);
  assert.deepEqual(filterEntries(entries, parseFilters('?model=Unknown')), []);
  assert.deepEqual(filterEntries(entries, parseFilters('?tag=Unknown')), []);
});

test('清除后恢复全部；筛选不改变原数组', () => {
  const snapshot = structuredClone(entries);
  filterEntries(entries, { models: ['Veo'] });
  assert.deepEqual(filterEntries(entries, clearFilters()), entries);
  assert.deepEqual(entries, snapshot);
  assert.deepEqual(clearFilters(), { models: [], tags: [] });
});

test('URL query 解析中文、重复参数、空值与其他参数', () => {
  assert.deepEqual(parseFilters('?model=Seedance&model=Wan&model=Wan&tag=%E5%86%B7%E5%85%B5%E5%99%A8&tag=&ref=home'), {
    models: ['Seedance', 'Wan'], tags: ['冷兵器'],
  });
  assert.deepEqual(parseFilters(''), clearFilters());
  assert.deepEqual(parseFilters('?model=&tag='), clearFilters());
  assert.doesNotThrow(() => parseFilters('?tag=%E0%A4%A'));
});

test('URL 分享、刷新与浏览器历史使用相同状态，保留无关参数', () => {
  const filters = { models: ['可靈 Kling', 'Wan'], tags: ['一鏡到底', '冷兵器'] };
  const search = filtersToSearch(filters, '?ref=share&model=Old&tag=Old');
  assert.deepEqual(parseFilters(search), filters);
  assert.equal(new URLSearchParams(search).get('ref'), 'share');
  assert.equal(filtersToSearch(clearFilters(), search), '?ref=share');
  assert.equal(filtersToSearch(clearFilters(), '?model=Wan&tag=徒手'), '');
  assert.deepEqual(parseFilters(filtersToSearch({ models: ['Wan', 'Wan'], tags: [] })), { models: ['Wan'], tags: [] });
});

test('短提示词复制原文，不转码、不增删换行', () => {
  const prompt = '第一行 <camera> & action\n第二行：繁體原文。';
  assert.equal(getCopyText({ isLong: false, prompt }), prompt);
});

test('长提示词只复制摘录、换行与完整版原帖链接', () => {
  const entry = { isLong: true, prompt: null, promptExcerpt: 'Shot 1：前 300 字摘錄…', postUrl: 'https://x.com/example/status/123' };
  assert.equal(getCopyText(entry), 'Shot 1：前 300 字摘錄…\n完整版：https://x.com/example/status/123');
});

test('真实 63 条资料的复制内容符合 1500 字门槛和摘录规则', async () => {
  const data = JSON.parse(await readFile(new URL('../data/prompts.json', import.meta.url), 'utf8'));
  assert.equal(data.entries.length, 63);
  for (const entry of data.entries) {
    assert.ok(getCopyText(entry).length <= data.lengthThreshold, entry.id);
    assert.equal(getCopyText(entry), entry.isLong ? `${entry.promptExcerpt}\n完整版：${entry.postUrl}` : entry.prompt);
  }
});
