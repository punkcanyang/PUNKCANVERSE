import { redirectTarget } from '../lib/redirect.mjs';

import site from '../data/site.json' with { type: 'json' };
import { notFoundHtml } from '../lib/not-found.mjs';

function isKnowledgeBasePath(path) {
  const route = path.replace(/^\/zh(?=\/)/, '');
  return /^\/(?:prompts|img\/official)(?:\/|$)/.test(route)
    || /^\/(?:tips|tools|regions)(?:\.html)?(?:\/|$)/.test(route)
    || /^\/(?:data\.json|catalog\.json|assets\/prompt-text(?:\.[a-f0-9]+)?\.json)$/.test(route);
}

export function onRequest(context) {
  const target = redirectTarget(context.request.url);
  if (target) return Response.redirect(target, 301);
  // Pages can still have cached assets from an earlier deployment.
  if (!site.publishKnowledgeBase && isKnowledgeBasePath(new URL(context.request.url).pathname)) {
    return new Response(context.request.method === 'HEAD' ? null : notFoundHtml, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return context.next();
}
