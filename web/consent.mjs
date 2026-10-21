const CONSENT_KEY = 'pcv-consent';
export const consentValues = value => ({ analytics_storage:value, ad_storage:value, ad_user_data:value, ad_personalization:value });

export function initConsent({ window = globalThis.window, document = globalThis.document } = {}) {
  const banner = document.querySelector('#cookie-consent');
  if (!banner) return;
  let opener;
  function read() {
    try {
      const value = window.localStorage.getItem(CONSENT_KEY);
      return value === 'granted' || value === 'denied' ? value : null;
    } catch { return null; }
  }
  function update(value) {
    if (typeof window.gtag === 'function') window.gtag('consent','update',consentValues(value));
    else (window.dataLayer ||= []).push(['consent','update',consentValues(value)]);
  }
  function measure() {
    document.body.style.setProperty('--consent-space', banner.hidden ? '0px' : `${Math.ceil(banner.getBoundingClientRect().height) + 16}px`);
  }
  function show(focus = false) {
    banner.hidden = false;
    measure();
    if (focus) banner.querySelector('[data-consent]')?.focus({preventScroll:true});
  }
  function choose(value) {
    if (!['granted','denied'].includes(value)) return;
    update(value);
    try { window.localStorage.setItem(CONSENT_KEY,value); } catch { /* The current choice still applies when storage is blocked. */ }
    banner.hidden = true;
    measure();
    opener?.focus({preventScroll:true});
  }
  document.addEventListener('click', event => {
    const choice = event.target.closest?.('[data-consent]');
    if (choice) { choose(choice.dataset.consent); return; }
    const settings = event.target.closest?.('[data-cookie-settings]');
    if (settings) {
      opener = settings;
      try { window.localStorage.removeItem(CONSENT_KEY); } catch { /* Storage can be unavailable. */ }
      update('denied');
      show(true);
    }
  });
  window.addEventListener('resize',measure);
  window.addEventListener('storage', event => {
    if (event.key !== CONSENT_KEY && event.key !== null) return;
    const value = read();
    update(value || 'denied');
    banner.hidden = value !== null;
    measure();
  });
  if (window.ResizeObserver) new window.ResizeObserver(measure).observe(banner);
  if (read() === null) show(); else { banner.hidden = true; measure(); }
  return { choose, read };
}
