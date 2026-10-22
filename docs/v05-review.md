# v0.5 复核记录（2026-10-22）

当前所有指定关卡通过：build 636 页，113 项测试通过，verify 18/18，外部 gate OK。105 条应有媒体的新 X 条目已具备真实 syndication 缩图缓存，仅保留来源已确认无媒体的 PixelAigc 占位；未修改外部 gate 或放宽既有断言。

## 文件与行为

- 新增 `data/prompts-wan-minimax.json`：129 条、Wan 系 113 / MiniMax 16、X 106 / 官方 23、精选 26；所有提示词全文或 300 字摘录直接取自指定源。`data/prompts.json` 字节 SHA256 锁定为 `05f91fb5ae33b25cbb7db685db7c405206c94f25fe7bc2f4c2447f36a2375c08`，仍为 63 条。
- `lib/catalog.mjs`、`lib/import-provenance.mjs`：两档稳定合并、全站 ID 唯一、独立官方 / X 验证、分段 ID 的精确规则、原文与出处指纹。`test/fixtures/v05-source-manifest.json` 保存一次性来源快照，不收完整长提示或页面附件。
- `build.mjs`、`lib/routes.mjs`、`web/app.mjs`：影片库共 192 条；新增三语 `/prompts/fight/`，仅原来的 63 条。`dist/data.json` 保持旧资料兼容；`dist/catalog.json` 为前端使用的合并资料。三语共 636 HTML、630 sitemap 最终网址。
- `data/i18n/{zh,en,ja}.json` 与 `data/i18n/content/{zh,en,ja}.json`、`lib/i18n.mjs`：129 条标题、收藏笔记、画幅说明及新增标签，三语官方署名、官方长文入口、精选标记、同帖分段说明。全部原有翻译值保持不变。
- `lib/cards.mjs`、`lib/posts.mjs`、`lib/prompts.mjs`、`web/language.mjs`、`web/site.css`：官方纯 CSS 占位，无图片、播放按钮或 X 模板；长文复制及阅读全文转向官方来源。Kangaikroto 两段分别保留，嵌入同帖。原敏感帖处理不变。
- `lib/affiliates.mjs`：新收录一律不输出推广；未修改推广配置。
- `scripts/fetch-thumbs.mjs`、`data/thumbs.json`：抓取目标合并两档 X 条目与工作流，官方排除；增加 `--missing-only`，跳过现有有效缓存。初次抓取因 DNS 失败未能补图；本轮重跑时工作树已补齐 105 条有效新缓存，`--missing-only` 跳过这些缓存，仅尝试已确认无媒体的 1 条，失败不清除已有图片。PixelAigc `2110747397441917172` 已知无媒体，继续正常占位。
- `scripts/verify-v05.mjs`、`test/v05.test.mjs`：新增离线检查并保留既有所有非数量断言。
- `lib/import-thumbnails.mjs`、`test/v05-thumb-cache.test.mjs`：发布检查明确要求新 X 条目的有效原图，只有已确认无媒体的 PixelAigc 可以 missing；新增 3 项回归测试覆盖缺图、非法网址、错误 postId、官方混入缓存与分段映射。`scripts/check-layout.mjs` 补入原 63 条专栏、官方页与新长提示页作为三语宽度样本。
- `README.md`：更新资料、栏目、官方范例与复制、抓图及复核入口。

## 第 6 节：既有数量期待的每一处变更

以下每处代码旁均有 `// v0.5 spec change (boss 2026-10-22): ...` 注释；其余旧断言不动。原档 63 条、旧 X URL 规则、原文、敏感帖、推广限制、禁词正则、工作流及法律指纹均未放宽。

| 文件:行 | 旧值 → 新值 | 原因 |
|---|---|---|
| scripts/verify.mjs:167 | 首页 prompt-card 63 → 192 | 两档稳定合并 |
| scripts/verify.mjs:169–170 | X 模板数量 62 → 精确 168 | 新增 106 条 X；23 条官方与原 1 条敏感帖不嵌入 |
| scripts/verify.mjs:169–171 | X 观看链接数量 62 → 精确 168 | 与可嵌入 X 卡片一一对应 |
| scripts/verify.mjs:179 | cards.size 63 → 192 | 检查所有原卡片仍在，同时包含新条目 |
| scripts/verify.mjs:260–262 | sitemap 期待集合 240 → 630 | 每语增加 129 个详情及 1 个原 63 条专栏；仍逐项精确比较完整 URL 集合与顺序 |
| scripts/verify-v03.mjs:29–32 | 页面描述 246 → 636，sitemap 240 → 630 | 只扩大页面范围，原资料与旧 63 条检查保留 |
| scripts/verify-v04.mjs:41 | 三语资料覆盖 63 → 192，页面集合 246 → 636 | 三语、元数据、禁词及完整页面集合同样严格覆盖新资料 |
| test/v04.test.mjs:24 | 三语测试 entries 覆盖 63 → 192 | 所有原断言不变，新增内容也必须通过 |
| test/v04.test.mjs:120 | localizedPages.length 246 → 636 | 129 个详情 × 3 语 + 原专栏 × 3 语 |
| test/v04.test.mjs:123 | 实际 HTML 文件数 246 → 636 | 与页面描述精确一致 |

