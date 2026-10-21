import { readFile, mkdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { escapeHtml as e, externalLink, markdownToHtml } from './lib/markdown.mjs';
import { renderCard } from './lib/cards.mjs';
import { validatePostMetadata } from './lib/posts.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const out = join(root, 'dist');
const data = JSON.parse(await readFile(join(root, 'data/prompts.json'), 'utf8'));
const entries = data.entries;
for (const entry of entries) validatePostMetadata(entry);
const models = [...new Set(entries.flatMap(entry => entry.models))];
const tags = [...new Set(entries.flatMap(entry => entry.tags))];
const takedownUrl = 'https://github.com/punkcanyang/fight-prompts/issues/new?template=takedown.md&title=%E4%B8%8B%E6%9E%B6%E7%94%B3%E8%AF%B7';

function footer() {
  return `<footer class="site-footer"><div class="footer-top"><a class="wordmark" href="index.html">FIGHT<span>/</span>PROMPTS<small>个人自用 · v0.1</small></a><div class="footer-links"><a href="takedown.html">下架申请 · 48 小时内处理</a>${externalLink('https://x.com/punkcan', '作者：@punkcan')}</div></div><p>提示词版权归原作者，本站只收录文字并附原帖，影片以 X 官方嵌入显示，不转存。</p></footer>`;
}

function page({ title, description, active, body, twitter = false }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="description" content="${e(description)}">
  <title>${e(title)} · FIGHT/PROMPTS</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23d94c2b'/%3E%3Ctext x='14' y='48' font-size='48' font-family='sans-serif' font-weight='bold' fill='white'%3EF%3C/text%3E%3C/svg%3E">
  <link rel="stylesheet" href="assets/site.css">
  <script type="module" src="assets/app.mjs"></script>
  ${twitter ? '<script id="x-widgets" async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>' : ''}
</head>
<body>
  <a class="skip-link" href="#main">跳到主要内容</a>
  <header class="site-header"><a class="wordmark" href="index.html" aria-label="FIGHT/PROMPTS 首页">FIGHT<span>/</span>PROMPTS</a><nav aria-label="主导航"><a href="index.html"${active === 'home' ? ' aria-current="page"' : ''}>提示词库</a><a href="tips.html"${active === 'tips' ? ' aria-current="page"' : ''}>写法要点</a></nav></header>
  <main id="main">${body}</main>
  ${footer()}
  <div id="toast" class="toast" role="status" aria-live="polite" aria-atomic="true"></div>
</body>
</html>\n`;
}

function filterOptions(values, kind) {
  return values.map(value => `<label class="filter-chip"><input type="checkbox" name="${kind}" value="${e(value)}"><span>${e(value)}</span></label>`).join('');
}


const home = page({
  title: 'AI 视频提示词站 v0.1',
  description: '63 条打斗与械斗 AI 视频提示词。按模型、标签筛选，复制提示词，查看 X 原帖成片。',
  active: 'home', twitter: true,
  body: `<section class="hero"><div><p class="eyebrow"><span class="live-dot" aria-hidden="true"></span> AI 视频提示词站 <span class="edition">VOL. 01 / 打斗与械斗</span></p><h1>好动作，<br>从<span>好提示词</span>开始。</h1><p class="hero-description">收集值得拆解的打斗与械斗案例。<br>读提示词，看成片，把灵感带进下一次创作。</p><a class="text-link" href="tips.html">动手之前，看看写法要点 <span aria-hidden="true">↗</span></a></div><div class="hero-index"><span class="index-label">THE COLLECTION</span><strong>${entries.length}<span>条提示词</span></strong><div class="index-rule"></div><p>${models.length} 种模型 <span>/</span> ${tags.length} 个标签</p><small>个人自用收藏 · v0.1</small></div></section>
  <section class="library" aria-label="提示词库"><div class="library-heading"><h2>浏览提示词 <span>THE ARCHIVE</span></h2><p id="result-count" role="status" aria-live="polite">共 ${entries.length} 条</p></div>
  <noscript><p class="notice">全部提示词已显示。筛选、复制和成片嵌入需要启用 JavaScript；也可直接选取文字或点击原帖。</p></noscript>
  <details class="filter-panel" open><summary>筛选条件 <span>模型 / 标签</span><span class="filter-toggle" aria-hidden="true">＋</span></summary><form id="filters"><fieldset disabled><legend>模型</legend><div class="filter-options">${filterOptions(models, 'model')}</div></fieldset><fieldset disabled><legend>标签</legend><div class="filter-options">${filterOptions(tags, 'tag')}</div></fieldset><div class="filter-bottom"><p>同类多选取并集，模型与标签取交集。</p><button id="clear-filters" class="clear-button" type="button" disabled>清除筛选</button></div><p id="unknown-filters" class="notice" hidden></p></form></details>
  <div id="prompt-grid" class="prompt-grid">${entries.map(renderCard).join('\n')}</div><div id="empty-state" class="empty-state" hidden><span aria-hidden="true">∅</span><h3>暂时没有匹配的提示词</h3><p>试试减少筛选条件，或清除筛选重新浏览。</p><button type="button" class="primary-button" data-clear-filters>清除筛选</button></div>
  </section>`,
});

const tipFiles = [
  { id: 'fight', file: 'fight.md', title: '打斗 / 械斗', label: '01 / 动作与镜头' },
  { id: 'wan3', file: 'wan3.md', title: 'Wan 3.0', label: '02 / 真人与情绪' },
  { id: 'minimax-h3', file: 'minimax-h3.md', title: 'MiniMax H3', label: '03 / 视听与结构' },
];
const tipSections = [];
for (const tip of tipFiles) {
  const markdown = await readFile(join(root, 'data/tips', tip.file), 'utf8');
  tipSections.push(`<section id="${tip.id}" class="tip-section" aria-label="${e(tip.title)}"><p class="eyebrow">${e(tip.label)}</p>${markdownToHtml(markdown, { headingOffset: 1 })}<a class="back-top" href="#tips-top">回到目录 ↑</a></section>`);
}
const tips = page({
  title: '写法要点', description: '打斗与械斗、Wan 3.0、MiniMax H3 的提示词写法要点与示例。', active: 'tips',
  body: `<header class="page-intro" id="tips-top"><p class="eyebrow">FIELD NOTES / 创作笔记</p><h1>把动作写清楚。</h1><p>从动作、镜头到声音，整理下一次创作可以参考的写法。</p></header><nav class="tips-toc" aria-label="写法要点目录">${tipFiles.map(tip => `<a href="#${tip.id}"><small>${e(tip.label)}</small><strong>${e(tip.title)} <span aria-hidden="true">↘</span></strong></a>`).join('')}</nav><div class="tips-content">${tipSections.join('\n')}</div>`,
});
const takedown = page({
  title: '下架申请', description: '作者如希望下架，请通过 GitHub issue 提出，我们会在 48 小时内处理，无需先证明身份。', active: '',
  body: `<section class="takedown-content"><p class="eyebrow">RESPECT THE CREATORS / 尊重创作</p><h1>你的作品，<br>由你决定。</h1><p class="takedown-lead">作者如希望下架，请通过 GitHub issue 提出，我们会在 48 小时内处理，无需先证明身份。</p><div class="takedown-steps"><span>01</span><p>附上需要下架的原帖链接、你的 X 账号与说明。</p><span>02</span><p>提交申请后，我们会在 48 小时内处理。</p></div>${externalLink(takedownUrl, '通过 GitHub 申请下架 ↗', 'primary-button')}<p class="takedown-note">提示词版权归原作者。感谢每一位分享创作过程的作者。</p><a class="text-link" href="index.html">← 返回提示词库</a></section>`,
});

await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'assets'), { recursive: true });
await writeFile(join(out, 'index.html'), home);
await writeFile(join(out, 'tips.html'), tips);
await writeFile(join(out, 'takedown.html'), takedown);
// Only publish entries, without the editorial source metadata.
await writeFile(join(out, 'data.json'), JSON.stringify({ entries }));
await copyFile(join(root, 'web/app.mjs'), join(out, 'assets/app.mjs'));
await copyFile(join(root, 'web/clipboard.mjs'), join(out, 'assets/clipboard.mjs'));
await copyFile(join(root, 'web/embeds.mjs'), join(out, 'assets/embeds.mjs'));
await copyFile(join(root, 'web/site.css'), join(out, 'assets/site.css'));
await copyFile(join(root, 'lib/prompts.mjs'), join(out, 'assets/prompts.mjs'));
await copyFile(join(root, '_headers'), join(out, '_headers'));
console.log(`Built ${entries.length} prompts and 3 pages → dist/`);
