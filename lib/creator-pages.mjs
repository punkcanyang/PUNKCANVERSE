import { escapeHtml as e, markdownToHtml, safeUrl } from './markdown.mjs';
import { renderPlatform } from './affiliates.mjs';

export const creatorPath = '/creators/';
export const notesPath = '/creators/production-notes/';
// Editorial revisions to the directory text. The work notes list also changes when a note is added.
const directoryRevised = '2026-11-16';
export const creatorCopy = {
  zh: {
    hub: '創作筆記', notes: '工作筆記', cpp: '創作者合作計畫（CPP）', comps: '比賽與徵件',
    hubTitle: '創作筆記｜AI 影片工作筆記、創作者合作計畫與徵件',
    hubIntro: 'Punkcan Vision 的 AI 影片製作紀錄，以及各家平台的創作者合作計畫、影展比賽和公開徵件。',
    notesTitle: '工作筆記｜AI 影片製作成本與平台評比',
    notesIntro: '比較 AI 影片平台怎麼扣點、哪些鏡頭設定會加價，以及 Punkcan Vision 製作時查到的報價和實扣紀錄。',
    byline: '整理', assisted: 'AI 協助編輯', related: '延伸閱讀',
    cppIntro: '持續更新。查看各平台的申請條件、合作義務與入選回饋。',
    compsIntro: '持續更新。查看影展與比賽的截止時間、報名費和獎項。',
    index: '依平台名稱查閱', contents: '文章目錄', table: '成本比較表', trail: '頁面位置',
  },
  en: {
    hub: 'Creative Notes', notes: 'Work Notes', cpp: 'Creator Partner Programs (CPP)', comps: 'Competitions & Open Calls',
    hubTitle: 'Creative Notes | AI filmmaking, creator programs and open calls',
    hubIntro: 'Production notes from Punkcan Vision, creator partner programs, film competitions and open calls for AI filmmakers.',
    notesTitle: 'Work Notes | AI video production costs and platform reviews',
    notesIntro: 'Punkcan Vision’s production notes on AI video platforms, shot settings and the difference between a price quote and the charge for a finished take.',
    byline: 'Compiled by', assisted: 'AI-assisted editing', related: 'Related reading',
    cppIntro: 'Updated regularly. Explore application requirements, commitments and partner benefits.',
    compsIntro: 'Updated regularly. Check festival and contest deadlines, entry fees and awards.',
    index: 'Find a platform by name', contents: 'Contents', table: 'Cost comparison table', trail: 'Breadcrumb',
  },
};

export function creatorLevels(locale, route, noteTitle) {
  const c = creatorCopy[locale];
  const levels = [[creatorPath, c.hub]];
  if (route === '/cpp/') return [...levels, [route, c.cpp]];
  if (route === '/competitions/') return [...levels, [route, c.comps]];
  if (route !== creatorPath) levels.push([notesPath, c.notes]);
  if (noteTitle) levels.push([route, noteTitle]);
  return levels;
}

export function creatorTrail(locale, href, levels) {
  const links = levels.map(([path, name], index) => index < levels.length - 1
    ? `<a href="${href(path)}">${e(name)}</a>`
    : `<span aria-current="page">${e(name)}</span>`);
  return `<nav class="creator-trail" aria-label="${creatorCopy[locale].trail}">${links.join('<span aria-hidden="true"> / </span>')}</nav>`;
}

export function renderCreatorPage({ route, locale, href, notes, note, affiliates, affiliateUI, trail }) {
  const c = creatorCopy[locale];
  const local = item => item.lang === locale ? item : item.translations?.[locale];
  if (note) {
    const { title, summary, body } = local(note);
    const relatedNote = notes.find(item => item.slug === note.relatedNote);
    const relatedCopy = relatedNote && local(relatedNote);
    const related = relatedCopy
      ? `<aside class="note-related"><span>${c.related}</span><a href="${href(notesPath + relatedNote.slug + '/')}">${e(relatedCopy.title)}</a></aside>`
      : '';
    const credit = note.editorialCredit ? ` · ${c.byline} ${e(note.editorialCredit)}` : '';
    const editing = local(note).aiAssisted ? ` · ${c.assisted}` : '';
    const sections = [];
    const platforms = [];
    const article = body.split(/^\{\{affiliate:(\w+)\}\}$/gm).map((part, index) => {
      if (index % 2 === 0) return markdownToHtml(part, { tableLabel: c.table });
      const platform = affiliates[part];
      const url = platform && safeUrl(platform.url);
      return url ? renderPlatform(platform, url, affiliateUI) : '';
    }).join('').replace(/<h2>([^<]+)<\/h2>/g, (_, label) => {
      const id = 'section-' + (sections.length + 1);
      sections.push(`<a href="${href(route)}#${id}">${label}</a>`);
      return `<h2 id="${id}">${label}</h2>`;
    });
    const indexedArticle = article.replace(/<h3>([^<]+)<\/h3>([\s\S]*?)(?=<h[23]\b|$)/g, (_, heading, review) => {
      // Reviews carry their published fragment so adding a platform keeps shared links intact.
      const anchor = heading.match(/ \{#(platform-\d+)\}$/);
      const id = anchor ? anchor[1] : 'platform-' + (platforms.length + 1);
      const label = anchor ? heading.slice(0, anchor.index) : heading;
      const [name, use] = note.slug === 'ai-platform-reviews' ? label.split(' — ') : [label];
      platforms.push({ name, id });
      if (!use) return `<h3 id="${id}">${name}</h3>${review}`;
      // A fragment inside the disclosure lets the browser reveal a linked review.
      return `<details class="platform-review"><summary><h3>${name}<span>${use}</span></h3></summary><div id="${id}">${review}</div></details>`;
    });
    const index = platforms.length > 5 ? `<details class="note-index"><summary>${c.index}</summary><div>${platforms.sort((a, b) => a.name.localeCompare(b.name, locale)).map(({ name, id }) =>
      `<a href="${href(route)}#${id}">${name}</a>`
    ).join('')}</div></details>` : '';
    const contents = sections.length > 3 ? `<nav class="note-contents" aria-label="${c.contents}"><strong>${c.contents}</strong>${sections.join('')}${index}</nav>` : '';
    return { title, description: summary, lastModified: local(note).date, body: `<article class="production-note">${trail}<header><time datetime="${note.date}">${note.date}</time>${credit}${editing}<h1>${e(title)}</h1><p>${e(summary)}</p></header><div class="note-body">${contents}${indexedArticle}</div>${related}</article>` };
  }
  const hub = route === creatorPath;
  const title = hub ? c.hub : c.notes;
  const description = hub ? c.hubIntro : c.notesIntro;
  const rows = hub
    ? [[notesPath, c.notes, c.notesIntro], ['/cpp/', c.cpp, c.cppIntro], ['/competitions/', c.comps, c.compsIntro]]
    : notes.filter(local).map(item => [notesPath + item.slug + '/', local(item).title, local(item).summary, item.date]);
  const list = rows.map(([path, label, summary, date]) => `<li><a href="${href(path)}">${date ? `<time datetime="${date}">${date}</time>` : ''}<strong>${e(label)}</strong><span>${e(summary)}</span><i aria-hidden="true">→</i></a></li>`).join('');
  const lastModified = hub ? directoryRevised : [directoryRevised, ...notes.map(local).filter(Boolean).map(item => item.date)].sort().at(-1);
  return { title: hub ? c.hubTitle : c.notesTitle, description, lastModified, body: `<section class="creator-list">${trail}<h1>${e(title)}</h1><p class="creator-intro">${e(description)}</p><ul>${list}</ul></section>` };
}
