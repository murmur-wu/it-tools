# 專案開發規範

本 repo 是 [CorentinTh/it-tools](https://github.com/CorentinTh/it-tools) 的客製化 fork，部署於 https://ittools.heitang.info。

## 分支流程

- `main`：保留給同步上游用，不直接開發。
- `dev`：開發主線，Cloudflare 從這裡部署正式站。
- 功能一律開分支，PR 目標是 `dev`，合併後刪除分支。

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
