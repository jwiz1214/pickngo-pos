const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_URL || './pickngo.db';

let db;

function getDb() {
  if (!db) {
    db = new Database(path.resolve(DB_PATH));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      detail      TEXT,
      base_price  REAL    NOT NULL,
      category    TEXT    NOT NULL,
      emoji       TEXT    DEFAULT '🛍️',
      age_restricted INTEGER DEFAULT 0,
      stock       INTEGER DEFAULT 0,
      barcode     TEXT    UNIQUE
    );

    CREATE TABLE IF NOT EXISTS sales (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      total        REAL    NOT NULL,
      subtotal     REAL    NOT NULL,
      tax          REAL    NOT NULL DEFAULT 0,
      discount     REAL    NOT NULL DEFAULT 0,
      payment_type TEXT    NOT NULL DEFAULT 'cash',
      cashier      TEXT,
      register_id  TEXT,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id      INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT    NOT NULL,
      qty          INTEGER NOT NULL DEFAULT 1,
      unit_price   REAL    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      type        TEXT    NOT NULL CHECK(type IN ('percent','fixed','bogo')),
      value       REAL    NOT NULL DEFAULT 0,
      category    TEXT,
      start_date  TEXT,
      end_date    TEXT,
      description TEXT,
      active      INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS mlcc_prices (
      product_name TEXT PRIMARY KEY,
      mlcc_min     REAL NOT NULL,
      size         TEXT,
      last_updated TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  seedProducts();
  seedMlcc();
  seedSettings();
}

function seedProducts() {
  const count = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO products (name, detail, base_price, category, emoji, age_restricted, stock, barcode)
    VALUES (@name, @detail, @base_price, @category, @emoji, @age_restricted, @stock, @barcode)
  `);

  const products = [
    // Beer
    { name: 'Bud Light 30pk', detail: '30 x 12oz Cans', base_price: 24.99, category: 'beer', emoji: '🍺', age_restricted: 1, stock: 50, barcode: '018200007531' },
    { name: 'Bud Light 6pk', detail: '6 x 12oz Bottles', base_price: 9.99, category: 'beer', emoji: '🍺', age_restricted: 1, stock: 80, barcode: '018200007548' },
    { name: 'Miller Lite 30pk', detail: '30 x 12oz Cans', base_price: 24.99, category: 'beer', emoji: '🍺', age_restricted: 1, stock: 40, barcode: '071990000929' },
    { name: 'Miller Lite 6pk', detail: '6 x 12oz Cans', base_price: 9.99, category: 'beer', emoji: '🍺', age_restricted: 1, stock: 60, barcode: '071990000936' },
    { name: 'Coors Light 30pk', detail: '30 x 12oz Cans', base_price: 24.99, category: 'beer', emoji: '🍺', age_restricted: 1, stock: 45, barcode: '071990305124' },
    { name: 'Busch Light 30pk', detail: '30 x 12oz Cans', base_price: 22.99, category: 'beer', emoji: '🍺', age_restricted: 1, stock: 35, barcode: '018200632894' },
    { name: 'Natural Light 30pk', detail: '30 x 12oz Cans', base_price: 19.99, category: 'beer', emoji: '🍺', age_restricted: 1, stock: 30, barcode: '018200605998' },
    { name: 'Corona Extra 6pk', detail: '6 x 12oz Bottles', base_price: 10.99, category: 'beer', emoji: '🍺', age_restricted: 1, stock: 50, barcode: '074748001111' },
    { name: 'Heineken 6pk', detail: '6 x 12oz Bottles', base_price: 10.99, category: 'beer', emoji: '🍺', age_restricted: 1, stock: 45, barcode: '072017013419' },
    { name: 'Modelo Especial 6pk', detail: '6 x 12oz Cans', base_price: 10.99, category: 'beer', emoji: '🍺', age_restricted: 1, stock: 55, barcode: '074748001234' },
    { name: 'Blue Moon 6pk', detail: '6 x 12oz Bottles', base_price: 11.99, category: 'beer', emoji: '🍺', age_restricted: 1, stock: 30, barcode: '071990200207' },
    { name: 'Stella Artois 6pk', detail: '6 x 11.2oz Bottles', base_price: 11.99, category: 'beer', emoji: '🍺', age_restricted: 1, stock: 30, barcode: '000229010307' },
    // Spirits
    { name: "Hennessy VS", detail: '750ml Cognac', base_price: 39.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 20, barcode: '087236000101' },
    { name: "Hennessy VSOP", detail: '750ml Cognac', base_price: 58.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 15, barcode: '087236000202' },
    { name: "Tito's Vodka", detail: '750ml Vodka', base_price: 19.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 30, barcode: '619947000101' },
    { name: "Jack Daniel's", detail: '750ml Tennessee Whiskey', base_price: 29.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 25, barcode: '082184001108' },
    { name: 'Patron Silver', detail: '750ml Tequila', base_price: 44.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 20, barcode: '721733000101' },
    { name: 'Crown Royal', detail: '750ml Canadian Whisky', base_price: 29.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 25, barcode: '082000736578' },
    { name: 'Ciroc Peach', detail: '750ml Vodka', base_price: 30.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 20, barcode: '088004023501' },
    { name: 'Courvoisier VS', detail: '750ml Cognac', base_price: 39.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 15, barcode: '080686801009' },
    { name: 'Smirnoff Vodka', detail: '750ml Vodka', base_price: 16.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 30, barcode: '082000736579' },
    { name: 'Captain Morgan Original', detail: '750ml Spiced Rum', base_price: 19.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 25, barcode: '082000736580' },
    { name: 'Bacardi White Rum', detail: '750ml Rum', base_price: 14.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 25, barcode: '080480100026' },
    { name: 'Jose Cuervo Gold', detail: '750ml Tequila', base_price: 19.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 20, barcode: '082000736581' },
    { name: 'Jameson Irish Whiskey', detail: '750ml Whiskey', base_price: 27.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 20, barcode: '080432402207' },
    { name: 'Fireball Cinnamon', detail: '750ml Whisky Liqueur', base_price: 14.99, category: 'spirits', emoji: '🥃', age_restricted: 1, stock: 25, barcode: '096749000101' },
    // Wine
    { name: 'Barefoot Moscato', detail: '750ml Wine', base_price: 7.99, category: 'wine', emoji: '🍷', age_restricted: 1, stock: 40, barcode: '085000000101' },
    { name: 'Yellow Tail Chardonnay', detail: '750ml Wine', base_price: 8.99, category: 'wine', emoji: '🍷', age_restricted: 1, stock: 35, barcode: '009374000201' },
    { name: 'Stella Rosa Rosso', detail: '750ml Semi-Sweet Red', base_price: 12.99, category: 'wine', emoji: '🍷', age_restricted: 1, stock: 30, barcode: '085200000301' },
    { name: 'Josh Cellars Cabernet', detail: '750ml Cabernet Sauvignon', base_price: 12.99, category: 'wine', emoji: '🍷', age_restricted: 1, stock: 30, barcode: '085200000402' },
    // Mixers & Non-Alc
    { name: 'Coca-Cola 2L', detail: '2 Liter Bottle', base_price: 2.49, category: 'mixers', emoji: '🥤', age_restricted: 0, stock: 60, barcode: '049000028911' },
    { name: 'Sprite 2L', detail: '2 Liter Bottle', base_price: 2.49, category: 'mixers', emoji: '🥤', age_restricted: 0, stock: 60, barcode: '049000028928' },
    { name: "Canada Dry Ginger Ale 2L", detail: '2 Liter Bottle', base_price: 2.49, category: 'mixers', emoji: '🥤', age_restricted: 0, stock: 50, barcode: '078000009301' },
    // Energy Drinks
    { name: 'Red Bull 12oz', detail: '12oz Can', base_price: 3.99, category: 'energy', emoji: '⚡', age_restricted: 0, stock: 80, barcode: '611269990071' },
    { name: 'Monster Energy 16oz', detail: '16oz Can', base_price: 2.99, category: 'energy', emoji: '⚡', age_restricted: 0, stock: 80, barcode: '070847811961' },
    // Tobacco
    { name: 'Marlboro Red Pack', detail: 'King Size - 20ct', base_price: 12.99, category: 'tobacco', emoji: '🚬', age_restricted: 1, stock: 100, barcode: '028000000101' },
    { name: 'Newport Menthol Pack', detail: 'King Size - 20ct', base_price: 12.99, category: 'tobacco', emoji: '🚬', age_restricted: 1, stock: 100, barcode: '012300000201' },
    // Snacks
    { name: "Lay's Classic Chips", detail: '8oz Bag', base_price: 4.99, category: 'snacks', emoji: '🍟', age_restricted: 0, stock: 50, barcode: '028400090100' },
    { name: 'Slim Jim Original', detail: '0.97oz Stick', base_price: 1.99, category: 'snacks', emoji: '🍖', age_restricted: 0, stock: 75, barcode: '026200000101' },
    // Other
    { name: 'Bag of Ice 7lb', detail: '7 lb Bag', base_price: 3.99, category: 'other', emoji: '🧊', age_restricted: 0, stock: 100, barcode: 'ICE7LB001' },
    { name: 'Plastic Cups 50ct', detail: '16oz Red Cups', base_price: 4.99, category: 'other', emoji: '🥤', age_restricted: 0, stock: 60, barcode: 'CUPS50CT001' },
  ];

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(products);
}

function seedMlcc() {
  const count = db.prepare('SELECT COUNT(*) as c FROM mlcc_prices').get().c;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT OR REPLACE INTO mlcc_prices (product_name, mlcc_min, size, last_updated)
    VALUES (@product_name, @mlcc_min, @size, datetime('now','localtime'))
  `);

  const mlccData = [
    { product_name: "Hennessy VS",           mlcc_min: 39.99, size: '750ml' },
    { product_name: "Hennessy VSOP",         mlcc_min: 58.99, size: '750ml' },
    { product_name: "Tito's Vodka",          mlcc_min: 19.99, size: '750ml' },
    { product_name: "Jack Daniel's",         mlcc_min: 29.99, size: '750ml' },
    { product_name: "Patron Silver",         mlcc_min: 44.99, size: '750ml' },
    { product_name: "Crown Royal",           mlcc_min: 29.99, size: '750ml' },
    { product_name: "Ciroc Peach",           mlcc_min: 30.99, size: '750ml' },
    { product_name: "Courvoisier VS",        mlcc_min: 39.99, size: '750ml' },
  ];

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(mlccData);
}

function seedSettings() {
  const count = db.prepare('SELECT COUNT(*) as c FROM settings').get().c;
  if (count > 0) return;

  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const defaults = [
    ['store_name',     'Pick-N-Go Party Store'],
    ['tax_rate',       '0.06'],
    ['register_count', '2'],
    ['city',           'Michigan'],
    ['currency',       'USD'],
    ['receipt_footer', 'Thank you for shopping at Pick-N-Go!'],
    ['age_check_enabled', '1'],
  ];

  const insertMany = db.transaction((rows) => {
    for (const [key, value] of rows) insert.run(key, value);
  });
  insertMany(defaults);
}

module.exports = { getDb };
