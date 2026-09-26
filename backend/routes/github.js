'use strict';

const express = require('express');
const gh = require('../github');

const router = express.Router();

function parsePaging(req, defPage = 1, defPerPage = 10) {
  let page = parseInt(req.query.page, 10);
  let perPage = parseInt(req.query.per_page, 10);
  if (Number.isNaN(page) || page < 1) page = defPage;
  if (Number.isNaN(perPage) || perPage < 1) perPage = defPerPage;
  perPage = Math.min(perPage, 100);
  return { page, perPage };
}

function toHttpError(err, res, fallbackMsg) {
  if (err && err.status === 404) return res.status(404).json({ error: fallbackMsg || 'Not found' });
  if (err && err.status === 429) {
    res.set('Retry-After', String(err.retryAfter || 60));
    return res.status(429).json({ error: err.message, retryAfter: err.retryAfter || 60 });
  }
  throw err;
}

// GET /api/search/users?q&page&per_page -> {items,total_count}
router.get('/search/users', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) return res.status(400).json({ error: 'query param q is required' });
    const { page, perPage } = parsePaging(req);
    const data = await gh.searchUsers(q, page, perPage);
    return res.json({ items: data.items || [], total_count: data.total_count || 0 });
  } catch (err) {
    try {
      return toHttpError(err, res);
    } catch (e) {
      return next(e);
    }
  }
});

// GET /api/search/repos?q&sort&order&page&per_page -> {items,total_count}
router.get('/search/repos', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) return res.status(400).json({ error: 'query param q is required' });
    const { page, perPage } = parsePaging(req);
    const sort = req.query.sort || undefined;
    const order = req.query.order || undefined;
    const data = await gh.searchRepos(q, sort, order, page, perPage);
    return res.json({ items: data.items || [], total_count: data.total_count || 0 });
  } catch (err) {
    try {
      return toHttpError(err, res);
    } catch (e) {
      return next(e);
    }
  }
});

// GET /api/dev/:username -> {profile,repos,stats}
router.get('/dev/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!username) return res.status(400).json({ error: 'username is required' });
    let profile;
    try {
      profile = await gh.getUser(username);
    } catch (err) {
      return toHttpError(err, res, 'User not found');
    }
    let repos = [];
    let reposAvailable = true;
    try {
      repos = await gh.getUserRepos(username, 1, 100);
      if (!Array.isArray(repos)) repos = [];
    } catch {
      reposAvailable = false;
      repos = [];
    }
    let totalStars = 0;
    let totalForks = 0;
    const langBytes = {};
    for (const r of repos) {
      totalStars += r.stargazers_count || 0;
      totalForks += r.forks_count || 0;
      if (r.language) langBytes[r.language] = (langBytes[r.language] || 0) + 1;
    }
    const topLanguages = Object.entries(langBytes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([language, count]) => ({ language, count }));
    return res.json({ profile, repos, stats: { totalStars: reposAvailable ? totalStars : null, totalForks: reposAvailable ? totalForks : null, topLanguages, reposAvailable, analyzedRepos: repos.length, sampled: repos.length < profile.public_repos } });
  } catch (err) {
    return next(err);
  }
});

// GET /api/repo/:owner/:name
router.get('/repo/:owner/:name', async (req, res, next) => {
  try {
    const { owner, name } = req.params;
    if (!owner || !name) return res.status(400).json({ error: 'owner and name are required' });
    let repo;
    try {
      repo = await gh.getRepo(owner, name);
    } catch (err) {
      return toHttpError(err, res, 'Repository not found');
    }
    const sectionStatus = {};
    async function section(key, request, fallback) {
      try {
        const value = await request;
        sectionStatus[key] = value?.pending ? 'pending' : 'ready';
        return value;
      } catch {
        sectionStatus[key] = 'unavailable';
        return fallback;
      }
    }
    const [languages, contributors, activity, issues] = await Promise.all([
      section('languages', gh.getLanguages(owner, name), {}),
      section('contributors', gh.getContributors(owner, name, 10), []),
      section('activity', gh.getCommitActivity(owner, name), []),
      section('issues', gh.getOpenIssues(owner, name, 5), []),
    ]);
    const langs = languages && typeof languages === 'object' ? languages : {};
    const total = Object.values(langs).reduce((a, b) => a + (Number(b) || 0), 0);
    const languageDistribution = Object.entries(langs).map(([language, bytes]) => ({
      language,
      bytes,
      percent: total ? Math.round(((Number(bytes) || 0) / total) * 1000) / 10 : 0,
    })).sort((a, b) => b.bytes - a.bytes);
    const contribList = Array.isArray(contributors)
      ? contributors.map((c) => ({ login: c.login, avatar_url: c.avatar_url, contributions: c.contributions }))
      : [];
    const activityList = Array.isArray(activity)
      ? activity.map((w) => ({ week: w.week, commits: w.total }))
      : [];
    const openIssues = Array.isArray(issues) ? issues : [];
    return res.json({ repo, languages: langs, languageDistribution, contributors: contribList, activity: activityList, openIssues, sectionStatus });
  } catch (err) {
    return next(err);
  }
});

// GET /api/ratelimit
router.get('/ratelimit', async (req, res, next) => {
  try {
    let rate = gh.getRateState();
    if (rate.limit === null) {
      try {
        await gh.githubFetch('/rate_limit');
        rate = gh.getRateState();
      } catch {
        // keep nulls
      }
    }
    return res.json({
      github: { limit: rate.limit, remaining: rate.remaining, reset: rate.reset },
      cacheSize: gh.cacheSize(),
      tokenConfigured: gh.isTokenConfigured(),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
