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
