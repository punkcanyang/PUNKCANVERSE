import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validThumb } from '../lib/thumbs.mjs';

function mediaRecord(postId, media, source) {
  const thumb = source === 'x-api'
    ? media?.type === 'photo' ? media.url : media?.preview_image_url
    : media?.media_url_https;
  if (!media || !validThumb(thumb)) throw new Error('no-media');
  return {
    postId, status: 'ok', source, mediaType: media.type, thumb,
    width: media.width ?? media.original_info?.width ?? null,
    height: media.height ?? media.original_info?.height ?? null,
    durationMs: media.duration_ms ?? media.video_info?.duration_millis ?? null,
  };
}

// Injectable transport, clock and wait make every branch testable offline.
export async function fetchThumbs({ entries, previous = { entries: {} }, bearerToken = '', fetchImpl = globalThis.fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), now = new Date().toISOString() }) {
  const result = { fetchedAt: now, entries: { ...previous.entries } };
  const save = (entry, record) => { result.entries[entry.id] = record; };
  const fail = entry => {
    const old = previous.entries?.[entry.id];
    save(entry, old ? { ...old, lastError: 'fetch-unavailable', staleSince: old.staleSince || now }
      : { postId: entry.embedId || entry.id, status: 'missing', source: bearerToken ? 'x-api' : 'syndication' });
  };
  if (bearerToken) {
    const ids = [...new Set(entries.map(entry => entry.embedId || entry.id))];
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = ids.slice(offset, offset + 100);
      const affected = entries.filter(entry => batch.includes(entry.embedId || entry.id));
      try {
        const url = new URL('https://api.x.com/2/tweets');
        url.search = new URLSearchParams({ ids: batch.join(','), expansions: 'attachments.media_keys', 'media.fields': 'preview_image_url,url,duration_ms,width,height,type' });
        const response = await fetchImpl(url.href, { headers: { Authorization: `Bearer ${bearerToken}` }, signal: AbortSignal.timeout(10000) });
        if (response.status !== 200) throw new Error('http');
        const data = await response.json();
        const posts = new Map((data.data || []).map(post => [post.id, post]));
        const media = new Map((data.includes?.media || []).map(item => [item.media_key, item]));
        for (const entry of affected) {
          try {
            const postId = entry.embedId || entry.id;
            const key = posts.get(postId)?.attachments?.media_keys?.[0];
            save(entry, mediaRecord(postId, media.get(key), 'x-api'));
          } catch { fail(entry); }
        }
      } catch { affected.forEach(fail); }
    }
  } else {
    for (let index = 0; index < entries.length; index++) {
      if (index > 0) await wait(250);
      const entry = entries[index];
      const postId = entry.embedId || entry.id;
      try {
        const response = await fetchImpl(`https://cdn.syndication.twimg.com/tweet-result?id=${encodeURIComponent(postId)}&lang=en&token=a`, { signal: AbortSignal.timeout(10000) });
        if (response.status !== 200) throw new Error('http');
        const data = await response.json();
        if (data.__typename === 'TweetTombstone') throw new Error('unavailable');
        save(entry, mediaRecord(postId, data.mediaDetails?.[0], 'syndication'));
      } catch { fail(entry); }
    }
  }
  return result;
}

export async function runFetchThumbs({ root = new URL('../', import.meta.url), fetchImpl, wait, bearerToken = process.env.X_BEARER_TOKEN || '' } = {}) {
  const path = new URL('data/thumbs.json', root);
  let previous = { entries: {} };
  try {
    previous = JSON.parse(await readFile(path, 'utf8'));
    if (!previous?.entries || typeof previous.entries !== 'object' || Array.isArray(previous.entries)) throw new Error('Invalid cache');
  } catch (error) {
    if (error.code !== 'ENOENT') { console.log('旧缓存无法读取，未改写文件。'); return; }
  }
  try {
    const { entries } = JSON.parse(await readFile(new URL('data/prompts.json', root), 'utf8'));
    let workflows = [];
    try {
      const parsed = JSON.parse(await readFile(new URL('data/workflows.json', root), 'utf8'));
      // Published data uses entries; retain legacy fixture/input compatibility.
      const list = Array.isArray(parsed) ? parsed : parsed.entries ?? parsed.workflows;
      if (!Array.isArray(list)) throw new Error('Invalid workflow entries');
      workflows = list.map(item => ({ id: item.id }));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const targets = [...entries, ...workflows];
    const result = await fetchThumbs({ entries: targets, previous, fetchImpl, wait, bearerToken });
    if (!Object.keys(result.entries).length) { console.log('无可写入的记录，保留旧文件。'); return; }
    const temporary = new URL('data/thumbs.json.tmp', root);
    await writeFile(temporary, JSON.stringify(result, null, 2) + '\n');
    await rename(temporary, path);
    const stats = { total: targets.length, ok: 0, missing: 0, stale: 0 };
    for (const entry of targets) {
      const record = result.entries[entry.id];
      if (record.status === 'ok') stats.ok++; else stats.missing++;
      if (record.lastError) stats.stale++;
    }
    console.log(JSON.stringify(stats));
  } catch { console.log('缩图更新未完成，保留旧文件。'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runFetchThumbs();
