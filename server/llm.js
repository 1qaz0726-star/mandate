'use strict';

/**
 * LLM proposes only — never grants authority.
 * Returns { reply, tool, args } or { configured:false }.
 */

const ALLOWED_PROPOSE = new Set([
  'request_emissions',
  'fetch_supplier_response',
  'ingest_pcf_payload',
  'submit_cbam_draft',
]);

function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
}

function status() {
  return {
    configured: isConfigured(),
    demoReady: isConfigured(),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  };
}

function buildSystemPrompt(ctx) {
  const suppliers = (ctx.suppliers || [])
    .map(
      (s) =>
        `- ${s.supplierId}｜${s.orgName}｜${s.credentialValid ? '常提供完整碳數據' : '常只回噸數'}｜分享撤銷:${s.shareRevoked ? '是' : '否'}`
    )
    .join('\n');
  const staging = (ctx.staging || [])
    .map(
      (p) =>
        `- ${p.supplierId}｜tCO2e=${p.tCO2e}｜tier=${p.qualityTier || '—'}｜method=${p.method || '—'}`
    )
    .join('\n');
  const requests = (ctx.emissionsRequests || []).join(', ') || '（無）';
  const mandate = ctx.mandate || {};
  return `你是 Mandate 碳資料／貿易合規小助理。你代表「${ctx.orgName || '艾克美工業・貿易合規'}」做事，但你沒有權限自己決定能不能執行——你只能提議工具，真正放行由公司政策引擎決定。

標準流程（索取供應商數據時必須依序）：
1. request_emissions — 向供應商發出請求
2. fetch_supplier_response — 取回供應商回覆的 PCF（不可自己編造欄位）
3. ingest_pcf_payload — 用 fetch 回傳的完整 payload 做品質檢查入庫
4. submit_cbam_draft — 申請寫入 CBAM 草稿（一定會等人類核准）

你可以用的工具（只能從中選，或都不選）：
- request_emissions：向供應商發出排放資料請求。args: { "supplierId": "..." }
- fetch_supplier_response：取回供應商已回覆的 PCF（須先 request）。args: { "supplierId": "..." }
- ingest_pcf_payload：匯入 PCF；必須用 fetch 得到的完整欄位。args: { ...完整 PCF 物件 }
- submit_cbam_draft：提交已 staging 的 CBAM 草稿。args: { "supplierId": "..." }

供應商對照：supplier_unverified_01=無證零件行；supplier_green_01=青禾精密。

禁止：提議 commit_cbam_draft、revoke、export、或任何未列出的工具。不可假裝已提交 CBAM 或已核准。
若政策拒收，用白話解釋「缺什麼、若硬交會怎樣」，不要只重複 policyId。

目前授權狀態：${mandate.status || 'UNKNOWN'}
已索取過的供應商：${requests}
允許工具：${(mandate.allowedTools || []).join(', ') || '（無）'}
供應商清單：
${suppliers || '（無）'}
Staging：
${staging || '（空）'}

回覆必須是單一 JSON 物件（不要 markdown），格式：
{
  "reply": "用人話繁體中文簡短說明你想做什麼、為什麼",
  "tool": "request_emissions" | "fetch_supplier_response" | "ingest_pcf_payload" | "submit_cbam_draft" | null,
  "args": { }
}
若只是打招呼、解釋規則、或任務已完成，tool 設為 null。`;
}

async function propose({ message, context, history }) {
  if (!isConfigured()) {
    return {
      configured: false,
      reply:
        '尚未設定 OPENAI_API_KEY。本地：在 mandate/.env 填入後重啟；線上（Cloudflare）：執行 npx wrangler secret put OPENAI_API_KEY 後再 deploy。亦可直接用「AI 自動演三幕」的按鈕備援（不需 Key）。',
      tool: null,
      args: {},
    };
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const apiKey = process.env.OPENAI_API_KEY.trim();

  const messages = [{ role: 'system', content: buildSystemPrompt(context || {}) }];

  if (Array.isArray(history) && history.length) {
    for (const h of history.slice(-16)) {
      if (h.role === 'user' || h.role === 'assistant') {
        messages.push({ role: h.role, content: String(h.content || '').slice(0, 3000) });
      }
    }
  }

  messages.push({ role: 'user', content: String(message || '').slice(0, 4000) });

  const body = {
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages,
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`LLM 回應不是 JSON：HTTP ${res.status}`);
  }
  if (!res.ok) {
    const errMsg = data?.error?.message || data?.message || `LLM HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  const content = data?.choices?.[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { reply: content, tool: null, args: {} };
  }

  let tool = parsed.tool || null;
  if (tool && !ALLOWED_PROPOSE.has(tool)) {
    return {
      configured: true,
      reply: `${parsed.reply || ''}（模型提議了不允許的工具「${tool}」，已忽略。權限不由模型決定。）`.trim(),
      tool: null,
      args: {},
      modelRejectedTool: tool,
    };
  }

  const args = parsed.args && typeof parsed.args === 'object' ? parsed.args : {};
  return {
    configured: true,
    reply: parsed.reply || '（沒有文字說明）',
    tool,
    args,
    model: data?.model || model,
    usage: data?.usage || null,
  };
}

module.exports = { isConfigured, status, propose, ALLOWED_PROPOSE };
