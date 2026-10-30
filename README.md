# Block Blast · 方塊爆破

一款以 React + Vite 製作的霓虹風方塊消除益智遊戲。首頁可選擇 **8×8 經典模式** 或 **10×10 擴充模式**，把方塊拖到棋盤上，完成整行或整列即可消除並得分。兩種棋盤共用同一套遊戲邏輯，並各自保存最高分。

## 棋盤模式

| 模式 | 棋盤 | 最高分 `localStorage` Key | 特色 |
| --- | --- | --- | --- |
| 經典模式 | 8×8 | `blockBlastHighScore` | 原版節奏，格子較大、較好對位 |
| 擴充模式 | 10×10 | `blockBlastHighScore10` | 空間更大、連消路線更多，格子與間距自動縮小以適配手機 |

- 首頁的「8×8 經典模式 / 10×10 擴充模式」按鈕會即時切換棋盤與對應的最高分。
- 兩份紀錄完全獨立，10×10 的分數不會覆蓋 8×8 的歷史最高分（反之亦然）。
- 經典模式沿用舊版 Key，因此升級前累積的最高分（含 `block-blast-best-score` 舊資料）會自動保留。

## 遊戲流程

- **首頁**：選擇棋盤模式、顯示該模式的歷史最高分，並以「開始遊戲」按鈕進入遊戲。
- **遊戲中**：頂部即時分數與最高分、中央棋盤（8×8 或 10×10）、下方 3 個方塊。
- **結算頁**：顯示最終分數、消除行數、模式與最高分；破紀錄時顯示 `New High Score!`。

## 玩法與互動

- 每個方塊都是 Framer Motion 的 `motion.div`，支援滑鼠與手機觸控拖曳。
- 拖曳時方塊會放大到接近棋盤格尺寸，並浮在手指上方約 40px，避免遮住落點。
- 放開時會以方塊中心重新比對棋盤 DOM 幾何；方塊矩陣中的 `0` 透明格不參與碰撞與邊界判定。
- 棋盤尺寸（8 或 10）由 `board.length` 動態推導：落點量測會以 `boardSize × boardSize` 找到最後一格，因此 10×10 的邊界與格距同樣精準。
- 10×10 模式會自動縮小格子 `gap` 與棋盤內距，避免手機畫面溢出。
- 方塊進入棋盤後會即時顯示半透明落點陰影；合法位置放開即扣合，非法位置會平滑彈回原位。
- 點一下方塊選取後，棋盤不會出現任何錨點亮點；只要把游標移到想放的位置就會預覽落點，點擊該格即可放置。
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
  App.jsx              # 三種遊戲畫面、模式選擇、拖曳互動與狀態管理
  App.test.jsx         # 首頁模式選擇與畫面渲染的 SSR 冒煙測試
  game.js              # 可傳入尺寸的棋盤、方塊、消除、計分等純邏輯
  game.test.js         # 8×8 / 10×10 棋盤與計分單元測試
  dragGeometry.js      # 依 boardSize 計算拖曳落點與棋盤幾何
  dragGeometry.test.js # 落點與 8×8 / 10×10 邊界換算單元測試
  highScore.js         # 依棋盤尺寸分開讀寫最高分與舊版資料遷移
  highScore.test.js    # localStorage 單元測試
  SoundManager.js      # Web Audio 合成音效
  SoundManager.test.js # 音效節點與降級測試
  index.css            # Tailwind 與霓虹視覺樣式
vite.config.js         # Vite 設定與建置時產生 PWA 預快取清單的外掛
public/
  manifest.webmanifest # PWA 應用資訊（id /block_blast_game/、名稱、主題色、圖示）
  sw.js                # Service Worker：預快取整個 App 並支援離線（清單由建置產生）
  icons/               # 192 / 512 / maskable / apple-touch-icon 圖示
.github/
  workflows/
    deploy.yml         # GitHub Pages 建置與部署
```

## PWA（安裝到桌面／手機）

建置後的網站本身就是可安裝的 PWA：

- `manifest.webmanifest` 提供 `standalone` 顯示模式、主題色與 192/512（含 maskable）圖示。
- **專屬 App ID（可與其他 PWA 並存安裝）**：manifest 的 `id` 明確設為 `/block_blast_game/`。`id` 是瀏覽器辨識「這個 App 是誰」的唯一鍵——同一部裝置上即使裝了多個 PWA（例如同一個 GitHub Pages 帳號底下的 `shernwu-creator.github.io/<各專案>/`），只要 `id` 不同就會被視為不同 App，主畫面／桌面可以同時存在、名稱與圖示各自獨立，也不會互相覆蓋或因為「已安裝」而擋掉第二次安裝。
- `vite.config.js` 的 `block-blast:pwa-precache-manifest` 外掛會在 `pnpm build` 後，把所有輸出檔（`index.html`、hash 過的 JS/CSS、`.woff2` 字型、圖示、manifest）寫進 `dist/sw.js` 的預快取清單，並依檔案清單產生 `BUILD_ID`。
- 因此 **安裝後第一次離線開啟就能玩**：Service Worker 在 `install` 階段就把整個 App 下載進 `block-blast-shell-<BUILD_ID>`，`start_url` 導覽離線時會回退到快取的 `index.html`，所有 JS/CSS/字型都直接從快取取得。
- 每次部署清單與 `BUILD_ID` 都會自動更新，`activate` 時會刪除前一版快取，不會累積舊檔案。
- Service Worker 只在 production build 註冊（`pnpm dev` 不會攔截請求），避免本機開發時拿到舊快取。
- 遊戲本身不需要網路：分數存 `localStorage`、音效由 Web Audio 即時合成，沒有外部 CDN 或 API。

安裝方式：

- **Chrome / Edge（桌機）**：開啟線上網址後點網址列的「安裝」圖示，或選單 →「安裝 Block Blast」。
- **Android Chrome**：選單 →「加到主畫面」。
- **iOS Safari**：分享 →「加入主畫面」。

注意事項：

- 首次安裝一定需要連網一次（Service Worker 必須從網路下載並完成預快取），之後即可完全離線。
- 驗證離線：DevTools → Application → Service Workers 勾選 **Offline** 後重新整理；或 Lighthouse 的 PWA 檢查。
- PWA 需要 HTTPS（GitHub Pages 已提供）才能安裝。
- `public/sw.js` 中 `BEGIN/END GENERATED PRECACHE` 之間的內容由建置流程自動覆寫，請不要手動編輯；若清單沒有被寫入，`pnpm build` 會直接報錯提醒。
- manifest 的 `id` 是「應用程式身分」而不是路徑宣告：瀏覽器（Chromium 系）安裝時會把 `id` 以 manifest 網址為基準解析成唯一鍵，同一個 origin 上的兩個專案只要解析出的 `id` 不同，就會是兩個獨立 App。這裡刻意寫成絕對路徑 `/block_blast_game/` 而非相對的 `./`：相對寫法會隨 manifest 被放到哪個資料夾而改變身分，絕對路徑則固定對應本專案的部署目錄；同時它與 `start_url: "./"` 的預設解析結果相同（皆為 `.../block_blast_game/`），所以既有安裝會直接更新，不會多出第二個圖示。

## GitHub Pages 部署

`vite.config.js` 已設定 `base: '/block_blast_game/'`。推送至 `main` 分支後，GitHub Actions 會依序執行 `pnpm install --frozen-lockfile`、測試、`pnpm run build`，並透過 GitHub Pages Actions 發佈 `dist`。

首次部署前，請在 GitHub 倉庫的 **Settings → Pages → Build and deployment** 將 **Source** 設為 **GitHub Actions**。
