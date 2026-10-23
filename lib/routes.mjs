export const LOCALES = ['zh', 'en', 'ja'];
export const HTML_LANG = { zh: 'zh-CN', en: 'en', ja: 'ja' };
export const OG_LOCALE = { zh: 'zh_CN', en: 'en_US', ja: 'ja_JP' };
const FILE_LEAVES = new Set(['tips', 'takedown', 'regions', 'tools']);

export function publicPath(locale, route) {
  const prefix = locale === 'zh' ? '' : `/${locale}`;
  if (route === '/') return prefix ? `${prefix}/` : '/';
  return `${prefix}${route}`;
}

export function diskPath(locale, route) {
  const prefix = locale === 'zh' ? '' : `/${locale}`;
  if (route === '/') return prefix ? `${prefix}/` : '/';
  const leaf = route.replace(/^\/|\/$/g, '');
  if (FILE_LEAVES.has(leaf)) return `${prefix}${route.replace(/\/$/, '')}.html`;
  return `${prefix}${route.endsWith('/') ? route : `${route}/`}`;
}

export function distFile(disk) {
  if (disk === '/') return 'index.html';
  const rel = disk.replace(/^\//, '');
  return rel.endsWith('.html') ? rel : `${rel}index.html`;
}

export function fileForPublic(path) {
  const locale = path === '/en' || path.startsWith('/en/') ? 'en' : path === '/ja' || path.startsWith('/ja/') ? 'ja' : 'zh';
  let route = locale === 'zh' ? path : path.slice(locale.length + 1);
  if (!route) route = '/';
  if (!route.startsWith('/')) route = `/${route}`;
  return distFile(diskPath(locale, route));
}

export function switchHref(locale, route) {
  const file = distFile(diskPath(locale, route));
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`;
  return `/${file}`;
}

function essayLocales(essay) {
  const locales = [essay.lang || 'zh'];
  for (const locale of ['en', 'ja']) if (essay.translations?.[locale] && !locales.includes(locale)) locales.push(locale);
  return locales;
}

export function listPages({ entries, workflows, essays, works = [], sitePages }) {
  const routes = [
    { route: '/', sitemap: true },
    { route: '/tips', sitemap: true },
    { route: '/tools', sitemap: true },
    { route: '/takedown', sitemap: true },
    { route: '/regions', sitemap: true },
  ];
  for (const medium of ['video', 'image', 'music']) {
    const has = entries.some(entry => (entry.medium || 'video') === medium);
    routes.push({ route: `/prompts/${medium}/`, sitemap: has });
  }
  routes.push({route:'/prompts/fight/',sitemap:true});
  for (const entry of entries) routes.push({ route: `/prompts/${entry.medium || 'video'}/${entry.id}/`, sitemap: true });
  routes.push({ route: '/prompts/workflow/', sitemap: workflows.length > 0 });
  for (const workflow of workflows) routes.push({ route: `/prompts/workflow/${workflow.id}/`, sitemap: workflows.length > 0 });
  routes.push({ route: '/works/', sitemap: true });
  // Keep old incoming links readable; only /works/ is canonical and indexed.
  routes.push({ route: '/works/', alias: '/essays/', sitemap: false });
  for (const work of works) routes.push({ route: `/works/${work.slug}/`, sitemap: true, work });
  for (const essay of essays) routes.push({ route: `/essays/${essay.slug}/`, sitemap: true, essay });
  for (const page of sitePages) routes.push({ route: page.path, sitemap: true });

  const pages = [];
  for (const locale of LOCALES) {
    for (const item of routes) {
      const path = publicPath(locale, item.alias || item.route);
      const disk = diskPath(locale, item.alias || item.route);
      const available = item.essay ? essayLocales(item.essay) : LOCALES;
      const canonical = item.essay && !available.includes(locale) ? publicPath(item.essay.lang || 'zh', item.route) : publicPath(locale, item.route);
      pages.push({
        locale,
        route: item.route,
        path,
        disk,
        file: distFile(disk),
        canonical,
        sitemap: item.sitemap && available.includes(locale),
        alternates: available,
        essay: item.essay || null,
        work: item.work || null,
      });
    }
  }
  return pages;
}
