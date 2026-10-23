# v0.5.3 工具清单交付记录

三语 `/tools`、`/en/tools`、`/ja/tools` 已生成，文件为对应语言的 `tools.html`。三张卡依序为 Higgsfield、Magnific、PixVerse，锚点与平台键一致；先介绍、成立／推出时间、特色、价格、适合谁、查价日期与官方定价页，最后才放现有推广组件。

`data/tools.json` 的 `facts` 完整保留指定来源文件的全部值、source、note、未公开字段与推论标记；`content` 保存三语文案，每项标明对应 fact 路径及 source。建置使用固定 SHA-256 核对原始事实，并检查译文数字只能来自对应事实。价格直接读取 facts：Higgsfield 付费价格未公开；Magnific 与 PixVerse 的年缴折算月费、点数周期、每席计费明确标示，未确认月缴价不补数字。

三语 tips 只有三家简介、对应锚点和完整清单入口，不包含任何推广网址、按钮或 Magnific 推广码。原四条 Higgsfield 提示词的按钮不变，旁边增加本语言 `/tools#higgsfield` 入口。三家各一个推广按钮移至工具清单；原首页、视频列表、打斗专栏和单条页的 Higgsfield 数量不变。官方定价页保持普通外连，非 sponsored。

## 文件改动

- 新增 `data/tools.json`、`lib/tools.mjs`：批准事实、三语文案、来源与数字校验、工具卡与 tips 简介渲染。
- `build.mjs`、`lib/routes.mjs`、`lib/i18n.mjs`、`data/i18n/{zh,en,ja}.json`：三语路由、导航、元数据与文字；所有新页沿用 GA4、Consent、Impact 和原布局。
- `lib/affiliates.mjs`：导出现有 renderPlatform，给 Higgsfield 提示词的推广组件旁增加普通内部介绍链接；旧低层组件 API 保留，tips 实际改用资料简介组件。
- `web/site.css`：沿用暗色片场视觉，卡片正常排版；窄屏价格表在卡片内部横向滚动。
- `scripts/verify-v03.mjs`、`scripts/verify-v05.mjs`、`scripts/verify-v053.mjs`：精确页面数量及推广位置规则；新增三张工具卡的内容、价格、来源、普通定价链接及最后 CTA 校验。
- `test/affiliate-live.test.mjs`、`test/v04.test.mjs`、`test/v05.test.mjs`、`test/v053.test.mjs`：仅按核准范围调整旧期待值；新增 `test/tools.test.mjs` 四项测试。
- `scripts/check-layout.mjs` 加入三语 tools 的 360／390／1440 检查样本；README 更新工具清单说明。

提示词两份资料、`data/thumbs.json`、原始官方截图、推廣网址与推广码、301 middleware、法律正文均未改。

## 每处既有断言变更

所有变更处均有 `// v0.5.3 spec change (boss 2026-10-23): tool list page` 注解。未改保护路径集合、事实及全文来源指纹、禁词规则、官方图片检查或其他既有断言。

