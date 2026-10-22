import { escapeHtml, safeUrl } from './markdown.mjs';

export const AFFILIATE_DISCLOSURE = '本站部分按钮为推广连结，通过它们注册或购买，本站可能获得佣金，不影响你的价格。';

export function validateAffiliates(affiliates) {
  if (!affiliates || Array.isArray(affiliates) || typeof affiliates !== 'object') throw new Error('Invalid affiliates configuration');
  for (const [key, platform] of Object.entries(affiliates)) {
    if (!platform || typeof platform.name !== 'string' || !platform.name.trim() || typeof platform.url !== 'string' ||
        !Array.isArray(platform.models) || !platform.models.every(model => typeof model === 'string' && model.trim())) throw new Error(`Invalid affiliate platform: ${key}`);
  }
}

export function renderAffiliates(entry, affiliates = {}, ui) {
  const links = Object.values(affiliates).flatMap(platform => {
    if (!platform.models.some(model => entry.models.includes(model))) return [];
    const url = safeUrl(platform.url);
    if (!url) return [];
    return [renderPlatform(platform, url, ui)];
  });
  return links.length ? `<div class="affiliate-links">${links.join('')}</div>` : '';
}

function renderPlatform(platform, url, ui) {
  if (!ui) return `<div class="affiliate-item"><a class="affiliate-button" href="${escapeHtml(url)}" target="_blank" rel="sponsored noopener noreferrer">去 ${escapeHtml(platform.name)} 试试</a><a href="/affiliate-disclosure/" class="affiliate-label"><small>推广连结</small></a>${platform.code ? `<small class="affiliate-code">推广码 ${escapeHtml(platform.code)}</small>` : ''}</div>`;
  const code = platform.code ? `<small class="affiliate-code">${escapeHtml(ui.codeLabel)} ${escapeHtml(platform.code)}</small>` : '';
  return `<div class="affiliate-item"><a class="affiliate-button" href="${escapeHtml(url)}" target="_blank" rel="sponsored noopener noreferrer">${escapeHtml(ui.tryLabel(platform.name))}</a><a href="${escapeHtml(ui.disclosureHref)}" class="affiliate-label"><small>${escapeHtml(ui.promoLabel)}</small></a>${code}</div>`;
}

export function renderRecommendedTools(affiliates, ui) {
  const platform = affiliates.magnific;
  const url = platform && safeUrl(platform.url);
  if (!url) return '';
  if (!ui) return `<section class="recommended-tools"><p class="eyebrow">TOOLS / RESOURCES</p><h2>推荐工具</h2>${renderPlatform(platform, url)}</section>`;
  return ui.render(platform);
}
