# v0.5.1 全文保存复核（2026-10-22）

完成 192 条全文保存。运行指定命令链退出码 0：build 636 页，npm test 124/124，verify 18/18，外部 v051 gate OK。全程离线，未修改外部 gate，未 commit、push 或部署。

## 文件与行为

- `data/prompts.json` 仅修改原 20 条长提示词的 prompt / promptExcerpt；其他字段、43 条短文及外层元数据保持原样。已直接与指定的 v051-fight-fulltext.json 逐条比对。
- `data/prompts-wan-minimax.json` 恢复 74 条长文，129 条全部逐字等于指定 v05-prompts-source.json；Kangaikroto 段二映射仍用既有来源索引。全文原文不翻译、不改写。
- `lib/cards.mjs`、`lib/prompts.mjs`、`web/language.mjs`、`web/site.css`：详情与卡片 details 都提供全文，复制只返回完整 prompt。详情默认是可读 pre，无 JS 也完整；长文可垂直滚动、长字串换行。保留作者、原帖／官方来源链接，去掉摘录提示。
- `lib/catalog.mjs`、`lib/import-provenance.mjs`、`lib/fulltext.mjs`、`lib/data-migration.mjs`：全文 schema、192 条全文来源及原元数据的精确 SHA256、仅 prompt / promptExcerpt 的授权迁移。isLong 仍为 >1500 的版面标记；旧 lengthThreshold / excerptLength 外层值为兼容保留，均无截断功能。
- `scripts/verify.mjs`、`scripts/verify-v03.mjs`、`scripts/verify-v05.mjs`、新增 `scripts/verify-v051.mjs`：所有条目复制全文、576 个详情 HTML 全文精确出现、无 JS 可读与无过时摘录提示，来源和元数据均逐字核对。
- `test/prompts.test.mjs`、`test/cards.test.mjs`、`test/v04.test.mjs`、`test/v05.test.mjs`：仅更新第 4 节批准的摘录／复制／全文期待，其他旧断言保留。旧负面 fixture 的 prompt-null / 摘录表示同步为全文；来源长度错误的 fixture 同时增加一个字，仍触发原来的来源长度错误断言，没有修改该断言。
- 新增 `test/v051.test.mjs`、`test/fixtures/v051-source-manifest.json`；README 更新全文规则。`scripts/check-layout.mjs` 加入最长三条作为离线版面样本。

192 条都满足 prompt 非空、promptLength === prompt.length、promptExcerpt === null。94 条长文恢复（20＋74），98 条原有短文保持。短条目既有 HTML 表示不变；恢复的长文使用文本节点转义，安全编码 & / < / >，保留引号为原文文字，满足浏览器展示与全文保存。新增恶意标签、引号及实体 fixture，证明无法跳出 pre 或执行脚本。

## 第 4 节：每处既有校验改动

每处改动旁均加了指定注释 `// v0.5.1 spec change (boss 2026-10-22): full prompt text on every page`。下表也列出受常数、基准及 fixture 表示变化影响的期待值。新增的更严格来源、元数据与完整 HTML 检查不取代其他功能断言。

