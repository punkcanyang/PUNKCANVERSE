import { readFile, mkdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { escapeHtml as e, externalLink, markdownToHtml } from './lib/markdown.mjs';
import { renderCard, renderPromptDetail } from './lib/cards.mjs';
import { validatePostMetadata } from './lib/posts.mjs';
import { AFFILIATE_DISCLOSURE, validateAffiliates, renderRecommendedTools } from './lib/affiliates.mjs';
import { renderNewsletter, validateSite } from './lib/newsletter.mjs';
import { renderMediumFilter, validateMedia } from './lib/media.mjs';
import { renderRegions, validateRegions, validateRegionText } from './lib/regions.mjs';

import { readThumbs } from './lib/thumbs.mjs';
import { renderMediaTabs, MEDIUM_NAMES, promptPath } from './lib/media-tabs.mjs';
import { loadEssays, renderEssay, renderEssayList } from './lib/essays.mjs';
import { renderAnalytics, renderConsentBanner } from './lib/analytics.mjs';
import { SITE_PAGES, renderSiteLinks, renderSitePage } from './lib/site-pages.mjs';

const SITE_URL = 'https://punkcanverse.com';
export async function buildSite(options = {}) {
const root = options.root || fileURLToPath(new URL('.', import.meta.url));
const out = options.out || join(root, 'dist');
const data = JSON.parse(await readFile(join(root, 'data/prompts.json'), 'utf8'));
const entries = data.entries;
validateMedia(entries);
for (const entry of entries) validatePostMetadata(entry);
const affiliates = options.affiliates || JSON.parse(await readFile(join(root, 'data/affiliates.json'), 'utf8'));
const thumbs = await readThumbs(options.thumbPath || join(root, 'data/thumbs.json'), readFile);
const essays = await loadEssays(pathToFileURL((options.essayDirectory || join(root, 'content/essays')) + '/'));
const site = JSON.parse(await readFile(join(root, 'data/site.json'), 'utf8'));
const regionsRaw = await readFile(join(root, 'data/regions.json'), 'utf8');
const regionData = JSON.parse(regionsRaw);
validateAffiliates(affiliates);
validateSite(site);
validateRegions(regionData, regionsRaw);
const models = [...new Set(entries.flatMap(entry => entry.models))];
const tags = [...new Set(entries.flatMap(entry => entry.tags))];
const takedownUrl = 'https://github.com/punkcanyang/fight-prompts/issues/new?template=takedown.md&title=%E4%B8%8B%E6%9E%B6%E7%94%B3%E8%AF%B7';

function footer() {
  return `<footer class="site-footer"><div class="footer-top"><a class="wordmark" href="index.html">PUNKCANVERSE<small>DIRECTED & CURATED BY PUNKCAN</small></a><div class="footer-links"><a href="takedown.html">下架申请 · 48 小时内处理</a>${externalLink('https://x.com/punkcan', '作者：@punkcan')}</div></div>${renderSiteLinks()}<p>提示词版权归原作者，本站只收录文字并附原帖，影片以 X 官方嵌入显示，不转存。缩图同样直接引用 X 原图，不转存。</p><p class="affiliate-disclosure"><a href="/affiliate-disclosure/">${AFFILIATE_DISCLOSURE}</a></p></footer>`;
}

function page({ path, title, description, active, body, twitter = false }) {
  const canonical = `${SITE_URL}${path}`;
  const pageTitle = `${title} · PUNKCANVERSE`;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  ${renderAnalytics()}
  <meta name='impact-site-verification' value='15021707-94fc-4527-ab33-87c6066da7fd'>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <base href="/">
  <meta name="description" content="${e(description)}">
  <title>${e(pageTitle)}</title>
  <link rel="canonical" href="${e(canonical)}">
  <meta property="og:url" content="${e(canonical)}">
  <meta property="og:title" content="${e(pageTitle)}">
  <meta property="og:description" content="${e(description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="PUNKCANVERSE">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23d94c2b'/%3E%3Ctext x='14' y='48' font-size='48' font-family='sans-serif' font-weight='bold' fill='white'%3EP%3C/text%3E%3C/svg%3E">
  <link rel="stylesheet" href="assets/site.css">
  <script type="module" src="assets/app.mjs"></script>

</head>
<body>
  <a class="skip-link" href="${path}#main">跳到主要内容</a>
  <header class="site-header"><div class="mast-top"><a class="wordmark" href="index.html">PUNKCANVERSE</a><span class="issue">AN INDEPENDENT CREATIVE PRODUCTION / 2026</span>${externalLink('https://x.com/punkcan','@punkcan ↗','author-link')}</div><nav aria-label="主导航"><a href="/prompts/video/">提示词库 <small>VIDEO / IMAGE / MUSIC</small></a><a href="tips.html">技术与资源</a><a href="/essays/">AI 工作论 <small>BY PUNKCAN</small></a><a href="regions.html">地区与申诉</a></nav></header>
  <main id="main">${body}</main>
  ${renderNewsletter(site)}${footer()}
  ${renderConsentBanner()}
  <div id="toast" class="toast" role="status" aria-live="polite" aria-atomic="true"></div>
</body>
</html>\n`;
}

function filterOptions(values, kind) {
  return values.map(value => `<label class="filter-chip"><input type="checkbox" name="${kind}" value="${e(value)}"><span>${e(value)}</span></label>`).join('');
}


function library(collection, selected = 'video', collectionPage = false) {
  const tabs = renderMediaTabs(entries, selected);
  if (!collection.length) return `${tabs}<section class="empty-state"><h2>${MEDIUM_NAMES[selected]}提示词整理中</h2><p>先看视频分页，新的创作笔记将在整理后发布。</p><a href="/prompts/video/">浏览视频提示词 ↗</a></section>`;
  return `<section class="library" id="library"><div class="library-heading"><span class="eyebrow">01 / PROMPT ARCHIVE</span><h2>提示词库</h2><p id="result-count" role="status" aria-live="polite">共 ${collection.length} 条</p></div>${tabs}<div class="collection-line"><strong>FIGHT/PROMPTS</strong><span>打斗与械斗 / ${MEDIUM_NAMES[selected]}提示词栏目</span><span>原帖缩图 · 点击后载入 X</span></div><details class="filter-panel"><summary>筛选条件 <span>模型 / 标签</span></summary><form id="filters"${collectionPage ? ` data-default-medium="${selected}"` : ''}>${renderMediumFilter(entries)}<fieldset disabled><legend>模型</legend><div class="filter-options">${filterOptions(models, 'model')}</div></fieldset><fieldset disabled><legend>标签</legend><div class="filter-options">${filterOptions(tags, 'tag')}</div></fieldset><div class="filter-bottom"><p>同类多选取并集，模型与标签取交集。</p><button id="clear-filters" class="clear-button" type="button" disabled>清除筛选</button></div><p id="unknown-filters" class="notice" hidden></p></form></details><noscript><p class="notice">全部提示词均可阅读；点击标题查看独立页面，成片也可在 X 原帖观看。</p></noscript><div id="prompt-grid" class="prompt-grid">${collection.map((entry,index) => renderCard(entry,index,affiliates,thumbs.entries?.[entry.id])).join('\n')}</div><button type="button" id="show-more" class="primary-button" hidden>显示更多</button><div id="empty-state" class="empty-state" hidden><h3>暂时没有匹配的提示词</h3><p>试试减少筛选条件，或清除筛选重新浏览。</p><button type="button" class="primary-button" data-clear-filters>清除筛选</button></div></section>`;
}
const home = page({
  path: '/', title: 'AI VIDEO / IMAGE / MUSIC',
  description: 'PUNKCANVERSE：AI 视频、图像与音乐创作的入口。收藏真实提示词、制作笔记与 AI 工作论。', active:'home',
  body: `<section class="cinema-hero"><div class="hero-topline"><span>AI VIDEO / IMAGE / MUSIC</span><span>PRODUCTION No. 003 — OCT. 2026</span></div><div class="cinema-title"><h1 aria-label="PUNKCANVERSE"><span>PUNKCAN</span><span><b class="cut-letter">V</b>ERSE<span class="title-dot">.</span></span></h1><aside class="copy-mark"><span>NIGHT SHIFT</span><strong>COPY<br>003</strong><svg class="safety-pin" viewBox="0 0 180 60" fill="none" aria-hidden="true"><path d="M33 16C10-1 0 32 19 42c10 6 19 1 20-9L145 8c18-4 27 7 20 20L53 49 33 16Z" stroke="currentColor" stroke-width="4"/></svg><small>notes from the set</small></aside><span class="vertical-caption">NOTES FROM BEHIND THE CAMERA</span></div><div class="cinema-bottom"><div><h2>创作，从这一帧开始。</h2><p>AI 视频、图像、音乐的创作入口。<br>收藏提示词，拆解镜头，留下制作笔记。</p><a class="primary-button" href="/#library">进入提示词库 / ${entries.length} 条 ↗</a></div><div class="hero-slate"><small>DIRECTED & CURATED BY</small><strong>PUNKCAN</strong><span>ARCHIVE ${entries.length} / EDITION 03</span></div><div class="hero-take"><span>TAKE</span><strong>03</strong></div></div><div class="film-strip" aria-hidden="true"></div><div class="reel-notes"><span>ORIGINAL POSTS / REAL PROMPTS</span><a href="/essays/">AI 工作论 / Punkcan ↗</a></div></section>${library(entries)}<section class="home-essays"><p class="eyebrow">02 / ESSAYS</p><h2><a href="/essays/">AI 工作论 ↗</a></h2><p>关于创作、工具与工作方式的长期笔记。</p></section>`,
});

const tipFiles = [
  { id: 'fight', file: 'fight.md', title: '打斗 / 械斗', label: '01 / 动作与镜头' },
  { id: 'wan3', file: 'wan3.md', title: 'Wan 3.0', label: '02 / 真人与情绪' },
  { id: 'minimax-h3', file: 'minimax-h3.md', title: 'MiniMax H3', label: '03 / 视听与结构' },
];
const tipSections = [];
for (const tip of tipFiles) {
  const markdown = await readFile(join(root, 'data/tips', tip.file), 'utf8');
  tipSections.push(`<section id="${tip.id}" class="tip-section" aria-label="${e(tip.title)}"><p class="eyebrow">${e(tip.label)}</p>${markdownToHtml(markdown, { headingOffset: 1 })}<a class="back-top" href="tips.html#tips-top">回到目录 ↑</a></section>`);
}
const tips = page({
  path: '/tips.html',
  title: '技术与资源', description: '打斗与械斗、Wan 3.0、MiniMax H3 的提示词写法要点与示例。', active: 'tips',
  body: `<header class="page-intro" id="tips-top"><p class="eyebrow">FIELD NOTES / 创作笔记</p><h1>把动作写清楚。</h1><p>从动作、镜头到声音，整理下一次创作可以参考的写法。</p></header><nav class="tips-toc" aria-label="写法要点目录">${tipFiles.map(tip => `<a href="tips.html#${tip.id}"><small>${e(tip.label)}</small><strong>${e(tip.title)} <span aria-hidden="true">↘</span></strong></a>`).join('')}</nav><div class="tips-content">${tipSections.join('\n')}</div>${renderRecommendedTools(affiliates)}`,
});
const takedown = page({
  path: '/takedown.html',
  title: '下架申请', description: '作者如希望下架，请通过 GitHub issue 提出，我们会在 48 小时内处理，无需先证明身份。', active: '',
  body: `<section class="takedown-content"><p class="eyebrow">RESPECT THE CREATORS / 尊重创作</p><h1>你的作品，<br>由你决定。</h1><p class="takedown-lead">作者如希望下架，请通过 GitHub issue 提出，我们会在 48 小时内处理，无需先证明身份。</p><div class="takedown-steps"><span>01</span><p>附上需要下架的原帖链接、你的 X 账号与说明。</p><span>02</span><p>提交申请后，我们会在 48 小时内处理。</p></div>${externalLink(takedownUrl, '通过 GitHub 申请下架 ↗', 'primary-button')}<p class="takedown-note">提示词版权归原作者。感谢每一位分享创作过程的作者。</p><a class="text-link" href="index.html">← 返回提示词库</a></section>`,
});
const regions = page({
  path: '/regions.html', title: 'AI 工具各地区使用与申诉',
  description: '仅整理 AI 工具的官方地区政策与申诉管道，附官方来源和检查日期。',
  active: 'regions', body: renderRegions(regionData),
});
validateRegionText(regions);

const pages = new Map([['/',home], ['/tips.html',tips], ['/takedown.html',takedown], ['/regions.html',regions]]);
const publicPaths = [...pages.keys()];
for (const medium of Object.keys(MEDIUM_NAMES)) {
  const collection = entries.filter(entry => (entry.medium || 'video') === medium);
  const path = `/prompts/${medium}/`;
  pages.set(path, page({path, title: `${MEDIUM_NAMES[medium]}提示词库`, description:`PUNKCANVERSE ${MEDIUM_NAMES[medium]}提示词与制作笔记。`, body: library(collection,medium,true)}));
  if (collection.length) publicPaths.push(path);
}
for (const entry of entries) {
  if (!/^\d+$/.test(entry.id)) throw new Error('Invalid prompt id');
  const path = promptPath(entry);
  pages.set(path, page({path, title:entry.title, description:entry.description, body:renderPromptDetail(entry,entries,affiliates,thumbs.entries?.[entry.id])}));
  publicPaths.push(path);
}
pages.set('/essays/',page({path:'/essays/',title:'AI 工作论',description:'Punkcan 关于创作、工具与工作方式的长期笔记。',body:renderEssayList(essays)}));
publicPaths.push('/essays/');
for (const essay of essays) {
  const path = `/essays/${essay.slug}/`;
  pages.set(path,page({path,title:essay.title,description:essay.summary,body:renderEssay(essay)}));
  publicPaths.push(path);
}
for (const info of SITE_PAGES) {
  pages.set(info.path,page({path:info.path,title:info.title,description:info.summary,body:renderSitePage(info)}));
  publicPaths.push(info.path);
}
await rm(out, { recursive:true,force:true });
await mkdir(join(out,'assets'),{recursive:true});
for (const [path, html] of pages) {
  const file = join(out,path.endsWith('.html') ? path.slice(1) : `${path.slice(1)}index.html`);
  await mkdir(dirname(file),{recursive:true});
  await writeFile(file,html);
}
const sitemapUrls = publicPaths.map(path => `${SITE_URL}${path}`);
await writeFile(join(out,'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(url => `  <url><loc>${e(url)}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile(join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
await writeFile(join(out,'data.json'),JSON.stringify({entries}));
for (const file of ['app.mjs','clipboard.mjs','embeds.mjs','consent.mjs','site.css']) await copyFile(join(root,'web',file),join(out,'assets',file));
await copyFile(join(root,'lib/prompts.mjs'),join(out,'assets/prompts.mjs'));
await copyFile(join(root,'_headers'),join(out,'_headers'));
return { pages: [...pages.keys()], sitemapUrls };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildSite();
  console.log(`Built ${result.pages.length} PUNKCANVERSE pages → dist/`);
}
