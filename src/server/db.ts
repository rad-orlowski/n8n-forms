/**
 * db.ts — bun:sqlite session store.
 *
 * Schema:
 *   sessions (
 *     sessionId  TEXT PRIMARY KEY,   -- crypto.randomUUID()
 *     formSlug   TEXT NOT NULL,
 *     resumeUrl  TEXT,               -- current n8n Wait-node resume URL (nullable)
 *     lastPayload TEXT,              -- JSON-stringified last callback body (for SSE replay on reconnect)
 *     done       INTEGER NOT NULL DEFAULT 0,
 *     createdAt  TEXT NOT NULL,      -- ISO timestamp
 *     updatedAt  TEXT NOT NULL       -- ISO timestamp (TTL GC key)
 *   )
 *
 * TTL GC: rows idle (updatedAt) for more than 30 min are deleted.
 * GC runs lazily on every write access to avoid a background timer.
 */

import { Database } from "bun:sqlite";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Database initialisation
// ---------------------------------------------------------------------------

const DB_PATH = process.env.DB_PATH ?? join(process.cwd(), "sessions.db");
const TTL_MS = 30 * 60 * 1000; // 30 minutes

const db = new Database(DB_PATH, { create: true });

// WAL mode for better concurrent read/write throughput
db.run("PRAGMA journal_mode=WAL");
db.run("PRAGMA foreign_keys=ON");

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    sessionId   TEXT PRIMARY KEY,
    formSlug    TEXT NOT NULL,
    resumeUrl   TEXT,
    lastPayload TEXT,
    done        INTEGER NOT NULL DEFAULT 0,
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT NOT NULL
  )
`);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Session {
  sessionId: string;
  formSlug: string;
  resumeUrl: string | null;
  /** Parsed callback payload, or null if no callback received yet. */
  lastPayload: unknown | null;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Raw row as stored in SQLite. */
interface SessionRow {
  sessionId: string;
  formSlug: string;
  resumeUrl: string | null;
  lastPayload: string | null;
  done: number;
  createdAt: string;
  updatedAt: string;
}

function rowToSession(row: SessionRow): Session {
  return {
    sessionId: row.sessionId,
    formSlug: row.formSlug,
    resumeUrl: row.resumeUrl ?? null,
    lastPayload: row.lastPayload ? JSON.parse(row.lastPayload) : null,
    done: row.done !== 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// TTL GC — called lazily before every mutating operation
// ---------------------------------------------------------------------------

function gcExpired(): void {
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();
  db.run("DELETE FROM sessions WHERE updatedAt < ?", [cutoff]);
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

const stmtInsert = db.prepare<void, SessionRow>(`
  INSERT INTO sessions (sessionId, formSlug, resumeUrl, lastPayload, done, createdAt, updatedAt)
  VALUES ($sessionId, $formSlug, $resumeUrl, $lastPayload, $done, $createdAt, $updatedAt)
`);

const stmtGetById = db.prepare<SessionRow, [string]>(
  "SELECT * FROM sessions WHERE sessionId = ?"
);

const stmtUpdate = db.prepare<void, {
  $resumeUrl: string | null;
  $lastPayload: string | null;
  $done: number;
  $updatedAt: string;
  $sessionId: string;
}>(`
  UPDATE sessions
  SET resumeUrl = $resumeUrl, lastPayload = $lastPayload, done = $done, updatedAt = $updatedAt
  WHERE sessionId = $sessionId
`);

/**
 * Create a new session row.  Returns the full Session object.
 * Does NOT store the webhook URL — that is resolved from env at request time.
 */
export function createSession(opts: {
  sessionId: string;
  formSlug: string;
}): Session {
  gcExpired();
  const now = new Date().toISOString();
  const row: SessionRow = {
    sessionId: opts.sessionId,
    formSlug: opts.formSlug,
    resumeUrl: null,
    lastPayload: null,
    done: 0,
    createdAt: now,
    updatedAt: now,
  };
  stmtInsert.run(row);
  return rowToSession(row);
}

/** Retrieve a session by ID.  Returns null if not found. */
export function getSession(sessionId: string): Session | null {
  const row = stmtGetById.get(sessionId);
  if (!row) return null;
  return rowToSession(row);
}

/** Persist updated resumeUrl, lastPayload, and done flag. */
export function updateSession(
  sessionId: string,
  patch: { resumeUrl?: string | null; lastPayload?: unknown; done?: boolean }
): void {
  gcExpired();
  const existing = stmtGetById.get(sessionId);
  if (!existing) throw new Error(`Session not found: ${sessionId}`);

  stmtUpdate.run({
    $resumeUrl: patch.resumeUrl !== undefined ? (patch.resumeUrl ?? null) : existing.resumeUrl,
    $lastPayload:
      patch.lastPayload !== undefined
        ? JSON.stringify(patch.lastPayload)
        : existing.lastPayload,
    $done: patch.done !== undefined ? (patch.done ? 1 : 0) : existing.done,
    $updatedAt: new Date().toISOString(),
    $sessionId: sessionId,
  });
}
