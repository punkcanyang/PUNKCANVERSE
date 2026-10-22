# v0.4 复核记录（2026-10-22）

接续 WIP 7b8ffb9，保留原有模块接点。未 commit、push 或部署。

## 改动范围

- `build.mjs`：三语页面、同页切换、工作流列表与详情、最终 canonical/og/hreflang/sitemap。
- `data/workflows.json`、`data/i18n/`：五条指定来源与三语 UI、提示词收藏笔记、工作流步骤、地区摘要、法律及技术资料。
- `data/thumbs.json`：仅新增五条工作流预览；原 63 条快取逐项与 HEAD 精确比对。
- `lib/i18n.mjs`、`routes.mjs`、`workflows.mjs`、`cards.mjs`、`essays.mjs`、`regions.mjs`、`markdown.mjs`：资料校验、翻译渲染与文章缺译处理。沿用 WIP 的 affiliates/analytics/posts/site-pages/media-tabs 接口。
- `web/app.mjs`、`language.mjs`、`embeds.mjs`、`site.css`：本地偏好提示、原文复制、多语动态讯息与响应式布局。
- `scripts/fetch-thumbs.mjs`：沿用 WIP 合并工作流目标；既有假 fetch 测试保留，并补工作流目标测试。
- `scripts/verify*.mjs`、`test/v04.test.mjs`：三语完整性、工作流坏资料、禁词、文章译本与无自动转址等离线验证。

## 既有断言处理

除核准变更外，既有测试文件不改。`test/consent-pages.test.mjs` 将英文法律正文检查指向 `/en/privacy/`；英文法律更新日精确检查改为 `/en/...` 的 2026-10-22，旁边注明规格变更。原中文 canonical 仍精确检查。旧 verify 的中文文案断言保留在中文页面上，英日新增对应语言的同等精确检查；sitemap 清单扩为三语最终路径并加工作流。新数据不受旧只读路径阻挡，但有独立严格校验；旧提示词与写法要点仍受原基线保护，旧 63 条缩图另加逐项基线比对。`lib/media.mjs`、v0.2 类别筛选与其测试未改。

英文法律正文按要求保留 v0.3 全文；其中原有的 AI 工作论、推广标签引用、双语 Cookie Settings 原文是译文扫描的明确例外，其余英日页面不允许中文界面残留。

## 三语抽样（每语十句）

| 中文 | English | 日本語 |
|---|---|---|
| 创作，从这一帧开始。 | Your next idea starts with a frame. | この一コマから、次の作品へ。 |
| AI 视频、图像、音乐的创作入口。收藏提示词，拆解镜头，留下制作笔记。 | A starting point for AI video, image and music. Save prompts, study shots and keep notes from the process. | AIの動画・画像・音楽制作の入り口です。プロンプトを集め、映像を読み解き、制作の記録を残します。 |
| 从原作者公开的步骤出发，看工具如何接力完成一支影片。 | Follow the steps creators have shared and see how their tools work together. | 作者が公開した工程をたどり、複数の道具をどうつなぐかを見ていきます。 |
| 作者未公开这一步的提示词 | The creator has not shared a prompt for this step. | この工程のプロンプトは公開されていません。 |
| 从角色图到成片，逐步整理作者公开的制作过程。 | From character images to a finished clip, we document the steps creators have shared. | キャラクター画像から完成映像まで、作者が公開した工程を順にまとめます。 |
| 关于创作、工具与工作方式的长期笔记。 | Ongoing notes on making things, choosing tools and finding a way to work. | 制作や道具の選び方、仕事の進め方を考える、継続的な記録です。 |
| 这里将记录 AI 如何进入创作过程，以及我们如何选择、判断和工作。文章将在作者审校后发布。 | Notes on where AI fits in the creative process, and how we choose, judge and work. Essays will appear after the author’s review. | 制作の中でAIをどう使い、どう選び、どう判断するかを記録します。記事は著者の確認後に公開します。 |
| 仅整理官方政策与申诉管道，不提供也不推荐任何绕过地区限制的方法。 | Official policies and appeal channels only. We do not offer or recommend methods of accessing services outside their supported regions. | 公式の方針と申し立て窓口のみをまとめています。対象地域外からサービスを利用する方法の案内や推奨は行いません。 |
| 我们使用 Cookie 了解访问情况，你可以接受或拒绝。 | We use cookies to understand visits. You can accept or reject them. | アクセス状況の把握にCookieを使用します。同意するかどうかを選べます。 |
| 本站部分按钮为推广连结，通过它们注册或购买，本站可能获得佣金，不影响你的价格。 | Some buttons are affiliate links. If you register or buy through them, we may earn a commission at no extra cost to you. | 一部のボタンはアフィリエイトリンクです。リンク経由の登録・購入により当サイトに報酬が入る場合がありますが、お支払額は変わりません。 |

## 验收与限制

`npm run build && npm test && npm run verify` 全绿：246 个 HTML 页面，94/94 测试，18/18 既有 verification checks，加 v0.3/v0.4 全页校验。外部商务 gate 同样通过：提示词缩图 63/63、工作流缩图 5/5、240 条 sitemap 网址，GATE OK。

- 自动 build/test/verify 全程离线。工作流 prompt/settings/sourcePost 以指定来源的 SHA-256 指纹精确锁定，五条均有公开缩图快取。
- 实际执行了工作流 syndication 抓取；本环境五条请求均失败。已用指定来源文件的预览网址与片长建立可保留快取，source=provided-preview，重试失败后记录 stale，不伪称本次抓取成功，也没有下载媒体。
- Chrome 启动被沙箱 setsockopt 权限挡住，尚未完成实际排版宽度量测。`node scripts/check-layout.mjs` 可在可启动 Chrome 的环境离线量测三语与三种宽度；本报告不把未完成的浏览器量测算作通过。
- 老板亲手试：360／390 手机与 1440 桌面三语长标题、导航及 Cookie 条；同页语种切换、刷新偏好提示且不自动转址；五条工作流缩图、点图播放和缺图回退；逐步复制与原帖来源；Higgsfield 四条推广、Magnific 推荐区及各语揭露；真实 GA4 接受／拒绝／撤回。外部重新抓取或上线后检查 X 图片可达性。
