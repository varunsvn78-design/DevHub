'use strict';

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, 'devhub.db');
const db = new DatabaseSync(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('dev','repo')),
  ref TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  url TEXT,
  stars INTEGER,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, kind, ref)
);
CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_fav_user ON favorites(user_id);
`);

function getCache(key) {
  try {
    const row = db.prepare('SELECT value, expires_at FROM cache WHERE key = ?').get(key);
    if (!row) return null;
    if (Date.now() > row.expires_at) {
      db.prepare('DELETE FROM cache WHERE key = ?').run(key);
      return null;
    }
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

function setCache(key, value, ttlMs) {
  const expiresAt = Date.now() + ttlMs;
  const str = JSON.stringify(value);
  db.prepare(
    'INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at'
  ).run(key, str, expiresAt);
}

function delCache(key) {
  db.prepare('DELETE FROM cache WHERE key = ?').run(key);
}

function cacheSize() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM cache WHERE expires_at > ?').get(Date.now());
  return row ? row.n : 0;
}

setInterval(() => {
  try {
    db.prepare('DELETE FROM cache WHERE expires_at <= ?').run(Date.now());
  } catch {
    // ignore
  }
}, 60 * 1000).unref();

module.exports = { db, getCache, setCache, delCache, cacheSize };
