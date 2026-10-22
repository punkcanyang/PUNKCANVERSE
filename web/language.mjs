export const LANGUAGE_KEY = 'pcv-lang';
export const LANGUAGE_HINT_DISMISS_KEY = 'pcv-lang-hint-dismissed';
export const LANGUAGE_HINTS = {zh:'查看中文版 →',en:'Read this page in English →',ja:'日本語版で見る →'};
export function initLanguage({window=globalThis.window,document=globalThis.document}={}) {
  const current=document.body.dataset.locale || 'zh';
  const links=[...document.querySelectorAll('[data-language]')];
  const hint=document.querySelector('#language-hint');
  const target=hint?.querySelector('[data-preferred-language]');
  let preferred, dismissed;
  try {preferred=window.localStorage.getItem(LANGUAGE_KEY);} catch {}
  // A dismissal survives navigation in this tab. A later explicit language
  // choice resets it; the preference itself remains in localStorage.
  try {dismissed=window.sessionStorage?.getItem(LANGUAGE_HINT_DISMISS_KEY);} catch {}
  const link=links.find(link=>link.dataset.language===preferred);
  if (hint && target && link && preferred!==current && dismissed!==preferred) {
    target.href=link.href;target.textContent=LANGUAGE_HINTS[preferred];target.lang=preferred==='zh'?'zh-CN':preferred;
    hint.hidden=false;
  }
  for (const link of links) link.addEventListener('click',()=>{
    try {window.localStorage.setItem(LANGUAGE_KEY,link.dataset.language);}catch{}
    try {window.sessionStorage?.removeItem(LANGUAGE_HINT_DISMISS_KEY);}catch{}
  });
  hint?.querySelector('[data-dismiss-language]')?.addEventListener('click',()=>{
    hint.hidden=true;
    try {window.sessionStorage?.setItem(LANGUAGE_HINT_DISMISS_KEY,preferred);}catch{}
  });
  // Navigation remains the anchor's normal action; never redirect automatically.
}

export function workflowCopyText(scope) {
  return scope.querySelector('pre').textContent;
}
export function localizedCopyText(entry, fullVersion) {
  return entry.isLong ? `${entry.promptExcerpt}\n${fullVersion}${entry.postUrl || entry.officialUrl}` : entry.prompt;
}
