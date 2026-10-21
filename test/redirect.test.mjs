import test from 'node:test';
import assert from 'node:assert/strict';
import { redirectTarget } from '../lib/redirect.mjs';
import { onRequest } from '../functions/_middleware.js';

test('www 与旧 Pages 正式域名转向 HTTPS apex 首页', () => {
  for (const host of ['www.punkcanverse.com', 'fight-prompts.pages.dev']) {
    assert.equal(redirectTarget(`https://${host}/`), 'https://punkcanverse.com/');
  }
});

test('转址原样保留路径、中文编码、多选筛选与 query 顺序', () => {
  const path = '/tips.html?model=Wan&model=Seedance&tag=%E5%86%B7%E5%85%B5%E5%99%A8&term=a+b&encoded=%2F';
  for (const host of ['www.punkcanverse.com', 'fight-prompts.pages.dev']) {
    assert.equal(redirectTarget(`https://${host}${path}`), `https://punkcanverse.com${path}`);
    assert.equal(redirectTarget(`https://${host}/notes/%E4%B8%AD%E6%96%87?x=%26&x=2`), 'https://punkcanverse.com/notes/%E4%B8%AD%E6%96%87?x=%26&x=2');
  }
});

test('HTTP 来源也转向 HTTPS apex，并保留路径与 query', () => {
  for (const host of ['www.punkcanverse.com', 'fight-prompts.pages.dev']) {
    assert.equal(redirectTarget(`http://${host}/takedown.html?from=footer`), 'https://punkcanverse.com/takedown.html?from=footer');
  }
});

test('apex 不转址，HTTP apex 也交给 next，不造成循环', () => {
  for (const scheme of ['http', 'https']) assert.equal(redirectTarget(`${scheme}://punkcanverse.com/tips.html?model=Wan`), null);
});

test('hash、branch 预览子域名与其他域名不转址', () => {
  for (const host of [
    'abc123.fight-prompts.pages.dev', 'feat-v0-2.fight-prompts.pages.dev',
    'www.fight-prompts.pages.dev', 'preview.punkcanverse.com', 'localhost:8788',
    'fight-prompts.pages.dev.example.com', 'www.punkcanverse.com.example.com',
    'other.pages.dev', 'www.punkcanverse.com:8443',
  ]) assert.equal(redirectTarget(`https://${host}/?model=Wan`), null, host);
});

test('URL 对象保持不变，转址结果不会再次转址', () => {
  const source = new URL('https://www.punkcanverse.com/tips.html?tag=冷兵器');
  const original = source.href;
  const target = redirectTarget(source);
  assert.equal(source.href, original);
  assert.equal(redirectTarget(target), null);
});

test('middleware 对匹配 host 返回 301 与准确 Location，不调用 next', () => {
  for (const url of ['http://www.punkcanverse.com/tips.html?a=1&b=2', 'https://fight-prompts.pages.dev/tips.html?a=1&b=2']) {
    const response = onRequest({ request: new Request(url), next() { assert.fail('Redirect must not call next()'); } });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://punkcanverse.com/tips.html?a=1&b=2');
  }
});

test('middleware 对 apex 与预览域名原样返回 next 的响应', async () => {
  for (const host of ['punkcanverse.com', 'abc123.fight-prompts.pages.dev', 'fix-dead-post.fight-prompts.pages.dev']) {
    const expected = new Response('static content', { headers: { 'x-test-static': 'yes' } });
    let calls = 0;
    const response = await onRequest({ request: new Request(`https://${host}/tips.html?from=nav`), next() { calls++; return Promise.resolve(expected); } });
    assert.equal(calls, 1);
    assert.equal(response, expected);
    assert.equal(response.status, 200);
  }
});
