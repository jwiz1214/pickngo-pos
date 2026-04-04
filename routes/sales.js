const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/sales - list sales with optional date filters
router.get('/', (req, res) => {
  const db = getDb();
  const { start, end, cashier, payment_type, limit = 100, offset = 0 } = req.query;
  let sql = 'SELECT * FROM sales WHERE 1=1';
  const params = [];

  if (start) { sql += ' AND created_at >= ?'; params.push(start); }
  if (end)   { sql += ' AND created_at <= ?'; params.push(end); }
  if (cashier)      { sql += ' AND cashier = ?';      params.push(cashier); }
  if (payment_type) { sql += ' AND payment_type = ?'; params.push(payment_type); }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// GET /api/sales/stats - today, MTD, YTD totals
router.get('/stats', (req, res) => {
  const db = getDb();

  const today = db.prepare(`
    SELECT
      COUNT(*) as transaction_count,
      COALESCE(SUM(total), 0)    as total,
      COALESCE(SUM(subtotal), 0) as subtotal,
      COALESCE(SUM(tax), 0)      as tax,
      COALESCE(SUM(discount), 0) as discount
    FROM sales
    WHERE date(created_at) = date('now','localtime')
  `).get();

  const mtd = db.prepare(`
    SELECT
      COUNT(*) as transaction_count,
      COALESCE(SUM(total), 0)    as total,
      COALESCE(SUM(subtotal), 0) as subtotal,
      COALESCE(SUM(tax), 0)      as tax,
      COALESCE(SUM(discount), 0) as discount
    FROM sales
    WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
  `).get();

  const ytd = db.prepare(`
    SELECT
      COUNT(*) as transaction_count,
      COALESCE(SUM(total), 0)    as total,
      COALESCE(SUM(subtotal), 0) as subtotal,
      COALESCE(SUM(tax), 0)      as tax,
      COALESCE(SUM(discount), 0) as discount
    FROM sales
    WHERE strftime('%Y', created_at) = strftime('%Y', 'now', 'localtime')
  `).get();

  const topProducts = db.prepare(`
    SELECT si.product_name, SUM(si.qty) as units_sold, SUM(si.qty * si.unit_price) as revenue
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE date(s.created_at) = date('now','localtime')
    GROUP BY si.product_name
    ORDER BY units_sold DESC
    LIMIT 5
  `).all();

  const paymentBreakdown = db.prepare(`
    SELECT payment_type, COUNT(*) as count, SUM(total) as total
    FROM sales
    WHERE date(created_at) = date('now','localtime')
    GROUP BY payment_type
  `).all();

  res.json({ today, mtd, ytd, top_products_today: topProducts, payment_breakdown_today: paymentBreakdown });
});

// GET /api/sales/:id - single sale with line items
router.get('/:id', (req, res) => {
  const db = getDb();
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
  res.json({ ...sale, items });
});

// POST /api/sales - create a new sale
// Body: { subtotal, tax, discount, payment_type, cashier, register_id, items: [{product_id, product_name, qty, unit_price}] }
router.post('/', (req, res) => {
  const db = getDb();
  const { subtotal, tax = 0, discount = 0, payment_type = 'cash', cashier, register_id, items } = req.body;

  if (subtotal == null) return res.status(400).json({ error: 'subtotal is required' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array is required' });

  const total = subtotal + tax - discount;

  const createSale = db.transaction(() => {
    const saleResult = db.prepare(`
      INSERT INTO sales (total, subtotal, tax, discount, payment_type, cashier, register_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(total, subtotal, tax, discount, payment_type, cashier || null, register_id || null);

    const saleId = saleResult.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, product_name, qty, unit_price)
      VALUES (?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock > 0');

    for (const item of items) {
      if (!item.product_name || item.qty == null || item.unit_price == null) {
        throw new Error('Each item requires product_name, qty, and unit_price');
      }
      insertItem.run(saleId, item.product_id || null, item.product_name, item.qty, item.unit_price);
      if (item.product_id) {
        updateStock.run(item.qty, item.product_id);
      }
    }

    return saleId;
  });

  let saleId;
  try {
    saleId = createSale();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  res.status(201).json({ ...sale, items: saleItems });
});

// DELETE /api/sales/:id - void a sale (restores stock)
router.delete('/:id', (req, res) => {
  const db = getDb();
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  const voidSale = db.transaction(() => {
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
    const restoreStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
    for (const item of items) {
      if (item.product_id) restoreStock.run(item.qty, item.product_id);
    }
    db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
  });

  voidSale();
  res.json({ voided: true, id: Number(req.params.id) });
});

module.exports = router;
