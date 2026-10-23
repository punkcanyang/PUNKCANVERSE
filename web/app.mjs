import { parseFilters, filterEntries, sortEntries, clearFilters, filtersToSearch } from './prompts.mjs';
import { copyText } from './clipboard.mjs';
import { bindClickEmbeds } from './embeds.mjs';
import { initConsent } from './consent.mjs';
import { initLanguage, workflowCopyText } from './language.mjs';

initLanguage();
const messages = JSON.parse(document.body.dataset.messages || '{}');
const message = (key, values={}) => (messages[key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
initConsent();
bindClickEmbeds({errorText:message('embedFailed')});

const toast = document.querySelector('#toast');
let toastTimer;
function showToast(text) {
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.add('is-visible');
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.textContent = '';
  }, 4000);
}

// Copy the exact source already present in the page. No catalog request is needed.
for (const button of document.querySelectorAll('[data-copy-entry]')) button.disabled = false;
const copyTimers = new WeakMap();
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-copy-entry], [data-copy-code], [data-copy-block]');
  if (!button || button.disabled) return;
  const text = button.hasAttribute('data-copy-block')
    ? workflowCopyText(button.closest('[data-copy-scope]'))
    : button.hasAttribute('data-copy-code')
    ? button.closest('.code-frame').querySelector('pre code').textContent
    : button.closest('.prompt-box')?.querySelector('pre')?.textContent;
  if (typeof text !== 'string') return;
  clearTimeout(copyTimers.get(button));
  const label = button.dataset.copyLabel ||= button.textContent;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    const success = await copyText(text);
    button.textContent = message(success ? 'copyDone' : 'copyRetry');
    showToast(message(success ? 'toastCopied' : 'toastFailed'));
    copyTimers.set(button, setTimeout(() => { button.textContent = label; }, 4000));
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
});

for (const pre of document.querySelectorAll('.full-prompt .prompt-text, .workflow-step .prompt-text')) {
  if (pre.textContent.length < 1000) continue;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'expand-prompt';
  pre.id ||= `prompt-text-${document.querySelectorAll('.expand-prompt').length}`;
  button.setAttribute('aria-controls', pre.id);
  button.setAttribute('aria-expanded', 'false');
  button.textContent = message('expandPrompt');
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    pre.classList.toggle('is-expanded', expanded);
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = message(expanded ? 'collapsePrompt' : 'expandPrompt');
  });
  pre.after(button);
}

// Tables stay semantic and become focusable, named scroll regions on small screens.
for (const table of document.querySelectorAll('.table-scroll')) {
  table.tabIndex = 0;
  table.setAttribute('role', 'region');
  table.setAttribute('aria-label', message('scrollTable'));
  const hint = document.createElement('p');
  hint.className = 'table-scroll-hint'; hint.textContent = message('scrollTable');
  table.before(hint);
}

