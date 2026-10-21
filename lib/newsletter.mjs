import { escapeHtml, safeUrl } from './markdown.mjs';

export function validateSite(site) {
  const newsletter = site?.newsletter;
  if (!newsletter || typeof newsletter.enabled !== 'boolean' || newsletter.provider !== 'beehiiv' || typeof newsletter.embedUrl !== 'string') throw new Error('Invalid newsletter configuration');
}

export function newsletterUrl(site) {
  const newsletter = site?.newsletter;
  if (newsletter?.enabled !== true || newsletter.provider !== 'beehiiv') return null;
  const url = safeUrl(newsletter.embedUrl ?? '');
  if (!url) return null;
  const parsed = new URL(url);
  return parsed.protocol === 'https:' && !parsed.port && ['beehiiv.com', 'embeds.beehiiv.com'].includes(parsed.hostname) ? url : null;
}

export function renderNewsletter(site) {
  const url = newsletterUrl(site);
  if (!url) return '';
  return `<section class="newsletter" aria-labelledby="newsletter-title"><div><h2 id="newsletter-title">创作灵感，每周一封。</h2><p>订阅提示词周报，接收新案例与写法笔记。</p></div><iframe src="${escapeHtml(url)}" title="订阅提示词周报" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-forms allow-scripts allow-same-origin allow-popups"></iframe></section>`;
}
