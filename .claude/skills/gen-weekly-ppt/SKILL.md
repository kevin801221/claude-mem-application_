---
name: gen-weekly-ppt
description: 從指定日期範圍、成員的已核對日報產出週報草稿和 PPT，列出缺交、請假與休假。
disable-model-invocation: true
---
# 產生週報 PPT

讀 `docs/team-report-workshop.md`。確認 data、team.json、成員、起訖日期與本機輸出路徑。

執行：
`node workshop/cli.mjs weekly --data <data> --config <team.json> --start YYYY-MM-DD --end YYYY-MM-DD --member <member> --out <local-output>`

只彙整 approved 且 hash 相符的日報，不從草稿或其他團隊取得內容。休假/請假是設定檔的教學假設，不自行推測。少一天就明列 missing，不等到無限久，也不補寫。

週報存於 `reports/weekly/<start>_<end>/<member>.md`，仍是 draft。程式拒絕覆寫既有週報，避免吃掉人的修改；要更新時先讓本人確認如何保留舊稿，再另存/編輯。PPT 是已核對日報的確定性彙整，並非已批准的週報。本人看完週報內容與來源後，才可用 `approve --confirm-author` 核對；下一步另用 `/push-weekly`，這裡不送出。
