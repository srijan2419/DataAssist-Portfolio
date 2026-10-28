import type Database from 'better-sqlite3';
import {
  checkLMStudioAvailable,
  containsProhibitedEstimateLanguage,
  queryLMStudioChat,
  type LMStudioMessage,
} from './ai.service';

type AISource = 'lmstudio' | 'fallback' | 'database';
type AnswerMode = 'table' | 'aggregate' | 'chart' | 'text';

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  data: Record<string, unknown>[];
  xKey?: string;
  yKey?: string;
}

export interface TableData {
  title: string;
  headers: string[];
  rows: unknown[][];
}

export interface AIQueryResponse {
  text: string;
  data?: unknown;
  charts?: ChartData[];
  tables?: TableData[];
  insights?: string[];
  source: AISource;
}

export interface AIPlannerResult {
  intent: 'data_query' | 'not_data_query' | 'unanswerable';
  sql?: string;
  title?: string;
  answerMode?: AnswerMode;
  resultType?: string;
}

interface SqlValidationSuccess {
  ok: true;
  sql: string;
  tablesUsed: string[];
}

interface SqlValidationFailure {
  ok: false;
  reason: string;
}

export type SqlValidationResult = SqlValidationSuccess | SqlValidationFailure;

export type AIPlanner = (queryText: string, feedback?: string) => Promise<AIPlannerResult | null>;

type AINarrator = (input: {
  queryText: string;
  title: string;
  rows: Record<string, unknown>[];
  totalCount: number;
  rowCount: number;
  capped: boolean;
  tablesUsed: string[];
}) => Promise<string | null>;

type GeneralResponder = (queryText: string) => Promise<string | null>;

export interface RunAiQueryOptions {
  queryText: string;
  db: Database.Database;
  planner?: AIPlanner;
  narrator?: AINarrator;
  generalResponder?: GeneralResponder;
  lmAvailable?: boolean;
  rowLimit?: number;
}

interface ExecuteSqlResult {
  rows: Record<string, unknown>[];
  totalCount: number;
  rowCount: number;
  capped: boolean;
}

interface FormatDatabaseAnswerInput extends ExecuteSqlResult {
  title: string;
  queryText: string;
  tablesUsed: string[];
  answerMode?: AnswerMode;
  narratorText?: string | null;
}

const DEFAULT_ROW_LIMIT = 1000;
const UNAVAILABLE_TEXT = 'This specific data is not available in the dataset.';

const ALLOWED_TABLES = new Set([
  'trainees',
  'courses',
  'capsules',
  'performance_records',
  'constraints',
  'allocation_runs',
  'activities',
  'users',
]);

const SENSITIVE_TOKENS = [
  'password_hash',
  'license_key',
  'machine_id',
  'query_history',
  'license',
  'settings',
  'response',
];

const MUTATING_OR_UNSAFE_KEYWORDS = [
  'alter',
  'attach',
  'begin',
  'commit',
  'create',
  'delete',
  'detach',
  'drop',
  'grant',
  'insert',
  'pragma',
  'reindex',
  'replace',
  'revoke',
  'rollback',
  'transaction',
  'update',
  'vacuum',
];

function unavailableResponse(reason?: string): AIQueryResponse {
  return {
    text: reason ? `${UNAVAILABLE_TEXT} ${reason}` : UNAVAILABLE_TEXT,
    source: 'fallback',
    data: {
      verified: false,
      reason: reason ?? 'unavailable',
    },
  };
}

