const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.get('db'));

async function insertTranscription(text) {
  const r = await pool.query(
    'INSERT INTO transcriptions(text) VALUES($1) RETURNING id, created_at, text',
    [text],
  );
  return r.rows[0];
}

async function listRecent(limit = 100) {
  const r = await pool.query(
    'SELECT id, created_at, text FROM transcriptions ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  return r.rows;
}

module.exports = { pool, insertTranscription, listRecent };
