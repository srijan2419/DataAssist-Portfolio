import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { getSqliteDb } from '../database/connection';
import { checkLMStudioAvailable, getLMStudioModelName } from '../services/ai.service';
import { runAiQuery, type AIQueryResponse } from '../services/ai-query.service';

interface QueryHistoryRow {
  id: string;
  user_id: string | null;
  query_text: string;
  response: string; // JSON string
  created_at: string;
}

function mapQueryHistoryRow(row: QueryHistoryRow) {
  return {
    id: row.id,
    query: row.query_text,
    response: JSON.parse(row.response),
    timestamp: row.created_at,
    userId: row.user_id,
  };
}

export function registerAiHandlers(): void {
  // ── ai:query ──────────────────────────────────────────────────────────────
  ipcMain.handle('ai:query', async (_event, queryText: string) => {
    const db = getSqliteDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    let aiResponse: AIQueryResponse;

    try {
      aiResponse = await runAiQuery({ queryText, db });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AI] Unexpected error:', msg);
      aiResponse = {
        text: 'This specific data is not available in the dataset.',
        source: 'fallback',
        data: { verified: false, reason: 'unexpected_error' },
      };
    }

    // Persist to query_history regardless of which path was used
    try {
      db.prepare(
        `INSERT INTO query_history (id, user_id, query_text, response, created_at)
         VALUES (?, NULL, ?, ?, ?)`
      ).run(id, queryText, JSON.stringify(aiResponse), now);
      console.log(
        `[AI] Query saved (${aiResponse.source}): "${queryText.substring(0, 60)}" (${id})`
      );
    } catch (saveErr: unknown) {
      const msg = saveErr instanceof Error ? saveErr.message : String(saveErr);
      console.error('[AI] Failed to save query to history:', msg);
    }

    return {
      id,
      query: queryText,
      response: aiResponse,
      timestamp: now,
    };
  });

  // ── ai:checkLMStudioStatus ────────────────────────────────────────────────
  ipcMain.handle('ai:checkLMStudioStatus', async () => {
    try {
      const available = await checkLMStudioAvailable();
      const model = available ? await getLMStudioModelName() : null;
      return { available, model };
    } catch {
      return { available: false, model: null };
    }
  });

  // ── ai:getHistory ─────────────────────────────────────────────────────────
  ipcMain.handle('ai:getHistory', async (_event, limit?: number) => {
    try {
      const db = getSqliteDb();
      const effectiveLimit = limit ?? 50;
      const rows = db
        .prepare('SELECT * FROM query_history ORDER BY created_at DESC LIMIT ?')
        .all(effectiveLimit) as QueryHistoryRow[];
      return rows.map(mapQueryHistoryRow);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[AI] getHistory failed:', msg);
      throw error;
    }
  });

  // ── ai:clearHistory ───────────────────────────────────────────────────────
  ipcMain.handle('ai:clearHistory', async () => {
    try {
      const db = getSqliteDb();
      db.prepare('DELETE FROM query_history').run();
      console.log('[AI] Query history cleared');
      return { success: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[AI] clearHistory failed:', msg);
      throw error;
    }
  });
}
