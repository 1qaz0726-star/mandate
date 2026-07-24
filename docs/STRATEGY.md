# Mandate｜報名／評審敘事策略

> 用途：報名摘要、Demo Day 開場、評審問答話術。與 [DECISIONS.md](../DECISIONS.md)、[DEMO_SCRIPT.md](./DEMO_SCRIPT.md) 一致。  
> 對齊來源：[research/hackathon-brief-2026-07-20.md](../../research/hackathon-brief-2026-07-20.md)

---

## 1. 一句話定位

**Mandate 向供應商索取實際嵌入排放，經品質閘後，由人類確認才寫入 CBAM 草稿並留下 audit；分享一旦撤銷，數據不可再用於申報。**

（短版口播）「我們做的是碳數據信任閘門，不是更會填噸數的聊天機器人，也不是碳權避險儀表板。」

---

## 2. 為何是企業痛點

| 痛點 | 現場說法（30 秒內） |
|------|-------------------|
| **假漂亮噸數** | Agent／供應商可交一組看起來完整的 tCO2e，但缺 method、boundary、period、unit、supplierId——買方若直接寫進 CBAM 草稿，風險是**合規假資料入庫**。 |
| **寫入不可逆意圖** | 一旦 Agent 能「代填申報草稿」，風險從答錯變成**擅自提交**；需要 HITL + 可撤銷的資料分享，不是事後補報表。 |

對齊官方參考方向：**供應鏈與貿易金融**（ESG／碳資料可信度、Agent 授權邊界）。碳是主角，不做儀表板／避險產品。

---

## 3. 對齊初選／決選評分

### 初選（報名書面）

| 權重 | 項目 | Mandate 打法 |
|------|------|----------------|
| 50% | 題目相關性 | 標題與摘要先寫「可信 Agent／六要點＋碳數據閘門」，場景鎖 CBAM／嵌入排放 |
| 30% | 可行性 | 鎖死 HTML+CSS+JS + Node policy engine；三幕 Demo 與 policyId 契約已寫死；兩日可展示 |
| 20% | 團隊能力 | 角色建議：信任規格／後端 policy／前端工作台／簡報＋Memo |

報名材料應附：痛點一句、解法一句、三幕 Demo 大綱、（選填）GitHub。

### 決選（Demo Day）

| 權重 | 項目 | Mandate 打法 |
|------|------|----------------|
| 35% | 產業場景契合 | 開場打「漂亮噸數入庫＋擅自寫入 CBAM 草稿」，不先堆技術名詞 |
| 25% | 可信技術導入 | 六要點每項在 Demo／Memo 有對應；權限只在 policy engine；LLM 只提議 |
| 25% | 簡報與 Demo | 5 分鐘演完三幕；螢幕可見 decision + policyId |
| 15% | 洞察與巧思 | 「閘門產品化」：拒收缺欄 → HITL 寫草稿 → 撤銷即不可用；誠實標示 V1 fixture |

同分決勝：先場景契合，再可信可行性 → **故事與閘門演示優先於炫技**。

---

## 4. 刻意不做清單（對評審說「我們砍什麼」）

向評審主動說出範圍，換取可行性分數與信任：

1. **不做**真 CBAM 官方 registry／海關申報通道  
2. **不做**碳權避險、碳費套利、儀表板主軸  
3. **不做**完整第三方 PCF 核算引擎  
4. **不做**多 Agent 編排  
5. **不做**由 LLM 自行決定權限（模型只能提議 tool）  
6. **不做**用聊天紀錄代替 Audit Log  
7. **不做**讓 Agent 呼叫 `commit_cbam_draft`

一句收束：「兩日內我們演示的是**可執行的碳數據信任邊界**，不是完整 CBAM 合規產品。」

**台灣落地誠實表述**：通過品質閘 ≠ 通過查驗 ≠ 免 CBAM 預設值；台灣碳費／試申報欄位 V1 未完整對接。另提供**供應商自查**（貼 JSON 檢查）給被客戶催交的小廠。

---

## 5. 企業串接：誠實表述

| 可說 | 不可說 |
|------|--------|
| Mandate／Approval／Audit／PcfPayload **schema 可接** 供應商 API、簽核 webhook、內部草稿庫 | 「已串歐盟 CBAM registry／真實海關」 |
| V1 用 **fixture** 跑通品質閘、HITL、撤銷 | 「已驗證真實第三方 PCF／已上線合規」 |
| 上線路徑：換資料來源、換簽核、audit 落持久化 | 「已是合規產品／已通過資安認證」 |

評審問「怎麼落地？」標準答：  
「比賽交的是**規格完整＋可跑 PoC**；企業接線點是資料模型與 policyId，不是重寫 Agent。」

---

## 6. 六要點一句對照（簡報備忘）

| 要點 | Mandate 一句 |
|------|----------------|
| Principal | Agent 代表買方法人（如 Acme），由人類 actor 授權，不可自稱法人本人 |
| Authorization | Mandate：允許索取／入庫／提議草稿；deny 優先；資料分享可撤銷 |
| Tool / Action | 工具矩陣；一 HTTP = 一 tool = 一 audit；`commit_cbam_draft` 不暴露給 Agent |
| Policy Gate | evaluate 唯一放行；品質閘 POL-CARB-001；submit 一律 PENDING_HUMAN |
| Audit Log | append-only；必含 decision + policyId |
| Expiry / Revocation | 分享撤銷後該批數據不可再用（POL-REV-010）；Mandate 撤銷／過期全拒 |

---

## 7. Governance Gap Memo 策略

- 正式交件一頁；六格對應六要點  
- 每格：**怎麼做／Demo 哪一幕看得到／V1 缺口**  
- 與畫面共用同一組 `policyId`，避免「簡報有、系統無」
