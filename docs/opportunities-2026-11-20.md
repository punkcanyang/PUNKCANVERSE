# 2026-11-20 CPP 與徵件更新

核對 Punkcan Vision `研究/平台CPP-20261118/`、Notion「AI 比赛与创作者计划」11 月 19–20 日新增資料，以及主辦方網站、官方表單與網站使用的公開活動資料。研究筆記是查核線索，不直接當成官方規則。本次重點為新增項目、近期截止項目與已發現的條件差異，未宣稱重新逐條審核全部歷史簡章。

## 資料異動

- CPP 22 → 29 項；比賽與徵件 63 → 72 項，繁中與英文成對更新。
- 原有 85 筆皆保留，首次收錄日期不變；新增 16 筆的網站收錄日為 2026-11-20。既有到期項目仍由期限狀態程式標示已截止。
- TikTok × Seedance：依 11 月 19 日新版條款，截止日從 11 月 20 日延至 12 月 5 日。補充第三方平台使用 Seedance、製程證據保留 24 個月、授權與公開發行限制。
- PixVerse：補入 Partner、Pro Partner、Premier 的會員點數、額外點數、到期規則、前三個月支援與活躍條件。
- FLUX: In Production：舊資料把活動最後一天 12 月 13 日列為投稿截止，這次移除該截止標記，保留活動日程並明寫交件期限待確認。

## 新收錄的官方來源

