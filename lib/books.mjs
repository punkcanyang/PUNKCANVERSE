import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { escapeHtml as e, externalLink, markdownToHtml } from './markdown.mjs';

// The Taiwanese Popular Religion series. Only these books belong here: the site
// introduces the series next to the films, not the author's whole shelf.
const LOCALES = ['zh', 'en'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ASIN = /^B0[A-Z0-9]{8}$/;
const DATE = /^\d{4}-\d\d-\d\d$/;
const FORMATS = ['ebook', 'paperback'];

const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Book needs ${label}`);
};
const paragraphs = (value, label) => {
  for (const locale of LOCALES) {
    if (!Array.isArray(value?.[locale]) || !value[locale].length) throw new Error(`${label}: ${locale} paragraphs required`);
    value[locale].forEach((p, i) => text(p, `${label} ${locale} ${i + 1}`));
  }
};
const both = (value, label) => LOCALES.forEach(locale => text(value?.[locale], `${locale} ${label}`));

export function validateSeries(series) {
  both(series?.title, 'series title');
  paragraphs(series?.intro, 'series intro');
  paragraphs(series?.made, 'series made');
  paragraphs(series?.author, 'author');
}

export function validateBook(book, films = []) {
  const slug = book?.slug;
  if (!SLUG.test(slug || '')) throw new Error(`Invalid book slug: ${slug}`);
  if (!Number.isInteger(book.year)) throw new Error(`${slug}: year must be an integer`);
  if (book.pages !== undefined && !(Number.isInteger(book.pages) && book.pages > 0)) throw new Error(`${slug}: pages must be a positive integer`);
  both(book.title, 'title');
  both(book.subtitle, 'subtitle');
  text(book.zhTitle, `${slug} zhTitle`);
  if (!Array.isArray(book.formats) || book.formats.length !== FORMATS.length) throw new Error(`${slug}: list the ebook and the paperback`);
  book.formats.forEach((format, i) => {
    if (format.format !== FORMATS[i]) throw new Error(`${slug}: formats are ebook then paperback`);
    if (!['live', 'soon'].includes(format.status)) throw new Error(`${slug}: ${format.format} status is live or soon`);
    // Only formats on sale get a store link; the rest say "coming soon".
    // A format on sale whose ASIN was never recorded says so instead of guessing a link.
    if (format.status === 'live' && !(ASIN.test(format.asin || '') || (format.asin === undefined && format.asinPending === true))) throw new Error(`${slug}: live ${format.format} needs an Amazon ASIN`);
    if (format.status === 'soon' && (format.asin !== undefined || format.asinPending)) throw new Error(`${slug}: ${format.format} is not on sale; leave out the ASIN`);
  });
  paragraphs(book.intro, `${slug} intro`);
  paragraphs(book.made, `${slug} made`);
  for (const locale of LOCALES) {
    if (!Array.isArray(book.credits?.[locale]) || !book.credits[locale].length) throw new Error(`${slug}: ${locale} credits required`);
    for (const row of book.credits[locale]) {
      if (!Array.isArray(row) || row.length !== 2) throw new Error(`${slug}: credits are [role, who] pairs`);
      row.forEach(cell => text(cell, `${slug} ${locale} credit`));
    }
  }
  if (!Array.isArray(book.fixes) || !book.fixes.length) throw new Error(`${slug}: name at least one error that was corrected`);
  book.fixes.forEach((fix, i) => both(fix, `${slug} fix ${i + 1}`));
  if (!Array.isArray(book.gaps) || !book.gaps.length) throw new Error(`${slug}: list what is still unverified`);
  book.gaps.forEach((gap, i) => both(gap, `${slug} gap ${i + 1}`));
  // Errata stay on the page even when empty, with the date they were last checked.
  if (!DATE.test(book.errataChecked || '')) throw new Error(`${slug}: errataChecked must be a YYYY-MM-DD date`);
  if (!Array.isArray(book.errata)) throw new Error(`${slug}: errata must be a list`);
  for (const item of book.errata) {
    if (!DATE.test(item.date || '')) throw new Error(`${slug}: each erratum needs a date`);
    both(item, `${slug} erratum`);
  }
  // A build with no films (an archive-only test build) simply drops the link.
  if (book.film !== undefined && films.length && !films.some(film => film.slug === book.film)) throw new Error(`${slug}: unknown film ${book.film}`);
}

const exists = path => access(path).then(() => true, () => false);

export async function loadBooks(root, films = [], file = 'content/books.json') {
  const data = JSON.parse(await readFile(join(root, file), 'utf8'));
  validateSeries(data.series);
  if (!Array.isArray(data.entries) || !data.entries.length) throw new Error('Books require an entries array');
  const books = [];
  for (const book of data.entries) {
    validateBook(book, films);
    if (!await exists(join(root, 'web/img/books', book.slug, 'cover.webp'))) throw new Error(`${book.slug}: missing web/img/books/${book.slug}/cover.webp`);
    const bibliography = await readFile(join(root, 'content/books', book.slug, 'bibliography.md'), 'utf8').catch(() => '');
    if (!bibliography.trim()) throw new Error(`${book.slug}: missing content/books/${book.slug}/bibliography.md`);
    books.push({ ...book, bibliography });
  }
  if (new Set(books.map(book => book.slug)).size !== books.length) throw new Error('Duplicate book slug');
  return { series: data.series, books };
}

export const booksPath = '/books/';
export const bookPath = book => `${booksPath}${book.slug}/`;
export const bookCover = book => `/img/books/${book.slug}/cover.webp`;
export const COVER = { width: 640, height: 1024 };
// The KDP author name, the same on every cover and listing.
export const AUTHOR = 'Punkcan Yang';
export const amazonUrl = asin => `https://www.amazon.com/dp/${asin}`;
const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
const zhText = value => `<span lang="zh-Hant-TW">${e(value)}</span>`;
// The site is in two languages, but the books are English editions: the English title leads.
const bookTitle = book => `${e(book.title.en)}`;
// Bibliographies are copied from the manuscripts, where many web addresses are bare text.
const linkUrls = markdown => markdown.replace(/(^|[\s(])(https?:\/\/[^\s<>()]+?)([.,;:]?)(?=\s|\)|$)/gm, (_, before, url, after) => `${before}<${url}>${after}`);

function availability(book, ui) {
  const live = book.formats.filter(format => format.status === 'live').map(format => ui[format.format]);
  const soon = book.formats.filter(format => format.status === 'soon').map(format => ui[format.format]);
  if (!live.length) return ui.comingSoon;
  return live.join(ui.and) + (soon.length ? `${ui.sep}${fill(ui.soonFormat, { format: soon.join(ui.and) })}` : '');
}

export function renderBooksIndex({ series, books }, locale, ui, href) {
  const items = books.map(book => `<li><a href="${href(bookPath(book))}"><img src="${bookCover(book)}" width="${COVER.width}" height="${COVER.height}" alt="${e(fill(ui.coverOf, { title: book.title.en }))}" loading="lazy" decoding="async"><span class="bt">${bookTitle(book)}</span><span class="bz">${zhText(book.zhTitle)}</span><span class="bs">${e(availability(book, ui))}</span></a></li>`).join('');
  return `<article class="books-index"><header class="books-head">${locale === 'en' ? '' : `<p class="series-name" lang="en">${e(series.title.en)}</p>`}<h1>${e(series.title[locale])}</h1>${series.intro[locale].map(p => `<p>${e(p)}</p>`).join('')}</header>
<ol class="book-shelf" aria-label="${e(ui.listAria)}">${items}</ol>
<section class="book-text" id="made"><h2>${e(ui.made)}</h2>${series.made[locale].map(p => `<p>${e(p)}</p>`).join('')}</section>
<section class="book-text" id="author"><h2>${e(ui.author)}</h2>${series.author[locale].map(p => `<p>${e(p)}</p>`).join('')}</section>
<p class="film-contact"><a href="${href('/contact/')}">${e(ui.report)}</a></p></article>`;
}

export function renderBookPage(book, { series, books }, locale, ui, href, films = []) {
  const meta = [book.year, book.pages ? fill(ui.pages, { n: book.pages }) : null, AUTHOR].filter(Boolean).join(ui.metaSep);
  const buy = book.formats.map(format => `<li>${format.status === 'live'
    ? format.asin ? externalLink(amazonUrl(format.asin), `${e(ui[format.format])} <span>${e(ui.onAmazon)}</span>`) : `${e(ui[format.format])} <span>${e(ui.onAmazon)}</span> <mark class="pending">${e(ui.linkPending)}</mark>`
    : `${e(ui[format.format])} <span>${e(ui.comingSoon)}</span>`}</li>`).join('');
  const credits = book.credits[locale].map(([role, who]) => `<dt>${e(role)}</dt><dd>${e(who)}</dd>`).join('');
  const film = book.film && films.find(item => item.slug === book.film);
  const errata = book.errata.length
    ? `<ol class="errata">${book.errata.map(item => `<li><time datetime="${item.date}">${item.date}</time> ${e(item[locale])}</li>`).join('')}</ol><p class="checked">${e(fill(ui.errataChecked, { date: book.errataChecked }))}</p>`
    : `<p>${e(fill(ui.errataNone, { date: book.errataChecked }))}</p>`;
  const sections = [['intro', ui.intro], ['made', ui.made], ['sources', ui.bibliography], ['errata', ui.errata], ['gaps', ui.gaps]];
  const others = books.filter(other => other !== book).map(other => `<a href="${href(bookPath(other))}"><span class="en">${bookTitle(other)}</span>${zhText(other.zhTitle)}</a>`).join('');
  return `<article class="book-page" data-book="${e(book.slug)}"><a class="back" href="${href(booksPath)}">← ${e(series.title[locale])}</a>
<header class="book-head"><figure class="book-cover"><img src="${bookCover(book)}" width="${COVER.width}" height="${COVER.height}" alt="${e(fill(ui.coverOf, { title: book.title.en }))}" decoding="async"></figure><div><p class="series-name">${e(series.title.en)}</p><h1 class="book-title"><span class="en" lang="en">${bookTitle(book)}</span><span class="sub" lang="en">${e(book.subtitle.en)}</span></h1><p class="book-zh">${e(ui.zhTitle)} ${zhText(book.zhTitle)}</p><p class="kind">${e(meta)}</p><ul class="buy" aria-label="${e(ui.formats)}">${buy}</ul></div></header>
<nav class="book-toc" aria-label="${e(ui.contents)}">${sections.map(([id, label]) => `<a href="#${id}">${e(label)}</a>`).join('')}</nav>
<div class="book-text">
<section id="intro"><h2>${e(ui.intro)}</h2>${book.intro[locale].map(p => `<p>${e(p)}</p>`).join('')}${film ? `<p class="book-film">${e(ui.film)} <a href="${href(`/films/${film.slug}/`)}">${zhText(film.title.zh)} <span lang="en">${e(film.title.en)}</span></a></p>` : ''}</section>
<section id="made"><h2>${e(ui.made)}</h2><dl class="credits">${credits}</dl>${book.made[locale].map(p => `<p>${e(p)}</p>`).join('')}<h3>${e(ui.fixes)}</h3><ul class="fixes">${book.fixes.map(fix => `<li>${e(fix[locale])}</li>`).join('')}</ul></section>
<section id="sources"><h2>${e(ui.bibliography)}</h2><p class="checked">${e(ui.bibliographyNote)}</p><div class="bibliography" lang="en">${markdownToHtml(linkUrls(book.bibliography))}</div></section>
<section id="errata"><h2>${e(ui.errata)}</h2>${errata}<p><a href="${href('/contact/')}">${e(ui.report)}</a></p></section>
<section id="gaps"><h2>${e(ui.gaps)}</h2><p>${e(ui.gapsIntro)}</p><ul class="gaps">${book.gaps.map(gap => `<li>${e(gap[locale])}</li>`).join('')}</ul></section>
</div>
<nav class="film-next" aria-label="${e(ui.more)}"><h2>${e(ui.more)}</h2>${others}</nav></article>`;
}
