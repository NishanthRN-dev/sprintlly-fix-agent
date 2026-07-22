# fix-agent

Polling daemon that claims auto-fix jobs from [Sprintly](https://sprintly.wavemaker.com/login) and runs Claude Code to fix the linked JIRA ticket.

## Setup

```bash
cd fix-agent
npm install
npm link              # symlinks bin/report-step onto your global PATH
```

## Environment

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

```env
APP_URL=https://your-lovable-app.example.com
FIX_AGENT_TOKEN=xxxxx
DEVELOPER_ID=suneel
REPO_PATH=/Users/suneel/code/app-rn-runtime
```

## Run (to Start Polling)

```bash
node --env-file=.env poller.js
```

## Reset a stuck job

```bash
npm run reset-job -- --jira WMS-28837
```
