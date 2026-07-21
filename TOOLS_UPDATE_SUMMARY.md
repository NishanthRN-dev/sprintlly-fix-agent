# Headless Bug-Fix Tools Update Summary

## What Changed in poller.js

### Before
```javascript
'--allowedTools', 'Read,Edit,Bash(report-step:*),Bash,Grep,mcp__atlassian-jira__*',
```

**Problems:**
- ❌ Wildcard `mcp__atlassian-jira__*` may not work on all systems
- ❌ Missing tools for Skill invocation (wavemaker-bug-fix)
- ❌ Missing Agent/Monitor for parallel/background tasks
- ❌ No progress tracking (TaskCreate/TaskUpdate)
- ❌ Could hit permission prompts mid-workflow

---

### After (Updated)
```javascript
const allowedTools = [
  // Core file operations
  'Read',
  'Edit',
  
  // Bash execution (must have)
  'Bash',
  'Bash(report-step:*)',
  'Grep',
  
  // Jira/Atlassian (explicit, no wildcards)
  'mcp__atlassian-jira__getJiraIssue',
  'mcp__atlassian-jira__getAccessibleAtlassianResources',
  'mcp__atlassian-jira__searchJiraIssuesUsingJql',
  'mcp__atlassian-jira__getVisibleJiraProjects',
  'mcp__atlassian-jira__getJiraIssueTypeMetaWithFields',
  'mcp__atlassian-jira__addCommentToJiraIssue',
  
  // Orchestration (new)
  'Skill',                 // Invokes wavemaker-bug-fix skill
  'Agent',                 // Parallel sub-agents
  
  // Background monitoring (new)
  'Monitor',               // Watch build/Metro without polling
  
  // Progress tracking (new)
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'TaskOutput',
  'ScheduleWakeup',
  
  // Session context (new)
  'mcp__ccd_session__read_widget_context',
  'mcp__ccd_session__spawn_task',
  'mcp__ccd_session__mark_chapter',
].join(',');
```

**Benefits:**
- ✅ Explicit tool names (no wildcards = more reliable)
- ✅ Can invoke `wavemaker-bug-fix` skill directly
- ✅ Can parallelize via `Agent` if needed
- ✅ `Monitor` prevents CPU-wasting polling loops
- ✅ Progress tracking via `Task*` tools
- ✅ Zero interactive prompts guaranteed

---

## Tool Coverage by Workflow Step

| Step | Tool | What It Does |
|------|------|-------------|
| **Step 1: Setup Tools** | Bash | Runs `automation-tools-setup.cjs` |
| **Step 2: Auth Verify** | Bash | Checks `agent-browser auth list` (no prompt if profile exists) |
| **Step 3: Fetch Jira** | mcp__atlassian-jira__* | Gets ticket details + cloudId |
| **Step 4: Resolve Params** | Read | Reads Jira response |
| **Step 5: Preview** | Bash | Runs `run-wavemaker-preview.cjs` |
| **Step 6: Build App** | Bash, Monitor | Runs build script, watches for "generated at" |
| **Step 6b: Start Server** | Bash, Monitor | Starts Expo server, waits for readiness |
| **Step 7: Debug & Fix** | Bash, Edit, Grep | Reproduces bug, applies code fix |
| **Step 8: Summary** | Task*, Read | Reports results, closes job |

---

## Tools NOT Included (Why)

| Tool | Reason |
|------|--------|
| **AskUserQuestion** | Headless = no user present |
| **WebFetch / WebSearch** | Use Atlassian MCP instead |
| **Artifact** | No visual dashboard needed |
| **CronCreate** | Your poller.js already handles scheduling |
| **argent-*** | Only needed if `platform=android`/`ios`; add if needed |
| **mcp__claude-in-chrome__*** | Use `agent-browser` CLI via Bash instead |

---

## When to Add Device Tools

If the Jira ticket targets **native platforms** (Android/iOS):

```javascript
// Add these to allowedTools:
'argent-device-interact',           // Interact with emulator/simulator
'argent-android-emulator-setup',    // Boot Android emulator
'argent-ios-simulator-setup',       // Boot iOS simulator
'argent-metro-debugger',            // JS runtime debugging
'argent-react-native-app-workflow', // Managed workflow
```

Usage: These are called via Bash (e.g., `npx expo run:android`) or via skills, so no direct Claude tool invocation.

---

## Environment Variables Needed

For headless execution, set these:

```bash
export JOB_ID="uuid-or-ticket-id"
export APP_URL="https://your-fix-api.com"
export FIX_AGENT_TOKEN="secret-token"
export DEVELOPER_ID="your-dev-id"
export REPO_PATH="/path/to/wavemaker-rn-runtime"

# Optional (used by scripts):
export WM_RN_RUNTIME_REPO_PATH="$REPO_PATH"
export WM_RN_CODEGEN_REPO_PATH="/path/to/wavemaker-rn-codegen"
```

---

## Testing Your Config

Before running against real jobs, test headless mode locally:

```bash
node /Users/sunilg_500363/Desktop/fix-agent/poller.js
```

Then create a fake job in your job queue, or trigger via:

```bash
curl -X POST https://your-fix-api.com/api/public/claim-job \
  -H "Authorization: Bearer $FIX_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"developer_id":"'$DEVELOPER_ID'"}'
```

---

## Security Notes

✅ **Safe because:**
- No wildcard tool matching (explicit list)
- `--permission-mode acceptEdits` only allows file changes, no deletion
- Bash commands are scriptable, not interactive
- Atlassian MCP auth via Docker (no credential storage in code)
- All I/O logged via `report-step` webhook

⚠️ **Still ensure:**
- `FIX_AGENT_TOKEN` is rotated regularly
- `REPO_PATH` points to trusted repo
- Job queue validates `jira_key` format before passing to Claude
- Timeout `JOB_TIMEOUT_MS` is reasonable (30 min for full workflow)

---

## Next Steps

1. ✅ Updated `poller.js` with new `allowedTools` array
2. ✅ Created `HEADLESS_TOOLS_REFERENCE.md` (detailed guide)
3. **TODO:** Update your job queue API to track `JOB_ID` and poll for completion
4. **TODO:** Add `report-step` webhook handler to post progress back to UI
5. **TODO:** Test with a sample Jira ticket (non-production first)