| 文件:行 | 旧 → 精确新规则 | 原因 |
| --- | --- | --- |
| `test/affiliate-live.test.mjs:18` | 推荐工具 section 必须包含推广按钮 → 每个该 section 必须有 0 按钮，并依序精确包含本语言 `/tools#higgsfield`、`#magnific`、`#pixverse`、`/tools` 四个入口 | tips 改为简介与内部入口 |
| `scripts/verify-v03.mjs:92` | 中文 Magnific 推广网址只可在 tips.html → 只可在 tools.html | 推广移至工具清单 |
| `scripts/verify-v03.mjs:95` | 英日 Magnific 推广网址只可在各语言 tips.html → 只可在各语言 tools.html | 同上 |
| `scripts/verify-v05.mjs:37` | sitemap 630 → 633 | 新增三语工具清单 |
| `test/v04.test.mjs:120` | 构建 descriptor 数量 636 → 639 | 新增三语工具清单 |
| `test/v04.test.mjs:124` | HTML 文件数 636 → 639 | 同上 |
| `test/v04.test.mjs:149` | tips 包含 Magnific 码与本语言揭露标签 → tools 精确包含一次推广码与同一本语言揭露标签，同时 tips 无推广码及按钮 | 推广从 tips 移至 tools |
| `test/v05.test.mjs:240` | 构建页数 636／sitemap 630 → 639／633 | 同上 |
| `scripts/verify-v053.mjs:14` | 推荐工具区有 Magnific、PixVerse 两个推广按钮 → tips 区精确 0 个按钮、0 推广网址、0 推广码，四个内部入口顺序精确 | tips 改为简介 |
| `scripts/verify-v053.mjs:26` | 原推荐按钮的 target、sponsored、三语文案、揭露标签与推广码检查 → 转移到各 tools 卡，三张卡各一个按钮，只有 Magnific 带码 | 旧安全和文案要求保留，并精确覆盖新增 Higgsfield 卡 |
| `scripts/verify-v053.mjs:88` | tips 每页一次 PixVerse 推广网址 → tips 每页零次；tools 每页一次且位于 pixverse 卡 | 推广位置核准变更 |
| `scripts/verify-v053.mjs:104` | PixVerse 出现页集合为三个 tips 文件 → 精确三个 tools 文件 | 同上；另新增 Magnific、码、Higgsfield 的精确分布检查 |
| `test/v053.test.mjs:71` | 错误属性 fixture 来自 tips 推荐区 → 来自 tools 的 pixverse 卡；同样拒绝错误 target／rel／网址／标签／伪造推广码 | 对应按钮迁移 |
| `test/v053.test.mjs:81` | 上述 fixture 调用旧推荐区 checker → 调用单张工具卡 checker，assert.throws 保持 | 同上 |
| `test/v053.test.mjs:87` | 错误分布 fixture 精确期待 “three tips pages” → “three tools pages” | 对应位置迁移，仍拒绝单条页出现 PixVerse 推广 |

## 新增测试

`test/tools.test.mjs` 的四项测试覆盖：

1. 原始事实及 source 与批准文件逐值一致；原始数值／日期／source 和译文数字被改写时失败。
2. 三语卡片的内容顺序、3–5 项特色、所有方案、年缴与每席说明、查价日期、普通官方链接及最后的推广组件；官方链接加 sponsored 或出现假价格会失败。
3. 离线构建三语 tools 的 sitemap、导航、canonical、og:url、hreflang、GA4／Consent／Impact；tips 零推广；原四条 Higgsfield 提示词页具有正确语言的介绍入口。
4. 推广网址为空或危险协议时不输出按钮、空 CTA 或推广码，官方定价链接仍保留。

## 验证与当前阻碍

续作复核 `819f44f`：已查看 git log、git show 与 git diff。WIP 收录了 17 个已有档案的改动，`data/tools.json`、`lib/tools.mjs`、`test/tools.test.mjs` 和本文档仍未追踪，外部提交时必须一并纳入。本轮没有新增程式、资料或断言改动；已用 HTMLParser 独立核对三语官方定价锚点，其 href 均逐字等于 facts 的 `https://www.magnific.com/pricing`，target 为 `_blank`，rel 为 `noopener noreferrer`。

正常命令链：build 639 页，npm test 137/137，npm run verify 18/18；sitemap 633 个最终网址。全程离线，未 commit、push 或部署。

外部 `/workspace/bd-punkcan/v053-gate.py` 当前有一处与需求冲突：第 111–112 行把所有 `magnific.com` 锚点都要求 sponsored，因此将三语工具卡必须保留的 `https://www.magnific.com/pricing` 普通官方链接判错；第 131 行附近又禁止非三条实际推广网址带 sponsored。结果为三次 `affiliate rel wrong`，gate 尚未全绿。未修改 gate、未伪装 URL 或给普通链接添加错误的 sponsored。需由 gate 维护方将此项匹配限于三条实际推广网址后重跑。

Chrome 的离线检查因沙箱 `setsockopt: Operation not permitted` 无法启动，未声称完成实际视口测量；请在外部预览检查三语 360／390／1440，重点为长价格表的内部滚动、导航横滑及工具卡段落。
