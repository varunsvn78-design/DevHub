"use strict";
/* DevHub SPA — hash router, same-origin JSON API */
const TOKEN_KEY = "devhub_token";
const view = document.getElementById("view");
const toasts = document.getElementById("toasts");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const getToken = () => localStorage.getItem(TOKEN_KEY);
const toast = (msg, err = false) => {
  const d = document.createElement("div");
  d.className = "toast" + (err ? " err" : "");
  d.textContent = msg;
  toasts.appendChild(d);
  setTimeout(() => d.remove(), 4200);
};

async function api(path, opts = {}) {
  const headers = Object.assign({"Content-Type": "application/json"}, opts.headers || {});
  const t = getToken();
  if (t) headers.Authorization = "Bearer " + t;
  let res;
  try {
    res = await fetch(path, Object.assign({}, opts, {headers}));
  } catch (e) {
    toast("Network failure — API unreachable", true);
    throw new Error("network");
  }
  if (res.status === 401) { promptLogin(); throw new Error("unauthorized"); }
  if (res.status === 403 || res.status === 429) {
    toast("GitHub rate limit exceeded — try again later", true);
    throw new Error("ratelimit");
  }
  if (!res.ok) {
    let msg = "Request failed (" + res.status + ")";
    try { const j = await res.json(); if (j.error || j.message) msg = j.error || j.message; } catch (_) {}
    toast(msg, true);
    throw new Error(msg);
  }
  return res.json();
}

const skeleton = (n = 3) => Array.from({length: n}, () => '<div class="skel"></div>').join("");

/* ---------- auth ---------- */
const modal = document.getElementById("authModal");
const authBtn = document.getElementById("authBtn");
const authState = document.getElementById("authState");
const authErr = document.getElementById("authErr");
let me = null;

function promptLogin() {
  if (!getToken()) { openModal(); toast("Please sign in to continue", true); }
}
function openModal() { modal.hidden = false; authErr.textContent = ""; }
function closeModal() { modal.hidden = true; }
authBtn.onclick = () => { if (getToken()) { localStorage.removeItem(TOKEN_KEY); me = null; renderAuth(); toast("Signed out"); } else openModal(); };
document.getElementById("authClose").onclick = closeModal;
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
const tabLogin = document.getElementById("tabLogin"), tabRegister = document.getElementById("tabRegister");
const loginForm = document.getElementById("loginForm"), registerForm = document.getElementById("registerForm");
function showTab(login) {
  tabLogin.classList.toggle("active", login); tabRegister.classList.toggle("active", !login);
  tabLogin.setAttribute("aria-selected", login); tabRegister.setAttribute("aria-selected", !login);
  loginForm.hidden = !login; registerForm.hidden = login;
}
tabLogin.onclick = () => showTab(true); tabRegister.onclick = () => showTab(false);
loginForm.onsubmit = async (e) => {
  e.preventDefault(); authErr.textContent = "";
  try {
    const r = await api("/api/auth/login", {method: "POST", body: JSON.stringify({usernameOrEmail: document.getElementById("loginId").value.trim(), password: document.getElementById("loginPw").value})});
    localStorage.setItem(TOKEN_KEY, r.token); me = r.user; closeModal(); renderAuth(); toast("Welcome, " + me.username);
    route();
  } catch (err) { if (err.message !== "unauthorized") authErr.textContent = err.message; }
};
registerForm.onsubmit = async (e) => {
  e.preventDefault(); authErr.textContent = "";
  try {
    const r = await api("/api/auth/register", {method: "POST", body: JSON.stringify({username: document.getElementById("regUser").value.trim(), email: document.getElementById("regEmail").value.trim(), password: document.getElementById("regPw").value})});
    localStorage.setItem(TOKEN_KEY, r.token); me = r.user; closeModal(); renderAuth(); toast("Account created — welcome!");
    route();
  } catch (err) { if (err.message !== "unauthorized") authErr.textContent = err.message; }
};
async function renderAuth() {
  if (getToken() && !me) {
    try { const r = await api("/api/auth/me"); me = r.user; }
    catch (_) { localStorage.removeItem(TOKEN_KEY); me = null; }
  }
  authState.textContent = me ? "@" + me.username : "";
  authBtn.textContent = me ? "Sign out" : "Sign in";
}
document.getElementById("menuBtn").onclick = (e) => {
  const nav = document.getElementById("mainNav");
  nav.classList.toggle("open");
  e.currentTarget.setAttribute("aria-expanded", nav.classList.contains("open"));
};

