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
  if(entry.collection==='wan-minimax')return '';
  const links = Object.entries(affiliates).flatMap(([key,platform]) => {
    if (!platform.models.some(model => entry.models.includes(model))) return [];
    const url = safeUrl(platform.url);
    if (!url) return [];
    const about=key==='higgsfield'?`<a class="tool-about" href="${escapeHtml(ui?.toolsHref || '/tools')}#higgsfield">${escapeHtml(ui?.aboutLabel || '了解這個工具')}</a>`:'';
    return [renderPlatform(platform, url, ui)+about];
  });
  return links.length ? `<div class="affiliate-links">${links.join('')}</div>` : '';
}

export function renderPlatform(platform, url, ui) {
  if (!ui) return `<div class="affiliate-item"><a class="affiliate-button" href="${escapeHtml(url)}" target="_blank" rel="sponsored noopener noreferrer">去 ${escapeHtml(platform.name)} 试试</a><a href="/affiliate-disclosure/" class="affiliate-label"><small>推广连结</small></a>${platform.code ? `<small class="affiliate-code">推广码 ${escapeHtml(platform.code)}</small>` : ''}</div>`;
  const code = platform.code ? `<small class="affiliate-code">${escapeHtml(ui.codeLabel)} ${escapeHtml(platform.code)}</small>` : '';
  return `<div class="affiliate-item"><a class="affiliate-button" href="${escapeHtml(url)}" target="_blank" rel="sponsored noopener noreferrer">${escapeHtml(ui.tryLabel(platform.name))}</a><a href="${escapeHtml(ui.disclosureHref)}" class="affiliate-label"><small>${escapeHtml(ui.promoLabel)}</small></a>${code}</div>`;
}

export function renderRecommendedTools(affiliates, ui) {
  const platforms = ['magnific', 'pixverse'].map(key => affiliates[key]).filter(platform => platform && safeUrl(platform.url));
  if (!platforms.length) return '';
  if (!ui) return `<section class="recommended-tools"><p class="eyebrow">TOOLS / RESOURCES</p><h2>推荐工具</h2>${platforms.map(platform => renderPlatform(platform, safeUrl(platform.url))).join('')}</section>`;
  return ui.render(platforms);
}
