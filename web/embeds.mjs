// No live blockquotes exist until a visible card approaches the viewport.
// This also prevents widgets.js's automatic initial scan from embedding all 63.
export function createEmbeds({ window = globalThis.window, document = globalThis.document, setTimeout = globalThis.setTimeout, clearTimeout = globalThis.clearTimeout } = {}) {
  const pending = new Set();
  const states = new WeakMap();
  let pollTimer;
  let deadline = 0;
  // Removed posts have a visible notice instead of an embed mount/template.
  const visible = card => !card.hidden && Boolean(card.querySelector('.tweet-template') && card.querySelector('.tweet-mount'));
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
        if (!visible(card)) {
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

const widgetPromises = new WeakMap();
export function loadOfficialWidgets({ window = globalThis.window, document = globalThis.document, timeoutMs = 12000 } = {}) {
  if (window.twttr?.widgets?.load) return Promise.resolve(window.twttr);
  if (widgetPromises.has(document)) return widgetPromises.get(document);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'x-widgets';
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    const timer = window.setTimeout(() => fail(), timeoutMs);
    function fail() {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error('X embed unavailable'));
    }
    script.addEventListener('load', () => {
      window.clearTimeout(timer);
      if (window.twttr?.widgets?.load) resolve(window.twttr); else fail();
    });
    script.addEventListener('error', fail);
    document.head.append(script);
  });
  widgetPromises.set(document, promise);
  promise.catch(() => widgetPromises.delete(document));
  return promise;
}

export function bindClickEmbeds({ window = globalThis.window, document = globalThis.document, loadWidgets = () => loadOfficialWidgets({ window, document }), errorText = '嵌入暂时无法载入，请点击下方链接在 X 上观看。' } = {}) {
  document.addEventListener('click', async event => {
    const button = event.target.closest?.('[data-play-embed]');
    if (!button || button.disabled) return;
    const slot = button.closest('[data-embed]');
    const mount = slot?.querySelector('.tweet-mount');
    const template = slot?.querySelector('.tweet-template');
    if (!mount || !template) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      const twttr = await loadWidgets();
      mount.replaceChildren(template.content.cloneNode(true));
      mount.hidden = false;
      button.hidden = true;
      await twttr.widgets.load(mount);
    } catch {
      mount.hidden = true;
      mount.replaceChildren();
      button.hidden = false;
      button.disabled = false;
      let error = slot.querySelector('.embed-error');
      if (!error) { error = document.createElement('p'); error.className = 'embed-error'; error.setAttribute('role', 'status'); slot.append(error); }
      error.textContent = errorText;
    } finally { button.removeAttribute('aria-busy'); }
  });
  function showImageFallback(img) {
    if (img.tagName === 'IMG' && img.closest('.thumbnail-button')) {
      img.hidden = true;
      img.closest('.thumbnail-button').classList.add('image-failed');
    }
  }
  document.addEventListener('error', event => showImageFallback(event.target), true);
  // Cached failures can finish before the module installs its error listener.
  for (const img of document.querySelectorAll?.('.thumbnail-button img') || []) {
    if (img.complete && img.naturalWidth === 0) showImageFallback(img);
  }
}

