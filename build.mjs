import { readFile, mkdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { escapeHtml as e, externalLink, markdownToHtml } from './lib/markdown.mjs';
import { renderCard, renderPromptDetail } from './lib/cards.mjs';
import { validatePostMetadata } from './lib/posts.mjs';
import { validateAffiliates, renderRecommendedTools } from './lib/affiliates.mjs';
import { renderNewsletter, validateSite } from './lib/newsletter.mjs';
import { renderMediumFilter, validateMedia } from './lib/media.mjs';
import { renderRegions, validateRegions, validateRegionText } from './lib/regions.mjs';
import { readThumbs } from './lib/thumbs.mjs';
import { renderMediaTabs, promptPath } from './lib/media-tabs.mjs';
import { loadEssays, renderEssay, renderEssayList } from './lib/essays.mjs';
import { renderAnalytics, renderConsentBanner } from './lib/analytics.mjs';
import { SITE_PAGES, renderSiteLinks, renderLegalPage } from './lib/site-pages.mjs';
import { loadI18n, validateI18n, formatText, localizeEntry, translateTag, translateModelName, cardUI, workflowCopy } from './lib/i18n.mjs';
import { listPages, publicPath, switchHref, HTML_LANG, OG_LOCALE } from './lib/routes.mjs';
import { validateWorkflows, renderWorkflowCard, renderWorkflowDetail, renderWorkflowEmpty } from './lib/workflows.mjs';

export const SITE_URL = 'https://punkcanverse.com';
export async function buildSite(options = {}) {
  const root = options.root || fileURLToPath(new URL('.', import.meta.url));
  const out = options.out || join(root,'dist');
  const readJSON = async path => JSON.parse(await readFile(join(root,path),'utf8'));
  const {entries} = await readJSON('data/prompts.json');
  const affiliates = options.affiliates || await readJSON('data/affiliates.json');
  const workflows = options.workflows ?? (await readJSON('data/workflows.json')).entries;
  const thumbs = await readThumbs(options.thumbPath || join(root,'data/thumbs.json'),readFile);
  const essays = await loadEssays(pathToFileURL((options.essayDirectory || join(root,'content/essays'))+'/'));
  const site = await readJSON('data/site.json');
  const regionData = await readJSON('data/regions.json');
  const i18n = options.i18n || await loadI18n(root);
  validateMedia(entries); entries.forEach(validatePostMetadata);
  validateAffiliates(affiliates); validateSite(site); validateRegions(regionData); validateWorkflows(workflows);
  validateI18n(i18n,entries,workflows,regionData);
  const descriptors = listPages({entries,workflows,essays,sitePages:SITE_PAGES});
  const models = [...new Set(entries.flatMap(x=>x.models))];
  const tags = [...new Set(entries.flatMap(x=>x.tags))];
  const pages = new Map();
  const takedownUrl = 'https://github.com/punkcanyang/PUNKCANVERSE/issues/new?template=takedown.md&title=%E4%B8%8B%E6%9E%B6%E7%94%B3%E8%AF%B7';
  for (const descriptor of descriptors) {
    const {locale,route,path} = descriptor;
    const u = i18n.ui[locale], content = i18n.content[locale];
    const t = (key,values) => formatText(u[key],values);
    const href = route => switchHref(locale,route);
    const publicHref = route => publicPath(locale,route);
    const localized = entry => localizeEntry(entry,locale,content);
    const cUI = cardUI(locale,u,content);
    // Keep the original Chinese renderer's exact copy for existing public pages.
    const renderUI = locale === 'zh' ? undefined : cUI;
    const workflowText = workflow => workflowCopy(workflow,locale,content);
    const names = {video:u.video,image:u.image,music:u.music};
    const tabs = current => renderMediaTabs(entries,current,{names,ariaLabel:u.mediaAria,mediumHref:medium=>href(`/prompts/${medium}/`),workflow:{href:href('/prompts/workflow/'),label:u.workflow,count:workflows.length}});
    const markdown = text => markdownToHtml(text,{headingOffset:1,copyLabel:u.copy,codeLabel:u.codeExample,tableLabel:u.tableAria}).replace(/>复制<\/button>/g,`>${e(u.copy)}</button>`);
    function library(collection,medium='video',collectionPage=false) {
      const tabBar = tabs(collectionPage ? href(`/prompts/${medium}/`) : href('/'));
      if (!collection.length) return `${tabBar}<section class="empty-state"><h2>${e(t('mediaEmpty',{medium:names[medium]}))}</h2><p>${e(u.mediaEmptyBody)}</p><a href="${href('/prompts/video/')}">${e(u.browseVideo)}</a></section>`;
      const choices = (values,kind) => values.map(value=>`<label class="filter-chip"><input type="checkbox" name="${kind}" value="${e(value)}"><span>${e(kind==='tag' ? translateTag(value,locale,content) : translateModelName(value,locale))}</span></label>`).join('');
      return `<section class="library" id="library"><div class="library-heading"><span class="eyebrow">01 / PROMPT ARCHIVE</span><h2>${e(u.navPrompts)}</h2><p id="result-count" role="status" aria-live="polite">${e(t('count',{n:collection.length}))}</p></div>${tabBar}<div class="collection-line"><strong>FIGHT/PROMPTS</strong><span>${e(u.collection)} / ${e(names[medium])}</span><span>${e(u.thumbHint)}</span></div><details class="filter-panel"><summary>${e(u.filter)} <span>${e(u.modelLabel)} / ${e(u.tagLabel)}</span></summary><form id="filters"${collectionPage?` data-default-medium="${medium}"`:''}>${renderMediumFilter(entries)}<fieldset disabled><legend>${e(u.modelLabel)}</legend><div class="filter-options">${choices(models,'model')}</div></fieldset><fieldset disabled><legend>${e(u.tagLabel)}</legend><div class="filter-options">${choices(tags,'tag')}</div></fieldset><div class="filter-bottom"><p>${e(u.filterHelp)}</p><button id="clear-filters" class="clear-button" type="button" disabled>${e(u.clear)}</button></div><p id="unknown-filters" class="notice" hidden></p></form></details><noscript><p class="notice">${e(u.noscript)}</p></noscript><div id="prompt-grid" class="prompt-grid">${collection.map((entry,index)=>renderCard(localized(entry),index,affiliates,thumbs.entries?.[entry.id],renderUI)).join('\n')}</div><button type="button" id="show-more" class="primary-button" hidden>${e(u.showMore)}</button><div id="empty-state" class="empty-state" hidden><h3>${e(u.emptyTitle)}</h3><p>${e(u.emptyBody)}</p><button type="button" class="primary-button" data-clear-filters>${e(u.clear)}</button></div></section>`;
    }
    let title,description,body;
    if (route==='/') {
      title='AI VIDEO / IMAGE / MUSIC';description=u.homeDescription;
      // The H film-slate artwork keeps its original 003 edition number.
      body=`<section class="cinema-hero"><div class="hero-topline"><span>AI VIDEO / IMAGE / MUSIC</span><span>PRODUCTION No. 003 — OCT. 2026</span></div><div class="cinema-title"><h1 aria-label="PUNKCANVERSE"><span>PUNKCAN</span><span><b class="cut-letter">V</b>ERSE<span class="title-dot">.</span></span></h1><aside class="copy-mark"><span>NIGHT SHIFT</span><strong>COPY<br>003</strong><svg class="safety-pin" viewBox="0 0 180 60" fill="none" aria-hidden="true"><path d="M33 16C10-1 0 32 19 42c10 6 19 1 20-9L145 8c18-4 27 7 20 20L53 49 33 16Z" stroke="currentColor" stroke-width="4"/></svg><small>notes from the set</small></aside><span class="vertical-caption">NOTES FROM BEHIND THE CAMERA</span></div><div class="cinema-bottom"><div><h2>${e(u.heroTitle)}</h2><p>${e(u.heroBody).replace(/\n/g,'<br>')}</p><a class="primary-button" href="${href('/')}#library">${e(t('enterArchive',{n:entries.length}))}</a></div><div class="hero-slate"><small>DIRECTED & CURATED BY</small><strong>PUNKCAN</strong><span>ARCHIVE ${entries.length} / EDITION 03</span></div><div class="hero-take"><span>TAKE</span><strong>03</strong></div></div><div class="film-strip" aria-hidden="true"></div><div class="reel-notes"><span>ORIGINAL POSTS / REAL PROMPTS</span><a href="${href('/essays/')}">${e(u.navEssays)} / Punkcan ↗</a></div></section>${library(entries)}<section class="home-essays"><p class="eyebrow">02 / ESSAYS</p><h2><a href="${href('/essays/')}">${e(u.navEssays)} ↗</a></h2><p>${e(u.essayIntro)}</p></section>`;
    } else if (route==='/tips') {
      title=u.tipsTitle;description=u.tipsIntro;
      const tips = ['fight','wan3','minimax-h3'];
      const titles = [u.collection,'Wan 3.0','MiniMax H3'];
      const sections = tips.map((id,i)=>`<section id="${id}" class="tip-section" aria-label="${e(titles[i])}">${markdown(u.tipArticles[id])}<a class="back-top" href="${href('/tips')}#tips-top">${e(u.backTop)}</a></section>`).join('');
      const tools = locale==='zh' ? renderRecommendedTools(affiliates) : renderRecommendedTools(affiliates,{render:platform=>`<section class="recommended-tools"><p class="eyebrow">TOOLS / RESOURCES</p><h2>${e(u.recommended)}</h2>${/* Reuse the platform renderer without inventing a workflow promotion. */renderCardTool(platform,cUI.affiliate)}</section>`});
      body=`<header class="page-intro" id="tips-top"><p class="eyebrow">FIELD NOTES</p><h1>${e(u.tipsHeading)}</h1><p>${e(u.tipsIntro)}</p></header><nav class="tips-toc" aria-label="${e(u.tipsToc)}">${tips.map((id,i)=>`<a href="${href('/tips')}#${id}"><small>0${i+1}</small><strong>${e(titles[i])} ↘</strong></a>`).join('')}</nav><div class="tips-content">${sections}</div>${tools}`;
    } else if (route==='/takedown') {
      title=u.takedownTitle;description=u.takedownLead;
      body=`<section class="takedown-content"><p class="eyebrow">RESPECT THE CREATORS</p><h1>${e(u.takedownHeading)}</h1><p class="takedown-lead">${e(u.takedownLead)}</p><div class="takedown-steps"><span>01</span><p>${e(u.takedownStep)}</p><span>02</span><p>${e(u.takedownFooter)}</p></div>${externalLink(takedownUrl,e(u.takedownButton),'primary-button')}<p class="takedown-note">${e(u.takedownThanks)}</p><a class="text-link" href="${href('/')}">${e(u.backArchive)}</a></section>`;
    } else if (route==='/regions') {
      title=u.regionTitle;description=u.regionIntro;
      for (const item of Object.values(content.regions)) validateRegionText(JSON.stringify(item));
      body=renderRegions(regionData,locale==='zh'?undefined:{eyebrow:'OFFICIAL POLICIES',title:u.regionTitle,disclaimer:u.regionDisclaimer,intro:u.regionIntro,checkedLabel:u.checkedLabel,sourceLabel:u.sourceLabel,officialLabel:u.officialLabel,entries:content.regions});
    } else if (route==='/prompts/workflow/') {
      title=u.workflow;description=u.workflowIntro;
      body=`<header class="page-intro"><p class="eyebrow">PROCESS / WORKFLOWS</p><h1>${e(title)}</h1><p>${e(description)}</p></header>${tabs(href(route))}${workflows.length?`<div class="prompt-grid workflow-grid">${workflows.map((w,i)=>renderWorkflowCard(w,i,workflowText(w),thumbs.entries?.[w.id],cUI)).join('')}</div>`:renderWorkflowEmpty(cUI)}`;
    } else if (route.startsWith('/prompts/workflow/')) {
      const w=workflows.find(x=>route===`/prompts/workflow/${x.id}/`);const copy=workflowText(w);
      title=copy.title;description=copy.fieldNote;body=renderWorkflowDetail(w,workflows,copy,thumbs.entries?.[w.id],cUI,workflowText);
    } else if (/^\/prompts\/(video|image|music)\/$/.test(route)) {
      const medium=route.split('/')[2];title=`${names[medium]} / ${u.navPrompts}`;description=u.homeDescription;
      body=library(entries.filter(x=>(x.medium||'video')===medium),medium,true);
    } else if (route.startsWith('/prompts/')) {
      const entry=entries.find(x=>promptPath(x)===route);title=localized(entry).title;description=localized(entry).description;
      body=renderPromptDetail(localized(entry),entries,affiliates,thumbs.entries?.[entry.id],renderUI);
    } else if (route==='/essays/') {
      title=u.navEssays;description=u.essayIntro;
      const collection=essays.map(x=>x.lang===locale?x:x.translations?.[locale]||x);
      body=renderEssayList(collection,{title,intro:description,comingSoon:u.comingSoon,emptyTitle:u.essayEmptyTitle,emptyBody:u.essayEmptyBody,byline:u.byline,essayHref:slug=>href(`/essays/${slug}/`)});
    } else if (descriptor.essay) {
      const original=descriptor.essay;const essay=original.lang===locale?original:original.translations?.[locale]||original;
      title=essay.title;description=essay.summary;
      body=renderEssay(essay,{listHref:href('/essays/'),backLabel:u.essayBack,aiDisclosure:u.aiDisclosure,...(essay===original&&locale!==original.lang?{untranslatedNotice:u.untranslated}:{})});
    } else {
      const legal=u.legal[route.slice(1,-1)];title=legal.title;description=legal.summary;
      // English legal prose is carried over verbatim, with only local links scoped.
      const legalBody=legal.body.replace(/href="\/(?!\/)([^"]*)"/g,(_,tail)=>`href="${locale==='zh'?'':`/${locale}`}/${tail}"`);
      body=renderLegalPage({...legal,body:legalBody,updatedLabel:u.updated,updated:'2026-10-22',lang:HTML_LANG[locale]});
    }
    const footer=`<footer class="site-footer"><div class="footer-top"><a class="wordmark" href="${locale==='zh'?'index.html':href('/')}">PUNKCANVERSE<small>DIRECTED & CURATED BY PUNKCAN</small></a><div class="footer-links"><a href="${locale==='zh'?'takedown.html':href('/takedown')}">${e(u.takedownFooter)}</a>${externalLink('https://x.com/punkcan',e(u.author))}</div></div>${renderSiteLinks({ariaLabel:u.siteInfo,cookieLabel:u.cookieSettings,hrefFor:page=>href(page.path),labelFor:page=>u.legal[page.path.slice(1,-1)].title})}<p>${e(u.copyright)}</p><p class="affiliate-disclosure"><a href="${href('/affiliate-disclosure/')}">${e(u.affiliateDisclosure)}</a></p></footer>`;
    const canonical=SITE_URL+descriptor.canonical;
    const pageTitle=`${title} · PUNKCANVERSE`;
    const alternate=descriptor.alternates.map(lang=>`<link rel="alternate" hreflang="${HTML_LANG[lang]}" href="${SITE_URL}${publicPath(lang,route)}">`).join('\n  ')+`\n  <link rel="alternate" hreflang="x-default" href="${SITE_URL}${publicPath(descriptor.essay?.lang||'zh',route)}">`;
    const switcher=`<nav class="language-switch" aria-label="Language">${[['zh','中文'],['en','EN'],['ja','日本語']].map(([lang,label])=>`<a href="${switchHref(lang,route)}" data-language="${lang}"${lang===locale?' aria-current="page"':''} lang="${HTML_LANG[lang]}">${label}</a>`).join('')}</nav>`;
    const clientKeys=['fullVersion','embedFailed','count','toastCopied','toastFailed','dataFailed','filterFailed','unknownFilters'];
    const client=Object.fromEntries(clientKeys.map(key=>[key,u[key]]));
    let html=`<!doctype html>
<html lang="${HTML_LANG[locale]}">
<head>
<meta charset="utf-8">
${renderAnalytics()}
<meta name='impact-site-verification' value='15021707-94fc-4527-ab33-87c6066da7fd'>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<base href="/">
<title>${e(pageTitle)}</title>
<meta name="description" content="${e(description)}">
<link rel="canonical" href="${e(canonical)}">
${alternate}
<meta property="og:url" content="${e(canonical)}">
<meta property="og:title" content="${e(pageTitle)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PUNKCANVERSE">
<meta property="og:locale" content="${OG_LOCALE[locale]}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23d94c2b'/%3E%3Ctext x='14' y='48' font-size='48' font-family='sans-serif' font-weight='bold' fill='white'%3EP%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="assets/site.css">
<script type="module" src="assets/app.mjs"></script>
</head>
<body data-locale="${locale}" data-messages="${e(JSON.stringify(client))}">
<a class="skip-link" href="${e(path)}#main">${e(u.skip)}</a>
<header class="site-header"><div class="mast-top"><a class="wordmark" href="${href('/')}">PUNKCANVERSE</a><span class="issue">AN INDEPENDENT CREATIVE PRODUCTION / 2026</span>${switcher}${externalLink('https://x.com/punkcan','@punkcan ↗','author-link')}</div><nav class="primary-nav" aria-label="${e(u.mainNav)}"><a href="${href('/prompts/video/')}">${e(u.navPrompts)} <small>VIDEO / IMAGE / MUSIC</small></a><a href="${locale==='zh'?'tips.html':href('/tips')}">${e(u.navTips)}</a><a href="${href('/essays/')}">${e(u.navEssays)} <small>BY PUNKCAN</small></a><a href="${locale==='zh'?'regions.html':href('/regions')}">${e(u.navRegions)}</a></nav></header>
<aside id="language-hint" class="language-hint" hidden><a data-preferred-language></a><button type="button" data-dismiss-language aria-label="${e(u.dismiss)}">×</button></aside>
<main id="main">${body}</main>
${renderNewsletter(site)}${footer}
${renderConsentBanner({aria:u.consentAria,title:u.consentTitle,body:u.consentBody,privacy:u.privacyLabel,privacyHref:href('/privacy/'),accept:u.accept,reject:u.reject})}
<div id="toast" class="toast" role="status" aria-live="polite" aria-atomic="true"></div>
</body>
</html>\n`;
    if (route==='/regions') validateRegionText(html);
    pages.set(descriptor.file,html);
  }
  await rm(out,{recursive:true,force:true});await mkdir(join(out,'assets'),{recursive:true});
  for (const [file,html] of pages) {await mkdir(dirname(join(out,file)),{recursive:true});await writeFile(join(out,file),html);}
  const sitemapUrls=descriptors.filter(x=>x.sitemap).map(x=>SITE_URL+x.path);
  await writeFile(join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(url=>`  <url><loc>${e(url)}</loc></url>`).join('\n')}\n</urlset>\n`);
  await writeFile(join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  await writeFile(join(out,'data.json'),JSON.stringify({entries}));
  for (const file of ['app.mjs','language.mjs','clipboard.mjs','embeds.mjs','consent.mjs','site.css']) await copyFile(join(root,'web',file),join(out,'assets',file));
  await copyFile(join(root,'lib/prompts.mjs'),join(out,'assets/prompts.mjs'));await copyFile(join(root,'_headers'),join(out,'_headers'));
  // Existing build consumers use Chinese disk routes. All language descriptors are
  // exposed separately so they can inspect exact final URLs and fallback canonicals.
  return {pages:descriptors.filter(x=>x.locale==='zh').map(x=>x.disk),localizedPages:descriptors,sitemapUrls};
}
// renderAffiliates is shared with cards so codes and sponsored attributes stay identical.
import { renderAffiliates } from './lib/affiliates.mjs';
function renderCardTool(platform,ui) {return renderAffiliates({models:['recommended']},{recommended:{...platform,models:['recommended']}},ui);}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const result=await buildSite();console.log(`Built ${result.localizedPages.length} PUNKCANVERSE pages → dist/`);
}
