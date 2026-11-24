# BEACON 2026 交接：Mandate × ME Network

> 交接日期：2026-11-24，士愷（Kinoko1412）交給昱羲（1qaz0726-star）。
> **給接手的 agent**：先讀完這份，再讀 repo 根目錄的 `CLAUDE.md`（架構原則仍然適用）。
> 技術細節在同目錄的 `ME_NETWORK_TECH_NOTES.md`，實測紀錄在 `ME_NETWORK_CONNECTION_TEST_20261111.md`。

## ⚠️ 先看：設計方向還沒定（2026-11-24）

胡馨和昱羲另外討論出兩個提案（圖檔在隊伍共用雲端「比賽檔案存放/Metaearth/BEACON_交接_20261124/提案圖/」）。這兩個提案的方向，**跟本文件第 2～4 節（也就是目前分支上的程式）不一樣**。
**接手的 agent：大改之前，先跟昱羲確認要走哪個方向。** 第 2～4 節描述的是 11/24 已經寫好的程式，不代表最後的設計。

### 三個方向對照

| | A. 目前分支（已寫好） | B. 提案「Mandate on ME：可驗證的碳資料預檢與授權協作」 | C. 提案「ME Consent：讓 AI 使用文件前先取得授權」 |
|---|---|---|---|
| 題目 | Mandate（碳數據信任閘門） | Mandate 延伸，一樣是碳資料，原型以鋼鐵產品為例 | **新產品**，通用的文件授權，例子是活動企劃（主辦方授權外部設計團隊） |
| 鏈上存什麼 | 證據雜湊、存證帳號、時間、caseId、供應商簽名還原出的地址 | 版本登錄、授權與撤銷、結果關聯（輸入版本＋規則版本＋結果指紋） | 文件指紋、擁有者、授權對象、期限、撤銷狀態 |
| 鏈上紀錄的角色 | **事後查證**：只寫入，不影響放行（第 2 節） | **事前把關**：鏈上狀態決定後端放行或阻擋（圖上寫「本次新增核心｜鏈上狀態連動後端放行與阻擋」） | **事前把關**：每次新的請求都先查鏈上授權，未授權、已撤銷或已過期就拒絕讀取、停止請求 |
| 版本 | 沒有 | 有：V1→V2，**V1 的授權不會自動延伸到 V2** | 有：登錄文件時指定版本 |
| 期限 | 沒有 | 有（授權期限） | 有（授權期限） |
| Demo 劇情 | GATE_OK → 上鏈 → 查證 | 未授權被拒 → 授權 V1 → 找出缺口 → 補件成 V2 → 另外授權並重新檢查 → 核對結果並撤銷 → 撤銷後擋下後續存取 | 身分確認（錢包簽名）→ 文件登錄 → 設定授權 → AI 摘要（先查權限）→ 撤銷並查驗 |
| 跟 `beacon-baseline` 的關係 | 直接延伸 | 直接延伸。Mandate 已有的撤銷（`POL-REV-010`）和缺件檢查（`POL-CARB-001`）可以沿用，概念上是把授權和撤銷從記憶體搬到鏈上 | **幾乎用不到**，等於重做一個新專案，12/6 前要做完的量最大 |

### 換方向時，現有程式能沿用什麼
- **可以直接沿用**：`meAddress.js`（0x↔me1）、`evidenceHashOf`（文件／結果指紋）、EIP-191 簽名還原（錢包簽名確認身分）、`lookupMeId`（還是要先修子帳戶查詢，見 4-2）、ethers 接 ME 測試網的設定、部署流程（4-1）。
- **要擴充合約**（B、C 都需要）：
  - `register(docHash, version, prevHash)`：登錄版本，並記錄 V1→V2 的關聯。
  - `grant(docHash, grantee, expiresAt)`：授權，綁定版本。
  - `revoke(docHash, grantee)`：撤銷。
  - `isAuthorized(docHash, grantee) view`：查詢授權狀態，會檢查期限和撤銷。
  - 只有擁有者能授權和撤銷，這部分用 `msg.sender` 或簽名驗證來判斷。
  - B 方案還要加 `linkResult(resultHash, inputHash, ruleVersion)`。
  - `EvidenceAnchor` 的「同一個雜湊不能覆寫」原則可以保留給登錄用；授權狀態本來就要能改。
- **跟現有原則衝突、要處理的地方**：
  - 第 2 節寫「上鏈只是加分功能，不是放行條件」。B、C 都要求鏈上狀態決定放行，**要改這條**。
  - 用在 Mandate（B）時，`CLAUDE.md` 規定 **`server/policy.js` 是唯一放行點**。建議讓 `policy.js` 把鏈上授權狀態當成一個輸入，並新增一條 POL 規則：先寫進 `docs/trust/POLICY_SPEC.md`，再改 `policy.js`。不要另外開一條放行路徑。`POL-CARB-001`、`POL-HITL-010`、`POL-REV-010` 這些 ID 不要改。
  - 鏈上查詢失敗（節點掛掉、Workers 連不到）時要怎麼處理：B 和 C 都會變成「查不到就拒絕」（fail-closed），Demo 時要確定連線穩定。這又牽涉到 4-3 選在哪裡跑。
- **兩張提案圖都有寫的限制聲明，要保留**：
  - B：「預檢結果不等於正式查驗；上鏈不證明原始數據或 AI 判斷正確；撤銷無法收回已下載文件。」
  - C：「撤銷只能阻止平台之後繼續提供資料，無法收回已下載的內容，也無法讓模型忘記已收到的資訊。文件指紋用來核對版本，不代表內容正確。」

### 比賽規則提醒
- C 是新專案。BEACON 允許新專案，但「只評比賽期間新增的部分」，`beacon-baseline` 就沒有意義了。
- HARBOR（全球站）規定要用**跟 BEACON 不同的專案**：如果 BEACON 走 B，C 理論上可以拿去投 HARBOR（HARBOR 報名 11/27 截止）。這是推論，還沒跟 HARBOR 規則逐條核對。

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

- 隊伍共用雲端：`比賽檔案存放/Metaearth/BEACON_交接_20261124/`，裡面有報名資料、比賽透明度查核（獎金幣種、KYC 資料去向等疑慮）和這份交接的中文版。
- 獎金發到隊長（士愷）ME ID 對應的 MEC 錢包地址。發 USDT 是口頭聽說的，沒有書面來源。
