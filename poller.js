import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';

for (const k of ['APP_URL', 'FIX_AGENT_TOKEN', 'DEVELOPER_ID', 'REPO_PATH'])
  if (!process.env[k]) { console.error(`Missing env: ${k}`); process.exit(1); }

const CLAUDE_BIN = process.env.CLAUDE_BIN || `${os.homedir()}/.local/bin/claude`;
const APP_URL = process.env.APP_URL;
const FIX_AGENT_TOKEN = process.env.FIX_AGENT_TOKEN;
const DEVELOPER_ID = process.env.DEVELOPER_ID;
const REPO_PATH = process.env.REPO_PATH;          // where the repo lives locally
const POLL_INTERVAL = 1000 * 10;
const LOCK_DIR = `${os.homedir()}/.fix-agent/locks`;
const MAX_CONCURRENT = 1;

function lockCount() {
  try { return readdirSync(LOCK_DIR).length; }
  catch { return 0; }
}

function writeLock(jobId) {
  mkdirSync(LOCK_DIR, { recursive: true });
  writeFileSync(`${LOCK_DIR}/${jobId}.lock`, '');
}

async function claimNext() {
  console.log("fethcing next jira ticket")
  const res = await fetch(`${APP_URL}/api/public/claim-job`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${FIX_AGENT_TOKEN}`,
    },
    body: JSON.stringify({ developer_id: DEVELOPER_ID }),
  });

  if (!res.ok) {
    console.error('claim-job failed:', res.status, await res.text().catch(() => ''));
    return null;
  }
  const { job } = await res.json();
  return job?.id ? job : null;
}

function runClaude(job) {
  console.log(`<== runClaude has been fired with job ==> ${JSON.stringify(job)}`)
  writeLock(job.id);

  const repoPath = job.repo_path ?? REPO_PATH;
  const lockFile = `${LOCK_DIR}/${job.id}.lock`;

  const prompt =
    `Use the wavemaker-bug-fix skill to debug and fix this bug.\n\n` +
    `Jira: \nhttps://wavemaker.atlassian.net/browse/${job.jira_key}\n\n` +
    `Project: App(project name is App)\n` +
    `Platform: android\n` +
    `Environment: wavemakeronline.com\n` +
    `Auth profile: wm_nishanth_wmo\n` +
    `Prism project: no\n` +
    `Run mode: Expo Go\n` +
    `Extra context:\n` +
    `  - ignore wavamaker-rn-codegen cli puppeteer error\n\n` +
    `Report progress for each step via report-step with JOB_ID=${job.id}.`;

  // Escape single quotes in prompt for AppleScript
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const escapedRepo = repoPath.replace(/'/g, "'\\''");

  const envExports = [
    `export JOB_ID='${job.id}'`,
    `export APP_URL='${APP_URL}'`,
    `export FIX_AGENT_TOKEN='${FIX_AGENT_TOKEN}'`,
  ].join('; ');

  const shellCmd = `${envExports}; trap 'rm -f "${lockFile}"' EXIT; cd '${escapedRepo}' && ${CLAUDE_BIN} --model claude-sonnet-5 --permission-mode auto '${escapedPrompt}'`;

  const script = `tell application "Terminal"
  activate
  do script "${shellCmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"
end tell`;

  const child = spawn('osascript', ['-e', script]);

  child.on('close', (code) => {
    if (code !== 0) console.error(`osascript failed with code ${code}`);
    else console.log(`Terminal opened for job ${job.id}`);
  });

  child.on('error', (err) => {
    console.error(`osascript spawn failed: ${err.message}`);
  });
}

async function tick() {
  if (lockCount() >= MAX_CONCURRENT) {
    console.log("claude is already fixing the jira ticket")
    return;
  }
  const job = await claimNext();
  if (job) runClaude(job);
}

// Recursive timeout — guarantees no overlapping polls, unlike setInterval
async function loop() {
  try { await tick(); } catch (e) { console.error('tick failed:', e); }
  setTimeout(loop, POLL_INTERVAL);
}

console.log(`Polling ${APP_URL} every ${POLL_INTERVAL / 1000}s as ${DEVELOPER_ID}`);
loop();