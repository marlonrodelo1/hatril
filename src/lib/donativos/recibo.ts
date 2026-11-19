import 'server-only';

import { createHmac, createHash } from 'node:crypto';

import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { NOMBRE_TIPO, formatearEuros, type TipoDonativo } from './calculo';

/**
 * El recibo por correo y el enlace para cambiar o dejar lo de cada mes.
 *
 * EL ENLACE NO SE GUARDA, SE CALCULA
 * ----------------------------------
 * El token es un HMAC del id del donativo mensual con `DONATIVOS_ENLACES_SECRETO`.
 * Así el webhook puede ponerlo en el recibo de cualquier mes —cada cobro llega
 * en una petición distinta— sin haberlo guardado nunca. En la base solo está
 * su sha-256, para encontrar la fila al abrir el enlace: quien lea la tabla no
 * puede fabricarlo.
 */

function secreto(): string {
  const s = process.env.DONATIVOS_ENLACES_SECRETO;
  if (!s) throw new Error('Falta DONATIVOS_ENLACES_SECRETO.');
  return s;
}

export function tokenDeMensual(mensualId: string): string {
  return createHmac('sha256', secreto()).update(`mensual:${mensualId}`).digest('base64url');
}

export function hashDeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type DatosRecibo = {
  iglesia: { nombre: string; slug: string };
  donanteNombre: string;
  fecha: string;
  lineas: { tipo: TipoDonativo; fondo: string; importe: string }[];
  comisionCubierta: string;
  total: string;
  ultimos4: string | null;
  /** Solo si es mensual: el enlace para cambiarlo o dejarlo. */
  enlaceGestion: string | null;
  primerCobro: boolean;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function reciboDonativo(d: DatosRecibo): { asunto: string; html: string; texto: string } {
  const total = formatearEuros(Number(d.total));
  const mensual = d.enlaceGestion !== null;
  const asunto = mensual
    ? d.primerCobro
      ? `Tu ofrenda de cada mes a ${d.iglesia.nombre} · ${total}`
      : `Recibo de tu ofrenda de este mes · ${total}`
    : `Recibo de tu ofrenda a ${d.iglesia.nombre} · ${total}`;

  const filas = [
    ...d.lineas.map((l) => [`${NOMBRE_TIPO[l.tipo]} · ${l.fondo}`, formatearEuros(Number(l.importe))]),
    ...(Number(d.comisionCubierta) > 0 ? [['Comisión de la tarjeta, cubierta', formatearEuros(Number(d.comisionCubierta))]] : []),
  ];
  const fecha = formatearFechaLarga(d.fecha);
  const nombre = d.donanteNombre.split(' ')[0] || d.donanteNombre;
  const intro = mensual && d.primerCobro
    ? `Gracias. Desde hoy das esto a ${d.iglesia.nombre} cada mes:`
    : `Gracias. Esto es lo que has dado a ${d.iglesia.nombre} el ${fecha}:`;
  const tarjeta = d.ultimos4 ? `Pagado con tarjeta acabada en ${d.ultimos4}.` : 'Pagado con tarjeta.';

  const texto = [
    `Hola, ${nombre}:`,
    '',
    intro,
    ...filas.map(([a, b]) => `  ${a}: ${b}`),
    `  Total: ${total}`,
    '',
    `${tarjeta} El dinero va directo a la iglesia.`,
    ...(mensual ? ['', `Para cambiar la cantidad o dejarlo: ${d.enlaceGestion}`] : []),
    '',
    `Te escribimos porque has dado a ${d.iglesia.nombre} desde su página en Hatril. Guarda este correo como justificante.`,
  ].join('\n');

  // Colores del sistema de Hatril, escritos a mano porque un correo no lee
  // `globals.css`: crema de fondo, carbón de texto, borde de 1px y nada más.
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#faf9f5;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#141413">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e0dfdb;border-radius:12px">
<tr><td style="padding:24px 24px 8px;font-size:15px;line-height:1.5">
<p style="margin:0 0 12px">Hola, ${esc(nombre)}:</p>
<p style="margin:0 0 16px">${esc(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0dfdb;border-radius:10px;font-size:14px">
${filas.map(([a, b]) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #e0dfdb">${esc(a!)}</td><td align="right" style="padding:10px 12px;border-bottom:1px solid #e0dfdb;white-space:nowrap">${esc(b!)}</td></tr>`).join('')}
<tr><td style="padding:10px 12px;font-weight:700">Total</td><td align="right" style="padding:10px 12px;font-weight:700;white-space:nowrap">${esc(total)}</td></tr>
</table>
<p style="margin:16px 0 0">${esc(tarjeta)} El dinero va directo a la iglesia.</p>
${mensual ? `<p style="margin:12px 0 0"><a href="${esc(d.enlaceGestion!)}" style="color:#92442a;font-weight:600">Cambiar la cantidad o dejarlo</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 24px 20px;font-size:12px;color:#67665f;border-top:1px solid #e0dfdb">Te escribimos porque has dado a ${esc(d.iglesia.nombre)} desde su página en Hatril. Guarda este correo como justificante.</td></tr>
</table></td></tr></table></body></html>`;

  return { asunto, html, texto };
}
