import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadFilms, validateFilm, renderFilmsHome, renderFilmPage, filmPath, mmss } from '../lib/films.mjs';
import { embedUrl, frameAt } from '../web/films.mjs';
import { loadI18n } from '../lib/i18n.mjs';
import { publicPath } from '../lib/routes.mjs';
import { escapeHtml } from '../lib/markdown.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const films = await loadFilms(root);
const i18n = await loadI18n(root);

test('films: the two published films load with their generated frames', () => {
  assert.deepEqual(films.map(f => f.slug), ['wind-of-cijin', 'hongmaogang']);
  for (const film of films) {
    assert.equal(film.data.slug, film.slug);
    assert.ok(film.data.frames.length >= 4);
    assert.ok(film.poster >= 1 && film.poster <= film.data.frames.length);
  }
  assert.equal(mmss(265.045), '04:25');
  assert.equal(mmss(184), '03:04');
});

test('films: invalid records are rejected before the build', () => {
  const [film] = films;
  for (const change of [
    f => f.slug = 'Bad Slug', f => f.youtube.en = 'not-an-id', f => delete f.title.zh,
    f => f.notes.zh = [], f => f.credits.en = [['Directed by']], f => f.poster = 999,
    f => f.data.slug = 'other', f => f.data.frames[0].src = '../escape.webp',
  ]) {
    const copy = structuredClone(film); change(copy);
    assert.throws(() => validateFilm(copy, copy.data));
  }
});

test('films: home lists every film with a bar sized by running time and localized links', () => {
  for (const locale of ['en', 'zh']) {
    const href = route => publicPath(locale, route);
    const html = renderFilmsHome(films, locale, i18n.ui[locale].films, href);
    assert.equal((html.match(/<li class="film[ "]/g) || []).length, films.length);
    for (const film of films) assert.ok(html.includes(`href="${href(filmPath(film))}"`));
    assert.ok(html.includes('--w:100.000%'), 'longest film fills the row');
    // The archive is only a forwarding target for old shared filter links, never a visible link.
    assert.doesNotMatch(html, /href="[^"]*\/prompts\/|affiliate|<script/);
    assert.ok(html.includes(`data-archive-url="${href('/prompts/video/')}"`));
  }
});

test('films: film page plays the locale’s YouTube upload and keeps the director’s note verbatim', () => {
  const [film] = films;
  for (const locale of ['en', 'zh']) {
    const html = renderFilmPage(film, films, locale, i18n.ui[locale].films, route => publicPath(locale, route));
    assert.ok(html.includes(`data-youtube="${film.youtube[locale]}"`));
    assert.ok(html.includes(`href="https://www.youtube.com/watch?v=${film.youtube[locale]}"`));
    assert.doesNotMatch(html, /<iframe/, 'no third-party frame until the visitor presses play');
    for (const paragraph of film.notes[locale]) assert.ok(html.includes(`<p>${escapeHtml(paragraph)}</p>`));
    assert.ok(html.includes('lang="zh-Hant-TW"'));
  }
});

test('films: player URL and scrub frames', () => {
  assert.equal(embedUrl('UnGmCoPDIn8', 0), 'https://www.youtube-nocookie.com/embed/UnGmCoPDIn8?autoplay=1&rel=0');
  assert.equal(embedUrl('UnGmCoPDIn8', 140.4), 'https://www.youtube-nocookie.com/embed/UnGmCoPDIn8?autoplay=1&rel=0&start=140');
  const frames = ['a', 'b', 'c', 'd'];
  assert.equal(frameAt(frames, 0), 'a');
  assert.equal(frameAt(frames, 0.5), 'c');
  assert.equal(frameAt(frames, 1), 'd');
  assert.equal(frameAt(frames, -1), 'a');
});
