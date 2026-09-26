'use strict';
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'devhub-test-'));
process.env.DB_PATH = path.join(temp, 'test.db');
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
const app = require('../backend/server');
const gh = require('../backend/github');
const { db } = require('../backend/db');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(r => server.close(r)); db.close(); fs.rmSync(temp, { recursive: true, force: true }); });
async function request(url, method = 'GET', body, token) {
  const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
test('registration, login and private favourites persist and remain isolated', async () => {
  const name = `alice${Date.now()}`;
  const a = await request('/api/auth/register', 'POST', { username: name, email: `${name}@test.dev`, password: 'password123' });
  assert.equal(a.status, 201);
  const b = await request('/api/auth/register', 'POST', { username: name + 'b', email: `${name}b@test.dev`, password: 'password123' });
  const login = await request('/api/auth/login', 'POST', { usernameOrEmail: name, password: 'password123' });
  assert.equal(login.status, 200);
  assert.equal((await request('/api/auth/login', 'POST', { usernameOrEmail: name, password: 'wrong' })).status, 401);
  const saved = await request('/api/favorites', 'POST', { kind: 'repo', ref: 'nodejs/node', name: 'Node.js' }, a.data.token);
  assert.equal(saved.status, 201);
  assert.equal((await request('/api/favorites', 'GET', null, login.data.token)).data.length, 1);
  assert.equal((await request('/api/favorites', 'GET', null, b.data.token)).data.length, 0);
  assert.equal((await request(`/api/favorites/${saved.data.id}`, 'DELETE', null, b.data.token)).status, 404);
  assert.equal((await request(`/api/favorites/${saved.data.id}`, 'DELETE', null, a.data.token)).status, 200);
  assert.equal((await request('/api/favorites')).status, 401);
});
test('malformed login and search inputs return 400 instead of 500', async () => {
  assert.equal((await request('/api/auth/login', 'POST', { usernameOrEmail: {}, password: 'password' })).status, 400);
  assert.equal((await request('/api/search/users?q[x]=a')).status, 400);
});
test('comparison rejects repository references with extra path segments', async () => {
  const m = mock.method(gh, 'getRepo', async () => ({}));
  try { assert.equal((await request('/api/compare/repos?repoA=a/b/c&repoB=d/e')).status, 400); } finally { m.mock.restore(); }
});
test('repository analytics expose failed and pending sections without discarding the repository', async () => {
  const mocks = [
    mock.method(gh, 'getRepo', async () => ({ full_name: 'a/b', open_issues_count: 250 })),
    mock.method(gh, 'getLanguages', async () => { throw new Error('offline'); }),
    mock.method(gh, 'getContributors', async () => []),
    mock.method(gh, 'getCommitActivity', async () => ({ pending: true })),
    mock.method(gh, 'getOpenIssues', async () => [])
  ];
  try {
    const { status, data } = await request('/api/repo/a/b');
    assert.equal(status, 200);
    assert.equal(data.repo.open_issues_count, 250);
    assert.equal(data.sectionStatus.languages, 'unavailable');
    assert.equal(data.sectionStatus.activity, 'pending');
  } finally { mocks.forEach(m => m.mock.restore()); }
});
test('developer statistics explicitly disclose sampled repositories', async () => {
  const mocks = [mock.method(gh, 'getUser', async () => ({ public_repos: 240 })), mock.method(gh, 'getUserRepos', async () => [{ stargazers_count: 5 }])];
  try {
    const { data } = await request('/api/dev/example');
    assert.equal(data.stats.totalStars, 5);
    assert.equal(data.stats.sampled, true);
    assert.equal(data.stats.analyzedRepos, 1);
  } finally { mocks.forEach(m => m.mock.restore()); }
});
test('pending GitHub statistics are not cached as completed analytics', async () => {
  let count = 0;
  const m = mock.method(globalThis, 'fetch', async () => ++count === 1 ? new Response('{}', { status: 202 }) : Response.json([{ total: 12 }]));
  try {
    await gh.githubFetch('/repos/test/pending/stats/commit_activity');
    assert.deepEqual(await gh.githubFetch('/repos/test/pending/stats/commit_activity'), [{ total: 12 }]);
  } finally { m.mock.restore(); }
});
test('successful GitHub responses are cached and rate limits include retry information', async () => {
  let count = 0;
  const m = mock.method(globalThis, 'fetch', async () => { count++; return Response.json({ value: 'cached' }); });
  try {
    await gh.githubFetch('/test/cache'); await gh.githubFetch('/test/cache'); assert.equal(count, 1);
  } finally { m.mock.restore(); }
  const limited = mock.method(globalThis, 'fetch', async () => new Response('{"message":"API rate limit exceeded"}', { status: 429, headers: { 'retry-after': '35' } }));
  try { await assert.rejects(gh.githubFetch('/test/limited'), e => e.status === 429 && e.retryAfter === 35); } finally { limited.mock.restore(); }
});
test('favourites reject malformed metadata and duplicate references regardless of casing', async () => {
  const username = `validation${Date.now()}`;
  const account = await request('/api/auth/register', 'POST', { username, email: `${username}@test.dev`, password: 'password123' });
  const token = account.data.token;
  assert.equal((await request('/api/favorites', 'POST', { kind: 'repo', ref: 'nodejs/node', name: {} }, token)).status, 400);
  assert.equal((await request('/api/favorites', 'POST', { kind: 'repo', ref: 'nodejs/node', url: 'javascript:alert(1)' }, token)).status, 400);
  assert.equal((await request('/api/favorites', 'POST', { kind: 'repo', ref: 'nodejs/node', stars: 'not a number' }, token)).status, 400);
  assert.equal((await request('/api/favorites', 'POST', { kind: 'repo', ref: 'NodeJS/Node' }, token)).status, 201);
  assert.equal((await request('/api/favorites', 'POST', { kind: 'repo', ref: 'nodejs/node' }, token)).status, 409);
});
test('registration prevents case-ambiguous usernames', async () => {
  const username = `unique${Date.now()}`;
  assert.equal((await request('/api/auth/register', 'POST', { username, email: `${username}@test.dev`, password: 'password123' })).status, 201);
  assert.equal((await request('/api/auth/register', 'POST', { username: username.toUpperCase(), email: `${username}2@test.dev`, password: 'password123' })).status, 409);
});
test('developer comparison reports unavailable aggregates as null', async () => {
  const mocks = [mock.method(gh, 'getUser', async login => ({ login, public_repos: 101 })), mock.method(gh, 'getUserRepos', async () => { throw new Error('offline'); })];
  try {
    const { data } = await request('/api/compare/devs?userA=alice&userB=bob');
    assert.equal(data.comparison.find(row => row.metric === 'totalStars').a, null);
    assert.equal(data.sample.a.available, false);
  } finally { mocks.forEach(m => m.mock.restore()); }
});
