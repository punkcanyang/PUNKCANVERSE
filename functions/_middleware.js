import { redirectTarget } from '../lib/redirect.mjs';

export function onRequest(context) {
  const target = redirectTarget(context.request.url);
  return target ? Response.redirect(target, 301) : context.next();
}
