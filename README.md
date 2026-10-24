# Block Blast · 方塊爆破

一款以 React + Vite 製作的霓虹風方塊消除益智遊戲。拖曳方塊到 8×8 棋盤，完成整行或整列即可消除並得分。

## 遊戲流程

- **首頁**：顯示歷史最高分與「開始遊戲」按鈕。
- **遊戲中**：頂部即時分數與最高分、中央 8×8 棋盤、下方 3 個方塊。
- **結算頁**：顯示最終分數、消除行數與最高分；破紀錄時顯示 `New High Score!`。

最高分使用 `localStorage` 的 `blockBlastHighScore` 儲存，並會自動接手舊版的最高分紀錄。

## 玩法與互動

- 每個方塊都是 Framer Motion 的 `motion.div`，支援滑鼠與手機觸控拖曳。
- 拖曳時方塊會放大到接近棋盤格尺寸，並浮在手指上方約 40px，避免遮住落點。
- 放開時會以方塊中心重新比對棋盤 DOM 幾何；方塊矩陣中的 `0` 透明格不參與碰撞與邊界判定。
- 方塊進入棋盤後會即時顯示半透明落點陰影；合法位置放開即扣合，非法位置會平滑彈回原位。
- 也可點一下方塊選取，再點擊棋盤上標示的左上角錨點放置。
- 每填滿一行或一列即消除：單行 100 分，同時消除多行會逐條加倍。
- 連續消除可累積 Combo，分數倍率最高 x8。
- 每次成功放置後，該插槽會立即補入新方塊，方塊庫永遠維持 3 個。
- 若目前 3 個方塊全數無處可放，遊戲結束。
- 使用 Web Audio API 即時合成放置、消除與錯誤音效，不需要任何音訊檔。

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
  App.jsx              # 三種遊戲畫面、拖曳互動與狀態管理
  game.js              # 棋盤、方塊、消除、計分等純邏輯
  game.test.js         # 棋盤與計分單元測試
  dragGeometry.js      # 拖曳落點與棋盤幾何計算
  dragGeometry.test.js # 落點換算單元測試
  highScore.js         # 最高分讀寫與舊版資料遷移
  highScore.test.js    # localStorage 單元測試
  SoundManager.js      # Web Audio 合成音效
  SoundManager.test.js # 音效節點與降級測試
  index.css            # Tailwind 與霓虹視覺樣式
.github/
  workflows/
    deploy.yml         # GitHub Pages 建置與部署
```

## GitHub Pages 部署

`vite.config.js` 已設定 `base: '/block_blast_game/'`。推送至 `main` 分支後，GitHub Actions 會依序執行 `pnpm install --frozen-lockfile`、測試、`pnpm run build`，並透過 GitHub Pages Actions 發佈 `dist`。

首次部署前，請在 GitHub 倉庫的 **Settings → Pages → Build and deployment** 將 **Source** 設為 **GitHub Actions**。
