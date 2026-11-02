// Reads incidents live from ServiceNow's Table API and returns them in the same
// 7-field shape as data/incidents.js. Runs on Vercel, so the ServiceNow login
// stays on the server (environment variables) and never reaches the browser.
//
// Environment variables (Vercel > Project > Settings > Environment Variables):
//   SN_INSTANCE  e.g. dev460097.service-now.com   (optional, this is the default)
//   SN_USER      a read-only ServiceNow user, e.g. website_reader
//   SN_PASSWORD  that user's password

const FIELDS = ['number', 'short_description', 'priority', 'state', 'category', 'assignment_group', 'opened_at'];
const TIMEOUT_MS = 8000;

// "1 - Critical" -> "P1" ... "5 - Planning" -> "P5"
const toPriority = (p) => { const m = String(p || '').match(/^\s*(\d)/); return m ? `P${m[1]}` : String(p || ''); };

module.exports = async (req, res) => {
  const instance = (process.env.SN_INSTANCE || 'dev460097.service-now.com').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const user = process.env.SN_USER;
  const pass = process.env.SN_PASSWORD;

  const fail = (status, reason, message) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json({ ok: false, reason, message });
  };

  if (!user || !pass) return fail(503, 'not_configured', 'The ServiceNow login has not been added to Vercel yet.');

  const url = `https://${instance}/api/now/table/incident?` + new URLSearchParams({
    sysparm_fields: FIELDS.join(','),
    sysparm_display_value: 'true',
    sysparm_exclude_reference_link: 'true',
    sysparm_query: 'ORDERBYDESCopened_at',
    sysparm_limit: '5000',
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let r;
  try {
    r = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') },
      redirect: 'manual', // a sleeping developer instance redirects to a "wake up" page
      signal: ctrl.signal,
    });
  } catch (e) {
    return fail(503, 'unreachable', 'ServiceNow did not answer in time. The developer instance may be asleep.');
  } finally {
    clearTimeout(timer);
  }

  if (r.status === 401 || r.status === 403) return fail(502, 'auth', 'ServiceNow refused the login. Check SN_USER and SN_PASSWORD in Vercel.');
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !type.includes('json')) return fail(503, 'asleep', 'ServiceNow is not answering normally. The developer instance may be asleep.');

  let body;
  try { body = await r.json(); } catch { return fail(503, 'asleep', 'ServiceNow sent an unexpected reply. The developer instance may be asleep.'); }

  const incidents = (body.result || []).map((x) => ({
    number: x.number || '',
    short_description: x.short_description || '',
    priority: toPriority(x.priority),
    state: x.state || '',
    category: x.category || '',
    assignment_group: x.assignment_group || '',
    opened_at: x.opened_at || '',
  }));

  // Vercel's edge keeps this answer for 60 seconds and serves the previous one
  // for up to a day while it fetches a new one in the background.
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
  res.status(200).json({ ok: true, instance, fetched_at: new Date().toISOString(), count: incidents.length, incidents });
};
