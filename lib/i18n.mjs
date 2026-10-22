import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { escapeHtml } from './markdown.mjs';

const METHODS = {
  en: { '參考圖生影片': 'Image reference to video', '文生影片': 'Text to video', '圖生影片': 'Image to video' },
  ja: { '參考圖生影片': '参照画像から動画', '文生影片': 'テキストから動画', '圖生影片': '画像から動画' },
};

const MODEL_NOTES = {
  en: {
    '作者未註明版本': 'version not stated by the creator',
    '圖：Midjourney': 'image: Midjourney',
    '即夢': 'Dreamina',
    '另搭 MiniMax 02': 'also paired with MiniMax 02',
    '作者後來也用 Wan 2.6 重跑': 'the creator later reran it on Wan 2.6',
  },
  ja: {
    '作者未註明版本': '作者はバージョンを書いていない',
    '圖：Midjourney': '画像：Midjourney',
    '即夢': 'Dreamina',
    '另搭 MiniMax 02': 'あわせて MiniMax 02',
    '作者後來也用 Wan 2.6 重跑': '作者は後から Wan 2.6 でも作り直している',
  },
};

export async function loadI18n(root) {
  const read = file => readFile(join(root, file), 'utf8').then(JSON.parse);
  const [zh, en, ja, contentZh, contentEn, contentJa] = await Promise.all([
    read('data/i18n/zh.json'), read('data/i18n/en.json'), read('data/i18n/ja.json'),
    read('data/i18n/content/zh.json'), read('data/i18n/content/en.json'), read('data/i18n/content/ja.json'),
  ]);
  return { ui: { zh, en, ja }, content: { zh: contentZh, en: contentEn, ja: contentJa } };
}

export function translateMethod(value, locale) {
  if (!value || locale === 'zh') return value || '';
  const mapped = METHODS[locale]?.[value];
  if (!mapped) throw new Error(`Untranslated method: ${value}`);
  return mapped;
}

export function translateFormat(value, locale) {
  if (!value || locale === 'zh') return value || '';
  if (value === '原帖無影片') return locale === 'en' ? 'No video on the original post' : '元投稿に動画なし';
  const match = /^原帖影片約 (\d+) 秒；畫幅 ([^；]+)(?:；原帖附 (\d+) 支影片)?$/.exec(value);
  if (!match) throw new Error(`Untranslated format: ${value}`);
  const [, seconds, ratio, extra] = match;
  if (locale === 'en') return `About ${seconds}s on the original post; frame ${ratio}${extra ? `; ${extra} videos attached` : ''}`;
  return `元投稿は約${seconds}秒、画角 ${ratio}${extra ? `、動画${extra}本つき` : ''}`;
}

export function translateModelVersion(value, locale) {
  if (!value || locale === 'zh') return value || '';
  return value.replace(/ 等/g, locale === 'en' ? ' and others' : 'ほか').replace(/（([^）]+)）/g, (full, inner) => {
    const note = MODEL_NOTES[locale]?.[inner];
    if (!note && /[\u3400-\u9fff]/u.test(inner)) throw new Error(`Untranslated model note: ${inner}`);
    return ` (${note || inner})`;
  });
}

export function translateTag(tag, locale, content) {
  if (locale === 'zh') return tag;
  const mapped = content?.tags?.[tag];
  if (!mapped) throw new Error(`Untranslated tag: ${tag}`);
  return mapped;
}

export function localizeEntry(entry, locale, content) {
  if (locale === 'zh') return entry;
  const copy = content.prompts?.[entry.id];
  if (!copy?.title || !copy?.description) throw new Error(`Missing ${locale} prompt copy: ${entry.id}`);
  return {
    ...entry,
    title: copy.title,
    description: copy.description,
    method: translateMethod(entry.method, locale),
    format: translateFormat(entry.format, locale),
    modelVersion: translateModelVersion(entry.modelVersion, locale),
    displayModels: entry.models.map(model => model.replace('（平台）',locale === 'en' ? ' (platform)' : '（プラットフォーム）')),
  };
}

export function workflowCopy(workflow, locale, content) {
  const copy = content.workflows?.[workflow.id];
  if (!copy?.title || !copy?.fieldNote) throw new Error(`Missing ${locale} workflow copy: ${workflow.id}`);
  const steps = {};
  for (const step of workflow.steps) {
    const role = copy.steps?.[String(step.n)]?.role || copy.steps?.[step.n]?.role;
    if (!role) throw new Error(`Missing ${locale} role: ${workflow.id} step ${step.n}`);
    steps[step.n] = role;
  }
  return {
    title: copy.title,
    fieldNote: copy.fieldNote,
    steps,
    tags: workflow.tags.map(tag => locale === 'zh' ? (content.tags[tag] || tag) : translateTag(tag, locale, content)),
  };
}

