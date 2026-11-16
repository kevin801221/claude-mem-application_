# 團隊自動化日報／週報系統架構（Claude Code + claude-mem）

> 資料日期：2026-11-15。這是架構設計，尚未在團隊中實測，導入前請先小規模試行。

> 想實作「組內可互看、跨組隔離、每月一份共用 PPTX」的 Git 工作坊，請看[手動＋自動版教學](team-report-workshop.md)。本文下方的 Notion／Jira 架構是另一條路徑。

## 一、目標

讓團隊每位成員不用手動整理，每天下班時間（例如 19:00）自動產出個人日報，週末自動彙整成週報。所有報告集中到共同的報告庫，主管端再由 Claude Code 每天、每週自動彙整全團隊的狀況。

## 二、整體架構

系統分成三層：

1. **成員端（記錄層）**：每位成員的 Claude Code（或 Codex）裝 claude-mem，自動記錄當天做過的事。
2. **報告庫（彙整層）**：共同維護的地方，例如 Notion 資料庫、Jira，或一個共用的 Git repo，存放所有人的日報與週報。
3. **主管端（分析層）**：主管的 Claude Code 有權限讀取報告庫，依排程自動產出團隊日報與團隊週報。

資料流向：成員工作 → claude-mem 記錄 → 排程觸發產出個人日報 → 上傳報告庫 → 主管端排程讀取 → 產出團隊彙整報告 → 寄信或貼到 Notion／Jira。

## 三、成員端：claude-mem 負責記錄

claude-mem 會在 coding agent 旁邊跑一個背景 agent，邊工作邊做筆記，資料存在本機。重點機制如下：

- **五個生命週期 hooks**：SessionStart、UserPromptSubmit、PostToolUse、Summary（Stop）、SessionEnd。每次 session 結束時會自動產生摘要。
- **本機 SQLite 資料庫**：存放 sessions、observations、summaries，支援全文搜尋。
- **MCP 搜尋工具**：可以用自然語言查詢歷史紀錄，例如「今天我做了哪些事」。
- **多語言**：可以設定用中文寫記憶。
- **隱私控制**：用 `<private>` 標籤排除敏感內容，或開啟自動遮蔽密鑰的功能。
- **跨 agent**：支援 Claude Code、Codex、Cursor 等，同一位成員兩種工具都用的話，紀錄可以集中在一起。

### 安裝 claude-mem（建議做法）

建議用 npx 安裝程式，不要只用 Claude Code 的 plugin marketplace。npx 版可以一次幫多個 agent（Claude Code、Codex、Cursor 等）註冊 hooks，讓同一位成員的所有工作紀錄集中在同一個記憶庫。

1. 先確認環境：Node.js 20.19 以上（或 22.12 以上）。Bun 和 uv 缺少的話，安裝程式會自動補上。
2. 執行 `npx claude-mem install`，在選單中勾選要用的 agent，例如 Claude Code 和 Codex。
3. 也可以用參數指定單一 agent，例如 `npx claude-mem install --ide codex`。
4. 選 Codex 時，安裝程式應顯示已在 Codex 的 hooks.json 註冊 7 個 claude-mem hooks，看到這行才代表裝成功。
5. 裝完重新啟動各個 agent。
6. 第一天下班前，打開本機的 Web Viewer 檢查是否真的有記錄到東西，尤其是 Codex 那邊。

注意事項：

- **不要用 `npm install -g claude-mem`**：這樣只會裝到 SDK 和函式庫，不會註冊 hooks，也不會啟動背景服務，等於沒裝。
- **之後新增 agent 要重跑安裝程式**：`npx claude-mem update` 和自動更新不會幫你把 hooks 搬到新選的 agent，要重新執行 `npx claude-mem install` 再勾選。
- **沒有 hooks 的 agent 整合較弱**：會改成監看 log 檔，記錄品質可能較差。
- 只用 Claude Code 的話，也可以在 Claude Code 裡執行 `/plugin marketplace add thedotmack/claude-mem` 再 `/plugin install claude-mem`，但這樣只裝到 Claude Code。

## 四、成員端：個人化 prompt 與每日排程

每位成員在自己的專案裡放一份報告設定檔（本 repo 為 `prompts/daily-report.md`），寫下自己偏好的日報格式。範例內容：

- 今天完成的事項（依專案分類）
- 遇到的問題與卡關點
- 明天預計要做的事
- 需要主管或同事協助的地方
- 語氣：精簡、條列、繁體中文

排程觸發的方式有幾種，擇一即可：

1. **Claude Desktop 排程任務**：在桌面版設定每天 19:00 執行「依照 daily-report.md 產出今日日報並上傳」。
2. **系統排程**：macOS 用 launchd、Windows 用工作排程器，在 19:00 以非互動模式執行 Claude Code（`claude -p`），帶入日報指令。本 repo 的 `scripts/` 即為此做法。
3. **SessionEnd hook**：在最後一個 session 結束時觸發，適合沒有固定下班時間的人。

產出流程：Claude Code 透過 claude-mem 的搜尋工具撈出今天的紀錄 → 依個人 prompt 寫成日報 → 存成 `reports/daily/YYYY-MM-DD.md` → 透過 Notion 或 Jira 的 MCP 連接器上傳，或寄信給自己。

## 五、週報與月報

- **週報**：每週五 19:30 觸發，讀取本週日報，彙整成週報，存成 `reports/weekly/YYYY-Www.md` 並上傳。
- **月報**：每月最後一個工作日觸發，讀取當月週報彙整。

