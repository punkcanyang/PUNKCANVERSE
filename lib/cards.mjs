import { escapeHtml as e, externalLink, markdownToHtml } from './markdown.mjs';
import { getEmbedUrl, getPostNotice } from './posts.mjs';
import { renderAffiliates } from './affiliates.mjs';
import { normalizeThumb, formatDuration } from './thumbs.mjs';
import { promptPath, relatedPrompts } from './media-tabs.mjs';

export function renderPostMedia(entry, record, ui) {
  if(entry.source==='official') return `<figure class="post-media"><div class="official-preview" role="img" aria-label="${e(ui?.officialPlaceholder || 'OFFICIAL EXAMPLE / Wan 3.0')}"><span class="media-label">VIDEO</span><span class="slate-lines" aria-hidden="true"></span><strong>OFFICIAL EXAMPLE</strong><p>${e(entry.modelVersion)}</p><small>${e(ui?.officialNoVideo || '官方文字範例，未提供 X 成片')}</small></div></figure>`;
  const thumb = normalizeThumb(record);
  const embedUrl = getEmbedUrl(entry);
  const note = getPostNotice(entry, ui?.notices);
  if (entry.postStatus === 'removed') return `<div class="post-unavailable"><p>${e(note)}</p></div>`;
  const duration = formatDuration(thumb?.durationMs);
  const label = (entry.medium || 'video').toUpperCase();
  const unavailable = ui?.thumbUnavailable || '缩图暂不可用 / ORIGINAL POST';
  const alt = ui?.thumbAlt ? ui.thumbAlt(entry) : `${entry.title}，@${entry.authorHandle || entry.author} 原帖缩图`;
  const loadHint = embedUrl ? (ui?.loadEmbed || '点击载入 X 原帖') : (ui?.watchOnX || '在 X 上观看');
  const watch = ui?.watchOnX || '在 X 上观看';
  const watchArrow = ui?.watchArrow || '在 X 上观看 ↗';
  const aria = ui?.embedAria ? ui.embedAria(entry.title) : `载入 X 官方嵌入：${entry.title}`;
  const credit = ui?.thumbCredit ? ui.thumbCredit(entry) : `缩图来自 @${e(entry.authorHandle || entry.author)} 原帖 ↗`;
  const visual = `<span class="thumbnail-placeholder"><span class="slate-lines" aria-hidden="true"></span><strong>${e(entry.title)}</strong><small>${e(unavailable)}</small></span>${thumb ? `<img src="${e(thumb.thumb)}" width="${thumb.width}" height="${thumb.height}" loading="lazy" decoding="async" alt="${e(alt)}">` : ''}<span class="media-label">${label}</span>${(entry.medium || 'video') === 'video' && duration ? `<span class="duration">${duration}</span>` : ''}<span class="play-symbol" aria-hidden="true"></span><span class="load-hint">${e(loadHint)}</span>`;
  const action = embedUrl ? `<button type="button" class="thumbnail-button" data-play-embed aria-label="${e(aria)}">${visual}</button>` : externalLink(entry.postUrl, visual, 'thumbnail-button');
  const attribution = externalLink(entry.postUrl, credit);
  if (!embedUrl) return `<figure class="post-media">${action}<p class="sensitive-note">${externalLink(entry.postUrl, e(note))}</p><figcaption>${attribution}</figcaption></figure>`;
  return `<figure class="post-media"><div class="x-embed" data-embed>${action}<div class="tweet-mount" hidden></div><template class="tweet-template"><blockquote class="twitter-tweet" data-dnt="true" data-conversation="none"><a href="${e(embedUrl)}" target="_blank" rel="noopener noreferrer">${e(watch)}</a></blockquote></template>${externalLink(embedUrl, watchArrow, 'watch-link')}${note ? `<p class="embed-note">${e(note)}</p>` : ''}</div><figcaption>${attribution}</figcaption></figure>`;
}