export function thumbCredit(entry, template) {
  const handle = entry.authorHandle || entry.author;
  return template.replace('{handle}', escapeHtml(handle));
}

export const formatText = (text, values = {}) => text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));

export function cardUI(locale, ui, content) {
  const href = path => locale === 'zh' ? path : `/${locale}${path}`;
  const f = (key, values) => formatText(ui[key], values);
  return {
    ...ui,
    promptHref: entry => href(`/prompts/${entry.medium || 'video'}/${entry.id}/`),
    mediumHref: medium => href(`/prompts/${medium}/`),
    workflowHref: id => href(`/prompts/workflow/${id}/`),
    workflowIndex: href('/prompts/workflow/'),
    featuredMark: ui.featured,
    charCount: n => f('charCount', {n}), copyAria: title => f('copyAria', {title}),
    thumbAlt: entry => f('thumbAlt', {title:entry.title,handle:entry.authorHandle?.replace(/^@/, '') || entry.author}),
    thumbCredit: entry => f('thumbCredit', {handle:escapeHtml(entry.authorHandle?.replace(/^@/, '') || entry.author)}),
    embedAria: title => f('embedAria', {title}),
    excerptNote: entry => `${escapeHtml(f('excerptNote',{n:entry.promptLength}))}<a href="${escapeHtml(entry.postUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ui.viewFull)}</a>`,
    tagLabel: tag => translateTag(tag,locale,content),
    libraryCrumb: entry => `${ui.navPrompts} / ${(entry.medium || 'video').toUpperCase()}`,
    relateMeta: entry => translateModelVersion(entry.modelVersion,locale),
    relateTitle: entry => locale === 'zh' ? entry.title : content.prompts[entry.id].title,
    notices: {removed:date=>f('removed',{date}),sensitive:ui.sensitive,reply:ui.reply,embed:ui.embed},
    affiliate: {tryLabel:name=>f('tryPlatform',{name}),promoLabel:ui.promoLabel,codeLabel:ui.codeLabel,disclosureHref:href('/affiliate-disclosure/')},
  };
}

// Reject incomplete dictionaries at build time, before replacing dist.
export function validateI18n(data, entries, workflows, regions) {
  const leaves = (value, prefix = '', result = {}) => {
    for (const [key, item] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof item === 'string') result[path] = item;
      else if (item && typeof item === 'object') leaves(item,path,result);
      else throw new Error(`Invalid translation ${path}`);
    }
    return result;
  };
  const baseline = Object.keys(leaves(data.ui.zh)).sort();
  const invalidCopy = /\b(?:TODO|FIXME|TBD|placeholder)\b|佔位|占位/i;
  for (const locale of ['zh','en','ja']) {
    const flat = leaves(data.ui[locale]);
    if (JSON.stringify(Object.keys(flat).sort()) !== JSON.stringify(baseline)) throw new Error(`Mismatched UI keys: ${locale}`);
    for (const [key,value] of Object.entries(flat)) if (!value.trim() || invalidCopy.test(value)) throw new Error(`Empty translation: ${locale}.${key}`);
    const copy = data.content[locale];
    for (const entry of entries) {
      const localized = copy.prompts?.[entry.id];
      for (const key of ['title','description']) if (!localized?.[key]?.trim()) throw new Error(`Missing prompt ${locale}.${entry.id}.${key}`);
    }
    for (const workflow of workflows) workflowCopy(workflow,locale,copy);
    for (const region of regions.entries) for (const key of ['title','summary']) if (!copy.regions?.[region.id]?.[key]?.trim()) throw new Error(`Missing region ${locale}.${region.id}`);
    for (const tag of new Set([...entries.flatMap(x=>x.tags),...workflows.flatMap(x=>x.tags)])) if (!copy.tags?.[tag]?.trim()) throw new Error(`Missing tag ${locale}.${tag}`);
    for (const [key,value] of Object.entries(leaves(copy))) {
      if (!value.trim() || invalidCopy.test(value)) throw new Error(`Invalid content ${locale}.${key}`);
      if (locale !== 'zh' && value === leaves(data.content.zh)[key]) throw new Error(`Untranslated content ${locale}.${key}`);
    }
    if (locale !== 'zh') for (const [key,value] of Object.entries(flat)) if (value === leaves(data.ui.zh)[key]) throw new Error(`Untranslated UI ${locale}.${key}`);
  }
}
