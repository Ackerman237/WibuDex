// lib/db.js — SQLite database (node:sqlite built-in)

import { DatabaseSync } from 'node:sqlite';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// DB_PATH env memungkinkan test memakai database terpisah (tidak menyentuh data/).
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', '.runtime', 'app.db');

// Pastikan folder data ada
import { mkdirSync } from 'node:fs';
mkdirSync(join(__dirname, '..', '.runtime'), { recursive: true });

const db = new DatabaseSync(DB_PATH);

// Inisialisasi tabel
db.exec(`
  CREATE TABLE IF NOT EXISTS reading_positions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   TEXT    NOT NULL,
    manga_slug  TEXT    NOT NULL,
    chapter_id  TEXT    NOT NULL,
    page        INTEGER NOT NULL DEFAULT 1,
    chapter_num TEXT,
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_positions_device_manga
    ON reading_positions (device_id, manga_slug);
`);

// Migrasi ringan: tambah kolom metadata opsional (judul + cover) untuk halaman riwayat baca.
// Kolom boleh NULL sehingga baris lama tetap valid tanpa backfill.
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn('reading_positions', 'manga_title', 'manga_title TEXT');
ensureColumn('reading_positions', 'cover_url', 'cover_url TEXT');
ensureColumn('reading_positions', 'manga_type', 'manga_type TEXT');

/**
 * Simpan atau update posisi baca.
 */
export function upsertPosition({ deviceId, mangaSlug, chapterId, page, chapterNum, mangaTitle, coverUrl, mangaType }) {
  const stmt = db.prepare(`
    INSERT INTO reading_positions (device_id, manga_slug, chapter_id, page, chapter_num, manga_title, cover_url, manga_type, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT (device_id, manga_slug)
    DO UPDATE SET
      chapter_id  = excluded.chapter_id,
      page        = excluded.page,
      chapter_num = excluded.chapter_num,
      manga_title = COALESCE(excluded.manga_title, manga_title),
      cover_url   = COALESCE(excluded.cover_url, cover_url),
      manga_type  = COALESCE(excluded.manga_type, manga_type),
      updated_at  = unixepoch()
  `);
  stmt.run(deviceId, mangaSlug, chapterId, page || 1, chapterNum || null, mangaTitle || null, coverUrl || null, mangaType || null);

  // Cap riwayat per device (POST spam dengan slug acak bisa mengembangkan DB).
  db.prepare(`
    DELETE FROM reading_positions
    WHERE device_id = ?
      AND id NOT IN (
        SELECT id FROM reading_positions WHERE device_id = ? ORDER BY updated_at DESC, id DESC LIMIT 100
      )
  `).run(deviceId, deviceId);
}

/**
 * Ambil posisi baca untuk satu manga.
 */
export function getPosition({ deviceId, mangaSlug }) {
  const stmt = db.prepare(`
    SELECT chapter_id, page, chapter_num, updated_at
    FROM reading_positions
    WHERE device_id = ? AND manga_slug = ?
  `);
  return stmt.get(deviceId, mangaSlug) || null;
}

/**
 * Ambil semua posisi baca untuk satu device (untuk sync).
 */
export function getAllPositions({ deviceId }) {
  const stmt = db.prepare(`
    SELECT manga_slug, chapter_id, page, chapter_num, manga_title, cover_url, manga_type, updated_at
    FROM reading_positions
    WHERE device_id = ?
    ORDER BY updated_at DESC
    LIMIT 100
  `);
  return stmt.all(deviceId);
}

/**
 * Hitung jumlah baris untuk satu device (utilitas test/operasional).
 */
export function countDeviceRows(deviceId) {
  return db.prepare(`SELECT COUNT(*) AS n FROM reading_positions WHERE device_id = ?`).get(deviceId).n;
}

export default db;
