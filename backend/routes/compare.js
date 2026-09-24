'use strict';

const express = require('express');
const gh = require('../github');

const router = express.Router();

function cmpRow(metric, a, b) {
  let winner = 'tie';
  if (a > b) winner = 'a';
  else if (b > a) winner = 'b';
  return { metric, a, b, winner };
}

function repoMetrics(r) {
  return {
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
    watchers: r.subscribers_count !== undefined ? r.subscribers_count : (r.watchers_count || 0),
    openIssues: r.open_issues_count || 0,
    size: r.size || 0,
  };
}

// GET /api/compare/repos?repoA=o/n&repoB=o/n -> {a,b,comparison[]}
router.get('/repos', async (req, res, next) => {
  try {
    const { repoA, repoB } = req.query;
    if (!repoA || !repoB) {
      return res.status(400).json({ error: 'query params repoA and repoB are required (format owner/name)' });
    }
    const parse = (s) => String(s).split('/').map((x) => x.trim());
    const [ownerA, nameA] = parse(repoA);
    const [ownerB, nameB] = parse(repoB);
    if (!ownerA || !nameA || !ownerB || !nameB) {
      return res.status(400).json({ error: 'repoA and repoB must be in owner/name format' });
    }
    let a;
    let b;
    try {
      [a, b] = await Promise.all([gh.getRepo(ownerA, nameA), gh.getRepo(ownerB, nameB)]);
    } catch (err) {
      if (err && err.status === 404) return res.status(404).json({ error: 'One or both repositories not found' });
      if (err && err.status === 429) {
        res.set('Retry-After', String(err.retryAfter || 60));
        return res.status(429).json({ error: err.message, retryAfter: err.retryAfter || 60 });
      }
      throw err;
    }
    const ma = repoMetrics(a);
    const mb = repoMetrics(b);
    const comparison = [
      cmpRow('stars', ma.stars, mb.stars),
      cmpRow('forks', ma.forks, mb.forks),
      cmpRow('watchers', ma.watchers, mb.watchers),
      cmpRow('openIssues', ma.openIssues, mb.openIssues),
      cmpRow('size', ma.size, mb.size),
    ];
    return res.json({ a, b, comparison });
  } catch (err) {
    return next(err);
  }
});

// GET /api/compare/devs?userA&userB -> {a,b,comparison[]}
router.get('/devs', async (req, res, next) => {
  try {
    const { userA, userB } = req.query;
    if (!userA || !userB) {
      return res.status(400).json({ error: 'query params userA and userB are required' });
    }
    let pa;
    let pb;
    try {
      [pa, pb] = await Promise.all([gh.getUser(String(userA).trim()), gh.getUser(String(userB).trim())]);
    } catch (err) {
      if (err && err.status === 404) return res.status(404).json({ error: 'One or both users not found' });
      if (err && err.status === 429) {
        res.set('Retry-After', String(err.retryAfter || 60));
        return res.status(429).json({ error: err.message, retryAfter: err.retryAfter || 60 });
      }
      throw err;
    }
    const [ra, rb] = await Promise.all([
      gh.getUserRepos(String(userA).trim(), 1, 100).catch(() => []),
      gh.getUserRepos(String(userB).trim(), 1, 100).catch(() => []),
    ]);
    const listA = Array.isArray(ra) ? ra : [];
    const listB = Array.isArray(rb) ? rb : [];
    const stars = (repos) => repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
    const forks = (repos) => repos.reduce((s, r) => s + (r.forks_count || 0), 0);
    const sa = stars(listA);
    const sb = stars(listB);
    const fa = forks(listA);
    const fb = forks(listB);
    const comparison = [
      cmpRow('followers', pa.followers || 0, pb.followers || 0),
      cmpRow('following', pa.following || 0, pb.following || 0),
      cmpRow('publicRepos', pa.public_repos || 0, pb.public_repos || 0),
      cmpRow('publicGists', pa.public_gists || 0, pb.public_gists || 0),
      cmpRow('totalStars', sa, sb),
      cmpRow('totalForks', fa, fb),
      cmpRow('repoCount', listA.length, listB.length),
    ];
    return res.json({ a: pa, b: pb, comparison });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
