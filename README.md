# Mandate — 可信碳排證據 Agent（Hackathon Prototype）

**產品定位（2026-08-25）**：協助台灣鋼鐵供應商與歐盟進口商，在**正式 CBAM 查驗／申報前**，把工廠年度排放、批次分攤、佐證文件與限時授權整理成可追溯的**證據案件**（Demo Prototype，**非**官方 Registry、**非**法定查驗完成）。

- **我們是**：申報前證據準備與風險預審協作層、確定性 carbon-core 計算、Demo Vault 與三角色工作流、Day 3 起接上真的（非 mock）proof／factor-registry／policy-gate trust engine（`demoOnly`，非正式 zk-SNARK，見下）。
- **我們不是**：政府／海關、CBAM Registry、法定第三方查驗機構、已由 ZKP／Agent／Gate **正式驗證**的商用產品。

工程規格優先權與 Day 2 交棒詳見 [`docs/handoff/DAY2_EXECUTION_PLAN.md`](docs/handoff/DAY2_EXECUTION_PLAN.md)。Day 2 決策摘要：[`docs/handoff/PHASE2_SESSION_LOG.md`](docs/handoff/PHASE2_SESSION_LOG.md)。Day 3 trust engine 手冊：[`docs/handoff/DAY3_TRUST_ENGINE_HANDOFF.md`](docs/handoff/DAY3_TRUST_ENGINE_HANDOFF.md)。Day 3 決策摘要：[`docs/handoff/PHASE3_SESSION_LOG.md`](docs/handoff/PHASE3_SESSION_LOG.md)。

> **Git**：Day 3 trust engine 已 commit（`8f10675`），目前分支 `feature/agent-demo-integration`。Day 3 獨立審查發現的 **Trust Engine P1 修正**（見下）目前在 **working tree，尚未 commit**。

---

## 快速啟動（Day 2 主線）

```bash
cd mandate
npm start
```

