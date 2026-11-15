# claude-mem 自動日報

用 **Claude Code + [claude-mem](https://docs.claude-mem.ai/introduction)**，每天下班自動產出個人日報，週五彙整週報、月底彙整月報；有會議錄音的話，先用 WhisperX 轉成分人逐字稿，再整理成會議紀錄一併寫進日報。主管端可以再把全團隊的日報、週報彙整成一份。

Mac 與 Windows 都有排程腳本。

> claude-mem 是社群開源專案，不是 Anthropic 官方工具。本 repo 為教學範例，導入團隊前請先小規模試行。

## 流程

```
上班：Claude Code / Codex 工作 ── claude-mem 自動記錄
                                        │
19:00 排程 ─► recordings/ 有新錄音？──► WhisperX 逐字稿 ─► Claude 整理會議紀錄
                                        │
                                        ▼
                     Claude 用 claude-mem 搜尋今天紀錄 ─► reports/daily/YYYY-MM-DD.md
                                                          （每項附紀錄 ID 與檔案路徑）
週五 19:30 ─► 日報彙整成週報 ─► reports/weekly/YYYY-Www.md
月底 20:00 ─► 週報彙整成月報 ─► reports/monthly/YYYY-MM.md
主管端 ─► 全員日報、週報彙整 ─► reports/team/
```

## 目錄

| 路徑 | 內容 |
| --- | --- |
| `docs/claude-mem-zh-tw.md` | claude-mem 官方文件繁中重點整理（含常見問答、兩種做法比較） |
| `docs/team-report-architecture.md` | 團隊自動化日報／週報系統架構 |
| `prompts/` | 日報、週報、月報、會議紀錄、主管彙整的 prompt，改這裡就能調整報告格式 |
| `config/` | claude-mem 設定範例、排程設定範例、說話者對照範例 |
| `scripts/mac/` | Mac 執行腳本與 launchd 排程安裝 |
| `scripts/windows/` | Windows 執行腳本與工作排程器註冊 |
| `scripts/transcribe/` | WhisperX 錄音轉逐字稿 |
| `recordings/` | 放會議錄音，檔名格式 `YYYY-MM-DD_會議名稱.m4a` |
| `meetings/`、`reports/`、`logs/` | 產出的逐字稿、會議紀錄、報告與執行紀錄（不進 git） |

## 快速開始

### 1. 共同準備（Mac、Windows 都要）

1. 安裝 [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) 並登入，版本要 2.1.139 以上（`claude update`）。
2. 安裝 Node.js 20.19 以上或 22.12 以上。
3. 安裝 claude-mem，在選單勾選你用的 agent（例如 Claude Code 和 Codex）：
   ```
   npx claude-mem install
   ```
   不要用 `npm install -g claude-mem`，那樣不會註冊 hooks。
4. 合併設定：把 `config/claude-mem-settings.example.json` 的內容合併進 `~/.claude-mem/settings.json`（Windows 是 `%USERPROFILE%\.claude-mem\settings.json`），刪掉底線開頭的說明欄位，再重啟 worker。
   - 範例預設用 Codex 整理筆記，要先執行 `codex login`；不用 Codex 就把 `CLAUDE_MEM_PROVIDER` 改成 `claude`。
5. 複製排程設定並修改：
   ```
   cp config/report.env.example config/report.env
   ```
   Windows：`Copy-Item config\report.env.example config\report.env`
6. **查出 claude-mem 搜尋工具的名稱**（重要）：在 Claude Code 裡執行 `/mcp`，找到 claude-mem 的搜尋伺服器，把 `mcp__<伺服器名稱>` 加到 `report.env` 的 `ALLOWED_TOOLS`。沒加的話，排程執行時 Claude 沒有權限用搜尋工具，日報會是空的。

### 2a. Mac

```bash
chmod +x scripts/mac/*.sh
bash scripts/mac/run-report.sh daily          # 先手動跑一次測試
tail -n 40 logs/$(date +%Y-%m-%d)-daily.log   # 看執行紀錄
bash scripts/mac/install-schedule.sh          # 安裝排程（主管加 --team）
```

移除排程：`bash scripts/mac/install-schedule.sh --uninstall`

### 2b. Windows

用 PowerShell 在 repo 資料夾執行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\run-report.ps1 -Type daily   # 先手動跑一次
Get-Content .\logs\$(Get-Date -Format yyyy-MM-dd)-daily.log -Tail 40                    # 看執行紀錄
powershell -ExecutionPolicy Bypass -File .\scripts\windows\register-schedule.ps1        # 註冊排程（主管加 -Team）
```

排程會出現在「工作排程器」的 `ClaudeMemDailyReport` 資料夾。移除：加上 `-Uninstall`。

### 排程時間

| 工作 | 時間 | 說明 |
| --- | --- | --- |
| daily | 週一到週五 19:00 | 先處理新錄音，再寫日報 |
| weekly | 週五 19:30 | 彙整本週日報 |
| monthly | 每天 20:00 | 只在月底最後一天真正執行 |
| team-daily | 週一到週五 20:00 | 主管端，`--team` / `-Team` 才會安裝 |
| team-weekly | 週五 21:00 | 主管端 |

電腦在排程時間要開著；錯過的工作會在開機後補跑。要改時間，直接改 `install-schedule.sh` 或 `register-schedule.ps1` 裡的時間。

## 選用：會議錄音轉會議紀錄

Claude 模型不能直接讀音檔，所以先用本機的 WhisperX 轉成逐字稿。

1. 安裝 ffmpeg：Mac `brew install ffmpeg`，Windows `winget install Gyan.FFmpeg`。
2. 建立虛擬環境並安裝 WhisperX（腳本會自動使用 `.venv-whisper`）：
   - Mac：
     ```bash
     python3 -m venv .venv-whisper
     .venv-whisper/bin/pip install -r scripts/transcribe/requirements.txt
     ```
   - Windows：
     ```powershell
     py -m venv .venv-whisper
     .venv-whisper\Scripts\pip install -r scripts\transcribe\requirements.txt
     ```
3. 要分辨說話者的話，到 Hugging Face 申請 token、同意 pyannote 模型的使用條款，填進 `report.env` 的 `HF_TOKEN`。
4. 想把「SPEAKER_00」換成真名：複製 `config/speakers.example.json` 成 `config/speakers.json` 並修改。
5. 錄音檔依 `YYYY-MM-DD_會議名稱.m4a` 命名放進 `recordings/`，下次日報排程就會自動處理。

客戶會議請在本機轉檔，錄音前先取得與會者同意。

## 選用：送到 Notion 或 Jira

- **原始紀錄**：開啟 claude-mem 的 Notion 匯出（設定範例裡的 `CLAUDE_MEM_NOTION_*`），每筆紀錄會自動寫進 Notion。
- **日報摘要**：在 Claude Code 接好 Notion 或 Jira 連接器，把 `report.env` 的 `REPORT_DESTINATION` 設成 `notion` 或 `jira`，並把連接器的工具名稱加進 `ALLOWED_TOOLS`。

## 常見問題

- **日報是空的**：多半是 `ALLOWED_TOOLS` 沒有加 claude-mem 的搜尋工具，見快速開始第 6 步。
- **找不到 claude**：Mac 的腳本會自動加上 `~/.local/bin` 和 Homebrew 路徑；Windows 裝完 Claude Code 後要開新的 PowerShell 視窗。
- **中文亂碼（Windows）**：腳本已設定 UTF-8；請確認 prompt 檔是 UTF-8 存檔。
- 更多 claude-mem 的問題見 `docs/claude-mem-zh-tw.md` 第九節。

## 上傳到自己的 GitHub

```bash
git init && git add . && git commit -m "Initial commit"
gh repo create claude-mem-daily-report --private --source=. --push
```