function buildSafeSchemaCatalog(): string {
  return [
    'Safe SQLite schema for DataAssist. Return SQL using only these tables and columns.',
    '',
    'trainees(id, rank, name, army_no, organization, status, join_date, additional_details, created_at, updated_at)',
    'courses(id, name, code, description, duration, created_at, updated_at)',
    'capsules(id, course_id, capsule_number, start_date, end_date, vacancies, nominations, status, location_state, created_at)',
    'performance_records(id, trainee_id, course_id, capsule_id, result, grade, score, completion_date, is_rtu, rtu_reason_code, rtu_reason_details, created_at)',
    'constraints(id, name, description, type, priority, is_active, rules, created_at, updated_at)',
    'allocation_runs(id, course_id, capsule_id, status, total_slots, confidence, recommendations, applied_constraints, constraint_results, created_at, updated_at)',
    'activities(id, user_id, type, description, metadata, created_at)',
    'users(id, name, email, role, organization, is_active, created_at, updated_at)',
    '',
    'Common joins:',
    'performance_records.trainee_id = trainees.id',
    'performance_records.course_id = courses.id',
    'performance_records.capsule_id = capsules.id',
    'capsules.course_id = courses.id',
    'allocation_runs.course_id = courses.id',
    'allocation_runs.capsule_id = capsules.id',
    'activities.user_id = users.id',
    '',
    'Rules:',
    '- Return JSON only, with no markdown.',
    '- For factual data questions, set intent to data_query and provide one SELECT SQL statement.',
    '- Never answer facts from memory or pass rates. Use SQL rows or SQL aggregates.',
    '- For trainee name/list questions, always include trainees.name, trainees.army_no, and trainees.organization.',
    '- For course result name/list questions, join performance_records, trainees, and courses; include trainee name, army_no, organization, result, grade, score, and completion_date.',
    '- For trainee performance history questions, include trainee name, army_no, course name, course code, result, grade, score, completion_date, and RTU fields.',
    '- Vacancies and nominations exist only on capsules. Join courses to capsules and select capsules.vacancies and capsules.nominations.',
    '- Training event location is stored as capsules.location_state. Use it for statewise location questions.',
    '- The courses table does not contain vacancies or nominations.',
    '- For pure count questions, return a SQL aggregate count and do not list row-level records unless asked.',
    '- Questions that ask to list, show, count, summarize, or compare users, trainees, courses, capsules, performance records, constraints, allocations, or activities are data_query questions.',
    '- "List users without passwords" means select safe users columns only: name, email, role, organization, and is_active. Never switch to app-help instructions.',
    '- For user listing questions, query the users table directly. Do not join activities unless the user explicitly asks for user activity history.',
    '- Admin users are rows where users.role = \'Admin\'.',
    '- For plural "latest", "recent", "records", "runs", or "activities" list requests, return up to 10 rows ordered newest first. Use LIMIT 1 only when the user explicitly asks for the single latest/top/most recent item.',
    '- For grouped aggregate questions such as "by course", "by organization", "by reason", "distribution", or "breakdown", return all groups. Do not add LIMIT unless the user explicitly asks for top, first, latest, or a specific number.',
    '- Do not use SELECT *.',
    '- Do not reference password_hash, license, settings, query_history, machine_id, or license_key.',
    '- For unknown, predictive, or unavailable data, set intent to unanswerable and omit sql.',
    '- For external facts, current events, weather, internet lookups, legal/medical advice, or anything outside the DataAssist database, set intent to unanswerable and omit sql.',
    '- Use not_data_query only for general help about how to use DataAssist itself.',
    '',
    'Required JSON shape:',
    '{"intent":"data_query|not_data_query|unanswerable","sql":"SELECT ...","title":"Short title","answerMode":"table|aggregate|chart|text","resultType":"optional"}',
    '',
    'Example:',
    '{"intent":"data_query","sql":"SELECT t.name, t.army_no, t.organization, pr.result, pr.grade, pr.score, pr.completion_date FROM performance_records pr JOIN trainees t ON t.id = pr.trainee_id JOIN courses c ON c.id = pr.course_id WHERE c.name = \'Counter Insurgency Training\' AND pr.result = \'Fail\' ORDER BY t.name","title":"Failed Trainees - Counter Insurgency Training","answerMode":"table"}',
  ].join('\n');
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

export function parsePlannerResponse(text: string): AIPlannerResult | null {
  const unfenced = stripCodeFence(text);
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return null;
  }

  const candidate = parsed as Partial<AIPlannerResult>;
  if (
    candidate.intent !== 'data_query' &&
    candidate.intent !== 'not_data_query' &&
    candidate.intent !== 'unanswerable'
  ) {
    return null;
  }

  const answerMode =
    candidate.answerMode === 'aggregate' ||
    candidate.answerMode === 'chart' ||
    candidate.answerMode === 'text' ||
    candidate.answerMode === 'table'
      ? candidate.answerMode
      : 'table';

  if (candidate.intent === 'data_query') {
    if (!candidate.sql || typeof candidate.sql !== 'string') return null;
    return {
      intent: 'data_query',
      sql: candidate.sql,
      title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : 'Database Result',
      answerMode,
      resultType: typeof candidate.resultType === 'string' ? candidate.resultType : undefined,
    };
  }

  return {
    intent: candidate.intent,
    title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : undefined,
    answerMode,
    resultType: typeof candidate.resultType === 'string' ? candidate.resultType : undefined,
  };
}