新的资料文件另有严格 schema / 来源指纹检查；旧资料目录保护仅为此新增文件增加排除，不改变既有文件的保护。`dist/data.json` 仍只含原 63 条，旧数据数量与逐条来源断言保持原样。

## 新增测试（14 项）

1. 192 / 63 / 129、106 / 23、113 / 16、5 条 Prime、26 条精选与稳定顺序；旧档字节不变。
2. 129 条原文 / 摘录、长度、作者、日期、出处指纹；篡改原文与长度必须失败。
3. 1500 / 1501 字符边界、300 字摘录及对应出处复制。
4. X 与官方分支的错误 handle、网址、重复 ID、伪造官方来源等坏 fixture 全部拒绝。
5. Kangaikroto 两段分别存在、不同摘录、共用原帖；错误 embedId、缺第一段或异作者均拒绝。
6. 三语官方页和卡片无图片 / 嵌入 / 推广，有真实出处、三语署名与官方长文复制。
7. 给 Wan / MiniMax 人造推广网址也不渲染，原 Higgsfield 四条不变。
8. 三语 192 条与标签完整、26 条新精选、Pixel 无媒体占位、My player 2 以客厅沙发为准。
9. 假 fetch 合并两档与工作流、排除官方、分段取 embedId、250ms、失败保留、仅补缺图。
10. 192 张卡片仅观察 168 个可嵌入目标，不批量渲染；仅接近视口者载入，图片仍 lazy / async。
11. 完整离线 build 636 页 / 630 sitemap、192 卡与原专栏 63 卡、129 条三语详情，通过 v0.5 专用 verify。
12. 发布缓存精确有 105 条新 X 原图，唯一无媒体条目占位，23 条官方不得进入缓存。
13. 缺记录、missing、非法域名或协议、错误 postId 的 fixture 均被发布检查拒绝。
14. 无媒体例外只适用于已确认的 PixelAigc；其他 X、官方、分段错配不得借此通过。

## 实际关卡与阻碍

已运行 `npm run build && npm test && npm run verify && python3 /workspace/bd-punkcan/v05-gate.py`，退出码 0。build 636 页；npm test 113/113；npm run verify 18/18，另含 v0.3 / v0.4 / v0.5 专项检查；Python gate 为 OK。新 X 有效图片 105/106，唯一例外为已确认无媒体的 PixelAigc；原提示缩图 63/63、工作流 5/5。gate 的 X 统计为 169/169（包含获准的无媒体占位），其余 192 条资料、23 官方、151 个 UI 键、630 sitemap 均通过。

根因是之前未取得真实缩图缓存，原 verify 只检查“抓取尝试已记录”，因此 missing 状态也通过，而商務 gate 要求除已确认无媒体帖外必须有图。本轮保留现有 105 条有效 syndication 缓存，并新增更严格的离线发布检查与回归测试；不修改 gate，不允许任意 missing 条目通过。当前环境仍有 DNS 解析限制，已补齐的缓存不会被网络失败清掉；未使用假图或第三方图片补位。

可选 `node scripts/check-layout.mjs` 也已尝试；Chrome 因沙箱 `setsockopt: Operation not permitted` 无法启动，不能宣称 360 / 390 / 1440 已测过。该脚本现在包含 11 类页面 × 3 语言 × 3 宽度，共 99 组离线排版检查，须在可启动 Chrome 的环境执行。

## 三语各十句抽样

下表逐字取自新收藏笔记，对应同一条目的中、英、日句子；提示词原文未翻译。

