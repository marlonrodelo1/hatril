import { NextResponse } from 'next/server';

/**
 * Comprueba el header `Authorization: Bearer <token>` contra la env
 * `INTERNAL_API_TOKEN`. Devuelve `null` si todo OK, o una `NextResponse`
 * con el error si falta/no coincide. Pensado para los endpoints que
 * consumen los crons systemd y herramientas internas (scripts admin,
 * tests, integraciones externas).
 */
export function requireApiToken(req: Request): NextResponse | null {
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: 'INTERNAL_API_TOKEN not configured' },
      { status: 500 },
    );
  }
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