// Keep complete tool content readable without JavaScript; enhance the summaries
// into compact cards and move (never duplicate) their content into a native dialog.
function initializeToolCards() {
  const grid = document.querySelector('.tools-grid');
  if (!grid || typeof HTMLDialogElement === 'undefined') return;
  const dialog = document.createElement('dialog');
  dialog.className = 'tool-dialog';
  dialog.setAttribute('aria-labelledby', 'tool-dialog-title');
  const header = document.createElement('header');
  header.className = 'tool-dialog-header';
  const title = document.createElement('h2');
  title.id = 'tool-dialog-title';
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'tool-dialog-close';
  close.textContent = grid.dataset.closeLabel;
  const content = document.createElement('div');
  content.className = 'tool-dialog-content';
  const intro = document.createElement('p');
  intro.className = 'tool-dialog-intro'; content.append(intro);
  header.append(title, close); dialog.append(header, content); document.body.append(dialog);
  let activeCard;
  function restore() {
    if (!activeCard) return;
    const card = activeCard; activeCard = null;
    const body = content.querySelector('.tool-body');
    body.hidden = true; card.append(body);
    document.documentElement.classList.remove('tool-modal-open');
    card.querySelector('[data-tool-open]').focus({preventScroll:true});
  }
  function open(card) {
    if (activeCard === card && dialog.open) return;
    if (activeCard) { dialog.close(); restore(); }
    activeCard = card;
    title.textContent = card.querySelector('h2').textContent;
    intro.textContent = card.querySelector('[data-fact="summary"]').textContent;
    const body = card.querySelector('.tool-body');
    body.hidden = false; content.append(body);
    dialog.showModal(); dialog.scrollTop = 0;
    document.documentElement.classList.add('tool-modal-open');
    close.focus({preventScroll:true});
  }
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (!dialog.open) restore(); });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  for (const card of grid.querySelectorAll('.tool-card')) {
    const button = card.querySelector('[data-tool-open]');
    button.hidden = false; button.setAttribute('aria-haspopup', 'dialog');
    card.querySelector('.tool-body').hidden = true;
    button.addEventListener('click', () => open(card));
  }
  grid.classList.add('is-enhanced');
  function openHash() {
    const card = [...grid.children].find(card => `#${card.id}` === location.hash);
    if (card) open(card);
  }
  document.querySelector('.tools-jump')?.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (link.hash === location.hash) openHash();
  });
  window.addEventListener('hashchange', openHash);
  openHash();
}
initializeToolCards();

