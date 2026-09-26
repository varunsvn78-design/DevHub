import { api } from '../lib/api.js';
import { icon, esc, num, repoCard, developerCard, skeleton, empty, errorView } from '../lib/ui.js';

export function explore(ctx) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  let mode = params.get('type') === 'users' ? 'users' : 'repos';
  let page = Math.max(1, Number(params.get('page')) || 1);
  let query = params.get('q') || '';
  let requestId = 0;
  ctx.render(`<section class="hero"><div><h1>A world of code.<br>Your next discovery.</h1><p>Explore the people and projects shaping open source.<br class="hidden sm:block">Find something worth building on.</p></div><div class="hero-art" aria-hidden="true"><i class="orbit"></i><i class="orbit"></i><i class="orbit"></i><span class="hero-code">&lt;/&gt;</span><span class="orbit-dot"></span></div></section>
    <section class="search-panel" aria-label="Search GitHub"><div class="flex flex-wrap items-center justify-between gap-3"><div class="tabs" role="tablist" aria-label="Search type"><button class="tab" id="tRepos" role="tab">${icon('repo')} Repositories</button><button class="tab" id="tUsers" role="tab">${icon('users')} Developers</button></div><span class="hidden sm:inline text-[11px] text-neutral-500">Your window into open source</span></div>
    <form id="searchForm" class="searchbar">${icon('search')}<input id="q" type="search" aria-label="Search GitHub" placeholder="Search repositories, topics, or ideas…" value="${esc(query)}" maxlength="256"><button class="btn btn-primary" type="submit">Search ${icon('arrow')}</button></form><div class="suggestions"><span>Try exploring</span>${['machine-learning', 'developer-tools', 'react', 'rust'].map(q => `<button data-query="${q}">${q}</button>`).join('')}</div></section>
    <section><div class="section-head"><div><h2 id="resultsTitle">Worth exploring</h2><p id="resultCount">Popular projects from the open-source community</p></div><label class="flex items-center gap-2 text-xs text-neutral-500" id="sortLabel">Sort by <select id="sort" class="w-auto py-2 text-xs"><option value="stars">Most stars</option><option value="updated">Recently updated</option><option value="forks">Most forks</option></select></label></div><div id="results" aria-live="polite"></div><div id="pagination" class="mt-6 flex items-center justify-between gap-3"></div></section>`);
  const root = ctx.view;
  const input = root.querySelector('#q');
  const results = root.querySelector('#results');
  const pagination = root.querySelector('#pagination');
  const tabs = [root.querySelector('#tRepos'), root.querySelector('#tUsers')];
  function syncTabs() {
    tabs.forEach((tab, i) => { const selected = (i === 0) === (mode === 'repos'); tab.classList.toggle('active', selected); tab.setAttribute('aria-selected', selected); tab.tabIndex = selected ? 0 : -1; });
    root.querySelector('#sortLabel').hidden = mode === 'users';
    input.placeholder = mode === 'repos' ? 'Search repositories, topics, or ideas…' : 'Search developers by username or location…';
  }
  async function search() {
    const id = ++requestId;
    const selectedMode = mode;
    const q = query || (mode === 'repos' ? 'stars:>10000 archived:false' : 'followers:>1000 type:user');
    const sort = root.querySelector('#sort').value;
    const url = new URLSearchParams({ q, page, per_page: '12', ...(mode === 'repos' ? { sort, order: 'desc' } : {}) });
    history.replaceState(null, '', `#/?${new URLSearchParams({ type: mode, q: query, page })}`);
    results.innerHTML = skeleton(); pagination.innerHTML = '';
    try {
      const data = await api(`/api/search/${mode}?${url}`, { signal: ctx.signal });
      if (id !== requestId || !ctx.active()) return;
      root.querySelector('#resultsTitle').textContent = query ? `Results for “${query}”` : mode === 'repos' ? 'Worth exploring' : 'Meet the community';
      root.querySelector('#resultCount').textContent = `${num(data.total_count)} ${mode === 'repos' ? 'repositories' : 'developers'}${!query ? ' to spark your curiosity' : ' found'}${data.total_count > 1000 ? ' · First 1,000 results available' : ''}`;
      results.innerHTML = data.items.length ? `<div class="cards">${data.items.map(selectedMode === 'repos' ? repoCard : developerCard).join('')}</div>` : empty('Nothing here yet', 'Try another name, topic, or GitHub search qualifier.');
      ctx.syncSaved();
      const pages = Math.ceil(Math.min(data.total_count, 1000) / 12);
      if (pages > 1) {
        pagination.innerHTML = `<span class="text-xs text-neutral-500">Page ${page} of ${pages}</span><div class="flex gap-2"><button class="btn btn-ghost" id="prev" aria-label="Previous page" ${page <= 1 ? 'disabled' : ''}>← Previous</button><button class="btn btn-ghost" id="next" aria-label="Next page" ${page >= pages ? 'disabled' : ''}>Next →</button></div>`;
        pagination.querySelector('#prev').onclick = () => { page--; search(); };
        pagination.querySelector('#next').onclick = () => { page++; search(); };
      }
    } catch (error) { if (error.name !== 'AbortError' && id === requestId && ctx.active()) { results.innerHTML = errorView(error); results.querySelector('[data-retry]').onclick = search; } }
  }
  tabs.forEach((tab, i) => tab.onclick = () => { mode = i === 0 ? 'repos' : 'users'; page = 1; syncTabs(); search(); });
  root.querySelector('[role=tablist]').onkeydown = event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); const next = mode === 'repos' ? 1 : 0; tabs[next].click(); tabs[next].focus(); } };
  root.querySelector('#searchForm').onsubmit = event => { event.preventDefault(); query = input.value.trim(); page = 1; search(); };
  root.querySelector('#sort').onchange = () => { page = 1; search(); };
  root.querySelectorAll('[data-query]').forEach(button => button.onclick = () => { mode = 'repos'; query = button.dataset.query; input.value = query; page = 1; syncTabs(); search(); });
  syncTabs(); search();
}
