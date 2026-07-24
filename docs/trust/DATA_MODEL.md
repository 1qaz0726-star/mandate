# Mandate — Data Model

**文件狀態**：V1 程式契約（JSON Schema 風格說明）  
**原則**：每個 `AuditEvent` 必含 `policyId`；`shareRevoked` 後 payload 不可再用；Agent 工具表不含 `commit_cbam_draft`。

---

## 1. 共用型別

| 型別 | 說明 |
|------|------|
| `ISO8601` | 字串時間 |
| `DecisionCode` | `ALLOW` \| `DENY_REVOKED` \| `DENY_EXPIRED` \| `DENY_POLICY` \| `DENY_CONSTRAINT` \| `PENDING_HUMAN` |
| `MandateStatus` | `ACTIVE` \| `REVOKED` \| `EXPIRED` |
| `ApprovalStatus` | `PENDING` \| `APPROVED` \| `REJECTED` \| `CANCELLED` |
| `ActorType` | `HUMAN` \| `AGENT` \| `SYSTEM` |
| `StagingStatus` | `STAGED` \| `REJECTED` \| `REVOKED_UNUSABLE` |
| `DraftStatus` | `DRAFT` \| `CANCELLED` |

---

## 2. Principal

```json
{
  "$id": "mandate.Principal",
  "type": "object",
  "required": ["principalId", "principalType", "orgId", "roles", "authSource"],
  "properties": {
    "principalId": { "type": "string" },
    "principalType": { "enum": ["USER", "ORG", "SERVICE"] },
    "orgId": { "type": "string" },
    "displayName": { "type": "string" },
    "roles": {
      "type": "array",
      "items": { "type": "string" },
      "description": "buyer | compliance | approver | admin"
    },
    "authSource": { "type": "string", "description": "fixture | idp" }
  }
}
```

### V1 Fixture — Principal

```json
{
  "principalId": "user_buyer_01",
  "principalType": "USER",
  "orgId": "org_acme",
  "displayName": "Buyer One",
  "roles": ["buyer", "compliance"],
  "authSource": "fixture"
}
```

Approver：

```json
{
  "principalId": "user_approver_01",
  "principalType": "USER",
  "orgId": "org_acme",
  "displayName": "Approver One",
  "roles": ["approver", "admin"],
  "authSource": "fixture"
}
```

---

## 3. Mandate

```json
{
  "$id": "mandate.Mandate",
  "type": "object",
  "required": [
    "mandateId",
    "orgId",
    "principalId",
    "agentId",
    "status",
    "issuedAt",
    "expiresAt",
    "allowedTools",
    "deniedTools",
    "deniedSuppliers",
    "constraints"
  ],
  "properties": {
    "mandateId": { "type": "string" },
    "orgId": { "type": "string" },
    "principalId": { "type": "string" },
    "agentId": { "type": "string", "const": "agent_mandate_v1" },
    "status": { "enum": ["ACTIVE", "REVOKED", "EXPIRED"] },
    "issuedAt": { "type": "string", "format": "date-time" },
    "expiresAt": { "type": "string", "format": "date-time" },
    "revokedAt": { "type": ["string", "null"] },
    "revokeReason": { "type": ["string", "null"] },
    "allowedTools": {
      "type": "array",
      "items": { "type": "string" },
      "description": "不得包含 commit_cbam_draft"
    },
    "deniedTools": { "type": "array", "items": { "type": "string" } },
    "deniedSuppliers": { "type": "array", "items": { "type": "string" } },
    "constraints": {
      "type": "object",
      "required": ["requirePcfQualityFields"],
      "properties": {
        "requirePcfQualityFields": { "type": "boolean", "const": true },
        "allowedBoundaries": {
          "type": "array",
          "items": { "type": "string" },
          "description": "選配：允許的系統邊界"
        }
      }
    },
    "version": { "type": "integer", "minimum": 1 }
  }
}
```

### 不變式

1. `allowedTools` ∩ {`commit_cbam_draft`} = ∅  
2. `status=REVOKED` 後不可再變 `ACTIVE`（須新 `mandateId`）  
3. `deniedTools` 優先於 `allowedTools`  
4. `orgId` 必須與 Principal.orgId 一致  

### V1 Fixture — Mandate

```json
{
  "mandateId": "mandate_acme_carbon_01_v1",
  "orgId": "org_acme",
  "principalId": "user_buyer_01",
  "agentId": "agent_mandate_v1",
  "status": "ACTIVE",
  "issuedAt": "2026-07-20T00:00:00+08:00",
  "expiresAt": "2026-12-31T23:59:59+08:00",
  "revokedAt": null,
  "revokeReason": null,
  "allowedTools": [
    "request_emissions",
    "fetch_supplier_response",
    "ingest_pcf_payload",
    "submit_cbam_draft"
  ],
  "deniedTools": ["export_sensitive"],
  "deniedSuppliers": ["supplier_blocked_99"],
  "constraints": {
    "requirePcfQualityFields": true,
    "allowedBoundaries": ["cradle-to-gate", "cradle-to-grave"]
  },
  "version": 1
}
```

