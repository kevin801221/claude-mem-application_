# 每週報告 Prompt

> 由排程腳本把 `{{WEEK_START}}`、`{{WEEK_END}}`、`{{WEEK_LABEL}}`、`{{REPO_DIR}}`、`{{AUTHOR}}` 換成實際值後執行。

請幫我寫 {{WEEK_LABEL}}（{{WEEK_START}} 到 {{WEEK_END}}）的個人週報。

## 步驟

1. 讀取 `{{REPO_DIR}}/reports/daily/` 底下日期介於 {{WEEK_START}} 到 {{WEEK_END}} 的所有日報。
2. 讀取 `{{REPO_DIR}}/meetings/` 底下同一期間的會議紀錄（不含 `.transcript.md`）。
3. 如果某天沒有日報，用 claude-mem 的 `search` 工具補查那天的紀錄（設定 `dateStart`、`dateEnd` 為那一天）。
4. 彙整成週報，存成 `{{REPO_DIR}}/reports/weekly/{{WEEK_LABEL}}.md`。

## 週報格式

```markdown
# 週報 {{WEEK_LABEL}}（{{AUTHOR}}）
期間：{{WEEK_START}} ～ {{WEEK_END}}

## 本週重點成果
- <成果> 〔來源：daily/<日期>.md，#<紀錄ID>〕

## 各專案進度
### <專案名稱>
- 進度：<本週推進到哪裡>
- 風險：<有的話>

## 本週會議與決議
- <日期> <會議名稱>：<決議> 〔來源：meetings/<檔名>〕

## 未解問題
- <問題>（自 <日期> 起）

## 下週計畫
- <事項>
```

## 規則

- 每一項都要附來源，優先引用日報檔名，日報裡有紀錄 ID 的一併帶上，形成「週報 → 日報 → 原始紀錄」的追溯鏈。
- 合併重複的事項，不要逐日流水帳。
- 連續多天出現的卡關要特別標出來。
- 用繁體中文、條列、精簡。

## 選用：送出

若有 Notion 或 Jira 連接器且設定了 `REPORT_DESTINATION`，比照日報的方式送出，類型為「週報」。

最後只回覆一行：週報存放的路徑。
