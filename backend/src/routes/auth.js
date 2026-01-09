const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const router = express.Router();

// In-memory user store for demo purposes
const users = new Map(); // key: email, value: { email, name, passwordHash, plan }

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRES_IN = '7d';

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, plan = 'free' } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (users.has(email)) return res.status(409).json({ error: 'User already exists' });
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = { email, name: name || email.split('@')[0], passwordHash, plan };
    users.set(email, user);
    const token = jwt.sign({ sub: email, name: user.name, plan: user.plan }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.status(201).json({ token, user: { email, name: user.name, plan: user.plan } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const user = users.get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ sub: email, name: user.name, plan: user.plan }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ token, user: { email, name: user.name, plan: user.plan } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/me', (req, res) => {
  try {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = users.get(payload.sub);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: { email: user.email, name: user.name, plan: user.plan } });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
