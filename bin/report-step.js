#!/usr/bin/env node
const APP_URL = 'https://sprintly.wavemaker.com';
const FIX_AGENT_TOKEN = '4c792aaaf75a01e12153259509f461d348a2caff32b01fb95471e26bbbc5b5f4';

const a = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, arr) => {
    if (!v.startsWith('--')) return acc;
    const [key, ...rest] = v.slice(2).split('=');
    if (rest.length) return [...acc, [key, rest.join('=')]];   // --key=value
    return [...acc, [key, arr[i + 1]]];                        // --key value
  }, []));

(async () => {
  const res = await fetch(`${APP_URL}/api/public/report-step`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${FIX_AGENT_TOKEN}`,
    },
    body: JSON.stringify({
      job_id:  process.env.JOB_ID,     // injected by the poller, never in the prompt
      step:    isNaN(Number(a.step)) ? a.step : Number(a.step), // "1".."8", "6b"
      status:  a.status,               // running | completed | failed
      summary: a.summary ?? null,
      error:   a.error ?? null,
      detailed_output:a.output ?? null
    }),
  });

  console.log(`[report-step] step=${a.step} status=${a.status} → ${res.ok ? 'SUCCESS' : 'FAILED'}`);

  if (!res.ok) { console.error(await res.text()); process.exit(1); }
})();
