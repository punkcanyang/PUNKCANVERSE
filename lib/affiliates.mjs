import { escapeHtml, safeUrl } from './markdown.mjs';

export const AFFILIATE_DISCLOSURE = '本站部分按钮为推广连结，通过它们注册或购买，本站可能获得佣金，不影响你的价格。';

export function validateAffiliates(affiliates) {
  if (!affiliates || Array.isArray(affiliates) || typeof affiliates !== 'object') throw new Error('Invalid affiliates configuration');
  for (const [key, platform] of Object.entries(affiliates)) {
    if (!platform || typeof platform.name !== 'string' || !platform.name.trim() || typeof platform.url !== 'string' ||
        !Array.isArray(platform.models) || !platform.models.every(model => typeof model === 'string' && model.trim())) throw new Error(`Invalid affiliate platform: ${key}`);
  }
}

export function renderAffiliates(entry, affiliates = {}) {
  const links = Object.values(affiliates).flatMap(platform => {
    if (!platform.models.some(model => entry.models.includes(model))) return [];
    const url = safeUrl(platform.url);
    if (!url) return [];
    return [`<div class="affiliate-item"><a class="affiliate-button" href="${escapeHtml(url)}" target="_blank" rel="sponsored noopener noreferrer">去 ${escapeHtml(platform.name)} 试试</a><small>推广连结</small></div>`];
  });
  return links.length ? `<div class="affiliate-links">${links.join('')}</div>` : '';
}
