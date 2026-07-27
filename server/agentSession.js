'use strict';

const supabaseSync = require('./supabaseSync');

const MAX_HISTORY = 20;

const sessions = new Map();

function getSession(sessionId) {
  const id = sessionId || 'default';
  if (!sessions.has(id)) {
    sessions.set(id, { id, messages: [], updatedAt: Date.now() });
  }
  return sessions.get(id);
}

function appendMessage(sessionId, role, content) {
  const s = getSession(sessionId);
  const message = { role, content, ts: Date.now() };
  s.messages.push(message);
  if (s.messages.length > MAX_HISTORY) {
    s.messages = s.messages.slice(-MAX_HISTORY);
  }
  s.updatedAt = Date.now();
  supabaseSync.syncMessage(sessionId, message);
  return s.messages;
}

function getHistory(sessionId) {
  return getSession(sessionId).messages.slice();
}

function clearSession(sessionId) {
  if (sessionId) {
    sessions.delete(sessionId);
  } else {
    sessions.clear();
  }
}

function clearAll() {
  sessions.clear();
}

module.exports = {
  getSession,
  appendMessage,
  getHistory,
  clearSession,
  clearAll,
};
