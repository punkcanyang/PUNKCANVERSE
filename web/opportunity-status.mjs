// A date without a time zone is certainly over only once it has ended in UTC−12.
export function closesAt(at) {
  return at.length === 10 ? Date.parse(at + 'T12:00:00Z') + 86400000 : Date.parse(at) + 1000;
}
export function refreshDeadlines(root, now = Date.now()) {
  for (const label of root.querySelectorAll('[data-closes-at]')) {
    label.hidden = now < Number(label.dataset.closesAt);
  }
}
if (typeof document !== 'undefined') {
  refreshDeadlines(document);
  window.addEventListener('pageshow', () => refreshDeadlines(document));
  setInterval(() => refreshDeadlines(document), 60000);
}
