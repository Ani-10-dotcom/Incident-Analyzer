(function () {
  const list = document.getElementById('kb-list');
  const qEl = document.getElementById('kb-q');
  const catEl = document.getElementById('kb-cat');
  const countEl = document.getElementById('kb-count');
  const incidents = window.IA_INCIDENTS || [];

  // Same word matching as the dashboard's Duplicate / Similar calc.
  const stop = new Set(['a', 'an', 'the', 'to', 'on', 'in', 'for', 'of', 'is', 'not', 'with', 'from', 'when', 'since', 'after', 'all', 'every', 'few', 'my', 'and', 'at', 'by']);
  const words = (s) => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !stop.has(w)).map((w) => w.replace(/(ing|s)$/, '')));
  const jaccard = (a, b) => { let n = 0; a.forEach((w) => { if (b.has(w)) n++; }); const u = a.size + b.size - n; return u ? n / u : 0; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const code = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

  let articles = [];

  // Each article lists its tickets by number. Tickets not listed on any article
  // (for example from a newer export) are suggested by word match, 30% or more alike.
  const listed = new Set();
  const byNumber = new Map(incidents.map((r) => [r.number, r]));
  const lookalikes = (a) => {
    const phrases = [a.title, ...(a.matches || [])].map(words);
    const linked = (a.tickets || []).filter((n) => byNumber.has(n)).map((n) => ({ r: byNumber.get(n) }));
    const suggested = incidents
      .filter((r) => !listed.has(r.number))
      .map((r) => { const w = words(r.short_description); return { r, score: Math.max(...phrases.map((p) => jaccard(w, p))) }; })
      .filter((x) => x.score >= 0.3)
      .sort((x, y) => y.score - x.score);
    return [...linked, ...suggested];
  };

  const render = () => {
    const q = qEl.value.trim().toLowerCase();
    const cat = catEl.value;
    const shown = articles.filter((a) => (!cat || a.category === cat) && (!q || a._text.includes(q)));
    countEl.textContent = `${shown.length} of ${articles.length} articles`;
    if (!shown.length) { list.innerHTML = '<div class="kb-empty">No articles match.</div>'; return; }
    list.innerHTML = shown.map((a) => `
      <details class="kb-item" id="${esc(a.number)}">
        <summary>
          <span class="kb-num">${esc(a.number)}</span>
          <span class="kb-title">${esc(a.title)}</span>
          <span class="kb-tags">
            <span class="kb-tag">${esc(a.category)}</span>
            <span class="kb-tag grp">${esc(a.assignment_group)}</span>
            ${a._hits.length ? `<span class="kb-tag hit">${a._hits.length} ticket${a._hits.length > 1 ? 's' : ''}</span>` : ''}
          </span>
        </summary>
        <div class="kb-body">
          <div><h3>Symptoms</h3><p>${code(a.symptoms)}</p></div>
          <div><h3>Cause</h3><p>${code(a.cause)}</p></div>
          <div><h3>Resolution</h3><ol>${a.resolution.map((s) => `<li>${code(s)}</li>`).join('')}</ol></div>
          ${a.notes ? `<div><h3>Notes</h3><p>${code(a.notes)}</p></div>` : ''}
          <div><h3>How users describe it</h3><ul>${(a.matches || []).map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>
          ${a._hits.length ? `<div><h3>Tickets</h3><ul class="kb-tickets">${a._hits.map((h) => `<li><a href="/#ticket=${encodeURIComponent(h.r.number)}">${esc(h.r.number)}</a> ${esc(h.r.short_description)} <span class="pct">(${h.score != null ? `suggested, ${Math.round(h.score * 100)}% alike, ` : ''}${esc(h.r.state)})</span></li>`).join('')}</ul></div>` : ''}
        </div>
      </details>`).join('');
    const target = location.hash.slice(1);
    const el = target && document.getElementById(target);
    if (el) el.open = true;
  };

  fetch('/data/known_issues.json')
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      data.forEach((a) => (a.tickets || []).forEach((n) => listed.add(n)));
      articles = data.map((a) => ({ ...a, _hits: lookalikes(a), _text: [a.number, a.title, a.category, a.assignment_group, a.symptoms, a.cause, a.notes, ...(a.matches || []), ...(a.tickets || []), ...a.resolution].join(' ').toLowerCase() }));
      [...new Set(articles.map((a) => a.category))].sort().forEach((c) => catEl.add(new Option(c, c)));
      render();
    })
    .catch(() => { list.innerHTML = '<div class="kb-empty">Could not load the known-issue articles.</div>'; });

  qEl.addEventListener('input', render);
  catEl.addEventListener('change', render);
})();