function maskStringLiterals(sql: string): string {
  return sql
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:\\"|[^"])*"/g, '""')
    .replace(/`(?:``|[^`])*`/g, '``');
}

function stripTrailingSemicolon(sql: string): string | null {
  const trimmed = sql.trim();
  if (!trimmed.includes(';')) return trimmed;
  if (/;+\s*$/.test(trimmed) && trimmed.slice(0, trimmed.lastIndexOf(';')).indexOf(';') === -1) {
    return trimmed.replace(/;+\s*$/, '').trim();
  }
  return null;
}

function extractCteNames(maskedSql: string): Set<string> {
  const ctes = new Set<string>();
  const withMatch = maskedSql.match(/^\s*with\s+([\s\S]+?)\bselect\b/i);
  if (!withMatch) return ctes;

  const cteRegex = /(?:^|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = cteRegex.exec(withMatch[1])) !== null) {
    ctes.add(match[1].toLowerCase());
  }
  return ctes;
}

function extractTablesUsed(maskedSql: string): string[] {
  const tables: string[] = [];
  const tableRegex = /\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(maskedSql)) !== null) {
    const table = match[1].toLowerCase();
    if (!tables.includes(table)) tables.push(table);
  }
  return tables;
}

export function validateReadOnlySql(rawSql: string): SqlValidationResult {
  const stripped = stripTrailingSemicolon(rawSql);
  if (!stripped) {
    return { ok: false, reason: 'Only one SQL statement is allowed.' };
  }

  if (/--|\/\*|\*\//.test(stripped)) {
    return { ok: false, reason: 'SQL comments are not allowed.' };
  }

  const maskedSql = maskStringLiterals(stripped);
  const normalized = maskedSql.replace(/\s+/g, ' ').trim().toLowerCase();

  if (!/^(select|with)\b/.test(normalized)) {
    return { ok: false, reason: 'Only SELECT queries are allowed.' };
  }

  for (const keyword of MUTATING_OR_UNSAFE_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(maskedSql)) {
      return { ok: false, reason: `Unsafe SQL keyword is not allowed: ${keyword}.` };
    }
  }

  for (const token of SENSITIVE_TOKENS) {
    if (new RegExp(`\\b${token}\\b`, 'i').test(maskedSql)) {
      return { ok: false, reason: `Sensitive data is not allowed: ${token}.` };
    }
  }

  if (/\bselect\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?\*/i.test(maskedSql) || /,\s*(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?\*/i.test(maskedSql)) {
    return { ok: false, reason: 'SELECT * is not allowed.' };
  }

  const cteNames = extractCteNames(maskedSql);
  const referencedTables = extractTablesUsed(maskedSql);
  const realTables = referencedTables.filter((table) => !cteNames.has(table));

  if (realTables.length === 0) {
    return { ok: false, reason: 'Query must read at least one approved data table.' };
  }

  for (const table of realTables) {
    if (!ALLOWED_TABLES.has(table)) {
      return { ok: false, reason: `Table is not available to AI queries: ${table}.` };
    }
  }

  return { ok: true, sql: stripped, tablesUsed: realTables };
}

function hasLimitClause(sql: string): boolean {
  return /\blimit\s+\d+\b/i.test(maskStringLiterals(sql));
}

function getLimitValue(sql: string): number | null {
  const match = maskStringLiterals(sql).match(/\blimit\s+(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function questionAllowsLimitedSql(queryText: string): boolean {
  return /\b(top|latest|recent|first|last|newest|oldest|highest|lowest|best|worst|most\s+recent)\b/i.test(queryText) ||
    /\b\d+\b/.test(queryText);
}

function questionExplicitlyAsksForSingleRow(queryText: string): boolean {
  return /\b(single|only one|one|1|top|highest|lowest|best|worst)\b/i.test(queryText);
}

function questionAsksForPluralList(queryText: string): boolean {
  return /\b(records|runs|activities|capsules|users|trainees|courses|constraints|names|rows|cases)\b/i.test(queryText);
}

function validatePlannerSqlPolicy(queryText: string, sql: string): string | null {
  const limitValue = getLimitValue(sql);
  if (limitValue === null) return null;

  if (!questionAllowsLimitedSql(queryText)) {
    return 'The user did not ask for a limited result set. Remove LIMIT and return all matching groups or rows.';
  }

  if (
    limitValue === 1 &&
    questionAsksForPluralList(queryText) &&
    !questionExplicitlyAsksForSingleRow(queryText)
  ) {
    return 'The user asked for plural results. Remove LIMIT 1; use LIMIT 10 only for latest/recent plural lists or no LIMIT for all groups.';
  }

  return null;
}

function redactRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const safe: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (SENSITIVE_TOKENS.includes(key.toLowerCase())) continue;
      safe[key] = value;
    }
    return safe;
  });
}

function executeVerifiedSql(
  db: Database.Database,
  validation: SqlValidationSuccess,
  rowLimit: number
): ExecuteSqlResult {
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS total_count FROM (${validation.sql}) AS dataassist_ai_result`)
    .get() as { total_count: number };
  const totalCount = Number(totalRow?.total_count ?? 0);
  const capped = !hasLimitClause(validation.sql) && totalCount > rowLimit;
  const sqlToRun = capped
    ? `SELECT * FROM (${validation.sql}) AS dataassist_ai_result LIMIT ${rowLimit}`
    : validation.sql;
  const rows = db.prepare(sqlToRun).all() as Record<string, unknown>[];
  const safeRows = redactRows(rows);

  return {
    rows: safeRows,
    totalCount,
    rowCount: safeRows.length,
    capped,
  };
}

