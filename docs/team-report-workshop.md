# 團隊報告工作坊：既有日報接上 PPT 與私有 Git 報告庫

這個模組把現有 claude-mem／會議紀錄／日報當作輸入，不改動原本 Notion、Jira 或作業系統排程。所有範例是合成資料；加入程式碼不會啟用排程或外部傳送。

## 最小可跑版本

需要 Node.js 20+；發布還需要 git 和已登入的 GitHub CLI。

```bash
npm ci --prefix workshop --ignore-scripts
# 複製範例，別直接修改版本控制中的教學資料
cp -R workshop/examples workshop/local-data
node workshop/cli.mjs approve --data workshop/local-data --config workshop/local-data/team.json --file reports/daily/2026-11-16/amy.md --confirm-author amy
node workshop/cli.mjs daily --data workshop/local-data --config workshop/local-data/team.json --date 2026-11-16 --member amy --out workshop/output
node workshop/cli.mjs weekly --data workshop/local-data --config workshop/local-data/team.json --start 2026-11-16 --end 2026-11-20 --member amy --out workshop/output
node workshop/cli.mjs monthly --data workshop/local-data --config workshop/local-data/team.json --month 2026-11 --as-of 2026-11-20 --out workshop/output
npm test --prefix workshop
```

Windows 可用 `Copy-Item workshop/examples workshop/local-data -Recurse`，其餘 Node 指令相同。`approve` 表示操作者已核對這一份資料；首次練習請先打開範例讀完，真實流程則必須由本人確認後才執行。

每次產檔回傳 JSON。`<stem>.current.json` 指向本次完整產物的版本資料夾，內含 PPTX、`.summary.md` 與 `.manifest.json`。例如月報 stem 是 `2026-11-team`。同期間重跑更新 CURRENT，不重複加頁、不刪除舊版本。來源 fingerprint 相同代表來源未變，不表示 ZIP 位元組完全相同。PPTX 由 PptxGenJS 生成，中文顯示依開啟端可用字型而定。

## 與現有程式接在哪裡

既有 `scripts/mac/run-report.sh daily`、Windows 日報腳本與 `prompts/daily-report.md` 仍負責取得紀錄和草稿。新增 `/gen-daily-ppt` Skill **只讀使用者指定專案/日期的草稿或來源**，保留 observation ID、會議檔案、issue/commit 等，轉成範例的 schema。沒有 commit 的工作由本人補充。這是人工確認的橋接，沒有假裝建立或測試新的 claude-mem API connector。

四個 `.claude/skills/` Skill 都限使用者主動呼叫：

| Skill | 工作 | 外部寫入 |
|---|---|---|
| `/gen-daily-ppt` | 選定證據、轉 schema、本人確認、日報 PPT | 無 |
| `/gen-weekly-ppt` | 日期範圍的日報彙整、週報草稿與 PPT | 無 |
| `/push-daily` | 本人確認分享目的地後，提交單份日報 | 私有 repo |
| `/push-weekly` | 再檢查週報來源未變後，提交單份週報 | 私有 repo |

## 資料規格與核對

`team.json` 定義唯一團隊、IANA 時區、成員 ID、假日及請假日。範例假日僅供教學，不代表官方日曆。資料存於 `reports/daily/YYYY-MM-DD/<member>.md`，YAML frontmatter 欄位見 `workshop/examples/`。

- `items` 每項必須有 `text` 和 `source`。CLI 檢查非空與長度，**不證明來源真的支持內容**，仍須本人核對。
- `blockers`、`next` 是本人提供的阻礙與下一步，不自行推論完成率、ROI 或員工績效。
- `status` 是 draft 或 approved。`approve` 記錄全文及 metadata 的 SHA256；任何後續修改都會使舊核對失效。
- `approved_by` 和 hash 是流程/完整性標記，**不是身份認證、防惡意竄改或數位簽章**。任何可改 repo 的人也可改這些欄位。正式團隊須採 GitHub 權限、分支保護及人工 PR review，不能信任作者字串就授權。
- 週報預設 draft，保存引用日報的 hash。送出週報時若日報已變更，就拒絕發布並要求重新核對。
- monthly 只讀指定團隊的已核對日報，輸出每日內容、按週/人分組與主管摘要。不是 LLM 深度分析，也不宣稱已讀過批准週報；週彙整直接引用日報快照。
- `--as-of` 是必填的工作日期截止，不用上傳時間替代日期。未到的日期不標成缺交；範圍內分辨 missing、unapproved、leave、holiday、weekend。

