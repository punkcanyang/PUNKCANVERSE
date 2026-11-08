import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { escapeHtml as e } from './markdown.mjs';

const LOCALES = ['zh', 'en'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const FRAME = /^\d{2}\.(?:webp|jpg)$/;

const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Film needs ${label}`);
};

// Films are Punkcan's own work. Each one has a generated frame folder
// (scripts/film-frames.mjs) at web/img/films/<slug>/ and plays from YouTube.
export function validateFilm(film, data) {
  if (!SLUG.test(film.slug || '')) throw new Error(`Invalid film slug: ${film.slug}`);
  if (!Number.isInteger(film.year)) throw new Error(`${film.slug}: year must be an integer`);
  for (const locale of LOCALES) {
    text(film.title?.[locale], `${locale} title`);
    text(film.kind?.[locale], `${locale} kind`);
    if (film.subtitle) text(film.subtitle[locale], `${locale} subtitle`);
    if (!YOUTUBE_ID.test(film.youtube?.[locale] || '')) throw new Error(`${film.slug}: invalid ${locale} YouTube id`);
    if (!Array.isArray(film.notes?.[locale]) || !film.notes[locale].length) throw new Error(`${film.slug}: ${locale} notes required`);
    film.notes[locale].forEach((p, i) => text(p, `${locale} note ${i + 1}`));
    if (!Array.isArray(film.credits?.[locale]) || !film.credits[locale].length) throw new Error(`${film.slug}: ${locale} credits required`);
    for (const row of film.credits[locale]) {
      if (!Array.isArray(row) || row.length !== 2) throw new Error(`${film.slug}: credits are [role, name] pairs`);
      row.forEach(cell => text(cell, `${locale} credit`));
    }
  }
  if (!(data?.duration > 0) || !Array.isArray(data.frames) || !data.frames.length) throw new Error(`${film.slug}: missing film.json frames`);
  if (data.slug !== film.slug || data.barcode?.src !== 'barcode.png') throw new Error(`${film.slug}: film.json does not match`);
  for (const frame of data.frames) if (!FRAME.test(frame.src) || !(frame.t >= 0 && frame.t <= data.duration)) throw new Error(`${film.slug}: invalid frame ${frame.src}`);
  if (!Number.isInteger(film.poster) || film.poster < 1 || film.poster > data.frames.length) throw new Error(`${film.slug}: poster must be a frame number`);
}

export async function loadFilms(root, file = 'content/films.json') {
  const { entries } = JSON.parse(await readFile(join(root, file), 'utf8'));
  if (!Array.isArray(entries)) throw new Error('Films require an entries array');
  const films = [];
  for (const film of entries) {
    const data = JSON.parse(await readFile(join(root, 'web/img/films', film.slug, 'film.json'), 'utf8'));
    validateFilm(film, data);
    films.push({ ...film, data });
  }
  if (new Set(films.map(f => f.slug)).size !== films.length) throw new Error('Duplicate film slug');
  return films;
}

export const filmAsset = (film, file) => `/img/films/${film.slug}/${file}`;
export const filmPath = film => `/films/${film.slug}/`;
export const filmFiles = film => ['film.json', film.data.barcode.src, ...film.data.frames.map(frame => frame.src)];
export function mmss(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
const posterFrame = film => film.data.frames[film.poster - 1];
const frameList = film => JSON.stringify(film.data.frames.map(frame => filmAsset(film, frame.src)));
const zhSpan = (value, cls = 'zh') => `<span class="${cls}" lang="zh-Hant-TW">${e(value)}</span>`;
// The lockup always shows both titles, Chinese first, as on Taiwanese film posters.
const lockup = (film, locale) => `${zhSpan(film.title.zh)}<span class="en" lang="en">${e(film.title.en)}</span>`;

// data-archive-url keeps old shared filter links (/?model=…) forwarding to the archive; it is not a visible link.
export function renderFilmsHome(films, locale, ui, href) {
  const first = films[0];
  const longest = Math.max(...films.map(f => f.data.duration));
  const rows = films.map((film, k) => `<li class="film${k === 0 ? ' on' : ''}" data-film="${e(film.slug)}" data-duration="${film.data.duration}" data-frames="${e(frameList(film))}" data-poster="${film.poster}" data-zh="${e(film.title.zh)}" data-en="${e(film.title.en)}"><a class="bar" href="${href(filmPath(film))}" style="--w:${(film.data.duration / longest * 100).toFixed(3)}%;--img:url(${filmAsset(film, film.data.barcode.src)});--k:${k}" aria-label="${e(film.title[locale])}, ${mmss(film.data.duration)}"><i></i><span class="ph"></span></a><a class="t" href="${href(filmPath(film))}">${lockup(film, locale)}</a><span class="y">${film.year}</span><span class="d">${mmss(film.data.duration)}</span></li>`).join('');
  return `<h1 class="visually-hidden">${e(ui.homeTitle)}</h1><section class="reel" data-archive-url="${href('/prompts/video/')}"><div class="stage"><figure class="proj"><img id="proj" src="${filmAsset(first, posterFrame(first).src)}" width="${first.data.width}" height="${first.data.height}" alt="${e(ui.stillOf.replace('{title}', first.title[locale]))}" decoding="async"></figure><div class="slate"><div class="lock" id="lock">${lockup(first, locale)}</div><div class="tc" id="tc"><b>${mmss(posterFrame(first).t)}</b> / ${mmss(first.data.duration)}</div></div></div><ol class="films" aria-label="${e(ui.listAria)}">${rows}</ol><p class="legend">${e(ui.legend)}</p></section>`;
}

export function renderFilmPage(film, films, locale, ui, href) {
  const poster = posterFrame(film);
  const youtube = film.youtube[locale];
  const title = `<h1 class="big">${zhSpan(film.title.zh)}${film.subtitle ? zhSpan(film.subtitle.zh, 'zh2') : ''}<span class="en" lang="en">${e(film.subtitle ? `${film.title.en}: ${film.subtitle.en}` : film.title.en)}</span></h1>`;
  const credits = film.credits[locale].map(([role, name]) => `<dt>${e(role)}</dt><dd>${e(name)}</dd>`).join('')
    + `<dt>${e(ui.length)}</dt><dd>${mmss(film.data.duration)}</dd><dt>${e(ui.year)}</dt><dd>${film.year}</dd>`;
  const others = films.filter(other => other !== film).map(other => `<a href="${href(filmPath(other))}">${lockup(other, locale)}<span class="d">${mmss(other.data.duration)}</span></a>`).join('');
  return `<article class="film-page" data-film="${e(film.slug)}"><a class="back" href="${href('/')}">← ${e(ui.allFilms)}</a>${title}<p class="kind">${locale==='zh'?`${film.year}，${mmss(film.data.duration)}。`:`${film.year}, ${mmss(film.data.duration)}. `}${e(film.kind[locale])}</p>
<figure class="player" data-youtube="${e(youtube)}" data-title="${e(film.title[locale])}"><img src="${filmAsset(film, poster.src)}" width="${film.data.width}" height="${film.data.height}" alt="${e(ui.stillOf.replace('{title}', film.title[locale]))}" decoding="async"><a class="play" href="https://www.youtube.com/watch?v=${e(youtube)}" target="_blank" rel="noopener noreferrer" data-play data-label="${e(ui.play)}" data-label-from="${e(ui.playFrom)}">${e(ui.play)}</a></figure>
<div class="scrub" data-duration="${film.data.duration}" data-frames="${e(frameList(film))}" style="--img:url(${filmAsset(film, film.data.barcode.src)})" role="slider" tabindex="0" aria-label="${e(ui.scrubAria)}" aria-valuemin="0" aria-valuemax="${Math.floor(film.data.duration)}" aria-valuenow="0" aria-valuetext="00:00" data-start-label="${e(ui.startAt)}"><i></i><span class="ph"></span></div>
<p class="scrub-tip"><span data-tip>${e(ui.scrubHint)}</span><span>${mmss(film.data.duration)}</span></p>
<div class="film-body"><dl class="credits" aria-label="${e(ui.credits)}">${credits}</dl><div class="note"><h2>${e(ui.note)}</h2>${film.notes[locale].map(p => `<p>${e(p)}</p>`).join('')}</div></div>
${others ? `<nav class="film-next" aria-label="${e(ui.more)}"><h2>${e(ui.more)}</h2>${others}</nav>` : ''}</article>`;
}
