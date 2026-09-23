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

## 工具頁說明區塊

每個工具頁底部可以有一段長篇說明，由 `src/components/ToolGuide.vue` 渲染，內容全部放在語言檔。

- 觸發條件：語言檔中存在 `tools.<工具 key>.guide.intro` 就會顯示，沒有的工具不顯示任何東西。工具 key 就是路由去掉開頭斜線，例如 `/hash-text` 對應 `hash-text`。
- 可用區塊（除 `intro` 外皆可省略）：

  ```yaml
  tools:
    hash-text:
      guide:
        intro: '一兩句話說明這個工具在做什麼'
        useCases:   # 什麼時候會用到
          - '情境一'
        steps:      # 使用方式，會渲染成有序清單
          - '步驟一'
        notes:      # 注意事項
          - '提醒一'
        faq:        # 常見問題
          - q: '問題'
            a: '答案'
  ```

- 三個語言檔都要補，且各區塊的陣列長度要一致，`src/components/tool-guide.test.ts` 會檢查。
- 訊息裡的 `@` 是 vue-i18n 的保留字元，要寫成 `{'@'}`，例如 `"{'@'}reboot 只在啟動時執行"`。否則 build 會失敗。
- 陣列區塊在元件裡是用 `tm()` 讀取，不能用 `te()` 判斷存在與否，`te()` 對陣列 key 一律回傳 false。
- 內容請寫實際有用的資訊（適用情境、參數意義、常見陷阱），這同時是 SEO 與廣告審核看重的原創內容。

## 其他慣例

- `components.d.ts` 由 build 自動產生，不要把它的變更加進 commit。
- 產生密碼、token、金鑰等任何秘密時，一律用 `src/utils/secureRandom.ts`（`crypto.getRandomValues` 加拒絕取樣），不要用 `Math.random` 或 `src/utils/random.ts`；後者只適合 lorem ipsum 這類非安全用途。
- 新工具用 `pnpm run script:create:tool <name>` 建立骨架，名稱與描述一律走 `translate()`，並在 `locales/en.yml`、`zh-TW.yml`、`zh.yml` 補上 key。
- 每次新增 i18n key 後，確認 `zh-TW.yml` 與 `zh.yml` 的 key 集合與 `en.yml` 完全一致。
