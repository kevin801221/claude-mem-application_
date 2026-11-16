---
name: push-weekly
description: 將本人已核對的 weekly 報告提交到明確確認的私有團隊 repo，拒絕公開 repo 與不明目的地。
disable-model-invocation: true
---
# 提交 weekly 報告

讀 `docs/team-report-workshop.md`。核對資料 repo、報告路徑、作者及來源。對使用者顯示完整內容/差異、遠端 owner/repo、分支，以及「同一團隊有此 repo 讀取權限的人都看得到」。取得這次分享的明確確認；本人確認內容正確不等於同意發布。

用 `git diff` 等唯讀命令先檢查，不自行清除 staging、不強制 push、不 merge。確認後執行：
`node workshop/cli.mjs push-weekly --data <private-data-checkout> --config <team.json> --file <canonical-relative-report.md> --confirm-repo <owner/repo> --confirm-member <member>`

命令需要已登入的 GitHub CLI 與 git push 權限，檢查 fetch/push origin 相符、repo 私有且可寫、目前非預設成員分支與遠端一致、staging 沒有其他檔案、來源核對仍有效，再僅提交這一份報告。事後以 PR review 合入預設分支。遇到未知狀態或失敗就停下，提供錯誤與恢復方式，不改成其他分享管道。

`approved_by` 不是驗證身份。多人 repo 還需要 GitHub 權限、分支保護及 review，不能用資料夾或 branch 當隱私隔離。不要把報告推到這個公開教學程式庫。
