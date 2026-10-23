import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { escapeHtml as e, safeUrl } from './markdown.mjs';

const locales = ['zh', 'en', 'ja'];
function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing work ${field}`);
}
function translated(value, field) {
  for (const locale of locales) text(value?.[locale], `${field}.${locale}`);
}
export function workUrl(value) {
  text(value, 'URL');
  const url = safeUrl(value);
  if (!url || new URL(url).protocol !== 'https:') throw new Error('Work media and links require public HTTPS URLs');
  return url;
}

// Explicit publication opt-in. Draft payloads never enter HTML, sitemap or a public JSON file.
export function publishedWorks(data) {
  if (!Array.isArray(data?.entries)) throw new Error('Works require an entries array');
  const slugs = new Set();
  for (const work of data.entries) {
    if (typeof work?.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(work.slug) || slugs.has(work.slug)) throw new Error('Invalid or duplicate work slug');
    slugs.add(work.slug);
    if (typeof work.published !== 'boolean') throw new Error('Work requires an explicit published flag');
    if (!work.published) continue;
    for (const locale of locales) {
      for (const key of ['title', 'summary']) text(work.copy?.[locale]?.[key], `${locale}.${key}`);
      if (work.copy[locale].description !== undefined) text(work.copy[locale].description, `${locale}.description`);
    }
    if (!Array.isArray(work.media) || !Array.isArray(work.links)) throw new Error('Work requires media and links arrays');
    for (const media of work.media) {
      if (!['image', 'video'].includes(media.type)) throw new Error('Invalid work media type');
      workUrl(media.src);
      translated(media.alt, 'media.alt');
      if (![media.width, media.height].every(n => Number.isInteger(n) && n > 0)) throw new Error('Work media requires dimensions');
      if (media.poster !== undefined) {
        if (media.type !== 'video') throw new Error('Only video accepts a poster');
        workUrl(media.poster);
      }
    }
    for (const link of work.links) { workUrl(link.url); translated(link.label, 'link.label'); }
  }
  return data.entries.filter(work => work.published);
}

export async function loadWorks(root) {
  return publishedWorks(JSON.parse(await readFile(join(root, 'content/works.json'), 'utf8')));
}

function image(media, locale, src = media.src) {
  return `<img src="${e(workUrl(src))}" alt="${e(media.alt[locale])}" width="${media.width}" height="${media.height}" loading="lazy" decoding="async">`;
}
function cover(work, locale) {
  const media = work.media.find(item => item.type === 'image' || item.poster);
  return media ? `<div class="work-cover">${image(media, locale, media.type === 'video' ? media.poster : media.src)}</div>` : '';
}
export function renderWorks(works, locale, ui, href) {
  const intro = `<header class="page-intro"><p class="eyebrow">${e(ui.eyebrow)}</p><h1>${e(ui.title)}</h1><p>${e(ui.intro)}</p></header>`;
  if (!works.length) return `${intro}<section class="works-empty"><span class="cut-label">${e(ui.emptyLabel)}</span><h2>${e(ui.emptyTitle)}</h2><p>${e(ui.emptyBody)}</p><a class="text-link" href="${href('/prompts/video/')}">${e(ui.browsePrompts)} ↗</a></section>`;
  return `${intro}<div class="works-grid">${works.map(work => {
    const copy = work.copy[locale];
    return `<article class="work-card">${cover(work, locale)}<div class="work-card-copy"><h2><a href="${href(`/works/${work.slug}/`)}">${e(copy.title)}</a></h2><p>${e(copy.summary)}</p><a class="text-link" href="${href(`/works/${work.slug}/`)}">${e(ui.viewWork)} ↗</a></div></article>`;
  }).join('')}</div>`;
}

export function renderWork(work, locale, ui, href) {
  const copy = work.copy[locale];
  const media = work.media.map(item => `<figure class="work-media">${item.type === 'image' ? image(item, locale)
    : `<video controls playsinline preload="none" width="${item.width}" height="${item.height}" aria-label="${e(item.alt[locale])}"${item.poster ? ` poster="${e(workUrl(item.poster))}"` : ''} src="${e(workUrl(item.src))}"><a href="${e(workUrl(item.src))}" target="_blank" rel="noopener noreferrer">${e(ui.openMedia)}</a></video>`}<figcaption>${e(item.alt[locale])}${item.type === 'video' ? ` · <a href="${e(workUrl(item.src))}" target="_blank" rel="noopener noreferrer">${e(ui.openMedia)} ↗</a>` : ''}</figcaption></figure>`).join('');
  const links = work.links.length ? `<section class="work-links"><h2>${e(ui.linksTitle)}</h2>${work.links.map(link => `<a class="text-link" href="${e(workUrl(link.url))}" target="_blank" rel="noopener noreferrer">${e(link.label[locale])} ↗</a>`).join('')}</section>` : '';
  return `<article class="work-detail"><header class="page-intro"><a class="text-link" href="${href('/works/')}">← ${e(ui.back)}</a><p class="eyebrow">${e(ui.eyebrow)}</p><h1>${e(copy.title)}</h1><p>${e(copy.summary)}</p></header>${copy.description ? `<p class="work-description">${e(copy.description)}</p>` : ''}<div class="work-gallery">${media}</div>${links}</article>`;
}
