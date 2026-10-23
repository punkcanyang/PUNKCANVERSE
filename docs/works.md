# 个人作品维护

主入口为 `/works/`、`/en/works/`、`/ja/works/`；详情为各语言的 `/works/<slug>/`。
旧 `/essays/` 三语入口保留为作品列表别名，canonical 和语言切换均指向作品区；别名不进入 sitemap。
旧文章详情的读取能力保留用于兼容，但不再作为导航或首页主入口。

## 发布流程

编辑 `content/works.json` 的 `entries` 数组。当前为空，没有示例作品或获准公开的媒体。
数组顺序就是展示顺序。每条必须有唯一的小写英文／数字／短横线 `slug` 和布尔值 `published`。
只有 `published: true` 的条目进入页面及 sitemap；草稿不输出，源 JSON 也不会复制到 dist。
不要将私有素材、密钥、临时签名地址写入仓库，即使条目标为草稿。

新增作品先使用最小草稿：

```json
{ "slug": "your-project", "published": false }
```

得到作者发布确认后，补齐以下字段再将 `published` 改为 `true`：

| 字段 | 内容 |
| --- | --- |
| `copy.zh`、`copy.en`、`copy.ja` | 各语言的 `title`、`summary`，可选 `description`（纯文本，保留换行） |
| `media` | 图片／视频对象数组，可为空；不从提示词原作者的媒体自动取图 |
| `media[].type` | `image` 或 `video` |
| `media[].src` | 获准公开的 HTTPS 图片或视频文件直链；构建不下载媒体 |
| `media[].width`、`height` | 媒体的实际宽高，正整数 |
| `media[].alt` | `{ "zh": "中文说明", "en": "English description", "ja": "日本語の説明" }` |
| `media[].poster` | 可选，仅视频使用，必须是获准公开的真实封面 HTTPS 地址 |
| `links` | 外链数组，可为空；每项含 HTTPS `url` 和三语 `label` 对象 |

视频使用浏览器原生控件，不自动播放，`preload="none"`，并保留文件外链。
X、YouTube 等帖子／观看页面放入 `links`，不要当成视频文件直链。
卡片使用第一张图片或明确提供的视频封面；没有封面时只显示文字，不伪造缩略图。
三语缺字、重复 slug、非 HTTPS／带账号密码的 URL 或无效媒体尺寸会使构建失败。
媒体文件可用性与发布权需在加入具体作品时核对；本次没有请求或发布任何作品媒体。

## 本地验证

`npm run build`、`npm test`、`npm run verify`。测试作品仅在临时目录生成并清理，不进入正式 dist。
新增作品测试覆盖三语导航、旧路由、canonical、sitemap、空状态、媒体与外链、转义及草稿隔离。
当前空数据构建为 642 个 HTML、633 个 sitemap URL；每件公开作品增加三语各一个详情页。
