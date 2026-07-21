#!/usr/bin/env node
// reset-fix-job.js
// Reset a "Fix with AI" job so you can re-test the agent.
//
// Default action DELETES the fix_jobs row (steps cascade). This restores the
// "Fix with AI" button in the UI. Use --requeue to keep the row and hand it
// back to the local poller (stop the poller first!).
//
// Usage:
//   APP_URL=https://sprintly.wavemaker.com \
//   FIX_AGENT_TOKEN=xxxxx \
//   node reset-fix-job.js --jira SPR-123
//   node reset-fix-job.js --job <uuid>
//   node reset-fix-job.js --todo <uuid>
//   node reset-fix-job.js --jira SPR-123 --requeue

const MODE = process.argv.includes("--requeue") ? "requeue" : "delete";

function getArg(key) {
  const idx = process.argv.indexOf(key);
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return null;
}

const APP_URL = process.env.APP_URL;
const FIX_AGENT_TOKEN = process.env.FIX_AGENT_TOKEN;

const jiraKey = getArg("--jira");
const jobId = getArg("--job");
const todoId = getArg("--todo");

if (!APP_URL || !FIX_AGENT_TOKEN) {
  console.error("APP_URL and FIX_AGENT_TOKEN env vars are required");
  process.exit(1);
}

if (!jiraKey && !jobId && !todoId) {
  console.error("Provide one of --jira <KEY>, --job <uuid>, or --todo <uuid>");
  process.exit(1);
}

const key = jiraKey ? "jira_key" : jobId ? "job_id" : "todo_id";
const value = jiraKey || jobId || todoId;

const url = `${APP_URL}/api/public/reset-job`;
const body = JSON.stringify({ [key]: value, mode: MODE });

fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${FIX_AGENT_TOKEN}`,
    "Content-Type": "application/json",
  },
  body,
})
  .then(async (res) => {
    const text = await res.text();
    if (!res.ok) {
      console.error(`HTTP ${res.status}: ${text}`);
      process.exit(1);
    }
    console.log(text);
  })
  .catch((err) => {
    console.error("Request failed:", err.message);
    process.exit(1);
  });