## 私有資料 repo 與發布

這個程式碼 repo 可以公開；**真實報告必須放另一個僅限同團隊讀取的私有 repo**。跨團隊分 repo，branch/資料夾不構成讀取隔離。複製必要 `workshop/` 程式和設定至私有資料 repo，先確認公司政策與存取名單，不提交金鑰、原始錄音或其他專案資料。

```bash
node workshop/cli.mjs push-daily --data /path/to/private-data --config /path/to/team.json --file reports/daily/2026-11-16/amy.md --confirm-repo YOUR_ORG/YOUR_PRIVATE_REPO --confirm-member amy
# 週報先本人核對 approve，再使用 push-weekly，file 為 reports/weekly/<start>_<end>/<member>.md
```

發布前會用 `gh api` 核實 repo 私有、未封存且有 push 權限，核對 fetch/push remote 完全一致、分支和遠端同步、沒有其他 staged 檔案。僅 add/commit 這一份報告，保留本機 Git hooks，不自動 pull、合併或強推。只允許已建立並與遠端同步的非預設成員分支；以 PR review 合入預設分支。推送後比對遠端 SHA。

遇到 push 失敗，local commit 可能已成功；先查看 `git status`、`git log` 與遠端分支，處理網路/分支規則再由本人確認恢復，不盲目重跑。未驗證的 repo、公開 repo、額外 push URL、symlink 或不相符的日期/作者路徑一律拒絕。

若複製整個專案到新私有 repo，原 `.gitignore` 的 `reports/**/*.md` 會阻止提交。**只在那個私有資料 repo** 調整這條規則；本公開教學 repo 必須保留忽略規則。不要使用 `git add -f` 繞過。

## 自動版與月底封存

`workshop/templates/team-report.yml` 是可選模板，不是此公開 repo 的已啟用 workflow。只在另建的私有資料 repo 複製成 `.github/workflows/team-report.yml`，準備 `team-workshop.json`，並設定 repository variable `TEAM_REPORTS_ENABLED=true` 後才啟用。模板提供的具體時間、輸出與權限以 YAML 為準；GitHub 排程可能延遲，不是即時 SLA。分支保護可能阻止 bot push，請保留 artifact 或由人 review，不為了便利放寬安全設定。

本機 CLI 的鎖只保護同一 output 目錄；多機器需 workflow concurrency 或單一 writer。每次在 staging 完成整份簡報、摘要與 manifest 後才換 CURRENT，失敗時舊版本仍可用。殘留 lock 表示前次中斷，先確認沒有執行中的 writer 才人工移除。

月底須先以月底日期重建完整月報（仍明列缺交），隔月再執行：

```bash
node workshop/cli.mjs archive --data workshop/local-data --config workshop/local-data/team.json --month 2026-11 --as-of 2026-12-01 --out workshop/output
```

封存為不可覆寫的 archive pointer，之後相同月報拒絕更新。修正需另開輸出目錄，保留原封存。下個月第一次 monthly 自動建立新月份產物。

提醒本人補問不在這個無人值守 CLI 裡：開著且閒置的 Claude Code 可以另設互動提醒；關機後由獨立 runner 做彙整。Hook 只回應事件，不是時鐘。程式不自動送 Slack/Email，不會假裝有人已回答。

## 驗證與限制

`npm test --prefix workshop` 測試草稿排除、核對失效、跨隊/來源/路徑拒絕、日曆與截止、公開 repo 拒絕、保留舊版、單一 writer、封存和週報來源。測試不使用真實 claude-mem 或 GitHub 寫入，mock remote 測試不能取代實際私有 repo 整合測試。Node 程式語法與 PPTX 結構可檢查，但仍須在授課用 PowerPoint 和字型環境驗證。沒有啟用 OS/雲端排程、授權新帳號或變更現有 Notion/Jira 流程。
