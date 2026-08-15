/**
 * Wrapper minimal de Sentry usando fetch directo al endpoint Store.
 *
 * NO es la integración oficial. Para mejor experiencia (source maps, breadcrumbs,
 * tracing, replays, etc.) instalar `@sentry/nextjs` en el futuro.
 *
 * Si `SENTRY_DSN` no está configurado, las funciones hacen `console.error` /
 * `console.warn` y retornan sin hacer red (no-op silencioso).
 *
 * Formato esperado del DSN: `https://<publicKey>@<host>/<projectId>`.
 */

interface ParsedDsn {
  publicKey: string;
  host: string;
  projectId: string;
  storeUrl: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, '');
    if (!publicKey || !projectId) return null;
    const host = url.host;
    const storeUrl = `${url.protocol}//${host}/api/${projectId}/store/`;
    return { publicKey, host, projectId, storeUrl };
  } catch {
    return null;
  }
}

function buildAuthHeader(publicKey: string): string {
  const ts = Math.floor(Date.now() / 1000);
  return [
    'Sentry sentry_version=7',
    `sentry_timestamp=${ts}`,
    `sentry_key=${publicKey}`,
    'sentry_client=hatril/0.1',
  ].join(', ');
}

function randomEventId(): string {
  // Sentry espera un hex de 32 chars sin guiones.
  let id = '';
  for (let i = 0; i < 32; i++) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
}

async function sendToSentry(payload: Record<string, unknown>): Promise<void> {
  const dsn = process.env.SENTRY_DSN ?? '';
  if (!dsn) return;
  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.warn('[sentry] DSN inválido, ignorando evento');
    return;
  }
  try {
    await fetch(parsed.storeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': buildAuthHeader(parsed.publicKey),
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[sentry] no se pudo enviar el evento:', err);
  }
}

/**
 * Captura una excepción y la envía a Sentry. Si SENTRY_DSN no está configurado,
 * hace `console.error` y retorna sin error.
 */
export async function captureException(
  err: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const dsn = process.env.SENTRY_DSN ?? '';
  if (!dsn) {
    console.error('[captureException]', err, context ?? '');
    return;
  }

  const baseMessage =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
  const stack = err instanceof Error ? err.stack ?? '' : '';
  const type = err instanceof Error ? err.name : 'Error';

  // Drizzle/postgres-js envuelven el error nativo y dejan el SQLSTATE y el
  // mensaje real de Postgres en `err.cause`. Sin esto, Sentry solo mostraba
  // el mensaje genérico de la query y no el motivo (ej. 42P01 undefined_table,
  // 23505 unique_violation). Los exponemos en el extra y en el mensaje.
  const cause =
    err && typeof err === 'object' && 'cause' in err
      ? (err as { cause?: unknown }).cause
      : undefined;
  const pgCode =
    cause && typeof cause === 'object' && typeof (cause as { code?: unknown }).code === 'string'
      ? ((cause as { code: string }).code)
      : typeof (err as { code?: unknown })?.code === 'string'
        ? ((err as { code: string }).code)
        : undefined;
  const causeMessage =
    cause instanceof Error
      ? cause.message
      : cause && typeof cause === 'object' && typeof (cause as { message?: unknown }).message === 'string'
        ? ((cause as { message: string }).message)
        : undefined;

  // El mensaje que llega a Sentry incluye el código y la causa si existen.
  const message = pgCode
    ? `[${pgCode}] ${causeMessage ?? baseMessage}`
    : baseMessage;

  const payload: Record<string, unknown> = {
    event_id: randomEventId(),
    timestamp: new Date().toISOString(),
    level: 'error',
    message,
    exception: {
      values: [
        {
          type,
          value: message,
          stacktrace: stack
            ? {
                frames: stack
                  .split('\n')
                  .slice(1)
                  .map((line) => ({ filename: line.trim() })),
              }
            : undefined,
        },
      ],
    },
    extra: {
      ...(context ?? {}),
      ...(pgCode ? { pg_code: pgCode } : {}),
      ...(causeMessage ? { pg_message: causeMessage } : {}),
    },
  };

  await sendToSentry(payload);
}

/**
 * Envía un mensaje de log a Sentry (info / warning / error).
 * Si SENTRY_DSN no está configurado, hace console.* y retorna.
 */
export async function captureMessage(
  msg: string,
  level: 'info' | 'warning' | 'error' = 'info',
): Promise<void> {
  const dsn = process.env.SENTRY_DSN ?? '';
  if (!dsn) {
    if (level === 'error') console.error('[captureMessage]', msg);
    else if (level === 'warning') console.warn('[captureMessage]', msg);
    else console.log('[captureMessage]', msg);
    return;
  }

  const payload: Record<string, unknown> = {
    event_id: randomEventId(),
    timestamp: new Date().toISOString(),
    level,
    type: 'message',
    message: msg,
  };

  await sendToSentry(payload);
}
