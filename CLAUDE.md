# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`fix-agent` is a small polling daemon that claims auto-fix jobs from a remote app (Sprintly, at `APP_URL`) and runs Claude Code as a subprocess to fix the JIRA ticket described in each job, against a local checkout of the target repo. It is not itself a library or web service — it's a long-running local process meant to sit next to a developer's checkout and act as a hands-off fix worker.

## Running

```bash
npm start        # runs `node poller.js`, polls APP_URL every 60s
```

Configuration is via environment variables (see `.env.example`):

- `APP_URL` — base URL of the Sprintly app that hands out jobs and receives step reports
- `FIX_AGENT_TOKEN` — bearer token authorizing both `claim-job` and `report-step` calls
- `DEVELOPER_ID` — identifies this machine/developer when claiming jobs
- `REPO_PATH` — default local path to the repo to fix, used when a claimed job doesn't specify its own `repo_path`

`.env` in this repo already contains real values for this machine (points at `wavemaker-rn-runtime` locally, `sprintly.wavemaker.com`). Treat the token in `.env` as a live secret — never print it or commit it elsewhere.

There is no build step, lockfile-driven install, test suite, or linter configured — `package-lock.json` has no dependencies.

## Architecture

Two pieces, both plain ESM Node scripts (`"type": "module"`), no dependencies:

1. **`poller.js`** — the daemon loop.
   - `loop()` recurses via `setTimeout` (not `setInterval`) after each `tick()` completes, so polls never overlap even if a claim or job takes longer than `POLL_INTERVAL` (60s).
   - `claimNext()` POSTs to `${APP_URL}/api/public/claim-job` with `developer_id`, returns the claimed `job` or `null`.
   - `runClaude(job)` is meant to `spawn('claude', ...)` with a generated prompt referencing `job.jira_key`/`job.description`, and instructs the spawned agent to use `report-step` to report progress. **This function currently has an early `return` right after logging, before `busy = true` and the actual `spawn` call — so no Claude subprocess is ever launched.** This looks like an in-progress debug state, not finished behavior; check with the user/task context before assuming the spawn logic below the `return` is dead code to delete vs. a fix in progress.
   - The spawned subprocess is invoked non-interactively (`-p`, `--output-format stream-json`, `--permission-mode acceptEdits`) with a restricted tool allowlist (`Read,Edit,Bash(report-step:*),Bash,Grep`), and gets `JOB_ID`/`APP_URL`/`FIX_AGENT_TOKEN` injected via `env`, `cwd` set to `job.repo_path ?? REPO_PATH`.
   - `busy` is a module-level guard ensuring only one job runs at a time on this machine; it's reset in both the subprocess's `close` and `error` handlers.

2. **`bin/report-step`** — a standalone executable (the npm `bin` entry) that the spawned Claude subprocess calls (via its `Bash(report-step:*)` allowlisted tool) to report per-step progress back to the app. It parses `--step`/`--status`/`--summary`/`--error` CLI flags itself (no arg-parsing library) and POSTs them to `${APP_URL}/api/public/report-step`, authenticated with the same `FIX_AGENT_TOKEN`, tagged with `JOB_ID` from its environment (deliberately not passed via the prompt text, so the agent can't spoof a different job id).

3. **`reset-job.js`** — a manual/operator CLI, run at the repo root like `poller.js` (npm script `reset-job`, e.g. `npm run reset-job -- --jira_key=ABC-123 --mode=reset`), so it reads `APP_URL`/`FIX_AGENT_TOKEN` from `process.env` the same way `poller.js` does rather than living under `bin/` as a packaged executable. It un-sticks a job claimed via `claim-job`. Once a job is claimed, `claim-job` won't hand it out again until it's completed or reset — this is the "locking mechanism": a job stuck in `running` (e.g. because `runClaude` never actually spawned Claude, see above) makes every subsequent poll return no job. This script POSTs to `${APP_URL}/api/public/reset-job`, same `FIX_AGENT_TOKEN` auth as the other two. Accepts one of `--job_id`, `--todo_id`, or `--jira_key`, plus optional `--mode` (`reset` default, or `delete`).

### Job/report contract with the remote app

- `POST /api/public/claim-job` — body `{ developer_id }`, response `{ job }` where `job` has at least `id`, `jira_key`, `description`, optionally `repo_path`.
- `POST /api/public/report-step` — body `{ job_id, step, status, summary, error }`, where `status` is one of `running | completed | failed`.
- `POST /api/public/reset-job` — body `{ job_id | todo_id | jira_key, mode }`.
  - `mode: "reset"` (default) → `fix_jobs`: `status='queued'`, `current_step=0`, `claimed_by=null`, `attempt_number=1`; `fix_job_steps`: every step back to `pending` with `summary`/`error` cleared.
  - `mode: "delete"` → deletes the `fix_jobs` row (steps cascade); the UI can then queue a brand-new one.

All three endpoints are on the remote Sprintly app (`reset-job` implemented at `src/routes/api/public/reset-job.ts` there) — not in this repo, so there's nothing else to trace locally for their implementation.
