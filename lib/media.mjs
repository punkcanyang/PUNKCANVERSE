export const MEDIA_LABELS = Object.freeze({ video: '视频', image: '图像', music: '音乐' });

export function validateMedia(entries) {
  for (const entry of entries) {
    if (typeof entry.medium !== 'string' || !Object.hasOwn(MEDIA_LABELS, entry.medium)) throw new Error(`${entry.id}: medium must be video, image, or music`);
  }
}

export function availableMedia(entries) {
  return Object.keys(MEDIA_LABELS).filter(medium => entries.some(entry => entry.medium === medium));
}

export function renderMediumFilter(entries) {
  const media = availableMedia(entries);
  if (media.length <= 1) return '';
  return `<fieldset class="medium-filter" disabled><legend>类别</legend><div class="filter-options"><label class="filter-chip"><input type="radio" name="medium" value="" checked><span>全部</span></label>${media.map(medium => `<label class="filter-chip"><input type="radio" name="medium" value="${medium}"><span>${MEDIA_LABELS[medium]}</span></label>`).join('')}</div></fieldset>`;
}
