# 建置、檢查與部署紀錄

## 2026-11-10 創作者合作計畫與比賽清單

由本機工作區執行 `npm run deploy`，發布至 Cloudflare Pages 正式部署 `0b2cc449`。26 個站點頁面中，新增英、繁各一頁 CPP（20 筆）及比賽與徵件（37 筆）。共 160 項 Node 測試、公開產物驗證、48 項離線版面檢查及既有雙語互動檢查通過。

發布後以 curl GET 檢查自訂網域：四個清單頁、英繁首頁、sitemap、清單樣式及期限狀態腳本共九個網址皆為 200，內容逐一與本機產物相同。另外抽查五類知識庫的英繁舊網址共十個，均為 404 且回傳 `Cache-Control: no-store`。本次部署未建立 Git 提交。

## 2026-11-09 知識庫暫停公開

Cloudflare Pages 正式部署 `62a58ebb` 已在自訂網域生效。公開建置含 22 個雙語站點頁面（兩種語言合計）、1 個共用 404 頁，sitemap 有 20 個網址。提示詞、工作流程、技巧、工具與地區資訊的原始資料保留在儲存庫。

部署前 158 項 Node 測試、公開檔案清單驗證、36 項瀏覽器版面檢查與雙語互動檢查通過。首次部署後部分舊網址仍命中快取；正式版在 Pages Functions 讀取靜態快取前處理這些路徑，直接回應 404 並設定 `Cache-Control: no-store`。

最終以原網址抽查 41 項。32 個舊頁面、資料或圖片網址最終回應 404；英繁首頁、關於頁、四個電影頁與 sitemap 共 9 項回應 200，內容與本機建置相同。這次發布使用本機工作區，GitHub 的 `8323f6d` 尚未包含下架設定。

## 2026-11-09 工作區與 GitHub 的差異

| 版本 | 可用指令與部署行為 |
| --- | --- |
| GitHub `main`，提交 `8323f6d` | 使用 `npm run build`、`npm test`、`npm run verify`。此版本的 `npm run deploy` 直接呼叫 Wrangler 上傳 `dist/`，沒有 `predeploy`。 |
| 本機工作區 | 尚未提交的 `package.json` 加入 `check`、`test:browser` 與 `predeploy`。部署前會完整重建與檢查，再由 Wrangler 4.114.0 發布到 Cloudflare Pages 專案 `fight-prompts` 的 `main`。GitHub Actions 的檢查設定也仍在本機。 |

日常驗證請在專案根目錄執行 `npm run build && npm test && npm run verify`。在含有本機檢查流程的版本，可以直接執行 `npm run check`。已有最新建置產物時，可用 `npm run test:browser` 單獨重跑瀏覽器；也可藉由 `CHROME_BIN` 指定 Chrome／Chromium 執行檔。

正式發布另需作者授權。使用本機流程時，`npm run deploy` 發布的是當下工作目錄的內容，請先確認其中的變更。部署前可用 `npx --yes wrangler@4.114.0 whoami` 核對登入身分。

## 2026-11-09 下架前的雙語版本檢查結果

| 檢查 | 結果 |
| --- | --- |
| 本機建置 | 432 個 HTML，sitemap 列出 426 個網址。 |
| Node.js 測試與產物驗證 | 157/157 項測試通過，無跳過；18/18 項產物驗證通過。 |
| 離線瀏覽器 | 初次執行時受限環境中止了 Chrome。允許啟動 Chrome 後單獨重跑，96 項版面檢查通過（英文、繁中，360、390、1440 px），兩種語言的電影色條、搜尋、複製、工具視窗等互動檢查通過。 |
| 正式站內容 | 兩個首頁、兩部電影各自的英繁詳情頁，以及 sitemap 均回應 HTTP 200，逐檔比對與本機建置一致。 |
| 正式站轉址 | 抽查舊英文《旗津的風》與舊日文《紅毛港》網址，均以 HTTP 301 轉到對應英文頁，保留 `?ref=test`。 |

正式站採唯讀抽查。這次未執行正式部署，YouTube 實際播放與聲畫品質也未驗收。

## 2026-10-30 本機流程變更紀錄

- `package.json` 宣告 ES module 與 Node.js 最低版本 22.8.0，消除 middleware 的模組類型警告。
- `npm run check` 依序執行 build、test、verify、test:browser，任一步驟失敗就停止。
- `npm run deploy` 透過 npm 的 `predeploy` 先執行完整檢查，再使用固定的 Wrangler 4.114.0 上傳到 `fight-prompts` 的正式分支 `main`。本次沒有執行這個正式部署指令。
- `scripts/check-browser.mjs` 選取本機 Chrome／Chromium，依序執行既有版面與互動腳本。明確設定 `CHROME_BIN` 時只使用該路徑；找不到或執行失敗就回傳非零結束碼，每支腳本上限 3 分鐘。
- `.github/workflows/check.yml` 在 PR、main push 與手動觸發時執行相同流程。工作流程只有 contents:read 權限，未配置 Cloudflare 憑證或部署步驟。這份設定尚未推送至 GitHub，因此遠端 CI 尚未實跑。
- README 區分歷史頁數與目前數量，補充完整檢查、瀏覽器需求與正式部署行為。

## 2026-10-30 三語舊版驗證結果

本機環境：macOS、Node.js 24.10.0、已安裝的 Google Chrome。

| 檢查 | 結果 |
| --- | --- |
| 建置 | 642 個 HTML、633 個 sitemap 網址 |
| Node 測試 | 143/143 通過，無失敗或跳過 |
| 產物驗證 | 18/18 通過 |
| 瀏覽器版面 | 144 項通過；三語 × 360/390/1440，包含字型替代與 Cookie 條 |
| 瀏覽器互動 | 三語搜尋、複製、排序／歷史、顯示更多、工具卡與視窗鍵盤操作等通過 |
| 失敗時停止 | 在臨時 package fixture 保留實際 predeploy 設定，將 check 設為失敗並將 deploy 換成本機標記；npm 阻止模擬部署，標記檔未產生，未呼叫 Wrangler |
| Chrome 路徑錯誤 | 指定不存在的 CHROME_BIN，檢查回傳 1，沒有跳過或改用其他瀏覽器 |

最初在受限環境中 Chrome 被終止，完整指令依預期回傳失敗；提高執行權限後兩支瀏覽器腳本通過。檢查內容與斷言沒有放寬。

## 本機部署流程的適用範圍

- `npm run deploy` 會發布目前工作目錄的內容；`--branch main` 指定正式部署目標，不會切換 Git 分支或同步遠端程式碼。
- 直接執行 Wrangler 或 npm 的 `--ignore-scripts` 會繞過 predeploy，正式部署應使用一般的 `npm run deploy`。
- npx 固定 Wrangler 頂層套件版本，但沒有用 lockfile 鎖定其整棵相依套件樹；第一次使用或快取不存在時需要 npm 網路連線。建置與檢查本身不需要安裝套件。
- 瀏覽器腳本攔截／阻擋外部頁面資源，這些結果不代表已驗證真實 X 播放、遠端圖片、GA4 傳送或外連目的頁，也不等於人工視覺驗收。
- 此次未實際部署，因此未驗證新流程在正式上傳時的端到端行為。Pages 的 `--branch` 用法已由固定版本 CLI 的 `--help` 與 [Cloudflare 官方文件](https://developers.cloudflare.com/pages/functions/wrangler-configuration/#production-and-preview-deployments) 核對。
