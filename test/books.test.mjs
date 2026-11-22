import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBooks, validateBook, validateSeries, renderBooksIndex, renderBookPage, bookPath, amazonUrl } from '../lib/books.mjs';
import { loadFilms } from '../lib/films.mjs';
import { loadI18n } from '../lib/i18n.mjs';
import { publicPath } from '../lib/routes.mjs';
import { buildSite } from '../build.mjs';
import { escapeHtml } from '../lib/markdown.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const films = await loadFilms(root);
const data = await loadBooks(root, films);
const i18n = await loadI18n(root);
const SERIES = ['when-ghosts-become-guardians', 'asking-the-gods', 'taiwanese-taboos', 'mo-sin-a', 'gods-on-the-sea-routes'];
const render = (book, locale) => renderBookPage(book, data, locale, i18n.ui[locale].books, route => publicPath(locale, route), films);

test('books: only the five Taiwanese Popular Religion books are listed', () => {
  assert.deepEqual(data.books.map(book => book.slug), SERIES);
  assert.doesNotMatch(JSON.stringify(data.books.map(({ bibliography, ...book }) => book)), /tarot|adler|three\.?js|phenomenolog|fable/i);
});

test('books: only formats on sale link to Amazon; the rest say coming soon', () => {
  for (const book of data.books) {
    for (const locale of ['en', 'zh']) {
      const html = render(book, locale);
      const ui = i18n.ui[locale].books;
      for (const format of book.formats) {
        if (format.status === 'live' && format.asin) assert.ok(html.includes(`href="${amazonUrl(format.asin)}"`), `${book.slug} ${format.format}`);
        else if (format.status === 'live') assert.ok(html.includes(`<mark class="pending">${ui.linkPending}</mark>`), `${book.slug} ${format.format}`);
        else assert.ok(html.includes(`${ui[format.format]} <span>${ui.comingSoon}</span>`), `${book.slug} ${format.format}`);
      }
      assert.equal((html.match(/amazon\.com\/dp\//g) || []).length, book.formats.filter(f => f.asin).length);
    }
  }
  const unpublished = data.books.filter(book => book.formats.every(format => format.status === 'soon'));
  assert.deepEqual(unpublished.map(book => book.slug), ['mo-sin-a', 'gods-on-the-sea-routes']);
});

test('books: every page shows how it was made, the sources, errata and what is still unverified', () => {
  for (const book of data.books) {
    for (const locale of ['en', 'zh']) {
      const html = render(book, locale);
      const ui = i18n.ui[locale].books;
      for (const id of ['intro', 'made', 'sources', 'errata', 'gaps']) assert.match(html, new RegExp(`<section id="${id}">`), `${book.slug} ${id}`);
      // The errata section stays even when empty, so readers can see it is kept.
      if (!book.errata.length) assert.ok(html.includes(ui.errataNone.replace('{date}', book.errataChecked)));
      assert.equal((html.match(/<ul class="fixes">/g) || []).length, 1);
      for (const fix of book.fixes) assert.ok(html.includes(`<li>${escapeHtml(fix[locale])}</li>`), `${book.slug} fix`);
      for (const gap of book.gaps) assert.ok(html.includes(`<li>${escapeHtml(gap[locale])}</li>`), `${book.slug} gap`);
      // The drafting tools are not named until Punkcan settles them: an obvious placeholder, never a guess.
      assert.ok(html.includes(`<mark class="pending">${data.series.draftTools[locale]}</mark>`), `${book.slug} tools placeholder`);
      assert.doesNotMatch(html, /<script|<iframe/);
    }
  }
});

test('books: bibliographies come from the manuscripts and their web addresses are links', () => {
  for (const book of data.books) assert.ok(book.bibliography.length > 2000, book.slug);
  const html = render(data.books.find(book => book.slug === 'taiwanese-taboos'), 'en');
  assert.match(html, /<a href="https:\/\/www\.cna\.com\.tw\/news\/ahel\/202608270304\.aspx" target="_blank" rel="noopener noreferrer">/);
  const ghosts = render(data.books[0], 'en');
  // A full stop after a bare address stays outside the link.
  assert.ok(ghosts.includes('href="https://www.twcenter.org.tw/wp-content/uploads/2018/01/g02_22_02_02.pdf"'));
});

test('books: the harbor book and the harbor film link to each other', () => {
  const book = data.books.find(item => item.slug === 'gods-on-the-sea-routes');
  assert.equal(book.film, 'wind-of-cijin');
  assert.ok(render(book, 'zh').includes('href="/zh/films/wind-of-cijin/"'));
});

test('books: index lists the series with covers, links and the author', () => {
  for (const locale of ['en', 'zh']) {
    const href = route => publicPath(locale, route);
    const html = renderBooksIndex(data, locale, i18n.ui[locale].books, href);
    for (const book of data.books) assert.ok(html.includes(`href="${href(bookPath(book))}"`));
    assert.equal((html.match(/<img /g) || []).length, data.books.length);
    for (const p of data.series.author[locale]) assert.ok(html.includes(`<p>${escapeHtml(p)}</p>`));
  }
});

test('books: invalid records are rejected before the build', () => {
  const [book] = data.books;
  for (const change of [
    b => b.slug = 'Bad Slug', b => b.formats[0] = { format: 'ebook', status: 'live' },
    b => b.formats[1] = { format: 'paperback', status: 'soon', asin: 'B0HRVW4976' },
    b => b.formats.reverse(), b => b.fixes = [], b => b.gaps = [], b => delete b.errataChecked,
    b => b.errata = [{ zh: '錯', en: 'wrong' }], b => b.film = 'no-such-film', b => delete b.made.zh,
    b => b.credits.en = [['Research']],
  ]) {
    const copy = structuredClone(book); change(copy);
    assert.throws(() => validateBook(copy, films));
  }
  assert.throws(() => validateSeries({ ...data.series, draftTools: { zh: '', en: '' } }));
});

test('books: built site has the book pages in both languages, in the nav and the sitemap', async () => {
  const out = await mkdtemp(join(tmpdir(), 'pcv-books-'));
  try {
    await buildSite({ out, publishKnowledgeBase: false });
    const read = file => readFile(join(out, file), 'utf8');
    for (const prefix of ['', 'zh/']) {
      const index = await read(`${prefix}books/index.html`);
      assert.match(index, /<a href="\/(?:zh\/)?books\/" aria-current="page">/);
      for (const slug of SERIES) {
        const html = await read(`${prefix}books/${slug}/index.html`);
        assert.match(html, /<meta property="og:type" content="book">/);
        assert.match(html, /<a href="\/(?:zh\/)?books\/" aria-current="location">/);
        assert.equal((html.match(/<h1\b/g) || []).length, 1);
        await read(`img/books/${slug}/cover.webp`);
      }
    }
    const home = await read('index.html');
    assert.ok(home.includes('<a href="/books/">Books</a>'));
    const film = await read('zh/films/wind-of-cijin/index.html');
    assert.ok(film.includes('href="/zh/books/gods-on-the-sea-routes/"'));
    const sitemap = await read('sitemap.xml');
    for (const slug of SERIES) for (const path of [`/books/${slug}/`, `/zh/books/${slug}/`]) assert.ok(sitemap.includes(`https://punkcanverse.com${path}<`), path);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
