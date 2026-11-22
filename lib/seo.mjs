// Structured data for search engines. Punkcan is one entity across the site:
// the home page declares it and film pages point back to it by @id.
const PERSON = site => `${site}/#punkcan`;
const SAME_AS = ['https://x.com/punkcan', 'https://punkcan.art/'];

// Emitted in the body: the head allows exactly the two approved analytics scripts.
export const jsonLd = graph => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`;

export function isoDuration(seconds) {
  const s = Math.round(seconds);
  return `PT${Math.floor(s / 60)}M${s % 60}S`;
}

export const firstSentence = text => text.split(/(?<=[.。])\s*/)[0].replace(/[.。]$/, '');

const person = site => ({ '@type': 'Person', '@id': PERSON(site), name: 'Punkcan', url: `${site}/`, sameAs: SAME_AS });

export function homeGraph({ site, url, lang, description, films }) {
  return [
    { '@type': 'WebSite', '@id': `${site}/#website`, url: `${site}/`, name: 'PUNKCANVERSE', description, inLanguage: lang, publisher: { '@id': PERSON(site) } },
    person(site),
    { '@type': 'ItemList', url, itemListElement: films.map((film, i) => ({ '@type': 'ListItem', position: i + 1, name: film.name, url: film.url })) },
  ];
}

export function aboutGraph({ site, url, lang }) {
  return [{ '@type': 'ProfilePage', url, inLanguage: lang, mainEntity: person(site) }];
}

export function filmGraph({ site, url, home, homeName, lang, name, description, image, duration, youtube, published }) {
  return [
    {
      '@type': 'VideoObject', '@id': `${url}#video`, url, name, description, inLanguage: lang,
      thumbnailUrl: [image], duration: isoDuration(duration),
      embedUrl: `https://www.youtube.com/embed/${youtube}`,
      ...(published ? { uploadDate: published } : {}),
      director: { '@id': PERSON(site) }, creator: { '@type': 'Person', '@id': PERSON(site), name: 'Punkcan', url: `${site}/` },
    },
    breadcrumbList([[home, homeName], [url, name]]),
  ];
}

// A book page describes the English edition; only formats on sale carry a store link.
export function bookGraph({ site, url, series, name, subtitle, description, image, year, pages, formats }) {
  const FORMAT = { ebook: 'https://schema.org/EBook', paperback: 'https://schema.org/Paperback' };
  return [
    {
      '@type': 'Book', '@id': `${url}#book`, url, name, alternativeHeadline: subtitle, description, image, inLanguage: 'en',
      // Only a book that is on sale has been published.
      ...(formats.some(format => format.status === 'live') ? { datePublished: String(year) } : {}), ...(pages ? { numberOfPages: pages } : {}),
      author: { '@type': 'Person', '@id': PERSON(site), name: 'Punkcan', url: `${site}/` },
      isPartOf: { '@type': 'BookSeries', name: series.name, url: series.url },
      workExample: formats.filter(format => format.status === 'live').map(format => ({ '@type': 'Book', bookFormat: FORMAT[format.format], url: `https://www.amazon.com/dp/${format.asin}` })),
    },
    breadcrumbList([[series.url, series.name], [url, name]]),
  ];
}

export function breadcrumbList(levels) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: levels.map(([item, name], index) => ({
      '@type': 'ListItem', position: index + 1, name, item,
    })),
  };
}

export function noteArticle({ url, lang, title, description, date, author, site }) {
  return {
    '@type': 'BlogPosting', '@id': url + '#article',
    mainEntityOfPage: url, url, inLanguage: lang, headline: title, description,
    dateCreated: date,
    ...(author ? { author: { '@type': 'Organization', name: author, url: site + '/' } } : {}),
  };
}
