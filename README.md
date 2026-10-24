# Block Blast · 方塊爆破

一款以 React + Vite 製作的霓虹風方塊消除益智遊戲。在 8×8 棋盤上擺放方塊，完成整行或整列即可消除並得分。

## 遊戲玩法

- 棋盤為 8×8 的二維陣列，每次提供 3 個不同形狀的俄羅斯方塊。
- 點選下方方塊，再點擊棋盤上「左上角」的放置位置；桌面版也支援拖曳。
- 被選取的方塊會用亮點標示所有可放置的錨點，滑過棋盤可預覽落點。
- 每填滿一行或一列即消除：單行 100 分，同時消除多行會逐條加倍。
- 連續消除可累積 Combo，分數倍率最高 x8。
- 3 個方塊都用完後自動補充；若剩餘方塊全數無處可放，遊戲結束。
- 最高分會保存在瀏覽器 `localStorage`。

## 本機開發

需要 Node.js 22.12+ 與 pnpm。

```bash
pnpm install
pnpm dev
```

品質檢查：

```bash
pnpm test
pnpm lint
pnpm build
```

## 專案結構

```text
src/
  App.jsx        # 遊戲介面、狀態與互動
  game.js        # 棋盤、方塊、消除、計分等純邏輯
  game.test.js   # Vitest 單元測試
  index.css      # Tailwind 與霓虹視覺樣式
.github/
  workflows/
    deploy.yml   # GitHub Pages 建置與部署
```

## GitHub Pages 部署

`vite.config.js` 已設定 `base: '/block_blast_game/'`。推送至 `main` 分支後，GitHub Actions 會依序執行 `pnpm install --frozen-lockfile`、測試、`pnpm run build`，並透過 GitHub Pages Actions 發佈 `dist`。

首次部署前，請在 GitHub 倉庫的 **Settings → Pages → Build and deployment** 將 **Source** 設為 **GitHub Actions**。
