# Governance Gap Memo — Mandate

**產品**：Mandate（CBAM／嵌入排放 碳數據信任閘門 Agent）  
**用途**：可信 AI 黑客松正式交件「一頁」治理／信任設計說明  
**對齊**：官方六信任要點  
**誠實原則**：未做的能力直接標缺口，不以敘事掩蓋

---

## 產品一句話

Mandate 向供應商索取實際嵌入排放，經品質閘入庫；**人類確認後**才寫入 CBAM 草稿並留下帶 `policyId` 的 audit；資料分享一經撤銷，該批數據不得再用於申報。

---

## 六要點對照表

| 要點 | 我們怎麼做 | Demo 哪一幕看得到 | 已知缺口 |
|------|------------|-------------------|----------|
| **1. Principal**<br/>主體／代表誰 | Mandate 綁定 `orgId` + `principalId`（fixture：`org_acme` / `user_buyer_01`）；Agent `agent_mandate_v1` 僅 `onBehalfOf` 該主體；每筆 audit 帶 principal／actor | 開場出示「代表 Acme 合規／買方」的 Mandate 卡片 | **無真 IdP**；身份為 fixture |
| **2. Authorization**<br/>授權 | Mandate：`allowedTools`／`deniedTools`／`deniedSuppliers`／`expiresAt`／品質約束；deny 優先；資料分享可撤銷 | 左欄工具矩陣；缺欄 ingest 被拒（`POL-CARB-001`） | 授權簽發 UI／多級委派未做；無真 VC 作為授權憑證 |
| **3. Tool / Action**<br/>工具與動作 | `request_emissions`、`ingest_pcf_payload`、`submit_cbam_draft`；LLM **只能提議**；`commit_cbam_draft` **不在 Agent 工具表** | Agent 提議 submit → 系統顯示「非 commit」 | 工具適配層為 stub；無真實供應商 API／CBAM registry |
| **4. Policy Gate**<br/>政策閘門 | 唯一放行點 `PolicyEngine.evaluate`；序 1–6；漂亮噸數拒收（`POL-CARB-001`）；submit **一律 PENDING_HUMAN**（`POL-HITL-010`） | 幕一紅燈拒收；幕二黃燈待核准 | 政策為程式內建，非獨立政策伺服器；無形式化驗證 |
| **5. Audit Log**<br/>稽核軌跡 | 每次 evaluate 寫 `AuditEvent`，**必含 `policyId`**、decision、actor、tool | 右欄指到 `POL-CARB-001`／`POL-HITL-010`／`POL-REV-010` | **非不可竄改 log**；無 WORM／外送 SIEM |
| **6. Expiry / Revocation**<br/>失效／撤銷 | Mandate `expiresAt`／`REVOKED`；`revoke_data_share` → `shareRevoked` 後 **不得再用**（`POL-REV-010`）；作廢 PENDING；不可自行恢復 | 幕三撤銷後再 submit 失敗 | 撤銷通知下游供應商／內部草稿庫未接；無跨系統吊銷傳播 |

---

## 定案約束（本 Memo 重申）

- 產品是**碳數據信任閘門**；碳為主角，**不做**儀表板／碳權避險／真 CBAM registry。  
- deny 優先於 allow；`submit_cbam_draft` 一律人類確認；`commit_cbam_draft` 永不給 Agent。  
- 撤銷後唯有**新授權／新 share** 可恢復作業。

---

## 總結給評審

| 已演示的信任閉環 | 刻意不做／未做完 |
|------------------|------------------|
| 代表誰 → 授權邊界 → 工具提議 → 品質閘＋HITL → 稽核含 policyId → 撤銷即不可用 | 真 IdP、真 PCF／CBAM 生態、不可竄改 log、官方申報通道 |

**一句話缺口**：信任**邏輯與演示路徑完整**；身份來源、資料真實性與稽核完整性仍屬 PoC 級（見 `THREAT_AND_GAPS.md`）。

---

*文件版本 V1｜2026-07-20｜碳主線*
