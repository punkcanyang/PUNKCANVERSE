// Shared by the browser, build, tests, and verification. No DOM dependencies.
export function parseFilters(search = '') {
  const params = new URLSearchParams(search);
  return {
    models: [...new Set(params.getAll('model').filter(Boolean))],
    tags: [...new Set(params.getAll('tag').filter(Boolean))],
    ...(params.get('medium') ? { medium: params.get('medium') } : {}),
    ...(params.get('q')?.trim() ? { q: params.get('q').trim() } : {}),
    ...(['featured', 'latest'].includes(params.get('sort')) ? { sort: params.get('sort') } : {}),
  };
}

export function clearFilters() {
  return { models: [], tags: [] };
}

export function filterEntries(entries, { models = [], tags = [], medium = '', q = '' } = {}) {
  const words = q.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return entries.filter(entry =>
    (!models.length || models.some(model => entry.models.includes(model))) &&
    (!tags.length || tags.some(tag => entry.tags.includes(tag))) &&
    (!medium || entry.medium === medium) &&
    words.every(word => (entry.searchText ?? [entry.title, entry.description, entry.author, entry.authorHandle, entry.prompt, ...entry.models, ...entry.tags].join(' ')).normalize('NFKC').toLocaleLowerCase().includes(word)));
}

export function sortEntries(entries, sort = '') {
  if (!['featured', 'latest'].includes(sort)) return [...entries];
  return entries.map((entry, index) => ({ entry, index })).sort((a, b) =>
    (sort === 'featured' ? Number(Boolean(b.entry.featured)) - Number(Boolean(a.entry.featured)) : String(b.entry.date || '').localeCompare(String(a.entry.date || ''))) || a.index - b.index
  ).map(({ entry }) => entry);
}

export function selectHomeEntries(entries) {
  const featured = entries.filter(entry => entry.featured && !['removed', 'sensitive'].includes(entry.postStatus));
  const chosen = [], models = new Set();
  for (const entry of featured) if (entry.models.some(model => !models.has(model))) {
    chosen.push(entry); entry.models.forEach(model => models.add(model));
    if (chosen.length === 6) return chosen;
  }
  return [...chosen, ...featured.filter(entry => !chosen.includes(entry))].slice(0, 6);
}

export function filtersToSearch({ models = [], tags = [], medium = '', q = '', sort = '' }, search = '') {
  const params = new URLSearchParams(search);
  params.delete('model');
  params.delete('tag');
  params.delete('medium');
  params.delete('q');
  params.delete('sort');
  for (const model of new Set(models)) params.append('model', model);
  for (const tag of new Set(tags)) params.append('tag', tag);
  if (medium) params.set('medium', medium);
  if (q.trim()) params.set('q', q.trim());
  if (['featured', 'latest'].includes(sort)) params.set('sort', sort);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getCopyText(entry) {
  return entry.prompt;
}