function humanizeColumnName(column: string): string {
  const replacements: Record<string, string> = {
    army_no: 'Army No',
    course_name: 'Course',
    course_code: 'Course Code',
    completion_date: 'Date',
    is_rtu: 'RTU',
    rtu_reason_code: 'RTU Reason',
    rtu_reason_details: 'RTU Details',
    is_active: 'Active',
    total_count: 'Total',
    cnt: 'Count',
    avg_score: 'Average Score',
    pass_rate: 'Pass Rate',
  };
  if (replacements[column]) return replacements[column];
  return column
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatCell(value: unknown): unknown {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 10);
  }
  return value;
}

function pluralizeRows(count: number): string {
  return count === 1 ? '1 matching row' : `${count} matching rows`;
}

function buildChart(title: string, rows: Record<string, unknown>[]): ChartData[] | undefined {
  if (rows.length === 0) return undefined;
  const keys = Object.keys(rows[0]);
  if (keys.length < 2) return undefined;

  const nameKey = keys.find((key) => typeof rows[0][key] === 'string') ?? keys[0];
  const numericKeys = keys.filter((key) => typeof rows[0][key] === 'number');
  if (numericKeys.length === 0) return undefined;

  return [
    {
      type: 'bar',
      title,
      xKey: nameKey,
      data: rows.map((row) => {
        const point: Record<string, unknown> = {
          [nameKey]: row[nameKey],
        };
        for (const key of numericKeys) point[key] = row[key];
        return point;
      }),
    },
  ];
}