---

## 4. PcfPayload（品質最低欄位）

供應商回傳／Agent 入庫的嵌入排放載體。**缺任一最低欄位 → POL-CARB-001 拒收。**

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `method` | string | Y | 核算方法 |
| `boundary` | string | Y | 系統邊界 |
| `period` | object | Y | `{ "start": ISO8601, "end": ISO8601 }` |
| `unit` | string | Y | 功能單位（如 `t product`） |
| `tCO2e` | number | Y | 嵌入排放（有限數字） |
| `supplierId` | string | Y | 供應商 ID |
| `productId` | string | N | 產品／CN 碼等 |
| `cnCode` | string | N | Level 2：CN 碼或產業模板 |
| `emissionPerUnit` | number | N | Level 2：單位產品排放 |
| `verificationStatus` | enum | N | `verified` \| `unverified` \| `in_progress` |
| `verificationReportId` | string | N | 查驗報告 ID；`verified` 時必填 |
| `qualityTier` | enum | N | `COMPLETE` \| `PARTIAL`（系統寫入） |
| `warnings` | string[] | N | Level 2 缺欄警告（系統寫入） |
| `shareId` | string | N | 資料分享識別；撤銷時標記 |
| `shareRevoked` | boolean | Y | 預設 `false`；撤銷後 `true` |
| `receivedAt` | ISO8601 | N | 收到時間 |

```json
{
  "$id": "mandate.PcfPayload",
  "type": "object",
  "required": [
    "method",
    "boundary",
    "period",
    "unit",
    "tCO2e",
    "supplierId",
    "shareRevoked"
  ],
  "properties": {
    "method": { "type": "string", "minLength": 1 },
    "boundary": { "type": "string", "minLength": 1 },
    "period": {
      "type": "object",
      "required": ["start", "end"],
      "properties": {
        "start": { "type": "string", "format": "date-time" },
        "end": { "type": "string", "format": "date-time" }
      }
    },
    "unit": { "type": "string", "minLength": 1 },
    "tCO2e": { "type": "number" },
    "supplierId": { "type": "string", "minLength": 1 },
    "productId": { "type": "string" },
    "shareId": { "type": "string" },
    "shareRevoked": { "type": "boolean" },
    "receivedAt": { "type": "string", "format": "date-time" }
  }
}
```

### Fixture — 合格

```json
{
  "method": "ISO-14067",
  "boundary": "cradle-to-gate",
  "period": {
    "start": "2025-01-01T00:00:00+08:00",
    "end": "2025-12-31T23:59:59+08:00"
  },
  "unit": "t steel",
  "tCO2e": 1.82,
  "supplierId": "supplier_steel_01",
  "productId": "CN_7208",
  "shareId": "share_steel_01_2025",
  "shareRevoked": false
}
```

### Fixture — 漂亮噸數（缺欄，應拒）

```json
{
  "tCO2e": 9999.9,
  "supplierId": "supplier_pretty_tons",
  "shareRevoked": false
}
```

（缺 `method`／`boundary`／`period`／`unit` → `POL-CARB-001`。）

---

## 5. StagingRecord

品質閘通過後的暫存；**未**等於已寫入 CBAM 草稿。

```json
{
  "$id": "mandate.StagingRecord",
  "type": "object",
  "required": [
    "stagingId",
    "mandateId",
    "payload",
    "status",
    "createdAt",
    "createdBy"
  ],
  "properties": {
    "stagingId": { "type": "string" },
    "mandateId": { "type": "string" },
    "payload": { "$ref": "mandate.PcfPayload" },
    "status": { "enum": ["STAGED", "REJECTED", "REVOKED_UNUSABLE"] },
    "createdAt": { "type": "string", "format": "date-time" },
    "createdBy": { "type": "string" },
    "rejectReason": { "type": ["string", "null"] },
    "policyId": { "type": ["string", "null"] }
  }
}
```

不變式：`payload.shareRevoked == true` ⇒ `status` 必須為 `REVOKED_UNUSABLE`（或同等不可用）。

---

## 6. CbamDraft

人類核准並 `commit_cbam_draft` 後寫入；**非**官方 registry 物件。

```json
{
  "$id": "mandate.CbamDraft",
  "type": "object",
  "required": [
    "draftId",
    "mandateId",
    "stagingId",
    "status",
    "committedAt",
    "committedBy",
    "approvalId",
    "snapshot"
  ],
  "properties": {
    "draftId": { "type": "string" },
    "mandateId": { "type": "string" },
    "stagingId": { "type": "string" },
    "status": { "enum": ["DRAFT", "CANCELLED"] },
    "committedAt": { "type": "string", "format": "date-time" },
    "committedBy": { "type": "string", "description": "Human actorId" },
    "approvalId": { "type": "string" },
    "snapshot": { "$ref": "mandate.PcfPayload" },
    "registryHint": {
      "type": "string",
      "description": "V1 固定 mock_cbam_draft_store"
    }
  }
}
```

