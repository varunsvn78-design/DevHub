'use strict';

const express = require('express');
const { db } = require('../db');
const { hashPassword, comparePassword, signToken, publicUser, requireAuth } = require('../auth');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

router.post('/register', (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || typeof username !== 'string' || username.trim().length < 2 || username.trim().length > 40) {
      return res.status(400).json({ error: 'username must be 2–40 characters' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'valid email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) {
      return res.status(400).json({ error: 'password must be at least 8 characters and at most 72 bytes' });
    }
    const uname = username.trim();
    const mail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id, username, email FROM users WHERE lower(username) = lower(?) OR email = ?').get(uname, mail);
    if (existing) {
      return res.status(409).json({ error: 'username or email already taken' });
    }
    const passwordHash = hashPassword(password);
    const info = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').run(uname, mail, passwordHash);
    const row = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(info.lastInsertRowid);
    const user = publicUser(row);
    const token = signToken(user);
    return res.status(201).json({ token, user });
  } catch (err) {
    return next(err);
  }
});

router.post('/login', (req, res, next) => {
  try {
    const { usernameOrEmail, username, email, password } = req.body || {};
    const rawIdent = usernameOrEmail || username || email || '';
    const ident = typeof rawIdent === 'string' ? rawIdent.trim() : '';
    if (!ident) {
      return res.status(400).json({ error: 'usernameOrEmail is required' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'password is required' });
    }
    const key = ident.toLowerCase();
    const row = db.prepare('SELECT * FROM users WHERE lower(username) = ? OR lower(email) = ?').get(key, key);
    if (!row || !comparePassword(password, row.password_hash)) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    const user = publicUser(row);
    const token = signToken(user);
    return res.json({ token, user });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', requireAuth, (req, res, next) => {
  try {
    const row = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(req.user.id);
    if (!row) return res.status(404).json({ error: 'user not found' });
    return res.json({ user: publicUser(row) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
