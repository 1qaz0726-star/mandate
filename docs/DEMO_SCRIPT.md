# Mandate｜Demo Day 5 分鐘腳本

> 目標：在約 **5 分鐘**內演完三幕，讓評審看見 **decision + policyId**，並對上官方六要點。  
> 前置：`npm start` 已開；**`.env` 已設 `OPENAI_API_KEY`（建議）**；瀏覽器全螢幕；**預設「主控版」**（供應商進度卡、待核准橫幅、最近 3 筆）；需要追 `policyId` 時切 **「詳細控制」**（左欄手動／中欄 Agent／右欄完整 audit）。  
> 對齊：[DECISIONS.md](../DECISIONS.md)

**Demo 主線**：在 **主控版** 按「**AI 自動演三幕**」— Agent 代為 索取 → 取回回覆 → 品質檢查 → 申請寫入；無 Key 時自動降級手動備援（切「詳細控制」用 ①②③④）。

**時間分配建議**

| 區段 | 秒數 | 內容 |
|------|------|------|
| 開場痛點 | 0:00–0:45 | 一句定位＋兩個痛點 |
| 幕一 | 0:45–1:50 | 拒收漂亮噸數 |
| 幕二 | 1:50–3:30 | 合格入庫 → 申報 HITL |
| 幕三 | 3:30–4:30 | 撤銷後不能用 |
| 收束＋六要點 | 4:30–5:00 | 一句對照＋誠實範圍 |

---

## 0:00–0:45｜開場（說什麼）

**說**：

> 「當 Agent 能代表公司向供應商要碳數據、代填 CBAM 草稿，風險不再是答錯，而是**吃進假漂亮噸數**與**擅自寫入申報**。  
> Mandate 是碳數據信任閘門：索取實際嵌入排放 → 品質閘 → **人類確認才寫入草稿** → audit；分享一撤，數據就不能再用。」

**點**：無（可指頂欄：Agent 代表 Acme／由 compliance 授權）。

**螢幕應出現**：主控版狀態列（授權有效／AI 已就緒）；供應商進度卡已載入。需要矩陣時再切「詳細控制」。

---

## 幕一｜拒收漂亮噸數（0:45–1:50）

### 說什麼

> 「第一幕：供應商交來一組看起來很大的 tCO2e，但缺 method、boundary、period 或 unit——Policy Gate **直接拒收**，不是事後警告，更不是畫進儀表板。」

### 點什麼（逐步）

1. 在 **主控版** 按 **「AI 自動演三幕」**（或對 Agent 輸入：向無證零件行索取並做品質檢查）  
2. 指主控版「最近動作」或切 **詳細控制** → Agent 步驟與 `DENY_CONSTRAINT`  
3. 在 **詳細控制** 右欄 audit 點一列展開 `policyId`

### 螢幕應出現

| 欄位 | 期望值（示意） |
|------|----------------|
| decision | `DENY_CONSTRAINT` |
| policyId | `POL-CARB-001` |
| 原因摘要 | 缺 method／boundary／period／unit／tCO2e／supplierId（任一） |
| Audit | 含 principalId、mandateId、toolId=`ingest_pcf_payload`、decision、policyId |
| Staging | **未**寫入可用 StagingRecord（或標 `REJECTED`） |

### 對照六要點

| 要點 | 本幕證明 |
|------|----------|
| Principal | audit／頂欄顯示代表誰 |
| Authorization | 主控版「授權有效」；詳細控制左欄 mandate 要求品質欄位齊全才可入庫 |
| Tool / Action | 呼叫 `ingest_pcf_payload` |
| Policy Gate | 品質失敗 → deny，不進「半採用」 |
| Audit Log | 主控版最近 3 筆／詳細控制右欄完整列表可追溯 |
| Expiry / Revocation | （本幕不演） |

### 備援（若失敗）

| 狀況 | 怎麼講／怎麼做 |
|------|----------------|
| API 無回應 | 「後端短暫中斷；評審請看右欄既有 audit／錄影備援。」 |
| 誤選合格 payload | 立刻改選缺欄 fixture，重跑 |
| 被問「是不是真 CBAM」 | 「V1 是草稿閘門＋fixture；我們演示的是**拒收邊界**，不是官方 registry。」 |

---

## 幕二｜合格入庫後申報 HITL（1:50–3:30）

### 說什麼

> 「第二幕：先入庫合格 PCF，再提議寫入 CBAM 草稿。Agent **不能直接 commit**，只能 `submit_cbam_draft`；Policy Gate 給 `PENDING_HUMAN`，合規角色核准一次，才由 Human 通道 `commit_cbam_draft`。」

### 點什麼（逐步）

1. （可選）`request_emissions` 向合格供應商索取  
2. `ingest_pcf_payload`（完整品質欄位）→ `ALLOW`，寫入 Staging  
3. 點 **提交 CBAM 草稿**（`submit_cbam_draft`）——**不要**說「Agent 已申報」  
4. 指 **主控版待核准橫幅** 或詳細控制待核准區：decision=`PENDING_HUMAN`、policyId=`POL-HITL-010`  
5. 在橫幅或詳細控制點 **確認寫入草稿** → Human 觸發 `commit_cbam_draft`  
6. 切 **詳細控制** 指 audit：pending → approved → committed（非真 registry）

### 螢幕應出現

