# 打鬥提示詞寫法要點

> 這頁整理的是寫打鬥／械鬥提示詞的要點，來源有官方指南、社群作者在貼文裡講的心得，還有資料庫裡實際案例的成敗。最後一段「改寫範例，未實測」是我自己改寫的，**還沒有跑過**，請勿當成收集來的實測提示詞。

## 一、通用寫法（各家官方指南的共識）
- **一段只講一個瞬間**：Veo 官方建議一支片聚焦一個動作節點；打鬥拆成「起手 → 接觸 → 反應」分段，比一句話寫完整場戰鬥穩定。
- **公式**：主體＋動作＋場景＋鏡頭＋風格／光線（Veo 官方五段式；Wan 官方也是類似的公式）。
- **時間碼／分鏡塊**：Veo 支援時間碼寫法（例如 [00:00-00:02]）；Wan 2.6 可寫「Shot 1 [0-3s]」；Kling 3.0 支援多鏡頭，最多 6 鏡／15 秒；Seedance 社群也普遍用分鏡塊。
- **鏡頭語言放前面**：Runway 官方建議用「[Camera] shot of …」開頭；Hailuo 可以把運鏡指令放進方括號，例如 [Tracking shot]。
- **一個鏡頭只給一種運鏡**：Grok Imagine 的建議是一次一個鏡頭運動，疊太多會亂。
- **Midjourney 影片**：圖生影片，動作大的話加 --motion high；想少一點風格化加 --raw；參數 --video 1。
## 二、各模型強項（依社群實測與案例整理）
| 模型 | 強項 | 注意 |
|---|---|---|
| Seedance（即夢） | 複雜動作編排、多鏡頭、一鏡到底，資料庫裡最多的案例（26 條） | 提示詞不要堆太多；要鎖定「誰拿哪把武器」 |
| 可靈 Kling | 多鏡頭敘事、戲劇張力（CuriousRefuge 比較時 Kling 2.0 最有戲） | Kling 2.1 在出拳測試裡把拳頭變成打噴嚏 |
| 海螺 Hailuo | 社群稱「動作之王」，速度感強 | 2.3 Fast 在出拳測試表現普通 |
| Veo | 解剖結構正確、畫質穩 | 出拳測試被評「正確但慢、無聊」；暴力審核最嚴 |
| Wan 萬相 | 出拳測試 Wan 2.5 表現很好；Wan 2.2 能打出 Veo 3 失敗的打鬥；Wan 3.0 最長 30 秒 | 開源版自由度高 |
| Runway | 電影感構圖 | Gen-4.5 測試時「水」被畫成不透明的 |
| Luma Ray | 氛圍、光影、火光戰場 | 動作細節較弱 |
| Grok Imagine | 快、能做分場景連招 | 運鏡要單純 |

## 三、常見失敗與避免方法
1. **武器跑來跑去、換手**：在提示詞裡寫明每個角色手上拿什麼（例如「A holds a bamboo pole, B holds a sickle」），並且整段維持。
2. **剪接太碎、角色走樣**：Seedance 社群建議少切鏡；慢一點、連續的動作比快速亂打更不容易崩。
3. **「一鏡到底」還是被切鏡**：Langby2 實測寫了一鏡到底仍出現剪接；要搭配「single continuous take, no cuts」並減少場景變化。
4. **字面誤讀**：Langby2 寫「吊臂」鏡頭，模型真的畫出一支吊臂；箭的方向也常飛反。運鏡用英文標準術語（crane shot）比較安全。
5. **出拳變成別的動作**：動作動詞要具體（jab、uppercut、sweep kick），並描述打中後的反應。
6. **AI 破綻藏起來**：godswayfoundinc 的心得是用運動攝影機（action cam）的手持晃動畫面，可以掩飾手腳穿模。
7. **想要即時速度感**：與其寫「no slow motion」，不如寫「1/500s shutter」這類快門描述。
8. **服裝或臉跑掉**：Seedance 1.0 在測試時換了衣服；圖生影片加參考圖會比純文字穩。
9. **寫太多反而差**：多位 Seedance 使用者表示，精簡的提示詞效果更好。
## 四、各平台暴力內容審核與合規寫法
- **Veo（Google）**：違規時會回 RAI 錯誤碼，例如 Violence 61493863／56562880、Celebrity（名人肖像）29310472／15236754。看到這些代碼就是被暴力或真人規則擋下。
- **可靈 Kling**：使用政策禁止美化暴力、禁止管制武器內容。
- **Seedance**：如果不交代血腥程度，過濾器常會把整段軟化；明講「no blood, no gore」反而比較穩定。
- **合規寫法建議**：
  - 用「火花、黑色粒子、塵土飛揚」取代流血。
  - 用聲音和受擊反應（踉蹌、倒地、武器脫手）表現力道，不拍傷口。
  - 包裝成風格化／奇幻／歷史重現（stylized, historical reenactment, mythological）。
  - 不用真人臉、不提名人名字。
  - 放火燒屋：寫火光、濃煙、人群逃散，不寫人被燒。
- 社群裡有人分享「繞過審核」的寫法（例如 7724bart 的貼文），**這類內容不建議照做**，可能違反平台條款、導致封號。
## 五、改寫範例，未實測
> 以下是我依前面的要點自己改寫的閩客械鬥示範版，**改寫範例，未實測**。它們不是收集來的提示詞，效果未知。

**範例 A：夜間村落械鬥（Seedance／Kling 分鏡寫法）**
```
Shot 1 [0-4s]: Wide shot, night, a 19th-century Taiwanese farming village with red-brick sanheyuan houses. Two clans face each other across a muddy field, torches raised. Clan A holds bamboo poles and hoes, clan B holds sickles and wooden shields. Firelight flickers on their faces.
Shot 2 [4-9s]: Handheld tracking shot following a young man in a dark cotton tunic as he blocks a sickle with his bamboo pole and sweeps his opponent's legs. Sparks and dust, no blood. Every character keeps the same weapon throughout.
Shot 3 [9-15s]: Slow crane up over the field, a thatched roof catches fire in the background, villagers scatter, smoke rises into the moonlit sky. Cinematic, realistic, 1/500s shutter, historical reenactment.
```
**範例 B：原住民神靈對打（一鏡到底）**
```
Single continuous take, no cuts. A mountain spirit made of mossy stone and glowing ferns rises from a misty forest in central Taiwan and clashes with a giant serpent formed of river water. The camera orbits slowly around them at ground level as their impacts throw spray and leaves into the air. Mythological, stylized, dawn light through the fog, no gore.
```
**範例 C：徒手格鬥（功夫，圖生影片）**
```
[Tracking shot] Two martial artists in a temple courtyard of an old Taiwanese town. The man in grey blocks a straight punch, counters with an elbow strike, then a spinning sweep kick; his opponent stumbles back and rolls to his feet. Fluid, continuous choreography, real-time speed, no slow motion.
```
