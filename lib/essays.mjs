import { readdir, readFile } from 'node:fs/promises';
import { escapeHtml as e, markdownToHtml } from './markdown.mjs';

export function parseEssay(source, filename) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`Missing essay front matter: ${filename}`);
  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const field = /^(title|date|summary|slug|aiAssisted):\s*(.*?)\s*$/.exec(line);
    if (!field) throw new Error(`Invalid front matter: ${filename}`);
    metadata[field[1]] = field[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  for (const key of ['title', 'date', 'summary']) if (!metadata[key]) throw new Error(`Essay requires ${key}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date) || !Number.isFinite(Date.parse(metadata.date)) || new Date(metadata.date).toISOString().slice(0, 10) !== metadata.date) throw new Error('Invalid essay date');
  const slug = metadata.slug || filename.replace(/\.md$/, '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid essay slug');
  if (metadata.aiAssisted && !['true', 'false'].includes(metadata.aiAssisted)) throw new Error('Invalid aiAssisted flag');
  return { ...metadata, slug, aiAssisted: metadata.aiAssisted === 'true', body: match[2] };
}

export async function loadEssays(directory) {
  let files;
  try { files = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const essays = [];
  for (const file of files.filter(file => file.endsWith('.md') && file !== 'README.md').sort()) essays.push(parseEssay(await readFile(new URL(file, directory), 'utf8'), file));
  if (new Set(essays.map(essay => essay.slug)).size !== essays.length) throw new Error('Duplicate essay slug');
  return essays.sort((a, b) => b.date.localeCompare(a.date));
}

export function renderEssayList(essays) {
  return `<header class="page-intro"><p class="eyebrow">ESSAYS / BY PUNKCAN</p><h1>AI 工作论</h1><p>关于创作、工具与工作方式的长期笔记。</p></header>${essays.length ? `<div class="essay-list">${essays.map(essay => `<article><time datetime="${essay.date}">${essay.date}</time><h2><a href="/essays/${essay.slug}/">${e(essay.title)}</a></h2><p>${e(essay.summary)}</p><span>撰文 / Punkcan</span></article>`).join('')}</div>` : '<section class="essay-empty"><span class="cut-label">即将推出</span><h2>从工具出发，回到创作。</h2><p>这里将记录 AI 如何进入创作过程，以及我们如何选择、判断和工作。文章将在作者审校后发布。</p></section>'}`;
}

export function renderEssay(essay) {
  return `<article class="essay-page"><header class="essay-header"><a href="/essays/">AI 工作论 / ESSAYS</a><h1>${e(essay.title)}</h1><p>${e(essay.summary)}</p><div>Punkcan <span>/ ${essay.date}</span></div></header><div class="essay-body">${markdownToHtml(essay.body, { headingOffset: 1 })}</div>${essay.aiAssisted ? '<p class="ai-disclosure">AI 辅助整理，作者审校</p>' : ''}</article>`;
}
