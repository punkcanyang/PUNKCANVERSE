# PUNKCANVERSE v0.3

AI VIDEO / IMAGE / MUSIC。Punkcan 的提示词收藏与制作笔记，正式网址 https://punkcanverse.com。视觉采用「深夜片场 · 影印批注」：暗色片场海报、局部黑红黄剪字与网点；正文与长文使用实色背景，优先阅读。

无框架、无 npm 依赖、无外部字体、无追踪脚本。Node 内建模块生成静态页面；唯一 Pages Function 是保留 path/query 的 301 middleware。站点脚本仅在用户点击播放后加载 X 官方 widgets.js，不播放或转存 mp4。

## 页面结构

- `/`：片场首页、63 条打斗与械斗提示词（栏目名 FIGHT/PROMPTS）、模型及标签筛选。手机启用 JavaScript 后先显示 12 条，点击「显示更多」继续；无 JavaScript 时全部卡片与独立页链接仍可访问。
- `/prompts/video/`、`/prompts/image/`、`/prompts/music/`：独立媒介分页面。空分页有说明与视频入口；空分页不进入 sitemap。
- `/prompts/<medium>/<id>/`：每条提示词的独立页，包括原作者、原帖、方法、模型版本、画幅、提示词、复制、推荐链接和 3 条相关提示词。
- `/tips.html`：技术与资源，保留三份写法要点，以及推荐工具区。
- `/regions.html`：AI 工具各地区使用与申诉。
- `/takedown.html`：下架申请，48 小时内处理，无需先证明身份。
- `/essays/`、`/essays/<slug>/`：AI 工作论列表与文章。

所有页面输出 PUNKCANVERSE 标题、canonical、Open Graph 和 twitter:card。sitemap 精确列出首页、有内容的媒介列表、63 条详情、技术与资源、地区、下架与 AI 工作论；有文章时也加入文章。robots 允许抓取并指向正式 sitemap。

## 提示词资料与版权

`data/prompts.json` 保持原有 63 条来源与正文，`medium` 必填且只允许 video／image／music，当前全部为 video。新媒介分页组件为 `lib/media-tabs.mjs`；v0.2 的 `renderMediumFilter` 保持不变，仍只在至少两类有内容时输出旧筛选控件。首页路径不变。

短提示词显示并复制全文；超过 1500 字符时，只显示前约 300 字摘录，复制内容为摘录、换行与「完整版：原帖链接」。提示词版权归原作者，每条必附作者与原帖；不收官方文档示例作为提示词条目。成片用 X 官方嵌入显示，缩图直接引用 X 原图，两者均不转存到仓库或 dist。

`postStatus: "removed"` 显示检查日期和失效说明，不创建嵌入。`postStatus: "sensitive"` 显示「原帖含敏感内容，请到 X 观看」，保留缓存缩图，点击外开原帖，不嵌入。1949860456958398844 已纠正为 sensitive。

只有 `embedId` 存在时才用同作者串首嵌入，注明「影片取自同作者的串首帖」，原帖链接及复制内容仍指向原回复。上层不是同作者时标记 `replyNoVideo: true`，保留原回复并说明「此帖为回复，影片见原串」，不替换为其他作者的嵌入。

可在提示词记录增加可选 Markdown 字符串 `breakdown`（原创拆解）与 `notes`（实测心得）。有内容才渲染，署名 Punkcan；无内容不输出空标题。本版未为收录条目编造拆解或实测。

