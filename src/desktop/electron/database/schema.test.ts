import { describe, expect, it } from 'vitest';
import { initializeSchema } from './schema';

const LEGACY_USERS_SQL = `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Admin','Manager','Viewer')),
    organization TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`;

function createFakeDb(usersSql: string) {
  const execCalls: string[] = [];
  const db = {
    exec(sql: string) {
      execCalls.push(sql);
    },
    prepare(sql: string) {
      return {
        get() {
          if (sql.includes("sqlite_master") && sql.includes("name = 'users'")) {
            return { sql: usersSql };
          }
          return undefined;
        },
        all() {
          if (sql.includes('PRAGMA table_info(capsules)')) {
            return [{ name: 'location_state' }];
          }
          return [];
        },
      };
    },
  };

  return { db, execCalls };
}

describe('initializeSchema user role migration', () => {
  it('rebuilds a legacy users table so Data Entry passes the role constraint', () => {
    const { db, execCalls } = createFakeDb(LEGACY_USERS_SQL);

    initializeSchema(db as any);

    const migrationSql = execCalls.join('\n');
    expect(migrationSql).toContain('CREATE TABLE users_next');
    expect(migrationSql).toContain("CHECK(role IN ('Admin','Manager','Data Entry','Viewer'))");
    expect(migrationSql).toContain('INSERT INTO users_next');
    expect(migrationSql).toContain('DROP TABLE users');
    expect(migrationSql).toContain('ALTER TABLE users_next RENAME TO users');
  });
});
