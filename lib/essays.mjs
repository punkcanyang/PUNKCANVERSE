import { readdir, readFile } from 'node:fs/promises';
import { escapeHtml as e, markdownToHtml } from './markdown.mjs';

export function parseEssay(source, filename) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`Missing essay front matter: ${filename}`);
  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const field = /^(title|date|summary|slug|aiAssisted|lang):\s*(.*?)\s*$/.exec(line);
    if (!field) throw new Error(`Invalid front matter: ${filename}`);
    metadata[field[1]] = field[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  for (const key of ['title', 'date', 'summary']) if (!metadata[key]) throw new Error(`Essay requires ${key}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date) || !Number.isFinite(Date.parse(metadata.date)) || new Date(metadata.date).toISOString().slice(0, 10) !== metadata.date) throw new Error('Invalid essay date');
  const slug = metadata.slug || filename.replace(/\.(?:en|ja)\.md$/, '').replace(/\.md$/, '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid essay slug');
  if (metadata.aiAssisted && !['true', 'false'].includes(metadata.aiAssisted)) throw new Error('Invalid aiAssisted flag');
  if (metadata.lang && !['zh', 'en', 'ja'].includes(metadata.lang)) throw new Error('Invalid essay lang');
  return { ...metadata, slug, lang: metadata.lang || 'zh', aiAssisted: metadata.aiAssisted === 'true', body: match[2] };
}

export async function loadEssays(directory) {
  let files;
  try { files = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const markdown = files.filter(file => file.endsWith('.md') && file !== 'README.md').sort();
  const essays = [];
  for (const file of markdown.filter(file => !/\.(?:en|ja)\.md$/.test(file))) essays.push(parseEssay(await readFile(new URL(file, directory), 'utf8'), file));
  if (new Set(essays.map(essay => essay.slug)).size !== essays.length) throw new Error('Duplicate essay slug');
  for (const file of markdown.filter(file => /\.(?:en|ja)\.md$/.test(file))) {
    const locale = file.endsWith('.ja.md') ? 'ja' : 'en';
    const translation = parseEssay(await readFile(new URL(file, directory), 'utf8'), file);
    if (translation.lang !== 'zh' && translation.lang !== locale) throw new Error(`Translation language mismatch: ${file}`);
    translation.lang = locale;
    const host = essays.find(essay => essay.slug === translation.slug);
    if (!host) throw new Error(`Translation without original: ${file}`);
    host.translations = host.translations || {};
    if (host.translations[locale]) throw new Error(`Duplicate essay translation: ${translation.slug} ${locale}`);
    host.translations[locale] = translation;
  }
  return essays.sort((a, b) => b.date.localeCompare(a.date));
}

export function renderEssayList(essays, ui = {}) {
  const eyebrow = ui.eyebrow || 'ESSAYS / BY PUNKCAN';
  const title = ui.title || 'AI 工作论';
  const intro = ui.intro || '关于创作、工具与工作方式的长期笔记。';
  const list = essays.length
    ? `<div class="essay-list">${essays.map(essay => {
      const href = ui.essayHref ? ui.essayHref(essay.slug) : `/essays/${essay.slug}/`;
      const byline = ui.byline || '撰文 / Punkcan';
      return `<article><time datetime="${essay.date}">${essay.date}</time><h2><a href="${href}">${e(essay.title)}</a></h2><p>${e(essay.summary)}</p><span>${byline}</span></article>`;
    }).join('')}</div>`
    : `<section class="essay-empty"><span class="cut-label">${ui.comingSoon || '即将推出'}</span><h2>${ui.emptyTitle || '从工具出发，回到创作。'}</h2><p>${ui.emptyBody || '这里将记录 AI 如何进入创作过程，以及我们如何选择、判断和工作。文章将在作者审校后发布。'}</p></section>`;
  return `<header class="page-intro"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${intro}</p></header>${list}`;
}

export function renderEssay(essay, ui = {}) {
  const href = ui.listHref || '/essays/';
  const back = ui.backLabel || 'AI 工作论 / ESSAYS';
  const notice = ui.untranslatedNotice ? `<p class="untranslated-notice">${e(ui.untranslatedNotice)}</p>` : '';
  const ai = essay.aiAssisted ? `<p class="ai-disclosure">${ui.aiDisclosure || 'AI 辅助整理，作者审校'}</p>` : '';
  return `<article class="essay-page">${notice}<header class="essay-header"><a href="${href}">${back}</a><h1>${e(essay.title)}</h1><p>${e(essay.summary)}</p><div>Punkcan <span>/ ${essay.date}</span></div></header><div class="essay-body">${markdownToHtml(essay.body, { headingOffset: 1 })}</div>${ai}</article>`;
}
