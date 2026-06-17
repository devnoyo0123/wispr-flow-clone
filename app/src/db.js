const Database = require('better-sqlite3');
const { app } = require('electron');
const path = require('path');

// Postgres 대신 로컬 SQLite 파일 사용 (외부 DB/Docker 불필요).
// 인터페이스(insertTranscription / listRecent)는 기존과 동일 → main.js 변경 없음.

let db = null;

function getDb() {
  if (!db) {
    const file = path.join(app.getPath('userData'), 'wispr.db');
    db = new Database(file);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS transcriptions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        text       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
    `);
  }
  return db;
}

function insertTranscription(text) {
  const d = getDb();
  const info = d.prepare('INSERT INTO transcriptions (text) VALUES (?)').run(text);
  return d
    .prepare('SELECT id, text, created_at FROM transcriptions WHERE id = ?')
    .get(info.lastInsertRowid);
}

function listRecent(limit = 50, beforeId = null) {
  // cursor 기반 페이지네이션: beforeId 보다 오래된 N개 (무한 스크롤)
  if (beforeId == null) {
    return getDb()
      .prepare('SELECT id, text, created_at FROM transcriptions ORDER BY id DESC LIMIT ?')
      .all(limit);
  }
  return getDb()
    .prepare('SELECT id, text, created_at FROM transcriptions WHERE id < ? ORDER BY id DESC LIMIT ?')
    .all(beforeId, limit);
}

module.exports = { insertTranscription, listRecent };
