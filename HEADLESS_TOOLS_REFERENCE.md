# Headless WaveMaker Bug-Fix Tools Reference

## Overview
This document lists all tools required for running the WaveMaker bug-fix workflow in **headless mode** without interactive prompts.

---

## Tool Categories & Requirements

### 1. File Operations (Essential)

| Tool | Purpose | Used in Steps |
|------|---------|---------------|
| **Read** | Read files from the codebase | 1-8 (reading config, scripts, source code) |
| **Edit** | Modify source code for fixes | 7 (applying bug fixes) |

---

### 2. Script Execution (Essential)

| Tool | Purpose | Used in Steps |
|------|---------|---------------|
| **Bash** | Run automation scripts and commands | 1-8 (setup, build, preview, debugging) |
| **Bash(report-step:*)** | Report progress back to job queue | Throughout (via custom webhook) |
| **Grep** | Search for patterns in code | 7 (debugging, finding root cause) |

**Critical Bash Operations:**
- `node scripts/automation-tools-setup.cjs` (Step 1)
- `agent-browser auth list` (Step 2)
- `node scripts/run-wavemaker-preview.cjs` (Step 5)
- `node scripts/build-wavemaker-app.cjs` (Step 6)
- `npm start -- --web` (Step 6b)
- Device interactions for Step 7

---

### 3. Atlassian/Jira MCP Tools (Essential)

| Tool | Purpose | Used in Steps |
|------|---------|---------------|
| **mcp__atlassian-jira__getJiraIssue** | Fetch ticket details (summary, description, comments) | 3 (primary) |
| **mcp__atlassian-jira__getAccessibleAtlassianResources** | Get Jira cloudId for MCP calls | 3 (prerequisite) |
| **mcp__atlassian-jira__searchJiraIssuesUsingJql** | Search for related or linked issues | 3, 7 (if investigating root cause) |
| **mcp__atlassian-jira__getVisibleJiraProjects** | List available projects | 3 (context) |
| **mcp__atlassian-jira__getJiraIssueTypeMetaWithFields** | Get issue field metadata | 3 (context) |
| **mcp__atlassian-jira__addCommentToJiraIssue** | Post fix summary/comments to ticket | 8 (optional: reporting results) |

**Why each is needed:**
- `getJiraIssue` — Core ticket fetch (non-negotiable)
- `getAccessibleAtlassianResources` — Gets `cloudId` needed for other MCP calls
- `searchJiraIssuesUsingJql` — Find duplicates, related issues, linked bugs
- `getVisibleJiraProjects` — Understand project scope
- `getJiraIssueTypeMetaWithFields` — Fetch custom field info
- `addCommentToJiraIssue` — Report fix completion (for audit trail)

---

### 4. Claude Internal Tools (Recommended)

| Tool | Purpose | Used in Steps |
|------|---------|---------------|
| **Skill** | Invoke `wavemaker-bug-fix` skill for structured workflow | 1-8 (orchestrates entire workflow) |
| **Agent** | Spawn sub-agents for parallel/complex tasks | 7 (optional: parallel debugging) |
| **Monitor** | Watch background processes without polling | 6-7 (monitor build/metro output) |
| **TaskCreate** | Create progress tracking tasks | 1, 8 (for status reporting) |
| **TaskUpdate** | Update task status | Throughout (in_progress → completed) |
| **TaskList** | Query current tasks | 7 (check blockers) |
| **TaskOutput** | Read task output | Throughout (progress polling) |
| **ScheduleWakeup** | Self-schedule next polling round | 8 (if job incomplete) |

**Why each is needed:**
- `Skill` — Encapsulates Steps 1-8 logic
- `Agent` — Parallelize Jira fetch + preview startup
- `Monitor` — Avoid spinning on background build process
- `Task*` — Track workflow progress for external reporting
- `ScheduleWakeup` — Resume if workflow times out

---

### 5. Session/Context Tools (Optional but Recommended)

| Tool | Purpose | Used in Steps |
|------|---------|---------------|
| **mcp__ccd_session__read_widget_context** | Read interactive widget state | 7 (if using visual widgets) |
| **mcp__ccd_session__spawn_task** | Spawn related work as separate task | 8 (if finding additional bugs) |
| **mcp__ccd_session__mark_chapter** | Mark workflow phase transitions | Throughout (for transcript clarity) |