---

## 7. Approval

```json
{
  "$id": "mandate.Approval",
  "type": "object",
  "required": [
    "approvalId",
    "mandateId",
    "type",
    "status",
    "requestedBy",
    "createdAt",
    "payload"
  ],
  "properties": {
    "approvalId": { "type": "string" },
    "mandateId": { "type": "string" },
    "type": { "enum": ["CBAM_DRAFT", "EXPORT", "DATA_SHARE_REVOKE"] },
    "status": { "enum": ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] },
    "requestedBy": { "type": "string" },
    "approverId": { "type": ["string", "null"] },
    "createdAt": { "type": "string", "format": "date-time" },
    "decidedAt": { "type": ["string", "null"] },
    "consumedAt": {
      "type": ["string", "null"],
      "description": "commit_cbam_draft 成功後寫入"
    },
    "policyId": { "type": "string", "description": "如 POL-HITL-010" },
    "payload": {
      "type": "object",
      "properties": {
        "toolName": { "type": "string" },
        "stagingId": { "type": "string" },
        "shareId": { "type": "string" },
        "supplierId": { "type": "string" }
      }
    }
  }
}
```

### Fixture — PENDING CBAM 草稿

```json
{
  "approvalId": "appr_cbam_0001",
  "mandateId": "mandate_acme_carbon_01_v1",
  "type": "CBAM_DRAFT",
  "status": "PENDING",
  "requestedBy": "agent_mandate_v1",
  "approverId": null,
  "createdAt": "2026-07-20T10:00:00+08:00",
  "decidedAt": null,
  "consumedAt": null,
  "policyId": "POL-HITL-010",
  "payload": {
    "toolName": "submit_cbam_draft",
    "stagingId": "stg_0001",
    "shareId": "share_steel_01_2025",
    "supplierId": "supplier_steel_01"
  }
}
```

---

## 8. AuditEvent

```json
{
  "$id": "mandate.AuditEvent",
  "type": "object",
  "required": [
    "auditEventId",
    "ts",
    "principalId",
    "actorId",
    "actorType",
    "toolName",
    "decision",
    "policyId"
  ],
  "properties": {
    "auditEventId": { "type": "string" },
    "ts": { "type": "string", "format": "date-time" },
    "orgId": { "type": "string" },
    "principalId": { "type": "string" },
    "actorId": { "type": "string" },
    "actorType": { "enum": ["HUMAN", "AGENT", "SYSTEM"] },
    "mandateId": { "type": ["string", "null"] },
    "toolName": { "type": "string" },
    "decision": {
      "enum": [
        "ALLOW",
        "DENY_REVOKED",
        "DENY_EXPIRED",
        "DENY_POLICY",
        "DENY_CONSTRAINT",
        "PENDING_HUMAN"
      ]
    },
    "policyId": { "type": "string" },
    "reason": { "type": "string" },
    "correlationId": { "type": "string" },
    "approvalId": { "type": ["string", "null"] },
    "stagingId": { "type": ["string", "null"] },
    "inputRedacted": { "type": "object" }
  }
}
```

---

## 9. EvaluateContext / Agent

```json
{
  "agentId": "agent_mandate_v1",
  "agentVersion": "1.0.0",
  "llmRole": "propose_only",
  "allowedTools": [
    "request_emissions",
    "ingest_pcf_payload",
    "submit_cbam_draft"
  ]
}
```

---

## 10. 識別子一覽（V1 Demo）

| 名稱 | Fixture 值 |
|------|------------|
| org | `org_acme` |
| buyer／compliance | `user_buyer_01` |
| approver | `user_approver_01` |
| agent | `agent_mandate_v1` |
| mandate | `mandate_acme_carbon_01_v1` |
| good supplier | `supplier_steel_01` |
| pretty-tons supplier | `supplier_pretty_tons` |
| good share | `share_steel_01_2025` |

---

## 11. 儲存與關聯（V1）

| 實體 | V1 儲存 | 備註 |
|------|---------|------|
| Mandate / Approval / Audit | 本地 JSON store | 可竄改；見缺口文件 |
| PcfPayload / Staging / CbamDraft | 同 store | 非真 CBAM registry |
| Principal | fixture | 非真 IdP |

```text
Principal 1---* Mandate
Mandate 1---* StagingRecord
StagingRecord 1---0..1 CbamDraft（經 Approval）
Mandate 1---* Approval
Mandate 1---* AuditEvent
PcfPayload.shareRevoked → Staging 不可用 → 擋 submit/commit
```

---

## 12. 版本

| 版本 | 日期 | 說明 |
|------|------|------|
| V1 | 2026-07-20 | PcfPayload／Staging／CbamDraft／shareRevoked |