/* ---------- rate limit + health ---------- */
async function refreshRate() {
  const badge = document.getElementById("rateBadge");
  try {
    const r = await fetch("/api/ratelimit").then((x) => x.json());
    const g = r.github || {};
    badge.textContent = `API: ${g.remaining ?? "?"} / ${g.limit ?? "?"}`;
    badge.classList.toggle("low", (g.remaining ?? 60) < 10);
  } catch (_) { badge.textContent = "API: offline"; }
  try {
    const h = await fetch("/api/health").then((x) => x.json());
    document.getElementById("healthDot").classList.toggle("bad", !h.ok);
  } catch (_) { document.getElementById("healthDot").classList.add("bad"); }
}

/* ---------- views ---------- */
function favBtn(kind, ref, name, extra = {}) {
  return `<button class="btn" data-fav='${esc(JSON.stringify(Object.assign({kind, ref, name}, extra)))}'>☆ Save</button>`;
}
view.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-fav]");
  if (!b) return;
  if (!getToken()) { promptLogin(); return; }
  const f = JSON.parse(b.dataset.fav);
  try { await api("/api/favorites", {method: "POST", body: JSON.stringify(f)}); toast("Saved to dashboard"); }
  catch (_) {}
});

function vHome() {
  view.innerHTML = `
    <h1>Discover developers &amp; repositories</h1>
    <div class="tabs" role="tablist">
      <button class="tab active" id="tUsers" role="tab">Users</button>
      <button class="tab" id="tRepos" role="tab">Repositories</button>
    </div>
    <div class="searchbar">
      <input id="q" type="search" placeholder="Search GitHub… e.g. torvalds or vue" aria-label="Search query">
      <button class="btn btn-primary" id="go">Search</button>
    </div>
    <div id="results" class="grid cards" style="margin-top:16px" aria-live="polite"></div>`;
  let mode = "users";
  const q = document.getElementById("q"), results = document.getElementById("results");
  const tU = document.getElementById("tUsers"), tR = document.getElementById("tRepos");
  tU.onclick = () => { mode = "users"; tU.classList.add("active"); tR.classList.remove("active"); };
  tR.onclick = () => { mode = "repos"; tR.classList.add("active"); tU.classList.remove("active"); };
  const go = async () => {
    const query = q.value.trim();
    if (!query) { results.innerHTML = '<div class="empty">Type a query to search GitHub.</div>'; return; }
    results.innerHTML = skeleton(4);
    try {
      if (mode === "users") {
        const r = await api("/api/search/users?q=" + encodeURIComponent(query));
        results.innerHTML = r.items?.length ? r.items.map((u) => `
          <div class="card row">
            <img class="avatar" src="${esc(u.avatar_url)}" alt="" loading="lazy">
            <div style="flex:1"><b><a href="#/dev/${esc(u.login)}">${esc(u.login)}</a></b>
            <div class="muted">${esc(u.type || "")} · score ${esc(Math.round(u.score ?? 0))}</div></div>
            ${favBtn("dev", u.login, u.login, {avatar_url: u.avatar_url, url: u.html_url})}
          </div>`).join("") : '<div class="empty">No users found.</div>';
      } else {
        const r = await api("/api/search/repos?q=" + encodeURIComponent(query));
        results.innerHTML = r.items?.length ? r.items.map((x) => `
          <div class="card">
            <b><a href="#/repo/${esc(x.full_name)}">${esc(x.full_name)}</a></b>
            <p class="muted">${esc(x.description || "No description")}</p>
            <div class="row"><span class="pill">★ ${esc(x.stargazers_count)}</span><span class="pill">${esc(x.language || "—")}</span></div>
            <div class="row" style="margin-top:8px">${favBtn("repo", x.full_name, x.full_name, {stars: x.stargazers_count, description: x.description, url: x.html_url})}</div>
          </div>`).join("") : '<div class="empty">No repositories found.</div>';
      }
    } catch (_) { results.innerHTML = '<div class="empty">Search failed. Try again.</div>'; }
  };
  document.getElementById("go").onclick = go;
  q.onkeydown = (e) => { if (e.key === "Enter") go(); };
  results.innerHTML = '<div class="empty">Type a query to search GitHub.</div>';
}

