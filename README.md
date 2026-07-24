# Mandate — 碳數據信任閘門 Agent（V1）

可信 AI 黑客松 2026 PoC：Agent 可代為**索取實際嵌入排放**、經**品質閘**入庫；**寫入 CBAM 草稿必須人類核准**；全程稽核；資料分享可撤銷且撤銷後不可用。

權限**不靠模型記住**——唯一放行點是 `PolicyEngine.evaluate`（見 `docs/trust/POLICY_SPEC.md`）。

**一句話**：索取實際嵌入排放 → 品質閘 → 人類確認才寫入 CBAM 草稿 → audit；撤銷後不可用。

## 快速啟動

```bash
cd mandate
npm start
```

瀏覽器開啟 [http://127.0.0.1:3847/](http://127.0.0.1:3847/)

### 可選：接語言模型（API Key）— **Demo 主線建議開啟**

```bash
cd mandate
copy .env.example .env
# 編輯 .env，填入 OPENAI_API_KEY=sk-...
npm start
```

- 支援 OpenAI 或相容端點（可設 `OPENAI_BASE_URL`、`OPENAI_MODEL`）
- **有 Key**：按「AI 自動演三幕」— Agent 依序 索取 → 取回回覆 → 品質檢查 → 申請寫入
- **無 Key**：降級為左欄手動備援三幕
- 中欄可打字跟 Agent 對話；模型**只能提議**工具，放行仍走 `PolicyEngine`
- **勿把 `.env` 提交進 git**

契約煙測：

```bash
npm run smoke          # 9 項 policy 向量
npm run smoke:agent    # 需 Key；無 Key 則 SKIP
```

## Demo 三幕（畫面上按「AI 自動演三幕」）

1. Agent 向無證零件行索取 → 取回 → 品質檢查 → `DENY_CONSTRAINT` / `POL-CARB-001`
2. Agent 向青禾索取 → 入庫 → `submit_cbam_draft` → `PENDING_HUMAN` / `POL-HITL-010` → 人類核准
3. 撤銷分享 → Agent 再申請寫入 → `DENY_REVOKED` / `POL-REV-010`

另：**供應商自查** Tab 可貼 JSON 檢查能不能交；核准後可**匯出給客戶的回覆草稿**。

逐步話術見 [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)。

## 目錄

| 路徑 | 說明 |
|------|------|
| `public/` | HTML + CSS + JS 三欄工作台 |
| `server/` | 純 Node `http` API + policy engine |
| `docs/trust/` | 六信任要點完整規格 |
| `docs/STRATEGY.md` | 報名／評審敘事 |
| `DECISIONS.md` | 已定案事項 |

## 文件優先

| 交件／規格 | 路徑 |
|------------|------|
| Governance Gap Memo | [`docs/trust/GOVERNANCE_GAP_MEMO.md`](docs/trust/GOVERNANCE_GAP_MEMO.md) |
| 信任架構 | [`docs/trust/TRUST_ARCHITECTURE.md`](docs/trust/TRUST_ARCHITECTURE.md) |
| 權限矩陣 | [`docs/trust/PERMISSION_MATRIX.md`](docs/trust/PERMISSION_MATRIX.md) |
| Policy 契約 | [`docs/trust/POLICY_SPEC.md`](docs/trust/POLICY_SPEC.md) |
| 資料模型 | [`docs/trust/DATA_MODEL.md`](docs/trust/DATA_MODEL.md) |

`server/policy.js` 每個分支註解對應 `POL-xxx`；新增規則先改 MD 再改碼。

> 注意：本 README／docs 已定案為碳數據主線；若執行碼仍殘留採購付款工具名，以 **docs 為準**，改碼對齊。

## API 摘要

- `GET /api/session` · `GET /api/audit` · `GET /api/policies`
- `POST /api/tools/:toolId`（`request_emissions`／`fetch_supplier_response`／`ingest_pcf_payload`／`submit_cbam_draft` 等）
- `POST /api/agent/chat` · `POST /api/agent/demo` · `GET /api/agent/status`
- `POST /api/check/pcf`（供應商自查，不寫 staging）
- `GET /api/export/client-draft/:supplierId` · `GET /api/export/audit`
- `POST /api/approvals/:id/approve` · `deny`
- `POST /api/share/revoke`（或同等 `revoke_data_share`）
- `POST /api/mandate/revoke` · `simulate-expiry`
- `POST /api/reset`

Port：**3847**（零 npm 依賴）。

## 刻意不做（V1）

真 CBAM registry／碳權避險／儀表板主軸／讓 LLM 自判權限／Agent 呼叫 `commit_cbam_draft`。