作者可经[下架入口](https://punkcanverse.com/takedown.html)或[GitHub issue](https://github.com/punkcanyang/fight-prompts/issues/new?template=takedown.md&title=%E4%B8%8B%E6%9E%B6%E7%94%B3%E8%AF%B7)申请下架。

## 缩图抓取与缓存

`data/thumbs.json` 只保存公开图片地址、媒体类型、片长、尺寸与抓取状态，不含作者账户字段或密钥。初始 63 条记录来自已核对的旧缓存；敏感条目依赖这份缓存，不能因再次抓取失败而清掉。

手动或在构建前单独运行：

```sh
node scripts/fetch-thumbs.mjs
```

未设置 token 时使用公共 syndication 接口，token 参数为 a，请求间隔至少 250ms。已在执行环境安全配置 `X_BEARER_TOKEN` 时使用 X API v2，单批不超过 100 个 id；读取视频 preview_image_url、照片 url 以及尺寸与片长。请求 id 为 `embedId || id`。本版没有开通或调用付费 X API；测试只用假 fetch。

每条失败（网络、非 200、tombstone、无媒体）都沿用该条旧 thumb、状态、尺寸与片长，增加过期标记；没有旧值才记 missing。全部失败仍正常结束并打印统计，不写入空缓存。旧缓存损坏时保留原文件，不冒险覆盖。更新通过临时文件和 rename 写入，避免半写入。

build 只读缓存，不抓网络。缓存缺失、损坏或缺某条时，页面输出片场场记板占位。浏览器图片加载失败也回到相同占位。图片使用 pbs.twimg.com 公共原址、固定比例及 width/height，配合 lazy/async 加载；片长以 m:ss 显示。

## AI 工作论：新增文章

在 `content/essays/` 放一个 Markdown 文件即可，当前正式目录只有 .gitkeep，没有示例文章。支持以下单行 front matter（示例仅说明字段，不是上线文章）：

```yaml
---
title: 文章标题
date: 2026-10-21
summary: 一段中文摘要。
slug: article-slug
aiAssisted: false
---
```

slug 可省略，使用文件名；仅接受小写英文、数字与短横线。title、date、summary 必填，日期必须有效；正文用现有 Markdown 转换器，原始 HTML 转义、链接仅接受 HTTP(S)。署名为 Punkcan，只有 aiAssisted: true 才输出「AI 辅助整理，作者审校」。没有文章时，列表保留导航并显示「即将推出」及栏目说明，不生成不存在的文章页。测试文章只在 test/fixtures/essays/。

## 推广链接与推荐工具

`data/affiliates.json` 按平台配置 name、url、models，models 使用原始模型名。空网址或非 HTTP(S) 不输出按钮或空容器。对应模型出现「去 XX 试试」及「推广连结」标签；所有推广链接均使用 target="_blank" rel="sponsored noopener noreferrer"。

本版仅启用已批准的 Higgsfield 与 Magnific 链接：Higgsfield 出现在其对应 4 条卡片及详情页；Magnific 放在技术与资源页的推荐工具区，不塞进视频卡片。平台有 code 字段时显示「推广码 xxx」，无 code 不输出；Magnific 的推广码为 GMRPOCT43296。其他平台网址保持空字符串。

所有页尾保留揭露：「本站部分按钮为推广连结，通过它们注册或购买，本站可能获得佣金，不影响你的价格。」不添加推广追踪脚本。

## 隐藏栏目与订阅

`data/site.json` 的 models.enabled 为 false。所有对外 HTML、导航与 sitemap 都不出现该资源入口；verify 检查相关路径和文字。

newsletter 保持 enabled:false、provider:beehiiv、embedUrl:""，逻辑沿用 v0.2，整块隐藏，导航不加电子报入口。将来启用仅接受 HTTPS 且精确域名为 beehiiv.com 或 embeds.beehiiv.com 的嵌入地址；为空、无效或关闭时均不输出空框。本版不创建账户或订阅。

## 地区与申诉栏目

地区数据、官方来源、2026-10-21 检查日期、免责声明与禁词清单沿用 v0.2。仅整理官方政策与申诉管道，不提供也不推荐任何绕过地区限制的方法。`lib/regions.mjs` 的禁词常数对完整 JSON 和整页 HTML 执行校验；verify 不发网络请求。原始参考文字不进入仓库。

## 构建、测试与部署

Node.js 22.8 或更新版本，无需 npm install。

```sh
npm run build && npm test && npm run verify
```

本版新增离线测试可单独运行：

```sh
node --test --test-isolation=none test/v03.test.mjs
node scripts/verify-v03.mjs
```

测试覆盖假 X API 分批、syndication 解析和间隔、失败保留旧缓存、missing 与坏缓存占位、敏感内容、片长、三媒介分页、63 条详情与 sitemap、可选原创笔记、文章 fixture、推广属性、延迟加载 widgets 和图片失败回退。build/test/verify 不访问网络；只有手动运行 fetch-thumbs 会请求网络，不下载任何媒体文件。

v0.2 有两项测试直接要求真实推广配置全空，与本版批准的推广链接存在冲突；旧 verify 还固定旧站名、3 页 sitemap 和 1 个预加载外部脚本。按开工卡这些断言保留，未经授权不改。v0.3 的完整独立校验已追加，仍需确认如何迁移这些旧版固定值，才能让全套命令全绿。

部署由外部负责，在项目根目录运行：

```sh
npx wrangler pages deploy dist --project-name fight-prompts
```

Wrangler 会自动带上根目录 functions/。middleware 仅将 www.punkcanverse.com 与旧正式 Pages host 301 到 HTTPS apex，保留 path/query；预览子域名和 apex 调用 next()。旧 tips.html、regions.html、takedown.html 文件保留；安全标头与 Impact 站点验证保持不动。

.env* 已忽略。密钥只从执行环境读取，不写入文件、不打印 token，不保存真实对话、未确认的联系方式或账户资料。所有实际 X 播放、图片加载、移动端视觉与推广落地页需要在浏览器中人工验收。

作者：[@punkcan](https://x.com/punkcan)