用日報堆疊成週報、再堆疊成月報，好處是每一層都有實際紀錄當依據，不會憑空產生內容。

## 五之一、會議錄音轉會議紀錄

團隊有錄音時，可以自動轉成分人記錄的會議紀錄，並納入當日日報與當週週報。Claude 模型本身不能直接聽音檔，所以由 Claude Code 執行本機的語音轉文字工具來處理。

1. **放入音檔**：錄音依固定格式命名，例如 `2026-11-16_週會.m4a`，放進專案的 `recordings/` 資料夾。
2. **語音轉文字**：執行本機的 WhisperX（本 repo 的 `scripts/transcribe/transcribe.py`），產出逐字稿，並做語者分離，標出「說話者一、說話者二」。
3. **對應真名**：語者分離只分得出不同的人，不知道誰是誰。可以在 `config/speakers.json` 設定代號與真名的對照，或在會議開頭各自報名字，讓 Claude 依此對照。
4. **整理會議紀錄**：Claude Code 讀逐字稿，依發言人分段整理重點、決議與待辦事項，存成 `meetings/YYYY-MM-DD_會議名稱.md`。
5. **納入報告**：當日日報排程會自動讀取當天的會議紀錄並摘要進去；週報排程會彙整當週所有會議。

觸發方式：日報排程開始前先檢查 `recordings/` 有沒有新音檔，有的話先轉檔再寫日報。

注意事項：

- **在本機轉檔**：客戶會議的錄音建議用本機工具轉文字，不要上傳到外部雲端服務。
- **取得同意**：錄音前要先取得與會者同意，並確認符合公司規定。
- **人工確認**：語者對應可能出錯，會議紀錄初期建議先讓與會者確認再納入主管報告。

## 六、報告庫：共同維護的資料庫

建議用 Notion 資料庫，欄位設計如下：

- 成員姓名
- 報告類型（日報／週報／月報）
- 日期或週次
- 所屬專案
- 內容本文
- 需要協助（勾選）

權限設定：成員只能新增和編輯自己的報告；主管有整個資料庫的讀取權限。如果團隊允許成員互看報告，可以用每組一個私有 Git repo，並由 GitHub repo 存取權限隔離團隊。同一個 repo 裡的資料夾與分支不能用來隔離讀取權限。若要做到只有本人與主管能讀，須另選具備細粒度讀取權限的儲存方案。

## 七、主管端：團隊彙整

主管的 Claude Code 連接報告庫，設定兩個排程：

1. **每日團隊彙整（例如 20:00）**：在所有成員日報上傳之後執行，讀取當天全部日報，產出團隊日報，內容包含整體進度、各專案狀態、風險與卡關、需要主管介入的事項。
2. **每週團隊彙整（例如週五 21:00）**：讀取所有成員週報，產出團隊週報，加上跨人的趨勢分析，例如哪個專案連續延遲、哪位成員負擔過重。

主管的彙整格式在 `prompts/team-daily.md` 與 `prompts/team-weekly.md`。

## 八、導入時要注意的事

- **資安**：claude-mem 會記錄工作內容，碰到客戶程式碼或機密資料時，要先確認公司資安規定，並善用 `<private>` 標籤與自動遮蔽。
- **時間順序**：主管端的排程要排在成員日報之後，並處理有人沒交的情況，例如在團隊報告裡標註「未提交」。
- **電腦要開著**：本機排程需要電腦在觸發時間是開機狀態，否則要改用雲端或伺服器執行。
- **先小規模試行**：先找兩、三位成員跑一週，確認記錄品質與報告格式，再推廣到全團隊。
- **人工確認**：初期建議日報產出後先讓成員看過再上傳，避免錯誤內容直接進到主管報告。

## 九、實作決策補充

### 整理筆記的服務：統一用 Codex

- 每位成員的 claude-mem 統一用 Codex 整理筆記，因為整理者是整台電腦共用一個，不分 agent，同一個整理者能讓所有筆記格式一致。
- 設定方式：`codex login` 後執行 `npx claude-mem install --provider codex`。
- 備援：把 `CLAUDE_MEM_QUOTA_FALLBACK_PROVIDER` 設成 `claude`，Codex 額度用完時自動改用 Claude，不會漏記。

### 資料位置與共享

- 每個人的記憶存在自己電腦的 `~/.claude-mem/`，彼此看不到，所以團隊共享必須另外做。
- 建議用 git 遠端名稱當專案名（`CLAUDE_MEM_PROJECT_NAME_SOURCE=git-remote`），讓不同成員的同一個專案名稱一致，方便主管彙整。

### 兩條線：原始紀錄與摘要報告

1. **原始紀錄庫（選用）**：原始紀錄預設留在本機。經組織確認可分享的資料、目的地與讀取權限後，才考慮獨立配置 Notion 原始紀錄匯出。團隊 Git 工作坊不需要匯出原始紀錄。
2. **摘要報告（經過 agent）**：排程執行 Claude Code，依日報 prompt 搜尋當天紀錄、寫成摘要，再透過 Notion 或 Jira 的連接器送出。Jira 沒有內建匯出，一定走這條。

### 摘要必須附來源

日報、週報的 prompt 要規定每一項工作都附上：

- claude-mem 紀錄 ID
- 相關檔案路徑
- 原始紀錄頁的連結（若另有經授權的原始紀錄庫）

主管看摘要有疑問時，點連結就能追溯到原始紀錄。週報引用日報，日報引用原始紀錄，形成一條可追溯的鏈。