export function formatDatabaseAnswer(input: FormatDatabaseAnswerInput): AIQueryResponse {
  const title = input.title || 'Database Result';
  const rowCount = typeof input.rowCount === 'number' ? input.rowCount : input.rows.length;
  const keys = input.rows.length > 0 ? Object.keys(input.rows[0]) : [];
  const headers = keys.map(humanizeColumnName);
  const tableRows = input.rows.map((row) => keys.map((key) => formatCell(row[key])));
  const aggregateLines =
    input.rows.length === 1 && keys.length > 0 && (input.answerMode === 'aggregate' || keys.length <= 4)
      ? keys.map((key) => `- ${humanizeColumnName(key)}: **${String(formatCell(input.rows[0][key]))}**`)
      : [];
  const cappedLine = input.capped
    ? ` Showing first ${rowCount} of ${input.totalCount} exact matches.`
    : '';
  const emptyLine = input.totalCount === 0
    ? `${UNAVAILABLE_TEXT} No matching rows were found for this question.`
    : `Found **${pluralizeRows(input.totalCount)}** from the database.${cappedLine}`;

  const deterministicText = [
    `**Exact database result: ${title}**`,
    '',
    emptyLine,
    ...(aggregateLines.length > 0 ? ['', ...aggregateLines] : []),
    '',
    'Every value shown comes from a validated read-only database query.',
  ].join('\n');

  const narratorText =
    input.narratorText &&
    !containsProhibitedEstimateLanguage(input.narratorText) &&
    input.narratorText.trim().length > 0
      ? input.narratorText.trim()
      : null;

  return {
    text: narratorText ?? deterministicText,
    source: 'database',
    data: {
      verified: true,
      rowCount,
      totalCount: input.totalCount,
      capped: input.capped,
      tablesUsed: input.tablesUsed,
    },
    tables:
      keys.length > 0
        ? [
            {
              title,
              headers,
              rows: tableRows,
            },
          ]
        : undefined,
    charts: input.answerMode === 'chart' ? buildChart(title, input.rows) : undefined,
  };
}

async function defaultPlanner(queryText: string, feedback?: string): Promise<AIPlannerResult | null> {
  const messages: LMStudioMessage[] = [
    {
      role: 'system',
      content: [
        'You are the DataAssist SQL planner.',
        'Your only job is to translate the user question into safe SQLite SELECT SQL.',
        'Do not answer the user directly.',
        'Never estimate, infer from pass rates, or invent unavailable data.',
        buildSafeSchemaCatalog(),
      ].join('\n\n'),
    },
    {
      role: 'user',
      content: feedback
        ? [
            `Question: ${queryText}`,
            '',
            'Your previous SQL attempt was rejected or failed.',
            feedback,
            '',
            'Return corrected JSON only.',
          ].join('\n')
        : queryText,
    },
  ];

  const response = await queryLMStudioChat(messages, { temperature: 0, maxTokens: 1400 });
  return parsePlannerResponse(response);
}

async function defaultGeneralResponder(queryText: string): Promise<string | null> {
  const messages: LMStudioMessage[] = [
    {
      role: 'system',
      content: [
        'You are DataAssist AI.',
        'Answer general help questions about using a military training management application.',
        'Do not answer factual questions about uploaded data in this mode.',
        'Do not answer external facts, current events, weather, internet lookups, legal advice, or medical advice.',
        `If the user asks for data facts, say: "${UNAVAILABLE_TEXT}"`,
        `If the user asks for anything outside DataAssist usage help, say: "${UNAVAILABLE_TEXT}"`,
      ].join('\n'),
    },
    { role: 'user', content: queryText },
  ];

  return queryLMStudioChat(messages, { temperature: 0.2, maxTokens: 1000 });
}

