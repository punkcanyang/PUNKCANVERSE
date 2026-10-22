# PUNKCANVERSE v0.4

AI VIDEO / IMAGE / MUSIC。Punkcan 的提示词收藏与制作笔记，正式网址 https://punkcanverse.com。视觉采用「深夜片场 · 影印批注」：暗色片场海报、局部黑红黄剪字与网点；正文与长文使用实色背景，优先阅读。

无框架、无 npm 依赖、无外部字体。Node 内建模块生成静态页面；唯一 Pages Function 是保留 path/query 的 301 middleware。本版按补充需求加入 GA4 和 Consent Mode v2；X 官方 widgets.js 仍仅在用户点击播放后加载，不播放或转存 mp4，也不安装广告脚本。

## 页面结构

- `/`：片场首页、63 条打斗与械斗提示词（栏目名 FIGHT/PROMPTS）、模型及标签筛选。手机启用 JavaScript 后先显示 12 条，点击「显示更多」继续；无 JavaScript 时全部卡片与独立页链接仍可访问。
- `/prompts/video/`、`/prompts/image/`、`/prompts/music/`：独立媒介分页面。空分页有说明与视频入口；空分页不进入 sitemap。
- `/prompts/<medium>/<id>/`：每条提示词的独立页，包括原作者、原帖、方法、模型版本、画幅、提示词、复制、推荐链接和 3 条相关提示词。
- `/tips.html`：技术与资源，保留三份写法要点，以及推荐工具区。
- `/regions.html`：AI 工具各地区使用与申诉。
- `/takedown.html`：下架申请，48 小时内处理，无需先证明身份。
- `/essays/`、`/essays/<slug>/`：AI 工作论列表与文章。
- `/about/`、`/contact/`、`/privacy/`、`/terms/`、`/affiliate-disclosure/`：中文说明与政策，英文原文在 `/en/`，日文在 `/ja/`，更新日期为 2026-10-22。五页均进入 sitemap，页脚连到当前语言。唯一确认的联系邮箱为 hello@punkcanverse.com。

所有页面输出 PUNKCANVERSE 标题、canonical、Open Graph 和 twitter:card。sitemap 精确列出首页、有内容的媒介列表、63 条详情、技术与资源、地区、下架与 AI 工作论；有文章时也加入文章。robots 允许抓取并指向正式 sitemap。

## 三语与最终网址

中文网址保持原样，英文与日文分别加 `/en`、`/ja` 前缀。`data/i18n/{zh,en,ja}.json` 存界面、法律页与技术资料译文；`data/i18n/content/{zh,en,ja}.json` 按 id 存标题、收藏笔记、工作流步骤说明、地区摘要与标签对照。提示词及工作流的 prompt/settings 原文不翻，放在标为原文的 pre 中。技术资料按中文逐段翻译，保留所有出处、数字、表格与原文范例；构建时检查段落结构与内容完整性，中文原始 Markdown 保持只读。

同页语言切换无需 JavaScript；启用后只在 `pcv-lang` 储存偏好，永不自动转址。偏好不同于当前页面时显示可关闭提示；关闭状态保存在当前分页的 sessionStorage，跨页有效，主动选择语言后重置。Cookie 同意仍共用 `pcv-consent`，每种语言都有完整 GA4 默认拒绝、同意与撤回控制。英文法律正文保留 v0.3 原文（其中旧栏目名、原推广标签和双语 Cookie 设置文字作为原文保留）。

canonical、og:url、hreflang 与 sitemap 均用最终路径 `/tips`、`/regions`、`/takedown`，含所有语言对应网址；旧 `.html` 文件继续产出，导航仍可使用旧连结。其余目录路由不变，三语 hreflang 互指，x-default 指中文。构建 API 保留 `pages` 中文磁盘路由，并新增 `localizedPages` 完整三语描述清单，`sitemapUrls` 为全部最终网址。

## 工作流

