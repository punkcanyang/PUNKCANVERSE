# v0.5.2 交付记录

已把 22 张核准的官方示例影片截图原样加入 `web/img/official/`，共 541,972 字节。`data/prompts-wan-minimax.json` 只在对应 22 条增加 `officialThumb`（本地路径、宽高、来源影片网址）；第 17 条及其他全部原有字段未改。`data/prompts.json`、`data/thumbs.json`、所有提示词原文不变。

三语首页、视频列表及详情使用本地 WebP、标题 alt、width/height、lazy/async。图片框固定 16:9，直式第 20 条置中裁切；第 17 条维持 CSS 占位且没有 img。图片连到对应官方原文，来源行三语完整显示，无 sponsored，也没有 X 嵌入或 X 图片。未改 OG 图片设置。

改动分组：

- `build.mjs`、`lib/cards.mjs`、`web/site.css`：渲染与原样复制图片。
- `data/prompts-wan-minimax.json`、`data/i18n/{zh,en,ja}.json`：22 条图片字段与三语来源行。
- `lib/official-frames.{mjs,json}`、`lib/catalog.mjs`、`lib/fulltext.mjs`：核准清单、图片字段验证、旧元数据保护。
- `scripts/verify-v052.mjs`、`scripts/verify.mjs`、`scripts/verify-v03.mjs`、`scripts/verify-v05.mjs`：仅允许指定 22 个路径和原始 SHA-256 的图片，保留禁止 X 媒体的要求。
- `test/v052.test.mjs` 新增 5 项测试；`test/v03.test.mjs`、`test/v05.test.mjs` 按本版核准范围更新官方图片断言；README 更新本地官方截图例外。

## 既有断言与精确基线逐项对照

每处均标注 `// v0.5.2 spec change (boss 2026-10-22): real official sample frames`。未更改保护路径集合、全文来源指纹、数量、推广分布或禁词断言。

| 文件:行 | 旧规则 → 新规则 | 原因 |
| --- | --- | --- |
| `test/v03.test.mjs:164` | X 缓存缺失时首页没有任何 img → 精确出现 01–23 中排除 17 的 22 个本地图片路径（顺序也精确比对） | 官方本地图片独立于 X 缓存，X 仍只能占位 |
| `test/v05.test.mjs:128` | 所有官方条目都有占位 → 22 条各有唯一指定本地 img 且无占位，17 有占位且无 img | 使用真实官方示例画面 |
| `test/v05.test.mjs:136` | 合并禁止 img 与 X／推广 → 保留所有 X／推广禁项，img 由前一组精确断言验证 | 仅区分获准的本地图和仍被禁止的 X 媒体 |
| `scripts/verify-v05.mjs:70` | 官方页无任何 img、都有占位 → 同上，22 条精确本地图、17 无 img；所有 X 禁项保留 | 发布校验同步新规则，另由 v052 校验原始字节 |
| `scripts/verify-v03.mjs:78` | 所有 img 必须来自 pbs.twimg.com → 仅允许该来源或核准清单中 22 个精确本地路径 | 本地图为本版唯一新增图片来源；原有属性检查保留 |
| `scripts/verify.mjs:133` | 仓库与 dist 禁止任何图片／影片文件 → 仅例外允许 22 个精确源文件及其 dist 路径 | `verifyV052` 同时逐个验证路径、字节长度、SHA-256、原样复制及不多不少的文件集合，其他媒体仍禁止 |
| `scripts/verify.mjs:239` | 导入数据只与既有全文迁移基线比对 → 基线额外精确加上这 22 条核准 `officialThumb` | deepEqual 断言保留，旧字段仍必须逐字段等于 HEAD |
| `scripts/verify.mjs:293` | 第二处导入数据基线 → 同上 | 第二道只读保护同样保持所有旧字段严格比对 |
| `lib/fulltext.mjs:30` | 全部旧元数据直接比对既有 SHA-256 → 新字段先与核准清单精确比对，再对所有旧元数据使用原来的 SHA-256 | 原 SHA-256 期待值完全未改，新图片字段独立严格校验 |

## 新增测试与执行结果

`test/v052.test.mjs` 的 5 项涵盖：22 张 WebP 与原始来源位元组相同、17 无图；非法路径／串图／尺寸／来源字段拒绝；所有旧元数据与 192 条全文不变；三语首页／列表／详情全部检查；必要图片属性、来源、禁止 X／推广及损坏发布文件的失败 fixture。测试屏蔽 fetch，未访问网络。

最新正常命令链复测（`p-v052-gatefix-v052a-2.md`，WIP `169bf14` 之后）：build 636 页；npm test 129/129；npm run verify 18/18 并含 v052 专项验证；商务 gate 显示 `official thumbs ok: 22`、`GATE OK`。本次直接执行原始命令链，没有临时 Git 索引或环境覆盖。

历史失败的原因是旧版 gate 把未追踪档案全部按严格 UTF-8 文字读取，遇到 WebP 即失败；WIP 只收录 15 个已有追踪档案，留下 27 个新档案未追踪（22 张 WebP、2 个 lib 档案、专项 verify、新测试及本文档），触发了这个问题。当前外部提供的 gate 已在两处 subprocess 文字读取加入 `errors='replace'`，本轮原始命令链因此可以正常完成。此前临时索引的成功结果仅作为历史诊断保留，不作为本轮通过依据。

本轮未改 gate、未隐藏或排除图片、未放宽任何断言，只更新本交付记录；程式、资料和全部 22 张原始图片保持不变。沙箱的 `.git` 仍唯读，git add 返回 `Unable to create .git/index.lock: Read-only file system`；这不再阻止当前 gate 通过，但外部提交仍须纳入这批新档案，避免全新 checkout 缺少模组和截图。

```sh
git -C /workspace/fight-prompts add -- docs/v052-review.md lib/official-frames.json lib/official-frames.mjs scripts/verify-v052.mjs test/v052.test.mjs web/img/official
cd /workspace/fight-prompts
npm run build && npm test && npm run verify && python3 /workspace/bd-punkcan/v052-gate.py
```

以上 git add 仅暂存，不 commit 或 push。外部 WIP 保存流程也需把这些新档案纳入，否则仅有已追踪档案的提交在全新 checkout 中会缺少被 import 的模组和全部官方截图。

未 commit、push 或部署。Chrome 离线版面脚本因沙箱 `setsockopt: Operation not permitted` 无法启动；请在预览页抽查 360／390／1440 的三语列表与详情，尤其第 20 条直式裁切、第 17 条占位、来源链接以及全文复制。
