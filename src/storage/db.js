/**
 * storage/db.js
 *
 * Opens the SQLite database in Electron's userData directory and applies any
 * pending migrations. Returns a synchronous better-sqlite3 Database instance.
 *
 * Usage (main process only — never import in renderer):
 *   import { openDb } from './storage/db.js'
 *   const db = openDb()
 */

import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

// Ordered list of migration files. Add new entries here for future migrations.
const MIGRATIONS = [
  { version: 1, file: '001_initial.sql' },
]

/**
 * Open (or create) the app database and run any pending migrations.
 * @returns {import('better-sqlite3').Database}
 */
export function openDb() {
  const dbPath = join(app.getPath('userData'), 'sdg-scraper.db')

  const db = new Database(dbPath)

  // WAL mode gives better concurrent read performance and crash safety
  db.pragma('journal_mode = WAL')
  // Foreign key enforcement
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  return db
}

/**
 * Apply any migrations that have not yet been applied.
 * Uses a schema_versions table as the migration ledger.
 * @param {import('better-sqlite3').Database} db
 */
function runMigrations(db) {
  // Create the migration ledger table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT    DEFAULT (datetime('now'))
    )
  `)

  // Collect already-applied versions
  const applied = new Set(
    db.prepare('SELECT version FROM schema_versions').all().map((r) => r.version)
  )

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue

    // __dirname is injected by electron-vite as the directory of the bundled
    // main entry (out/main/ in dev, resources/app/out/main/ in prod).
    // The copy-migrations plugin puts .sql files alongside the bundle.
    const sqlPath = join(__dirname, 'migrations', migration.file)
    const sql = readFileSync(sqlPath, 'utf8')

    // Run the whole migration file inside a transaction so it's atomic
    db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO schema_versions (version) VALUES (?)').run(
        migration.version
      )
    })()

    console.log(`[db] Applied migration ${migration.version}: ${migration.file}`)
  }
}
