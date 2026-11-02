// Loads incidents live from ServiceNow through /api/incidents, then starts the
// page scripts listed in data-then. If ServiceNow is asleep or not set up yet,
// the page keeps the saved copy in data/incidents.js and says so.
// A "Refresh from ServiceNow" button ([data-ia-refresh]) reloads the tickets on demand.
(function () {
  const me = document.currentScript;
  const then = (me && me.dataset.then ? me.dataset.then.split(/\s+/) : []).filter(Boolean);
  const SAVED = window.IA_SAVED_LABEL || 'the saved copy';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let live = false;

  const start = () => then.reduce((p, src) => p.then(() => new Promise((ok) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = ok;
    document.body.appendChild(s);
  })), Promise.resolve());

  const label = (text) => document.querySelectorAll('.ia-fresh').forEach((el) => { el.textContent = text; });
  const clearNotice = () => document.querySelectorAll('.ia-notice').forEach((n) => n.remove());
  const notice = (html) => {
    clearNotice();
    const n = document.createElement('div');
    n.className = 'ia-notice';
    n.setAttribute('role', 'status');
    n.innerHTML = html;
    const main = document.querySelector('main');
    if (main) main.insertBefore(n, main.firstChild);
  };
  const why = (e) => (e && e.reason === 'not_configured'
    ? 'The live ServiceNow connection is not set up yet.'
    : e && e.reason === 'auth'
      ? 'ServiceNow refused the website’s login.'
      : 'ServiceNow is not answering right now. Developer instances go to sleep when nobody uses them.');
  const WAKE = 'Wake the instance at <a href="https://developer.servicenow.com" target="_blank" rel="noopener">developer.servicenow.com</a>, then try again.';

  // fresh = true skips every cache and goes straight to ServiceNow.
  const load = (fresh) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const url = fresh ? `/api/incidents?fresh=${Date.now()}` : '/api/incidents';
    return fetch(url, { signal: ctrl.signal, cache: fresh ? 'no-store' : 'default', headers: { Accept: 'application/json' } })
      .then((r) => r.json().catch(() => ({ ok: false })))
      .then((d) => {
        if (!d || !d.ok || !Array.isArray(d.incidents) || !d.incidents.length) throw d || {};
        window.IA_INCIDENTS = d.incidents;
        live = true;
        const when = new Date(d.fetched_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        window.IA_FRESH = `read live from ServiceNow ${d.instance.split('.')[0]} at ${when}`;
        label(`${window.IA_FRESH} (${d.count} incidents)`);
        clearNotice();
        return d;
      })
      .finally(() => clearTimeout(timer));
  };

  const fallback = (e) => {
    const n = (window.IA_INCIDENTS || []).length;
    window.IA_FRESH = `from ${SAVED}`;
    label(`${window.IA_FRESH} (${n} incidents); live ServiceNow data is not available right now`);
    notice(`<strong>Showing ${esc(SAVED)}.</strong> ${esc(why(e))} The tickets below are the last saved copy. ${WAKE}`);
  };

  // Refresh button
  document.querySelectorAll('[data-ia-refresh]').forEach((btn) => {
    const idle = btn.textContent;
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.textContent = 'Refreshing…';
      load(true)
        .then((d) => {
          document.dispatchEvent(new Event('ia:incidents'));
          btn.textContent = `Updated: ${d.count} tickets`;
          setTimeout(() => { btn.textContent = idle; }, 2500);
        })
        .catch((e) => {
          btn.textContent = idle;
          const shown = live ? 'the tickets from the last successful read' : esc(SAVED);
          notice(`<strong>Refresh failed, still showing ${shown}.</strong> ${esc(why(e))} ${WAKE}`);
        })
        .finally(() => { btn.disabled = false; btn.removeAttribute('aria-busy'); });
    });
  });

  load(false).catch(fallback).finally(start);
})();
