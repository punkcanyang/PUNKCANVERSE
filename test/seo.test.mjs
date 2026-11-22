import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../build.mjs';
import { validateFilm } from '../lib/films.mjs';
import { isoDuration, firstSentence } from '../lib/seo.mjs';

const graphOf = html => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])['@graph'];

test('search data: film pages describe the video, listings name their subject, the empty works page stays out of search', async () => {
  const out = await mkdtemp(join(tmpdir(), 'pcv-seo-'));
  try {
    await buildSite({ out, publishKnowledgeBase: false });
    const read = file => readFile(join(out, file), 'utf8');

    for (const [file, lang] of [['films/wind-of-cijin/index.html', 'en'], ['zh/films/wind-of-cijin/index.html', 'zh-Hant-TW']]) {
      const html = await read(file);
      assert.match(html, /<title>[^<]+ · [^<]+ · Punkcan<\/title>/);
      assert.match(html, /<meta property="og:type" content="video\.other">/);
      assert.match(html, /<meta property="og:image" content="https:\/\/punkcanverse\.com\/img\/films\/wind-of-cijin\/\d\d\.webp">/);
      assert.equal((html.match(/<h1\b/g) || []).length, 1);
      const [video, crumbs] = graphOf(html);
      assert.equal(video['@type'], 'VideoObject');
      assert.equal(video.inLanguage, lang);
      assert.equal(video.duration, 'PT4M25S');
      assert.match(video.embedUrl, /^https:\/\/www\.youtube\.com\/embed\/[\w-]{11}$/);
      assert.equal(crumbs.itemListElement.length, 2);
      // The head still carries only the two approved analytics scripts.
      assert.ok(!html.slice(0, html.indexOf('</head>')).includes('ld+json'));
    }

    const home = graphOf(await read('index.html'));
    assert.deepEqual(home.map(node => node['@type']), ['WebSite', 'Person', 'ItemList']);
    assert.equal(graphOf(await read('about/index.html'))[0]['@type'], 'ProfilePage');

    for (const [file, word] of [['cpp/index.html', 'AI creator partner programs'], ['zh/competitions/index.html', 'AI 影片比賽與徵件']]) {
      const html = await read(file);
      assert.ok(html.match(/<title>([^<]*)/)[1].startsWith(word));
      const description = html.match(/name="description" content="([^"]*)/)[1];
      assert.ok(description.length > 60 && description.length < 160, description);
      assert.match(html, /<h1>AI /);
    }

    const sitemap = await read('sitemap.xml');
    const slugs = ['ai-video-platform-costs', 'ai-platform-reviews'];
    for (const [prefix, language] of [['/', 'en'], ['/zh/', 'zh-Hant-TW']]) {
      const index = prefix + 'creators/production-notes/';
      for (const slug of slugs) {
        const path = index + slug + '/';
        const html = await read(path.slice(1) + 'index.html');
        const canonical = 'https://punkcanverse.com' + path;
        const nodes = graphOf(html);
        const article = nodes.find(node => node['@type'] === 'BlogPosting');
        const crumbs = nodes.find(node => node['@type'] === 'BreadcrumbList');
        assert.equal(article.url, canonical);
        assert.equal(article.inLanguage, language);
        assert.ok(html.includes('<h1>' + article.headline + '</h1>'));
        assert.ok(html.includes('datetime="' + article.dateCreated + '"'));
        assert.equal(crumbs.itemListElement.at(-1).item, canonical);
        assert.ok(sitemap.includes('<loc>' + canonical + '</loc>'));
        const related = slugs.find(other => other !== slug);
        assert.ok(html.includes('href="' + index + related + '/"'));
      }
    }
    assert.match(sitemap, /<loc>https:\/\/punkcanverse\.com\/cpp\/<\/loc><lastmod>\d{4}-\d\d-\d\d<\/lastmod>/);
    assert.ok(!sitemap.includes('/works/'));
    for (const file of ['works/index.html', 'zh/works/index.html', 'essays/index.html']) assert.match(await read(file), /<meta name="robots" content="noindex">/);
    assert.ok(!(await read('about/index.html')).includes('noindex'));
    // Policy pages share the film layout while the archive is unpublished.
    assert.match(await read('privacy/index.html'), /<body class="film-layout"/);
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('search data helpers and the optional release date', () => {
  assert.equal(isoDuration(265.045), 'PT4M25S');
  assert.equal(firstSentence('Short film. Papercraft.'), 'Short film');
  assert.equal(firstSentence('臺語 AI 音樂錄影帶。手作布偶與微縮場景。'), '臺語 AI 音樂錄影帶');
  assert.throws(() => validateFilm({ slug: 'a', year: 2026, published: '2025-01-01' }, {}), /published/);
});
