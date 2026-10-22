import { escapeHtml as e, externalLink, markdownToHtml } from './markdown.mjs';
import { getEmbedUrl, getPostNotice } from './posts.mjs';
import { renderAffiliates } from './affiliates.mjs';
import { normalizeThumb, formatDuration } from './thumbs.mjs';
import { promptPath, relatedPrompts } from './media-tabs.mjs';

export function renderPostMedia(entry, record) {
  const thumb = normalizeThumb(record);
  const embedUrl = getEmbedUrl(entry);
  const note = getPostNotice(entry);
  if (entry.postStatus === 'removed') return `<div class="post-unavailable"><p>${e(note)}</p></div>`;
  const duration = formatDuration(thumb?.durationMs);
  const label = (entry.medium || 'video').toUpperCase();
  const visual = `<span class="thumbnail-placeholder"><span class="slate-lines" aria-hidden="true"></span><strong>${e(entry.title)}</strong><small>缩图暂不可用 / ORIGINAL POST</small></span>${thumb ? `<img src="${e(thumb.thumb)}" width="${thumb.width}" height="${thumb.height}" loading="lazy" decoding="async" alt="${e(entry.title)}，@${e(entry.authorHandle || entry.author)} 原帖缩图">` : ''}<span class="media-label">${label}</span>${(entry.medium || 'video') === 'video' && duration ? `<span class="duration">${duration}</span>` : ''}<span class="play-symbol" aria-hidden="true"></span><span class="load-hint">${embedUrl ? '点击载入 X 原帖' : '在 X 上观看'}</span>`;
  const action = embedUrl ? `<button type="button" class="thumbnail-button" data-play-embed aria-label="载入 X 官方嵌入：${e(entry.title)}">${visual}</button>` : externalLink(entry.postUrl, visual, 'thumbnail-button');
  const attribution = externalLink(entry.postUrl, `缩图来自 @${e(entry.authorHandle || entry.author)} 原帖 ↗`);
  if (!embedUrl) return `<figure class="post-media">${action}<p class="sensitive-note">${externalLink(entry.postUrl, e(note))}</p><figcaption>${attribution}</figcaption></figure>`;
  return `<figure class="post-media"><div class="x-embed" data-embed>${action}<div class="tweet-mount" hidden></div><template class="tweet-template"><blockquote class="twitter-tweet" data-dnt="true" data-conversation="none"><a href="${e(embedUrl)}" target="_blank" rel="noopener noreferrer">在 X 上观看</a></blockquote></template>${externalLink(embedUrl, '在 X 上观看 ↗', 'watch-link')}${note ? `<p class="embed-note">${e(note)}</p>` : ''}</div><figcaption>${attribution}</figcaption></figure>`;
}

export function renderPromptText(entry) {
  return `<div class="prompt-box"><div class="prompt-toolbar"><span>${entry.isLong ? '提示词摘录' : '完整提示词'} <small>· ${e(entry.promptLength)} 字</small></span><button class="copy-button" type="button" data-copy-entry="${e(entry.id)}" aria-label="复制：${e(entry.title)}" disabled>复制</button></div><pre class="prompt-text" tabindex="0">${e(entry.isLong ? entry.promptExcerpt : entry.prompt)}</pre>${entry.isLong ? `<p class="excerpt-note">完整提示词约 ${e(entry.promptLength)} 字，请到原帖查看。${externalLink(entry.postUrl, '查看完整提示词 ↗')}</p>` : ''}</div>`;
}

function source(entry) {
  return `<div class="card-source"><span>${externalLink(entry.authorUrl, e(entry.author))}${entry.authorHandle ? `<small>@${e(entry.authorHandle.replace(/^@/, ''))}</small>` : ''}</span>${externalLink(entry.postUrl, entry.postStatus === 'removed' ? '原帖（已失效）' : '原帖 ↗')}</div>`;
}
function tags(entry) { return `<div class="tag-list">${entry.tags.map(tag => `<span>${e(tag)}</span>`).join('')}</div>`; }

export function renderCard(entry, index, affiliates = {}, thumb) {
  return `<article class="prompt-card" data-entry-id="${e(entry.id)}" aria-labelledby="title-${e(entry.id)}"><div class="card-overline"><span class="card-number">${String(index + 1).padStart(2, '0')}</span><small>${(entry.medium || 'video').toUpperCase()}${entry.featured ? ' / 精选' : ''}</small></div>${renderPostMedia(entry, thumb)}<div class="record-info"><p class="model-labels">${e(entry.modelVersion || entry.models.join(' / '))}</p><h2 id="title-${e(entry.id)}"><a href="${promptPath(entry)}">${e(entry.title)}</a></h2><div class="card-meta"><span>${e(entry.method || '')}</span><span>${e(entry.format || '')}</span></div>${tags(entry)}${source(entry)}${renderAffiliates(entry, affiliates)}<a class="entry-read" href="${promptPath(entry)}">阅读提示词与制作笔记 ↗</a></div><div class="record-note"><span class="note-label">收录笔记 / FIELD NOTES</span><p class="card-description">${e(entry.description)}</p><details class="card-prompt"><summary>查看提示词 / 复制</summary>${renderPromptText(entry)}</details></div></article>`;
}

export function renderPromptDetail(entry, entries, affiliates, thumb) {
  const analysis = [['breakdown', '原创拆解'], ['notes', '实测心得']].map(([key, label]) => entry[key]?.trim()
    ? `<section class="original-notes"><h2>${label}</h2><p class="byline">撰文 / Punkcan</p>${markdownToHtml(entry[key], { headingOffset: 2 })}</section>` : '').join('');
  return `<article class="prompt-detail" data-entry-id="${e(entry.id)}"><header class="detail-header"><a href="/prompts/${entry.medium || 'video'}/">提示词库 / ${(entry.medium || 'video').toUpperCase()}</a><p class="eyebrow">${e(entry.modelVersion || entry.models.join(' / '))}</p><h1>${e(entry.title)}</h1>${source(entry)}</header><div class="detail-layout"><div>${renderPostMedia(entry, thumb)}<section class="full-prompt"><h2>${entry.isLong ? '提示词摘录' : '完整提示词'}</h2>${renderPromptText(entry)}</section>${analysis}</div><aside class="detail-sidebar"><span class="cut-label">PRODUCTION NOTES</span><dl>${[['模型', entry.models.join(' / ')], ['版本', entry.modelVersion], ['方法', entry.method], ['画幅与时长', entry.format]].map(([label, value]) => `<dt>${label}</dt><dd>${e(value || '—')}</dd>`).join('')}</dl>${tags(entry)}<p>${e(entry.description)}</p>${renderAffiliates(entry, affiliates)}</aside></div></article><section class="related"><p class="eyebrow">CONTINUE THE REEL</p><h2>相关提示词</h2>${relatedPrompts(entry, entries).map(other => `<a href="${promptPath(other)}"><span>${e(other.modelVersion || other.models.join(' / '))}</span><strong>${e(other.title)}</strong><span aria-hidden="true">↗</span></a>`).join('')}</section>`;
}
