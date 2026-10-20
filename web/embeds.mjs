// No live blockquotes exist until a visible card approaches the viewport.
// This also prevents widgets.js's automatic initial scan from embedding all 63.
export function createEmbeds({ window = globalThis.window, document = globalThis.document, setTimeout = globalThis.setTimeout, clearTimeout = globalThis.clearTimeout } = {}) {
  const pending = new Set();
  const states = new WeakMap();
  let pollTimer;
  let deadline = 0;
  const visible = card => !card.hidden;
  function flush() {
    const widgets = window.twttr?.widgets;
    if (!widgets?.load) return false;
    for (const card of pending) {
      pending.delete(card);
      if (!visible(card) || states.has(card)) continue;
      const host = card.querySelector('.tweet-mount');
      const template = card.querySelector('.tweet-template');
      states.set(card, 'loading');
      host.replaceChildren(template.content.cloneNode(true));
      try {
        Promise.resolve(widgets.load(host)).then(() => {
          states.set(card, 'loaded');
        }).catch(() => {
          // The permanent watch link stays usable if X rejects the embed.
          states.set(card, 'failed');
        });
      } catch {
        states.set(card, 'failed');
      }
    }
    return true;
  }
  function waitForWidgets() {
    clearTimeout(pollTimer);
    if (flush() || Date.now() >= deadline) return;
    pollTimer = setTimeout(waitForWidgets, 150);
  }
  function queue(card) {
    if (states.has(card) || !visible(card)) return;
    pending.add(card);
    deadline = Date.now() + 15000;
    waitForWidgets();
  }
  const observer = 'IntersectionObserver' in window ? new window.IntersectionObserver(records => {
    for (const record of records) {
      if (record.isIntersecting && visible(record.target)) {
        observer.unobserve(record.target);
        queue(record.target);
      }
    }
  }, { rootMargin: '320px 0px' }) : null;

  // A geometry fallback still loads only nearby cards in older browsers.
  const fallbackCards = new Set();
  function checkNearby() {
    for (const card of fallbackCards) {
      if (!visible(card)) continue;
      const rect = card.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 320 && rect.bottom >= -320) {
        fallbackCards.delete(card);
        queue(card);
      }
    }
  }
  if (!observer) {
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => { scheduled = false; checkNearby(); });
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
  }
  document.querySelector('#x-widgets')?.addEventListener('load', () => {
    clearTimeout(pollTimer);
    flush();
  });
  document.querySelector('#x-widgets')?.addEventListener('error', () => clearTimeout(pollTimer));
  return {
    update(cards) {
      for (const card of cards) {
        if (card.hidden) {
          observer?.unobserve(card);
          pending.delete(card);
          fallbackCards.delete(card);
        } else if (!states.has(card)) {
          if (observer) observer.observe(card);
          else fallbackCards.add(card);
        }
      }
      if (!observer) checkNearby();
    },
  };
}

