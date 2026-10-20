import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { escapeHtml, markdownToHtml, safeUrl } from '../lib/markdown.mjs';

test('HTML 全面 escape，正文不执行原始 HTML', () => {
  assert.equal(escapeHtml('<script a="x">&\'</script>'), '&lt;script a=&quot;x&quot;&gt;&amp;&#39;&lt;/script&gt;');
  const html = markdownToHtml('<img src=x onerror="alert(1)">\n\n<script>alert(1)</script>');
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!/<(?:img|script)\b/.test(html));
});

test('标题、段落、强调、行内代码与引用', () => {
  const html = markdownToHtml('# 标题\n\n## 子标题\n\n**粗体** 和 *强调* 与 `<Picture 1>`\n\n> 引用\n> 第二行', { headingOffset: 1 });
  assert.match(html, /<h2>标题<\/h2>/);
  assert.match(html, /<h3>子标题<\/h3>/);
  assert.match(html, /<strong>粗体<\/strong>/);
  assert.match(html, /<em>强调<\/em>/);
  assert.match(html, /<code>&lt;Picture 1&gt;<\/code>/);
  assert.match(html, /<blockquote><p>引用\n第二行<\/p><\/blockquote>/);
});

test('表格：表头、单元格、HTML 转义和可横向滚动容器', () => {
  const html = markdownToHtml('| 模型 | 注意 |\n|:---|---:|\n| **Wan** | <unsafe> |\n| Veo | [原帖](https://x.com/test/status/12) |');
  assert.match(html, /class="table-scroll"/);
  assert.match(html, /<th scope="col">模型<\/th>/);
  assert.match(html, /<td><strong>Wan<\/strong><\/td>/);
  assert.match(html, /<td>&lt;unsafe&gt;<\/td>/);
  assert.equal((html.match(/<tr>/g) || []).length, 3);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});

test('代码区块保留原文、转义 HTML、提供复制按钮且不解析行内标记', () => {
  const html = markdownToHtml('```text\n<Picture 1> & "camera"\n**原样**\n```');
  assert.match(html, /data-copy-code>复制<\/button>/);
  assert.match(html, /<pre><code>&lt;Picture 1&gt; &amp; &quot;camera&quot;\n\*\*原样\*\*<\/code><\/pre>/);
  assert.ok(!html.includes('<strong>'));
  assert.match(markdownToHtml('```\nunfinished <tag>'), /unfinished &lt;tag&gt;/);
});

test('拒绝 javascript:、data:、相对与协议相对链接及属性注入', () => {
  for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,bad', '//x.com/user', '/relative', 'https://x.com/\nfoo', 'https://user:pass@x.com/']) assert.equal(safeUrl(url), null);
  const html = markdownToHtml('[危险](javascript:alert(1)) [数据](data:text/html,test) [属性](https://x.com/"onclick="bad)');
  assert.ok(!/href="(?:javascript:|data:)/i.test(html));
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes(' onclick="'));
  assert.match(html, /危险/);
});

test('HTTP(S) 链接、自动链接、URL 括号与安全外链属性', () => {
  const html = markdownToHtml('[来源](https://example.com/guide_(video)?a=1&b=2) <https://x.com/author> [HTTP](http://example.com)');
  assert.match(html, /href="https:\/\/example.com\/guide_\(video\)\?a=1&amp;b=2"/);
  assert.equal((html.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 3);
});

test('有序、无序、嵌套清单和缩进续行', () => {
  const html = markdownToHtml('- **外层**\n  - 内层\n  - 第二条\n- 另一个\n\n1. 一\n  出处：原文\n2. 二');
  assert.equal((html.match(/<ul>/g) || []).length, 2);
  assert.match(html, /<li><p><strong>外层<\/strong><\/p>\n<ul>/);
  assert.match(html, /<ol><li><p>一\n出处：原文<\/p><\/li><li><p>二<\/p><\/li><\/ol>/);
});

test('三份真实 Markdown 都可转换，保留标题与原文内容', async () => {
  for (const file of ['fight', 'wan3', 'minimax-h3']) {
    const source = await readFile(new URL(`../data/tips/${file}.md`, import.meta.url), 'utf8');
    const html = markdownToHtml(source, { headingOffset: 1 });
    assert.match(html, /<h2>/);
    assert.ok(html.includes(escapeHtml(source.split('\n')[0].slice(2))));
    assert.ok(!/<script\b/i.test(html));
  }
});