| 步驟 | decision | policyId（示意） | 其他 |
|------|----------|------------------|------|
| ingest（合格） | `ALLOW` | 步驟 6／選配 | StagingRecord 可用 |
| submit_cbam_draft | `PENDING_HUMAN` | `POL-HITL-010` | 建立 approvalId；**尚未 commit** |
| approve + commit | 核准／寫入紀錄 | `POL-HITL-010` 相關 | CbamDraft 建立；mock 標記 |
| （若 Agent 直呼 commit） | 應不可／`DENY_POLICY` | `POL-GATE-000` | 左欄顯示該 tool 未暴露 |

### 對照六要點

| 要點 | 本幕證明 |
|------|----------|
| Authorization | allow 不含自動 commit；approvalRoles |
| Tool / Action | `submit_cbam_draft` ≠ `commit_cbam_draft` |
| Policy Gate | L3 → 人類佇列 |
| Audit Log | pending → approved → commit 可串 |
| Principal | 核准人角色與 actor 可區分 |

### 備援

| 狀況 | 怎麼講／怎麼做 |
|------|----------------|
| 直接 ALLOW submit | **嚴重**：停口、改講「正確應為 PENDING」；切備援錄影 |
| 核准按鈕無效 | 用 API：`POST /api/approvals/:id/approve` |
| 時間不夠 | 跳過 request_emissions，直接合格 ingest → submit |
| 被問真 registry | 「刻意 mock；企業接線是內部草稿庫／簽核 webhook。」 |

---

## 幕三｜撤銷後不能用（3:30–4:30）

### 說什麼

> 「第三幕：資料分享可撤銷。人類一撤，該批 PCF **不得再用於申報**——Agent 不能靠『我還記得舊噸數』繼續 submit。」

### 點什麼（逐步）

1. 切 **詳細控制**，選供應商後點 **撤銷分享**（`revoke_data_share`；人類按鈕）  
2. 指主控版供應商卡：分享已撤銷  
3. 再點 `submit_cbam_draft`（或 ingest 後再用同一 payload）  
4. 指主控版最近動作或詳細控制 audit：decision=`DENY_REVOKED`（或同等）+ policyId=`POL-REV-010`

### 螢幕應出現

| 欄位 | 期望 |
|------|------|
| share／payload | 已撤銷／不可用 |
| 撤銷後 submit／commit | `DENY_REVOKED` 或 `DENY_CONSTRAINT`（依實作，**必須**擋） |
| policyId | `POL-REV-010` |
| 待核准佇列 | 若有 PENDING → 已作廢／不可再批 |
| Audit | 撤銷事件 + 後續 deny 事件 |

（可選加強）同時演示 Mandate 本體撤銷 → `POL-AUTH-001` 全拒。

### 對照六要點

| 要點 | 本幕證明 |
|------|----------|
| Expiry / Revocation | 本幕主軸（資料分享撤銷） |
| Policy Gate | 撤銷檢查優先／約束層擋用 |
| Audit Log | 撤銷可追溯 |
| Authorization | 失效後允許清單／已入庫數據不可再用 |

### 備援

| 狀況 | 怎麼講／怎麼做 |
|------|----------------|
| 撤銷後仍可 submit | **嚴重**：立即改口「這是 bug；規格要求不可用」；展示 SPEC |
| 找不到撤銷鈕 | 呼叫對應 API 後刷新 session |
| 評審問「如何恢復」 | 「V1 不自行恢復同一 share；須重新授權——防止 Agent 繞過撤銷。」 |

---

## 4:30–5:00｜收束（說什麼）

> 「六要點我們都演到了：代表誰、授權什麼、工具邊界、Policy Gate、Audit、撤銷。  
> 刻意不做真 CBAM registry 與碳權避險；V1 是 fixture，但 **schema 與 policyId 就是企業串接契約**。  
> Mandate：碳數據可以自動蒐集，**寫入與再用必須可執行信任邊界。**」

停麥；準備問答（備答見 STRATEGY §5、§6）。

---

## 六要點總表（評審追問用）

| 要點 | Demo 哪裡看到 | 典型 policyId／物件 |
|------|----------------|---------------------|
| Principal | 頂欄＋每筆 audit | principalId / agentId / actorId |
| Authorization | 詳細控制左欄矩陣＋幕二角色 | Mandate allow/deny |
| Tool / Action | 主控版 AI／詳細控制按鈕＝toolId | PERMISSION_MATRIX |
| Policy Gate | 三幕 decision | POL-CARB-001 / POL-HITL-010 |
| Audit Log | 主控版最近動作／詳細控制右欄 | event + policyId |
| Expiry / Revocation | 幕三 | POL-REV-010 / POL-AUTH-001 |

---

## 現場 Checklist（開演前 2 分鐘）

- [ ] 瀏覽器開 http://127.0.0.1:3847/ 預設為 **主控版**  
- [ ] 伺服器健康；`GET /api/session` 回 active mandate 且含 `supplierPipeline`  
- [ ] Fixture：至少一合格 PCF、一缺欄「漂亮噸數」  
- [ ] 詳細控制右欄 audit 可清空或已標示「Demo 起點」  
- [ ] 備援：三幕截圖或 60 秒錄影在第二裝置  
- [ ] Governance Gap Memo／PERMISSION 投影快捷鍵就緒  

---

## 計時口令（給操作搭檔）

| 口令 | 含義 |
|------|------|
| 「閘門」 | 幕一 ingest 漂亮噸數 |
| 「人審」 | 幕二 submit_cbam_draft |
| 「撤」 | 幕三 revoke_data_share |
| 「切備援」 | 立刻改錄影／截圖，口頭不冷場 |
