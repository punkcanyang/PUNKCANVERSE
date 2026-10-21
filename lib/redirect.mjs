const REDIRECT_HOSTS = new Set(['www.punkcanverse.com', 'fight-prompts.pages.dev']);
const CANONICAL_ORIGIN = 'https://punkcanverse.com';

// Only these two exact hosts redirect. Preserve encoded paths and query strings
// without reserializing their parameters; apex and preview hosts pass through.
export function redirectTarget(url) {
  const source = new URL(url);
  if (!['http:', 'https:'].includes(source.protocol) || !REDIRECT_HOSTS.has(source.host)) return null;
  return `${CANONICAL_ORIGIN}${source.pathname}${source.search}`;
}
