// Optional, fully offline browser check. Requires an already-installed Chrome.
// No package install, HTTP server, analytics, image request or network connection.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { loadCatalog } from '../lib/catalog.mjs';
const temporary=await mkdtemp(join(tmpdir(),'pcv-layout-'));
let chrome;
try {
  const css=await readFile('dist/assets/site.css','utf8');
  const {entries:workflows}=JSON.parse(await readFile('data/workflows.json','utf8'));
  const {entries}=JSON.parse(await readFile('data/prompts.json','utf8'));
  const samples=['index.html','tips.html','tools.html','regions.html','privacy/index.html','works/index.html','essays/index.html','prompts/workflow/index.html',`prompts/workflow/${workflows[0].id}/index.html`,`prompts/video/${entries[0].id}/index.html`];
  const { imported } = await loadCatalog(process.cwd());
  samples.push('prompts/fight/index.html',
    `prompts/video/${imported.entries.find(entry=>entry.source==='official').id}/index.html`,
    `prompts/video/${imported.entries.find(entry=>entry.source==='x'&&entry.isLong).id}/index.html`);
  samples.push(...[...entries,...imported.entries].sort((a,b)=>b.promptLength-a.promptLength).slice(0,3)
    .map(entry=>`prompts/video/${entry.id}/index.html`));
  chrome=spawn(process.env.CHROME_BIN||'google-chrome',['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--disable-extensions','--disable-sync','--no-first-run',`--user-data-dir=${join(temporary,'profile')}`,'--remote-debugging-pipe','about:blank'],{stdio:['ignore','ignore','pipe','pipe','pipe']});
  let id=0,buffer='',exitError;const pending=new Map();const events=new Map();let stderr='';
  chrome.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-2000);});
  const fail=error=>{exitError=error;for(const {reject} of pending.values())reject(error);pending.clear();};
  chrome.on('error',fail);chrome.stdio[3].on('error',fail);chrome.stdio[4].on('error',fail);chrome.on('exit',code=>fail(new Error(`Chrome exited (${code}). ${stderr}`)));
  chrome.stdio[4].on('data',chunk=>{
    buffer+=chunk.toString();let end;
    while((end=buffer.indexOf('\0'))!==-1){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;const value=JSON.parse(raw);const onEvent=events.get(value.method);if(onEvent){events.delete(value.method);onEvent();}const p=pending.get(value.id);if(p){pending.delete(value.id);value.error?p.reject(Error(value.error.message)):p.resolve(value.result);}}
  });
  const request=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
    if(exitError)return reject(exitError);const requestId=++id;
    const timer=setTimeout(()=>{pending.delete(requestId);reject(Error(`Chrome timeout: ${method}`));},8000);
    pending.set(requestId,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
    chrome.stdio[3].write(JSON.stringify({id:requestId,method,params,...(sessionId?{sessionId}:{})})+'\0');
  });
  const {targetId}=await request('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await request('Target.attachToTarget',{targetId,flatten:true});
  const cmd=(method,params={})=>request(method,params,sessionId);
  await cmd('Page.enable');await cmd('Network.enable');await cmd('Network.setBlockedURLs',{urls:['http://*','https://*']});
  let checks=0;
  for(const locale of ['zh','en','ja'])for(const file of samples) {
    const prefix=locale==='zh'?'':`${locale}/`;
    const raw=await readFile(join('dist',prefix,file),'utf8');
    const html=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'').replace(/<img\b[^>]*>/gi,'').replace(/<base\b[^>]*>/gi,'').replace('</head>',`<style>${css}\nh1{font-family:"DejaVu Sans",sans-serif!important}</style></head>`);
    for(const width of [360,390,1440]) {
      await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
      // Send the document over CDP, also supported by browsers isolated from local /tmp.
      const {frameTree}=await cmd('Page.getFrameTree');
      await cmd('Page.setDocumentContent',{frameId:frameTree.frame.id,html});
      let loaded=false;
      for(let attempt=0;attempt<100;attempt++) {const r=await cmd('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(r.result.value==='complete'){loaded=true;break;}await new Promise(resolve=>setTimeout(resolve,20));}
      assert.ok(loaded,'Page must finish loading');
      const {result}=await cmd('Runtime.evaluate',{expression:`(()=>{const banner=document.querySelector('#cookie-consent');banner.hidden=false;document.body.style.paddingBottom=(banner.getBoundingClientRect().height+30)+'px';return {viewport:innerWidth,width:document.documentElement.scrollWidth}})()`,returnByValue:true});
      assert.equal(result.value.viewport,width,'Device viewport');assert.ok(result.value.width<=width,`${locale}/${file} at ${width}: document width ${result.value.width}`);checks++;
    }
  }
  console.log(`${checks} offline layout checks passed (zh/en/ja × 360/390/1440).`);
} finally {
  if(chrome && chrome.exitCode===null && chrome.signalCode===null) {
    const stopped=new Promise(resolve=>chrome.once('exit',resolve));
    chrome.kill();await stopped;
  }
  await rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
