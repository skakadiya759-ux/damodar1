
/**
 * FOLK Damodar Month 2026 - SQLite Database Layer
 *
 * IMPORTANT:
 * Vercel /tmp storage is temporary. Use a persistent database
 * for production data and reliable multi-user sessions.
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');

const isVercel = Boolean(process.env.VERCEL);
let DB_PATH = path.join(__dirname, 'damodar2026.sqlite');

if (isVercel) {
  const tmpDb = '/tmp/damodar2026.sqlite';

  if (!fs.existsSync(tmpDb) && fs.existsSync(DB_PATH)) {
    try {
      fs.copyFileSync(DB_PATH, tmpDb);
    } catch (error) {
      console.error('Could not copy SQLite database:', error);
    }
  }

  DB_PATH = tmpDb;
}

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'resident',
      residence TEXT NOT NULL DEFAULT 'FOLK PDEU',
      personal_goal INTEGER NOT NULL DEFAULT 496,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chanting_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      rounds INTEGER NOT NULL CHECK(rounds > 0 AND rounds <= 192),
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tracker_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT NOT NULL,
      ip_address TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS lamp_offerings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      devotee_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_entries_user_date
      ON chanting_entries(user_id, date);

    CREATE INDEX IF NOT EXISTS idx_entries_date
      ON chanting_entries(date);

    CREATE INDEX IF NOT EXISTS idx_sessions_expires
      ON sessions(expires_at);
  `);

  // Add residence column only if it is missing.
  const columns = db.prepare('PRAGMA table_info(users)').all();

  if (!columns.some(column => column.name === 'residence')) {
    db.exec(
      "ALTER TABLE users ADD COLUMN residence TEXT NOT NULL DEFAULT 'FOLK PDEU'"
    );
  }

  const now = new Date().toISOString();

  const defaults = [
    ['community_target', '10008'],
    ['target_folk_pdeu', '5004'],
    ['target_folk_infocity', '5004'],
    ['campaign_start_date', '2026-10-25'],
    ['campaign_end_date', '2026-11-24']
  ];

  const getSetting = db.prepare(
    'SELECT value FROM tracker_settings WHERE key = ?'
  );

  const insertSetting = db.prepare(`
    INSERT INTO tracker_settings (key, value, updated_at)
    VALUES (?, ?, ?)
  `);

  for (const [key, value] of defaults) {
    if (!getSetting.get(key)) {
      insertSetting.run(key, value, now);
    }
  }

  provisionAdminUser();
}

function provisionAdminUser() {
  const admin = db.prepare(
    'SELECT id FROM users WHERE username = ?'
  ).get('admin');

  const resetRequested =
    process.env.RESET_ADMIN_PASSWORD === 'true';

  // Explicitly requested reset of an existing admin.
  if (admin && resetRequested) {
    const passwordHash = bcrypt.hashSync('smith@123', 12);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE users
      SET password_hash = ?,
          role = 'admin',
          is_active = 1,
          must_change_password = 1
      WHERE id = ?
    `).run(passwordHash, admin.id);

    // Invalidate old sessions for this admin.
    db.prepare(
      'DELETE FROM sessions WHERE user_id = ?'
    ).run(admin.id);

    db.prepare(`
      INSERT INTO audit_logs
        (user_id, actor_name, action, target_type, target_id,
         details, ip_address, created_at)
      VALUES (?, 'System', 'ADMIN_PASSWORD_RESET', 'users',
              'admin', ?, '127.0.0.1', ?)
    `).run(
      admin.id,
      'Administrator password reset',
      now
    );

    console.log('Admin password reset attempted for this database.');
    return;
  }

  // Never overwrite an existing admin password automatically.
  if (admin) {
    return;
  }

  // Create initial admin only when no admin account exists.
  const passwordHash = bcrypt.hashSync('smith@123', 12);
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO users
      (username, password_hash, full_name, role, personal_goal,
       must_change_password, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'admin',
    passwordHash,
    'FOLK Temple Administrator',
    'admin',
    1008,
    1,
    1,
    now
  );

  const adminId = Number(result.lastInsertRowid);

  db.prepare(`
    INSERT INTO audit_logs
      (user_id, actor_name, action, target_type, target_id,
       details, ip_address, created_at)
    VALUES (?, 'System', 'ADMIN_PROVISIONED', 'users', 'admin',
            ?, '127.0.0.1', ?)
  `).run(
    adminId,
    'Initial administrator account created',
    now
  );
}

initDatabase();

module.exports = {
  db,
  initDatabase
};
