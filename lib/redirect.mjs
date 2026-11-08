const REDIRECT_HOSTS = new Set(['www.punkcanverse.com', 'fight-prompts.pages.dev']);
const CANONICAL_ORIGIN = 'https://punkcanverse.com';
// English moved from /en/ to the root and Japanese was retired; both old trees
// land on the matching English page.
const RETIRED_PREFIXES = ['/en', '/ja'];

function retiredPath(pathname) {
  const prefix = RETIRED_PREFIXES.find(p => pathname === p || pathname.startsWith(`${p}/`));
  return prefix ? pathname.slice(prefix.length) || '/' : null;
}

// The two alias hosts always redirect to the canonical origin. On any host, the
// retired /en and /ja trees redirect to the same path without the prefix.
// Encoded paths and query strings are kept as sent, never reserialized.
export function redirectTarget(url) {
  const source = new URL(url);
  if (!['http:', 'https:'].includes(source.protocol)) return null;
  const retired = retiredPath(source.pathname);
  if (REDIRECT_HOSTS.has(source.host)) return `${CANONICAL_ORIGIN}${retired ?? source.pathname}${source.search}`;
  if (retired !== null) return `${source.origin}${retired}${source.search}`;
  return null;
}
