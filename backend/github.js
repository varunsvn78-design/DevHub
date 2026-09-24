'use strict';

const { getCache, setCache, cacheSize } = require('./db');

const CACHE_TTL_MS = 10 * 60 * 1000;
const API_BASE = 'https://api.github.com';

const memCache = new Map();

const rateState = { limit: null, remaining: null, reset: null };

function isTokenConfigured() {
  return Boolean(process.env.GITHUB_TOKEN);
}

function baseHeaders() {
  const h = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'DevHub/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

function captureRateLimit(res) {
  const l = res.headers.get('x-ratelimit-limit');
  const r = res.headers.get('x-ratelimit-remaining');
  const t = res.headers.get('x-ratelimit-reset');
  if (l !== null) rateState.limit = Number(l);
  if (r !== null) rateState.remaining = Number(r);
  if (t !== null) rateState.reset = Number(t);
}

function retryAfterSeconds(res) {
  const ra = res.headers.get('retry-after');
  if (ra && !Number.isNaN(Number(ra))) return Number(ra);
  if (rateState.reset) {
    const s = Math.ceil(rateState.reset - Date.now() / 1000);
    return s > 0 ? s : 0;
  }
  return 60;
}

function rateLimitError(res, bodyText) {
  const err = new Error('GitHub rate limit exceeded. Try again shortly.');
  err.status = 429;
  err.retryAfter = retryAfterSeconds(res);
  err.detail = bodyText ? bodyText.slice(0, 500) : undefined;
  return err;
}

function getMem(key) {
  const e = memCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return e.value;
}

function setMem(key, value) {
  memCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  if (memCache.size > 500) {
    const oldest = memCache.keys().next().value;
    memCache.delete(oldest);
  }
}

async function githubFetch(apiPath) {
  const cached = getMem(apiPath) || getCache(apiPath);
  if (cached) {
    if (!getMem(apiPath)) setMem(apiPath, cached);
    return cached;
  }
  let res;
  try {
    res = await fetch(API_BASE + apiPath, { headers: baseHeaders() });
  } catch (e) {
    const err = new Error('Failed to reach GitHub API');
    err.status = 502;
    err.cause = e;
    throw err;
  }
  captureRateLimit(res);
  if (res.status === 404) {
    const err = new Error('Not found');
    err.status = 404;
    throw err;
  }
  if (res.status === 403 || res.status === 429) {
    const text = await res.text().catch(() => '');
    throw rateLimitError(res, text);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`GitHub API error: ${res.status}`);
    err.status = res.status === 401 ? 502 : 502;
    err.detail = text ? text.slice(0, 500) : undefined;
    throw err;
  }
  const data = await res.json();
  setMem(apiPath, data);
  try {
    setCache(apiPath, data, CACHE_TTL_MS);
  } catch {
    // cache write is best-effort
  }
  return data;
}

function buildQuery(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

function searchUsers(q, page, perPage) {
  return githubFetch(`/search/users${buildQuery({ q, page, per_page: perPage })}`);
}

function searchRepos(q, sort, order, page, perPage) {
  return githubFetch(`/search/repositories${buildQuery({ q, sort, order, page, per_page: perPage })}`);
}

function getUser(username) {
  return githubFetch(`/users/${encodeURIComponent(username)}`);
}

function getUserRepos(username, page = 1, perPage = 100) {
  return githubFetch(`/users/${encodeURIComponent(username)}/repos${buildQuery({ page, per_page: perPage, sort: 'updated', direction: 'desc' })}`);
}

function getRepo(owner, name) {
  return githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
}

function getLanguages(owner, name) {
  return githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/languages`);
}

function getContributors(owner, name, perPage = 10) {
  return githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contributors${buildQuery({ per_page: perPage })}`);
}

function getCommitActivity(owner, name) {
  return githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/stats/commit_activity`);
}

function getOpenIssues(owner, name, perPage = 5) {
  return githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues${buildQuery({ state: 'open', per_page: perPage })}`);
}

function getRateState() {
  return { ...rateState };
}

module.exports = {
  githubFetch,
  searchUsers,
  searchRepos,
  getUser,
  getUserRepos,
  getRepo,
  getLanguages,
  getContributors,
  getCommitActivity,
  getOpenIssues,
  getRateState,
  isTokenConfigured,
  cacheSize,
  CACHE_TTL_MS,
};
