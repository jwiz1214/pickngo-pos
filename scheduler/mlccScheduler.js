const cron = require('node-cron');
const axios = require('axios');
const XLSX = require('xlsx');
const { getDb } = require('../database');

// Michigan MLCC publishes quarterly price books at michigan.gov/lara
// URL pattern as of 2024 - may require updating if LARA reorganizes their site
const MLCC_PRICE_BOOK_URL =
  'https://www.michigan.gov/lara/-/media/Project/Websites/lara/mlcc/Price-Lists/Current-Price-Book.xlsx';

/**
 * Fetch the MLCC Excel price book, parse it, and upsert relevant entries
 * into the mlcc_prices table.
 *
 * The MLCC price book is a multi-sheet Excel. We look for columns containing
 * "BRAND NAME" (or "PRODUCT") and "MIN PRICE" (case-insensitive) across all sheets.
 *
 * @returns {{ updated: number, skipped: number, sheet_names: string[] }}
 */
async function fetchAndUpdateMlccPrices() {
  console.log('[MLCC Scheduler] Fetching MLCC price book from michigan.gov...');

  const response = await axios.get(MLCC_PRICE_BOOK_URL, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'User-Agent': 'PickNGo-POS/1.0 (Michigan retailer compliance tool)' },
  });

  const workbook = XLSX.read(response.data, { type: 'buffer' });
  const db = getDb();

  const upsert = db.prepare(`
    INSERT INTO mlcc_prices (product_name, mlcc_min, size, last_updated)
    VALUES (?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(product_name) DO UPDATE SET
      mlcc_min     = excluded.mlcc_min,
      size         = excluded.size,
      last_updated = excluded.last_updated
  `);

  let updated = 0;
  let skipped = 0;

  const upsertMany = db.transaction((rows) => {
    for (const row of rows) {
      if (row.name && row.price != null && !isNaN(row.price)) {
        upsert.run(row.name.trim(), parseFloat(row.price), row.size || null);
        updated++;
      } else {
        skipped++;
      }
    }
  });

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (jsonRows.length === 0) continue;

    // Detect column headers dynamically (handles minor format changes)
    const headers = Object.keys(jsonRows[0]).map(h => h.toUpperCase());
    const nameCol  = Object.keys(jsonRows[0]).find(h => /BRAND|PRODUCT|NAME/i.test(h));
    const priceCol = Object.keys(jsonRows[0]).find(h => /MIN.*PRICE|MINIMUM.*PRICE|MIN_PRICE/i.test(h));
    const sizeCol  = Object.keys(jsonRows[0]).find(h => /SIZE|CONTAINER/i.test(h));

    if (!nameCol || !priceCol) continue; // sheet doesn't look like a price list

    const rows = jsonRows.map(r => ({
      name:  r[nameCol],
      price: r[priceCol],
      size:  sizeCol ? r[sizeCol] : null,
    }));

    upsertMany(rows);
  }

  console.log(`[MLCC Scheduler] Done. Updated: ${updated}, Skipped: ${skipped}`);
  return { updated, skipped, sheet_names: workbook.SheetNames };
}

/**
 * Register the quarterly cron job.
 * Runs at midnight on Feb 1, May 1, Aug 1, Nov 1 — the months MLCC releases
 * new quarterly price books.
 *
 * Cron: 0 0 1 2,5,8,11 *
 */
function startMlccScheduler() {
  // Feb 1, May 1, Aug 1, Nov 1 at 00:00
  cron.schedule('0 0 1 2,5,8,11 *', async () => {
    console.log('[MLCC Scheduler] Quarterly price book update triggered by cron.');
    try {
      const result = await fetchAndUpdateMlccPrices();
      console.log('[MLCC Scheduler] Cron run complete:', result);
    } catch (err) {
      console.error('[MLCC Scheduler] Cron run failed:', err.message);
    }
  }, {
    timezone: 'America/Detroit',
  });

  console.log('[MLCC Scheduler] Registered. Runs Feb 1 / May 1 / Aug 1 / Nov 1 at midnight ET.');
}

module.exports = { startMlccScheduler, fetchAndUpdateMlccPrices };