第四个分页为 `/prompts/workflow/`，详情为 `/prompts/workflow/<id>/`，两者都有 en/ja 版本。`data/workflows.json` 使用 `{ "entries": [...] }` 外层结构，与提示词资料和外部 gate 的读取约定一致。只收指定的五条公开来源：作者、原帖、依序工具链、至少两个连续编号步骤、原文提示或设置、标签与收藏笔记。原文 prompt/settings 与 sourcePost 的来源指纹由测试锁定；不把工作流作为 medium 值，也不改旧类别筛选与 validateMedia。工作流一律无推广按钮。

`validateWorkflows` 检查作者与网址对应、编号、工具链、内容完整性，以及中文、英文、日文禁词。缺公开提示的步骤明确说明，并保留作者的设置原文；原文块可复制。空资料 fixture 保留分页与零计数，并显示即将推出，不生成空详情页。

缩图脚本现在合并提示词与工作流 id，仍使用同一套 250ms 间隔与失败保留旧值规则。五条初始缓存来自指定来源文件的公开预览地址与片长（source 为 provided-preview）；本环境实际请求失败，保留这些值并记录 stale。图片仍直接引用 pbs.twimg.com，不下载图片或影片。外部可再次运行抓取脚本更新快取。

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
lang: zh
---
```

slug 可省略，使用文件名；仅接受小写英文、数字与短横线。title、date、summary 必填，日期必须有效；正文用现有 Markdown 转换器，原始 HTML 转义、链接仅接受 HTTP(S)。署名为 Punkcan，只有 aiAssisted: true 才输出「AI 辅助整理，作者审校」。没有文章时，列表保留导航并显示「即将推出」及栏目说明，不生成不存在的文章页。测试文章只在 test/fixtures/essays/。

原文文件为 `<slug>.md`，可标 `lang: zh`；译文用 `<slug>.en.md`、`<slug>.ja.md` 并沿用相同 slug，front matter 的标题与摘要写对应语言。缺译时仍生成该语言入口并明确标示显示原文，canonical 指原文页；hreflang 与 sitemap 仅列真实存在的译本。不会把译文算作额外文章，正式目录继续不放示例。

## 推广链接与推荐工具

`data/affiliates.json` 按平台配置 name、url、models，models 使用原始模型名。空网址或非 HTTP(S) 不输出按钮或空容器。对应模型出现「去 XX 试试」及「推广连结」标签；所有推广链接均使用 target="_blank" rel="sponsored noopener noreferrer"。

本版仅启用已批准的 Higgsfield 与 Magnific 链接：Higgsfield 出现在其对应 4 条卡片及详情页；Magnific 放在技术与资源页的推荐工具区，不塞进视频卡片。平台有 code 字段时显示「推广码 xxx」，无 code 不输出；Magnific 的推广码为 GMRPOCT43296。其他平台网址保持空字符串。

所有页尾保留揭露：「本站部分按钮为推广连结，通过它们注册或购买，本站可能获得佣金，不影响你的价格。」按钮旁标签及页尾揭露均链接到 `/affiliate-disclosure/`。不添加推广平台自己的追踪脚本。

## Google Analytics 与 Cookie 选择

每个 HTML 的 head 都加载指定 GA4 `G-NPK7CFCCT0`，先将 Consent Mode v2 的 analytics_storage、ad_storage、ad_user_data、ad_personalization 四项设为 denied，再按已保存的接受选择恢复 granted，最后执行 Google tag config。只有批准的两段内联模板与精确 Google tag 地址通过脚本白名单；Impact 验证保持不动。

Cookie 横条提供「接受／拒绝」，选择保存为 `localStorage['pcv-consent']` 的 granted 或 denied，已选择时不再出现。底部条通过测量自身高度为 body 留出空间，宽度改变时重新测量，手机上不会压住页尾内容。所有操作为原生按钮，可键盘使用。

页脚及 Privacy Policy 的「Cookie 设置」会清除选择、立即将四项更新为 denied，并重新打开横条。跨标签页修改会同步；存储被浏览器禁止时当前选择仍生效，但下次访问可能再次询问。Google tag 在 denied 状态也会加载，可能发送无 Cookie 的测量信号，不宣称拒绝后没有任何请求；浏览器可清理既有 Cookie。隐私说明另列 X 嵌入与推广方的独立处理、未来 AdSense 和 Resend 计划，未安装这些未来服务。

实现依据：[Google Consent Mode 官方说明](https://developers.google.com/tag-platform/security/guides/consent)、[Google 合作网站信息使用说明](https://policies.google.com/technologies/partner-sites)。verify 与测试完全离线，不加载实际 Google 或 X 脚本。

## 隐藏栏目与订阅

`data/site.json` 的 models.enabled 为 false。所有对外 HTML、导航与 sitemap 都不出现该资源入口；verify 检查相关路径和文字。

newsletter 保持 enabled:false、provider:beehiiv、embedUrl:""，逻辑沿用 v0.2，整块隐藏，导航不加电子报入口。将来启用仅接受 HTTPS 且精确域名为 beehiiv.com 或 embeds.beehiiv.com 的嵌入地址；为空、无效或关闭时均不输出空框。本版不创建账户或订阅。

## 地区与申诉栏目

地区数据、官方来源、2026-10-21 检查日期与中文免责声明沿用 v0.2。摘要与界面三语；原禁词清单不改，并新增英文与日文禁词。仅整理官方政策与申诉管道，不提供也不推荐任何绕过地区限制的方法。`lib/regions.mjs` 的禁词常数对完整 JSON 和整页 HTML 执行校验；verify 不发网络请求。原始参考文字不进入仓库。

## 构建、测试与部署

Node.js 22.8 或更新版本，无需 npm install。

```sh
npm run build && npm test && npm run verify
```

本版新增离线测试可单独运行：

```sh
node --test --test-isolation=none test/v03.test.mjs
node scripts/verify-v03.mjs
node --test --test-isolation=none test/v04.test.mjs
node scripts/verify-v04.mjs
```

测试覆盖假 X API 分批、syndication 解析和间隔、失败保留旧缓存、missing 与坏缓存占位、敏感内容、片长、三媒介分页、63 条详情与 sitemap、可选原创笔记、文章 fixture、推广属性、延迟加载 widgets 和图片失败回退。build/test/verify 不访问网络；只有手动运行 fetch-thumbs 会请求网络，不下载任何媒体文件。

v0.2 的两段空推广配置测试已按复审要求使用 `test/fixtures/affiliates-empty.json`，原断言逐项保留；构建测试输出到临时目录，不改真实配置或正式 dist。真实 Higgsfield／Magnific 配置及 sponsored 属性单独验证，下架页与地区页仍严格断言零推广按钮。verify 的站名、完整 sitemap 与脚本精确白名单按 v0.3 及 GA4 补充需求校验，保留 Impact、内容、来源、媒体文件和推广安全检查。新增测试另覆盖 GA4 默认值顺序、已同意恢复、接受／拒绝／撤回、存储不可用、缺 ID 失败，以及五页 canonical、日期、sitemap、全站页脚入口与披露链接。

部署由外部负责，在项目根目录运行：

```sh
npx wrangler pages deploy dist --project-name fight-prompts
```

Wrangler 会自动带上根目录 functions/。middleware 仅将 www.punkcanverse.com 与旧正式 Pages host 301 到 HTTPS apex，保留 path/query；预览子域名和 apex 调用 next()。旧 tips.html、regions.html、takedown.html 文件保留；安全标头与 Impact 站点验证保持不动。

.env* 已忽略。密钥只从执行环境读取，不写入文件、不打印 token，不保存真实对话、未确认的联系方式或账户资料。所有实际 X 播放、图片加载、移动端视觉与推广落地页需要在浏览器中人工验收。

可选离线排版检查（需要已有 Chrome，无需安装套件）：

```sh
node scripts/check-layout.mjs
```

它用本地 dist 去除远端资源，阻断 HTTP(S)，检查三语代表页在 360／390／1440 的 document 宽度，含后备字体与 Cookie 条。当前沙箱不允许 Chrome 的 setsockopt，自动排版测量无法完成；请在可启动 Chrome 的环境执行，并人工确认移动端导航、播放、语言选择与原文复制。交付记录与三语各十句抽样见 [v0.4 复核记录](docs/v04-review.md)。

作者：[@punkcan](https://x.com/punkcan)
