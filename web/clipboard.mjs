// Keep the fallback synchronous after Clipboard API failure, with focus restored.
export async function copyText(text, { navigator = globalThis.navigator, document = globalThis.document } = {}) {
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
