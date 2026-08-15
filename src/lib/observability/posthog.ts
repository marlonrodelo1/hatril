/**
 * Cliente PostHog "lite" — sin dependencias externas. Hace POST al endpoint
 * `/capture/` con `fetch`. Pensado para uso server-side (en route handlers,
 * server actions y API routes).
 *
 * Si `NEXT_PUBLIC_POSTHOG_KEY` no está configurado, todas las funciones son
 * no-op silenciosas.
 */

const DEFAULT_HOST = 'https://eu.posthog.com';

function getConfig(): { apiKey: string; host: string } | null {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
  if (!apiKey) return null;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_HOST;
  return { apiKey, host };
}

async function sendCapture(body: Record<string, unknown>): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;
  try {
    await fetch(`${cfg.host.replace(/\/$/, '')}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn('[posthog] capture failed:', err);
  }
}

/**
 * Registra un evento en PostHog.
 */
export async function track(
  event: string,
  properties?: Record<string, unknown>,
  distinctId?: string,
): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;
  await sendCapture({
    api_key: cfg.apiKey,
    event,
    distinct_id: distinctId ?? 'anonymous',
    properties: properties ?? {},
    timestamp: new Date().toISOString(),
  });
}

/**
 * Identifica a un usuario en PostHog (asociando traits a su distinctId).
 */
export async function identify(
  distinctId: string,
  traits?: Record<string, unknown>,
): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;
  await sendCapture({
    api_key: cfg.apiKey,
    event: '$identify',
    distinct_id: distinctId,
    properties: { $set: traits ?? {} },
    timestamp: new Date().toISOString(),
  });
}
