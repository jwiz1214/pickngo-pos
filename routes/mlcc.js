const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { fetchAndUpdateMlccPrices } = require('../scheduler/mlccScheduler');

// GET /api/mlcc - all MLCC minimum prices
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM mlcc_prices ORDER BY product_name').all();
  res.json(rows);
});

// GET /api/mlcc/:productName - lookup min price for one product
router.get('/:productName', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM mlcc_prices WHERE product_name = ?').get(req.params.productName);
  if (!row) return res.status(404).json({ error: 'Product not in MLCC price list' });
  res.json(row);
});

// POST /api/mlcc - manually add or update an MLCC price entry
router.post('/', (req, res) => {
  const db = getDb();
  const { product_name, mlcc_min, size } = req.body;
  if (!product_name || mlcc_min == null) {
    return res.status(400).json({ error: 'product_name and mlcc_min are required' });
  }
  db.prepare(`
    INSERT INTO mlcc_prices (product_name, mlcc_min, size, last_updated)
    VALUES (?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(product_name) DO UPDATE SET
      mlcc_min     = excluded.mlcc_min,
      size         = excluded.size,
      last_updated = excluded.last_updated
  `).run(product_name, mlcc_min, size || null);

  res.status(201).json(db.prepare('SELECT * FROM mlcc_prices WHERE product_name = ?').get(product_name));
});

// PUT /api/mlcc/:productName
router.put('/:productName', (req, res) => {
  const db = getDb();
  const { mlcc_min, size } = req.body;
  if (mlcc_min == null) return res.status(400).json({ error: 'mlcc_min is required' });

  const existing = db.prepare('SELECT * FROM mlcc_prices WHERE product_name = ?').get(req.params.productName);
  if (!existing) return res.status(404).json({ error: 'Product not in MLCC price list' });

  db.prepare(`
    UPDATE mlcc_prices
    SET mlcc_min = ?, size = ?, last_updated = datetime('now','localtime')
    WHERE product_name = ?
  `).run(mlcc_min, size ?? existing.size, req.params.productName);

  res.json(db.prepare('SELECT * FROM mlcc_prices WHERE product_name = ?').get(req.params.productName));
});

// DELETE /api/mlcc/:productName
router.delete('/:productName', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM mlcc_prices WHERE product_name = ?').run(req.params.productName);
  if (result.changes === 0) return res.status(404).json({ error: 'Product not in MLCC price list' });
  res.json({ deleted: true, product_name: req.params.productName });
});

// POST /api/mlcc/sync - manually trigger MLCC price book fetch
router.post('/sync', async (req, res) => {
  try {
    const result = await fetchAndUpdateMlccPrices();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
});

module.exports = router;
