import { escapeHtml as e, externalLink, safeUrl } from './markdown.mjs';
import { closesAt } from '../web/opportunity-status.mjs';

const sections = ['cpp', 'competitions'];
const terms = {
  en: {cpp:'AI creator partner programs', competitions:'AI competitions & open calls', cppTitle:'AI creator partner programs (CPP): {n} listings', competitionsTitle:'AI film competitions & open calls: {n} listings', cppDescription:'Browse {n} AI creator partner programs, with application requirements, partner benefits and official application links. Last reviewed {date}.', competitionsDescription:'Browse {n} AI film and art competitions and open calls. Check submission deadlines, entry fees, awards and official rules. Last reviewed {date}.', added:'Date added', more:'More conditions', host:'Organiser', reviewed:'Updated regularly · Last reviewed', closed:'Closed', deadline:'Deadline', early:'Early deadline', regular:'Regular deadline', late:'Late deadline', final:'Final deadline', benefits:'Partner benefits', prize:'Awards', fee:'Entry fee', noDate:'No fixed deadline listed', taipei:'Taipei', source:'organiser', cppLink:'Official program & application', competitionsLink:'Official rules & entry', order:'Newest additions first', dates:'A date without a time is shown as published by the organiser.'},
  zh: {cpp:'AI 創作者合作計畫', competitions:'AI 比賽與徵件', cppTitle:'AI 創作者合作計畫（CPP）：{n} 項', competitionsTitle:'AI 影片比賽與徵件：{n} 項', cppDescription:'整理 {n} 項 AI 創作者合作計畫（CPP），各項列出申請條件、入選回饋與官方申請連結。主辦方有公布截止日期的計畫，也可以在清單裡查到期限。最近整理於 {date}。', competitionsDescription:'收錄 {n} 項 AI 影片與生成藝術比賽、影展及公開徵件，依收錄日期由新到舊排列。各項列出投稿期限、報名費與獎項，並附主辦方的簡章或報名連結。最近整理於 {date}。', added:'收錄日期', more:'更多條件', host:'主辦方', reviewed:'持續更新 · 清單整理日期', closed:'已截止', deadline:'截止日期', early:'早鳥截止', regular:'一般截止', late:'晚鳥截止', final:'最終截止', benefits:'入選回饋', prize:'獎項', fee:'報名費', noDate:'未列固定截止日期', taipei:'台北', source:'主辦方', cppLink:'官方計畫與申請', competitionsLink:'官方簡章與報名', order:'依首次收錄日期，由新到舊', dates:'未列時刻的期限，保留主辦方公布的日期。'}
};

const dateOnly = /^\d{4}-\d\d-\d\d$/;
function validDate(at) {
  if (!dateOnly.test(at)) return false;
  const d = new Date(at);
  return Number.isFinite(+d) && d.toISOString().slice(0,10) === at;
}
export function validateOpportunities({reviewed, entries}) {
  if (sections.some(section => !validDate(reviewed?.[section])) || !Array.isArray(entries)) throw Error('Invalid opportunity directory');
  const seen = new Set();
  for (const row of entries) {
    const key = row.section + ':' + row.en.name;
    if (seen.has(key) || !sections.includes(row.section) || !validDate(row.added) || row.added > reviewed[row.section] ||
        !row.host?.trim() || !safeUrl(row.source) || !row.source.startsWith('https://') ||
        /(^|\.)notion\.(so|com|site)$/.test(new URL(row.source).hostname)) throw Error('Invalid opportunity: ' + key);
    seen.add(key);
    for (const locale of ['en','zh']) {
      for (const field of ['name','summary','reward','details',...(row.section === 'competitions' ? ['fee'] : [])]) {
        if (!row[locale]?.[field]?.trim()) throw Error('Missing '+locale+' '+field+' for '+key);
      }
    }
    let previous = -Infinity;
    for (const {stage, at} of row.deadlines) {
      if (!['deadline','early','regular','late','final'].includes(stage) ||
          !(validDate(at) || (/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/.test(at) && validDate(at.slice(0,10)))) ||
          !(closesAt(at) > previous)) throw Error('Invalid deadline for ' + key);
      previous = closesAt(at);
    }
  }
}

function deadlineTime(at, t) {
  if (dateOnly.test(at)) return e(at);
  const seconds = at.slice(17,19) !== '00';
  const length = seconds ? 19 : 16;
  const taipei = new Date(Date.parse(at) + 8 * 3600000).toISOString().slice(0,length).replace('T',' ');
  const local = at.slice(0,length).replace('T',' ');
  return e(taipei+' ('+t.taipei+') · '+local+' (UTC'+at.slice(-6)+', '+t.source+')');
}

// A stable fragment for each listing, taken from its English name, so one entry can be linked directly.
const anchor = name => name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export function renderOpportunities(directory, section, locale, now = Date.now()) {
  const t = terms[locale], cpp = section === 'cpp';
  const rows = directory.entries.filter(row => row.section === section)
    .sort((a,b) => b.added.localeCompare(a.added) || a.en.name.localeCompare(b.en.name, 'en'));
  const heading = t[section], order = t.order+' · '+(locale === 'zh' ? rows.length+' 筆' : rows.length+' listings');
  // The search title and description name what the list covers; the visible sub-heading keeps the sort order.
  const title = t[section+'Title'].replace('{n}', rows.length);
  const description = t[section+'Description'].replace('{n}', rows.length).replace('{date}', directory.reviewed[section]);
  const field = (label, html) => '<dt>'+e(label)+'</dt><dd>'+html+'</dd>';
  const articles = rows.map(({added,host,source,deadlines,[locale]:copy}, index) => {
    const dates = deadlines.map(({stage,at}) => {
      const end = closesAt(at);
      return field(t[stage], `<time datetime="${e(at)}">${deadlineTime(at,t)}</time> <small class="opp-closed" data-closes-at="${end}"${now < end ? ' hidden' : ''}>${e(t.closed)}</small>`);
    }).join('');
    return `<article><div class="opp-date"><small>${t.added}</small><time datetime="${added}">${added}</time></div><div><h2 id="${anchor(rows[index].en.name)}">${e(copy.name)}</h2><p>${e(copy.summary)}</p><dl>${dates || field(t.deadline,e(t.noDate))}${cpp?'':field(t.fee,e(copy.fee))}${field(cpp?t.benefits:t.prize,e(copy.reward))}</dl><details><summary>${t.more}</summary><p>${e(copy.details)}</p><p>${t.host}: ${e(host)}</p></details>${externalLink(source,e(t[section+'Link'])+' ↗','opp-link')}</div></article>`;
  }).join('\n');
  return {title, description, body:`<section class="opportunities"><header><h1>${e(heading)}</h1><p>${e(order)}</p></header><p class="opp-note">${e(t.reviewed)}: <time datetime="${directory.reviewed[section]}">${directory.reviewed[section]}</time> · ${e(t.dates)}</p>${articles}</section>`};
}
