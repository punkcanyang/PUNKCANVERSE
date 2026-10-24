// Offline browser regression checks. Serves dist through request interception;
// all external requests are aborted, including analytics and X.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const temporary=await mkdtemp(join(tmpdir(),'pcv-reading-browser-'));
const dist=resolve('dist');
const screenshotDir=process.env.PCV_SCREENSHOT_DIR;
if(screenshotDir)await mkdir(screenshotDir,{recursive:true});
const chrome=spawn(process.env.CHROME_BIN||'chromium',['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--disable-component-update','--disable-extensions','--disable-sync','--no-first-run',`--user-data-dir=${temporary}`,'--remote-debugging-pipe','about:blank'],{stdio:['ignore','ignore','pipe','pipe','pipe']});
let next=0,buffer='',sessionId,stderr='';const pending=new Map(),handlers=new Map(),errors=[];
chrome.stderr.on('data',c=>{stderr=(stderr+c).slice(-2000);});
function fail(error){for(const p of pending.values())p.reject(error);pending.clear();}
chrome.on('error',fail);chrome.on('exit',code=>fail(Error(`Chrome exited ${code}: ${stderr}`)));
chrome.stdio[3].on('error',fail);chrome.stdio[4].on('error',fail);
chrome.stdio[4].on('data',chunk=>{
  buffer+=chunk;let end;
  while((end=buffer.indexOf('\0'))!==-1){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;const msg=JSON.parse(raw);
    if(msg.id){const p=pending.get(msg.id);if(p){pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}}
    else if(handlers.has(msg.method))Promise.resolve(handlers.get(msg.method)(msg.params)).catch(error=>errors.push(error.message));
  }
});
function request(method,params={},session=sessionId){return new Promise((resolve,reject)=>{
  const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error(`Timed out: ${method}`));},10000);
  pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
  chrome.stdio[3].write(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})})+'\0');
});}
async function evaluate(expression){const r=await request('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function waitUntil(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,30));}throw Error(`Condition failed: ${expression}`);}
async function navigate(path,width=390){await request('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<650});await request('Page.navigate',{url:'https://pcv.test'+path});await waitUntil(`document.readyState==='complete' && Boolean(document.querySelector('#toast'))`);await waitUntil(`!document.querySelector('[data-copy-entry][disabled]')`);}
async function screenshot(name){if(!screenshotDir)return;const {data}=await request('Page.captureScreenshot',{format:'png'});await writeFile(join(screenshotDir,name+'.png'),Buffer.from(data,'base64'));}
try {
  const {targetId}=await request('Target.createTarget',{url:'about:blank'},null);
  sessionId=(await request('Target.attachToTarget',{targetId,flatten:true},null)).sessionId;
  await request('Page.enable');await request('Runtime.enable');
  handlers.set('Runtime.exceptionThrown',p=>errors.push(p.exceptionDetails.exception?.description||p.exceptionDetails.text));
  const requests=[];
  handlers.set('Fetch.requestPaused',async({requestId,request:req})=>{
    const url=new URL(req.url);requests.push(url.pathname);
    if(url.origin!=='https://pcv.test')return request('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});
    let path=decodeURIComponent(url.pathname);if(path.endsWith('/'))path+='index.html';else if(!extname(path))path+='.html';
    const file=resolve(dist,'.'+path);if(!file.startsWith(dist+'/'))return request('Fetch.failRequest',{requestId,errorReason:'AccessDenied'});
    try {const body=await readFile(file);const type={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json'}[extname(file)]||'application/octet-stream';await request('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:type}],body:body.toString('base64')});}
    catch {await request('Fetch.fulfillRequest',{requestId,responseCode:404,body:''});}
  });
  await request('Fetch.enable',{patterns:[{urlPattern:'*'}]});
  await request('Page.addScriptToEvaluateOnNewDocument',{source:`window.__copied=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied.push(text)}}});`});
  for(const lang of ['', '/en', '/ja']) {
    await navigate(lang+'/',390);await evaluate(`document.querySelector('[data-cookie-settings]').click()`);await screenshot((lang||'/zh').slice(1)+'-home-mobile');
    assert.equal(await evaluate(`document.querySelectorAll('.prompt-card').length`),6);
    await evaluate(`document.querySelector('.card-prompt').open=true;document.querySelector('[data-copy-entry]').click()`);
    await waitUntil(`window.__copied.length===1`);
    assert.equal(await evaluate(`window.__copied[0]===document.querySelector('.prompt-text').textContent`),true);
    const geometry=await evaluate(`({lang:document.documentElement.lang,toast:document.querySelector('#toast').getBoundingClientRect().toJSON(),banner:document.querySelector('#cookie-consent').getBoundingClientRect().toJSON(),hidden:document.querySelector('#cookie-consent').hidden,space:document.body.style.getPropertyValue('--consent-space'),bottom:getComputedStyle(document.querySelector('#toast')).bottom})`);
    assert.ok(geometry.toast.bottom<=geometry.banner.top,JSON.stringify(geometry));
    await navigate(lang+'/prompts/video/',390);
    await waitUntil(`!document.querySelector('#prompt-search').disabled`);
    assert.equal(await evaluate(`document.querySelectorAll('#prompt-grid>.prompt-card:not([hidden])').length`),12);
    await evaluate(`document.querySelector('#show-more').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('#prompt-grid>.prompt-card:not([hidden])').length`),24);
    const keyword=await evaluate(`document.querySelector('.card-source small').textContent`);
    await evaluate(`document.querySelector('#prompt-search').value=${JSON.stringify(keyword)};document.querySelector('#prompt-search').dispatchEvent(new Event('input',{bubbles:true}))`);
    await waitUntil(`new URLSearchParams(location.search).get('q')===${JSON.stringify(keyword)}`);
    assert.ok(await evaluate(`document.querySelectorAll('#prompt-grid>.prompt-card:not([hidden])').length>0`));
    await evaluate(`document.querySelector('#prompt-search').value='zzzz-unmatched-123';document.querySelector('#prompt-search').dispatchEvent(new Event('input',{bubbles:true}))`);
    await waitUntil(`!document.querySelector('#empty-state').hidden`);
    await evaluate(`document.querySelector('[data-clear-filters]').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('#prompt-grid>.prompt-card:not([hidden])').length`),12);
    await evaluate(`document.querySelector('[data-filter-tag]').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('#active-filters button').length`),1);
    await evaluate(`document.querySelector('#active-filters button').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('#prompt-grid>.prompt-card:not([hidden])').length`),12);
    await evaluate(`document.querySelector('#prompt-sort').value='latest';document.querySelector('#prompt-sort').dispatchEvent(new Event('change',{bubbles:true}))`);
    assert.equal(await evaluate(`(()=>{const dates=[...document.querySelectorAll('#prompt-grid>.prompt-card:not([hidden])')].map(x=>JSON.parse(x.dataset.filterEntry).date);return dates.every((x,i)=>!i||dates[i-1]>=x)})()`),true);
    await evaluate(`history.back()`);await waitUntil(`!new URLSearchParams(location.search).has('sort')`);
    await evaluate(`document.querySelector('#clear-filters').click();document.querySelector('[data-consent="denied"]').click()`);
    await screenshot((lang||'/zh').slice(1)+'-archive-mobile');
    await evaluate(`document.querySelector('#prompt-grid .prompt-card:not([hidden])').scrollIntoView()`);
    await screenshot((lang||'/zh').slice(1)+'-card-mobile');
    const paths=[lang+'/tools',lang+'/tips',lang+'/works/',await evaluate(`document.querySelector('#prompt-grid h2 a').pathname`)];
    for(const path of paths){await navigate(path,390);assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,path);}
    for (const [width,columns] of [[390,1],[1024,2],[1440,3]]) {
      await navigate(lang+'/tools',width);
      await waitUntil(`Boolean(document.querySelector('.tools-grid.is-enhanced'))`);
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.tools-grid')).gridTemplateColumns.split(' ').length`),columns);
      assert.equal(await evaluate(`document.querySelectorAll('.tools-grid .tool-body[hidden]').length`),3);
      assert.equal(await evaluate(`document.querySelector('.tools-jump')===null`),true);
      assert.equal(await evaluate(`document.querySelectorAll('.tool-free-badge').length`),2);
      assert.equal(await evaluate(`[...document.querySelectorAll('.tool-free-badge')].every(badge=>{const box=badge.getBoundingClientRect();return box.top<badge.parentElement.getBoundingClientRect().top && box.left>=0 && box.right<=innerWidth;})`),true);
      await screenshot((lang||'/zh').slice(1)+`-tools-${width}`);
      await evaluate(`document.querySelector('#magnific [data-tool-open]').focus()`);
      await request('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});
      await request('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await waitUntil(`document.querySelector('.tool-dialog').open`);
      assert.equal(await evaluate(`document.querySelector('.tool-dialog h2').textContent`),'Magnific');
      assert.equal(await evaluate(`document.querySelectorAll('.tool-dialog .tool-prices tbody tr').length>0`),true);
      assert.equal(await evaluate(`document.querySelectorAll('.affiliate-button').length`),3,'Moving content must not duplicate promotional links');
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth && document.querySelector('.tool-dialog').scrollWidth<=document.querySelector('.tool-dialog').clientWidth`),true);
      await screenshot((lang||'/zh').slice(1)+`-tool-dialog-${width}`);
      await request('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await request('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await waitUntil(`!document.querySelector('.tool-dialog').open && document.activeElement.matches('#magnific [data-tool-open]') && Boolean(document.querySelector('#magnific .tool-body[hidden]'))`);
      assert.equal(await evaluate(`Boolean(document.querySelector('#magnific .tool-body[hidden]'))`),true);
      await evaluate(`document.querySelector('#pixverse [data-tool-open]').click();document.querySelector('.tool-dialog-close').click()`);
      await waitUntil(`document.activeElement.matches('#pixverse [data-tool-open]') && Boolean(document.querySelector('#pixverse .tool-body[hidden]'))`);
    }
    await navigate(lang+'/tools#pixverse',1440);
    await waitUntil(`document.querySelector('.tool-dialog')?.open`);
    assert.equal(await evaluate(`document.querySelector('.tool-dialog h2').textContent`),'PixVerse');
    await evaluate(`document.querySelector('.tool-dialog-close').click()`);
    await waitUntil(`!document.querySelector('.tool-dialog').open`);
    await evaluate(`document.querySelector('#pixverse [data-tool-open]').click()`);
    await waitUntil(`document.querySelector('.tool-dialog').open`);
    await navigate(lang+'/prompts/video/',1440);await waitUntil(`!document.querySelector('#prompt-search').disabled`);
    await screenshot((lang||'/zh').slice(1)+'-archive-desktop');
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
    await navigate(lang+'/',1440);await screenshot((lang||'/zh').slice(1)+'-home-desktop');
  }
  const catalog=JSON.parse(await readFile(join(dist,'catalog.json'),'utf8')).entries;
  const longest=[...catalog].sort((a,b)=>b.promptLength-a.promptLength)[0];
  await navigate(`/prompts/video/${longest.id}/`);
  await waitUntil(`Boolean(document.querySelector('.expand-prompt'))`);
  await evaluate(`document.querySelector('.expand-prompt').click()`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.full-prompt pre')).maxBlockSize`),'none');
  await evaluate(`document.querySelector('[data-copy-entry]').click()`);await waitUntil(`window.__copied.length===1`);
  assert.equal(await evaluate(`window.__copied[0]`),longest.prompt);
  await evaluate(`navigator.clipboard.writeText=async()=>{throw Error('Clipboard denied')};document.execCommand=()=>false;document.querySelector('[data-copy-entry]').click()`);
  await waitUntil(`document.querySelector('[data-copy-entry]').textContent===JSON.parse(document.body.dataset.messages).copyRetry`);
  assert.equal(await evaluate(`document.querySelector('[data-copy-entry]').disabled`),false);
  // Direct shared URLs, unknown filters, reload and legacy homepage bookmarks.
  await navigate('/prompts/video/?model=not-a-model&q=camera&sort=featured');await waitUntil(`!document.querySelector('#prompt-search').disabled`);
  assert.equal(await evaluate(`!document.querySelector('#unknown-filters').hidden && !document.querySelector('#empty-state').hidden`),true);
  await navigate('/?model=Wan');await waitUntil(`location.pathname==='/prompts/video/' && !document.querySelector('#prompt-search').disabled`);
  assert.equal(await evaluate(`document.querySelector('input[name="model"][value="Wan"]').checked`),true);
  assert.ok(!requests.includes('/catalog.json'),'No full catalog fetch for copy or filters');
  assert.deepEqual(errors,[]);
  console.log('Offline browser interactions passed: three languages, copy with consent, search, zero results, tags, sort/history, progressive display, compact tool cards at 390/1024/1440, tool dialogs with keyboard and deep links, routes and legacy shared URLs; no catalog fetch.');
} finally {
  if(chrome.exitCode===null&&chrome.signalCode===null){const stopped=new Promise(r=>chrome.once('exit',r));chrome.kill();await stopped;}
  await rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
