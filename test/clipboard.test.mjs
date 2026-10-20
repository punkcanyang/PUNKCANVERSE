import test from 'node:test';
import assert from 'node:assert/strict';
import { copyText } from '../web/clipboard.mjs';

function fallbackDocument(result = true) {
  const calls = [];
  const textarea = {
    style: {}, value: '', setAttribute() {},
    focus() { calls.push('textarea focus'); }, select() { calls.push('select'); },
    setSelectionRange(start, end) { calls.push([start, end]); },
    remove() { calls.push('removed'); },
  };
  const document = {
    activeElement: { focus() { calls.push('restored focus'); } },
    createElement(tag) { assert.equal(tag, 'textarea'); return textarea; },
    body: { append(node) { assert.equal(node, textarea); calls.push('append'); } },
    execCommand(command) { assert.equal(command, 'copy'); calls.push('copy'); return result; },
  };
  return { document, textarea, calls };
}

test('Clipboard API 成功时直接复制', async () => {
  let copied;
  assert.equal(await copyText('原文\ntext', { navigator: { clipboard: { async writeText(text) { copied = text; } } }, document: null }), true);
  assert.equal(copied, '原文\ntext');
});

test('Clipboard API 拒绝时使用 textarea + execCommand，清理并还原焦点', async () => {
  const fallback = fallbackDocument();
  const navigator = { clipboard: { async writeText() { throw new Error('blocked'); } } };
  assert.equal(await copyText('摘錄\n完整版：https://x.com/a/status/1', { navigator, document: fallback.document }), true);
  assert.equal(fallback.textarea.value, '摘錄\n完整版：https://x.com/a/status/1');
  assert.deepEqual(fallback.calls.slice(-3), ['copy', 'removed', 'restored focus']);
});

test('Clipboard API 不存在时也能退回；两种方式失败时返回 false', async () => {
  assert.equal(await copyText('text', { navigator: {}, document: fallbackDocument().document }), true);
  const failed = fallbackDocument(false);
  assert.equal(await copyText('text', { navigator: {}, document: failed.document }), false);
  assert.equal(failed.calls.at(-2), 'removed');
  assert.equal(await copyText('text', { navigator: {}, document: null }), false);
});

test('execCommand 抛出错误时也清理临时节点', async () => {
  const fallback = fallbackDocument();
  fallback.document.execCommand = () => { throw new Error('unsupported'); };
  assert.equal(await copyText('text', { navigator: {}, document: fallback.document }), false);
  assert.deepEqual(fallback.calls.slice(-2), ['removed', 'restored focus']);
});
