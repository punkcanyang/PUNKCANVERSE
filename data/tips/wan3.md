# Wan 3.0 官方指南與真人／情感寫法要點

> 以下是我們依官方指南與社群作者公開分享整理的要點，引述均附出處；不是官方文件全文。

## 官方提示詞指南與 Wan 3.0 寫法要點
**官方指南**：[萬相 3.0 視頻生成 Prompt 指南](https://help.aliyun.com/zh/model-studio/wan3-video-generation-prompt-guide)
- **官方公式**：提示詞 = 總體描述 + 參考素材引用（圖1／視頻1／音頻1）+ 分鏡N（起–止秒）：主體 + 場景 + 運動 + 美學控制 + 台詞（角色說：「……」）+ 音效／BGM + 風格／情緒 + 負向清單。
- **分鏡要寫時間**：時間戳要連續，每個鏡頭 2–5 秒（生成文檔建議 4–6 秒），寫「硬切」「疊化」等轉場詞。想要單鏡頭就明說「一鏡到底／生成單鏡頭」。
- **素材按順序指代**：圖、視頻、音頻各自計數。input.media 裡第 1 張參考圖就是「圖1」，第 1 段參考視頻是「視頻1」。
- **台詞**：寫成「角色 + 說話動詞 + 冒號 + 引號」。用「音色參考 音頻1」指定聲音，加「口型同步」。
- **慢動作**寫成「（1000fps 慢動作）」。避免「一秒搖頭 3 次」這類高頻動作。
- **官方優化工具**：在百煉 AI 對話框輸入 `/wan3-pe` 加上提示詞，用 Skill 自動優化。
- **編輯／延長**：提示詞裡要有「編輯視頻、去掉、替換、改成」或「延長、延續、向前／向後延長」等意圖詞，ratio 設 adaptive，duration 設 -1。
**社群實測心得**（以下是作者原話的整理，非官方）：
- Ukiyo_il（[原帖](https://x.com/Ukiyo_il/status/2092548780658708526)）：每張參考圖固定一個角色；30 秒按「導入→攻防→被彈→反擊→決著」安排；高速移動寫「預備動作→中間省略→殘像→到達」；鏡頭要寫位置、旋轉方向和終點；攻擊寫「起點→接觸→結果」；台詞要短。
- Langby2（[原帖](https://x.com/Langby2/status/2100161820988440853)）：Seedance 的提示詞不能直接照搬到 Wan 3.0，同一張參考圖的人物會走樣。720P 30 秒成本 HKD16.47，Seedance 2.5 為 HKD25.6。
- hii_roto（[原帖](https://x.com/hii_roto/status/2099495108051951823)）：把打鬥動作寫細，動作會變好；特效指示寫太多，動作反而變僵。
- 官方帳號 @Alibaba_Wan 建議先用 360p／480p 試出效果，再拉高解析度。
- 常見弱點（多位作者反映）：快速動作不如慢場景穩定、多圖參考時人物臉部會漂移、有時不照指定語言配音。

## 真人風格寫法要點
整理自官方指南和本頁收錄的高讚真人提示詞，每點附出處。
- **光影：寫具體光源，不寫「完美打光」**。官方公式把光線放在「美學控制」裡，和景別、運鏡同一段寫（[官方 Prompt 指南](https://help.aliyun.com/zh/model-studio/wan3-video-generation-prompt-guide)）。高讚作品會寫明方向和色溫，例如「右上 45 度主光、5600K」（[johnAGI168](https://x.com/johnAGI168/status/2106723741602546165)）。夜景寫「realistic night exposure, no fake glow effects」（[poruru_ai](https://x.com/poruru_ai/status/2095088320753893689)）。另外要主動排除「overly perfect lighting」（[Inshrah_ali_](https://x.com/Inshrah_ali_/status/2106346419363700976)）。
- **鏡頭：用真實拍攝設備的語言**。官方示例會寫焦段和景深，例如「85mm 長焦淺景深」，每個分鏡 2–5 秒。想要真人感，最有效的是寫「不完美」：手持輕晃、自動對焦和曝光變化（[codewithhajra](https://x.com/codewithhajra/status/2109516673635999856)），「像被觀察而非表演、構圖不完美」（[mightyking](https://x.com/mightyking/status/2091825720657883530)），8mm 片門晃動和膠片顆粒（[old_pgmrs_will](https://x.com/old_pgmrs_will/status/2092662562538352910)）。高價感廣告則寫「ARRI Alexa 色彩、淺景深」（[johnAGI168](https://x.com/johnAGI168/status/2091876549985288529)）。
- **膚質：每段都重申 realistic skin texture**。中文可直接寫「真實攝影質感、無塑料感、無 AI 油光」（[johnAGI168 IN RED](https://x.com/johnAGI168/status/2091876549985288529)）。人物描述可以細到亂髮、極淡鬍渣、略疲憊的眼神（[mightyking](https://x.com/mightyking/status/2091825720657883530)），細節越具體，越不像蠟像。
- **表情：寫生理反應，不寫形容詞**。不要只寫「很傷心」，要寫「眼淚持續滑落、眼眶紅腫、鼻尖泛紅、面部肌肉真實抽搐」，並禁止「舞台表演感」（[PixelAigc](https://x.com/PixelAigc/status/2092106222128574802)）。笑場、自然收尾這類「不完美表演」也很加分（[MonetizationDon](https://x.com/MonetizationDon/status/2097332722091860172)）。動作要拆小，每 3–5 秒一個核心動作，避免一秒內做太多事（[騰訊新聞・梧桉AI 實測](https://news.qq.com/rain/a/20260815A04A7200)；官方指南也提醒避免高頻動作）。
- **避開塑料感**：在開頭或結尾加一段反 AI 清單。現成可抄的例子：「100% 像真實拍攝，不是 CGI、不是動畫；避免過度完美的光、塑料感皮膚、假背景、過度銳利」（[Inshrah_ali_](https://x.com/Inshrah_ali_/status/2106346419363700976)）；「practical-looking effects… Avoid an obvious AI look」（[ahmadmalik375](https://x.com/ahmadmalik375/status/2103433315458097320)）；「禁止假髮套感的頭髮、塑料皮膚、浮腫臥蠶、CG 蠟像臉」（[johnAGI168](https://x.com/johnAGI168/status/2106723741602546165)）；「禁止美顏磨皮」（[PixelAigc](https://x.com/PixelAigc/status/2092106222128574802)）。
- **避開臉崩／換臉**：①先寫「身份鎖定」段，把臉型、膚色、髮際線、鬍渣全部列出並禁止變臉、變老（[Xaroon_x](https://x.com/Xaroon_x/status/2093988944392175714)），或用 REFERENCE LOCK／OUTFIT LOCK 分開鎖臉和服裝（[poruru_ai](https://x.com/poruru_ai/status/2095088320753893689)）。②一張參考圖只放一個角色（[Ukiyo_il](https://x.com/Ukiyo_il/status/2092548780658708526)），三人戲要寫清座位和左右關係（[drjoetw](https://x.com/drjoetw/status/2089899857733616124)）。③負向清單照官方寫「不要人臉變形、不要人物換臉、不要多餘手指」（[官方 Prompt 指南](https://help.aliyun.com/zh/model-studio/wan3-video-generation-prompt-guide)）。④圖生視頻時鎖死首幀背景（[PrometheanAIX](https://x.com/PrometheanAIX/status/2111461046317715519)）。⑤多張參考圖時臉容易漂移，快速動作也比慢場景不穩，所以真人戲盡量少圖、慢動作、先用 480p 試。

## 情感／情緒戲寫法要點
整理自阿里雲萬相 3.0 官方 Prompt 指南、百煉《視頻生成 Prompt 指南》，以及社群驗證寫法；每點標出處與原文引述，不自行編造官方未說過的話。
### 官方建議（務必對照原文）
1. **公式裡要有「風格／情緒」板塊**
  出處：[萬相 3.0 視頻生成 Prompt 指南](https://help.aliyun.com/zh/model-studio/wan3-video-generation-prompt-guide)
  原文引述：「提示詞 = [总体描述] + … + [风格 / 情绪] + [负向清单]」；情緒關鍵詞示例：「悲壮孤峙」「轻快治愈」「压抑紧张」「松弛自信」「神秘魔幻」。
2. **總體描述要交代「整體情緒」**
  出處：同上（分鏡與時間戳）
  原文引述：「总体描述：一句话交代主题、视角、叙事风格与整体情绪。」示例短劇：「讲述一个关于放弃与重拾希望的短剧」，並寫「泪光闪烁，带着失落和无助」。
3. **人聲＝內容＋情緒＋語調＋語速＋音色＋口音**
  出處：[視頻生成 Prompt 指南（百煉）](https://help.aliyun.com/zh/model-studio/text-to-video-prompt)「聲音公式」
  原文引述：「人声 = 角色说话的内容 + 情绪 + 语调 + 语速 + 音色 + 口音」。示例用「语气轻松，语速适中…」這類可執行描述，而不是只寫「很開心」。
4. **微表情需與台詞情緒契合（音訊驅動示例）**
  出處：[萬相 3.0 Prompt 指南](https://help.aliyun.com/zh/model-studio/wan3-video-generation-prompt-guide)「音頻驅動」示例
  原文引述：「说话时伴随自然的眨眼、轻微的头部点动和呼吸感，面部微表情需与台词中的关怀、回忆情绪完美契合。」
5. **負向清單可禁「誇張眨眼／誇張肢體」**
  出處：[萬相 3.0 Prompt 指南](https://help.aliyun.com/zh/model-studio/wan3-video-generation-prompt-guide)「負向清單・動作」
  原文引述：「不要夸张肢体动作」「不要夸张眨眼」。情緒戲想克制時，可把這兩條寫進負向清單。
6. **提示詞詞典有「人物情緒」槽位**
  出處：[視頻生成 Prompt 指南](https://help.aliyun.com/zh/model-studio/text-to-video-prompt)「人物情緒」
  原文示例：「十分高兴，眼睛里闪烁着纯粹的幸福」；「脸上是惊讶的表情」。官方示範仍會補可見細節（眼／臉），而非單字標籤。
### 社群驗證有效的情感寫法（有出處）
- **把情緒寫成可見動作鏈，不要只寫情緒標籤**
  出處：[Atlas Cloud《如何编写 Wan 3.0 提示词》](https://www.atlascloud.ai/zh/blog/tips/how-to-write-wan-3-0-prompt)
  原文要旨：「将表演写成一系列可见动作，切勿使用情感标签。『焦虑』是一种希望。『咀嚼变慢、眉头皱起、目光垂落到手上』才是一条指令。」（英文版同站：[How to Write Wan 3.0 Prompts](https://www.atlascloud.ai/blog/tips/how-to-write-wan-3-0-prompt)）
- **長鏡頭給一個緩慢可見變化（目光軌跡／姿勢）**
  出處：同上 Atlas Cloud 官方案例解讀——固定特寫加「目光从前方移到看向自己的手」這類可驗證微動作。