// Restored long text uses text-node escaping (&, <, >); quotes are literal text
// inside pre. Existing short-prompt markup retains its original representation.
export function promptHtml(entry) {
  const escaped=e(entry.prompt);
  return entry.isLong ? escaped.replace(/&quot;/g,'"').replace(/&#39;/g,"'") : escaped;
}

export function renderPromptText(entry, ui) {
  if (!ui) return `<div class="prompt-box"><p class="original-prompt-label">原文提示词</p><div class="prompt-toolbar"><span>完整提示词 <small>· ${e(entry.promptLength)} 字</small></span><button class="copy-button" type="button" data-copy-entry="${e(entry.id)}" aria-label="复制：${e(entry.title)}" disabled>复制</button></div><pre class="prompt-text" tabindex="0">${promptHtml(entry)}</pre>${entry.isLong ? `<p class="prompt-source">${externalLink(entry.postUrl, '查看完整提示词 ↗')}</p>` : ''}</div>`;
  const kind = ui.fullPrompt;
  const count = ui.charCount(entry.promptLength);
  const note = entry.isLong ? `<p class="prompt-source">${externalLink(entry.officialUrl || entry.postUrl, e(entry.source==='official'?ui.officialLink:ui.viewFull))}</p>` : '';
  return `<div class="prompt-box"><p class="original-prompt-label">${e(ui.originalPrompt)}</p><div class="prompt-toolbar"><span>${e(kind)} <small>· ${e(count)}</small></span><button class="copy-button" type="button" data-copy-entry="${e(entry.id)}" aria-label="${e(ui.copyAria(entry.title))}" disabled>${e(ui.copy)}</button></div><pre class="prompt-text" tabindex="0">${promptHtml(entry)}</pre>${note}</div>`;
}

function source(entry, ui) {
  if(entry.source==='official')return `<div class="card-source official-source"><span>${externalLink(entry.officialUrl,e(ui?.officialAuthor || '阿里雲官方範例'))}</span>${externalLink(entry.officialUrl,e(ui?.officialLink || '官方原文 ↗'))}</div>`;
  const removed = ui?.postRemoved || '原帖（已失效）';
  const live = ui?.postLink || '原帖 ↗';
  return `<div class="card-source"><span>${externalLink(entry.authorUrl, e(entry.author))}${entry.authorHandle ? `<small>@${e(entry.authorHandle.replace(/^@/, ''))}</small>` : ''}</span>${externalLink(entry.postUrl, entry.postStatus === 'removed' ? removed : live)}</div>`;
}
function tags(entry, ui) {
  const label = tag => ui?.tagLabel ? ui.tagLabel(tag) : tag;
  return `<div class="tag-list">${entry.tags.map(tag => `<span>${e(label(tag))}</span>`).join('')}</div>`;
}

export function renderCard(entry, index, affiliates = {}, thumb, ui) {
  const href = ui?.promptHref ? ui.promptHref(entry) : promptPath(entry);
  const featured = entry.featured ? (entry.collection==='wan-minimax' ? (ui?.importFeaturedMark || ' / 精選') : (ui?.featuredMark || ' / 精选')) : '';
  const read = ui?.readPrompt || '阅读提示词与制作笔记 ↗';
  const notes = ui?.fieldNotes || '收录笔记 / FIELD NOTES';
  const summary = ui?.viewPrompt || '查看提示词 / 复制';
  return `<article class="prompt-card" data-entry-id="${e(entry.id)}" aria-labelledby="title-${e(entry.id)}"><div class="card-overline"><span class="card-number">${String(index + 1).padStart(2, '0')}</span><small>${(entry.medium || 'video').toUpperCase()}${featured}</small></div>${renderPostMedia(entry, thumb, ui)}<div class="record-info"><p class="model-labels">${e(entry.modelVersion || (entry.displayModels || entry.models).join(' / '))}</p><h2 id="title-${e(entry.id)}"><a href="${href}">${e(entry.title)}</a></h2><div class="card-meta"><span>${e(entry.method || '')}</span><span>${e(entry.format || '')}</span></div>${tags(entry, ui)}${source(entry, ui)}${renderAffiliates(entry, affiliates, ui?.affiliate)}<a class="entry-read" href="${href}">${e(read)}</a></div><div class="record-note"><span class="note-label">${e(notes)}</span><p class="card-description">${e(entry.description)}</p><details class="card-prompt"><summary>${e(summary)}</summary>${renderPromptText(entry, ui)}</details></div></article>`;
}

export function renderPromptDetail(entry, entries, affiliates, thumb, ui) {
  const href = medium => ui?.mediumHref ? ui.mediumHref(medium) : `/prompts/${medium}/`;
  const promptHref = other => ui?.promptHref ? ui.promptHref(other) : promptPath(other);
  const labels = ui ? [[ 'breakdown', ui.breakdown ], [ 'notes', ui.testNotes ]] : [['breakdown', '原创拆解'], ['notes', '实测心得']];
  const byline = ui?.byline || '撰文 / Punkcan';
  const analysis = labels.map(([key, label]) => entry[key]?.trim()
    ? `<section class="original-notes"><h2>${e(label)}</h2><p class="byline">${e(byline)}</p>${markdownToHtml(entry[key], { headingOffset: 2 })}</section>` : '').join('');
  const facts = ui ? [[ui.modelLabel, (entry.displayModels || entry.models).join(' / ')], [ui.versionLabel, entry.modelVersion], [ui.methodLabel, entry.method], [ui.formatLabel, entry.format]] : [['模型', entry.models.join(' / ')], ['版本', entry.modelVersion], ['方法', entry.method], ['画幅与时长', entry.format]];
  const crumb = ui?.libraryCrumb ? ui.libraryCrumb(entry) : `提示词库 / ${(entry.medium || 'video').toUpperCase()}`;
  const heading = ui?.fullPrompt || '完整提示词';
  const relatedTitle = ui?.relatedPrompts || '相关提示词';
  return `<article class="prompt-detail" data-entry-id="${e(entry.id)}"><header class="detail-header"><a href="${href(entry.medium || 'video')}">${e(crumb)}</a><p class="eyebrow">${e(entry.modelVersion || (entry.displayModels || entry.models).join(' / '))}</p><h1>${e(entry.title)}</h1>${source(entry, ui)}${entry.collection==='wan-minimax'&&entry.featured?`<span class="featured-badge">${e(ui?.importFeaturedMark || '精選')}</span>`:''}</header><div class="detail-layout"><div>${renderPostMedia(entry, thumb, ui)}<section class="full-prompt"><h2>${e(heading)}</h2>${renderPromptText(entry, ui)}</section>${analysis}</div><aside class="detail-sidebar"><span class="cut-label">PRODUCTION NOTES</span><dl>${facts.map(([label, value]) => `<dt>${e(label)}</dt><dd>${e(value || '—')}</dd>`).join('')}</dl>${tags(entry, ui)}<p>${e(entry.description)}</p>${renderAffiliates(entry, affiliates, ui?.affiliate)}</aside></div></article><section class="related"><p class="eyebrow">CONTINUE THE REEL</p><h2>${e(relatedTitle)}</h2>${relatedPrompts(entry, entries).map(other => `<a href="${promptHref(other)}"><span>${e(ui?.relateMeta ? ui.relateMeta(other) : (other.modelVersion || other.models.join(' / ')))}</span><strong>${e(ui?.relateTitle ? ui.relateTitle(other) : other.title)}</strong><span aria-hidden="true">↗</span></a>`).join('')}</section>`;
}