function initializeLibrary() {
  const form = document.querySelector('#filters');
  if (!form) return;
  const grid = document.querySelector('#prompt-grid');
  const cards = [...grid.querySelectorAll('[data-filter-entry]')];
  const byId = new Map(cards.map(card => [card.dataset.entryId, card]));
  const entries = cards.map(card => ({ ...JSON.parse(card.dataset.filterEntry), id:card.dataset.entryId, searchText:card.textContent }));
  const defaultMedium = form.dataset.defaultMedium || '';
  const search = document.querySelector('#prompt-search');
  const sort = document.querySelector('#prompt-sort');
  const chips = document.querySelector('#active-filters');
  const inputs = [...form.querySelectorAll('input[type="checkbox"], input[type="radio"]')];
  const pageSize = 12;
  let displayed = pageSize, filters = parseFilters(location.search), searchTimer;
  const known = {
    models: new Set(inputs.filter(input => input.name === 'model').map(input => input.value)),
    tags: new Set(inputs.filter(input => input.name === 'tag').map(input => input.value)),
    media: new Set(entries.map(entry => entry.medium)),
  };
  const labels = new Map(inputs.map(input => [`${input.name}:${input.value}`, input.nextElementSibling?.textContent || input.value]));
  function render(syncSearch = true) {
    const matches = sortEntries(filterEntries(entries, { ...filters, medium:filters.medium || defaultMedium }), filters.sort);
    for (const card of cards) card.hidden = true;
    // Move existing nodes; expanded text and loaded embeds survive sorting.
    for (const [index, entry] of matches.entries()) {
      const card = byId.get(entry.id); card.hidden = index >= displayed; grid.append(card);
    }
    const more = document.querySelector('#show-more');
    more.hidden = matches.length <= displayed;
    more.textContent = message('moreCount', {n:Math.max(0, matches.length-displayed)});
    for (const input of inputs) input.checked = input.name === 'medium'
      ? (filters.medium || '') === input.value
      : filters[input.name === 'model' ? 'models' : 'tags'].includes(input.value);
    if (syncSearch) search.value = filters.q || ''; sort.value = filters.sort || '';
    document.querySelector('#result-count').textContent = message('count', {n:matches.length});
    document.querySelector('#empty-state').hidden = matches.length > 0;
    document.querySelector('#clear-filters').disabled = !filters.models.length && !filters.tags.length && !filters.medium && !filters.q && !filters.sort;
    chips.replaceChildren();
    const selected = [...filters.models.map(value => ['model',value]), ...filters.tags.map(value => ['tag',value]), ...(filters.q ? [['q',filters.q]] : []), ...(filters.medium ? [['medium',filters.medium]] : [])];
    for (const [kind,value] of selected) {
      const button = document.createElement('button'); button.type = 'button';
      const label = labels.get(`${kind}:${value}`) || value;
      button.textContent = `${label} ×`; button.setAttribute('aria-label', message('removeFilter',{value:label}));
      button.addEventListener('click', () => {
        const next = {...filters};
        if (kind === 'model' || kind === 'tag') { const key=kind==='model'?'models':'tags'; next[key]=filters[key].filter(item=>item!==value); }
        else delete next[kind];
        update(next); search.focus({preventScroll:true});
      });
      chips.append(button);
    }
    chips.hidden = selected.length === 0;
    const unknown = [...filters.models.filter(value=>!known.models.has(value)), ...filters.tags.filter(value=>!known.tags.has(value)), ...(filters.medium && !known.media.has(filters.medium)?[filters.medium]:[])];
    const notice=document.querySelector('#unknown-filters'); notice.hidden=unknown.length===0;
    notice.textContent=unknown.length?message('unknownFilters',{items:unknown.join(', ')}):'';
  }
  function update(next, replace=false) {
    clearTimeout(searchTimer); displayed=pageSize; filters=next;
    const query=filtersToSearch(filters,location.search);
    if(query!==location.search) history[replace?'replaceState':'pushState'](null,'',`${location.pathname}${query}${location.hash}`);
    render(!replace);
  }
  form.addEventListener('submit', event=>{event.preventDefault();update({...filters,q:search.value.trim(),sort:sort.value});});
  search.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>update({...filters,q:search.value.trim()},true),180);});
  sort.addEventListener('change',()=>update({...filters,q:search.value.trim(),sort:sort.value}));
  form.addEventListener('change',event=>{
    if (!inputs.includes(event.target)) return;
    update({...filters,q:search.value.trim(),
      models:[...filters.models.filter(value=>!known.models.has(value)),...inputs.filter(input=>input.name==='model'&&input.checked).map(input=>input.value)],
      tags:[...filters.tags.filter(value=>!known.tags.has(value)),...inputs.filter(input=>input.name==='tag'&&input.checked).map(input=>input.value)],
      ...(inputs.some(input=>input.name==='medium'&&input.checked)?{medium:inputs.find(input=>input.name==='medium'&&input.checked).value}:{})});
  });
  document.addEventListener('click', event=>{
    const link=event.target.closest('[data-filter-tag]'); if(!link)return;
    event.preventDefault();update({...filters,tags:[...new Set([...filters.tags,link.dataset.filterTag])]});
    search.focus();
  });
  for(const button of document.querySelectorAll('#clear-filters, [data-clear-filters]')) button.addEventListener('click',()=>{update(clearFilters());search.focus({preventScroll:true});});
  window.addEventListener('popstate',()=>{clearTimeout(searchTimer);displayed=pageSize;filters=parseFilters(location.search);render();});
  document.querySelector('#show-more').addEventListener('click',()=>{
    const previous=displayed;displayed+=pageSize;render();
    const visible=[...grid.children].filter(card=>!card.hidden);
    visible[previous]?.querySelector('h2 a')?.focus({preventScroll:true});
  });
  for(const fieldset of form.querySelectorAll('fieldset')) fieldset.disabled=false;
  search.disabled=false;sort.disabled=false;
  document.querySelector('#search-submit').disabled=false;
  render();
}

// Preserve previously shared homepage filter URLs after moving the full archive.
const homeArchive = document.querySelector('[data-archive-url]');
const shared = parseFilters(location.search);
if (homeArchive && (shared.models.length || shared.tags.length || shared.medium || shared.q || shared.sort)) {
  location.replace(`${homeArchive.dataset.archiveUrl}${location.search}#library`);
}

try { initializeLibrary(); } catch {
  // On enhancement failure, every source card stays accessible.
  for(const card of document.querySelectorAll('[data-filter-entry]'))card.hidden=false;
  const notice=document.createElement('p');notice.className='notice';notice.textContent=message('filterFailed');
  document.querySelector('.filter-panel')?.before(notice);
}
