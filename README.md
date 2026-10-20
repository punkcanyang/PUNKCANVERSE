# AI 视频提示词站 v0.1

老闆个人自用的打斗／械斗 AI 视频提示词收藏站 v0.1。收录 63 条案例，按模型与标签筛选，复制提示词，并通过 X 官方嵌入查看成片。界面使用简体中文，收录资料保持原文。

纯静态 HTML、CSS 和 JavaScript，使用 Node 内建模块构建，无框架、无 npm 依赖、无登录、无数据库、无后端或 Functions。目标部署为 Cloudflare Pages 的 `*.pages.dev`。

## 内容规则

- 提示词库只收录打斗／械斗，共 63 条；每条必附作者、作者主页与 X 原帖链接。
- 提示词超过 1500 字元时，只放前约 300 字摘录及原帖链接；复制内容为摘录、换行与「完整版：原帖链接」。短提示词显示并复制全文。
- 不放截图，不存任何视频或图片文件；成片只用 X 官方嵌入，接近视口时才加载。X 被屏蔽时仍保留「在 X 上观看」链接。
- 不收阿里云官方文档示例作为提示词条目；写法要点里的官方文档引用属于学习参考，保留资料原文与出处。
- 提示词版权归原作者，本站只收录文字并附原帖，影片以 X 官方嵌入显示，不转存。
- 作者如希望下架，无需先证明身份，我们会在 **48 小时内处理**。网站各页页尾都有[下架入口](https://fight-prompts.pages.dev/takedown.html)，也可直接[提交下架 issue](https://github.com/punkcanyang/fight-prompts/issues/new?template=takedown.md&title=%E4%B8%8B%E6%9E%B6%E7%94%B3%E8%AF%B7)。

## 页面与使用

- `index.html`：完整静态卡片、模型／标签筛选、提示词复制与惰性 X 嵌入。同类多选取并集，模型与标签取交集。筛选立即生效，显示「共 N 条」，可清除筛选。
- 筛选写入 query，例如 `?model=Seedance&tag=冷兵器`；多选用重复参数。支持分享、刷新和浏览器前进／后退。未知筛选会提示，可清除；零结果会显示空状态。
- `tips.html`：打斗、Wan 3.0、MiniMax H3 三份写法要点，有页首目录、表格、代码示例与复制按钮。
- `takedown.html`：下架说明与 GitHub issue 入口。
- 360px 手机屏幕为单栏，筛选默认收合，可展开多选；桌面为双栏。仅使用系统字体和本地 CSS。
- 复制优先使用 Clipboard API，失败时用 textarea + execCommand 退回，结果以约 1.5 秒 toast 提示。全部失败时可手动选取。
- 禁用 JavaScript 时仍可阅读全部提示词与要点，并打开作者与原帖；交互筛选、复制与 X 成片嵌入需要 JavaScript。

## 数据来源与更新方式

数据源是仓库中已经整理好的 `data/prompts.json` 与 `data/tips/fight.md`、`wan3.md`、`minimax-h3.md`。提示词来自作者公开的 X 原帖，各条保留作者与原帖链接；写法要点中的引用出处保留在原文中。

`data/` 是内容来源，本次实现只读，构建不会改写它。后续由内容维护者核对来源和版权、整理数据，再通过代码审查更新；当前 v0.1 的校验固定为 63 条，扩容时需同步调整数量规则、文档与测试。

`build.mjs` 从数据生成三页 HTML 和 `dist/data.json`，将本地脚本、样式及 `_headers` 复制到 `dist/`。提示词正文在构建时 HTML escape；长提示词没有完整原文。Markdown 转换器支持标题、嵌套清单、表格、引用、围栏代码、行内代码、强调与链接；不允许原始 HTML，只接受 HTTP(S) 链接。不会抓取或下载任何原帖媒体。

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

`npm run verify` 检查 63 条数据、唯一 id、必填字段、X 原帖格式、复制长度、数据原样发布与 `data/` 未修改、页面页尾、下架模板、官方嵌入模板、安全标头、第三方脚本白名单，以及 `dist/` 与 Git 追踪／待追踪文件中没有图片、影片或禁止域名。

本地可用任何静态 HTTP 服务器预览 `dist/`。不要直接用 `file://` 打开页面，浏览器模块与数据 fetch 需要 HTTP。

## 部署到 Cloudflare Pages

Cloudflare Pages 的 Git 构建设置：构建命令 `npm run build`，输出目录 `dist`，Node.js 22.8 或更新版本，无框架预设。仓库中的 `_headers` 会随构建发布，设置 `nosniff` 与 `strict-origin-when-cross-origin`，不额外设置 CSP。

已有 Wrangler 使用环境时，部署命令为：

```sh
npm run build && npm test && npm run verify
npx wrangler pages deploy dist --project-name fight-prompts
```

也提供等价部署脚本 `npm run deploy`。Wrangler 是部署工具，不是项目依赖；凭据在部署环境配置，不写入仓库。

网站唯一第三方脚本是 `https://platform.twitter.com/widgets.js`，没有 analytics 或其他第三方脚本。

作者：[@punkcan](https://x.com/punkcan)
