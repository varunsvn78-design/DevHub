'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.use(requireAuth);

function rowToFav(row) {
  return {
    id: row.id,
    kind: row.kind,
    ref: row.ref,
    name: row.name,
    avatar_url: row.avatar_url,
    url: row.url,
    stars: row.stars,
    description: row.description,
    created_at: row.created_at,
  };
}

// GET /api/favorites
router.get('/', (req, res, next) => {
  try {
    const rows = db.prepare('SELECT * FROM favorites WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
    return res.json(rows.map(rowToFav));
  } catch (err) {
    return next(err);
  }
});

// POST /api/favorites {kind:'dev'|'repo',ref,name,avatar_url,url,stars,description}
router.post('/', (req, res, next) => {
  try {
    const { kind, ref, name, avatar_url, url, stars, description } = req.body || {};
    if (kind !== 'dev' && kind !== 'repo') {
      return res.status(400).json({ error: "kind must be 'dev' or 'repo'" });
    }
    if (!ref || typeof ref !== 'string' || !ref.trim()) {
      return res.status(400).json({ error: 'ref is required' });
    }
    const cleanRef = ref.trim();
    const validRef = kind === 'repo' ? /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/ : /^[A-Za-z0-9-]+$/;
    if (!validRef.test(cleanRef) || cleanRef.length > 200) return res.status(400).json({ error: 'Invalid GitHub reference' });
    for (const [key, value] of Object.entries({ name, avatar_url, url, description })) {
      if (value != null && (typeof value !== 'string' || value.length > 2000)) return res.status(400).json({ error: `${key} must be a string of at most 2000 characters` });
    }
    for (const value of [avatar_url, url]) {
      if (value) {
        try { if (!['https:', 'http:'].includes(new URL(value).protocol)) throw new Error(); }
        catch { return res.status(400).json({ error: 'URLs must use http or https' }); }
      }
    }
    if (stars != null && (typeof stars !== 'number' || !Number.isSafeInteger(stars) || stars < 0)) return res.status(400).json({ error: 'stars must be a nonnegative integer' });
    const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND kind = ? AND lower(ref) = lower(?)').get(req.user.id, kind, cleanRef);
    if (existing) return res.status(409).json({ error: 'favorite already exists' });
    try {
      db.prepare(
        'INSERT INTO favorites (user_id, kind, ref, name, avatar_url, url, stars, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        req.user.id,
        kind,
        cleanRef,
        name || null,
        avatar_url || null,
        url || null,
        stars !== undefined && stars !== null ? Number(stars) : null,
        description || null
      );
    } catch (e) {
      if (e && (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE/i.test(String(e.message)))) {
        return res.status(409).json({ error: 'favorite already exists' });
      }
      throw e;
    }
    const row = db.prepare('SELECT * FROM favorites WHERE user_id = ? AND kind = ? AND ref = ?').get(req.user.id, kind, cleanRef);
    return res.status(201).json(rowToFav(row));
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/favorites/:id
router.delete('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
    const row = db.prepare('SELECT * FROM favorites WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!row) return res.status(404).json({ error: 'favorite not found' });
    db.prepare('DELETE FROM favorites WHERE id = ?').run(id);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
