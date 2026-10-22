import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {validatePostMetadata} from './posts.mjs';
export const IMPORT_COLLECTION='wan-minimax';
export const isOfficial=entry=>entry.source==='official';
export const sourceUrl=entry=>isOfficial(entry)?entry.officialUrl:entry.postUrl;
export function mergePrompts(original, imported) {
  const entries=[...original,...imported];
  if(new Set(entries.map(entry=>entry.id)).size!==entries.length)throw Error('Duplicate prompt id across collections');
  return entries;
}
export async function loadCatalog(root) {
  const original=JSON.parse(await readFile(join(root,'data/prompts.json'),'utf8'));
  const imported=JSON.parse(await readFile(join(root,'data/prompts-wan-minimax.json'),'utf8'));
  validateImportedPrompts(imported);
  return {original,imported,entries:mergePrompts(original.entries,imported.entries)};
}
export function validateImportedPrompts(data) {
  if(data?.version!==1 || typeof data.source!=='string' || !data.source.trim() || data.lengthThreshold!==1500 || data.excerptLength!==300 || !Array.isArray(data.entries) || data.count!==data.entries.length)throw Error('Invalid imported dataset');
  const ids=new Set();
  for(const entry of data.entries) {
    if(typeof entry.id!=='string'||ids.has(entry.id))throw Error('Invalid or duplicate imported id');ids.add(entry.id);
    for(const key of ['title','description','author','authorUrl','date','modelVersion','method','format'])if(typeof entry[key]!=='string'||!entry[key].trim())throw Error(`${entry.id}: missing ${key}`);
    if(entry.medium!=='video'||entry.collection!==IMPORT_COLLECTION || !['x','official'].includes(entry.source) || typeof entry.featured!=='boolean')throw Error(`${entry.id}: invalid collection metadata`);
    if(!Array.isArray(entry.models)||entry.models.length!==1||entry.models[0]!== (entry.modelVersion==='MiniMax H3'?'MiniMax':'Wan')||!['Wan 3.0','Wan 3.0 Prime','MiniMax H3'].includes(entry.modelVersion))throw Error(`${entry.id}: invalid model`);
    if(!Array.isArray(entry.tags)||!entry.tags.length||entry.tags.some(tag=>typeof tag!=='string'||!tag.trim()||tag==='官方示例'))throw Error(`${entry.id}: invalid tags`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||!Number.isFinite(Date.parse(entry.date))||new Date(entry.date).toISOString().slice(0,10)!==entry.date)throw Error(`${entry.id}: invalid date`);
    if(!Number.isInteger(entry.promptLength)||entry.promptLength<1||entry.isLong!==(entry.promptLength>1500))throw Error(`${entry.id}: invalid length`);
    // v0.5.1 spec change (boss 2026-10-22): full prompt text on every page
    if(typeof entry.prompt!=='string'||!entry.prompt.length||entry.prompt.length!==entry.promptLength||entry.promptExcerpt!==null)throw Error(`${entry.id}: invalid full prompt`);
    if(isOfficial(entry)) {
      if(!/^aliyun-wan3-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)||entry.author!=='阿里雲官方範例'||Object.hasOwn(entry,'postUrl')||Object.hasOwn(entry,'authorHandle')||Object.hasOwn(entry,'embedId'))throw Error(`${entry.id}: invalid official metadata`);
      let url;try{url=new URL(entry.officialUrl);}catch{throw Error('Invalid official URL');}
      if(!entry.officialUrl.startsWith('https://help.aliyun.com/')||url.protocol!=='https:'||url.hostname!=='help.aliyun.com'||url.username||url.password||url.port||entry.authorUrl!==entry.officialUrl)throw Error(`${entry.id}: invalid official URL`);
    } else {
      if(!/^[A-Za-z0-9_]+$/.test(entry.authorHandle||'')||entry.authorUrl!==`https://x.com/${entry.authorHandle}`||Object.hasOwn(entry,'officialUrl'))throw Error(`${entry.id}: invalid X author`);
      const segment=/^([1-9]\d*)-([2-9]|[1-9]\d+)$/.exec(entry.id);
      if(!segment&&!/^[1-9]\d*$/.test(entry.id))throw Error(`${entry.id}: invalid X id`);
      const postId=segment?segment[1]:entry.id;
      if(entry.postUrl!==`https://x.com/${entry.authorHandle}/status/${postId}`)throw Error(`${entry.id}: postUrl mismatch`);
      if(segment&&entry.embedId!==postId)throw Error(`${entry.id}: segment embedId mismatch`);
      if(entry.embedId && entry.embedId!==postId)throw Error(`${entry.id}: unexpected imported embedId`);
      validatePostMetadata(entry);
    }
  }
  for(const entry of data.entries.filter(entry=>entry.source==='x'&&entry.id.includes('-'))) {
    const parent=data.entries.find(other=>other.id===entry.embedId);
    if(!parent||parent.source!=='x'||parent.postUrl!==entry.postUrl||parent.authorHandle!==entry.authorHandle)throw Error(`${entry.id}: missing matching first segment`);
  }
}
