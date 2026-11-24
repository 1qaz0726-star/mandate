# ME Network 連線測試（2026-11-11，BEACON 準備）

目的：確認 Mandate 能不能接 ME Network，做方案 2：證據雜湊上鏈存證，加上 ME ID 驗證供應商。

## 程式碼位置

- 士愷筆電：`Documents\Mandate\mandate`
  - 從 `Kinoko1412/mandate` clone 下來。`origin` 是個人 fork，`team` 是隊友的 repo。
  - 分支 `beacon/me-network`，起點是標籤 `beacon-baseline`（`1d5642e`）。
- 另一台電腦的 `Documents\Mandate\` 沒有動。

## 結果

| 項目 | 結果 |
|---|---|
| 官方 JS SDK `meta-earth-js-sdk` | **npm 上沒發布**（`npm install` 回 ENOVERSIONS），文件寫的安裝方式跑不動。原始碼在 GitHub `openmetaearth/meta-earth-js-sdk`（最後更新 2026-09-14） |
| 端點（SDK 的 `src/config/define.ts`） | **全部都是 IP 直連的 HTTP**。測試網：`118.175.0.249`，埠號：EVM 8545、REST 1317、RPC 26657。主網：`118.175.0.247`，埠號：REST 11317、RPC 16657 |
| 測試網連線 | ✅ 有在出塊。11:27Z 高度 5,262,955，network `mechain_400-1`，me-hub v2.0.x |
| 主網連線 | ✅ 有在出塊。高度 15,994,207 |
| 測試網 EVM | ✅ `eth_chainId` = 0x190（400），`eth_gasPrice` = 0x7 |
| ME ID 查詢 | ✅ `GET /metaearth/did/did?address=me1...` 可以用。沒有 ME ID 時回 `DID not found` |
| 水龍頭 | ✅ https://www.mec.me/en-US/faucet ：每個地址每天 2 MEC，要填錢包地址、email 和驗證碼。頁面上有「Testnet ME ID」分頁，能不能不做真實 KYC 就拿到測試用 ME ID，**未驗證**。（me-docs 的 `for-developers.md` 寫水龍頭「開發中」，已過時） |

## 測試錢包

- EVM 地址：`0x3f6e31c7Af68208658a12506C34ACB6F10788eCd`
- ME 地址：`me18ahrr3a0dqsgvk9py5rvxjktdug83rkdsptvmu`
- 這兩個是同一把金鑰：ME 地址是把 EVM 地址的 20 bytes 用 bech32、前綴 `me` 編碼而成。
- 金鑰只存在士愷電腦的 repo 外面，**不進 git**，也只能用在測試網。接手的人請自己建一個新的測試錢包，不要等這把金鑰。
- 目前餘額 0，要先領水龍頭。

## 架構限制：Cloudflare Workers 可能連不到

- ME 的端點都是「IP＋非標準埠號＋HTTP」。Cloudflare Workers 線上版的 fetch 有兩個已知限制：不能直接連 IP，非標準埠號也不行。這兩點是依 Cloudflare 的已知限制推論，**還沒實測**。
- 所以上鏈和 ME ID 查詢**大概不能直接放在 `worker/index.js` 裡跑**。

可能的做法（還沒決定）：
1. **本機 Node 入口（`npm start`）負責上鏈**，Demo 時用本機版展示。
2. **中繼服務**：在一台電腦上跑一個小的中繼，用 Cloudflare Tunnel 給它一個 HTTPS 網域，Worker 改連這個網域。
3. 雜湊先寫進 Worker 的稽核紀錄，再由排程從本機批次上鏈（非同步，畫面上會有延遲）。
