export const GA_ID = 'G-NPK7CFCCT0';
export const GA_SCRIPT_URL = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
export const CONSENT_KEY = 'pcv-consent';
export const CONSENT_BOOTSTRAP = `window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
try{if(window.localStorage.getItem('${CONSENT_KEY}')==='granted'){gtag('consent','update',{analytics_storage:'granted',ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted'});}}catch{}`;
export const GA_CONFIG = `gtag('js', new Date());\ngtag('config','${GA_ID}');`;

export function renderAnalytics() {
  return `<script data-pcv-consent>${CONSENT_BOOTSTRAP}</script>\n  <script async src="${GA_SCRIPT_URL}"></script>\n  <script data-pcv-ga>${GA_CONFIG}</script>`;
}

export function renderConsentBanner(ui) {
  if (!ui) return `<section id="cookie-consent" class="cookie-consent" aria-label="Cookie 同意设置" hidden><div><strong>COOKIE / YOUR CHOICE</strong><p>我们使用 Cookie 了解访问情况，你可以接受或拒绝。<a href="/privacy/">Privacy Policy</a></p></div><div class="consent-actions"><button type="button" data-consent="granted">接受</button><button type="button" data-consent="denied">拒绝</button></div></section>`;
  return `<section id="cookie-consent" class="cookie-consent" aria-label="${escapeAttr(ui.aria)}" hidden><div><strong>${escapeAttr(ui.title)}</strong><p>${escapeAttr(ui.body)}<a href="${escapeAttr(ui.privacyHref)}">${escapeAttr(ui.privacy)}</a></p></div><div class="consent-actions"><button type="button" data-consent="granted">${escapeAttr(ui.accept)}</button><button type="button" data-consent="denied">${escapeAttr(ui.reject)}</button></div></section>`;
}

function escapeAttr(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

// Offline verification of the exact approved inline scripts and their order.
export function verifyAnalyticsHtml(html) {
  const fail = message => { throw new Error(`Analytics verification: ${message}`); };
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  if (!head) fail('missing head');
  const scripts = [...head.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const inline = scripts.filter(match => !/\bsrc\s*=/.test(match[1]));
  if (inline.length !== 2 || inline[0][2] !== CONSENT_BOOTSTRAP || inline[1][2] !== GA_CONFIG) fail('missing ID, denied default, or unexpected inline script');
  const ga = scripts.filter(match => match[1].includes(`src="${GA_SCRIPT_URL}"`));
  if (ga.length !== 1 || !/\basync\b/.test(ga[0][1])) fail('missing async gtag/js ID');
  if (!(inline[0].index < ga[0].index && ga[0].index < inline[1].index)) fail('consent default must precede config and tag loading');
  if (!html.includes('id="cookie-consent"') || !html.includes('data-cookie-settings')) fail('missing consent controls');
  return true;
}
