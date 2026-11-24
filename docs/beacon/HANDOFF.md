# BEACON 2026 交接：Mandate × ME Network

> 交接日期：2026-11-24，士愷（Kinoko1412）交給昱羲（1qaz0726-star）。
> **給接手的 agent**：先讀完這份，再讀 repo 根目錄的 `CLAUDE.md`（架構原則仍然適用）。
> 技術細節在同目錄的 `ME_NETWORK_TECH_NOTES.md`，實測紀錄在 `ME_NETWORK_CONNECTION_TEST_20261111.md`。

## 0. 比賽與期限

- 比賽：MetaEarth Hackathon 2026 · BEACON 台灣站。隊名 **Proof to zero**（士愷、昱羲、胡馨），已報名，全隊 ME ID 進階認證已完成。
- 官方公告：https://www.mec.me/en-US/govern-announcement/metaearth-hackathon-2026-beacon-is-live-taiwan-s-ready-compe
- **交件：2026-12-06（六）23:59（UTC+8）**。Demo Day：12/24。
- 台灣站 TG：`@Taiwan_Meta_Earth_Hackathon2026`。交件格式（影片、簡報、表單欄位）**還沒查清楚**，要在 TG 或官方交件表單確認。
- 不要跟 HARBOR（全球站，11/27 報名、12/21 交件）搞混。HARBOR 規定同一個專案不能兩站都投，Mandate 只投 BEACON。

## 1. 硬性要求（交件一定要對得上）

1. **至少一個評審能實際操作的核心功能跑在 ME Network 上**，交件時要附執行證明（tx hash、合約地址、鏈上查詢結果、截圖）。
2. 舊作可以參賽，但**只評比賽期間新增的部分**，交件要附「repo 連結＋指定 commit」。
3. 比賽起點：標籤 **`beacon-baseline` → `1d5642e`**，兩個 repo 都有。用這個比較連結標出新增部分：
   - `https://github.com/1qaz0726-star/mandate/compare/beacon-baseline...<交件 commit>`
   - （或士愷的 fork：`https://github.com/Kinoko1412/mandate/compare/beacon-baseline...<交件 commit>`）

## 2. 設計（已定）

信任閘門判定 GATE_OK 時，把 canonical payload 的 sha256 寫進 ME Network 上的 `EvidenceAnchor` 合約：

- **方案 1：存證**。用 `anchor(hash, caseId)` 存證，鏈上記下時間、存證帳號、案件編號。
- **方案 2：供應商身分**。供應商用 ME 錢包對同一個雜湊做 EIP-191 簽名，用 `anchorWithSupplier(hash, caseId, sig)` 送上鏈，合約在鏈上還原出簽名者地址。後端再查這個地址有沒有 ME ID（DID）。

原則（不要打破）：
- **只有雜湊上鏈**，原始碳排數據不上鏈。
- **上鏈是加分功能，不是放行條件**。`services/chain-anchor` 對外的函式都不會拋出例外，用 `status` 回報結果（`anchored` / `disabled` / `error` / `found` / `not_found`）。上鏈失敗不能影響 Gate 判定。
- **`server/policy.js` 仍然是唯一的放行點**。上鏈只能接在判定之後，不能拿來當判定條件。
- 合約刻意做得很小：沒有 owner、不能升級、不能刪除，同一個雜湊不能存兩次。

## 3. 目前狀態（2026-11-24）

分支 **`beacon/me-network`**，從 `beacon-baseline` 開出來，已經 push 到兩個 repo。

| 檔案 | 狀態 |
|---|---|
| `contracts/me/EvidenceAnchor.sol` | ✅ 寫好（Solidity 0.8.24） |
| `contracts/me/build.js` | ✅ `npm run build:me-contract` 用 solc 編譯，產出 `services/chain-anchor/EvidenceAnchor.artifact.json` |
| `services/chain-anchor/index.js` | ✅ `anchorEvidence` / `verifyAnchor` / `lookupMeId` / `signEvidenceAsSupplier` / `recoverSupplier` / `evidenceHashOf` |
| `services/chain-anchor/meAddress.js` | ✅ `0x` ↔ `me1` 地址互轉（bech32，前綴 `me`） |
| `tests/chain-anchor/local.smoke.js` | ✅ `npm run smoke:chain-anchor`，用 ganache 本機模擬鏈，**10 項通過**（2026-11-24 重跑） |
| 部署到 ME 測試網 | ❌ 還沒做 |
| 接進 Mandate 主流程／UI | ❌ 還沒做 |
| `lookupMeId` 子帳戶查詢 | ❌ 要改（見 4-2） |

環境變數（放在 `.dev.vars` 或 wrangler secret，**不要進 git**）：

```
ME_EVM_RPC_URL=http://118.175.0.249:8545   # 測試網預設
ME_EVM_CHAIN_ID=400
ME_REST_URL=http://118.175.0.249:1317      # 查 ME ID 用
ME_ANCHOR_CONTRACT=<部署後的合約地址>
ME_ANCHOR_PRIVATE_KEY=<送存證交易的後端測試網金鑰>
```

上面兩個都沒設時，`anchorEvidence` 回傳 `status: 'disabled'`，其他功能照常運作。

## 4. 待辦（依急迫度排）

