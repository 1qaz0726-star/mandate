'use strict';

const llm = require('./llm');
const store = require('./store');
const agentSession = require('./agentSession');
const { invokeTool } = require('./toolRuntime');

const DEFAULT_MAX_STEPS = 8;

function buildContext() {
  const session = store.getSession();
  const suppliers = store.listSuppliers();
  const audit = store.getAudit();
  return {
    orgName: session.org?.displayName,
    mandate: session.mandate,
    suppliers,
    staging: session.staging,
    emissionsRequests: session.emissionsRequests || [],
    recentAudit: audit.slice(-8).map((e) => ({
      toolName: e.toolName,
      decision: e.decision,
      policyId: e.policyId,
      supplierId: e.inputRedacted?.supplierId,
    })),
  };
}

function buildAgentActor(session) {
  return {
    actorId: session.agent?.agentId || 'agent_mandate_v1',
    actorType: 'AGENT',
    onBehalfOf: session.principal?.principalId,
  };
}

async function runAgentTurn({ message, sessionId = 'default', maxSteps = DEFAULT_MAX_STEPS }) {
  if (!String(message || '').trim()) {
    return { configured: llm.isConfigured(), error: 'message required' };
  }

  agentSession.appendMessage(sessionId, 'user', String(message).trim());

  if (!llm.isConfigured()) {
    const reply =
      '尚未設定 OPENAI_API_KEY。本地用 .env；Cloudflare 用 wrangler secret put OPENAI_API_KEY。或先用左邊按鈕操作。';
    agentSession.appendMessage(sessionId, 'assistant', reply);
    return { configured: false, reply, tool: null, steps: [] };
  }

  const history = agentSession.getHistory(sessionId);
  const steps = [];
  let lastReply = '';
  let pendingApproval = null;
  let stopReason = null;

  for (let i = 0; i < maxSteps; i += 1) {
    const context = buildContext();
    let proposal;
    try {
      proposal = await llm.propose({
        message: i === 0 ? message : '繼續完成上一個任務（若已完成請 tool=null 並總結）。',
        history: history.concat(
          steps.flatMap((s) => [
            { role: 'assistant', content: JSON.stringify({ reply: s.reply, tool: s.tool, args: s.args }) },
            { role: 'user', content: `工具結果：${JSON.stringify(s.toolResult || {})}` },
          ])
        ),
        context,
      });
    } catch (e) {
      const session = store.getSession();
      const actor = buildAgentActor(session);
      store.appendAudit({
        principalId: session.principal?.principalId,
        actorId: actor.actorId,
        actorType: actor.actorType,
        toolName: 'llm_propose',
        decision: 'ERROR',
        policyId: null,
        reason: e.message || String(e),
        eventKind: 'LLM_ERROR',
      });
      return {
        configured: true,
        error: e.message || String(e),
        steps,
        reply: lastReply,
      };
    }

    lastReply = proposal.reply || '';
    const step = {
      step: i + 1,
      reply: proposal.reply,
      tool: proposal.tool,
      args: proposal.args || {},
      toolResult: null,
    };

    if (!proposal.tool) {
      steps.push(step);
      stopReason = 'no_tool';
      break;
    }

    const cleanInput = { ...(proposal.args || {}) };
    if (cleanInput.tCO2e != null) cleanInput.tCO2e = Number(cleanInput.tCO2e);
    if (cleanInput.emissionPerUnit != null) {
      cleanInput.emissionPerUnit = Number(cleanInput.emissionPerUnit);
    }

    if (proposal.tool === 'ingest_pcf_payload') {
      const sid = cleanInput.supplierId;
      const needsPayload =
        sid &&
        (cleanInput.tCO2e == null ||
          !cleanInput.method ||
          !cleanInput.boundary ||
          !cleanInput.period ||
          !cleanInput.unit);
      if (needsPayload) {
        const fixture = store.getPcfPayload(sid);
        if (fixture) {
          Object.assign(cleanInput, fixture, { supplierId: sid });
        }
      }
    }

    const session = store.getSession();
    const actor = buildAgentActor(session);
    const invoked = invokeTool(proposal.tool, cleanInput, actor, null);
    step.toolResult = { httpStatus: invoked.httpStatus, ...invoked.body };
    steps.push(step);

    if (invoked.body.decision === 'PENDING_HUMAN') {
      pendingApproval = invoked.body.approval;
      stopReason = 'pending_human';
      break;
    }
    if (invoked.body.decision !== 'ALLOW') {
      stopReason = 'denied';
      break;
    }
  }

  if (!stopReason && steps.length >= maxSteps) {
    stopReason = 'max_steps';
  }

  const finalReply =
    lastReply +
    (stopReason === 'denied' && steps.length
      ? `\n\n（政策引擎已擋下：${steps[steps.length - 1].toolResult?.plainReason || ''}）`
      : '') +
    (stopReason === 'pending_human'
      ? '\n\n（已暫停：等待合規主管確認才能寫入申報草稿。）'
      : '');

  agentSession.appendMessage(sessionId, 'assistant', finalReply);

  return {
    configured: true,
    reply: finalReply,
    steps,
    pendingApproval,
    stopReason,
    executed: steps.some((s) => s.tool),
    note: '模型只能提議；是否放行由 PolicyEngine 決定。',
  };
}

const DEMO_MESSAGES = [
  '請向「無證零件行」（supplier_unverified_01）索取碳數據，取回回覆後做品質檢查並入庫。',
  '請向「青禾精密」（supplier_green_01）索取碳數據，取回回覆、通過品質檢查後，申請寫入 CBAM 申報草稿。',
  '青禾精密（supplier_green_01）的數據分享已撤銷，請再試一次申請寫入申報草稿。',
];

async function runAgentDemo({ sessionId = 'demo' } = {}) {
  agentSession.clearSession(sessionId);
  const acts = [];

  for (let i = 0; i < DEMO_MESSAGES.length; i += 1) {
    if (i === 2) {
      acts.push({
        act: i + 1,
        note: '幕三需先由人類撤銷分享，再由 Agent 重試 submit',
        skipped: true,
      });
      break;
    }
    const turn = await runAgentTurn({
      message: DEMO_MESSAGES[i],
      sessionId,
      maxSteps: 6,
    });
    acts.push({ act: i + 1, message: DEMO_MESSAGES[i], ...turn });
    if (turn.pendingApproval) {
      acts[acts.length - 1].needsApproval = true;
      acts[acts.length - 1].approvalId = turn.pendingApproval.approvalId;
    }
    if (turn.error) break;
  }

  return {
    configured: llm.isConfigured(),
    demoReady: llm.isConfigured(),
    acts,
    act3Message: DEMO_MESSAGES[2],
  };
}

module.exports = {
  runAgentTurn,
  runAgentDemo,
  DEMO_MESSAGES,
};
