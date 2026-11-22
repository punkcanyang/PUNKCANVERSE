# 作品維護指南

| 想讓作品出現在哪裡 | 資料來源 | 公開方式 |
| --- | --- | --- |
| 首頁片單、雙語電影頁 | [content/films.json](../content/films.json) | 建置時輸出片單中的每一筆電影 |
| 一般作品列表 `/works/`、`/zh/works/` | [content/works.json](../content/works.json) | 只輸出標為 `published: true` 的作品 |

## 維護首頁電影

1. 依照片單裡的現有作品新增一筆 `entries`，或編輯要更新的作品。陣列順序就是首頁片序。每部電影使用唯一的 `slug`（小寫英數字，以連字號分詞）及整數 `year`。電影片單沒有草稿開關，加入的項目會進入下次建置。
2. 填寫 `zh` 與 `en` 兩套資料。`title` 是片名，`kind` 是作品類型說明，`youtube` 存各語言的 11 碼影片 ID，`credits` 每一列為一組職務與姓名，`notes` 每一項是一段導演筆記。有副標時，`subtitle` 也要填兩種語言。
3. 從本機影片產生劇照與鏡頭資料，寫入 `web/img/films/<slug>/`。下例的片名代號與影片路徑請換成實際值。需要 ffmpeg 與 ffprobe；使用 cwebp 時會輸出 WebP。既有兩部作品各使用 24 張劇照。

   ```sh
   node scripts/film-frames.mjs your-film "/path/to/film.mp4" --frames 24
   ```
4. 從產生的劇照中選一張，把編號填入 `poster`，從 1 開始。例如 `poster: 10` 代表第 10 張。首頁與電影頁使用同一張封面。頁面上每一道色帶的顏色與寬度取自 `film.json` 裡的鏡頭平均色與長度。影片原檔留在本機。
5. 完成本機建置、測試與產物驗證後，開啟 `/films/<slug>/`、`/zh/films/<slug>/`，確認兩種語言的片名、製作名單、封面與播放版本。離線測試可檢查選取起播時間的操作，實際影音播放需連線核對。[檢查指令](../README.md)

更換 YouTube 上的字幕版或放映版本時，修改對應的 `youtube.en` 或 `youtube.zh`。如果重新剪輯造成片長或鏡頭順序改變，也要從新版本重建劇照與鏡頭資料，再確認封面編號。[電影欄位驗證](../lib/films.mjs) · [素材產生腳本](../scripts/film-frames.mjs)

## 維護一般作品列表

`content/works.json` 目前為空。`/essays/` 和 `/zh/essays/` 保留為同語言作品列表的別名。新增一般作品時，可先用以下兩個欄位建立草稿。

```json
{ "slug": "your-project", "published": false }
```

草稿不輸出到網站，儲存庫本身是公開的。請只提交可公開的資料。作者確認發布後，補齊下列欄位，再將 `published` 設為 `true`。

| 欄位 | 填寫方式 |
| --- | --- |
| `copy.zh`、`copy.en` | 各自包含 `title`、`summary`，可另填純文字 `description`。 |
| `media` | 陣列，可留空。每項提供 `type`（`image` 或 `video`）、公開 HTTPS 媒體直連、正整數 `width` 與 `height`，以及含 `zh`、`en` 的 `alt`。媒體網址填入 `src`；影片另可填 `poster`。 |
| `links` | 陣列，可留空。每項提供 HTTPS `url` 及含 `zh`、`en` 的 `label`。YouTube 觀看頁等外部網頁放在這裡。 |

建置後，已公開作品各有英文與繁中詳情頁，並列入 sitemap。一般作品的影片使用瀏覽器原生播放器，圖片與影片直接讀取所填的公開網址。[一般作品欄位與輸出規則](../lib/works.mjs)
