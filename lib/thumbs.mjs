export function validThumb(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'pbs.twimg.com' && !parsed.username && !parsed.password && !parsed.port;
  } catch { return false; }
}

export function formatDuration(durationMs) {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) return '';
  const seconds = Math.floor(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function normalizeThumb(record) {
  if (!record || record.status !== 'ok' || !validThumb(record.thumb)) return null;
  return {
    ...record,
    width: Number.isFinite(record.width) && record.width > 0 ? Math.round(record.width) : 1280,
    height: Number.isFinite(record.height) && record.height > 0 ? Math.round(record.height) : 720,
  };
}

export async function readThumbs(path, readFile) {
  try {
    const data = JSON.parse(await readFile(path, 'utf8'));
    return data && typeof data.entries === 'object' && !Array.isArray(data.entries) ? data : { entries: {} };
  } catch { return { entries: {} }; }
}
