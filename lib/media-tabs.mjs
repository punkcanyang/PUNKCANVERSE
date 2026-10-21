import { escapeHtml } from './markdown.mjs';

export const MEDIUM_NAMES = { video: '视频', image: '图像', music: '音乐' };
export const promptPath = entry => `/prompts/${entry.medium || 'video'}/${entry.id}/`;

export function renderMediaTabs(entries, selected = 'video') {
  return `<nav class="media-tabs" aria-label="提示词媒介">${Object.entries(MEDIUM_NAMES).map(([medium, label]) => {
    const count = entries.filter(entry => (entry.medium || 'video') === medium).length;
    return `<a href="/prompts/${medium}/"${medium === selected ? ' aria-current="page"' : ''}>${escapeHtml(label)} <b>${count}</b></a>`;
  }).join('')}</nav>`;
}

export function relatedPrompts(entry, entries) {
  return entries.filter(other => other.id !== entry.id && (other.models.some(model => entry.models.includes(model)) || other.tags.some(tag => entry.tags.includes(tag)))).slice(0, 3);
}
