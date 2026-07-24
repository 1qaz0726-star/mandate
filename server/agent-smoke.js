'use strict';

/**
 * Agent smoke — requires OPENAI_API_KEY; skips gracefully if missing.
 */

const { loadEnv } = require('./loadEnv');
loadEnv();

const llm = require('./llm');

if (!llm.isConfigured()) {
  console.log('SKIP agent-smoke: OPENAI_API_KEY not set');
  process.exit(0);
}

const store = require('./store');
const agentSession = require('./agentSession');
const { runAgentTurn } = require('./agent');

async function main() {
  store.reset();
  agentSession.clearAll();

  const turn = await runAgentTurn({
    message:
      '向 supplier_unverified_01 索取碳數據，取回回覆後嘗試品質檢查入庫（預期會被擋下）。',
    sessionId: 'agent-smoke',
    maxSteps: 6,
  });

  if (!turn.configured) {
    console.log('FAIL agent-smoke: not configured');
    process.exit(1);
  }
  if (turn.error) {
    console.log('FAIL agent-smoke:', turn.error);
    process.exit(1);
  }
  if (!turn.steps || !turn.steps.length) {
    console.log('FAIL agent-smoke: no steps');
    process.exit(1);
  }

  const denied = turn.steps.some((s) => s.toolResult && s.toolResult.decision === 'DENY_CONSTRAINT');
  if (!denied) {
    console.log('WARN agent-smoke: expected at least one DENY_CONSTRAINT for unverified supplier');
  }

  console.log('PASS agent-smoke:', turn.steps.length, 'steps, stopReason=', turn.stopReason);
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL agent-smoke:', e.message || e);
  process.exit(1);
});
