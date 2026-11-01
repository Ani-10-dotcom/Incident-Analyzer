// Ticket detail panel: opens from the Tickets table (and from #ticket=INC… links).
(function () {
  const SN = 'https://dev460097.service-now.com';
  const dlg = document.getElementById('ticket-dialog');
  const body = dlg.querySelector('.tk-body');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const statusGroup = (st) => (st === 'Resolved' || st === 'Closed' ? 'Resolved' : st === 'New' ? 'New' : st === 'In Progress' ? 'In Progress' : 'Pending');
  const stCls = { Resolved: 'ok', New: 'new', 'In Progress': 'prog', Pending: 'pend' };

  // Same word matching as the Duplicate / Similar calc
  const stop = new Set(['a', 'an', 'the', 'to', 'on', 'in', 'for', 'of', 'is', 'not', 'with', 'from', 'when', 'since', 'after', 'all', 'every', 'few', 'my', 'and', 'at', 'by']);
  const words = (s) => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !stop.has(w)).map((w) => w.replace(/(ing|s)$/, '')));
  const jaccard = (a, b) => { let n = 0; a.forEach((w) => { if (b.has(w)) n++; }); const u = a.size + b.size - n; return u ? n / u : 0; };

  let kb = null;
  const kbReady = fetch('/data/known_issues.json').then((r) => (r.ok ? r.json() : [])).then((d) => { kb = d; }).catch(() => { kb = []; });
  // An article that lists the ticket wins; otherwise suggest the closest by word match.
  const closestArticle = (number, desc) => {
    const linked = (kb || []).find((a) => (a.tickets || []).includes(number));
    if (linked) return { a: linked, score: null };
    const w = words(desc);
    let best = null;
    for (const a of kb || []) {
      const score = Math.max(...[a.title, ...(a.matches || [])].map((p) => jaccard(w, words(p))));
      if (score >= 0.3 && (!best || score > best.score)) best = { a, score };
    }
    return best;
  };

  let current = null;
  const render = () => {
    const n = current;
    const r = (dash.data('incidents').data || []).find((x) => x.number === n);
    if (!r) { body.innerHTML = `<p>Ticket ${esc(n)} is not in this export.</p>`; return; }
    const m = (dash.data('similarity').data || []).find((x) => x.number === n) || {};
    const later = (dash.data('similarity').data || []).filter((x) => x.reference_ticket === n && x.match_type);
    const art = kb ? closestArticle(r.number, r.short_description) : undefined;
    const g = statusGroup(r.state);
    const row = (k, v) => `<div class="tk-row"><dt>${k}</dt><dd>${v || '<span class="tk-muted">—</span>'}</dd></div>`;
    body.innerHTML = `
      <header class="tk-head">
        <span class="tk-num">${esc(r.number)}</span>
        <h2 id="tk-title">${esc(r.short_description)}</h2>
        <div class="tk-chips"><span class="ia-chip ${esc(String(r.priority).toLowerCase())}">${esc(r.priority)}</span><span class="ia-chip ${stCls[g]}">${esc(r.state)}</span></div>
      </header>
      <dl class="tk-grid">
        ${row('Opened', esc(r.opened_at))}
        ${row('Status group', esc(g))}
        ${row('Category', esc(r.category))}
        ${row('Assignment group', esc(r.assignment_group))}
        ${row('Match', m.match_type ? `<span class="ia-chip ${m.match_type === 'Duplicate' ? 'dup' : 'sim'}">${esc(m.match_type)}</span> of <button type="button" class="ia-ref tk-go" data-n="${esc(m.reference_ticket)}">${esc(m.reference_ticket)}</button>${m.similarity != null ? ` <span class="tk-muted">(${Math.round(m.similarity * 100)}% alike)</span>` : ''}` : '')}
        ${later.length ? row('Later matches', later.map((x) => `<button type="button" class="ia-ref tk-go" data-n="${esc(x.number)}">${esc(x.number)}</button> <span class="tk-muted">${esc(x.match_type)}</span>`).join(', ')) : ''}
        ${row('Known issue', art === undefined ? '<span class="tk-muted">Loading…</span>' : art ? `<a href="/known-issues#${esc(art.a.number)}">${esc(art.a.number)}: ${esc(art.a.title)}</a>${art.score != null ? ` <span class="tk-muted">(suggested, ${Math.round(art.score * 100)}% alike)</span>` : ''}` : '<span class="tk-muted">No close article</span>')}
      </dl>
      ${art ? `<section class="tk-fix"><h3>Suggested fix from ${esc(art.a.number)}</h3><ol>${art.a.resolution.map((s) => `<li>${esc(s).replace(/`([^`]+)`/g, '<code>$1</code>')}</li>`).join('')}</ol></section>` : ''}
      <footer class="tk-foot">
        <a class="ia-btn ia-reset tk-sn" href="${SN}/incident.do?sysparm_query=number=${encodeURIComponent(r.number)}" target="_blank" rel="noopener">Open in ServiceNow ↗</a>
        <span class="tk-muted">Needs a sign-in to dev460097. Data here was read from ServiceNow on Nov 1, 2026.</span>
      </footer>`;
  };

  window.iaOpenTicket = (n) => {
    current = n;
    render();
    if (!kb) kbReady.then(() => { if (current === n && dlg.open) render(); });
    if (!dlg.open) dlg.showModal();
    history.replaceState(null, '', '#ticket=' + encodeURIComponent(n));
  };

  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('.tk-close')) { dlg.close(); return; }
    const go = e.target.closest('.tk-go');
    if (go) window.iaOpenTicket(go.dataset.n);
  });
  dlg.addEventListener('close', () => { current = null; if (location.hash.startsWith('#ticket=')) history.replaceState(null, '', '#tickets'); });

  const fromHash = () => { const h = decodeURIComponent(location.hash); if (h.startsWith('#ticket=')) window.iaOpenTicket(h.slice(8)); };
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
