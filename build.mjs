import { notFoundHtml } from './lib/not-found.mjs';
import { selectHomeEntries } from './lib/prompts.mjs';
import {loadCatalog} from './lib/catalog.mjs';
import { readFile, mkdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { escapeHtml as e, externalLink, markdownToHtml } from './lib/markdown.mjs';
import { renderCard, renderPromptDetail } from './lib/cards.mjs';
import { validatePostMetadata } from './lib/posts.mjs';
import { validateAffiliates } from './lib/affiliates.mjs';
import { validateTools, renderToolsPage, renderToolTeasers } from './lib/tools.mjs';
import { renderNewsletter, validateSite } from './lib/newsletter.mjs';
import { renderMediumFilter, validateMedia } from './lib/media.mjs';
import { renderRegions, validateRegions, validateRegionText } from './lib/regions.mjs';
import { readThumbs } from './lib/thumbs.mjs';
import { renderMediaTabs, promptPath } from './lib/media-tabs.mjs';
import { loadEssays, renderEssay } from './lib/essays.mjs';
import { renderAnalytics, renderConsentBanner } from './lib/analytics.mjs';
import { SITE_PAGES, renderSiteLinks, renderLegalPage } from './lib/site-pages.mjs';
import { loadI18n, validateI18n, formatText, localizeEntry, translateTag, translateModelName, cardUI, workflowCopy } from './lib/i18n.mjs';
import { listPages, publicPath, switchHref, localePrefix, HTML_LANG, OG_LOCALE, DEFAULT_LOCALE } from './lib/routes.mjs';
import { validateWorkflows, renderWorkflowCard, renderWorkflowDetail, renderWorkflowEmpty } from './lib/workflows.mjs';

import { loadWorks, publishedWorks, renderWorks, renderWork } from './lib/works.mjs';
import { creatorCopy, creatorPath, notesPath, creatorLevels, creatorTrail, renderCreatorPage } from './lib/creator-pages.mjs';
import { validateOpportunities, renderOpportunities } from './lib/opportunities.mjs';
import { loadFilms, renderFilmsHome, renderFilmPage, filmFiles, filmAsset, filmPath, posterFrame } from './lib/films.mjs';
import { jsonLd, homeGraph, aboutGraph, filmGraph, bookGraph, breadcrumbList, noteArticle, firstSentence } from './lib/seo.mjs';
import { loadBooks, renderBooksIndex, renderBookPage, bookPath, bookCover, booksPath, COVER, AUTHOR } from './lib/books.mjs';

export const SITE_URL = 'https://punkcanverse.com';
export async function buildSite(options = {}) {
  const root = options.root || fileURLToPath(new URL('.', import.meta.url));
  const out = options.out || join(root,'dist');
  const readJSON = async path => JSON.parse(await readFile(join(root,path),'utf8'));
  const {original,imported,entries} = await loadCatalog(root);
  // Exact source text by id for list-card copy and full-text search, fetched on demand.
  // The content hash in the name keeps every page paired with its own map after deploys.
  const promptText=JSON.stringify(Object.fromEntries(entries.map(entry=>[entry.id,entry.prompt])));
  const promptTextPath=`assets/prompt-text.${createHash('sha256').update(promptText).digest('hex').slice(0,12)}.json`;
  const affiliates = options.affiliates || await readJSON('data/affiliates.json');
  const workflows = options.workflows ?? (await readJSON('data/workflows.json')).entries;
  const thumbs = await readThumbs(options.thumbPath || join(root,'data/thumbs.json'),readFile);
  const essays = await loadEssays(pathToFileURL((options.essayDirectory || join(root,'content/essays'))+'/'));
  const works = options.works === undefined ? await loadWorks(root) : publishedWorks({entries: options.works});
  const notes = await loadEssays(pathToFileURL(join(root, 'content/production-notes') + '/'));
  const opportunities = await readJSON('content/opportunities.json');
  validateOpportunities(opportunities);
  const films = options.films ?? await loadFilms(root);
  const bookData = options.books ?? await loadBooks(root, films);
  const books = bookData.books;
  if (/待|to be added/i.test(Object.values(bookData.series.draftTools).join(' '))) console.warn(`books: the drafting tools are still a placeholder (${bookData.series.draftTools.zh}) in content/books.json`);
  const site = await readJSON('data/site.json');
  const publishKnowledgeBase = options.publishKnowledgeBase ?? site.publishKnowledgeBase;
  const regionData = await readJSON('data/regions.json');
  const i18n = options.i18n || await loadI18n(root);
  const toolsData = await readJSON('data/tools.json');
  validateTools(toolsData,i18n.ui);
  validateMedia(entries); entries.forEach(validatePostMetadata);
  validateAffiliates(affiliates); validateSite(site); validateRegions(regionData); validateWorkflows(workflows);
  validateI18n(i18n,entries,workflows,regionData);
  const descriptors = listPages({entries,workflows,essays,works,films,books,notes,sitePages:SITE_PAGES,publishKnowledgeBase});
  const models = [...new Set(entries.flatMap(x=>x.models))];
  const tags = [...new Set(entries.flatMap(x=>x.tags))];
  const pages = new Map();
  const lastmod = new Map();
  const filmDates = films.map(film => film.published).filter(Boolean).sort();
  const takedownUrl = 'https://github.com/punkcanyang/PUNKCANVERSE/issues/new?template=takedown.md&title=%E4%B8%8B%E6%9E%B6%E7%94%B3%E8%AF%B7';
  for (const descriptor of descriptors) {
    const {locale,route,path} = descriptor;
    const u = i18n.ui[locale], content = i18n.content[locale];
    const t = (key,values) => formatText(u[key],values);
    const href = route => switchHref(locale,route);
    const publicHref = route => publicPath(locale,route);
    const localized = entry => localizeEntry(entry,locale,content);
    const cUI = cardUI(locale,u,content);
    // Every card goes through the localized UI so links carry the /zh prefix.
    const renderUI = cUI;
    const workflowText = workflow => workflowCopy(workflow,locale,content);
    const names = {video:u.video,image:u.image,music:u.music};
    const tabs = current => renderMediaTabs(entries,current,{names,ariaLabel:u.mediaAria,mediumHref:medium=>href(`/prompts/${medium}/`),workflow:{href:href('/prompts/workflow/'),label:u.workflow,count:workflows.length}});
    const markdown = text => markdownToHtml(text,{headingOffset:1,copyLabel:u.copy,codeLabel:u.codeExample,tableLabel:u.tableAria}).replace(/>复制<\/button>/g,`>${e(u.copy)}</button>`);
    function library(collection,medium='video',collectionPage=false) {
      const tabBar = tabs(href(`/prompts/${medium}/`));
      const heading = route==='/prompts/fight/' ? u.collection : `${names[medium]} / ${u.navPrompts}`;
      const intro = `<header class="page-intro library-intro"><h1>${e(heading)}</h1><p>${e(u.archiveIntro)}</p></header>`;
      if (!collection.length) return `${intro}${tabBar}<section class="empty-state"><h2>${e(t('mediaEmpty',{medium:names[medium]}))}</h2><p>${e(u.mediaEmptyBody)}</p><a class="text-link" href="${href('/prompts/video/')}">${e(u.browseVideo)}</a></section>`;
      const collectionModels = [...new Set(collection.flatMap(entry=>entry.models))];
      const collectionTags = [...new Set(collection.flatMap(entry=>entry.tags))];
      const modelLabel = value => value==='Wan' ? 'Wan / Wan 3.0' : value==='MiniMax' ? 'MiniMax H3' : translateModelName(value,locale);
      const choices = (values,kind) => values.map(value=>`<label class="filter-chip"><input type="checkbox" name="${kind}" value="${e(value)}"><span>${e(kind==='tag' ? translateTag(value,locale,content) : modelLabel(value))}</span></label>`).join('');
      return `${intro}<section class="library" id="library">${tabBar}<div class="collection-line"><a href="${href('/prompts/fight/')}"><strong>FIGHT/PROMPTS</strong> · ${e(u.collection)} (63)</a><span>${e(route==='/prompts/fight/'?u.collection:u.allVideos)} / ${e(names[medium])}</span></div>
      <form id="filters" data-default-medium="${medium}"${route==='/prompts/fight/'?' data-collection="fight"':''}>
        <div class="search-toolbar"><div class="search-field"><label for="prompt-search">${e(u.searchLabel)}</label><div class="search-input-row"><input id="prompt-search" type="search" name="q" placeholder="${e(u.searchPlaceholder)}" disabled><button id="search-submit" type="submit" class="primary-button" disabled>${e(u.searchButton)}</button></div></div><div class="sort-field"><label for="prompt-sort">${e(u.sortLabel)}</label><select id="prompt-sort" name="sort" disabled><option value="">${e(u.sortDefault)}</option><option value="featured">${e(u.sortFeatured)}</option><option value="latest">${e(u.sortLatest)}</option></select></div></div>
        <details class="filter-panel"><summary>${e(u.filter)} <span>${e(u.modelLabel)} / ${e(u.tagLabel)}</span></summary>${renderMediumFilter(entries)}<fieldset disabled><legend>${e(u.modelLabel)}</legend><div class="filter-options">${choices(collectionModels,'model')}</div></fieldset><fieldset disabled><legend>${e(u.tagLabel)}</legend><div class="filter-options">${choices(collectionTags,'tag')}</div></fieldset><p class="filter-help">${e(u.filterHelp)}</p></details>
        <div class="filter-bottom"><p id="result-count" role="status" aria-live="polite">${e(t('count',{n:collection.length}))}</p><button id="clear-filters" class="clear-button" type="button" disabled>${e(u.clear)}</button></div><div id="active-filters" class="active-filters" role="group" aria-label="${e(u.activeFilters)}" hidden></div><p id="unknown-filters" class="notice" hidden></p>
      </form><noscript><p class="notice">${e(u.noscript)}</p></noscript><div id="prompt-grid" class="prompt-grid">${collection.map((entry,index)=>renderCard(localized(entry),index,affiliates,thumbs.entries?.[entry.id],entry.collection==='wan-minimax'?cUI:renderUI)).join('\n')}</div><button type="button" id="show-more" class="primary-button" hidden>${e(u.showMore)}</button><div id="empty-state" class="empty-state" hidden><h2>${e(u.emptyTitle)}</h2><p>${e(u.emptyBody)}</p><button type="button" class="primary-button" data-clear-filters>${e(u.clear)}</button></div></section>`;
    }
    function homeSearch() {
      return `<form class="home-search" action="${href('/prompts/video/')}" method="get" role="search"><label for="home-search">${e(u.searchLabel)}</label><div class="search-input-row"><input id="home-search" name="q" type="search" placeholder="${e(u.searchPlaceholder)}"><button class="primary-button" type="submit">${e(u.searchButton)}</button></div><p>${e(u.homeSearchHint)}</p></form>`;
    }
    function homePicks() {
      const picks=selectHomeEntries(entries);
      return `<section class="home-picks" id="library" data-archive-url="${href('/prompts/video/')}"><div class="section-heading"><div><p class="eyebrow">01 / SELECTED PROMPTS</p><h2>${e(u.featuredTitle)}</h2><p>${e(u.featuredIntro)}</p></div><a class="text-link" href="${href('/prompts/workflow/')}">${e(u.workflow)} (${workflows.length}) ↗</a></div><div class="prompt-grid">${picks.map((entry,index)=>renderCard(localized(entry),index,affiliates,thumbs.entries?.[entry.id],entry.collection==='wan-minimax'?cUI:renderUI)).join('')}</div><a class="primary-button browse-all" href="${href('/prompts/video/')}">${e(t('browseAll',{n:entries.length}))} ↗</a></section>`;
    }
    let title,description,body;
    // Search and sharing defaults; film pages replace them with their own frame and data.
    let pageTitle,graph=null,ogType='website';
    let share={src:'/img/site/share.png',width:1200,height:630,alt:publishKnowledgeBase ? 'PUNKCANVERSE — prompts, workflows and personal work' : u.films.homeTitle};
    const canonical=SITE_URL+descriptor.canonical;
    // Redesign: the home page and film pages use the film layout; other pages keep the archive layout.
    const opportunity = route === '/cpp/' || route === '/competitions/';
    const creatorPage = route === creatorPath || route.startsWith(notesPath);
    const creator = creatorCopy[locale];
    const filmPages = (route==='/' && films.length>0) || Boolean(descriptor.film);
    // With the archive unpublished, every page shares the film layout so the site reads as one place.
    const bookPages = descriptor.bookIndex || Boolean(descriptor.book);
    const filmLayout = !publishKnowledgeBase || opportunity || creatorPage || filmPages || bookPages;
    if (opportunity || creatorPage) {
      const note = descriptor.note;
      const localNote = note && (note.lang === locale ? note : note.translations[locale]);
      const levels = creatorLevels(locale, route, localNote?.title);
      const trail = levels.length > 1 ? creatorTrail(locale, href, levels) : '';
      if (levels.length > 1) {
        graph = [breadcrumbList(levels.map(([path, name]) => [SITE_URL + publicHref(path), name]))];
      }
      if (opportunity) {
        ({title, description, body} = renderOpportunities(opportunities, route.slice(1,-1), locale));
        body = trail + body;
        lastmod.set(path, opportunities.reviewed[route.slice(1,-1)]);
      } else {
        const creator = renderCreatorPage({ route, locale, href, notes, note, affiliates, affiliateUI: cUI.affiliate, trail });
        ({title, description, body} = creator);
        lastmod.set(path, creator.lastModified);
        if (note) {
          ogType = 'article';
          graph.push(noteArticle({ url: canonical, lang: HTML_LANG[locale], title, description,
            date: note.date, author: note.editorialCredit, site: SITE_URL }));
        }
      }
    } else if (route==='/' && films.length) {
      title=u.films.homeTitle;description=u.films.homeDescription;
      body=renderFilmsHome(films,locale,u.films,href,publishKnowledgeBase ? href('/prompts/video/') : null);
      graph=homeGraph({site:SITE_URL,url:canonical,lang:HTML_LANG[locale],description,films:films.map(film=>({name:film.title[locale],url:SITE_URL+publicPath(locale,filmPath(film))}))});
      if (filmDates.length) lastmod.set(descriptor.path, filmDates.at(-1));
    } else if (descriptor.bookIndex) {
      title=bookData.series.title[locale];description=bookData.series.intro[locale][0];
      pageTitle=`${title} · ${AUTHOR} · PUNKCANVERSE`;
      body=renderBooksIndex(bookData,locale,u.books,href);
      graph=[breadcrumbList([[SITE_URL+publicPath(locale,'/'),u.films.nav],[canonical,title]]),{'@type':'ItemList',url:canonical,itemListElement:books.map((book,i)=>({'@type':'ListItem',position:i+1,name:book.title.en,url:SITE_URL+publicPath(locale,bookPath(book))}))}];
    } else if (descriptor.book) {
      const book=descriptor.book;
      title=`${book.title.en}: ${book.subtitle.en}`;description=book.intro[locale][0];
      pageTitle=`${book.title.en} · ${AUTHOR} · ${bookData.series.title[locale]}`;
      ogType='book';
      share={src:bookCover(book),width:COVER.width,height:COVER.height,alt:u.books.coverOf.replace('{title}',book.title.en)};
      graph=bookGraph({site:SITE_URL,url:canonical,series:{name:bookData.series.title[locale],url:SITE_URL+publicPath(locale,booksPath)},name:book.title.en,subtitle:book.subtitle.en,description,image:SITE_URL+share.src,year:book.year,pages:book.pages,formats:book.formats});
      body=renderBookPage(book,bookData,locale,u.books,href,films);
    } else if (descriptor.film) {
      const film=descriptor.film;
      title=film.subtitle?`${film.title[locale]}${locale==='en'?': ':'：'}${film.subtitle[locale]}`:film.title[locale];
      description=`${film.kind[locale]} ${film.notes[locale][0]}`;
      // Title, what it is, who made it: the three things someone searching for the film types.
      pageTitle=`${title} · ${firstSentence(film.kind[locale])} · Punkcan`;
      const poster=posterFrame(film);
      ogType='video.other';
      share={src:filmAsset(film,poster.src),width:film.data.width,height:film.data.height,alt:u.films.stillOf.replace('{title}',film.title[locale])};
      graph=filmGraph({site:SITE_URL,url:canonical,home:SITE_URL+publicPath(locale,'/'),homeName:u.films.nav,lang:HTML_LANG[locale],name:title,description,image:SITE_URL+share.src,duration:film.data.duration,youtube:film.youtube[locale],published:film.published});
      if (film.published) lastmod.set(descriptor.path, film.published);
      const related=books.filter(book=>book.film===film.slug).map(book=>({href:href(bookPath(book)),title:book.title.en}));
      body=renderFilmPage(film,films,locale,u.films,href,related,u.books.relatedBook);
    } else if (route==='/' && !publishKnowledgeBase) {
      title=u.films.homeTitle;description=u.films.homeDescription;
      body=`<h1>${e(title)}</h1>`;
    } else if (route==='/') {
      title='AI VIDEO / IMAGE / MUSIC';description=u.homeDescription;
      // The H film-slate artwork keeps its original 003 edition number.
      body=`<section class="cinema-hero"><div class="hero-topline"><span>AI VIDEO / IMAGE / MUSIC</span><span>PRODUCTION No. 003 — OCT. 2026</span></div><div class="cinema-title"><h1 aria-label="PUNKCANVERSE"><span>PUNKCAN</span><span><b class="cut-letter">V</b>ERSE<span class="title-dot">.</span></span></h1><aside class="copy-mark"><span>NIGHT SHIFT</span><strong>COPY<br>003</strong><svg class="safety-pin" viewBox="0 0 180 60" fill="none" aria-hidden="true"><path d="M33 16C10-1 0 32 19 42c10 6 19 1 20-9L145 8c18-4 27 7 20 20L53 49 33 16Z" stroke="currentColor" stroke-width="4"/></svg><small>notes from the set</small></aside><span class="vertical-caption">NOTES FROM BEHIND THE CAMERA</span></div><div class="cinema-bottom"><div><h2>${e(u.heroTitle)}</h2><p>${e(u.heroBody).replace(/\n/g,'<br>')}</p>${homeSearch()}<a class="text-link" href="${href('/prompts/video/')}">${e(t('browseAll',{n:entries.length}))} ↗</a></div><div class="hero-slate"><small>DIRECTED & CURATED BY</small><strong>PUNKCAN</strong><span>ARCHIVE ${entries.length} / EDITION 03</span></div><div class="hero-take"><span>TAKE</span><strong>03</strong></div></div><div class="film-strip" aria-hidden="true"></div><div class="reel-notes"><span>ORIGINAL POSTS / REAL PROMPTS</span><a href="${href('/works/')}">${e(u.works.title)} / Punkcan ↗</a></div></section>${homePicks()}<section class="home-works"><p class="eyebrow">02 / WORKS</p><h2><a href="${href('/works/')}">${e(u.works.title)} ↗</a></h2><p>${e(u.works.intro)}</p></section>`;
    } else if (route==='/tips') {
      title=u.tipsTitle;description=u.tipsIntro;
      const tips = ['fight','wan3','minimax-h3'];
      const titles = [u.collection,'Wan 3.0','MiniMax H3'];
      const sections = tips.map((id,i)=>`<section id="${id}" class="tip-section" aria-label="${e(titles[i])}">${markdown(u.tipArticles[id])}<a class="back-top" href="${href('/tips')}#tips-top">${e(u.backTop)}</a></section>`).join('');
      const tools = renderToolTeasers(toolsData,locale,{...u.tools,title:u.recommended});
      body=`<header class="page-intro" id="tips-top"><p class="eyebrow">FIELD NOTES</p><h1>${e(u.tipsHeading)}</h1><p>${e(u.tipsIntro)}</p></header><nav class="tips-toc" aria-label="${e(u.tipsToc)}">${tips.map((id,i)=>`<a href="${href('/tips')}#${id}"><small>0${i+1}</small><strong>${e(titles[i])} ↘</strong></a>`).join('')}</nav><div class="tips-content">${sections}</div>${tools}`;
    } else if (route==='/tools') {
      title=u.tools.title;description=u.tools.intro;
      body=renderToolsPage(toolsData,affiliates,locale,{...u.tools,quickNav:u.quickNav},cUI.affiliate);
    } else if (route==='/takedown') {
      title=u.takedownTitle;description=u.takedownLead;
      body=`<section class="takedown-content"><p class="eyebrow">RESPECT THE CREATORS</p><h1>${e(u.takedownHeading)}</h1><p class="takedown-lead">${e(u.takedownLead)}</p><div class="takedown-steps"><span>01</span><p>${e(u.takedownStep)}</p><span>02</span><p>${e(u.takedownFooter)}</p></div>${externalLink(takedownUrl,e(u.takedownButton),'primary-button')}<p class="takedown-note">${e(u.takedownThanks)}</p><a class="text-link" href="${href('/')}">${e(publishKnowledgeBase ? u.backArchive : u.films.allFilms)}</a></section>`;
    } else if (route==='/regions') {
      title=u.regionTitle;description=u.regionIntro;
      for (const item of Object.values(content.regions)) validateRegionText(JSON.stringify(item));
      body=renderRegions(regionData,{eyebrow:'OFFICIAL POLICIES',title:u.regionTitle,disclaimer:u.regionDisclaimer,intro:u.regionIntro,checkedLabel:u.checkedLabel,sourceLabel:u.sourceLabel,officialLabel:u.officialLabel,entries:content.regions});
    } else if (route==='/prompts/workflow/') {
      title=u.workflow;description=u.workflowIntro;
      body=`<header class="page-intro"><p class="eyebrow">PROCESS / WORKFLOWS</p><h1>${e(title)}</h1><p>${e(description)}</p></header>${tabs(href(route))}${workflows.length?`<div class="prompt-grid workflow-grid">${workflows.map((w,i)=>renderWorkflowCard(w,i,workflowText(w),thumbs.entries?.[w.id],cUI)).join('')}</div>`:renderWorkflowEmpty(cUI)}`;
    } else if (route.startsWith('/prompts/workflow/')) {
      const w=workflows.find(x=>route===`/prompts/workflow/${x.id}/`);const copy=workflowText(w);
      title=copy.title;description=copy.fieldNote;body=renderWorkflowDetail(w,workflows,copy,thumbs.entries?.[w.id],cUI,workflowText);
    } else if (route==='/prompts/fight/') {
      title=u.collection;description=u.fightDescription;body=library(original.entries,'video',true);
    } else if (/^\/prompts\/(video|image|music)\/$/.test(route)) {
      const medium=route.split('/')[2];title=`${names[medium]} / ${u.navPrompts}`;description=u.homeDescription;
      body=library(entries.filter(x=>(x.medium||'video')===medium),medium,true);
    } else if (route.startsWith('/prompts/')) {
      const entry=entries.find(x=>promptPath(x)===route);title=localized(entry).title;description=localized(entry).description;
      body=renderPromptDetail(localized(entry),entries,affiliates,thumbs.entries?.[entry.id],entry.collection==='wan-minimax'?cUI:renderUI);
    } else if (route==='/works/') {
      title=u.works.title;description=u.works.intro;
      body=renderWorks(works,locale,u.works,href,publishKnowledgeBase ? undefined : {path:'/',label:u.films.allFilms});
    } else if (descriptor.work) {
      title=descriptor.work.copy[locale].title;description=descriptor.work.copy[locale].summary;
      body=renderWork(descriptor.work,locale,u.works,href);
    } else if (descriptor.essay) {
      const original=descriptor.essay;const essay=original.lang===locale?original:original.translations?.[locale]||original;
      title=essay.title;description=essay.summary;
      body=renderEssay(essay,{listHref:href('/works/'),backLabel:u.works.back,aiDisclosure:u.aiDisclosure,...(essay===original&&locale!==original.lang?{untranslatedNotice:u.untranslated}:{})});
    } else {
      const legal=u.legal[route.slice(1,-1)];title=legal.title;description=legal.summary;
      // English legal prose is carried over verbatim, with only local links scoped.
      // Links here are written without a language prefix; the rewrite below adds it.
      const articleBody = !publishKnowledgeBase && route === '/about/'
        ? `<p>${e(u.films.homeDescription)}</p><h2>${e(u.films.nav)}</h2><ul class="plain-list">${films.map(film=>`<li><a href="${filmPath(film)}">${e(film.title[locale])}</a> <span>${film.year} · ${e(firstSentence(film.kind[locale]))}</span></li>`).join('')}</ul><h2>${e(u.films.elsewhere)}</h2><ul class="plain-list"><li>${externalLink('https://x.com/punkcan','X @punkcan')}</li><li>${externalLink('https://punkcan.art/','punkcan.art')} <span>${e(u.films.artArchive)}</span></li><li><a href="mailto:hello@punkcanverse.com">hello@punkcanverse.com</a></li></ul>`
        : legal.body;
      if (!publishKnowledgeBase && route === '/about/') graph=aboutGraph({site:SITE_URL,url:canonical,lang:HTML_LANG[locale]});
      const legalBody=articleBody.replace(/href="\/(?!\/)([^"]*)"/g,(_,tail)=>`href="${localePrefix(locale)}/${tail}"`);
      body=renderLegalPage({...legal,body:legalBody,updatedLabel:u.updated,updated:!publishKnowledgeBase && route==='/about/' ? '2026-11-09' : '2026-10-22',lang:HTML_LANG[locale]});
    }
    const footer=`<footer class="site-footer"><div class="footer-top"><a class="wordmark" href="${href('/')}">PUNKCANVERSE<small>DIRECTED & CURATED BY PUNKCAN</small></a><div class="footer-links"><a href="${href('/takedown')}">${e(u.takedownFooter)}</a>${externalLink('https://x.com/punkcan',e(u.author))}</div></div>${renderSiteLinks({ariaLabel:u.siteInfo,cookieLabel:u.cookieSettings,hrefFor:page=>href(page.path),labelFor:page=>u.legal[page.path.slice(1,-1)].title})}${publishKnowledgeBase ? `<p>${e(u.copyright)}</p>` : ''}${publishKnowledgeBase ? `<p class="affiliate-disclosure"><a href="${href('/affiliate-disclosure/')}">${e(u.affiliateDisclosure)}</a></p>` : ''}</footer>`;
    pageTitle??=`${title} · PUNKCANVERSE`;
    const alternate=descriptor.alternates.map(lang=>`<link rel="alternate" hreflang="${HTML_LANG[lang]}" href="${SITE_URL}${publicPath(lang,route)}">`).join('\n  ')+`\n  <link rel="alternate" hreflang="x-default" href="${SITE_URL}${publicPath(descriptor.alternates.includes(DEFAULT_LOCALE)?DEFAULT_LOCALE:descriptor.alternates[0],route)}">`;
    const switcher=`<nav class="language-switch" aria-label="Language">${[['en','EN'],['zh','中文']].filter(([lang])=>!descriptor.note || descriptor.alternates.includes(lang)).map(([lang,label])=>`<a href="${switchHref(lang,route)}" data-language="${lang}"${lang===locale?' aria-current="page"':''} lang="${HTML_LANG[lang]}">${label}</a>`).join('')}</nav>`;
    const clientKeys=['fullVersion','embedFailed','count','toastCopied','toastFailed','dataFailed','filterFailed','unknownFilters','copyDone','copyRetry','expandPrompt','collapsePrompt','removeFilter','scrollTable','moreCount'];
    const client=Object.fromEntries(clientKeys.map(key=>[key,u[key]]));
    const navCurrent = target => (target==='prompts' ? route.startsWith('/prompts/') : route.startsWith(target)) ? ' aria-current="page"' : '';
    const creatorCurrent = route === creatorPath ? ' aria-current="page"' : creatorPage || opportunity ? ' aria-current="location"' : '';
    const creatorNav = `<a href="${href(creatorPath)}"${creatorCurrent}>${e(creator.hub)}</a>`;
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
<link rel="canonical" href="${e(canonical)}">${descriptor.noindex?'\n<meta name="robots" content="noindex">':''}
${alternate}
<meta property="og:url" content="${e(canonical)}">
<meta property="og:title" content="${e(pageTitle)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="PUNKCANVERSE">
<meta property="og:locale" content="${OG_LOCALE[locale]}">
<meta name="twitter:card" content="summary_large_image">
<meta property="og:image" content="${SITE_URL}${share.src}">
<meta property="og:image:width" content="${share.width}">
<meta property="og:image:height" content="${share.height}">
<meta property="og:image:alt" content="${e(share.alt)}">
<meta name="twitter:image" content="${SITE_URL}${share.src}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23d94c2b'/%3E%3Ctext x='14' y='48' font-size='48' font-family='sans-serif' font-weight='bold' fill='white'%3EP%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="assets/site.css">${filmLayout?'\n<link rel="stylesheet" href="assets/films.css">':''}
<script type="module" src="assets/${publishKnowledgeBase ? 'app' : 'portfolio'}.mjs"></script>${opportunity?'\n<script type="module" src="assets/opportunity-status.mjs"></script>':filmPages?'\n<script type="module" src="assets/films.mjs"></script>':''}
</head>
<body${filmLayout?' class="film-layout"':''} data-locale="${locale}" ${publishKnowledgeBase ? `data-prompt-text="${promptTextPath}"` : ''} data-messages="${e(JSON.stringify(client))}">
<a class="skip-link" href="${e(path)}#main">${e(u.skip)}</a>
${filmLayout?`<header class="film-top"><a class="film-mark" href="${href('/')}">Punkcanverse</a><nav class="film-nav" aria-label="${e(u.mainNav)}"><a href="${href('/')}"${route==='/'||descriptor.film?' aria-current="page"':''}>${e(u.films.nav)}</a>${books.length?`<a href="${href(booksPath)}"${descriptor.bookIndex?' aria-current="page"':descriptor.book?' aria-current="location"':''}>${e(u.books.nav)}</a>`:''}${works.length?`<a href="${href('/works/')}"${route.startsWith('/works/')?' aria-current="page"':''}>${e(u.works.title)}</a>`:''}${creatorNav}<a href="${href('/about/')}"${route==='/about/'?' aria-current="page"':''}>${e(u.films.about)}</a></nav>${switcher}</header>`:`<header class="site-header"><div class="mast-top"><a class="wordmark" href="${href('/')}">PUNKCANVERSE</a><span class="issue">AN INDEPENDENT CREATIVE PRODUCTION / 2026</span>${switcher}${externalLink('https://x.com/punkcan','@punkcan ↗','author-link')}</div><nav class="primary-nav" aria-label="${e(u.mainNav)}"${route.startsWith('/works/')?' data-section="works"':''}>${publishKnowledgeBase ? `<a href="${href('/prompts/video/')}"${navCurrent('prompts')}>${e(u.navPrompts)} <small>VIDEO / IMAGE / MUSIC</small></a><a href="${href('/tips')}"${navCurrent('/tips')}>${e(u.navTips)}</a><a href="${publicHref('/tools')}"${navCurrent('/tools')}>${e(u.navTools)}</a><a href="${href('/works/')}"${route.startsWith('/works/')?' aria-current="page"':''}>${e(u.works.title)} <small>BY PUNKCAN</small></a><a href="${href('/regions')}"${navCurrent('/regions')}>${e(u.navRegions)}</a>` : `<a href="${href('/')}">${e(u.films.nav)}</a><a href="${href('/works/')}">${e(u.works.title)}</a>${creatorNav}<a href="${href('/about/')}">${e(u.films.about)}</a>`}</nav></header>`}
<aside id="language-hint" class="language-hint" hidden><a data-preferred-language></a><button type="button" data-dismiss-language aria-label="${e(u.dismiss)}">×</button></aside>
<main id="main">${body}</main>${graph?'\n'+jsonLd(graph):''}
${publishKnowledgeBase ? renderNewsletter(site) : ''}${footer}
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
  await writeFile(join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${descriptors.filter(x=>x.sitemap).map(x=>`  <url><loc>${e(SITE_URL+x.path)}</loc>${lastmod.has(x.path)?`<lastmod>${lastmod.get(x.path)}</lastmod>`:''}</url>`).join('\n')}\n</urlset>\n`);
  await writeFile(join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  if (publishKnowledgeBase) {
    await writeFile(join(out,'data.json'),JSON.stringify({entries:original.entries}));
    await writeFile(join(out,'catalog.json'),JSON.stringify({entries}));
    await writeFile(join(out,promptTextPath),promptText);
  } else {
    await writeFile(join(out,'404.html'),notFoundHtml);
  }
  const clientFiles = ['language.mjs','consent.mjs','site.css','films.css','films.mjs','opportunity-status.mjs'];
  if (publishKnowledgeBase) clientFiles.push('app.mjs','clipboard.mjs','embeds.mjs');
  else clientFiles.push('portfolio.mjs');
  for (const file of clientFiles) await copyFile(join(root,'web',file),join(out,'assets',file));
  if (publishKnowledgeBase) await copyFile(join(root,'lib/prompts.mjs'),join(out,'assets/prompts.mjs'));
  await copyFile(join(root,'_headers'),join(out,'_headers'));
  for (const entry of entries.filter(entry=>publishKnowledgeBase && entry.source==='official' && entry.officialThumb)) {
    const file=entry.officialThumb.src.slice(1);
    await mkdir(dirname(join(out,file)),{recursive:true});
    await copyFile(join(root,'web',file),join(out,file));
  }
  for (const film of films) {
    await mkdir(join(out,'img/films',film.slug),{recursive:true});
    for (const file of filmFiles(film)) await copyFile(join(root,'web/img/films',film.slug,file),join(out,'img/films',film.slug,file));
  }
  for (const book of books) {
    await mkdir(join(out,'img/books',book.slug),{recursive:true});
    await copyFile(join(root,'web/img/books',book.slug,'cover.webp'),join(out,'img/books',book.slug,'cover.webp'));
  }
  await mkdir(join(out,'img/site'),{recursive:true});
  await copyFile(join(root,'web/img/site/share.png'),join(out,'img/site/share.png'));
  // `pages` lists the root-locale (English) disk routes. All language descriptors are
  // exposed separately so they can inspect exact final URLs and fallback canonicals.
  return {promptTextPath:publishKnowledgeBase ? promptTextPath : null,pages:descriptors.filter(x=>x.locale===DEFAULT_LOCALE).map(x=>x.disk),localizedPages:descriptors,sitemapUrls};
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const result=await buildSite();console.log(`Built ${result.localizedPages.length} PUNKCANVERSE pages → dist/`);
}
