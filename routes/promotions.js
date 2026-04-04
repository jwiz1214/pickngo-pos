const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/promotions - list all, optional ?active=1
router.get('/', (req, res) => {
  const db = getDb();
  const { active } = req.query;
  let sql = 'SELECT * FROM promotions WHERE 1=1';
  const params = [];

  if (active !== undefined) {
    sql += ' AND active = ?';
    params.push(active === '1' || active === 'true' ? 1 : 0);
  }
  sql += ' ORDER BY id DESC';

  res.json(db.prepare(sql).all(...params));
});

// GET /api/promotions/active - active promos valid today
router.get('/active', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM promotions
    WHERE active = 1
      AND (start_date IS NULL OR start_date <= date('now','localtime'))
      AND (end_date   IS NULL OR end_date   >= date('now','localtime'))
    ORDER BY id DESC
  `).all();
  res.json(rows);
});

// GET /api/promotions/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Promotion not found' });
  res.json(row);
});

// POST /api/promotions
router.post('/', (req, res) => {
  const db = getDb();
  const { name, type, value, category, start_date, end_date, description, active = 1 } = req.body;
  if (!name || !type || value == null) {
    return res.status(400).json({ error: 'name, type, and value are required' });
  }
  if (!['percent', 'fixed', 'bogo'].includes(type)) {
    return res.status(400).json({ error: 'type must be percent, fixed, or bogo' });
  }

  const result = db.prepare(`
    INSERT INTO promotions (name, type, value, category, start_date, end_date, description, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, type, value, category || null, start_date || null, end_date || null, description || null, active ? 1 : 0);

  res.status(201).json(db.prepare('SELECT * FROM promotions WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /api/promotions/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Promotion not found' });

  const { name, type, value, category, start_date, end_date, description, active } = req.body;
  db.prepare(`
    UPDATE promotions
    SET name=?, type=?, value=?, category=?, start_date=?, end_date=?, description=?, active=?
    WHERE id=?
  `).run(
    name       ?? existing.name,
    type       ?? existing.type,
    value      ?? existing.value,
    category   ?? existing.category,
    start_date ?? existing.start_date,
    end_date   ?? existing.end_date,
    description ?? existing.description,
    active != null ? (active ? 1 : 0) : existing.active,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id));
});

// PATCH /api/promotions/:id/toggle - flip active flag
router.patch('/:id/toggle', (req, res) => {
  const db = getDb();
  const result = db.prepare('UPDATE promotions SET active = 1 - active WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Promotion not found' });
  res.json(db.prepare('SELECT * FROM promotions WHERE id = ?').get(req.params.id));
});

// DELETE /api/promotions/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM promotions WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Promotion not found' });
  res.json({ deleted: true, id: Number(req.params.id) });
});

module.exports = router;