---

### 6. Device/Native Testing Tools (Only if Testing on Device)

If `platform=android` or `platform=ios`, add these tools:

```javascript
// For Android emulator / iOS simulator interaction
'argent-device-interact',
'argent-android-emulator-setup',
'argent-ios-simulator-setup',
'argent-metro-debugger',
'argent-react-native-app-workflow',
'argent-react-native-profiler',

// Via Bash, these are called as:
// argent device-interact ...
// npx expo run:android --device ...
```

---

## Complete Allow-List for poller.js

```javascript
const allowedTools = [
  // File I/O
  'Read',
  'Edit',
  
  // Script execution (essential)
  'Bash',
  'Bash(report-step:*)',        // Custom webhook reporting
  'Grep',
  
  // Atlassian MCP (non-interactive auth via Docker)
  'mcp__atlassian-jira__getJiraIssue',
  'mcp__atlassian-jira__getAccessibleAtlassianResources',
  'mcp__atlassian-jira__searchJiraIssuesUsingJql',
  'mcp__atlassian-jira__getVisibleJiraProjects',
  'mcp__atlassian-jira__getJiraIssueTypeMetaWithFields',
  'mcp__atlassian-jira__addCommentToJiraIssue',
  
  // Skill & orchestration
  'Skill',
  'Agent',
  
  // Background process management
  'Monitor',
  
  // Progress tracking (optional)
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'TaskOutput',
  'ScheduleWakeup',
  
  // Session context (optional)
  'mcp__ccd_session__read_widget_context',
  'mcp__ccd_session__spawn_task',
  'mcp__ccd_session__mark_chapter',
].join(',');
```

---

## Environment Setup for Headless Mode

### Pre-requisites

1. **Node v22.11.0** (verified by scripts)
2. **agent-browser** with saved auth profiles (step 2 won't prompt if profile exists)
3. **Atlassian Docker MCP** for non-interactive Jira auth
4. **WaveMaker environment variables:**
   ```bash
   export WM_RN_RUNTIME_REPO_PATH=...
   export WM_RN_CODEGEN_REPO_PATH=...
   ```

### Configuration

Add to `.claude/settings.json` or pass via `--permission-mode acceptEdits`:

```json
{
  "hooks": [
    {
      "event": "onStart",
      "command": "source ~/.nvm/nvm.sh && nvm use 22.11.0"
    }
  ]
}
```

---

## Tools NOT Needed (and why)

| Tool | Why Excluded |
|------|--------------|
| **AskUserQuestion** | Headless mode has no user input |
| **WebFetch / WebSearch** | Jira fetch via MCP only |
| **Artifact** | No visual output needed |
| **mcp__claude-in-chrome__*** | Browser automation via agent-browser CLI, not MCP |
| **CronCreate / RemoteTrigger** | Already polling via custom poller.js |
| **PushNotification** | Not for headless; report via API instead |

---

## Troubleshooting: Still Getting Blocked?

If Claude prompts for permission despite `--allowedTools`, check:

1. **Tool name mismatch:** Verify exact spelling from `--agent-types` or `/permissions`
2. **Wildcard vs specific:** Use exact tool names, not wildcards (e.g., `mcp__atlassian-jira__getJiraIssue`, not `mcp__atlassian*`)
3. **MCP server available:** Confirm Atlassian Docker MCP is running and registered
4. **Permission hierarchy:** Some tools require parent permissions (e.g., `Bash` parent of `Bash(report-step:*)`)

---

## Performance Notes

- **Steps 6-7 can take 3-10 minutes** (build + test)
- Use `Monitor` instead of polling to avoid wasting CPU
- Set `JOB_TIMEOUT_MS = 30 * 60 * 1000` (30 min) as minimum
- Run in background job queue, not main request handler

---

## Reporting & Audit

Use `report-step` Bash hook to post progress to your job queue:

```bash
# In any step, call:
curl -X POST "$APP_URL/api/public/job-progress" \
  -H "Authorization: Bearer $FIX_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"job_id\": \"$JOB_ID\", \"step\": \"6\", \"status\": \"completed\", \"output\": \"...\"}"
```

This integrates with your poller's job tracking without needing Claude to be aware of the callback.
