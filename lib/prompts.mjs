// Shared by the browser, build, tests, and verification. No DOM dependencies.
export function parseFilters(search = '') {
  const params = new URLSearchParams(search);
  return {
    models: [...new Set(params.getAll('model').filter(Boolean))],
    tags: [...new Set(params.getAll('tag').filter(Boolean))],
    ...(params.get('medium') ? { medium: params.get('medium') } : {}),
  };
}

export function clearFilters() {
  return { models: [], tags: [] };
}

export function filterEntries(entries, { models = [], tags = [], medium = '' } = {}) {
  return entries.filter(entry =>
    (!models.length || models.some(model => entry.models.includes(model))) &&
    (!tags.length || tags.some(tag => entry.tags.includes(tag))) &&
    (!medium || entry.medium === medium));
}

export function filtersToSearch({ models = [], tags = [], medium = '' }, search = '') {
  const params = new URLSearchParams(search);
  params.delete('model');
  params.delete('tag');
  params.delete('medium');
  for (const model of new Set(models)) params.append('model', model);
  for (const tag of new Set(tags)) params.append('tag', tag);
  if (medium) params.set('medium', medium);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getCopyText(entry) {
  return entry.prompt;
}
