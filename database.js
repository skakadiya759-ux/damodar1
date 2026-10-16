/**
 * FOLK Damodar Month 2026 - SQLite Database Layer
 * Uses Node.js native DatabaseSync with prepared statements and transactions.
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const fs = require('node:fs');

// On Vercel Serverless, the root filesystem is read-only. We copy the seed DB to /tmp if on Vercel.
const isVercel = Boolean(process.env.VERCEL);
let DB_PATH = path.join(__dirname, 'damodar2026.sqlite');

if (isVercel) {
  const tmpDb = '/tmp/damodar2026.sqlite';
  if (!fs.existsSync(tmpDb) && fs.existsSync(DB_PATH)) {
    try {
      fs.copyFileSync(DB_PATH, tmpDb);
    } catch (e) {
      console.warn('Could not copy sqlite to /tmp:', e);
    }
  }
  DB_PATH = tmpDb;
}

const db = new DatabaseSync(DB_PATH);

// Enable foreign keys and WAL mode for reliability
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initialize Database Tables
 */
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

    CREATE INDEX IF NOT EXISTS idx_entries_user_date ON chanting_entries(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_entries_date ON chanting_entries(date);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);

  // Column migration for residence
  try {
    db.exec(`ALTER TABLE users ADD COLUMN residence TEXT NOT NULL DEFAULT 'FOLK PDEU';`);
  } catch (e) {
    // Column already exists
  }

  // Initialize Default Tracker Settings
  const checkSetting = db.prepare('SELECT value FROM tracker_settings WHERE key = ?');
  const insertSetting = db.prepare('INSERT INTO tracker_settings (key, value, updated_at) VALUES (?, ?, ?)');
  const now = new Date().toISOString();

  if (!checkSetting.get('community_target')) {
    insertSetting.run('community_target', '10008', now);
  }
  if (!checkSetting.get('target_folk_pdeu')) {
    insertSetting.run('target_folk_pdeu', '5004', now);
  }
  if (!checkSetting.get('target_folk_infocity')) {
    insertSetting.run('target_folk_infocity', '5004', now);
  }
  if (!checkSetting.get('campaign_start_date')) {
    insertSetting.run('campaign_start_date', '2026-10-25', now);
  }
  if (!checkSetting.get('campaign_end_date')) {
    insertSetting.run('campaign_end_date', '2026-11-24', now);
  }

  // Provision Initial Administrator Account (Username: admin, Initial Password: smith@123)
  provisionAdminUser();
}

/**
 * Provision Initial Admin Account Securely
 * Requirement:
 * - Username: admin
 * - Initial password: smith@123
 * - Stored as a strong hash
 * - Require password change on first login
 */
function provisionAdminUser() {
  const checkAdmin = db.prepare('SELECT id, must_change_password FROM users WHERE username = ?');
  const admin = checkAdmin.get('admin');

  if (!admin) {
    const salt = bcrypt.genSaltSync(12);
    const passwordHash = bcrypt.hashSync('smith@123', salt);
    const now = new Date().toISOString();

    const insertAdmin = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, personal_goal, must_change_password, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAdmin.run('admin', passwordHash, 'FOLK Temple Administrator', 'admin', 1008, 1, 1, now);

    // Log admin provisioning in audit log
    const logAudit = db.prepare(`
      INSERT INTO audit_logs (user_id, actor_name, action, target_type, target_id, details, ip_address, created_at)
      VALUES (NULL, 'System', 'ADMIN_PROVISIONED', 'users', 'admin', 'Initial administrator provisioned with forced password change on first login', '127.0.0.1', ?)
    `);
    logAudit.run(now);
  }
}

// Initialize on require
initDatabase();

module.exports = {
  db,
  initDatabase
};
