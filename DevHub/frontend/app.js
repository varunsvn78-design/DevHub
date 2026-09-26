import { api, getToken } from './lib/api.js';
import { initAuth, openAuth } from './lib/auth.js';
import { hydrateIcons, icon, toast, empty } from './lib/ui.js';
import { explore } from './views/explore.js';
import { developer, repository } from './views/details.js';
import { collection } from './views/collection.js';
import { compare } from './views/compare.js';
const view = document.getElementById('view');
let controller;
let saved = [];
let savedRequest = 0;
function syncSaved() {
  view.querySelectorAll('[data-fav]').forEach(button => {
    const data = JSON.parse(button.dataset.fav);
    const exists = saved.some(f => f.kind === data.kind && f.ref.toLowerCase() === data.ref.toLowerCase());
    button.innerHTML = icon(exists ? 'check' : 'bookmark'); button.disabled = exists;
    button.setAttribute('aria-label', `${exists ? 'Saved' : 'Save'} ${data.name}`);
    button.title = exists ? 'Saved to your collection' : 'Save to collection';
  });
  const count = document.getElementById('collectionCount'); count.textContent = saved.length; count.hidden = !saved.length;
}
async function refreshSaved() {
  const id = ++savedRequest;
  try { const items = getToken() ? await api('/api/favorites') : []; if (id === savedRequest) saved = items; }
  catch { if (id === savedRequest) saved = []; }
  syncSaved();
}
view.addEventListener('click', async event => {
  const button = event.target.closest('[data-fav]');
  if (button) {
    if (!getToken()) return openAuth();
    button.disabled = true;
    try { const favorite = await api('/api/favorites', { method: 'POST', body: button.dataset.fav }); saved.push(favorite); syncSaved(); toast('Saved to your collection'); }
    catch (error) { if (error.status === 409) await refreshSaved(); else { button.disabled = false; toast(error.message, true); if (error.status === 401) openAuth(); } }
  } else if (event.target.closest('[data-retry]') && !event.target.closest('#results, #comparison')) route();
});
function route() {
  controller?.abort(); controller = new AbortController(); const signal = controller.signal;
  const ctx = { view, signal, active: () => !signal.aborted, syncSaved, refreshSaved, render(html) { if (!signal.aborted) { view.innerHTML = html; syncSaved(); } } };
  const hash = location.hash.split('?')[0] || '#/';
  const sidebar = document.getElementById('sidebar'); sidebar.classList.remove('open'); document.getElementById('menuBtn').setAttribute('aria-expanded', 'false');
  const label = hash === '#/dashboard' ? 'My collection' : hash === '#/compare' ? 'Compare' : hash.startsWith('#/repo/') ? 'Repository' : hash.startsWith('#/dev/') ? 'Developer' : 'Explore';
  document.getElementById('pageLabel').textContent = label; document.title = `${label} — DevHub`;
  document.querySelectorAll('#mainNav a').forEach(a => { const active = a.hash === hash || (a.hash === '#/' && /#\/(repo|dev)\//.test(hash)); a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  let match;
  try {
    if (hash === '#/' || hash === '#') explore(ctx);
    else if (hash === '#/dashboard') collection(ctx);
    else if (hash === '#/compare') compare(ctx);
    else if ((match = hash.match(/^#\/dev\/([^/]+)$/))) developer(ctx, decodeURIComponent(match[1]));
    else if ((match = hash.match(/^#\/repo\/([^/]+)\/([^/]+)$/))) repository(ctx, decodeURIComponent(match[1]), decodeURIComponent(match[2]));
    else ctx.render(empty('Page not found', 'Go back to explore and start a new discovery.', '<a class="btn" href="#/">Back to explore</a>'));
  } catch { ctx.render(empty('Invalid address', 'The page address is malformed.', '<a class="btn" href="#/">Back to explore</a>')); }
  window.scrollTo(0, 0);
}
async function refreshStatus() {
  const badge = document.getElementById('rateBadge');
  try { const r = await api('/api/ratelimit'); badge.textContent = r.github.remaining == null ? 'GitHub quota unavailable' : `${r.github.remaining.toLocaleString()} / ${r.github.limit.toLocaleString()} GitHub requests left`; badge.title = r.github.reset ? `Resets ${new Date(r.github.reset * 1000).toLocaleTimeString()}` : ''; }
  catch { badge.textContent = 'GitHub status unavailable'; }
  try { await api('/api/health'); document.getElementById('healthText').textContent = 'Workspace online'; document.getElementById('healthDot').classList.remove('bad'); }
  catch { document.getElementById('healthText').textContent = 'Workspace offline'; document.getElementById('healthDot').classList.add('bad'); }
}
hydrateIcons();
document.querySelector('.skip-link').onclick = event => { event.preventDefault(); view.focus(); view.scrollIntoView({ block: 'start' }); };
document.getElementById('menuBtn').onclick = event => { const open = document.getElementById('sidebar').classList.toggle('open'); event.currentTarget.setAttribute('aria-expanded', open); };
document.addEventListener('keydown', event => { if (event.key === 'Escape') { document.getElementById('sidebar').classList.remove('open'); document.getElementById('menuBtn').setAttribute('aria-expanded', 'false'); } });
window.addEventListener('hashchange', route);
window.addEventListener('session-expired', () => { saved = []; savedRequest++; syncSaved(); });
await initAuth(() => { refreshSaved(); route(); });
await refreshSaved();
route(); refreshStatus(); setInterval(refreshStatus, 60000);
