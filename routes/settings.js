const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/settings - all settings as { key: value } map
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
  const map = {};
  for (const row of rows) map[row.key] = row.value;
  res.json(map);
});

// GET /api/settings/:key
router.get('/:key', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key);
  if (!row) return res.status(404).json({ error: 'Setting not found' });
  res.json(row);
});

// PUT /api/settings/:key - upsert a single setting
router.put('/:key', (req, res) => {
  const db = getDb();
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value is required' });
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(req.params.key, String(value));
  res.json({ key: req.params.key, value: String(value) });
});

// POST /api/settings/bulk - upsert multiple settings at once
// Body: { store_name: "My Store", tax_rate: "0.06", ... }
router.post('/bulk', (req, res) => {
  const db = getDb();
  const entries = Object.entries(req.body);
  if (entries.length === 0) return res.status(400).json({ error: 'No settings provided' });

  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const upsertMany = db.transaction((pairs) => {
    for (const [key, value] of pairs) upsert.run(key, String(value));
  });
  upsertMany(entries);

  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
  const map = {};
  for (const row of rows) map[row.key] = row.value;
  res.json(map);
});

// DELETE /api/settings/:key
router.delete('/:key', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM settings WHERE key = ?').run(req.params.key);
  if (result.changes === 0) return res.status(404).json({ error: 'Setting not found' });
  res.json({ deleted: true, key: req.params.key });
});

module.exports = router;
