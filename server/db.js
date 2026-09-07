const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'planetazdorovya.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- 5 направлений клиники (неврология, ортопедия, экспресс-ортезирование,
  -- психология, развивающие занятия с детьми) — у каждого своя подстраница /uslugi/:slug.
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    short_desc TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- Разделы прайс-листа (неврология, ортопедия, психология, развивающие
  -- занятия, экспресс-ортезирование) с позициями внутри.
  CREATE TABLE IF NOT EXISTS price_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    intro TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- Позиция прайс-листа. price_note хранит цену как текст с оригинала.
  CREATE TABLE IF NOT EXISTS price_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES price_categories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    price_note TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- Врачи и специалисты клиники (директор+невролог Устинова + 3 специалиста).
  CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    experience_years INTEGER,
    bio TEXT NOT NULL DEFAULT '',
    photo TEXT NOT NULL DEFAULT '',
    is_chief INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- Отзывы пациентов, перенесённые с оригинального сайта.
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_name TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    published_at TEXT DEFAULT (datetime('now')),
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- Заявки с формы записи на приём.
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    service_or_doctor TEXT,
    preferred_time TEXT,
    message TEXT,
    source TEXT NOT NULL DEFAULT 'zapis-form',
    consent_given INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'new'
  );
`);

module.exports = db;
