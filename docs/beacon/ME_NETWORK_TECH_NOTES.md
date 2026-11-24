# ME Network 技術筆記（BEACON 用）

> 摘自 2026-11-19 的 HARBOR 研究報告第 2 節，該節經過獨立複查。出處編號沿用原報告的編號。原報告寫的是 HARBOR 的比賽規則，**不適用 BEACON**，所以只保留技術部分。

### 2.1 架構與網路參數

| 項目 | 內容 | 出處 |
|---|---|---|
| 底層 | Cosmos SDK 鏈（ME Hub），**同時開 EVM（ethermint）與 CosmWasm** | [7][9][10][18] |
| 節點版本（11/19 實測） | Cosmos SDK v0.47.13、CometBFT v0.37.5、wasmd v0.43.0、ethermint v0.22.0 | [10] |
| 測試網 | chain-id `mechain_400-1`；Cosmos RPC `https://beta-hub-26657.explorer-testnet.me`、REST `https://beta-hub-1317.explorer-testnet.me` | [10][27] |
| 測試網 EVM | `http://118.175.0.249:8545`，chainId 400；寫在 JS SDK 原始碼與 JS SDK 文件頁，**只有 HTTP**；主網 EVM 要自己指定端點 | [12][14] |
| 主網 | chain-id `me-chain`；瀏覽器 explorer.mec.me | [10][14] |
| 地址 | EVM 錢包的 0x 地址可用 bech32（前綴 me）換成 me1，兩者是同一個帳戶 [24][28]。**但 ME Pass 的 ME ID 主帳戶是 Cosmos 衍生地址，同一組助記詞的 ETH 衍生地址是另一個地址，要先綁成子帳戶，再用子帳戶查詢才查得到 ME ID** | [12] |
| 測試幣 | 水龍頭 https://www.mec.me/en-US/faucet ：每個地址每天 2 MEC，要填 Email 驗證碼 | [17][24] |
| 單位 | 鏈上 1 MEC = 10^8 umec（測試網指南寫 10^6，是錯的） | [10][27] |
| ME ID | 只有**鏈上查詢**：依主帳戶、依 ME ID、依 ETH 子帳戶三種（`getMeIdByAddress`／`getMeIdByDid`／`getMeIdBySubAccount`）；**查不到「用 ME ID 登入」或 OAuth 的 API** | [12][24] |

### 2.2 兩條上鏈路線

| | 路線 A：EVM（Solidity） | 路線 B：CosmWasm（Rust） |
|---|---|---|
| 官方文件 | JS SDK 文件頁有 EVM 部署與呼叫範例（ethers.js，部署者須是 ETH 衍生帳戶）[12] | 官方教學有完整流程 [16] |
| 工具 | ethers.js／Hardhat，熟悉、快 | 要用 Go 從原始碼編譯 `med`、Rust、Docker optimizer [16][27] |
| 我們的進度 | **合約已寫好、本機測試 10 項通過** [25] | 沒做 |
| 坑 | 只有 HTTP 裸 IP；EVM 交易在瀏覽器上怎麼顯示**未驗證** | 教學把 `wasm/cw-template`、`wasm/optimizer`、`wasm-std` 寫錯，要改用 `CosmWasm/cw-template`、`cosmwasm/optimizer:0.17.0`、`cosmwasm-std` [16] |
| Claude 建議 | **主線用 EVM**（已有程式碼） | 有餘力再做，可加分「ME 應用」的深度 |

### 2.3 已知的坑（照影響排）
1. **官方 JS SDK 已從 npm 下架**，文件還寫 `npm install`；原始碼在 GitHub `openmetaearth/meta-earth-js-sdk` [14][15]。
2. **EVM 端點是 HTTP 裸 IP**：官方文件寫明 HTTPS 網頁必須用 HTTPS 的 EVM 端點 [12]；Cloudflare Workers 不能直連 IP 與非標準埠，所以 Mandate 的 Worker 大概不能直接上鏈（推論，未實測）[24]。**Claude 建議**：自己跑一個小中繼，用 Cloudflare Tunnel 給它 HTTPS 網域。
3. **測試幣很少**：每天 2 MEC；照官方 CosmWasm 範例部署約要 2 MEC [16][17]。EVM 部署的實際花費**未驗證**。**Claude 建議**：三個隊員都各領，提早領。
4. **自訂 RollApp 要「deployer 白名單」**，申請方式查不到 [13]。**Claude 建議**：不做 RollApp，除非 11/23 Workshop 說可以快速申請。
5. **官網與瀏覽器擋自動化**，執行證明要手動截圖 [10]。
6. **測試網可能重置** [7]；HARBOR 沒寫測試網紀錄算不算 [2][4]。**Claude 建議**：同時保留 tx hash、合約地址、REST 查回的 JSON 和截圖。

## 出處
7. Meta Earth Docs〈Network Details〉。https://docs.mec.me/docs/getting-started-for-developers/network-details
9. Meta Earth（dev.to）〈Building ME Network 2.0: The Modular Blockchain Stack We Needed〉2025-06-05。https://dev.to/metaearth/building-me-network-20-the-modular-blockchain-stack-we-needed-c3n
10. 鏈上實測（2026-11-19）：測試網 REST https://beta-hub-1317.explorer-testnet.me 的 node_info、denoms_metadata、evm params；主網 RPC status；ME Explorer https://explorer.mec.me
12. Meta Earth Docs〈Meta Earth JS SDK〉。https://docs.mec.me/docs/development-guides/developer-guide/js-sdk
13. Meta Earth Docs〈RollApp Development Guide〉。https://docs.mec.me/docs/development-guides/developer-guide/rollup
14. GitHub openmetaearth/meta-earth-js-sdk（README 與 src/config/define.ts，最後 push 2026-09-14）。https://github.com/openmetaearth/meta-earth-js-sdk
15. npm registry：meta-earth-js-sdk。https://registry.npmjs.org/meta-earth-js-sdk
16. Meta Earth Docs〈Smart Contract Development Guide〉。https://docs.mec.me/docs/development-guides/developer-guide/smart-contract-development
17. Meta Earth〈ME Network Testnet Faucet〉。https://www.mec.me/en-US/faucet
18. MetaEarth 開發者部落格〈ME Network Goes EVM-Compatible〉2026-09-15。https://www.mec.me/en-US/developer-blog/me-network-goes-evm-compatible-embracing-the-ethereum-ecosys
27. Meta Earth Docs〈Testnet Node Setup Guide〉。https://docs.mec.me/docs/development-guides/developer-guide/node-deployment/testnet-node-setup-guide
28. Meta Earth Docs〈Account Details〉。https://docs.mec.me/docs/getting-started-for-developers/account-details
24. docs/beacon/ME_NETWORK_CONNECTION_TEST_20261111.md
25. 本 repo 分支 beacon/me-network：contracts/me/、services/chain-anchor/、tests/chain-anchor/
