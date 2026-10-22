import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const read=async file=>readFile(new URL('../'+file,import.meta.url),'utf8');
const json=async file=>JSON.parse(await read(file));
const {entries}=await json('data/prompts-wan-minimax.json');
const content=Object.fromEntries(await Promise.all(['zh','en','ja'].map(async locale=>[locale,await json(`data/i18n/content/${locale}.json`)])));

test('v0.5 复审：原只读路径仍覆盖两份提示词资料，不能排除新增档',async()=>{
  const source=await read('scripts/verify.mjs');
  const literal=source.match(/^const protectedDataPaths = (\[[^\n]+\]);$/m)?.[1];
  assert.ok(literal);
  const paths=JSON.parse(literal.replace(/'/g,'"'));
  const {stdout}=await promisify(execFile)('git',['ls-files','--',...paths],{cwd:root,encoding:'utf8'});
  const tracked=stdout.trim().split('\n');
  assert.ok(tracked.includes('data/prompts.json'));
  assert.ok(tracked.includes('data/prompts-wan-minimax.json'));
  for(const tip of ['fight','wan3','minimax-h3'])assert.ok(tracked.includes(`data/tips/${tip}.md`));
});

test('v0.5 复审：女孩保护泰迪熊，三语收藏笔记不颠倒保护关系',()=>{
  const id='aliyun-wan3-example-12',entry=entries.find(row=>row.id===id);
  assert.ok(entry.prompt.includes('双臂紧紧环抱着一只比她还高的棕色泰迪熊'));
  assert.equal(entry.description,'月光與床頭燈分出冷暖層次，再以女孩緊抱泰迪熊、輕聲安慰並說要保護它的動作與台詞承接氣氛。');
  assert.equal(content.zh.prompts[id].description,entry.description);
  assert.equal(content.en.prompts[id].description,'Cool moonlight and a warm bedside lamp frame a little girl hugging a teddy bear and whispering that she will protect it.');
  assert.equal(content.ja.prompts[id].description,'月光と枕元の灯りで寒色と暖色を対比させ、テディベアを抱きしめて安心させようとする女の子の台詞と動きを描きます。');
});

test('v0.5 复审：去作者时保留皮克斯风、30秒一镜到底，来源快照同样精确',async()=>{
  const manifest=await json('test/fixtures/v05-source-manifest.json');
  const cases=[
    ['2096114524919345435','偷傘賊（皮克斯風，iamrealsnow）','，iamrealsnow','偷傘賊（皮克斯風）'],
    ['2092548780658708526','雫 VS 巨大妖怪（Ukiyo_il，30 秒一鏡到底）','Ukiyo_il，','雫 VS 巨大妖怪（30 秒一鏡到底）'],
  ];
  for(const [id,source,author,title] of cases) {
    assert.equal(source.replace(author,''),title);
    assert.equal(entries.find(entry=>entry.id===id).title,title);
    assert.equal(content.zh.prompts[id].title,title);
    assert.equal(manifest.find(entry=>entry.id===id).title,title);
  }
});

test('v0.5 复审：日文快剪与撤退路线自然表达，英文画幅修饰影片而非秒数',()=>{
  assert.equal(content.ja.prompts['2095088320753893689'].title,'韓国風スタイルの女性と巡る東京の一日：テンポよくつなぐカット編集');
  assert.equal(content.ja.prompts['2082770042630943156'].title,'撤退路の橋を守る無線通信員');
  const expected={
    '2097613778796126569':'Realistic performers and a neon stage combine with fighting-game aesthetics; the prompt requests a fifteen-second vertical video.',
    '2092476498125226127':'A thirty-second vertical video uses camera shake, exposure changes and casual talk to retain the imperfections of a friend’s phone footage.',
    '2099558680979005770':'A thirty-second square-format video establishes a fashion look through exaggerated couture shapes, slow camera moves and film grain.',
    '2111358417730240961':'A thirty-second vertical video stages walking, poses, sheer fabric and sequin reflections under consistent studio light, ending with the brand mark.',
    '2082776032042783085':'A fifteen-second vertical video reveals the product through bottle caustics, transformed spray and a final pedestal hero shot.',
  };
  for(const [id,description] of Object.entries(expected))assert.equal(content.en.prompts[id].description,description);
  for(const item of Object.values(content.en.prompts))assert.doesNotMatch(item.description,/\b(?:vertical|square-framed) seconds\b/i);
});
