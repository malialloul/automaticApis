const express = require('express');
const router = express.Router();
const connectionManager = require('../utils/connectionManager');

// GET /api/next-auto-increment?connectionId=...&table=...
router.get('/next-auto-increment', async (req, res) => {
  const { connectionId, table } = req.query;
  if (!connectionId || !table) return res.status(400).json({ error: 'connectionId and table are required' });

  try {
    const db = await connectionManager.getConnection(connectionId);
    // Try MySQL first
    let rows;
    try {
      [rows] = await db.query(
        `SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table]
      );
      if (rows.length && rows[0].AUTO_INCREMENT) {
        return res.json({ nextAutoIncrement: rows[0].AUTO_INCREMENT });
      }
    } catch {}
    // Try PostgreSQL (sequence)
    try {
      const seqRows = await db.query(
        `SELECT column_default FROM information_schema.columns WHERE table_name = $1 AND column_default LIKE 'nextval%'`,
        [table]
      );
      if (seqRows.rows && seqRows.rows.length) {
        const match = seqRows.rows[0].column_default.match(/nextval\('([^']+)'/);
        if (match) {
          const seqName = match[1];
          const valRows = await db.query(`SELECT last_value FROM ${seqName}`);
          if (valRows.rows && valRows.rows.length) {
            return res.json({ nextAutoIncrement: Number(valRows.rows[0].last_value) + 1 });
          }
        }
      }
    } catch {}
    // Fallback: get max(id) + 1
    try {
      const idRows = await db.query(`SELECT MAX(id) as maxId FROM ${table}`);
      if (idRows.rows && idRows.rows.length) {
        return res.json({ nextAutoIncrement: Number(idRows.rows[0].maxid) + 1 });
      }
    } catch {}
    return res.status(404).json({ error: 'Could not determine next auto-increment value' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
