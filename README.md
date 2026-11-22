# PUNKCANVERSE

Punkcan 的 AI 影像作品集。首頁以每部片的鏡頭色條呈現片單，可沿著色條預覽劇照，再進入作品頁觀看全片、閱讀導演筆記與製作名單。目前放映《旗津的風》與《紅毛港：一網撈起故鄉》。[英文首頁](https://punkcanverse.com/) · [繁中首頁](https://punkcanverse.com/zh/)

## 網站導覽

英文使用根路徑，繁體中文使用 `/zh/`。舊英文 `/en/…` 與日文 `/ja/…` 網址會以 301 轉到對應的英文頁，保留查詢參數。下表列英文路徑，繁中路徑在前面加上 `/zh`。

| 路徑 | 內容 |
| --- | --- |
| `/`、`/films/<slug>/` | 電影片單與作品頁。播放時才載入該語言版本的 YouTube 播放器。 |
| `/books/`、`/books/<slug>/` | 臺灣民間信仰書系五本書的介紹、製作揭露、參考書目、勘誤與還沒查到的部分。[書區規劃](docs/books-plan.md) |
| `/creators/` | 「創作筆記」目錄，通往工作筆記、創作者合作計畫及比賽與徵件。 |
| `/creators/production-notes/` | 雙語工作筆記。文章放在 `content/production-notes/`。 |
| `/cpp/`、`/competitions/` | 創作者合作計畫、比賽與影展，沿用原網址。以首次收錄日由新到舊排列，同日依英文名稱排序。 |
| `/works/`、`/essays/` | 既有的一般作品列表及其舊網址，目前列表為空。電影作品另見首頁。 |
| `/about/`、`/contact/`、`/privacy/`、`/terms/`、`/affiliate-disclosure/`、`/takedown` | 網站介紹、聯絡、隱私、使用條款、推廣揭露與下架申請。 |

清單的英文與繁中共用 [公開資料檔](content/opportunities.json)。新增時只採用 Notion 已核實官方頁的項目，保留首次收錄日，更新雙語說明、官方連結、費用與各階段期限，再更新清單整理日期。建置與讀者瀏覽皆不需連線 Notion。

未來的教學區只刊登 Punkcan 自己撰寫或製作的原創教學，目前仍在規劃中。[教學區規劃](docs/redesign-plan.md)

原有知識庫的提示詞、工作流程、技巧、工具與地區資訊已暫停公開，舊網址回應 404。原始資料與測試保存在儲存庫。`publishKnowledgeBase` 控制這五個區塊的發布，日後上架原創教學時可維持 `false`。[站台設定](data/site.json)

## 本機建置與檢查

使用 Node.js 22.8 以上版本，在專案根目錄執行。建置使用 Node.js 內建模組，不需安裝 npm 套件。

```sh
npm run build
npm test
npm run verify
```

建置結果位於 `dist/`。若要預覽首頁與作品頁，可執行以下指令，再開啟 `http://127.0.0.1:8766/zh/`。正式站的 301 轉址由 Cloudflare Pages Functions 處理。

```sh
python3 -m http.server 8766 --bind 127.0.0.1 --directory dist
```

2026-11-09 核對時，GitHub 的 `main` 位於 `8323f6d`。上述三個指令可在該版本使用。**本機工作區另有尚未提交的檢查流程**，可執行 `npm run check`，依序建置、測試、驗證產物，再以 Chrome 檢查版面與互動。兩個版本的部署指令行為有差異，執行前請核對所在版本。[部署流程與最近驗證結果](docs/deployment-checks.md)

## 維護入口

| 要調整的內容 | 從哪裡開始 |
| --- | --- |
| 新增電影、更換封面或分語言影片 | [作品維護指南](docs/works.md)、[電影片單](content/films.json) |
| 調整片單與作品頁的版型、互動 | [電影頁產生器](lib/films.mjs)、[樣式](web/films.css)、[瀏覽器互動](web/films.mjs) |
| 維護提示詞、來源與縮圖 | [原始收藏](data/prompts.json)、[Wan 與 MiniMax 收藏](data/prompts-wan-minimax.json)、[完整原文核對紀錄](docs/v051-review.md)。建置只讀縮圖快取；手動補缺圖用 `node scripts/fetch-thumbs.mjs --missing-only`。 |
| 修改工具資料或推廣連結 | [工具資料](data/tools.json)、[推廣設定](data/affiliates.json)、[工具清單審查紀錄](docs/v053-tools-review.md) |
| 調整翻譯、網址或轉址 | [雙語資料](data/i18n/)、[頁面路徑](lib/routes.mjs)、[轉址規則](lib/redirect.mjs) |
| 查閱改版決定與待辦 | [改版紀錄](docs/redesign-plan.md)，含學習區入口與短片色條的待決事項。 |

提示詞著作權歸原作者，提示詞原文與介面譯文分開維護。網站使用 GA4 與 Consent Mode v2，預設拒絕儲存；讀者可從頁尾調整 Cookie 設定。[下架申請](https://punkcanverse.com/zh/takedown) · [隱私政策](https://punkcanverse.com/zh/privacy/)

## 歷史紀錄

三語版本的頁數、來源校驗、舊版首頁與歷次審查保留在原始提交與各版紀錄中。[改版前的 README 紀錄](https://github.com/punkcanyang/PUNKCANVERSE/blob/8323f6d5a021468965d528ed779da176f4a1c6b3/README.md) · [v0.4](docs/v04-review.md) · [v0.5](docs/v05-review.md) · [v0.5.1](docs/v051-review.md) · [v0.5.2](docs/v052-review.md) · [v0.5.3](docs/v053-tools-review.md) · [閱讀與搜尋體驗](docs/reading-ux.md)
