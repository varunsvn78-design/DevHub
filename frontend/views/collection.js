import { api, getToken } from '../lib/api.js';
import { currentUser, openAuth } from '../lib/auth.js';
import { esc, safeUrl, num, icon, heading, skeleton, empty, errorView, tile, toast } from '../lib/ui.js';
export async function collection(ctx) {
  if (!getToken()) {
    ctx.render(`${heading('A home for your discoveries.', 'Keep the developers and projects you want to come back to.')}<div class="mt-10">${empty('Your collection is personal', 'Sign in or create an account to save favourites and access them whenever inspiration strikes.', '<button class="btn btn-primary" id="collectionLogin">Sign in to get started</button>')}</div>`);
    ctx.view.querySelector('#collectionLogin').onclick = openAuth; return;
  }
  ctx.render(skeleton());
  try {
    const items = await api('/api/favorites', { signal: ctx.signal });
    const repos = items.filter(f => f.kind === 'repo');
    ctx.render(`${heading('Your collection.', `Welcome back${currentUser() ? ', ' + currentUser().username : ''}. A little inspiration, saved for later.`, `<a class="btn btn-primary" href="#/">${icon('search')} Find something new</a>`)}<div class="tiles">${tile('Saved discoveries', items.length)}${tile('Repositories', repos.length)}${tile('Developers', items.length - repos.length)}${tile('Repository stars at save time', repos.reduce((sum, r) => sum + (r.stars || 0), 0))}</div><div class="section-head"><div class="tabs" role="tablist" aria-label="Collection filter"><button class="tab active" data-filter="all" role="tab" aria-selected="true">All saved</button><button class="tab" data-filter="repo" role="tab" aria-selected="false">Repositories</button><button class="tab" data-filter="dev" role="tab" aria-selected="false">Developers</button></div><label class="sr-only" for="filter">Filter your collection</label><input id="filter" type="search" class="max-w-xs py-2" placeholder="Filter your collection…"></div><div id="savedItems" class="cards" aria-live="polite"></div>`);
    if (!ctx.active()) return;
    let kind = 'all';
    const draw = () => {
      const query = ctx.view.querySelector('#filter').value.toLowerCase();
      const filtered = items.filter(f => (kind === 'all' || kind === f.kind) && `${f.name} ${f.ref}`.toLowerCase().includes(query));
      ctx.view.querySelector('#savedItems').innerHTML = filtered.map(f => `<article class="card repo-card"><div class="flex items-center gap-3">${f.avatar_url ? `<img class="avatar" src="${safeUrl(f.avatar_url)}" alt="">` : icon('repo')}<div class="min-w-0"><p class="!my-0 !min-h-0 text-xs text-neutral-500">${f.kind === 'repo' ? 'Repository' : 'Developer'}</p><h3><a href="#/${f.kind === 'repo' ? 'repo' : 'dev'}/${esc(f.ref)}">${esc(f.name || f.ref)}</a></h3></div></div><p>${esc(f.description || (f.kind === 'dev' ? 'A developer worth following.' : 'Saved to your personal collection.'))}</p><div class="repo-meta"><span>${f.kind === 'repo' ? `${icon('star')} ${num(f.stars)}` : icon('users')}</span><button class="ml-auto text-xs text-neutral-400 hover:text-white" data-del="${f.id}" aria-label="Remove ${esc(f.name || f.ref)}">Remove</button></div></article>`).join('') || empty(items.length ? 'No matching discoveries' : 'Your collection starts here', items.length ? 'Try another filter or search term.' : 'Save a repository or developer while exploring to keep them here.', '<a class="btn" href="#/">Explore GitHub</a>');
      ctx.view.querySelectorAll('[data-del]').forEach(button => button.onclick = async () => {
        button.disabled = true;
        try { await api(`/api/favorites/${button.dataset.del}`, { method: 'DELETE' }); toast('Removed from collection'); ctx.refreshSaved(); if (ctx.active()) collection(ctx); }
        catch (error) { toast(error.message, true); button.disabled = false; }
      });
    };
    const tabs = [...ctx.view.querySelectorAll('[data-filter]')];
    tabs.forEach(button => button.onclick = () => { kind = button.dataset.filter; tabs.forEach(tab => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', active); tab.tabIndex = active ? 0 : -1; }); draw(); });
    ctx.view.querySelector('[role=tablist]').onkeydown = event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); const i = tabs.findIndex(t => t.dataset.filter === kind); const next = tabs[(i + (event.key === 'ArrowRight' ? 1 : 2)) % 3]; next.click(); next.focus(); } };
    ctx.view.querySelector('#filter').oninput = draw;
    draw();
  } catch (error) { if (error.name !== 'AbortError') ctx.render(errorView(error)); }
}
