// embedId is an ID, never an arbitrary URL: keep embeds on the original author.
export function getEmbedUrl(entry) {
  if (['removed', 'sensitive'].includes(entry.postStatus)) return null;
  return entry.embedId && !entry.replyNoVideo
    ? entry.postUrl.replace(/\/status\/\d+$/, `/status/${entry.embedId}`)
    : entry.postUrl;
}

export function getPostNotice(entry, phrases) {
  if (entry.postStatus === 'removed') return phrases?.removed?.(entry.postCheckedAt) ?? `原帖已删除或不可用（${entry.postCheckedAt} 检查），无法显示成片`;
  if (entry.postStatus === 'sensitive') return phrases?.sensitive ?? '原帖含敏感内容，请到 X 观看';
  if (entry.replyNoVideo) return phrases?.reply ?? '此帖为回复，影片见原串';
  if (entry.embedId) return phrases?.embed ?? '影片取自同作者的串首帖';
  return '';
}

export function validatePostMetadata(entry) {
  const invalid = field => { throw new Error(`${entry.id}: invalid ${field}`); };
  if (Object.hasOwn(entry, 'postStatus') && !['removed', 'sensitive'].includes(entry.postStatus)) invalid('postStatus');
  if (Object.hasOwn(entry, 'postCheckedAt')) {
    const date = entry.postCheckedAt;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) invalid('postCheckedAt');
  }
  if (entry.postStatus === 'removed' && !Object.hasOwn(entry, 'postCheckedAt')) invalid('postCheckedAt');
  if (Object.hasOwn(entry, 'embedId') && (typeof entry.embedId !== 'string' || !/^[1-9]\d*$/.test(entry.embedId))) invalid('embedId');
  if (Object.hasOwn(entry, 'replyNoVideo') && entry.replyNoVideo !== true) invalid('replyNoVideo');
  if (entry.replyNoVideo && Object.hasOwn(entry, 'embedId')) invalid('embedId with replyNoVideo');
}
