# 專案開發規範

本 repo 原始碼源自 [CorentinTh/it-tools](https://github.com/CorentinTh/it-tools)（GPL-3.0，已脫離 fork 獨立維護），部署於 https://ittools.heitang.info。上游已停止更新，不再同步。

## 分支流程

- `main`：唯一主線，Cloudflare 從這裡部署正式站，不直接 push。
- 功能一律開分支，PR 目標是 `main`，合併後刪除分支。
- 若日後需要參考上游修正，用本機 `upstream` remote 抓下來 cherry-pick，不做整支合併。

## Commit 訊息

- **一律使用繁體中文**撰寫標題與內文，不要寫英文說明。
- 保留 conventional commits 的類型前綴（`feat`、`fix`、`chore`、`docs`、`refactor`、`test`、`ci`），因為 `scripts/shared/commits.mjs` 靠它產生 changelog。scope 可省略。
- 格式範例：

  ```
  feat(i18n): 新增繁體中文語言檔

  補齊所有工具的翻譯，並在語言選單加入「繁體中文」。
  ```

## PR 說明

- 標題與說明同樣使用繁體中文。
- 先以 draft 開啟，由 repo 擁有者確認後合併。

## 推送前檢查

依序執行並確認全部通過：`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。

## 其他慣例

- `components.d.ts` 由 build 自動產生，不要把它的變更加進 commit。
- 新工具用 `pnpm run script:create:tool <name>` 建立骨架，名稱與描述一律走 `translate()`，並在 `locales/en.yml`、`zh-TW.yml`、`zh.yml` 補上 key。
- 每次新增 i18n key 後，確認 `zh-TW.yml` 與 `zh.yml` 的 key 集合與 `en.yml` 完全一致。
