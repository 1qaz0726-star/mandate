'use strict';

/**
 * Optional Supabase persistence for audit log / approvals / AI conversation history,
 * plus read-back for the "雲端稽核" UI panel. PostgREST over fetch only (no SDK — keeps
 * zero npm deps). Writes are fire-and-forget: the in-memory store.js state is always the
 * source of truth for the running Demo, so a failed/slow write never blocks a caller.
 */

const crypto = require('crypto');

const BOOT_ID = crypto.randomUUID();

function isConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_URL.trim() &&
      process.env.SUPABASE_SERVICE_KEY &&
      process.env.SUPABASE_SERVICE_KEY.trim()
  );
}

function baseUrl() {
  return (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
}

function serviceKey() {
  return (process.env.SUPABASE_SERVICE_KEY || '').trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One retry after a short delay: a cold connection to Supabase can transiently 401
// (observed: "JWT issued at future") or 5xx, on both writes and reads. Used by
// everything below so the "雲端稽核" panel doesn't flake on a click during a demo.
async function withRetry(fn) {
  try {
    return await fn();
  } catch (e) {
    await sleep(400);
    return fn();
  }
}

async function requestJson(path, options = {}) {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey(),
      Authorization: `Bearer ${serviceKey()}`,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    const err = new Error(`Supabase 回應不是 JSON：HTTP ${res.status}`);
    err.httpStatus = res.status;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(data?.message || `Supabase HTTP ${res.status}`);
    err.httpStatus = res.status;
    throw err;
  }
  return data;
}

// Best-effort: failures are swallowed (after one retry) and only logged — callers never
// wait on this or see it throw, since a missing audit row must never block the Demo.
async function postRow(table, row, { onConflict } = {}) {
  if (!isConfigured()) return;
  const qs = onConflict ? `?on_conflict=${onConflict}` : '';
  try {
    await withRetry(() =>
      requestJson(`/rest/v1/${table}${qs}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: onConflict ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
        },
        body: JSON.stringify(row),
      })
    );
  } catch (e) {
    console.warn(`[supabaseSync] ${table} insert failed after retry:`, e && e.message ? e.message : e);
  }
}

function syncAuditEvent(event) {
  if (!event || !isConfigured()) return;
  postRow('audit_log', {
    boot_id: BOOT_ID,
    audit_event_id: event.auditEventId || event.eventId || null,
    ts: event.ts || null,
    org_id: event.orgId || null,
    principal_id: event.principalId || null,
    actor_id: event.actorId || null,
    actor_type: event.actorType || null,
    agent_id: event.agentId || null,
    mandate_id: event.mandateId || null,
    tool_id: event.toolId || null,
    tool_name: event.toolName || null,
    decision: event.decision || null,
    policy_id: event.policyId || null,
    reason: event.reason || null,
    reasoning_summary: event.reasoningSummary || null,
    event_kind: event.eventKind || 'TOOL_DECISION',
    correlation_id: event.correlationId || null,
    approval_id: event.approvalId || null,
    args_digest: event.argsDigest || null,
    input_hash: event.inputHash || null,
    input_redacted: event.inputRedacted || null,
  });
}

function syncApproval(approval) {
  if (!approval || !isConfigured()) return;
  postRow(
    'approvals',
    {
      boot_id: BOOT_ID,
      approval_id: approval.approvalId,
      mandate_id: approval.mandateId || null,
      type: approval.type || null,
      status: approval.status || null,
      requested_by: approval.requestedBy || null,
      approver_id: approval.approverId || null,
      created_at: approval.createdAt || null,
      decided_at: approval.decidedAt || null,
      consumed_at: approval.consumedAt || null,
      policy_id: approval.policyId || null,
      payload: approval.payload || null,
    },
    { onConflict: 'boot_id,approval_id' }
  );
}

function syncMessage(sessionId, message) {
  if (!message || !isConfigured()) return;
  postRow('ai_messages', {
    boot_id: BOOT_ID,
    session_id: sessionId || 'default',
    role: message.role || null,
    content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
    ts: new Date(message.ts || Date.now()).toISOString(),
  });
}

// Reads are on-demand from the "雲端稽核" UI panel, so callers get the real error
// (after one retry) instead of a swallowed one — the panel needs to say *why* it failed.
async function fetchAuditLog({ bootId, limit = 200 } = {}) {
  const id = bootId || BOOT_ID;
  const qs = new URLSearchParams({
    boot_id: `eq.${id}`,
    select: 'id,audit_event_id,ts,tool_name,decision,policy_id,actor_type,event_kind,entry_hash',
    order: 'id.asc',
    limit: String(limit),
  });
  return withRetry(() => requestJson(`/rest/v1/audit_log?${qs.toString()}`));
}

async function verifyAuditChain(bootId) {
  const id = bootId || BOOT_ID;
  return withRetry(() =>
    requestJson('/rest/v1/rpc/mandate_verify_audit_chain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_boot_id: id }),
    })
  );
}

module.exports = {
  isConfigured,
  syncAuditEvent,
  syncApproval,
  syncMessage,
  fetchAuditLog,
  verifyAuditChain,
  BOOT_ID,
};
