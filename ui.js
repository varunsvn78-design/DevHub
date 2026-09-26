export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = value => value == null ? '—' : new Intl.NumberFormat('en', { notation: Number(value) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
export const date = value => value ? new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
export const safeUrl = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? esc(u.href) : '#'; } catch { return '#'; } };
const paths = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  compare: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  repo: '<path d="M4 4h15v16H6a2 2 0 0 1-2-2V4Zm0 12h15M8 4v8"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
  fork: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="12" cy="20" r="2"/><path d="M6 7v3c0 3 6 2 6 6v2m6-11v3c0 3-6 2-6 6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H4v17h17v-6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  github: '<path d="M9 19c-4 1-4-2-6-2m12 5v-4a3.5 3.5 0 0 0-1-2.7c3-.3 6-1.5 6-6.3a5 5 0 0 0-1.4-3.5 5 5 0 0 0-.1-3.5s-1.1-.3-3.5 1.3a12 12 0 0 0-6 0C6.6 1.7 5.5 2 5.5 2a5 5 0 0 0-.1 3.5A5 5 0 0 0 4 9c0 4.8 3 6 6 6.3A3.5 3.5 0 0 0 9 18v4"/>',
  activity: '<path d="M2 12h5l3-9 4 18 3-9h5"/>',
  location: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2"/>'
};
export const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.code}</svg>`;
export function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { if (el.tagName === 'A') el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)); else el.outerHTML = icon(el.dataset.icon); }); }
export function toast(message, error = false) { const el = document.createElement('div'); el.className = `toast${error ? ' err' : ''}`; el.textContent = message; document.getElementById('toasts').append(el); setTimeout(() => el.remove(), 5000); }
export const skeleton = (n = 6) => `<div class="cards" role="status" aria-label="Loading">${'<div class="skel" aria-hidden="true"></div>'.repeat(n)}<span class="sr-only">Loading content…</span></div>`;
export const empty = (title, message, action = '') => `<div class="empty"><h3>${esc(title)}</h3><p>${esc(message)}</p>${action}</div>`;
export const errorView = error => empty('Could not load this page', error.message || 'Please try again.', '<button class="btn" data-retry>Try again</button>');
export const heading = (title, subtitle, action = '') => `<div class="section-head"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div>${action}</div>`;
export const tile = (label, value) => `<div class="tile"><b>${num(value)}</b><span>${esc(label)}</span></div>`;
export const notice = message => `<p class="notice">${esc(message)}</p>`;
export const backLink = () => `<a class="back-link" href="#/">← Back to explore</a>`;
export function saveButton(kind, ref, name, extra = {}) { return `<button class="icon-btn" aria-label="Save ${esc(name)}" title="Save to collection" data-fav="${esc(JSON.stringify({ kind, ref, name, ...extra }))}">${icon('bookmark')}</button>`; }
export function repoCard(r) {
  const [owner, name] = (r.full_name || '').split('/');
  return `<article class="card repo-card"><div class="flex items-start justify-between gap-3"><div class="flex min-w-0 items-center gap-3"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800 text-neutral-400">${icon('repo')}</span><div class="min-w-0"><div class="owner">${esc(owner)}</div><h3><a href="#/repo/${esc(r.full_name)}">${esc(name)}</a></h3></div></div>${saveButton('repo', r.full_name, r.full_name, { stars: r.stargazers_count, description: r.description, url: r.html_url })}</div><p>${esc(r.description || 'No description provided.')}</p><div class="repo-meta"><span>${icon('star')} ${num(r.stargazers_count)}</span><span>${icon('fork')} ${num(r.forks_count)}</span><span class="ml-auto"><span class="h-1.5 w-1.5 rounded-full bg-neutral-400"></span>${esc(r.language || 'Other')}</span></div></article>`;
}
export function developerCard(u) { return `<article class="card"><div class="flex items-center gap-3"><img class="avatar" src="${safeUrl(u.avatar_url)}" alt="" loading="lazy"><div class="min-w-0 flex-1"><h3 class="break-words"><a href="#/dev/${esc(u.login)}">${esc(u.login)}</a></h3><p class="mt-1 text-xs text-neutral-500">${esc(u.type || 'Developer')}</p></div>${saveButton('dev', u.login, u.login, { avatar_url: u.avatar_url, url: u.html_url })}</div><a href="#/dev/${esc(u.login)}" class="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs text-neutral-400">Explore profile ${icon('arrow')}</a></article>`; }
