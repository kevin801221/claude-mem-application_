# 從 Claude Code 原生記憶到 claude-mem

> 教學模組｜資料日期：2026-11-16
> 原生記憶的規格以 Claude Code 官方文件為準：[Memory](https://code.claude.com/docs/en/memory)、[Claude directory](https://code.claude.com/docs/en/claude-directory.md)。claude-mem 是社群開源專案，不是 Anthropic 官方工具。
> 本頁的圖都是 Mermaid，GitHub 會直接畫出來；投影片用的 PNG 在 [`docs/images/`](images/)。

**教學主軸：先讓學員撞牆，再給解藥。** 用同一個問題貫穿整堂課，讓學員理解記憶從「手動」到「自動」的演進，而不是學兩個互不相關的工具。

**一句話結論：** 原生記憶負責「規則」和「Claude 自己覺得重要的筆記」；想要「每件事都自動記、記了找得到、跨 agent、保存不過期」，才需要 claude-mem。

---

## 1. 原生記憶的三層

Claude Code 不裝任何東西，就有三個地方會留下記憶。差別在於**誰寫、存哪裡、新 session 會不會自動讀進來**。

![原生記憶的三層](images/01-native-memory-layers.png)

```mermaid
flowchart LR
  subgraph WHO["誰寫進去"]
    H["你手寫"]
    C["Claude 自己判斷<br/>值得記的才記"]
    A["Claude Code<br/>自動全部錄下"]
  end
  subgraph WHERE["存在哪裡"]
    M1["CLAUDE.md<br/>~/.claude/CLAUDE.md<br/>專案/CLAUDE.md"]
    M2["auto memory<br/>~/.claude/projects/{專案}/memory/MEMORY.md"]
    M3["對話紀錄 JSONL<br/>~/.claude/projects/{專案}/{session}.jsonl"]
  end
  subgraph LOAD["新 session 開始時"]
    L1["整份讀進來<br/>官方建議每份 200 行內"]
    L2["只讀前 200 行或 25KB<br/>主題檔需要時才讀"]
    L3["不會自動讀進來<br/>只能 /resume 接回單一 session"]
  end
  H --> M1 --> L1
  C --> M2 --> L2
  A --> M3 --> L3
  M3 -.-> DEL["超過 30 天自動刪除<br/>cleanupPeriodDays"]
  classDef bad fill:#fde8e8,stroke:#c0392b,color:#7a1c12
  class DEL bad
```

| 層 | 放什麼 | 誰維護 | 新 session 讀不讀 | 會不會過期 |
| --- | --- | --- | --- | --- |
| CLAUDE.md | 不變的規則與專案常識 | 人 | 整份讀，`/compact` 後也會重新讀 | 不會 |
| auto memory | build 指令、除錯心得、架構筆記、偏好 | Claude 自己決定要不要記 | 只讀 `MEMORY.md` 前 200 行或 25KB | 不會，清理不刪記憶檔 |
| JSONL 對話紀錄 | 每句話、每次工具呼叫和結果，完整原文 | Claude Code 自動 | 不會，要用 `/resume` | 預設 30 天後刪除 |

補充幾個教學時常被問的細節：

- auto memory 需要 Claude Code v2.1.59 以上，預設開啟，用 `/memory` 可以查看、編輯、關閉。
- auto memory 只存在這台電腦，不會跨機器同步。
- JSONL 是明文，沒有加密；指令印出的密碼、讀過的 `.env` 都會原封不動寫進去。
- 只在對話裡交代、沒寫進 CLAUDE.md 的指示，`/compact` 之後可能就不見了。

---

## 2. 現場製造痛點：撞牆實驗

![撞牆實驗流程](images/02-wall-experiment.png)

```mermaid
sequenceDiagram
  autonumber
  actor U as 學員
  participant CC as Claude Code
  participant MEM as 記憶
  rect rgb(240, 244, 250)
    Note over U,MEM: 第一回合：只有原生記憶
    U->>CC: 做一段有明確決策的工作<br/>例如：選定 PostgreSQL，理由是要做全文搜尋
    CC-->>MEM: JSONL 全錄；auto memory 由 Claude 自己決定記不記
    U->>CC: 關閉，重開新 session
    U->>CC: 我們上次決定用哪個方案？為什麼？
    MEM-->>CC: CLAUDE.md 沒寫、auto memory 不一定有、JSONL 不會自動讀
    CC-->>U: 答不出來，或只答得出結論、說不出理由
  end
  rect rgb(238, 248, 240)
    Note over U,MEM: 第二回合：裝上 claude-mem
    U->>CC: npx claude-mem install，重做同一段工作
    CC-->>MEM: 每次工具呼叫都被記成結構化筆記，結束時寫摘要
    U->>CC: 重開 session，問同一個問題
    MEM-->>CC: 開工時自動帶入索引，需要時再搜細節
    CC-->>U: 答出結論、理由，還附上紀錄 ID
  end
```

步驟（照原教案）：

1. 做一小段有明確決策的工作，例如選定某個方案並說明理由。
2. 關閉 Claude Code，重新開一個新的 session。
3. 問：「我們上次決定用哪個方案？為什麼？」
4. 學員會看到原生記憶答不出來，或是必須有人事先手動寫進 CLAUDE.md 才答得出來。

> **教學提醒：auto memory 可能讓實驗「沒撞到牆」。** auto memory 由 Claude 自己決定記什麼，有時會剛好把這個決策記下來。建議這樣安排：
> - 第一回合結束後，先用 `/memory` 打開 auto memory，讓學員看它記了什麼、漏了什麼。這本身就是很好的教材：「它有記，但記不記、記多少，由不得你」。
> - 想示範最純粹的情況，第一回合可以暫時關掉 auto memory（`/memory` 裡切換，或設定環境變數 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`），第二回合再打開對比。
> - 問題不要只問結論，要問「為什麼」和「當時還考慮過哪些方案」。原生記憶通常只留結論，細節才是 claude-mem 拉開差距的地方。

---

## 3. 原生記憶的限制

| 原教案的說法 | 2026 年 11 月的實際情況 |
| --- | --- |
| 要靠人手動寫，忘了寫就沒有 | **部分成立。** auto memory 會自動記，但由 Claude 自己挑，不保證記到你要的；CLAUDE.md 仍然要人寫。 |
| 無法搜尋，只能整份讀進去，佔用 context | **成立。** CLAUDE.md 整份讀；`MEMORY.md` 超過 200 行或 25KB 的部分開工時不會讀；能「找」的只有 Claude 用 grep 讀檔，沒有語意搜尋。 |
| JSONL 預設 30 天就會被清掉，不是長期保存 | **成立。** `cleanupPeriodDays` 預設 30、最小 1；但 auto memory 檔案不會被這個清理刪掉。 |

---

## 4. 不裝 claude-mem，用 JSONL 自己做一套行不行？

可以。思路是：下班時寫一支腳本，把當天的 JSONL 撈出來，交給 Claude 摘要成筆記，存成 Markdown，下次開工再讓 Claude 讀。但每一步都會碰到問題，紅色就是要自己補的坑。

![用 JSONL 自己做記憶的流程與問題](images/03-jsonl-diy-pitfalls.png)

```mermaid
flowchart LR
  subgraph G1["① 找出當天的 JSONL"]
    direction TB
    S1["~/.claude/projects/{專案}/*.jsonl"]
    P1["P1 30 天自動刪除<br/>要調 cleanupPeriodDays<br/>或每天備份"]
    P2["P2 內部格式沒有公開規格<br/>改版後腳本可能壞掉"]
    P9["P9 跨 agent 要各寫一支<br/>Codex 在 ~/.codex/sessions"]
    S1 -.- P1 -.- P2 -.- P9
  end
  subgraph G2["② 清理與切段"]
    direction TB
    S2["去掉工具輸出<br/>太長要分批"]
    P3["P3 檔案很大、雜訊多<br/>不能整包丟給模型"]
    S2 -.- P3
  end
  subgraph G3["③ 叫 Claude 摘要"]
    direction TB
    S3["claude -p 下班批次執行"]
    P4["P4 沒有第二個 LLM 即時整理<br/>只能事後摘要、吃主額度<br/>沒有類型、事實、檔案結構"]
    S3 -.- P4
  end
  subgraph G4["④ 存成筆記"]
    direction TB
    S4["notes/YYYY-MM-DD.md"]
    P5["P5 密鑰明文原封不動<br/>沒有遮蔽"]
    S4 -.- P5
  end
  subgraph G5["⑤ 下次開工讀回來"]
    direction TB
    S5["CLAUDE.md @import<br/>或叫 Claude 自己 grep"]
    P6["P6 沒有混合搜尋<br/>換個說法就找不到"]
    P7["P7 沒有漸進揭露<br/>@import 整份讀<br/>MEMORY.md 超過 200 行被截"]
    P8["P8 不會自動帶入<br/>要自己寫 SessionStart hook"]
    S5 -.- P6 -.- P7 -.- P8
  end
  G1 ==> G2 ==> G3 ==> G4 ==> G5

  classDef step fill:#eef3fb,stroke:#3b6db3,color:#14325c,font-weight:bold
  classDef bad fill:#fde8e8,stroke:#c0392b,color:#7a1c12
  class S1,S2,S3,S4,S5 step
  class P1,P2,P3,P4,P5,P6,P7,P8,P9 bad
```

逐一說明：

| # | 問題 | 為什麼會發生 | 自己補要做什麼 |
| --- | --- | --- | --- |
| P1 | 30 天自動刪除 | `cleanupPeriodDays` 預設 30 天，最小 1 | 調大設定值，或每天把 JSONL 備份到別處 |
| P2 | 格式可能改版 | JSONL 是 Claude Code 內部格式，沒有承諾穩定 | 腳本要寫得寬容，改版後跟著修 |
| P3 | 檔案大、雜訊多 | 每次工具輸出都完整記錄；子代理在 `subagents/`、大輸出在 `tool-results/` | 寫清理程式，只留對話與關鍵動作 |
| P4 | 沒有第二個 LLM | 原生沒有「觀察者」在旁邊邊做邊記 | 只能下班批次摘要；吃同一份額度；格式要自己設計 |
| P5 | 密鑰明文 | JSONL 不加密，印出來的東西都在 | 自己寫遮蔽規則，或接受風險 |
| P6 | 沒有混合搜尋 | 原生只能讓 Claude 用 grep 找字 | 自己架 BM25 加向量檢索，等於重做一套 |
| P7 | 沒有漸進揭露 | `@import` 的檔案開工時整份讀；`MEMORY.md` 只讀前 200 行 | 自己維護索引檔，控制長度 |
| P8 | 不會自動帶入 | 筆記檔只是普通檔案 | 寫 SessionStart hook 把摘要注入 |
| P9 | 跨 agent | 每種 agent 紀錄位置與格式不同 | 每種各寫一支解析程式 |

---

## 5. claude-mem 怎麼把這些坑填起來

![claude-mem 的管線與對應解決的問題](images/04-claude-mem-pipeline.png)

```mermaid
flowchart LR
  subgraph G1["① 收集：hooks"]
    direction TB
    S1["Claude Code、Codex 等十幾種<br/>開工、送 prompt、每次工具、<br/>回覆結束、結束都會觸發"]
    F2["解決 P2 P3 P9<br/>直接收資料，不解析 JSONL<br/>一套支援多種 agent"]
    F4["解決 P5<br/>private 標籤在這裡就剝掉<br/>密鑰自動遮蔽"]
    S1 -.- F2 -.- F4
  end
  subgraph G2["② 整理：觀察者 LLM"]
    direction TB
    S2["背景 worker 交給<br/>Haiku、Codex 或其他"]
    F3["解決 P4<br/>第二個 LLM 邊做邊記<br/>寫成類型、事實、檔案的結構化筆記"]
    S2 -.- F3
  end
  subgraph G3["③ 保存"]
    direction TB
    S3[("SQLite 全文搜尋<br/>+ Chroma 向量索引<br/>~/.claude-mem/")]
    F1["解決 P1<br/>不會過期，還有自動備份"]
    S3 -.- F1
  end
  subgraph G4["④ 下次開工取用"]
    direction TB
    S4["開工自動注入標題索引<br/>需要時三步驟搜尋<br/>search → timeline → get_observations"]
    F6["解決 P7 P8<br/>漸進揭露，開工只花 50 到 200 token<br/>自動注入，不用自己寫 hook"]
    F5["解決 P6<br/>關鍵字加語意的混合搜尋"]
    S4 -.- F6 -.- F5
  end
  G1 ==> G2 ==> G3 ==> G4

  classDef step fill:#eef3fb,stroke:#3b6db3,color:#14325c,font-weight:bold
  classDef good fill:#e6f4ea,stroke:#2e7d32,color:#1b4d20
  class S1,S2,S3,S4 step
  class F1,F2,F3,F4,F5,F6 good
```

和上一張圖對照著看：同樣是「收集 → 整理 → 保存 → 取用」四段，紅色的坑在這裡都變成綠色。

### 對照總表

| 面向 | 原生：CLAUDE.md + auto memory | 原生：JSONL 自己做 | claude-mem |
| --- | --- | --- | --- |
| 安裝 | 不用 | 不用裝，但要寫腳本 | `npx claude-mem install` |
| 記什麼 | 規則（人寫）＋ Claude 挑的重點 | 什麼都有，看你怎麼摘 | 每次工具呼叫都記，結構化 |
| 誰整理 | 人與 Claude 主對話 | 下班批次用主模型 | 背景的第二個 LLM，即時 |
| 開工自動帶入 | 有，CLAUDE.md 整份、MEMORY.md 前 200 行 | 沒有，要自己寫 hook | 有，只帶標題索引 |
| 搜尋 | 只能 grep | 只能 grep，或自己架 | 內建關鍵字＋語意混合 |
| 保存 | 不過期 | 30 天，要自己備份 | 永久，自動備份 |
| 跨 agent | 只有 Claude Code | 每種各寫一支 | 一套支援十幾種 |
| 隱私 | CLAUDE.md 自己控制 | JSONL 明文 | private 標籤＋自動遮蔽 |
| 額外 token | 幾乎沒有 | 一天一次批次 | 每次工具呼叫都送觀察者，可改吃 Codex 額度 |
| 誰維護 | Anthropic 官方 | 你自己 | 社群開源專案 |
| 公司資安審查 | 最容易 | 容易 | 要審第三方工具、觀察者會把操作內容送到你設定的 AI 服務 |

---

## 6. 記憶方案地圖：你在哪個象限？

橫軸是要花多少力氣設定和維護，縱軸是記憶能力（會不會自動記、記了找不找得到）。位置是教學用的相對示意，不是量測結果。

![記憶方案地圖](images/05-memory-map.png)

```mermaid
quadrantChart
  title 記憶方案地圖（相對示意）
  x-axis 設定與維護省力 --> 設定與維護費力
  y-axis 記得少又難找 --> 自動記又找得到
  quadrant-1 強大但要投入
  quadrant-2 首選區
  quadrant-3 起步區
  quadrant-4 費力又不划算
  CLAUDE.md: [0.12, 0.22]
  resume 接回舊對話: [0.08, 0.12]
  auto memory: [0.18, 0.42]
  JSONL 自己做摘要: [0.80, 0.36]
  claude-mem: [0.36, 0.80]
  claude-mem 加文件檢索: [0.62, 0.92]
```

怎麼讀這張圖：

- **起步區（左下）**：每個人都從這裡開始。CLAUDE.md 和 auto memory 不用裝東西，但記得少、找不到。
- **首選區（左上）**：claude-mem 一行安裝，換到「自動記又找得到」，對多數人最划算。
- **強大但要投入（右上）**：再加上文件檢索（INDEX.md 或 knowledge-rag），連數千份文件也查得到，但要整理文件與維護索引。
- **費力又不划算（右下）**：自己解析 JSONL 做摘要，工程量大、能力卻還比不上 claude-mem。只有在「不能裝第三方工具」或「很在意 token」時才值得。

**要往哪裡移動？** 先站穩「起步區」（把規則寫進 CLAUDE.md），再往上移到「首選區」（裝 claude-mem）；手上真的有大量文件要查，才往右上加文件檢索。盡量不要停在右下。

---

## 7. 決策樹：要不要用 claude-mem？

![要不要用 claude-mem 的決策樹](images/06-decision-tree.png)

```mermaid
flowchart TD
  Q0{"公司允許安裝第三方開源工具<br/>而且允許把操作內容送給觀察者 LLM？"}
  Q1{"需要跨 session 記得<br/>決策、理由、踩過的坑？"}
  Q2{"只要日報，很在意 token，<br/>而且會寫、會維護腳本？"}
  Q4{"還有大量文件要查？"}
  R1["原生就好<br/>CLAUDE.md + auto memory + /resume"]
  R2["原生 + JSONL 自己做<br/>記得調 cleanupPeriodDays、自己做遮蔽"]
  R3["claude-mem<br/>多 agent、團隊、新手最受益<br/>可改用 Codex 整理，省 Claude 額度"]
  R4["claude-mem + 文件檢索<br/>見 doc-retrieval-and-memory.md"]
  Q0 -- 否 --> R2
  Q0 -- 是 --> Q1
  Q1 -- 否 --> R1
  Q1 -- 是 --> Q2
  Q2 -- 是 --> R2
  Q2 -- 否 --> R3
  R3 --> Q4
  Q4 -- 是 --> R4
  classDef res fill:#eef3fb,stroke:#3b6db3,color:#14325c
  classDef best fill:#e6f4ea,stroke:#2e7d32,color:#1b4d20
  class R1,R2 res
  class R3,R4 best
```

走到 claude-mem 這一格，代表你需要跨 session 記憶、又不想自己維護腳本。同時用多種 agent、要給新手或整個團隊用的人，從它得到的好處最多。

---

## 8. 收尾講分工

| 記憶層 | 放什麼 | 誰維護 |
| --- | --- | --- |
| CLAUDE.md | 不變的規則與專案常識 | 人 |
| auto memory（補充） | Claude 自己覺得重要的筆記 | Claude 自己 |
| claude-mem | 工作過程、決策、踩過的坑 | 自動 |
| 文件檢索（INDEX.md 或 knowledge-rag） | 資料與文件內容 | 工具自動建索引 |

![記憶的分工與查詢路由](images/07-memory-roles.png)

```mermaid
flowchart LR
  Q["你的問題"]
  R{"CLAUDE.md 裡的檢索規則"}
  M["claude-mem<br/>之前討論過、決定過、做過的事"]
  D["文件檢索<br/>INDEX.md 或 knowledge-rag<br/>客戶、製程、技術資料"]
  B["兩者都相關：<br/>先查記憶拿背景，再查文件拿依據"]
  A["回答＋出處檔名<br/>找不到就說找不到"]
  Q --> R
  R -- 問過去的決定 --> M --> A
  R -- 問文件內容 --> D --> A
  R -- 兩者都有 --> B --> A
```

---

## 9. 舊專案的銜接範例

以一個將近一年前的專案重啟為例：claude-mem 無法回溯安裝前的紀錄，所以要先用 Claude Code 讀舊的 JSONL 或程式碼與 git 紀錄，抽出決策與開發過程，整理成 Markdown 放進 CLAUDE.md 或匯入 claude-mem，之後再由 claude-mem 自動接手。清理 JSONL 時先去掉 tool output，體積可大幅縮小。

![舊專案銜接流程](images/08-legacy-project-bridge.png)

```mermaid
flowchart LR
  subgraph OLD["安裝前留下的東西"]
    J["舊 JSONL<br/>若還沒被 30 天清掉"]
    G["git log 與 commit 訊息"]
    CODE["程式碼與 README"]
    AM["auto memory 筆記"]
  end
  CLEAN["先去掉 tool output<br/>體積大幅縮小"]
  EX["Claude Code 抽出<br/>決策、理由、開發過程"]
  MD["整理成 Markdown<br/>docs/history.md"]
  C1["放進 CLAUDE.md<br/>不變的規則與結論"]
  C2["匯入 claude-mem<br/>過程與決策細節"]
  NEW["之後由 claude-mem 自動接手"]
  J --> CLEAN --> EX
  G --> EX
  CODE --> EX
  AM --> EX
  EX --> MD
  MD --> C1 --> NEW
  MD --> C2 --> NEW
```

補充：

- 一年前的 JSONL 多半已經被 30 天清理刪掉了，這時主要靠 git 紀錄和程式碼。
- 匯入 claude-mem 的方式：官方文件有「Memory Ingest」頁面，說明如何匯入 Claude Code 的內建記憶檔；也可以用 claude-mem 的匯出、匯入腳本搬移紀錄。細節以官方原文為準。
- 不變的結論放 CLAUDE.md，過程細節放 claude-mem，不要全部塞進 CLAUDE.md，否則每次開工都要整份讀進來。

---

## 來源

- [Claude Code：How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Claude Code：Claude directory reference](https://code.claude.com/docs/en/claude-directory.md)
- [Claude Code：Settings](https://code.claude.com/docs/en/settings)
- [claude-mem 官方文件](https://docs.claude-mem.ai/introduction)
- 本 repo：[claude-mem 繁中重點整理](claude-mem-zh-tw.md)、[文件檢索與長期記憶](doc-retrieval-and-memory.md)