| ID | 中文 | English | 日本語 |
|---|---|---|---|
| aliyun-wan3-example-01 | 用低垂眼神與指尖輕顫表達專注，環境音與手部特寫一起支撐寧靜感。 | Downcast eyes, trembling fingertips and close framing express concentration, with ambient sound carrying the quiet mood. | 伏せた視線と指先の小さな震えを寄りで捉え、環境音とともに静かな集中を表します。 |
| aliyun-wan3-example-04 | 向前延長 15 秒時重述兩人的服裝與相視微笑，讓新增段落接回原影片。 | The fifteen-second opening extension restates both outfits and the shared smile to connect new footage with the existing clip. | 冒頭を15秒延ばす際に二人の服装と微笑みを再指定し、元の映像につなげます。 |
| 2109902576367947891 | 10 秒直式近景以好奇眼神和微表情推進提問，重點是表演細節而非大動作。 | A ten-second vertical close-up builds the question through curious looks and microexpressions rather than large movements. | 10秒の縦画面の寄りで、好奇心のある視線と微表情から問いを進めます。 |
| 2104507931337400770-2 | 第二段用 20 秒的擁抱與互動延續情緒，成片與段一共用同一則原帖。 | Part two uses a twenty-second embrace and interaction to continue the emotional arc; both parts share one source video. | パート2は20秒の抱擁とやり取りで感情を引き継ぎ、パート1と同じ元投稿の映像を参照します。 |
| 2104269342275698713 | 場景是夜晚客廳沙發上的雙人打電動，以 30 秒不間斷運鏡和碰不到的擊掌表達離別。 | The setting is a couch co-op game at home at night; a thirty-second unbroken move and a missed high-five express farewell. | 夜の居間のソファで二人がゲームをする場面です。30秒の長回しと届かないハイタッチで別れを表します。 |
| 2109845973124210929 | 15 秒正方形片從拼貼海報進入地標，四格匹配剪接與角色參考分區寫；原帖另有三模型比較。 | A fifteen-second square film moves from a collage poster through landmarks, using reference locks and four-panel match cuts; the post compares three models. | 15秒の正方形映像でコラージュから名所へ入り、参照固定と四分割のマッチカットを使います。元投稿は三モデル比較です。 |
| 2100161820988440853 | 氛圍、分鏡與音效分區寫，同一人物參考和提示另比 Seedance 2.5；這條保留失敗經驗。 | Atmosphere, shots and sound are separate; the same references and prompt are compared with Seedance 2.5, retaining the failed attempt. | 雰囲気、ショット、音を分け、同じ人物参照と文章をSeedance 2.5とも比較した失敗例です。 |
| 2111150964983898453 | 30 秒固定首幀與遊戲流程，明講不生成 UI；HUD 是作者另以 Figma 後製。 | Thirty seconds preserve the first frame and gameplay flow while explicitly excluding generated UI; the creator added the HUD in Figma. | 30秒で開始画像とゲームの流れを保ち、UIを生成しないと明記しています。HUDは作者がFigmaで後から加えています。 |
| 2102426880016253191 | 影片提示只寫戲曲動作、服裝與靠旗飄動、鏡頭慢推，不混入同帖的生圖提示。 | The video prompt focuses on opera movement, costume, flags and a slow push-in, leaving out the post’s image-generation prompt. | 動画の文章は所作、衣装や背旗の揺れ、ゆっくりした寄りに絞り、同じ投稿の画像生成文を混ぜません。 |
| 2110747397441917172 | 首尾輸入同圖，短提示只寫坐船人物與鏡頭環繞 360 度；主帖沒有媒體，不補假圖。 | Identical endpoint images accompany a short boat-and-360-degree-orbit prompt; the main post has no media, so no substitute image is used. | 同じ開始・終了画像で船の人物を360度回る短文です。主投稿に媒体がないため、代わりの画像は置きません。 |

## 老板亲手试

- 外部部署后抽验新 X 原图、VIDEO / 片长、点击后才载入、X 被挡的回退；图片仍直接引用公开 X 原址，不转存。
- 三语各看首页、视频库、原 63 条专栏、官方示例及新长文，测试模型 / 标签组合、URL 状态、显示更多与语言切换。
- 两段首尔便利店各自复制正确摘录，打开同一来源帖；My player 2 收藏笔记为沙发双人游戏，竹林武侠原作者为 sipteaandcoffee。
- 官方示例无可播放的假图块，外开阿里云原文；长文按钮和复制均指向官方来源。Pixel 无媒体占位应正常。
- 360 / 390 / 1440 三语视觉及长英文摘录、日文换行；Cookie 条、键盘按钮、GA4 同意与撤回。
- 原四条 Higgsfield、Magnific 推荐区、5 条工作流、敏感帖、301 与 canonical / hreflang 保持原行为。

未 commit、push 或部署。
