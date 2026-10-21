# AI 提示词站 v0.2

老闆个人自用的打斗／械斗 AI 提示词收藏站 v0.2。收录 63 条视频案例，按模型与标签筛选，复制提示词，并通过 X 官方嵌入查看成片。另有「AI 工具各地区使用与申诉」官方资料栏目。界面使用简体中文，收录资料保持原文。

静态 HTML、CSS 和 JavaScript，使用 Node 内建模块构建，无框架、无 npm 依赖、无登录、无数据库。部署于 Cloudflare Pages，正式网址为 https://punkcanverse.com。只有一支处理 301 转址的 Pages Functions `_middleware`，无其他后端。

## 内容规则

- 提示词库只收录打斗／械斗，共 63 条；每条必附作者、作者主页与 X 原帖链接。
- 提示词超过 1500 字元时，只放前约 300 字摘录及原帖链接；复制内容为摘录、换行与「完整版：原帖链接」。短提示词显示并复制全文。
- 不放截图，不存任何视频或图片文件；成片只用 X 官方嵌入，接近视口时才加载。X 被屏蔽时仍保留「在 X 上观看」链接。
- 原帖确认删除或不可用时标记 `postStatus: "removed"` 与 `postCheckedAt: "YYYY-MM-DD"`；保留卡片、提示词、作者及复制，原帖链接标为「原帖（已失效）」，成片区显示检查日期和不可用说明，不创建嵌入模板或空框。
- 原帖是回复、影片在同作者串首时，可设置数字字符串 `embedId`；仅嵌入与观看链接改用该串首，显示「影片取自同作者的串首帖」。卡片原帖链接、完整提示词入口和复制内容仍指向原回复。没有 `embedId` 时沿用原帖。
- 上层不是同一作者时，使用 `replyNoVideo: true`，显示「此帖为回复，影片见原串」，保留原帖嵌入，不替换上层，也不设置 `embedId`。维护者须核对同作者关系，站点不自动寻找或改用其他作者的视频。
- 不收阿里云官方文档示例作为提示词条目；写法要点里的官方文档引用属于学习参考，保留资料原文与出处。
- 提示词版权归原作者，本站只收录文字并附原帖，影片以 X 官方嵌入显示，不转存。
- 作者如希望下架，无需先证明身份，我们会在 **48 小时内处理**。网站各页页尾都有[下架入口](https://punkcanverse.com/takedown.html)，也可直接[提交下架 issue](https://github.com/punkcanyang/fight-prompts/issues/new?template=takedown.md&title=%E4%B8%8B%E6%9E%B6%E7%94%B3%E8%AF%B7)。

## 页面与使用

- `index.html`：完整静态卡片、模型／标签筛选、提示词复制与惰性 X 嵌入。同类多选取并集，模型与标签取交集。筛选立即生效，显示「共 N 条」，可清除筛选。
- 筛选写入 query，例如 `?model=Seedance&tag=冷兵器`；多选用重复参数。支持分享、刷新和浏览器前进／后退。未知筛选会提示，可清除；零结果会显示空状态。
- `tips.html`：打斗、Wan 3.0、MiniMax H3 三份写法要点，有页首目录、表格、代码示例与复制按钮。
- `takedown.html`：下架说明与 GitHub issue 入口。
- `regions.html`：AI 工具各地区使用与申诉，附官方来源、中文摘要和检查日期。
- 360px 手机屏幕为单栏，筛选默认收合，可展开多选；桌面为双栏。仅使用系统字体和本地 CSS。
- 复制优先使用 Clipboard API，失败时用 textarea + execCommand 退回，结果以约 1.5 秒 toast 提示。全部失败时可手动选取。
- 禁用 JavaScript 时仍可阅读全部提示词与要点，并打开作者与原帖；交互筛选、复制与 X 成片嵌入需要 JavaScript。

## 数据来源与更新方式

数据源是仓库中已经整理好的 `data/prompts.json` 与 `data/tips/fight.md`、`wan3.md`、`minimax-h3.md`。提示词来自作者公开的 X 原帖，各条保留作者与原帖链接；写法要点中的引用出处保留在原文中。

`data/` 是内容来源，构建不会改写它。v0.2 只为原有 63 条提示词新增 `medium: "video"`，并增加 `affiliates.json`、`regions.json`、`site.json`；原有提示词正文、来源、失效状态和串首嵌入信息仍与 HEAD 严格比对。后续由内容维护者核对来源和版权、整理数据，再通过代码审查更新；当前校验固定为 63 条提示词，扩容时需同步调整数量规则、文档与测试。

`build.mjs` 从数据生成四页 HTML 和 `dist/data.json`，将本地脚本、样式及 `_headers` 复制到 `dist/`。提示词正文在构建时 HTML escape；长提示词没有完整原文。Markdown 转换器支持标题、嵌套清单、表格、引用、围栏代码、行内代码、强调与链接；不允许原始 HTML，只接受 HTTP(S) 链接。不会抓取或下载任何原帖媒体。

正式网址由 `build.mjs` 的 `SITE_URL` 常数设为 `https://punkcanverse.com`。四页输出对应的 canonical 与 Open Graph 信息；构建保留原有三页的 `sitemap.xml` 与对应严格校验，并生成允许全部抓取的 `robots.txt`。地区页可从所有页面的导航入口访问。

## medium 字段与类别切换

`data/prompts.json` 每条必须包含 `medium`，仅允许 `video`、`image`、`music`，对应「视频／图像／音乐」。现有 63 条全部为 `video`。只有至少两种类别有资料时才显示类别切换；单一类别不输出切换控件。类别与模型、标签组合筛选，状态通过 `?medium=image` 等 query 保留，清除筛选会一起清除类别；首页路径保持不变。

## 推广连结规则

`data/affiliates.json` 以平台为键，每个平台填写 `name`、`url`、`models`；`models` 必须使用提示词资料中的原始模型名。当前网址全部为空字符串。日后只填写经核对的 HTTP(S) 推广网址，匹配到该模型的卡片才会出现「去 XX 试试」按钮与旁边的「推广连结」标签，使用 `target="_blank" rel="sponsored noopener noreferrer"`。空值或不安全的协议不输出按钮、容器或占位间距。同一平台匹配多个模型时只显示一次。

所有页面页尾固定揭露：「本站部分按钮为推广连结，通过它们注册或购买，本站可能获得佣金，不影响你的价格。」站点不加载推广追踪脚本。

## 地区栏目内容界线

`data/regions.json` 的 `entries` 至少五条，每条包含唯一 `id`、`title`、`vendor`、2–4 句原创中文 `summary`、HTTPS `sourceUrl`／`officialUrl` 和检查日期 `checked`。本版七条摘要仅依据提供的官方页面文字，检查日期统一为 `2026-10-21`；原始文字档不放进仓库。政策页面如标注未来生效日，摘要会明确说明。与地区可用性或申诉无关的 FAQ 不收录。

页首声明：「仅整理官方政策与申诉管道，不提供也不推荐任何绕过地区限制的方法。」只收官方政策与申诉入口，不发布个人账户资料、对话或其他使用渠道。`lib/regions.mjs` 的单一常数 `REGION_BANNED_TERMS` 管理禁词清单；构建与 verify 对完整 JSON 和地区整页 HTML 都执行检查，命中即失败。字段缺失、重复 id、非 HTTPS 或未列入批准清单的来源同样失败。verify 不发网络请求，链接状态由外部另行检查。

## 周报开关（beehiiv）

`data/site.json` 默认是 `newsletter: { enabled: false, provider: "beehiiv", embedUrl: "" }`。准备好官方嵌入表单地址后填写 `embedUrl`，再将 `enabled` 设为 `true`。只有 HTTPS 且域名精确为 `beehiiv.com` 或 `embeds.beehiiv.com` 的地址才输出 iframe；其他域名、非标准端口、带凭据的地址都隐藏。关闭、网址为空或无效时，整块不出现在 HTML，没有空框。

启用后，周报说明与表单嵌入显示在各页页尾上方，采用延迟加载，不另加第三方脚本。本版不创建外部账户或订阅，不配置付费服务。

## 本地构建与验证

使用 Node.js 22.8 或更新版本，无需 `npm install`。

```sh
npm run build
npm test
npm run verify
```

或一次运行全部检查：

```sh
npm run build && npm test && npm run verify
```

`npm test` 使用 `node --test --test-isolation=none`，在同一进程执行测试，覆盖模型／标签／组合／清除与 URL 状态、短／长提示词复制内容、Clipboard API 回退及失败、Markdown 安全转义、表格、代码区块和安全链接，以及 X 嵌入的视口触发、筛选后重现、SDK 延迟／屏蔽与旧浏览器回退。

`npm run verify` 检查 63 条数据、唯一 id、必填字段、X 原帖格式、复制长度、数据原样发布与上述数据变更限制、删除状态／检查日期／串首元数据、逐卡嵌入与失效说明、页面页尾、下架模板、安全标头、第三方脚本白名单，以及 `dist/` 与 Git 追踪／待追踪文件中没有图片、影片或禁止域名。

新增转址测试覆盖正式来源域名、路径与 query 保留、HTTP 升级、apex 与预览域名不转址，以及 middleware 的 301／`next()` 行为。verify 也检查三页 canonical／Open Graph、sitemap、robots 与发布内容不再使用旧 Pages 绝对网址。

本地可用任何静态 HTTP 服务器预览 `dist/`。不要直接用 `file://` 打开页面，浏览器模块与数据 fetch 需要 HTTP。

## 部署到 Cloudflare Pages

Cloudflare Pages 的 Git 构建设置：构建命令 `npm run build`，输出目录 `dist`，Node.js 22.8 或更新版本，无框架预设。仓库中的 `_headers` 会随构建发布，设置 `nosniff` 与 `strict-origin-when-cross-origin`，不额外设置 CSP。

已有 Wrangler 使用环境时，部署命令为：

```sh
npm run build && npm test && npm run verify
npx wrangler pages deploy dist --project-name fight-prompts
```

也提供等价部署脚本 `npm run deploy`。请在项目根目录执行部署，Wrangler 会自动带上根目录的 `functions/`；该目录不复制进 `dist/`。Wrangler 是部署工具，不是项目依赖；凭据在部署环境配置，不写入仓库。

`functions/_middleware.js` 只调用 `lib/redirect.mjs` 的纯函数：仅当 host 完全等于 `www.punkcanverse.com` 或旧正式 host `fight-prompts.pages.dev` 时，以 301 转到 HTTPS 的 `punkcanverse.com`，保留 path 与 query。apex 本身、hash／branch 的 Pages 预览子域名与其他 host 都调用 `next()` 提供静态内容。转址无需第三方服务，也不使用 `_redirects` 比对 host。

网站唯一第三方脚本是 `https://platform.twitter.com/widgets.js`，没有 analytics 或其他第三方脚本。

作者：[@punkcan](https://x.com/punkcan)
