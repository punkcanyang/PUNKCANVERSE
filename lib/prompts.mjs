// Shared by the browser, build, tests, and verification. No DOM dependencies.
export function parseFilters(search = '') {
  const params = new URLSearchParams(search);
  return {
    models: [...new Set(params.getAll('model').filter(Boolean))],
    tags: [...new Set(params.getAll('tag').filter(Boolean))],
  };
}

export function clearFilters() {
  return { models: [], tags: [] };
}

export function filterEntries(entries, { models = [], tags = [] } = {}) {
  return entries.filter(entry =>
    (!models.length || models.some(model => entry.models.includes(model))) &&
    (!tags.length || tags.some(tag => entry.tags.includes(tag))));
}

export function filtersToSearch({ models = [], tags = [] }, search = '') {
  const params = new URLSearchParams(search);
  params.delete('model');
  params.delete('tag');
  for (const model of new Set(models)) params.append('model', model);
  for (const tag of new Set(tags)) params.append('tag', tag);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getCopyText(entry) {
  return entry.isLong
    ? `${entry.promptExcerpt}\n完整版：${entry.postUrl}`
    : entry.prompt;
}
