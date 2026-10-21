import { parseFilters, filterEntries, clearFilters, filtersToSearch, getCopyText } from './prompts.mjs';
import { copyText } from './clipboard.mjs';
import { createEmbeds } from './embeds.mjs';

const toast = document.querySelector('#toast');
let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.textContent = '';
  }, 1500);
}

let entryById = new Map();
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-copy-entry], [data-copy-code]');
  if (!button || button.disabled) return;
  const entry = entryById.get(button.dataset.copyEntry);
  const text = button.hasAttribute('data-copy-code')
    ? button.closest('.code-frame').querySelector('pre code').textContent
    : entry ? getCopyText(entry) : null;
  if (text === null) return;
  button.disabled = true;
  try {
    const success = await copyText(text);
    showToast(success ? '已复制' : '复制失败，请手动选取');
  } finally {
    button.disabled = false;
  }
});


async function initializeLibrary() {
  const form = document.querySelector('#filters');
  if (!form) return;
  const cards = [...document.querySelectorAll('[data-entry-id]')];
  const { entries } = await fetch(new URL('../data.json', import.meta.url)).then(response => {
    if (!response.ok) throw new Error('Data unavailable');
    return response.json();
  });
  entryById = new Map(entries.map(entry => [String(entry.id), entry]));
  const embeds = createEmbeds();
  let filters = parseFilters(location.search);
  const inputs = [...form.querySelectorAll('input')];
  const known = {
    models: new Set(inputs.filter(input => input.name === 'model').map(input => input.value)),
    tags: new Set(inputs.filter(input => input.name === 'tag').map(input => input.value)),
    media: new Set(entries.map(entry => entry.medium)),
  };
  function render() {
    const matches = filterEntries(entries, filters);
    const ids = new Set(matches.map(entry => String(entry.id)));
    for (const card of cards) card.hidden = !ids.has(card.dataset.entryId);
    for (const input of inputs) input.checked = input.name === 'medium'
      ? (filters.medium || '') === input.value
      : filters[input.name === 'model' ? 'models' : 'tags'].includes(input.value);
    document.querySelector('#result-count').textContent = `共 ${matches.length} 条`;
    document.querySelector('#empty-state').hidden = matches.length > 0;
    document.querySelector('#clear-filters').disabled = !filters.models.length && !filters.tags.length && !filters.medium;
    const unknown = [...filters.models.filter(value => !known.models.has(value)), ...filters.tags.filter(value => !known.tags.has(value)), ...(filters.medium && !known.media.has(filters.medium) ? [filters.medium] : [])];
    const notice = document.querySelector('#unknown-filters');
    notice.hidden = unknown.length === 0;
    notice.textContent = unknown.length ? `链接中包含未收录的筛选项：${unknown.join('、')}。可清除筛选重新浏览。` : '';
    embeds.update(cards);
  }
  function update(next) {
    filters = next;
    const query = filtersToSearch(filters, location.search);
    if (query !== location.search) history.pushState(null, '', `${location.pathname}${query}${location.hash}`);
    render();
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', () => {
    const mediumInput = inputs.find(input => input.name === 'medium' && input.checked);
    const medium = mediumInput ? mediumInput.value : filters.medium;
    // Retain unknown shared URL values until the user explicitly clears them.
    update({
      models: [...filters.models.filter(value => !known.models.has(value)), ...inputs.filter(input => input.name === 'model' && input.checked).map(input => input.value)],
      tags: [...filters.tags.filter(value => !known.tags.has(value)), ...inputs.filter(input => input.name === 'tag' && input.checked).map(input => input.value)],
      ...(medium ? { medium } : {}),
    });
  });
  for (const button of document.querySelectorAll('#clear-filters, [data-clear-filters]')) button.addEventListener('click', () => update(clearFilters()));
  window.addEventListener('popstate', () => { filters = parseFilters(location.search); render(); });
  for (const fieldset of form.querySelectorAll('fieldset')) fieldset.disabled = false;
  for (const button of document.querySelectorAll('[data-copy-entry]')) button.disabled = false;
  if (window.matchMedia('(max-width: 600px)').matches && !filters.models.length && !filters.tags.length && !filters.medium) document.querySelector('.filter-panel').open = false;
  render();
}

initializeLibrary().catch(() => {
  // Server-rendered cards and permanent original-post links remain available.
  const notice = document.createElement('p');
  notice.className = 'notice';
  notice.textContent = '筛选数据加载失败，请刷新重试。你仍可阅读全部提示词、手动选取文字或打开原帖。';
  document.querySelector('.filter-panel')?.before(notice);
});
