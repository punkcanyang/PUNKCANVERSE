import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { verifyAnalyticsHtml } from '../lib/analytics.mjs';
import { loadFilms, filmFiles } from '../lib/films.mjs';
import { loadWorks } from '../lib/works.mjs';
import { loadBooks, amazonUrl } from '../lib/books.mjs';
import { loadEssays } from '../lib/essays.mjs';
import { listPages } from '../lib/routes.mjs';
import { SITE_PAGES } from '../lib/site-pages.mjs';
import { SITE_URL } from '../build.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const site = JSON.parse(await readFile(join(root, 'data/site.json'), 'utf8'));
if (site.publishKnowledgeBase) {
  await import('./verify-archive.mjs');
} else {
  const dist = join(root, 'dist');
  const films = await loadFilms(root);
  const works = await loadWorks(root);
  const { books } = await loadBooks(root, films);
  const essays = await loadEssays(new URL('../content/essays/', import.meta.url));
  const notes = await loadEssays(new URL('../content/production-notes/', import.meta.url));
  const pages = listPages({films, works, books, essays, notes, sitePages: SITE_PAGES, publishKnowledgeBase: false});
  const expected = [
    ...pages.map(page => page.file), '404.html', 'sitemap.xml', 'robots.txt', '_headers', 'img/site/share.png',
    ...['portfolio.mjs','opportunity-status.mjs','films.mjs','films.css','site.css','consent.mjs','language.mjs'].map(file => 'assets/'+file),
    ...films.flatMap(film => filmFiles(film).map(file => `img/films/${film.slug}/${file}`)),
    ...books.map(book => `img/books/${book.slug}/cover.webp`),
  ];
  const files = await readdir(dist, {recursive: true, withFileTypes: true});
  const paths = files.filter(file => !file.isDirectory() && file.name !== '.DS_Store').map(file => join(file.parentPath, file.name).slice(dist.length + 1));
  assert.deepEqual(paths.sort(), expected.sort(), 'Public build must contain only portfolio pages and their assets');
  const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8');
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]), pages.filter(page => page.sitemap).map(page => SITE_URL + page.path));
  const hiddenLink = /(?:href|src)="(?:https:\/\/punkcanverse\.com)?\/(?:zh\/)?(?:prompts\/|(?:tips|tools|regions)(?:[/.?#"]|$)|data\.json|catalog\.json)|data-(?:archive-url|prompt-text)=/;
  for (const page of pages) {
    const html = await readFile(join(dist, page.file), 'utf8');
    verifyAnalyticsHtml(html);
    assert.doesNotMatch(html, hiddenLink, page.path);
    assert.ok(html.includes(`rel="canonical" href="${SITE_URL}${page.canonical}"`), page.path);
    if (page.film) assert.ok(html.includes(`data-youtube="${page.film.youtube[page.locale]}"`), page.path);
    // Book pages link to Amazon only for formats on sale.
    if (page.book) assert.deepEqual([...html.matchAll(/href="(https:\/\/www\.amazon\.com\/dp\/[^"]+)"/g)].map(m => m[1]), page.book.formats.filter(f => f.asin).map(f => amazonUrl(f.asin)), page.path);
  }
  console.log(`Verified ${pages.length} portfolio pages, sitemap, films, books, 404 page and public file list.`);
}