瀏覽器開啟 [http://127.0.0.1:3847/](http://127.0.0.1:3847/) — **Root UI**：三角色案件工作流（Supplier／Importer／Verifier）、Demo Vault、Audit Timeline。

**驗收（無需 API Key）**

```bash
npm run smoke:carbon-core   # 36 項
npm run smoke:workflow      # workflow 34 + UI 16 = 50 項
npm run smoke:trust         # Trust engine：4 個服務單元 + 攻擊矩陣 + E2E，43 項
```

Playwright 驗收截圖：[`docs/handoff/screenshots/day2/`](docs/handoff/screenshots/day2/)（supplier / importer / verifier / vault-denied）。

**環境變數**：Day 2 workflow **無新增**環境變數；`.env.example` 僅供 legacy 三幕可選功能（見下）。

---

## Day 2 Root UI

| 項目 | 說明 |
|------|------|
| 入口 | `public/index.html` |
| 固定案件 | `CASE-2026-001`（TW-STEEL-01 / 2026） |
| 角色切換 | header `x-demo-role`（畫面按鈕切換） |
| Supplier | 上傳 synthetic evidence、人工確認、提交、建立 Verifier Grant |
| Importer | 摘要、證據完整度、actual vs default（Demo estimate） |
| Verifier | Evidence Index、一次性 token 開啟／**下載**底稿、findings |
| 信任文案 | `READY_FOR_VERIFIER` 只代表送查準備條件，**不代表**正式查驗或官方核准 |
| 依賴服務 | Agent 仍 `unavailable`（不阻擋 READY）；Proof／Gate **Day 3 起為真引擎**（見下），normal 案件 `revalidate` 後可到 **READY_FOR_VERIFIER** |

`x-demo-role` 只是可切換的 **Demo 身分**，沒有真實 authentication／authorization，也沒有 tenant 隔離。Root UI 與 Worker 可部署版本只允許 synthetic data；公開部署時任何人都能切換角色、操作案件及以 Supplier 重置。正式環境必須停用此機制，或改接真實 auth 與 tenant-scoped store。

API 範例：[`docs/handoff/DAY2_API_EXAMPLES.json`](docs/handoff/DAY2_API_EXAMPLES.json)
測試清單：[`docs/handoff/DAY2_TEST_CASES.md`](docs/handoff/DAY2_TEST_CASES.md)

---

## Trust Engine（`services/proof` + `services/factor-registry` + `services/policy-registry` + `services/policy-gate`）

`server/trustAdapter.js` 的 evaluator 是真引擎：normal fixture 走完整 HTTP 流程（Supplier 上傳→確認→提交→`POST /api/workflow/revalidate`）會推到 `READY_FOR_VERIFIER`；攻擊情境（偽造 proof、任意 `inputHash`、SHIP-A proof 套 SHIP-B、換年度／工廠／政策／係數、`tampered_quantity`、`replayed`、`revoked`、`expiry`、`nonce` 缺失、`wrong_factor`、`missing_period`）全部回穩定 `BLOCKED`／`NEEDS_EVIDENCE` 與對應 reason code。

期望值（expected context）一律由 `trustAdapter.buildCaseTrustContext()` 從 **workflow store 持有的案件快照**（case／installationYear／shipments／evidence）與 **Policy／Factor Registry 的權威記錄**獨立重建；`revalidate` 呼叫端傳進來的 `inputHash` 只被當作宣稱值比對，塞任意值會得到 `PUBLIC_INPUT_MISMATCH`。Proof 是**逐批**綁定（caseId／shipmentId／installationId／reportingYear／quantityTonnesScaled／allocatedEmissionsScaled／intensity commitment／policyProfileId／policyVersion／policySnapshotHash／factorSetId／factorSetHash／inputHash／nonce／expiry）。

> **⚠️ 誠實揭露：這不是真的 zk-SNARK。** `services/proof` 沒有跑 Circom/snarkjs。`ProofEnvelope.proof` 是 `demoOnly:sha256:` 前綴的 **hash commitment**——這是《8/24–8/28 雙人落地分工計畫》p.9「ZKP 失敗備援順序」第三選擇（以 commitment／Hash 驗證流程展示，清楚標示 ZKP 尚未在該環境執行）。commitment 會被**現場重算並以 `crypto.timingSafeEqual` 比對**，偽造 proof bytes 會回 `PROOF_INVALID`；但 commitment 的輸入全部是公開值，任何人拿到 publicInputs 都能自己算出同一串，所以它**不是**密碼學證明、也不是簽章。`checks` 裡的 `cryptographic_proof` 永遠標 `skipped` 留痕。demo 前務必讓所有人知道「ZKP 已完成」不是正確講法。
>
> **Nonce／重放的邊界**：nonce ledger 是**單一 process 記憶體**（含 TTL 與容量上限），只有在整組驗證通過後才原子消費，失敗請求不占用 nonce。Cloudflare Workers 是多 isolate 執行，**跨 isolate 不共享**這份記錄——Workers 上只能宣稱「單 isolate 內偵測到重放」，**不得宣稱完整 replay protection**。要接持久化版本用 `services/proof` 的 `setNonceLedger(adapter)` hook（Durable Object／KV／D1）。

測試：`tests/trust/smoke.js`（43 項，`npm run smoke:trust`）。

---

## Legacy 入口（舊版 PCF 三幕）

[http://127.0.0.1:3847/legacy.html](http://127.0.0.1:3847/legacy.html) — 2026-07 改題前的 **碳數據信任閘門 Agent V1**：Agent 索取 PCF → 品質閘 → 人類核准 CBAM 草稿；權限唯一放行點為 `PolicyEngine.evaluate`（見 `docs/trust/POLICY_SPEC.md`）。

Root UI header 亦有「舊版 PCF 介面參考」連結。Legacy 與 carbon-core **兩套資料模型並存**，互不呼叫。

### 可選：接語言模型（Legacy Demo 主線）

```bash
cd mandate
copy .env.example .env
# 編輯 .env，填入 OPENAI_API_KEY=sk-...
npm start
```

- 有 Key：legacy 介面「AI 自動演三幕」
- 無 Key：左欄手動備援三幕
- **勿把 `.env` 提交進 git**

### 可選：稽核紀錄雙寫 Supabase（Legacy）

見 `.env.example` 的 `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`；執行 `supabase/schema.sql` 後啟用。Workflow Audit 預設仍為記憶體。

---

## npm scripts

| Script | 用途 |
|--------|------|
| `npm start` | 啟動 `server/index.js`（port **3847**） |
| `npm run smoke:carbon-core` | Phase 1 計算核心 + schema validator（36 項） |
| `npm run smoke:workflow` | Day 2 workflow API + UI 靜態契約 |
| `npm run smoke:trust` | Trust engine proof/factor-registry/policy-registry/policy-gate + 攻擊矩陣 + E2E（43 項） |
| `npm run smoke:ui` | 僅 UI 靜態契約 |
| `npm run smoke` | Legacy policy（12 vectors + 4 trace） |
| `npm run smoke:agent` | Legacy agent（需 Key，無 Key 則 SKIP） |
| `npm run dev:cf` / `deploy:cf` | 可部署的 synthetic Hackathon Demo（含 Root UI；非正式環境） |

---

## 2026-08-23 改題後的 Carbon Core

最高工程規格：《Vibe Coding AI 完整工程規格與指令手冊》。Phase 1 核心位於 `packages/contracts/`、`services/carbon-core/`、`fixtures/`。

normal Demo 由明確標 `demoOnly` 的 activities/factors 計算 `360 tCO2e ÷ 200 tonnes = 1.80 tCO2e/tonne`，再分攤 SHIP-A 180、SHIP-B 108；**不代表**官方係數或真實鋼廠資料。

改題記錄：`DECISIONS.md` §9。Day 1 handoff：[`docs/handoff/PHASE1_SESSION_LOG.md`](docs/handoff/PHASE1_SESSION_LOG.md)。

---

## 目錄

| 路徑 | 說明 |
|------|------|
| `public/index.html` | **Day 2** 三角色 Root UI |
| `public/legacy.html` | Legacy PCF 三欄工作台 |
| `server/workflowApi.js` | Day 2 workflow + Vault API |
| `server/trustAdapter.js` | Trust evaluate 接點；從案件快照獨立建 expected context，串 proof／factor-registry／policy-registry／policy-gate |
| `server/carbonAdapter.js` | carbon-core 整合與 service stubs |
| `packages/contracts/` | Canonical schema、enums、validator |
| `services/carbon-core/` | 年度／批次計算（唯一數字來源） |
| `services/proof/` | 逐批 ProofEnvelope 驗證 + demoOnly commitment 重算 + nonce ledger（非真 zk-SNARK，見上） |
| `services/factor-registry/` | FactorSet 權威記錄（issuer/purpose/version/sourceHash、active/expired/revoked） |
| `services/policy-registry/` | PolicyProfile 權威記錄與 immutable snapshot 比對（CN code／年度／circuit／requiredEvidence／status） |
| `services/policy-gate/` | 證據涵蓋期間計算，並組合 policy+factor+逐批 proof 為 `GateResult` |
| `tests/workflow/`、`tests/ui/` | Day 2 煙測 |
| `tests/trust/` | Day 3 煙測（單元 + 攻擊矩陣 + E2E） |
| `docs/handoff/` | Day 1 / Day 2 / Day 3 交棒文件 |
| `docs/trust/` | Legacy 六信任要點規格 |

---

## Day 2 Workflow API 摘要

需 header `x-demo-role: Supplier|Importer|Verifier`；Vault 另需 `x-vault-token`（**不得**放 query）。

- `GET /api/cases` · `GET /api/cases/:id` · `POST /api/cases/:id/submit` · `GET /api/cases/:id/audit`
- `POST /api/evidence` · `POST /api/evidence/:id/confirm`
- `GET /api/importer/cases/:id/summary`
- `GET /api/verifier/cases/:id/evidence` · `POST /api/verifier/cases/:id/findings`
- `POST /api/vault/grants` · `POST /api/vault/grants/:id/revoke`
- `GET /api/vault/items/:id` · `GET /api/vault/items/:id/download`
- `POST /api/workflow/carbon/preview`（回 `previewOnly:true`、`clientSuppliedInput:true`，不寫入案件） · `POST /api/workflow/revalidate`（Supplier，trust hook） · `POST /api/workflow/reset`（僅 Supplier）

Legacy API（`/api/tools/*`、`/api/agent/*` 等）見 legacy 段落與 `docs/trust/`。

---

## Legacy Demo 三幕（僅 `legacy.html`）

1. Agent 向無證零件行索取 → `DENY_CONSTRAINT` / `POL-CARB-001`
2. Agent 向青禾索取 → 入庫 → `PENDING_HUMAN` / `POL-HITL-010` → 人類核准
3. 撤銷分享 → `DENY_REVOKED` / `POL-REV-010`

話術：[`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)。

---

## 文件優先

| 交件／規格 | 路徑 |
|------------|------|
| Day 2 交棒 | [`docs/handoff/DAY2_EXECUTION_PLAN.md`](docs/handoff/DAY2_EXECUTION_PLAN.md) |
| Day 2 session log | [`docs/handoff/PHASE2_SESSION_LOG.md`](docs/handoff/PHASE2_SESSION_LOG.md) |
| Day 3 trust engine 手冊 | [`docs/handoff/DAY3_TRUST_ENGINE_HANDOFF.md`](docs/handoff/DAY3_TRUST_ENGINE_HANDOFF.md) |
| Day 3 session log | [`docs/handoff/PHASE3_SESSION_LOG.md`](docs/handoff/PHASE3_SESSION_LOG.md) |
| Governance Gap Memo | [`docs/trust/GOVERNANCE_GAP_MEMO.md`](docs/trust/GOVERNANCE_GAP_MEMO.md) |
| 信任架構 | [`docs/trust/TRUST_ARCHITECTURE.md`](docs/trust/TRUST_ARCHITECTURE.md) |
| Policy 契約（Legacy） | [`docs/trust/POLICY_SPEC.md`](docs/trust/POLICY_SPEC.md) |

> Legacy 執行碼若與 docs 殘留採購付款工具名，以 **docs 為準**；Root UI 已對齊 carbon-core 主線。

---

## 刻意不做（Prototype）

正式 CBAM registry 提交、碳權避險、真正的 zk-SNARK proving（Circom/snarkjs，Day 3 是 `demoOnly` 綁定檢查）、Evidence Agent **正式上線**、Factor Registry 正式治理（Day 3 僅 3 筆 Demo 記錄）、正式 KMS/HSM、讓 LLM 自判權限、宣稱官方查驗完成或海關核准或 ZKP 已完成正式驗證。

已知限制：Evidence `version` 目前恆為 `1`，同名檔案直接拒絕，尚未實作 evidence 版本演進。Worker 路徑可部署 synthetic Demo，但正式環境必須關閉 `x-demo-role`／公開 reset，或換成真實 auth 與 tenant store。
