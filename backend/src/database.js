const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.BOOKEASE_DB_PATH || path.resolve(__dirname, '..', 'bookease.db');

let dbInstance = null;

function getDb(customPath = null) {
  if (dbInstance && !customPath) return dbInstance;
  const target = customPath || dbPath;
  const db = new sqlite3.Database(target);

  if (target !== ':memory:') {
    db.run('PRAGMA journal_mode = WAL;');
  }
  db.run('PRAGMA foreign_keys = ON;');

  if (!customPath) {
    dbInstance = db;
  }
  return db;
}

function initDb(db = null) {
  const targetDb = db || getDb();
  return new Promise((resolve, reject) => {
    targetDb.serialize(() => {
      targetDb.run(`
        CREATE TABLE IF NOT EXISTS services (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL,
          buffer_minutes INTEGER DEFAULT 15,
          price REAL DEFAULT 0.0,
          currency TEXT DEFAULT 'USD',
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      targetDb.run(`
        CREATE TABLE IF NOT EXISTS providers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          specialization TEXT NOT NULL,
          availability_json TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      targetDb.run(`
        CREATE TABLE IF NOT EXISTS appointments (
          id TEXT PRIMARY KEY,
          service_id TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_email TEXT NOT NULL,
          customer_phone TEXT,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'CONFIRMED',
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
          FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
        );
      `);

      targetDb.run(`CREATE INDEX IF NOT EXISTS idx_appointments_provider ON appointments(provider_id);`);
      targetDb.run(`CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(start_time, end_time);`, (err) => {
        if (err) return reject(err);
        resolve(targetDb);
      });
    });
  });
}

module.exports = { getDb, initDb };
