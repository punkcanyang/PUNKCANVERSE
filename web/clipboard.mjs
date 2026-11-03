// Keep the fallback synchronous after Clipboard API failure, with focus restored.
// Pending text (a promise) is handed to a ClipboardItem first so Safari keeps the
// click's user activation while the source text is still loading.
export async function copyText(text, { navigator = globalThis.navigator, document = globalThis.document, ClipboardItem = globalThis.ClipboardItem } = {}) {
  if (typeof text !== 'string') {
    const pending = Promise.resolve(text);
    if (navigator?.clipboard?.write && ClipboardItem) {
      const blob = pending.then(value => {
        if (typeof value !== 'string') throw new Error('Missing text');
        return new Blob([value], { type: 'text/plain' });
      });
      // The browser may reject write() without reading the item; failure is reported below.
      blob.catch(() => {});
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
        return true;
      } catch {
        // Fall through to the string path once the text is available.
      }
    }
    try { text = await pending; } catch { return false; }
    if (typeof text !== 'string') return false;
  }
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Older browsers and permission restrictions may still allow execCommand.
  }
  const active = document?.activeElement;
  let textarea;
  try {
    textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-label', '复制提示词');
    textarea.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.append(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return Boolean(document.execCommand('copy'));
  } catch {
    return false;
  } finally {
    textarea?.remove();
    active?.focus({ preventScroll: true });
  }
}