async function vDev(username) {
  view.innerHTML = `<p><a href="#/">← Back</a></p><div>${skeleton(3)}</div>`;
  try {
    const {profile: p, repos = [], stats = {}} = await api("/api/dev/" + encodeURIComponent(username));
    const top = [...repos].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0)).slice(0, 6);
    view.innerHTML = `
      <p><a href="#/">← Back</a></p>
      <div class="card profile-head">
        <img class="avatar lg" src="${esc(p.avatar_url)}" alt="${esc(p.login)} avatar">
        <div style="flex:1;min-width:220px">
          <h1 style="margin:0">${esc(p.name || p.login)} <span class="muted">@${esc(p.login)}</span></h1>
          <p class="muted">${esc(p.bio || "")}</p>
          <div class="row">
            <span class="pill">Followers ${esc(p.followers)}</span>
            <span class="pill">Following ${esc(p.following)}</span>
            <span class="pill">Repos ${esc(p.public_repos)}</span>
            <span class="pill">★ total ${esc(stats.totalStars ?? 0)}</span>
            <span class="pill">⑂ forks ${esc(stats.totalForks ?? 0)}</span>
          </div>
          <div style="margin-top:6px">${esc((stats.topLanguages || []).map((l) => l.language || l).join(" · "))}</div>
        </div>
        <div>${favBtn("dev", p.login, p.login, {avatar_url: p.avatar_url, url: p.html_url})}</div>
      </div>
      <h2>Top repositories</h2>
      <div class="grid cards">${top.length ? top.map((r) => `
        <div class="card"><b><a href="#/repo/${esc(r.full_name)}">${esc(r.full_name)}</a></b>
        <p class="muted">${esc(r.description || "")}</p>
        <div class="row"><span class="pill">★ ${esc(r.stargazers_count)}</span><span class="pill">${esc(r.language || "—")}</span></div></div>`).join("") : '<div class="empty">No repos.</div>'}</div>`;
  } catch (_) { view.innerHTML = '<div class="empty">Developer not found.</div>'; }
}

