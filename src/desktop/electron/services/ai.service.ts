import * as http from 'http';

const LM_STUDIO_HOST = 'localhost';
const LM_STUDIO_PORT = 1234;

export interface LMStudioMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LMStudioChatOptions {
  temperature?: number;
  maxTokens?: number;
}

function httpGet(
  host: string,
  port: number,
  path: string,
  timeoutMs: number
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: host,
      port,
      path,
      method: 'GET',
      timeout: timeoutMs,
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body }));
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED') {
        reject(new Error('LM Studio not running (ECONNREFUSED)'));
      } else {
        reject(err);
      }
    });
    req.end();
  });
}

function httpPost(
  host: string,
  port: number,
  path: string,
  body: string,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: host,
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: timeoutMs,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('LM Studio request timed out'));
    });
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED') {
        reject(new Error('LM Studio is not running (connection refused)'));
      } else {
        reject(err);
      }
    });
    req.write(body);
    req.end();
  });
}

export async function checkLMStudioAvailable(): Promise<boolean> {
  try {
    const result = await httpGet(LM_STUDIO_HOST, LM_STUDIO_PORT, '/v1/models', 2000);
    return result.statusCode === 200;
  } catch {
    return false;
  }
}

export async function getLMStudioModelName(): Promise<string | null> {
  try {
    const result = await httpGet(LM_STUDIO_HOST, LM_STUDIO_PORT, '/v1/models', 2000);
    if (result.statusCode !== 200) return null;
    const parsed = JSON.parse(result.body);
    return (parsed?.data?.[0]?.id as string) || 'local-model';
  } catch {
    return null;
  }
}

export async function queryLMStudioChat(
  messages: LMStudioMessage[],
  options: LMStudioChatOptions = {}
): Promise<string> {
  const requestBody = JSON.stringify({
    model: 'local-model',
    messages,
    temperature: options.temperature ?? 0,
    max_tokens: options.maxTokens ?? 2000,
    stream: false,
  });

  const rawResponse = await httpPost(
    LM_STUDIO_HOST,
    LM_STUDIO_PORT,
    '/v1/chat/completions',
    requestBody,
    120000
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    throw new Error('LM Studio returned invalid JSON');
  }

  const content =
    (parsed as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('LM Studio returned an empty or malformed response');
  }

  return content;
}

const PROHIBITED_ESTIMATE_PATTERNS = [
  /\bestimat(?:e|ed|es|ing|ion)\b/i,
  /\bapprox(?:\.|imately)?\b/i,
  /\broughly\b/i,
  /≈|~\s*\d/,
  /\bnot directly available\b/i,
  /\bnot available\b/i,
  /\bwe can calculate\b/i,
  /\bcan be calculated\b/i,
  /\bcalculate (?:it|this|the)\b/i,
  /\bcalculated from\b/i,
  /\bcalculated by\b/i,
  /\busing (?:the\s+)?(?:global\s+|overall\s+)?pass rate\b/i,
  /\bderived from\b/i,
  /\binfer(?:red|s|ring|ence)?\b/i,
  /\bextrapolat(?:e|ed|es|ing|ion)\b/i,
  /\bround(?:ed)?\s+(?:down|up|to)\b/i,
];

export function containsProhibitedEstimateLanguage(text: string): boolean {
  return PROHIBITED_ESTIMATE_PATTERNS.some((pattern) => pattern.test(text));
}