### 4-1. 部署合約到 ME 測試網
1. 用 ethers 自己建一個**新的測試網錢包**。士愷的測試錢包金鑰不在 repo 裡，不要等它。把金鑰存在 repo 外面。
2. 到水龍頭 https://www.mec.me/en-US/faucet 領測試幣：每個地址每天 2 MEC，要 email 驗證碼，**只能手動領**（官網會擋自動化瀏覽器）。EVM 部署實際要花多少還沒驗證，建議三個隊員都去領，再轉到同一個地址。
3. 寫一支部署腳本（例如 `contracts/me/deploy.js`）：讀 artifact，用 `ethers.ContractFactory` 部署到 chainId 400，印出合約地址和 tx hash。
4. 部署後實際打一次 `anchor` 和 `verify`，把合約地址、tx hash 和 REST 查回的 JSON 記到 `docs/beacon/DEPLOYMENT.md`，交件要當執行證明用。測試網可能會重置，所以截圖也要留。

### 4-2. 修 ME ID 查詢（主帳戶與子帳戶）
- ME ID 綁在 **Cosmos 衍生的主帳戶**上。同一組助記詞算出來的 **ETH 衍生地址是另一個地址**，要先在 ME Pass 綁成子帳戶，再用子帳戶查（官方 JS SDK 的 `getMeIdBySubAccount`）。出處：https://docs.mec.me/docs/development-guides/developer-guide/js-sdk
- 現在的 `lookupMeId` 只打 `GET /metaearth/did/did?address=me1...`（主帳戶）。供應商簽名還原出來的是 ETH 地址，**直接查通常會回 not_found**。
- 要做的事：從 SDK 原始碼（GitHub `openmetaearth/meta-earth-js-sdk`；npm 上已經裝不到）找出 `getMeIdBySubAccount` 實際打的 REST 路徑，加到 `lookupMeId`，改成「主帳戶查不到時再查子帳戶」。也要在 `tests/chain-anchor/local.smoke.js` 補上測試。

### 4-3. 決定上鏈放在哪裡跑
- ME 官方的 EVM 端點是「裸 IP＋非標準埠＋HTTP」。Cloudflare Workers 線上版大概連不到，**這是推論，還沒實測**，建議先實測。
- 查 ME ID 的 REST 另有 HTTPS 網域 `https://beta-hub-1317.explorer-testnet.me`（測試網），Workers 或許能用，**還沒實測**。
- 三個選項：
  - (a) **Demo 時用本機 Node 版（`npm start`）上鏈**，最快。
  - (b) 在一台電腦上跑中繼，用 Cloudflare Tunnel 給它一個 HTTPS 網域，Worker 改連中繼，線上版就能用。
  - (c) Worker 先記雜湊，再由本機排程批次上鏈。
- 時間不多，建議先做 (a)，有餘力再做 (b)。

### 4-4. 接進 Mandate 主流程和 UI
- 閘門判定 GATE_OK 後呼叫 `anchorEvidence({ canonicalPayload, caseId, supplierSignature })`。canonical payload 要跟 RFC 3161 時戳（`services/timestamp`）用同一份，接法可以參考時戳是怎麼接進 trust workflow 的（commit `1d5642e`）。
- `server/index.js` 和 `worker/index.js` 兩個入口都要顧到（見 `CLAUDE.md`）。如果選 4-3 的 (a)，Worker 版要能正常回傳 `disabled`，不能壞掉。
- 畫面上要顯示：tx hash（附 explorer 連結）、區塊高度、供應商地址、ME ID 狀態。再加一個**任何人都能用的查證頁**：輸入雜湊，呼叫 `verifyAnchor` 查鏈上紀錄。
- 這算擴大範圍，要依 `CLAUDE.md` 在 `DECISIONS.md` 補一筆：日期、原因是「BEACON 要求核心功能上 ME Network」。

### 4-5. 交件
- 確認交件格式（TG、交件表單）。
- 準備：repo 連結、指定 commit、`beacon-baseline...交件commit` 比較連結、合約地址、tx hash、Demo（影片或線上）。

## 5. 已知的坑

1. 官方 JS SDK `meta-earth-js-sdk` 在 npm 上裝不到（ENOVERSIONS）。我們直接用 `ethers` v6 接 EVM，不依賴 SDK。
2. 測試網 chain-id 是 `mechain_400-1`，EVM chainId 400。鏈上單位是 1 MEC = 10^8 umec，測試網指南寫 10^6 是錯的。
3. 官方合約教學（CosmWasm 那條路線）有三個名稱寫錯。我們走 EVM 路線，不受影響。
4. 官網和區塊瀏覽器會擋自動化瀏覽器，執行證明要手動截圖。
5. 部署規則：`CLAUDE.md` 寫的預設部署目標是士愷的 Cloudflare 帳號。**昱羲接手後，部署到哪個帳號由昱羲決定**，要跟隊伍確認，不要直接覆蓋團隊共用的正式網址。

## 6. 其他資料

- 隊伍共用雲端硬碟：`Kinoko_昱羲_胡馨_比賽資料夾/MetaEarth_BEACON_交接_20261124/`，裡面有報名資料、比賽透明度查核（獎金幣種、KYC 資料去向等疑慮）和這份交接的中文版。
- 獎金發到隊長（士愷）ME ID 對應的 MEC 錢包地址。發 USDT 是口頭聽說的，沒有書面來源。
