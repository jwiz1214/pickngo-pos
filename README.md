# Pick-N-Go POS — Backend

Node.js + Express + SQLite backend for a Michigan party store point-of-sale system.

---

## Quick Start (Windows)

```cmd
cd C:\Users\17343\Desktop\pickngo-pos
copy .env.example .env
npm install
npm start
```

Server starts at **http://localhost:3001**

---

## Project Structure

```
pickngo-pos/
├── server.js                  # Express entry point (port 3001)
├── database.js                # SQLite setup, schema, seed data
├── routes/
│   ├── products.js            # /api/products
│   ├── sales.js               # /api/sales
│   ├── promotions.js          # /api/promotions
│   ├── settings.js            # /api/settings
│   └── mlcc.js                # /api/mlcc
├── scheduler/
│   └── mlccScheduler.js       # Quarterly MLCC price book sync
├── .env.example
├── .gitignore
└── package.json
```

---

## Environment Variables

Copy `.env.example` to `.env` and edit as needed:

| Variable       | Default         | Description                  |
|----------------|-----------------|------------------------------|
| `PORT`         | `3001`          | HTTP port                    |
| `DATABASE_URL` | `./pickngo.db`  | Path to SQLite database file |

---

## API Reference

### Health

| Method | Endpoint  | Description            |
|--------|-----------|------------------------|
| GET    | /health   | Server + DB status     |

---

### Products  `/api/products`

| Method | Endpoint                  | Description                        |
|--------|---------------------------|------------------------------------|
| GET    | /api/products             | List all (`?category=` `?search=`) |
| GET    | /api/products/categories  | Distinct category list             |
| GET    | /api/products/:id         | Single product                     |
| POST   | /api/products             | Create product                     |
| PUT    | /api/products/:id         | Update product                     |
| PATCH  | /api/products/:id/stock   | Quick stock update                 |
| DELETE | /api/products/:id         | Delete product                     |

**Product body fields:**
```json
{
  "name": "Bud Light 30pk",
  "detail": "30 x 12oz Cans",
  "base_price": 24.99,
  "category": "beer",
  "emoji": "🍺",
  "age_restricted": 1,
  "stock": 50,
  "barcode": "018200007531"
}
```

---

### Sales  `/api/sales`

| Method | Endpoint           | Description                         |
|--------|--------------------|-------------------------------------|
| GET    | /api/sales         | List sales (`?start=` `?end=` etc.) |
| GET    | /api/sales/stats   | Today / MTD / YTD totals            |
| GET    | /api/sales/:id     | Single sale with line items         |
| POST   | /api/sales         | Create a new sale                   |
| DELETE | /api/sales/:id     | Void a sale (restores stock)        |

**Sale body:**
```json
{
  "subtotal": 34.99,
  "tax": 2.10,
  "discount": 0,
  "payment_type": "cash",
  "cashier": "Mike",
  "register_id": "REG1",
  "items": [
    { "product_id": 1, "product_name": "Bud Light 30pk", "qty": 1, "unit_price": 24.99 },
    { "product_id": 15, "product_name": "Tito's Vodka", "qty": 1, "unit_price": 19.99 }
  ]
}
```

---

### Promotions  `/api/promotions`

| Method | Endpoint                     | Description              |
|--------|------------------------------|--------------------------|
| GET    | /api/promotions              | List all (`?active=1`)   |
| GET    | /api/promotions/active       | Valid promos for today   |
| GET    | /api/promotions/:id          | Single promo             |
| POST   | /api/promotions              | Create promo             |
| PUT    | /api/promotions/:id          | Update promo             |
| PATCH  | /api/promotions/:id/toggle   | Flip active flag         |
| DELETE | /api/promotions/:id          | Delete promo             |

**Promotion types:** `percent`, `fixed`, `bogo`

---

### Settings  `/api/settings`

| Method | Endpoint              | Description            |
|--------|-----------------------|------------------------|
| GET    | /api/settings         | All settings as map    |
| GET    | /api/settings/:key    | Single setting         |
| PUT    | /api/settings/:key    | Upsert single setting  |
| POST   | /api/settings/bulk    | Upsert multiple        |
| DELETE | /api/settings/:key    | Remove setting         |

**Default settings seeded:** `store_name`, `tax_rate`, `register_count`, `city`, `currency`, `receipt_footer`, `age_check_enabled`

---

### MLCC Prices  `/api/mlcc`

| Method | Endpoint                | Description                          |
|--------|-------------------------|--------------------------------------|
| GET    | /api/mlcc               | All MLCC minimum prices              |
| GET    | /api/mlcc/:productName  | Min price for one product            |
| POST   | /api/mlcc               | Add / update MLCC entry manually     |
| PUT    | /api/mlcc/:productName  | Update MLCC entry                    |
| DELETE | /api/mlcc/:productName  | Remove entry                         |
| POST   | /api/mlcc/sync          | Manually trigger price book fetch    |

**Pre-seeded MLCC minimums:**

| Product          | Min Price | Size  |
|------------------|-----------|-------|
| Hennessy VS      | $39.99    | 750ml |
| Hennessy VSOP    | $58.99    | 750ml |
| Tito's Vodka     | $19.99    | 750ml |
| Jack Daniel's    | $29.99    | 750ml |
| Patron Silver    | $44.99    | 750ml |
| Crown Royal      | $29.99    | 750ml |
| Ciroc Peach      | $30.99    | 750ml |
| Courvoisier VS   | $39.99    | 750ml |

---

## MLCC Scheduler

The scheduler automatically fetches the Michigan MLCC quarterly price book Excel from `michigan.gov` and updates the `mlcc_prices` table.

**Schedule:** Midnight (ET) on **February 1, May 1, August 1, November 1**

You can also trigger a manual sync via the API:
```
POST /api/mlcc/sync
```

> **Note:** If LARA reorganizes their website, update `MLCC_PRICE_BOOK_URL` in `scheduler/mlccScheduler.js`.

---

## Database Tables

| Table         | Purpose                              |
|---------------|--------------------------------------|
| `products`    | Inventory with MLCC age-restricted flag |
| `sales`       | Transaction header                   |
| `sale_items`  | Line items per transaction           |
| `promotions`  | Discounts / BOGO deals               |
| `settings`    | Key-value store config               |
| `mlcc_prices` | Michigan MLCC minimum retail prices  |

---

## Push to GitHub

```cmd
cd C:\Users\17343\Desktop\pickngo-pos
git init
git add .
git commit -m "Initial backend: Express + SQLite POS for Pick-N-Go"
git branch -M main
git remote add origin https://github.com/jwiz1214/pickngo-pos.git
git push -u origin main
```

> If the remote already exists: `git remote set-url origin https://github.com/jwiz1214/pickngo-pos.git`

---

## Development

```cmd
npm install -g nodemon
npm run dev
```

Nodemon watches for file changes and auto-restarts the server.
