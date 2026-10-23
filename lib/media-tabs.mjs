import { escapeHtml } from './markdown.mjs';

export const MEDIUM_NAMES = { video: '视频', image: '图像', music: '音乐' };
export const promptPath = entry => `/prompts/${entry.medium || 'video'}/${entry.id}/`;

export function renderMediaTabs(entries, currentPath = '', options = {}) {
  const names = options.names || MEDIUM_NAMES;
  const aria = options.ariaLabel || '提示词媒介';
  const tabs = Object.entries(names).map(([medium, label]) => {
    const count = entries.filter(entry => (entry.medium || 'video') === medium).length;
    const path = options.mediumHref ? options.mediumHref(medium) : `/prompts/${medium}/`;
    return `<a href="${path}"${count===0?' class="is-empty"':''}${path === currentPath ? ' aria-current="page"' : ''}>${escapeHtml(label)} <b>${count}</b></a>`;
  });
  if (options.workflow) {
    const workflow = options.workflow;
    tabs.push(`<a href="${workflow.href}"${workflow.href === currentPath ? ' aria-current="page"' : ''}>${escapeHtml(workflow.label)} <b>${workflow.count}</b></a>`);
  }
  return `<nav class="media-tabs" aria-label="${escapeHtml(aria)}">${tabs.join('')}</nav>`;
}

export function relatedPrompts(entry, entries) {
  return entries.filter(other => other.id !== entry.id && (other.models.some(model => entry.models.includes(model)) || other.tags.some(tag => entry.tags.includes(tag)))).slice(0, 3);
}
