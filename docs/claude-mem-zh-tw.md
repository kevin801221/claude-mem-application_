# claude-mem 官方文件繁中重點整理

> 資料日期：2026-11-15。這份文件用繁體中文整理 claude-mem 官方文件最重要的幾頁，用自己的話改寫重點，細節請以[官方原文](https://docs.claude-mem.ai/introduction)為準。
> claude-mem 是社群開源專案，不是 Anthropic 官方工具。

## 一、安裝

建議用 `npx claude-mem install` 安裝：它會準備好執行環境，再打開瀏覽器設定頁讓你勾選要接的 agent。

### 系統需求

| 項目 | 需求 |
| --- | --- |
| Node.js | 20.19 以上（20.x），或 22.12 以上 |
| Bun | 1.2.16 以上，缺少時安裝程式會自動裝 |
| uv | 缺少時自動裝，用來跑向量索引的 Python 環境 |
| Claude Code | 2.1.139 以上，舊版的 hooks 會失效，用 `claude update` 更新 |
| 其他支援的 agent | Cursor、Codex CLI、Windsurf、OpenCode、Antigravity CLI、OpenClaw、Grok Bot 等 |

### 三種安裝方式

1. **npx（建議）**：執行 `npx claude-mem install`。終端機先檢查 Bun 和 uv、安裝相依套件，並把 `claude-mem` 啟動器放到 PATH；接著在瀏覽器裡選 agent、整合功能和要啟用的 skills。設定過程中終端機要保持開著。
2. **指定單一 agent**：`npx claude-mem install --ide <agent名稱>`，例如 `--ide codex`。`--ide` 一次只能填一個，要接第二個就再跑一次。
3. **Claude Code plugin marketplace**：在 Claude Code 裡執行 `/plugin marketplace add thedotmack/claude-mem` 再 `/plugin install claude-mem`。這種方式第一次開 session 時要先編譯啟動器，所以第一個 session 可能沒有記憶，第二個才有；先跑一次 npx 安裝就能避開。

### 記憶處理要用誰的額度

claude-mem 會用另一個 AI 把你的操作壓縮成筆記，這部分有幾種選擇：

- **用你的 Anthropic 方案**（`--provider claude`）：跟你的 Claude 額度共用，不用另外登入 claude-mem。
- **CMEM Pro**：官方的付費雲端服務，有 30 天免費試用，不吃你的 Claude 額度。
- **OpenRouter 或 Gemini 金鑰**：用你自己的 API 額度。
- **Host observer**（`--provider host`）：用已登入的 agent 在本機處理，不需要 API 金鑰。

### 安裝後確認

- 執行 `npx claude-mem doctor`，看「Hook launcher」那一列是否正常。
- 資料預設存在 `~/.claude-mem/`：資料庫是 `claude-mem.db`，設定檔是 `settings.json`，log 在 `logs/` 資料夾。可以用環境變數 `CLAUDE_MEM_DATA_DIR` 改位置。

### 更新與移除

- claude-mem 每天會自動檢查並更新；手動更新用 `npx claude-mem update`，會保留原本的設定。
- 想改設定（例如多接一個 agent）就重跑 `npx claude-mem install`。
- 移除用 `npx claude-mem uninstall`。

### 最常見的坑

**不要用 `npm install -g claude-mem`。** 這只會裝到 SDK 函式庫，不會註冊 hooks、也不會啟動背景服務；而且如果它在 PATH 上排在啟動器前面，還會擋住正確的啟動器。

## 二、運作方式

裝好之後完全自動：開工時帶入過去的紀錄，工作中記下每個動作，回覆結束時寫摘要，下次開工再帶進來。

### 一次 session 的流程

1. **開始 session**：自動帶入這個專案最近的紀錄（預設 50 筆觀察）和 session 摘要，排成時間軸。
2. **你輸入 prompt**：建立 session，並存下你的原始 prompt 供日後搜尋。
3. **Claude 使用工具**：每次 Read、Write、Edit、Bash、Grep 等操作都會被記下來，送去背景服務壓縮。
4. **背景處理**：用 AI 把操作整理成結構化筆記。
5. **Claude 回覆結束**：自動產生 session 摘要。
6. **session 結束**：把 session 標記為完成，等下次使用。

### 每筆「觀察」包含什麼

標題、副標、敘述、重點事實、主題標籤、涉及的檔案，以及類型。類型有六種：bugfix、feature、decision、discovery、refactor、change。

### session 摘要包含什麼

| 欄位 | 內容 |
| --- | --- |
| Request | 你要求做什麼 |
| Investigated | Claude 查了哪些東西 |
| Learned | 學到的重點 |
| Completed | 完成了什麼 |
| Next Steps | 下一步 |
| Notes | 其他值得留下的 |

這些欄位很適合直接拿來組成日報：Completed 對應「今日完成」，Next Steps 對應「明日計畫」。

### 分層讀取，節省 token

- **第一層**：開工時只顯示標題索引，大約 50 到 200 token。
- **第二層**：你問「上次修了哪些 bug」時，Claude 自動用搜尋工具調出細節，每筆約 100 到 500 token。
- **第三層**：真的需要時才去讀原始檔案。

### 小提醒

- 最新摘要的完整內容，只有在它比最新一筆觀察還新的時候才會顯示，避免看到過時的摘要。
- 用 `/clear` 不會結束 session，會重新帶入記憶並繼續記錄。
- 可以直接用 `sqlite3 ~/.claude-mem/claude-mem.db` 查資料庫。

## 三、架構

claude-mem 由五個元件組成，資料全部存在本機的 `~/.claude-mem/`。

| 元件 | 角色 |
| --- | --- |
| Hooks | 掛在 agent 生命週期上，收集 prompt、工具操作和摘要 |
| Worker 背景服務 | 本機 HTTP 服務，負責把操作交給 AI 壓縮成筆記；預設 port 是 37700 加上使用者編號除以 100 的餘數 |
| SQLite 資料庫 | `claude-mem.db`，存 session、觀察和摘要，支援全文搜尋 |
| Chroma 向量索引 | 選用，提供「依意思」的語意搜尋 |
| Web Viewer | 瀏覽器介面，即時看記憶串流、篩選專案、調整設定 |

### Hooks 對應

- **SessionStart**：啟動 worker，並注入過去的紀錄。
- **UserPromptSubmit**：建立 session、存下 prompt。
- **PreToolUse（Read）**：讀檔前先附上這個檔案過去的紀錄；大檔案可能被擋下，改用摘要閱讀以省 token。
- **PostToolUse**：記錄每一次工具操作。
- **Stop**：產生摘要。
- **SessionEnd**：把 session 標記完成。

每個 hook 都透過 PATH 上的 `claude-mem` 小啟動器執行，不需要 shell，所以 Windows 也不用裝 Git Bash。啟動器出錯時會直接放行，不會卡住你的 session。

### 記憶的資料流

1. Agent 透過 hooks 把操作資料送進來。
2. 寫入 SQLite。
3. Worker 交給 AI 整理成結構化筆記。
4. 筆記寫回資料庫。
5. 下一個 session 開始時讀出來。

## 四、搜尋工具

直接用自然語言問就好，例如「上次修了哪些 bug」，Claude 會自動用三步驟搜尋，比一次撈全部省大約 10 倍 token。

### 三步驟流程

| 步驟 | 工具 | 回傳 | 每筆約多少 token |
| --- | --- | --- | --- |
| 1. 搜尋索引 | `search` | ID、標題、日期、類型的精簡表 | 50 到 100 |
| 2. 看前後脈絡 | `timeline` | 某筆紀錄前後發生了什麼 | 100 到 200 |
| 3. 取完整內容 | `get_observations` | 敘述、事實、檔案、標籤 | 500 到 1,000 |

### search 常用參數

- `query`：用白話描述要找的東西；有向量索引時會先依意思比對，再用關鍵字補。
- `obs_type`：類型篩選，例如 bugfix、feature、decision，可用逗號給多個。
- `project`：限定專案。
- `dateStart`、`dateEnd`：日期範圍，格式 YYYY-MM-DD。
- `limit`、`offset`：筆數與分頁。
- `orderBy`：依日期新舊或相關度排序。

### 寫日報最實用的查法

```
search(query="今天的工作", dateStart="2026-11-16", dateEnd="2026-11-16", orderBy="date_asc")
```

先拿到當天的索引，再挑重要的 ID 用 `get_observations` 一次批次取回。

### 關鍵字比對的規則

- 每個字都要出現，順序不拘。
- 沒有 AND、OR、NOT 這類運算子，也沒有引號片語搜尋；要縮小範圍請用參數篩選。
- 中文、日文這類不用空格分詞的文字，會用「字串包含」的方式比對。
- 搜尋你自己的 prompt 時，整句要完全出現才會命中，所以盡量用短詞。

### 另外幾點

- **Dumb search**：`dumb_search` 只比對標題，快但容易漏，一般用預設的三步驟就好。
- **時間窗**：沒給日期的語意搜尋只看最近 90 天，可用 `CLAUDE_MEM_SEARCH_RECENCY_DAYS` 調整，設 0 代表不限。
- 在 Claude Desktop 裡也能透過 MCP 使用這些搜尋工具。

## 五、資料夾脈絡與知識代理

### 資料夾脈絡檔（Folder Context）

開啟後，claude-mem 會在你碰過的子資料夾裡自動寫一份 `CLAUDE.md`，列出這個資料夾最近的活動時間軸。預設關閉。

- **開啟方式**：在 `~/.claude-mem/settings.json` 加上 `"CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED": "true"`，存檔即生效，不用重啟。
- **內容**：每筆紀錄的 ID、時間、類型、標題、預估 token 數，包在 `<claude-mem-context>` 標籤裡。
- **不會蓋掉你寫的東西**：標籤外面你自己寫的內容會保留。
- **專案根目錄不會產生**：避免蓋掉你手寫的專案層級 CLAUDE.md。
- **要不要進 git**：團隊常有新人加入時可以 commit；想保持 repo 乾淨就加進 `.gitignore`。PR 前可用 `bun scripts/regenerate-claude-md.ts --clean` 清掉自動產生的段落。

### 知識代理（Knowledge Agents）

把某一段歷史紀錄打包成可以對話的「大腦」，問它問題時，它會根據你真實的專案紀錄回答，而不是丟回原始搜尋結果。

1. **建立語料**：`build_corpus`，用專案、類型、主題、檔案、日期、關鍵字篩選要放進去的紀錄。
2. **載入**：`prime_corpus`，把語料整包載入一個 Claude session，這個 session 就是知識代理。
3. **提問**：`query_corpus`，可以連續追問。
4. **重開對話**：`reprime_corpus`，清掉先前問答、保留知識。
5. **更新資料**：有新紀錄後先 `rebuild_corpus` 再 `reprime_corpus`。

| | mem-search | knowledge-agent |
| --- | --- | --- |
| 回傳 | 原始紀錄 | 整合過的回答 |
| 適合 | 找特定紀錄、ID、時間軸 | 理解模式、決策、架構 |
| 資料新鮮度 | 即時 | 建立當下的快照，要重建才更新 |
| 需要準備 | 不用 | 要先建立並載入 |

用在團隊上：主管可以把「本月所有 decision 類型的紀錄」建成知識代理，月底直接問它「這個月做了哪些關鍵決策」。

## 六、隱私控制

兩種機制可以一起用：`<private>` 標籤是你手動標記整段不存，自動遮蔽是用規則把漏出來的密鑰換成占位符。

### `<private>` 標籤

- 把內容包在 `<private>...</private>` 裡，這個 session 中 Claude 照樣看得到、用得到，但不會寫進資料庫和搜尋索引。
- 可以跨多行、一則訊息裡用好幾段，預設就有效，不用設定。
- 適合：內部主機位址、暫時的背景說明、大量 debug log、還沒定案的腦力激盪。
- 不要包太多，否則以後的記憶品質會變差。真正的密鑰還是應該用正式的密鑰管理工具。
- 驗證：用 `sqlite3` 查 `user_prompts` 和 `observations` 表，確認私密內容沒有被存進去。

### 自動遮蔽（Auto-Redaction）

- 預設關閉。在 settings.json 加上 `"CLAUDE_MEM_REDACT_ENABLED": "true"` 開啟。
- 內建 12 種高信心度規則：AWS、GitHub、OpenAI、Anthropic、Slack、Stripe、Google API 金鑰、JWT、私鑰 PEM 等。
- 加上 `"CLAUDE_MEM_REDACT_GENERIC_ENABLED": "true"` 會再抓沒有廠商前綴的密碼和 token，例如 `DB_PASSWORD=...`、`Authorization: Bearer ...`。
- 可用 `CLAUDE_MEM_REDACT_CUSTOM_PATTERNS` 加入公司自己的 token 格式；可用 `CLAUDE_MEM_REDACT_DISABLED_BUILTINS` 關掉個別規則。
- 符合的內容會被換成 `<redacted type='…'/>`，而且無法還原。
- 內建規則沒有涵蓋 Azure、GCP 服務帳號 JSON 和私有機房的 token，這些要自己加自訂規則。

### 對團隊的建議

碰到客戶資料的成員，建議一律開啟自動遮蔽加通用規則，並把公司內部 token 格式寫成自訂規則；客戶名稱、內部主機這類敏感背景就用 `<private>` 包起來。

## 七、設定、模式與語言

所有設定都在 `~/.claude-mem/settings.json`，第一次執行會自動產生；也可以在 Web Viewer 右上角齒輪裡調整，還有即時預覽。大部分設定改完要重啟 worker。

### 最常用的設定

| 設定 | 預設值 | 用途 |
| --- | --- | --- |
| `CLAUDE_MEM_PROVIDER` | `claude` | 誰來整理筆記：claude、codex、gemini、openrouter、openai-compatible |
| `CLAUDE_MEM_MODEL` | Haiku 4.5 | 用 Claude 整理時的模型，也可改 Sonnet 或 Opus |
| `CLAUDE_MEM_MODE` | `code` | 模式與語言，見下方 |
| `CLAUDE_MEM_CONTEXT_OBSERVATIONS` | 50 | 開工時帶入幾筆紀錄 |
| `CLAUDE_MEM_SESSION_START_INCLUDE_ALL_SOURCES` | false | 開工時一併帶入 Codex 等其他 agent 的紀錄 |
| `CLAUDE_MEM_CONTEXT_PROJECTS` | `current` | 只讀當前專案，或改 `all` 讀全部專案 |
| `CLAUDE_MEM_SEARCH_RECENCY_DAYS` | 90 | 語意搜尋只看最近幾天，0 代表不限 |
| `CLAUDE_MEM_SKIP_TOOLS` | 幾個內建工具 | 不想記錄的工具 |
| `CLAUDE_MEM_SKIP_BASH_PATTERNS` | 空白 | 用正規表示式略過 `ls`、`git status` 這類雜訊指令 |
| `CLAUDE_MEM_SKIP_SUBAGENT_OBSERVATIONS` | false | 略過所有子代理的紀錄，大量平行任務時很有用 |
| `CLAUDE_MEM_DATA_DIR` | `~/.claude-mem` | 資料存放位置 |

### 用 Codex 訂閱來整理筆記

先 `codex login`，再用 `npx claude-mem install --provider codex` 安裝，用的是 ChatGPT 訂閱登入，不需要 OpenAI API 金鑰。另外，`CLAUDE_MEM_CODEX_SUBAGENT_INGESTION` 開啟後才會記錄 Codex 自己產生的子代理工作，預設關閉以免太耗額度。

### 額度保護

用訂閱方案時，5 小時視窗用到 95%、每週視窗用到 93% 左右，整理筆記就會自動暫停，避免把你寫程式要用的額度吃光。主要服務不能用時，會依 `CLAUDE_MEM_QUOTA_FALLBACK_PROVIDER` 改用備援服務。

### 模式與語言

- **code**：預設模式，記錄 bugfix、feature、refactor、decision 等。
- **code--chill**：記得比較少，只留「下次很難再查出來」的重要事情。
- **多語言**：`code--zh` 會讓所有筆記和摘要都用中文寫；官方清單只有 `code--zh`，沒有區分繁簡。
- **email-investigation**：分析大量郵件用，記錄人物、關係、時間軸事件、證據。
- **自訂模式**：執行 `/mode-creator`，用問答方式設計自己的紀錄類型和標籤，存在 `~/.claude-mem/modes/`。想要固定用繁體中文，可以用這個方式做一個繼承 `code` 的自訂模式。

### Telegram 通知

可以在 session 結束時把摘要推送到 Telegram 群組，依專案設定不同的推送對象。即時的單筆通知預設關閉。

### 自動備份

- 執行 `/claude-mem:backup-setup`，或設定 `CLAUDE_MEM_BACKUP_ENABLED` 為 true。
- 預設每 24 小時備份一次，保留最新 7 份，放在 `~/.claude-mem/backups/auto/`。
- 查狀態用 `npx claude-mem backup status`，還原用 `npx claude-mem restore <檔名>`。

## 八、團隊協作與匯出

跟團隊日報最相關的四個功能：TeamBrain 共享工作、Notion 即時匯出、Screenpipe 會議內容、記憶匯出匯入。

### TeamBrain（團隊共享）

- 在本機 Web Viewer 的「My Work」旁邊多一個「TeamBrain」頁籤，可以看到隊友選擇分享的工作，並標示是誰、哪個專案。
- 加入方式：團隊擁有者從雲端工作區發邀請，成員執行 `npx claude-mem teambrain join '<邀請連結>'`，登入、核准裝置，再選要分享哪些專案。
- 每個人自己決定分享哪些專案；沒選任何專案就代表什麼都不分享。
- 查看或修改分享設定：`npx claude-mem teambrain status`、`npx claude-mem teambrain share`。
- 這個面板只能看，不能指派工作或替隊友勾選完成。TeamBrain 是付費的雲端方案，詳見官方開通頁。

### Notion 即時匯出

每存一筆新紀錄，就自動複製一份到 Notion 資料庫。

1. 到 Notion 建立 integration，取得 secret，需要讀取、更新、新增內容的權限。
2. 建一個資料庫，並在 Connections 把 integration 加進去；沒加的話會回 404，匯出會自動關閉。
3. 在 settings.json 設定 `CLAUDE_MEM_NOTION_ENABLED`、`CLAUDE_MEM_NOTION_TOKEN`、`CLAUDE_MEM_NOTION_DATABASE_ID`，重啟 worker。

- 欄位會自動建立：類型、專案、標籤、讀過與改過的檔案、建立時間、session ID 等。
- 每筆只寫一次，用匯出鍵避免重複；多台電腦匯到同一個資料庫也不會互相覆蓋。
- 只匯出新紀錄，不會補匯舊的歷史。
- 用在團隊：每個成員都匯到同一個 Notion 資料庫，主管就能依專案、類型、日期篩選所有人的原始工作紀錄。

### Screenpipe（螢幕與會議內容）

- Screenpipe 是另一套在本機錄螢幕文字和聲音的工具，claude-mem 內建對應的 skill。
- 用法：`/claude-mem:screenpipe 找今天早上會議中關於發布的討論，並記住決議`。
- 它會在指定時間範圍內搜尋螢幕文字或語音逐字稿，附上來源和時間戳整理摘要；只有你要求時才會存成記憶。
- 搜到的內容會送進 agent 的對話，也就會送到你設定的 AI 服務，所以時間範圍和主題要盡量縮小。
- 這可以當作會議錄音轉紀錄的另一條路：不用自己處理音檔，直接從 Screenpipe 抓會議內容寫進當天紀錄。

### 記憶匯出與匯入

- 匯出：`npx tsx scripts/export-memories.ts "關鍵字" 檔名.json`，可加 `--project=專案名` 限定專案。
- 匯入：`npx tsx scripts/import-memories.ts 檔名.json`，會自動略過重複的紀錄，失敗會整批回復。
- 用途：把某個主題的經驗分享給新成員，例如「客戶環境的安裝問題」。
- 匯出檔是明文，分享前要先檢查有沒有密鑰或敏感路徑。

## 九、疑難排解

遇到問題可以直接跟 Claude 描述症狀，內建的疑難排解 skill 會自動檢查 worker、資料庫、port 和相依套件。

| 症狀 | 處理方式 |
| --- | --- |
| hooks 顯示找不到 `claude-mem` | 重跑 `npx claude-mem install`，然後重開終端機或 IDE，再開 Claude Code |
| 完全沒有記錄、也沒錯誤訊息 | Claude Code 版本太舊，用 `claude update` 更新到 2.1.139 以上 |
| 執行到錯的 `claude-mem` | 用 `which -a claude-mem` 檢查，若有 npm 全域版就 `npm uninstall -g claude-mem` |
| 開工時沒有帶入記憶 | 用 `sqlite3` 查 `session_summaries` 是否有資料，再跑 `npm run test:context` |
| Web Viewer 打不開 | 從 settings.json 找出 port，確認 worker 有在跑，必要時改用固定 port |
| 紀錄卡在處理中 | 執行 `bun scripts/check-pending-queue.ts --process` 手動恢復 |
| 資料庫被鎖住 | 停掉 worker，結束占用資料庫的程序，再重啟 |
| Windows 出現找不到 bun | 更新到新版安裝，並精簡過長的 PATH |
| 工具呼叫太頻繁拖慢速度 | 在 `~/.claude/settings.json` 的 env 加 `CLAUDE_MEM_DISABLE_TOOL_HOOKS=1` |

萬用檢查指令：`npx claude-mem doctor`。

## 十、其他頁面一覽

官方文件約有 80 頁，以上整理了最核心的部分。其餘頁面依用途分類如下，需要時再查原文：

| 類別 | 頁面 |
| --- | --- |
| 其他 agent 安裝 | Cursor、Gemini CLI、Antigravity CLI、Grok Bot、OpenClaw、Hermes、Kimi Code、Devin、Qoder、T3 Code |
| 換整理筆記的 AI | OpenRouter、Gemini、OpenAI 相容服務（含 Ollama、LM Studio 本機模型）、多金鑰輪替、額度備援、LiteLLM 閘道 |
| 雲端功能 | Cloud Sync 多裝置同步、Hosted Server、CMEM Pro |
| 其他匯出 | Obsidian、Memory Ingest（匯入 Claude Code 內建記憶檔） |
| 開發框架整合 | LangGraph、LlamaIndex、CrewAI、AutoGen、OpenAI Agents SDK、Claude Agent SDK、Vercel AI SDK、n8n 等 |
| 原理與進階 | Context Engineering、Progressive Disclosure、File Read Gate、資料庫與 hooks 架構、Platform Integration Guide |
| 維運 | 自動更新、Telemetry 匿名統計（可關閉）、手動恢復、開發與貢獻 |

## 十一、常見問答

**Q：只開一個 Claude Code，claude-mem 怎麼有「第二個 AI」來整理筆記？一定要自己設定 Claude Agent SDK，或一定要有 Codex、Gemini 嗎？**

A：都不用。背景服務在安裝時自動裝好，內建 Claude Agent SDK，直接用你 Claude Code 的登入，在背景另開一個獨立的 Claude 對話來整理筆記，不會干擾你正在用的那個。預設用 Haiku，會吃同一個 Claude 方案的額度，但有額度保護，快用完時會自動暫停。Codex、Gemini、OpenRouter 只是選用，用來把整理工作改吃別的額度。

**Q：怎麼改成用 Codex 整理？**

A：先執行 `codex login`，用 ChatGPT 帳號登入（不接受 API 金鑰登入）；再執行 `npx claude-mem install --provider codex`，要指定模型可加 `--model`。也可以在 Web Viewer 設定裡改，或把 settings.json 的 `CLAUDE_MEM_PROVIDER` 設成 `codex` 後重啟 worker。預設推理強度為低。

**Q：能不能讓 Claude Code 的工作由 Codex 整理、Codex 的工作由 Claude 整理？還是各自整理各自的比較好？**

A：兩種都做不到。整理者是整台電腦共用一個設定，不分 agent。這反而比較好：觀察者做的是壓縮紀錄，不是評論主模型，所以幾乎沒有偏見問題；而筆記的連貫性來自同一個整理者帶來的一致格式與用詞，對之後組日報、週報最有利。

**Q：筆記、Chroma 向量索引和 SQLite 資料庫存在哪裡？依專案還是依個人存？**

A：依個人存、依專案分類。全部放在使用者家目錄的 `~/.claude-mem/`，跟著這個人、這台電腦走，不放進專案資料夾。所有專案共用同一個資料庫，每筆紀錄標上專案名稱：git repo 預設用根目錄資料夾名，也可改用 git 遠端名稱，或用命名環境把多個資料夾合成一個專案。開工時預設只帶入當前專案。

**Q：分享到 Notion、TeamBrain 或 Jira，一定要先經過 agent 摘要嗎？**

A：不一定。Notion 匯出和 TeamBrain 都是背景服務直接同步，不需要 agent，但送出的是原始紀錄。要給人看的摘要報告，或要送到 Jira（claude-mem 沒有內建 Jira 匯出），就必須經過 agent：排程執行 Claude Code，依 prompt 搜尋紀錄、寫摘要，再用連接器送出。

**Q：只用一把 Claude API key，能不能接到 Whisper 這類語音轉文字（STT）功能？**

A：不行。到 2026 年為止，沒有任何 Claude 模型接受音檔輸入。Claude Code 的語音輸入只在用 Claude.ai 帳號登入時可用，設定成直接用 API key 時不能用，而且那只是用講的下指令，不能處理錄音檔。會議錄音要先用另外的 STT 工具轉成逐字稿：本機的 WhisperX（免費、資料不離開電腦、可分辨說話者，客戶會議建議用這個），或 OpenAI Whisper API、Groq 等雲端服務（需各自的 API key）。轉好的文字再交給 Claude 整理成會議紀錄。

## 十二、教學：自動日報的兩種做法

結論先講：兩種都做得到，但推薦用 claude-mem，因為它把最難的部分（記錄、壓縮、搜尋、隱私）都做好了，新手只要專心寫日報的 prompt。

### 做法 A：直接讀 Claude Code 的原始紀錄

Claude Code 會把每次 session 的完整逐字紀錄存成 JSONL 檔，放在 `~/.claude/projects/<專案路徑>/` 底下，內容包含每句對話、每次工具呼叫和回傳結果。寫一支腳本，下班時篩出當天的紀錄，交給 Claude 摘要成日報即可。

### 做法 B：安裝 claude-mem

安裝後自動在背景記錄、壓縮成結構化筆記，下班時讓 Claude 用搜尋工具撈出當天紀錄寫日報。

### 比較

| 面向 | A：讀原始 JSONL | B：claude-mem |
| --- | --- | --- |
| 安裝 | 不用另外裝 | 一行 `npx claude-mem install` |
| 要寫的程式 | 要自己寫篩選、去雜訊、切段的腳本 | 幾乎不用，直接用內建搜尋工具 |
| token 成本 | 低，一天只整理一次 | 較高，每次工具呼叫都會送觀察者整理 |
| 資料完整度 | 最完整，什麼都在 | 經過壓縮，保留重點 |
| 來源追溯 | 可引用到 JSONL 的某一筆 | 可引用紀錄 ID 與檔案路徑 |
| 資料量 | 很大，含大量原始工具輸出，不能整包丟給模型 | 已壓縮成標題、重點、檔案清單，好處理 |
| 保存期限 | Claude Code 預設約 30 天會清掉舊紀錄，要另外調整或備份 | 永久存在本機資料庫，還有自動備份 |
| 格式穩定性 | 內部格式，Claude Code 改版可能變動，腳本會壞 | 由 claude-mem 維護，跟著官方更新 |
| 跨 agent | 每種 agent 格式和位置都不同，要各寫一支 | 一套同時支援 Claude Code、Codex 等十幾種 |
| 搜尋 | 要自己做 | 內建關鍵字加語意搜尋 |
| 隱私 | 密鑰、客戶資料都原封不動在檔案裡 | 有 private 標籤與自動遮蔽 |
| 額外好處 | 無 | 下次開工自動帶入記憶、Notion 匯出、團隊共享 |

### 為什麼推薦 claude-mem

1. **對新手門檻低**：做法 A 要懂 JSONL 結構、會寫腳本處理大檔案，還要追著 Claude Code 改版修腳本；claude-mem 裝好就能用。
2. **不只是日報**：它同時解決「每次開新 session 都要重新解釋背景」的問題，日報只是附帶的好處。
3. **團隊擴展容易**：成員用不同 agent 也能用同一套流程，還能匯出到 Notion、用 TeamBrain 共享。
4. **安全性較好**：自動遮蔽能擋住不小心印出來的密鑰，碰客戶資料時特別重要。
5. **成本可控**：多出來的觀察者成本，可以改用 Codex 或其他額度承擔，也能略過子代理與雜訊指令來降低用量。

適合做法 A 的情況：熟悉 Claude Code、只要日報、很在意 token 成本，而且願意自己維護腳本的人。

## 來源

- [Introduction](https://docs.claude-mem.ai/introduction)
- [Installation](https://docs.claude-mem.ai/installation.md)
- [Getting Started](https://docs.claude-mem.ai/usage/getting-started.md)
- [Architecture Overview](https://docs.claude-mem.ai/architecture/overview.md)
- [Smart Memory Search](https://docs.claude-mem.ai/usage/search-tools.md)
- [Folder Context Files](https://docs.claude-mem.ai/usage/folder-context.md)
- [Knowledge Agents](https://docs.claude-mem.ai/usage/knowledge-agents.md)
- [Private Tags](https://docs.claude-mem.ai/usage/private-tags.md)
- [Auto-Redaction](https://docs.claude-mem.ai/usage/auto-redaction.md)
- [Configuration](https://docs.claude-mem.ai/configuration.md)
- [Modes & Languages](https://docs.claude-mem.ai/modes.md)
- [Backups](https://docs.claude-mem.ai/usage/backups.md)
- [TeamBrain](https://docs.claude-mem.ai/usage/teambrain.md)
- [Notion Export](https://docs.claude-mem.ai/notion-export.md)
- [Screenpipe Integration](https://docs.claude-mem.ai/screenpipe-integration.md)
- [Memory Export/Import](https://docs.claude-mem.ai/usage/export-import.md)
- [Troubleshooting](https://docs.claude-mem.ai/troubleshooting.md)
- [完整頁面目錄（llms.txt）](https://docs.claude-mem.ai/llms.txt)