| 類別 | 項目與官方來源 | 此次確認的重點 |
| --- | --- | --- |
| CPP | [Flick](https://flick.art/creative-partners) | 每月至少 2 篇、Discord 回饋、點數未列固定額度、推薦佣金 30%。 |
| CPP | [Renoise](https://creator.renoise.ai/) | 三級每期 1／2／4 支影片，1,200／3,600／14,000 點；最高級 7 天影片無限生成。 |
| CPP | [Pollo](https://pollo.ai/creative-partner-program) | 每月 2,000 點，無硬性發文數；作品集與活躍社群仍必要。 |
| CPP | [Kling Elite 官方表單](https://docs.google.com/forms/d/e/1FAIpQLSdSxWFQMKnIK_9NbiRe9kmdw3nDbmgqFQ-FGmQHPkMcN3PG1A/viewform) | Pro 或 3,000 點擇一；與 NextGen 分開。 |
| CPP | [DomoAI](https://www.domoai.app/en/cpp) | 每月 2–5 篇；每篇 50 美元僅屬 Elite 且須審核，現金經 PayPal。 |
| CPP | [Hedra](https://www.hedra.com/docs/pages/app/account/creator-program) | 官方大使計畫與申請入口；未自行填入未公布的佣金比例或點數。 |
| CPP | [AZ8 第二期](https://az8.art/ja/event/az8-cpp-season-2) | 12/14 19:00 JST；日本與歐美地區，台灣資格待確認；第二月須通過首月任務。 |
| 徵件 | [Guardio × AdArena](https://adarena.app/challenges/guardio) | 12/3 22:00 UTC+2；8,500 美元現金＋4,000 美元點數，並非全數現金。 |
| 徵件 | [HAIFF](https://hyderabadaifilmfestival.com/) | 11/28；3–15 分鐘短片或最長 30 秒虛構品牌廣告，視聽皆 AI 生成。 |
| 徵件 | [Albrecht Dürer](https://albrechtdurer.co.kr/en/contest) | 12/31 18:00 KST；英文版明確列時區，不限國籍。 |
| 徵件 | [BiFu 第一季](https://www.bifu.co/blog/bifu-ai-video-contest-round-1) | 宣傳期至 12/4 仍可報名；首獎有最低評分，50 萬美元為八季合計。 |
| 徵件 | [濰坊](https://www.wfcmw.cn/334165/2026/11/45559397.html) | 僅公布 12 月底，未擅填 12/31；原創未公開與得獎後再利用限制。 |
| 徵件 | [南海子「興光 AIGC」](https://item.btime.com/f6o27us4cb28ojbjbgs330pntse) | 12/31；60–300 秒，中文字幕、橫直封面及未公開要求。 |
| 徵件 | [首爾在地品牌官方表單](https://forms.gle/ncmpvXnUdYYBiXcX9) | 12/4 11:00 未明列時區；官方商品素材、公開社群貼文，海外資格待確認。 |
| 徵件 | [江蘇蘇超](https://aigc.sutisport.com/) | 12/15 23:59:59 未附時區；家庭組只頒證書、不發獎金。 |
| 徵件 | [原點杯十月賽季](https://www.memeaigc.cn/race/oct) | 11/24 23:59:59 UTC+8；影片至少 1 分鐘、70% AI，複賽答辯與公共領域聲明。 |

## 日期與資料取證

- Guardio 頁面雖僅寫 IST，JSON-LD 的 `endDate` 與 `validThrough` 均為 `2026-12-03T20:00:00.000Z`，與 22:00 的 UTC+2 一致。
- 原點杯官方 `/v1/competitions/726954bd-51f6-4735-bb9c-106e2e76af5f` 明列 `businessTimezone: Asia/Shanghai`、`enroll_end_at: 2026-11-24T23:59:59+08:00`；作品與授權要求來自頁面載入的 `oct-CFgMh3Mq.js`，不是用已截止的顯示字串推定狀態。
- 蘇超 `/api/activity/info` 的實際 API 回應列 12/15 截止；不採網站程式包內過時的模擬資料。`/api/activity/channel/list` 確認家庭組無獎金及個人證件選項。
- 沒有時區的時刻放在說明中，日期欄維持 date-only；沒有確切日期的濰坊，在摘要寫「12 月底」，不建立虛構的精確期限。
- [Seedance 完整條款](https://www.1billionsummit.com/ai-award-2027/terms-and-conditions)仍有永久及原則不可撤回授權。首頁說作者保有權利，不代表沒有這些授權條件。

## 待查與未收錄

- [Funs.AI 預告](https://x.com/funsai_knowp/status/2122475473330725161)：尚未取得正式完整規則，不把 11/23–29 活動期間當成已確認投稿窗口。
- [雲創福建原公告連結](https://news.qq.com/rain/a/20261118A085Y600)：本次來源存取失敗；搜尋找到第三方整理，但未據此當成官方確認後發布。
- [FLUX 官方活動頁](https://www.encodeclub.com/programmes/bfl-flux-in-production)：瀏覽器僅載入外框，研究資料中的 12/11 與舊活動結束日 12/13 尚不能確認哪個是交件期限。公開清單已標待確認。
- Frameo CPP：本次尚未取得可核實的完整官方申請規則，未新增。
- [美圖秀秀 × 站酷](https://www.zcool.com.cn/events/meituxiuxiu/)：本次新增線索以 AI 影像創作為主；該活動為修圖／特效素材方向，未加入此輪影片徵件。
- 首爾海外資格、AZ8 未列地區資格，以及部分活動未列的報名費，均直接標示待確認或未載明，不推定為全球開放或免費。

## 發布範圍與驗證

使用 `/private/tmp/punkcanverse-calls-1120.u1l3jkk8` 隔離副本。對照正式站，副本保留已發布的 35 平台評測，不包含主工作區另行預覽中的 YouArt、折疊評測、風格卡段落與電影合作 CTA。這些來源在主工作區均保持原狀。

發布前建置差異以 SHA-256 檢查，只允許：`cpp/index.html`、`zh/cpp/index.html`、`competitions/index.html`、`zh/competitions/index.html`、`sitemap.xml`。正式站比對時另辨識 Cloudflare 電子郵件混淆及時間經過引起的已截止標記，沒有把它們誤認為內容更新。

資料驗證確認新增 16 筆、原有 85 筆及首次收錄日全部保留。

### 完成結果

- 正式部署：`667083c3`，預覽識別網址 `https://667083c3.fight-prompts.pages.dev`。Wrangler 回報實際上傳 5 檔、92 檔沿用。
- 完整 `npm run deploy` 的 predeploy：162/162 Node 測試、公開產物驗證、72 項雙語離線版面檢查、雙語電影與 Cookie 互動檢查全部通過。
- 前兩次 predeploy 皆在上傳前停止：部署副本最初帶入尚未發布的 36 家折疊評測測試，包括直接片段連結應展開的斷言。只在隔離副本將這些斷言改為實際發布的 35 家版面，仍檢查平台數、首尾項目、索引鍵盤開啟、索引點擊與直接片段連結可見；另加兩份清單的筆數、完整官方連結集合及「更多條件」鍵盤開啟檢查。主工作區的預覽測試保持原狀，未跳過 predeploy。
- 正式網域 12 個 GET 全部 HTTP 200，回應逐位元組符合隔離建置：四個 CPP／徵件頁、sitemap、films.css、四個中英文電影頁、兩個中英文平台評測頁。
- 稽核檔案：`/private/tmp/pcv1120-deploy-final.log`、`/private/tmp/pcv1120-live-after/verification.json`、`/private/tmp/pcv1120-publish-hashes.json`。本次僅修改主工作區的 `content/opportunities.json` 並新增本紀錄；主工作區 dist 另按目前預覽來源建置，不是此次隔離發布版本。
- Claude 尚未複審；以上為本次執行與測試結果。

### 下次週一檢查前的近期截止

以下精確時刻換算為台北時間；M.AI 仍保留官方只列日期的格式。

| 項目 | 截止 |
| --- | --- |
| [M.AI](https://www.maifestival.org/) | 官方 11/20，清單未推定時刻 |
| [山東文旅](https://wgxj.linyi.gov.cn/info/1005/79787.htm) | 11/21 00:00（官方 11/20 24:00） |
| [Cue Xmas](https://cuefilmfest.com/) | 11/21 12:59 |
| [FilmFights](https://filmfights.ai/) | 11/21 13:59 |
| [鯨銳](https://jingrui-ai-competition.youku.com/) | 11/22 23:59 |
| [LibTV 寶藏畫布](https://www.liblib.tv/activity/73) | 11/22 23:59:59，沿用既有核實期限 |
| [FilmyAI](https://www.filmyai.net/contest) | 11/23 02:29 |
