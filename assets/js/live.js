// Loads incidents live from ServiceNow through /api/incidents, then starts the
// page scripts listed in data-then. If ServiceNow is asleep or not set up yet,
// the page keeps the saved copy in data/incidents.js and says so.
(function () {
  const me = document.currentScript;
  const then = (me && me.dataset.then ? me.dataset.then.split(/\s+/) : []).filter(Boolean);
  const SAVED = window.IA_SAVED_LABEL || 'the saved copy';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const start = () => then.reduce((p, src) => p.then(() => new Promise((ok) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = ok;
    document.body.appendChild(s);
  })), Promise.resolve());

  const label = (text) => document.querySelectorAll('.ia-fresh').forEach((el) => { el.textContent = text; });
  const notice = (html) => {
    const n = document.createElement('div');
    n.className = 'ia-notice';
    n.setAttribute('role', 'status');
    n.innerHTML = html;
    const main = document.querySelector('main');
    if (main) main.insertBefore(n, main.firstChild);
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  fetch('/api/incidents', { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    .then((r) => r.json().catch(() => ({ ok: false })))
    .then((d) => {
      if (!d || !d.ok || !Array.isArray(d.incidents) || !d.incidents.length) throw d || {};
      window.IA_INCIDENTS = d.incidents;
      const at = new Date(d.fetched_at);
      const when = at.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      window.IA_FRESH = `read live from ServiceNow ${d.instance.split('.')[0]} at ${when}`;
      label(`${window.IA_FRESH} (${d.count} incidents)`);
    })
    .catch((e) => {
      const n = (window.IA_INCIDENTS || []).length;
      window.IA_FRESH = `from ${SAVED}`;
      label(`${window.IA_FRESH} (${n} incidents); live ServiceNow data is not available right now`);
      const why = e && e.reason === 'not_configured'
        ? 'The live ServiceNow connection is not set up yet.'
        : e && e.reason === 'auth'
          ? 'ServiceNow refused the website’s login.'
          : 'ServiceNow is not answering right now. Developer instances go to sleep when nobody uses them.';
      notice(`<strong>Showing ${esc(SAVED)}.</strong> ${esc(why)} The tickets below are the last saved copy. Wake the instance at <a href="https://developer.servicenow.com" target="_blank" rel="noopener">developer.servicenow.com</a>, then reload this page.`);
    })
    .finally(() => { clearTimeout(timer); start(); });
})();
