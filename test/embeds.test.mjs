import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmbeds } from '../web/embeds.mjs';

function environment({ sdk = true, observer = true } = {}) {
  const observed = new Set();
  const loads = [];
  const listeners = new Map();
  const tasks = new Map();
  let callback;
  let timer = 0;
  const window = {
    innerHeight: 800,
    requestAnimationFrame(fn) { fn(); },
    addEventListener(event, fn) { listeners.set(event, fn); },
  };
  function enableSdk() {
    window.twttr = { widgets: { load(host) { loads.push(host); return Promise.resolve(); } } };
  }
  if (sdk) enableSdk();
  if (observer) window.IntersectionObserver = class {
    constructor(fn, options) { callback = fn; assert.equal(options.rootMargin, '320px 0px'); }
    observe(card) { observed.add(card); }
    unobserve(card) { observed.delete(card); }
  };
  const scriptListeners = new Map();
  const document = { querySelector() { return { addEventListener(event, fn) { scriptListeners.set(event, fn); } }; } };
  const embeds = createEmbeds({ window, document,
    setTimeout(fn) { tasks.set(++timer, fn); return timer; },
    clearTimeout(id) { tasks.delete(id); },
  });
  return { embeds, loads, observed, tasks, listeners, enableSdk, scriptListeners,
    intersect(cards) { callback(cards.map(target => ({ target, isIntersecting: true }))); },
  };
}

function card(top = 0) {
  const host = { children: [], replaceChildren(child) { this.children = [child]; } };
  const template = { content: { cloneNode() { return 'official blockquote'; } } };
  return {
    hidden: false, host, top,
    querySelector(selector) { return selector === '.tweet-mount' ? host : template; },
    getBoundingClientRect() { return { top: this.top, bottom: this.top + 500 }; },
  };
}

test('63 张卡片只观察，不批量加载；仅接近视口的卡片调用 widgets.load 一次', () => {
  const env = environment();
  const cards = Array.from({ length: 63 }, (_, i) => card(i * 600));
  env.embeds.update(cards);
  assert.equal(env.observed.size, 63);
  assert.equal(env.loads.length, 0);
  assert.ok(cards.every(item => item.host.children.length === 0));
  env.intersect([cards[0], cards[1]]);
  assert.deepEqual(env.loads, [cards[0].host, cards[1].host]);
  env.embeds.update(cards);
  env.intersect([cards[0]]);
  assert.equal(env.loads.length, 2);
});

test('筛选隐藏卡片不加载，重新显示后仍能观察与渲染', () => {
  const env = environment();
  const cards = [card(), card()];
  cards[1].hidden = true;
  env.embeds.update(cards);
  assert.ok(!env.observed.has(cards[1]));
  env.intersect([cards[1]]);
  assert.equal(env.loads.length, 0);
  cards[1].hidden = false;
  env.embeds.update(cards);
  assert.ok(env.observed.has(cards[1]));
  env.intersect([cards[1]]);
  assert.deepEqual(env.loads, [cards[1].host]);
});

test('SDK 不可用时保留空挂载点和独立观看链接；错误停止轮询', () => {
  const env = environment({ sdk: false });
  const item = card();
  env.embeds.update([item]);
  env.intersect([item]);
  assert.equal(env.loads.length, 0);
  assert.deepEqual(item.host.children, []);
  assert.equal(env.tasks.size, 1);
  env.scriptListeners.get('error')();
  assert.equal(env.tasks.size, 0);
});

test('SDK 延迟就绪时只加载仍可见的排队卡片', () => {
  const env = environment({ sdk: false });
  const cards = [card(), card()];
  env.embeds.update(cards);
  env.intersect(cards);
  cards[0].hidden = true;
  env.embeds.update(cards);
  env.enableSdk();
  env.scriptListeners.get('load')();
  assert.deepEqual(env.loads, [cards[1].host]);
  cards[0].hidden = false;
  env.embeds.update(cards);
  env.intersect([cards[0]]);
  assert.deepEqual(env.loads, [cards[1].host, cards[0].host]);
});

test('没有 IntersectionObserver 时也只加载附近卡片，滚动后加载新卡片', () => {
  const env = environment({ observer: false });
  const cards = [card(0), card(4000)];
  env.embeds.update(cards);
  assert.deepEqual(env.loads, [cards[0].host]);
  cards[1].top = 700;
  env.listeners.get('scroll')();
  assert.deepEqual(env.loads, [cards[0].host, cards[1].host]);
});
