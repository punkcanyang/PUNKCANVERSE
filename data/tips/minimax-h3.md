# MiniMax H3 官方寫法要點

> 以下是我們依官方 Skill 文件整理的要點，引述均附出處；不是官方文件全文。

## 官方提示詞寫法要點
整理自 MiniMax 官方 `h3-prompt-writing` Skill 與 `base-en.txt`，每點標出處。
1. **先選模式，再套結構**
  出處：[SKILL.md](https://github.com/MiniMax-AI/MiniMax-H3/blob/main/skills/h3-prompt-writing/SKILL.md)
  T2VA／I2VA／FL2VA／L2VA 用三欄：`integrated_multimodal_description`、`overall_soundscape`、`non_diegetic_music`。Ref2VA 另用六段：`subject_definitions`、`summary`、`retention_analysis`、`detailed_description`、`overall_soundscape`、`non_diegetic_music`。
2. **時長必須對齊 4–15 秒**
  出處：同上 Tips
  「Always match the total duration of the description to the requested video length (4–15 seconds).」
3. **寫具體可見／可聽細節，少寫抽象形容**
  出處：同上 Tips
  「Prefer concrete visual and audio details over abstract words like "cinematic" or "beautiful".」
4. **分鏡時間戳：第一鏡不加時間，之後嚴格遞增**
  出處：[base-en.txt](https://raw.githubusercontent.com/MiniMax-AI/MiniMax-H3/main/skills/h3-prompt-writing/references/base-en.txt) §4.2
  寫法示例：`[Shot 2] At 00:03.500, the camera cuts to...`
5. **運鏡＝運動類型＋幅度＋速度**
  出處：base-en.txt §4.3
  例如：`The camera pushes in with small amplitude at slow speed toward...`。中等幅度／正常速度可省略。
6. **對白用穩定說話人 ID，原文語言原樣保留**
  出處：base-en.txt §4.4 與 SKILL Output Rules
  用 `(S1)`／`(S2)`；對白、歌詞、畫面上文字保持原語言，不要翻譯。
7. **音景與配樂分開寫**
  出處：base-en.txt §4.6–4.7
  `overall_soundscape` 寫環境／動作／非語言人聲；`non_diegetic_music` 只寫角色聽不到、觀眾才聽得到的配樂。沒有配樂就寫 `N/A`。
8. **首尾幀要寫清楚與時間軸的銜接**
  出處：SKILL Tips
  「When using keyframes (I2VA / FL2VA / L2VA), clearly state how the first and/or last frame connects to the timeline.」
9. **參考標籤全程一致**
  出處：SKILL Tips
  `<Picture 1>`／`<Video 1>`／`<Audio 1>` 這類標籤在各段都要同一套，不要中途改名。
10. **Atlas／社群補充（非官方原文，但實用）**
  出處：[AtlasCloudAI awesome-minimax-h3-prompts README](https://github.com/AtlasCloudAI/awesome-minimax-h3-prompts)
  七點：參考綁定、可觀察動作、空間關係、鏡頭與剪輯、視覺風格、音訊、必要約束。社群庫 BeatAPI 收有 550+ 條核驗案例：<https://github.com/BeatAPI/awesome-minimax-h3-prompts>
