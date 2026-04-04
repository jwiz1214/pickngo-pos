const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/products - list all, optional ?category= and ?search=
router.get('/', (req, res) => {
  const db = getDb();
  const { category, search } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    sql += ' AND (name LIKE ? OR barcode = ?)';
    params.push(`%${search}%`, search);
  }
  sql += ' ORDER BY category, name';

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// GET /api/products/categories - distinct category list
router.get('/categories', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
  res.json(rows.map(r => r.category));
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json(row);
});

// POST /api/products
router.post('/', (req, res) => {
  const db = getDb();
  const { name, detail, base_price, category, emoji, age_restricted, stock, barcode } = req.body;
  if (!name || base_price == null || !category) {
    return res.status(400).json({ error: 'name, base_price, and category are required' });
  }
  const result = db.prepare(`
    INSERT INTO products (name, detail, base_price, category, emoji, age_restricted, stock, barcode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, detail || null, base_price, category, emoji || '🛍️', age_restricted ? 1 : 0, stock || 0, barcode || null);

  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const { name, detail, base_price, category, emoji, age_restricted, stock, barcode } = req.body;
  db.prepare(`
    UPDATE products
    SET name=?, detail=?, base_price=?, category=?, emoji=?, age_restricted=?, stock=?, barcode=?
    WHERE id=?
  `).run(
    name ?? existing.name,
    detail ?? existing.detail,
    base_price ?? existing.base_price,
    category ?? existing.category,
    emoji ?? existing.emoji,
    age_restricted != null ? (age_restricted ? 1 : 0) : existing.age_restricted,
    stock ?? existing.stock,
    barcode ?? existing.barcode,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

// PATCH /api/products/:id/stock - quick stock adjustment
router.patch('/:id/stock', (req, res) => {
  const db = getDb();
  const { stock } = req.body;
  if (stock == null) return res.status(400).json({ error: 'stock value required' });
  const result = db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(stock, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ id: Number(req.params.id), stock });
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ deleted: true, id: Number(req.params.id) });
});

module.exports = router;
