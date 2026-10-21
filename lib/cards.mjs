import { escapeHtml as e, externalLink } from './markdown.mjs';
import { getEmbedUrl, getPostNotice } from './posts.mjs';

function renderMedia(entry) {
  const embedUrl = getEmbedUrl(entry);
  const note = getPostNotice(entry);
  if (!embedUrl) return `<div class="post-unavailable"><p>${e(note)}</p></div>`;
  return `<div class="x-embed" data-embed><div class="embed-label"><span class="live-dot" aria-hidden="true"></span> 成片 · X 官方嵌入</div><div class="tweet-mount"></div><template class="tweet-template"><blockquote class="twitter-tweet" data-dnt="true" data-conversation="none"><a href="${e(embedUrl)}" target="_blank" rel="noopener noreferrer">在 X 上观看</a></blockquote></template>${externalLink(embedUrl, '在 X 上观看 ↗', 'watch-link')}${note ? `<p class="embed-note">${e(note)}</p>` : ''}</div>`;
}

export function renderCard(entry, index) {
  const prompt = entry.isLong ? entry.promptExcerpt : entry.prompt;
  return `<article class="prompt-card" data-entry-id="${e(entry.id)}" aria-labelledby="title-${e(entry.id)}">
  <div class="card-overline"><span class="card-number">${String(index + 1).padStart(2, '0')} /</span><span>${entry.featured ? '精选案例' : '动作档案'}</span><time datetime="${e(entry.date)}">${e(entry.date)}</time></div>
  <div class="model-labels">${entry.models.map(model => `<span>${e(model)}</span>`).join('')}</div>
  <h2 id="title-${e(entry.id)}">${e(entry.title)}</h2>
  <p class="card-description">${e(entry.description)}</p>
  <div class="card-meta"><span class="version">${e(entry.modelVersion || entry.models.join(' / '))}</span>${entry.method ? `<span>${e(entry.method)}</span>` : ''}${entry.format ? `<span>${e(entry.format)}</span>` : ''}</div>
  <div class="tag-list">${entry.tags.map(tag => `<span># ${e(tag)}</span>`).join('')}</div>
  <div class="prompt-box"><div class="prompt-toolbar"><span>${entry.isLong ? '提示词摘录' : '完整提示词'} <small>· ${e(entry.promptLength)} 字</small></span><button class="copy-button" type="button" data-copy-entry="${e(entry.id)}" aria-label="复制：${e(entry.title)}" disabled>复制</button></div><pre class="prompt-text" tabindex="0">${e(prompt)}</pre>${entry.isLong ? `<p class="excerpt-note">完整提示词约 ${e(entry.promptLength)} 字，请到原帖查看。${externalLink(entry.postUrl, '查看完整提示词 ↗')}</p>` : ''}</div>
  <div class="card-source"><span>${externalLink(entry.authorUrl, e(entry.author))}${entry.authorHandle ? `<small>@${e(entry.authorHandle.replace(/^@/, ''))}</small>` : ''}</span>${externalLink(entry.postUrl, entry.postStatus === 'removed' ? '原帖（已失效）' : '原帖 ↗')}</div>
  ${renderMedia(entry)}
</article>`;
}

