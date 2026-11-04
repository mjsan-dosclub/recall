const secret=process.env.CRON_SECRET;
if(!secret)throw new Error('Set CRON_SECRET in .env.local');
const base=process.env.RECALL_LOCAL_URL||'http://127.0.0.1:3000';
async function dispatch(){try{const response=await fetch(`${base}/api/dispatch`,{method:'PUT',headers:{Authorization:`Bearer ${secret}`}});const body=await response.json();if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);console.log(new Date().toISOString(),`Checked ${body.checked}, sent ${body.sent}`);}catch(e){console.error(new Date().toISOString(),e.message)}}
await dispatch();
setInterval(dispatch,60_000);
