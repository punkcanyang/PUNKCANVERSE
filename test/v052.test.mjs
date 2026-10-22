import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadCatalog, validateImportedPrompts } from '../lib/catalog.mjs';
import { OFFICIAL_FRAMES, validateOfficialFrame, validateFrameBytes, withOfficialFrameBaseline, isOfficialFramePath } from '../lib/official-frames.mjs';
import { validateFullPromptSources } from '../lib/fulltext.mjs';
import { buildSite } from '../build.mjs';
import { verifyV052, verifyOfficialFrameHtml } from '../scripts/verify-v052.mjs';
import { renderPostMedia } from '../lib/cards.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const {imported,entries}=await loadCatalog(root);
const manifest=JSON.parse(await readFile(join(root,'test/fixtures/v051-source-manifest.json'),'utf8'));
const official=imported.entries.filter(entry=>entry.source==='official');
const sample=official[0];

test('v0.5.2 素材清单精确22张、17无图，原始WebP字节与尺寸来源固定，不扩及其他媒体',async()=>{
  assert.equal(Object.values(OFFICIAL_FRAMES).filter(Boolean).length,22);
  assert.equal(OFFICIAL_FRAMES['aliyun-wan3-example-17'],null);
  for(const entry of official) {
    validateOfficialFrame(entry,true);
    const frame=OFFICIAL_FRAMES[entry.id];if(!frame)continue;
    const bytes=await readFile(join(root,'web',frame.src));validateFrameBytes(bytes,frame);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(isOfficialFramePath(`web${frame.src}`));assert.ok(isOfficialFramePath(`dist${frame.src}`));
    assert.ok(!isOfficialFramePath(`elsewhere${frame.src}`));
    const broken=Buffer.from(bytes);broken[broken.length-1]^=1;assert.throws(()=>validateFrameBytes(broken,frame));
  }
  assert.ok(!isOfficialFramePath('web/img/official/unapproved.webp'));
  // If the handoff sources are mounted, also compare the original bytes directly.
  let supplied;
  try {supplied=JSON.parse(await readFile('/workspace/bd-punkcan/v052-official-thumbs.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(supplied)for(const [id,source] of Object.entries(supplied)) {
    if(source===null){assert.equal(OFFICIAL_FRAMES[id],null);continue;}
    const frame=OFFICIAL_FRAMES[id];
    for(const key of ['width','height','sourceMedia','sourceKind','officialUrl'])assert.equal(frame[key],source[key]);
    assert.deepEqual(await readFile(join(root,'web',frame.src)),await readFile(source.file));
  }
});

test('v0.5.2 仅允许精确官方缩图字段；外部路径、串图、尺寸、来源和非官方字段一律拒绝',()=>{
  for(const mutate of [
    e=>e.officialThumb.src='https://example.com/frame.webp',
    e=>e.officialThumb.src='/img/official/../frame.webp',
    e=>e.officialThumb.src=official[1].officialThumb.src,
    e=>e.officialThumb.width=0,e=>e.officialThumb.height++,
    e=>e.officialThumb.sourceMedia='https://example.com/video.mp4',
    e=>e.officialThumb.extra='unexpected',e=>e.officialThumb='',
  ]) {const fixture=structuredClone(imported);mutate(fixture.entries.find(e=>e.id===sample.id));assert.throws(()=>validateImportedPrompts(fixture));}
  const missing=structuredClone(sample);delete missing.officialThumb;assert.throws(()=>validateOfficialFrame(missing,true));
  const seventeen=structuredClone(official.find(e=>e.id.endsWith('-17')));seventeen.officialThumb=sample.officialThumb;assert.throws(()=>validateOfficialFrame(seventeen));
  const x=structuredClone(entries[0]);x.officialThumb=sample.officialThumb;assert.throws(()=>validateOfficialFrame(x));
});

test('v0.5.2 旧元数据指纹与192条全文不变，新增字段单独精确比对，不能借迁移改其他字段',()=>{
  validateFullPromptSources(entries,manifest);
  const previous=structuredClone(imported);for(const entry of previous.entries)delete entry.officialThumb;
  assert.deepEqual(withOfficialFrameBaseline(previous),imported);
  for(const mutate of [e=>e.title+='changed',e=>e.prompt+='changed',e=>delete e.officialThumb,e=>e.officialThumb.height++]) {
    const fixture=structuredClone(entries);mutate(fixture.find(e=>e.id===sample.id));assert.throws(()=>validateFullPromptSources(fixture,manifest));
  }
});

test('v0.5.2 离线构建：22张在三语首页/视频列表/详情都有本地原图与来源，17保持占位，官方无X',async()=>{
  const out=await mkdtemp(join(tmpdir(),'pcv-frames-'));const saved=globalThis.fetch;
  globalThis.fetch=()=>{throw Error('Network forbidden');};
  try {
    await buildSite({out});await verifyV052(root,out);
    const frame=OFFICIAL_FRAMES[sample.id],path=join(out,frame.src);
    const original=await readFile(path);await writeFile(path,Buffer.concat([original,Buffer.from('changed')]));
    await assert.rejects(()=>verifyV052(root,out),/byte length/);
  }finally{globalThis.fetch=saved;await rm(out,{recursive:true,force:true});}
});

test('v0.5.2 图片必带lazy/async、尺寸、标题alt和安全出处；官方不能引入X、推广或假图',()=>{
  const credit='Sample frame: Alibaba Cloud Model Studio documentation (video still)';
  const html=renderPostMedia(sample,undefined,{officialFrameCredit:credit});
  verifyOfficialFrameHtml(html,sample,credit);
  assert.ok(html.includes(`alt="${sample.title}"`));
  assert.ok(!html.includes('sponsored'));
  for(const broken of [html.replace('loading="lazy"',''),html.replace('decoding="async"',''),html.replace('width="640"',''),html.replace(credit,'wrong source'),html+'<script src="https://platform.twitter.com/widgets.js"></script>',html+'<img src="https://pbs.twimg.com/fake.jpg">'])assert.throws(()=>verifyOfficialFrameHtml(broken,sample,credit));
});
