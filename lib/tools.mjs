import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { escapeHtml as e, externalLink, safeUrl } from './markdown.mjs';
import { renderPlatform } from './affiliates.mjs';

export const TOOL_IDS=['higgsfield','magnific','pixverse'];
export const TOOLS_FACTS_SHA256='cf817b2c8b513b27bdbf487d8f3aa2be1e09ba2142e2902d0129c37db6b72aa6';
export function factAt(platform,path) {
  let value=platform,source;
  for(const key of path.split('.')) {
    if(value?.source)source=value.source;
    value=value?.[key];
  }
  if(value?.source)source=value.source;
  return {value:value?.value??value,source};
}
const numbers=text=>(String(text).match(/\d[\d,]*(?:\.\d+)?/g)||[]).map(n=>n.replaceAll(',',''));

export function validateTools(data,ui) {
  assert.equal(createHash('sha256').update(JSON.stringify(data.facts)).digest('hex'),TOOLS_FACTS_SHA256,'Tool facts must exactly match the approved source, including every source URL');
  assert.equal(data.facts.checkedAt,'2026-10-23');
  assert.deepEqual(Object.keys(data.facts.platforms),TOOL_IDS);
  assert.deepEqual(Object.keys(data.content),['zh','en','ja']);
  for(const locale of ['zh','en','ja']) {
    assert.deepEqual(Object.keys(data.content[locale]),TOOL_IDS);
    for(const id of TOOL_IDS) {
      const platform=data.facts.platforms[id],copy=data.content[locale][id];
      const check=(field,path)=>{
        assert.equal(field.fact,path,'Exact field-to-fact mapping');
        const original=factAt(platform,path);
        assert.ok(original.value!==undefined,'Missing source fact');
        assert.equal(field.source,original.source,'Display source must match its fact');
        assert.ok(typeof field.value==='string'&&field.value.trim(),'Nonempty translated value required');
        assert.ok(!/TODO|FIXME|placeholder/i.test(field.value));
        const allowed=new Set(numbers(original.value));
        for(const n of numbers(field.value))assert.ok(allowed.has(n),`${id}/${locale}/${path}: number not present in source: ${n}`);
        if(original.value==='未公開')assert.equal(field.value,ui[locale].tools.undisclosed);
      };
      for(const key of ['summary','launch','freeTier','bestFor','teaser'])check(copy[key],key==='teaser'?'summary':key);
      assert.equal(copy.features.length,platform.features.length);
      assert.ok(copy.features.length>=3&&copy.features.length<=5);
      copy.features.forEach((field,index)=>check(field,`features.${index}`));
      assert.equal(copy.credits.length,Array.isArray(platform.plans)?platform.plans.length:0);
      copy.credits.forEach((field,index)=>check(field,`plans.${index}.credits`));
      for(const note of copy.pricingNotes) {
        assert.match(note.fact,/^plans(?:\.\d+)?\.note$/);
        check(note,note.fact);
      }
    }
  }
}

const attributed=(tag,field,body=e(field.value))=>`<${tag} data-fact="${e(field.fact)}" data-source="${e(field.source)}">${body}</${tag}>`;
export function renderToolCard(id,data,affiliates,locale,ui,affiliateUI) {
  const p=data.facts.platforms[id],copy=data.content[locale][id],name=affiliates[id]?.name || {higgsfield:'Higgsfield',magnific:'Magnific',pixverse:'PixVerse'}[id];
  const affiliateUrl=safeUrl(affiliates[id]?.url || '');
  const cta=affiliateUrl?`<div class="tool-cta">${renderPlatform(affiliates[id],affiliateUrl,affiliateUI)}</div>`:'';
  const billing={monthly:ui.monthly,'annual-billed-monthly-equivalent':ui.annual,custom:ui.custom};
  const plans=Array.isArray(p.plans)?`<div class="table-scroll"><table class="tool-prices"><thead><tr>${[ui.plan,ui.billing,ui.monthlyPrice,ui.credits].map(label=>`<th scope="col">${e(label)}</th>`).join('')}</tr></thead><tbody>${p.plans.map((plan,i)=>`<tr data-plan="${i}" data-source="${e(plan.source)}"><th scope="row">${e(plan.name)}</th><td>${e(billing[plan.billing])}</td><td data-price>${typeof plan.monthlyPriceUSD==='number'?`${plan.monthlyPriceUSD} ${e(ui.unit)}`:e(ui.undisclosed)}</td>${attributed('td',copy.credits[i])}</tr>`).join('')}</tbody></table></div>`:`<p class="undisclosed">${e(ui.undisclosed)}</p>`;
  return `<article class="tool-card" id="${id}"><header><p class="eyebrow">TOOLS / ${id.toUpperCase()}</p><h2>${e(name)}</h2>${attributed('p',copy.summary)}</header><h3>${e(ui.launch)}</h3>${attributed('p',copy.launch)}<h3>${e(ui.features)}</h3><ul class="tool-features">${copy.features.map(field=>attributed('li',field)).join('')}</ul><section class="tool-pricing"><h3>${e(ui.pricing)}</h3><h4>${e(ui.freeTier)}</h4>${attributed('p',copy.freeTier)}${plans}${copy.pricingNotes.map(field=>attributed('p',field)).join('')}</section><h3>${e(ui.bestFor)}</h3>${attributed('p',copy.bestFor)}<p class="tool-price-source"><small>${e(ui.checked.replace('{date}',data.facts.checkedAt))} · ${externalLink(p.pricingUrl.value,e(ui.pricingLink))}</small></p>${cta}</article>`;
}

export function renderToolsPage(data,affiliates,locale,ui,affiliateUI) {
  const prefix=locale==='zh'?'':`/${locale}`;
  return `<header class="page-intro"><p class="eyebrow">TOOLS / RESOURCES</p><h1>${e(ui.title)}</h1><p>${e(ui.intro)}</p><a href="${prefix}/affiliate-disclosure/">${e(ui.disclosure)}</a></header><nav class="tools-jump" aria-label="${e(ui.quickNav || ui.title)}">${TOOL_IDS.map(id=>`<a href="${prefix}/tools#${id}">${e(affiliates[id]?.name || id)} ↓</a>`).join('')}</nav><div class="tools-grid">${TOOL_IDS.map(id=>renderToolCard(id,data,affiliates,locale,ui,affiliateUI)).join('')}</div>`;
}

export function renderToolTeasers(data,locale,ui) {
  const href=`${locale==='zh'?'':`/${locale}`}/tools`;
  return `<section class="recommended-tools"><p class="eyebrow">TOOLS / RESOURCES</p><h2>${e(ui.title)}</h2>${TOOL_IDS.map(id=>`<div class="tool-teaser"><h3>${id==='higgsfield'?'Higgsfield':id==='magnific'?'Magnific':'PixVerse'}</h3>${attributed('p',data.content[locale][id].teaser)}<a href="${href}#${id}">${e(ui.viewTool)}</a></div>`).join('')}<a href="${href}" class="text-link">${e(ui.viewAll)}</a></section>`;
}