export async function runAiQuery(options: RunAiQueryOptions): Promise<AIQueryResponse> {
  const queryText = options.queryText.trim();
  if (!queryText) return unavailableResponse('Please enter a question.');

  const usingInjectedPlanner = Boolean(options.planner);
  const lmAvailable =
    typeof options.lmAvailable === 'boolean'
      ? options.lmAvailable
      : usingInjectedPlanner
        ? true
        : await checkLMStudioAvailable();

  if (!lmAvailable) {
    return unavailableResponse('LM Studio is not available, so DataAssist cannot safely plan a data query.');
  }

  const planner = options.planner ?? defaultPlanner;
  let feedback: string | undefined;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let plan: AIPlannerResult | null;
    try {
      plan = await planner(queryText, feedback);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn('[AI] Planner failed:', msg);
      if (attempt === 1) {
        feedback = `Planner call failed: ${msg}. Return one corrected JSON object.`;
        continue;
      }
      return unavailableResponse('The AI planner could not produce a safe query.');
    }

    if (!plan || plan.intent === 'unanswerable') {
      return unavailableResponse();
    }

    if (plan.intent === 'not_data_query') {
      try {
        const text = await (options.generalResponder ?? defaultGeneralResponder)(queryText);
        if (!text || containsProhibitedEstimateLanguage(text)) return unavailableResponse();
        return { text, source: 'lmstudio' };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn('[AI] General responder failed:', msg);
        return unavailableResponse();
      }
    }

    const validation = validateReadOnlySql(plan.sql ?? '');
    if (validation.ok === false) {
      console.warn('[AI] Rejected planner SQL:', validation.reason);
      if (attempt === 1) {
        feedback = [
          `SQL rejected by validator: ${validation.reason}`,
          `Previous SQL: ${plan.sql ?? ''}`,
          'Use only the approved schema and return one corrected SELECT query.',
        ].join('\n');
        continue;
      }
      return unavailableResponse(validation.reason);
    }

    const policyIssue = validatePlannerSqlPolicy(queryText, validation.sql);
    if (policyIssue) {
      console.warn('[AI] Rejected planner SQL policy:', policyIssue);
      if (attempt === 1) {
        feedback = [
          `SQL rejected by DataAssist policy: ${policyIssue}`,
          `Previous SQL: ${validation.sql}`,
          'Return corrected JSON only.',
        ].join('\n');
        continue;
      }
      return unavailableResponse(policyIssue);
    }

    let execution: ExecuteSqlResult;
    try {
      execution = executeVerifiedSql(options.db, validation, options.rowLimit ?? DEFAULT_ROW_LIMIT);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn('[AI] SQL execution failed:', msg);
      if (attempt === 1) {
        feedback = [
          `SQL failed during SQLite execution: ${msg}`,
          `Previous SQL: ${validation.sql}`,
          'Repair the SQL using the safe schema. Return corrected JSON only.',
        ].join('\n');
        continue;
      }
      return unavailableResponse('The generated query could not be executed safely.');
    }

    const title = plan.title || 'Database Result';
    let narratorText: string | null = null;
    if (options.narrator) {
      try {
        narratorText = await options.narrator({
          queryText,
          title,
          ...execution,
          tablesUsed: validation.tablesUsed,
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn('[AI] Narrator failed, using deterministic database answer:', msg);
      }
    }

    return formatDatabaseAnswer({
      queryText,
      title,
      ...execution,
      tablesUsed: validation.tablesUsed,
      answerMode: plan.answerMode,
      narratorText,
    });
  }

  return unavailableResponse('The AI planner could not produce a safe executable query.');
}
