---
name: gen-daily-ppt
description: 將使用者指定專案、日期的既有 claude-mem 日報轉成可追溯 Markdown，再經本人核對產出日報 PPT。
disable-model-invocation: true
---
# 產生日報 PPT

先讀 `docs/team-report-workshop.md` 與 `workshop/examples/reports/daily/2026-11-16/amy.md`。這是既有 claude-mem / `prompts/daily-report.md` 的後處理，不另外開一套自動蒐集器。

1. 確認使用者選定的**單一專案、工作日期、成員 ID、團隊設定、私有資料 repo 的本機路徑**。不能從登入帳號或檔名自行認定作者。
2. 優先讀使用者指定的既有 `reports/daily/YYYY-MM-DD.md` 或會議紀錄。若需查 claude-mem，只搜尋這次明確指定專案與日期的紀錄，保留 observation ID/檔案/連結。工具不支援檢索前專案過濾時，請使用者提供選定紀錄，不先讀全部專案再篩選。
3. 按範例 schema 轉成 `reports/daily/YYYY-MM-DD/<member>.md`，`status: draft`。每個 `items` 都要有 `text` 和真實 `source`，保留未驗收/待確認。無 commit 的會議與討論也可附使用者提供的來源；缺資料先問本人，不補造績效。
4. 把完整草稿及來源給本人看，取得「這份內容正確」的當次明確確認後，才執行：
   `node workshop/cli.mjs approve --data <data> --config <team.json> --file reports/daily/<date>/<member>.md --confirm-author <member>`
   `approved_by` 僅是課堂流程標記，並非身份認證或公司批准。
5. 執行 `node workshop/cli.mjs daily --data <data> --config <team.json> --date <date> --member <member> --out <local-output>`。
6. 讀輸出 CURRENT JSON，告訴本人 PPTX 的實際位置；檢查 PPT 能開啟、中文字與來源頁沒有被截斷。這個 Skill **不提交、不 push、不發信**。