| 文件:行 | 旧规则 → 新规则 | 原因 |
|---|---|---|
| `lib/catalog.mjs:30` | 长条目 prompt=null、300 字摘录；短条目全文 → 每条必须有非空全文、长度一致、promptExcerpt=null | schema 同步全文规则 |
| `lib/import-provenance.mjs:7` | 原 63 条旧档 SHA256 05f91fb5…2375c08 → 全文档 SHA256 ee125a81da51c3350ff13b2133d2bc365fb8eeb8561d41e0aba4b830f42d2356 | 精确固定仅恢复 20 条全文后的完整文件 |
| `test/v05.test.mjs:32` | 旧档字节指纹 → 同样精确比较新全文档指纹 | 引用常数的新期待值，数量与元数据规则不变 |
| `scripts/verify-v05.mjs:22` | 旧档字节指纹 → 同样精确比较新全文档指纹 | 引用常数的新期待值，保留整档校验 |
| `lib/import-provenance.mjs:30` | 长条目只比摘录 SHA256 → 129 条均比全文 SHA256 与既有来源 promptSha256 | 不再只核对开头 |
| `test/prompts.test.mjs:66` | 长条目复制摘录＋来源网址 → 完整 fixture 原文，逐字相等 | 长文复制新规则 |
| `test/prompts.test.mjs:74` | 复制长度 ≤1500 → 复制长度精确等于 promptLength | 不限制全文长度 |
| `test/prompts.test.mjs:76` | 长条目摘录＋来源网址，短条目原文 → 原 63 条均等于 entry.prompt | 长短文统一 |
| `test/cards.test.mjs:39` | Techie 复制摘录＋原回复网址 → 复制 Techie 全文 | 保留串首嵌入及原回复链接的所有其他断言 |
| `test/v04.test.mjs:234` | 三语长文复制摘录＋本语言网址前缀 → 三语均逐字等于 long.prompt | 提示词原文不翻、不追加文字 |
| `test/v05.test.mjs:53` | 长文只比摘录 SHA256 → 每条全文 SHA256 | 129 条来源完整核对 |
| `test/v05.test.mjs:55` | 复制长度 ≤1500 → 复制全文逐字相等 | 新库全文复制 |
| `test/v05.test.mjs:74` | 1501 字只复制 300 字＋网址 → 1500 与 1501 字都逐字复制 full | isLong 只影响版面 |
| `test/v05.test.mjs:108` | Kangaikroto 两段摘录不同 → 两段全文不同 | 摘录字段现为 null；帖子映射断言不变 |
| `test/v05.test.mjs:133` | 官方页含全文或摘录 → 官方页含完整、正确转义的全文 | 官方无嵌入与来源链接断言不变 |
| `test/v05.test.mjs:137` | 官方长文复制摘录＋官方链接 → 官方条目复制完整原文 | 作者及官方原文链接仍在页面上 |
| `scripts/verify-v03.mjs:96` | 详情含全文或摘录 → 详情含完整全文的 HTML 文本表示 | 恢复原 63 条中的 20 条全文 |
| `scripts/verify-v05.mjs:57` | 卡片 pre 含全文或摘录 → 卡片 pre 包含完整全文 | 卡片 details 展开后可读与复制全文 |
| `scripts/verify-v05.mjs:59` | 复制长度 ≤1500 → 复制内容精确等于全文 | 发布资料与复制相同 |
| `scripts/verify.mjs:114` | 长条目 prompt=null；短条目非空且 ≤1500 → 所有条目 prompt 为非空原文 | 取消截断分支 |
| `scripts/verify.mjs:116` | 只要求短条目摘录为 null；长条目摘录最多 300 字 → 全部 promptExcerpt=null | 取消摘录存储 |
| `scripts/verify.mjs:118` | 原规则只验证长度正整数与长文标记 → 增加 promptLength 精确等于全文长度 | 准确记录来源全文长度 |
| `scripts/verify.mjs:120` | 长文复制必须带完整版网址，且复制长度 ≤1500 → 每条复制内容精确等于全文 | 替代这两项旧截断规则，保留精确校验 |
| `scripts/verify.mjs:123` | 首页 pre 期待全文或摘录 → 首页 pre 期待完整全文 | 原 pre 精确包含断言保持，期待文字改为全文 |
| `scripts/verify.mjs:219` | Techie 复制必须以完整版网址结尾 → Techie 复制必须精确等于全文 | 不再拼接摘录网址 |
| `scripts/verify.mjs:231` | 只允许原库进入已授权迁移核对 → 两档分别进入来源核对及全字段精确迁移核对 | 第 1 节要求两档补回全文；未减少 protectedDataPaths 范围 |
| `scripts/verify.mjs:233` | 原库仅支持既有 medium / embedId 迁移 → 再精确恢复原 20 条已核实的 prompt / promptExcerpt | 其他 43 条及所有其他字段保持 HEAD |
| `scripts/verify.mjs:241` | 原库必须等于旧字段基准 → 原库必须等于已核实全文迁移后的完整基准 | 新增来源指纹确保迁移不是任意替换；其他字段仍深度相等 |
| `scripts/verify.mjs:286` | 原库外所有受保护资料 raw diff 必须为空 → 只可有新库全文迁移的差异，且随后完整深度比对精确预期 | 允许第 1 节要求的 74 条全文字段；其他资料仍不可改 |

完整旧档指纹为 `05f91fb5ae33b25cbb7db685db7c405206c94f25fe7bc2f4c2447f36a2375c08`，新全文档指纹为 `ee125a81da51c3350ff13b2133d2bc365fb8eeb8561d41e0aba4b830f42d2356`。指纹以外还有来源全文及元数据逐条锁定；不是单纯取消字数检查。

两处唯读检查仍覆盖原完整 protectedDataPaths，未添加排除项。为执行明确获准的两档全文写入，只允许已知长条目的 null prompt 变为来源匹配的全文、promptExcerpt 变为 null；两个完整资料对象都与 HEAD 构造的精确迁移基准深度比较。标题、笔记、作者、链接、日期、标签、模型、计数、顺序等其他字段一律不许借迁移改变。新增负面 fixture 证明改标题、作者、标签、短文及全文内容均失败。

## 新增七项离线测试

1. 全部 192 条与来源逐字一致，20＋74 恢复，98 条原文不变，长度与元数据精确匹配。
2. 篡改全文、长度、摘录、元数据、顺序或来源指纹均失败。
3. 授权迁移只改变 prompt / promptExcerpt，其他字段与短文变化均失败。
4. schema 拒绝长文 null、摘录及错字数，1501 字也完整保存。
5. 所有复制逐字等于全文，页面按钮 id 能取得发布资料中的完整原文，不拼接来源网址。
6. 长文引号、&、HTML 标签与字面实体安全显示，不能结束 pre 或注入脚本。
7. 离线 build 核对全部 576 个三语详情和最长三条，去掉脚本后全文仍在、没有隐藏或默认收合，CSS 提供滚动和长字换行。

最长三条：2092548780658708526（16535 字）、2105346237038043532（9570 字）、2101303256173650396（7252 字）。三语 HTML 逐字比较及外部 gate 均通过。

## 保留与人工验收

通过 SHA256 确认 data/thumbs.json、工作流、推广配置与 middleware 完全未动。GA4 / Consent、Impact、canonical / hreflang / x-default、630 个最终 sitemap 网址、原 63 条 FIGHT 专栏、官方无嵌入、敏感帖、推廣规则、按需嵌入与语言切换均通过原检查。未改任何 i18n 字串，三语 key 集合仍一致。

已尝试 `node scripts/check-layout.mjs`；沙箱 Chrome 在启动时因 setsockopt: Operation not permitted 退出。因此不宣称 360 / 390 / 1440 实际浏览器测量通过。脚本已纳入 14 类页面 × 三语 × 三种宽度（126 组）；需在能启动 Chrome 的环境运行，并手动确认手机长文换行、垂直捲动、键盘捲动、全文复制、原帖播放与 Cookie 条。
