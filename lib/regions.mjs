import { escapeHtml, externalLink } from './markdown.mjs';

export const REGION_DISCLAIMER = '仅整理官方政策与申诉管道，不提供也不推荐任何绕过地区限制的方法。';
export const REGION_BANNED_TERMS = Object.freeze([
  'VPN', 'vpn', '代理', '節點', '节点', '买号', '買號', '代充', '代儲', '代储',
  '翻墙', '翻牆', '梯子', '机场', '機場', 'proxy', 'Proxy', '科学上网', '科學上網',
]);
export const REGION_BANNED_TERMS_EN = Object.freeze([
  'VPN', 'proxy',
  'bypass', 'bypassing', 'circumvent', 'circumvention', 'get around', 'get-around',
  'unblock', 'unblocking', 'spoof', 'spoofing', 'jailbreak', 'jailbreaking',
  'geobypass', 'geo-bypass', 'socks5', 'shadowsocks', 'openvpn', 'wireguard',
]);
export const REGION_BANNED_TERMS_JA = Object.freeze([
  'ジェイルブレイク', 'ジェールブレイク', '脱獄', '回避', '迂回', 'プロキシ', 'プロクシ',
  '規制を突破', 'ブロック解除', '抜け道', 'すり抜け', '検閲回避', '地域制限回避',
  'VPN突破', '規制回避', '踏み台',
]);
export const REGION_SOURCES = Object.freeze([
  'https://www.anthropic.com/legal/supported-regions',
  'https://support.claude.com/en/articles/8461763-where-can-i-access-claude',
  'https://support.claude.com/en/articles/8241253-safeguards-warnings-and-appeals',
  'https://www.anthropic.com/legal/aup',
  'https://developers.openai.com/api/docs/supported-countries',
  'https://support.google.com/gemini/answer/13575153',
  'https://ai.google.dev/gemini-api/docs/available-regions',
  'https://x.ai/legal/faq',
]);

export function validateRegionText(text) {
  const normalized = String(text).toLowerCase();
  for (const list of [REGION_BANNED_TERMS, REGION_BANNED_TERMS_EN, REGION_BANNED_TERMS_JA]) {
    const term = list.find(word => normalized.includes(word.toLowerCase()));
    if (term) throw new Error(`Regions content contains forbidden term: ${term}`);
  }
}

export function validateRegions(data, raw = JSON.stringify(data)) {
  validateRegionText(raw);
  validateRegionText(JSON.stringify(data));
  if (!Array.isArray(data?.entries) || data.entries.length < 5) throw new Error('At least five region entries are required');
  const ids = new Set();
  for (const entry of data.entries) {
    for (const field of ['id', 'title', 'vendor', 'summary', 'sourceUrl', 'officialUrl', 'checked']) {
      if (typeof entry[field] !== 'string' || !entry[field].trim()) throw new Error(`Region entry requires ${field}`);
    }
    if (ids.has(entry.id)) throw new Error(`Duplicate region id: ${entry.id}`);
    ids.add(entry.id);
    for (const field of ['sourceUrl', 'officialUrl']) {
      if (!entry[field].startsWith('https://') || !REGION_SOURCES.includes(entry[field])) throw new Error(`${entry.id}: invalid official HTTPS source`);
    }
    if (entry.checked !== '2026-10-21') throw new Error(`${entry.id}: invalid checked date`);
    const sentences = entry.summary.split(/[。！？]/u).filter(text => text.trim());
    if (sentences.length < 2 || sentences.length > 4) throw new Error(`${entry.id}: summary must contain 2–4 sentences`);
  }
}

export function renderRegions(data, ui) {
  validateRegions(data);
  if (!ui) return `<header class="page-intro"><p class="eyebrow">OFFICIAL POLICIES / 官方资料</p><h1>AI 工具各地区使用与申诉</h1><p class="notice regions-disclaimer">${REGION_DISCLAIMER}</p><p>按产品核对可用范围与申诉入口。以下为官方资料摘要，请以官方页面的现行版本为准。</p></header><div class="regions-grid">${data.entries.map(entry => `<article class="region-card"><div class="region-meta"><span>${escapeHtml(entry.vendor)}</span><span>检查日期：<time datetime="${entry.checked}">${entry.checked}</time></span></div><h2>${escapeHtml(entry.title)}</h2><p>${escapeHtml(entry.summary)}</p><div class="region-links">${externalLink(entry.sourceUrl, '资料来源 ↗')}${externalLink(entry.officialUrl, '官方页面与入口 ↗')}</div></article>`).join('')}</div>`;
  const text = id => ui.entries[id] || {};
  return `<header class="page-intro"><p class="eyebrow">${escapeHtml(ui.eyebrow)}</p><h1>${escapeHtml(ui.title)}</h1><p class="notice regions-disclaimer">${escapeHtml(ui.disclaimer)}</p><p>${escapeHtml(ui.intro)}</p></header><div class="regions-grid">${data.entries.map(entry => {
    const copy = text(entry.id);
    return `<article class="region-card"><div class="region-meta"><span>${escapeHtml(entry.vendor)}</span><span>${escapeHtml(ui.checkedLabel)}<time datetime="${entry.checked}">${entry.checked}</time></span></div><h2>${escapeHtml(copy.title || entry.title)}</h2><p>${escapeHtml(copy.summary || entry.summary)}</p><div class="region-links">${externalLink(entry.sourceUrl, ui.sourceLabel)}${externalLink(entry.officialUrl, ui.officialLabel)}</div></article>`;
  }).join('')}</div>`;
}
