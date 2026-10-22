export const LANGUAGE_KEY = 'pcv-lang';
export const LANGUAGE_HINTS = {zh:'查看中文版 →',en:'Read this page in English →',ja:'日本語版で見る →'};
export function initLanguage({window=globalThis.window,document=globalThis.document}={}) {
  const current=document.body.dataset.locale || 'zh';
  const links=[...document.querySelectorAll('[data-language]')];
  const hint=document.querySelector('#language-hint');
  const target=hint?.querySelector('[data-preferred-language]');
  let preferred;
  try {preferred=window.localStorage.getItem(LANGUAGE_KEY);} catch {}
  const link=links.find(link=>link.dataset.language===preferred);
  if (hint && target && link && preferred!==current) {
    target.href=link.href;target.textContent=LANGUAGE_HINTS[preferred];target.lang=preferred==='zh'?'zh-CN':preferred;
    hint.hidden=false;
  }
  for (const link of links) link.addEventListener('click',()=>{try {window.localStorage.setItem(LANGUAGE_KEY,link.dataset.language);}catch{}});
  hint?.querySelector('[data-dismiss-language]')?.addEventListener('click',()=>{hint.hidden=true;});
  // Navigation remains the anchor's normal action; never redirect automatically.
}

export function workflowCopyText(scope) {
  return scope.querySelector('pre').textContent;
}
export function localizedCopyText(entry, fullVersion) {
  return entry.isLong ? `${entry.promptExcerpt}\n${fullVersion}${entry.postUrl}` : entry.prompt;
}