async function vRepo(owner, name) {
  view.innerHTML = `<p><a href="#/">← Back</a></p><div>${skeleton(3)}</div>`;
  try {
    const d = await api(`/api/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
    const r = d.repo || {};
    const dist = d.languageDistribution || [];
    const max = Math.max(1, ...(d.activity || []).map((a) => a.commits));
    view.innerHTML = `
      <p><a href="#/">← Back</a></p>
      <div class="card">
        <h1 style="margin:0"><a href="${esc(r.html_url || "#")}">${esc(r.full_name || (owner + "/" + name))}</a></h1>
        <p class="muted">${esc(r.description || "")}</p>
        <div class="tiles">
          <div class="tile"><b>★ ${esc(r.stargazers_count ?? 0)}</b><span>stars</span></div>
          <div class="tile"><b>⑂ ${esc(r.forks_count ?? 0)}</b><span>forks</span></div>
          <div class="tile"><b>! ${esc(d.openIssues ?? r.open_issues_count ?? 0)}</b><span>open issues</span></div>
          <div class="tile"><b>👁 ${esc(r.watchers_count ?? r.subscribers_count ?? 0)}</b><span>watchers</span></div>
        </div>
        <div class="row">${favBtn("repo", r.full_name, r.full_name, {stars: r.stargazers_count, description: r.description, url: r.html_url})}</div>
      </div>
      <div class="compare-cols" style="margin-top:14px">
        <div class="card"><h3>Languages</h3>${dist.length ? dist.map((l) => `
          <div class="lang-row"><span>${esc(l.language)}</span><div class="bar"><i style="width:${esc(l.percent)}%"></i></div><span>${esc(l.percent)}%</span></div>`).join("") : '<p class="muted">No language data.</p>'}</div>
        <div class="card"><h3>Contributors</h3>${(d.contributors || []).slice(0, 10).map((c) => `
          <div class="row" style="margin:6px 0"><img class="avatar" style="width:32px;height:32px" src="${esc(c.avatar_url)}" alt="" loading="lazy"><span>${esc(c.login)}</span><span class="muted">${esc(c.contributions)} commits</span></div>`).join("") || '<p class="muted">No contributors.</p>'}</div>
      </div>
      <div class="card" style="margin-top:14px"><h3>Weekly activity</h3>
        <div class="chart" role="img" aria-label="Weekly commit activity">${(d.activity || []).map((a) => `<i style="height:${esc(Math.round((a.commits / max) * 100))}%" title="week ${esc(a.week)}: ${esc(a.commits)} commits"></i>`).join("") || '<span class="muted">No activity.</span>'}</div>
      </div>`;
  } catch (_) { view.innerHTML = '<div class="empty">Repository not found.</div>'; }
}

async function vDashboard() {
  if (!getToken()) { view.innerHTML = '<div class="empty">Sign in to view your dashboard.<br><br><button class="btn btn-primary" onclick="document.getElementById(\'authBtn\').click()">Sign in</button></div>'; promptLogin(); return; }
  view.innerHTML = `<h1>Dashboard</h1><div>${skeleton(3)}</div>`;
  try {
    const favs = await api("/api/favorites");
    const items = Array.isArray(favs) ? favs : (favs.items || favs.favorites || []);
    if (!items.length) { view.innerHTML = "<h1>Dashboard</h1><div class='empty'>No favorites yet — search and ☆ save devs or repos.</div>"; return; }
    const devs = items.filter((f) => f.kind === "dev"), repos = items.filter((f) => f.kind === "repo");
    const card = (f) => `
      <div class="card row">
        ${f.avatar_url ? `<img class="avatar" src="${esc(f.avatar_url)}" alt="" loading="lazy">` : ""}
        <div style="flex:1"><b>${f.kind === "dev" ? `<a href="#/dev/${esc(f.ref)}">${esc(f.name)}</a>` : `<a href="#/repo/${esc(f.ref)}">${esc(f.name)}</a>`}</b>
        <div class="muted">${esc(f.description || f.url || "")}</div></div>
        <button class="btn btn-danger" data-del="${esc(f.id)}">Remove</button>
      </div>`;
    view.innerHTML = `<h1>Dashboard</h1>
      <h2>Developers (${devs.length})</h2><div class="grid">${devs.map(card).join("") || '<div class="empty">None.</div>'}</div>
      <h2>Repositories (${repos.length})</h2><div class="grid">${repos.map(card).join("") || '<div class="empty">None.</div>'}</div>`;
    view.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => {
      await api("/api/favorites/" + encodeURIComponent(b.dataset.del), {method: "DELETE"});
      toast("Removed"); vDashboard();
    });
  } catch (_) { view.innerHTML = "<div class='empty'>Could not load favorites.</div>"; }
}

function vCompare() {
  view.innerHTML = `
    <h1>Compare</h1>
    <div class="compare-cols">
      <div class="card"><h3>Repo vs Repo</h3>
        <div class="stack"><label>Repo A (owner/name)<input id="repoA" placeholder="facebook/react"></label>
        <label>Repo B (owner/name)<input id="repoB" placeholder="vuejs/vue"></label>
        <button class="btn btn-primary" id="cmpRepos">Compare repos</button></div></div>
      <div class="card"><h3>Dev vs Dev</h3>
        <div class="stack"><label>User A<input id="userA" placeholder="torvalds"></label>
        <label>User B<input id="userB" placeholder="gaearon"></label>
        <button class="btn btn-primary" id="cmpDevs">Compare devs</button></div></div>
    </div>
    <div id="cmpOut" style="margin-top:16px" aria-live="polite"></div>`;
  const out = document.getElementById("cmpOut");
  const table = (cmp) => `<table class="cmp"><tr><th>Metric</th><th>A</th><th>B</th><th>Winner</th></tr>${cmp.map((c) => `
    <tr><td>${esc(c.metric)}</td><td class="${c.winner === "a" ? "win" : ""}">${esc(c.a)}</td><td class="${c.winner === "b" ? "win" : ""}">${esc(c.b)}</td><td>${esc(c.winner || "tie")}</td></tr>`).join("")}</table>`;
  document.getElementById("cmpRepos").onclick = async () => {
    const a = document.getElementById("repoA").value.trim(), b = document.getElementById("repoB").value.trim();
    if (!a || !b) { toast("Enter two repos as owner/name", true); return; }
    out.innerHTML = skeleton(2);
    try {
      const r = await api(`/api/compare/repos?repoA=${encodeURIComponent(a)}&repoB=${encodeURIComponent(b)}`);
      out.innerHTML = `<div class="card"><h3>${esc(a)} vs ${esc(b)}</h3>${table(r.comparison || [])}</div>`;
    } catch (_) { out.innerHTML = '<div class="empty">Comparison failed.</div>'; }
  };
  document.getElementById("cmpDevs").onclick = async () => {
    const a = document.getElementById("userA").value.trim(), b = document.getElementById("userB").value.trim();
    if (!a || !b) { toast("Enter two usernames", true); return; }
    out.innerHTML = skeleton(2);
    try {
      const r = await api(`/api/compare/devs?userA=${encodeURIComponent(a)}&userB=${encodeURIComponent(b)}`);
      out.innerHTML = `<div class="card"><h3>${esc(a)} vs ${esc(b)}</h3>${table(r.comparison || [])}</div>`;
    } catch (_) { out.innerHTML = '<div class="empty">Comparison failed.</div>'; }
  };
}

/* ---------- router ---------- */
function setActive(link) {
  document.querySelectorAll(".nav-links a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === link));
}
function route() {
  const h = location.hash || "#/";
  document.getElementById("mainNav").classList.remove("open");
  let m;
  if (h === "#/" || h === "#") { setActive("#/"); vHome(); }
  else if ((m = h.match(/^#\/dev\/([^/]+)$/))) { setActive(""); vDev(decodeURIComponent(m[1])); }
  else if ((m = h.match(/^#\/repo\/([^/]+)\/([^/]+)$/))) { setActive(""); vRepo(decodeURIComponent(m[1]), decodeURIComponent(m[2])); }
  else if (h === "#/dashboard") { setActive("#/dashboard"); vDashboard(); }
  else if (h === "#/compare") { setActive("#/compare"); vCompare(); }
  else { view.innerHTML = '<div class="empty">Page not found. <a href="#/">Go home</a></div>'; }
}
window.addEventListener("hashchange", route);
renderAuth().then(() => { refreshRate(); route(); setInterval(refreshRate, 60000); });
