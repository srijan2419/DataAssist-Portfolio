import type Database from 'better-sqlite3';
import { USER_ROLES } from '../auth/roles';

const USER_ROLE_CHECK_SQL = USER_ROLES.map((role) => `'${role.replace(/'/g, "''")}'`).join(',');

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((item) => item.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function ensureUsersRoleConstraint(db: Database.Database): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get() as { sql?: string } | undefined;
  const usersTableSql = row?.sql ?? '';

  if (!usersTableSql || usersTableSql.includes("'Data Entry'")) return;

  try {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN TRANSACTION;

      CREATE TABLE users_next (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN (${USER_ROLE_CHECK_SQL})),
        organization TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      INSERT INTO users_next (id, name, email, password_hash, role, organization, is_active, created_at, updated_at)
      SELECT id, name, email, password_hash, role, organization, is_active, created_at, updated_at
      FROM users;

      DROP TABLE users;
      ALTER TABLE users_next RENAME TO users;

      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
  } catch (error) {
    try {
      db.exec('ROLLBACK; PRAGMA foreign_keys = ON;');
    } catch {
      db.exec('PRAGMA foreign_keys = ON;');
    }
    throw error;
  }
}

/**
 * Initialize the complete database schema.
 * Uses IF NOT EXISTS so it's safe to run multiple times.
 */
export function initializeSchema(db: Database.Database): void {
  db.exec(`
    -- Users table (authentication + roles)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN (${USER_ROLE_CHECK_SQL})),
      organization TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Trainees
    CREATE TABLE IF NOT EXISTS trainees (
      id TEXT PRIMARY KEY,
      rank TEXT NOT NULL,
      name TEXT NOT NULL,
      army_no TEXT UNIQUE NOT NULL,
      organization TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Active','RTU','Graduated','In Training')),
      join_date TEXT NOT NULL,
      additional_details TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Courses
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      duration INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Capsules (belong to courses)
    CREATE TABLE IF NOT EXISTS capsules (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      capsule_number INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      vacancies INTEGER NOT NULL DEFAULT 0,
      nominations INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('Scheduled','Ongoing','Completed','Cancelled')),
      location_state TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Performance Records
    CREATE TABLE IF NOT EXISTS performance_records (
      id TEXT PRIMARY KEY,
      trainee_id TEXT NOT NULL REFERENCES trainees(id),
      course_id TEXT NOT NULL REFERENCES courses(id),
      capsule_id TEXT NOT NULL REFERENCES capsules(id),
      result TEXT NOT NULL CHECK(result IN ('Pass','Fail')),
      grade TEXT CHECK(grade IN ('A+','A','B+','B','C','D','F')),
      score REAL,
      completion_date TEXT NOT NULL,
      is_rtu INTEGER DEFAULT 0,
      rtu_reason_code TEXT CHECK(rtu_reason_code IN ('Medical','Disciplinary','Non-Voluntary','Punishment')),
      rtu_reason_details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Constraints
    CREATE TABLE IF NOT EXISTS constraints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK(type IN ('Hard','Soft')),
      priority INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      rules TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- AI Query History
    CREATE TABLE IF NOT EXISTS query_history (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      query_text TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Activity Log
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Allocation Runs
    CREATE TABLE IF NOT EXISTS allocation_runs (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id),
      capsule_id TEXT NOT NULL REFERENCES capsules(id),
      status TEXT NOT NULL CHECK(status IN ('generated','review','applied')),
      total_slots INTEGER NOT NULL,
      confidence REAL NOT NULL,
      recommendations TEXT NOT NULL,
      applied_constraints TEXT NOT NULL,
      constraint_results TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- App Settings (key-value store)
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- License (singleton row)
    CREATE TABLE IF NOT EXISTS license (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      machine_id TEXT NOT NULL,
      license_key TEXT NOT NULL,
      activated_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'active'
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_trainees_org ON trainees(organization);
    CREATE INDEX IF NOT EXISTS idx_trainees_status ON trainees(status);
    CREATE INDEX IF NOT EXISTS idx_capsules_course ON capsules(course_id);
    CREATE INDEX IF NOT EXISTS idx_perf_trainee ON performance_records(trainee_id);
    CREATE INDEX IF NOT EXISTS idx_perf_course ON performance_records(course_id);
    CREATE INDEX IF NOT EXISTS idx_perf_capsule ON performance_records(capsule_id);
    CREATE INDEX IF NOT EXISTS idx_perf_result ON performance_records(result);
    CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);
    CREATE INDEX IF NOT EXISTS idx_query_history_created ON query_history(created_at);
    CREATE INDEX IF NOT EXISTS idx_allocation_runs_created ON allocation_runs(created_at);
  `);

  ensureUsersRoleConstraint(db);
  ensureColumn(db, 'capsules', 'location_state', 'TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_capsules_location_state ON capsules(location_state)');
}
