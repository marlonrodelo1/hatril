import 'server-only';

import { Wallet } from 'lucide-react';

import { puedeVerFondoDe } from '@/lib/auth/permisos';
import type { HerramientaDerivada } from '@/lib/ministerios/en-la-app/contrato';
import { mesPedido } from '@/lib/fecha/mes';
import { formatearDinero, formatearDineroConSigno } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { cuentasDelFondo } from './del-ministerio';

/**
 * El fondo del ministerio en la portada de la app del líder.
 *
 * Derivado y no módulo (`HerramientaDerivada`): sale porque el pastor vinculó
 * un fondo desde Finanzas, no por una casilla del ministerio. La puerta es la
 * de la pestaña del panel —`puedeVerFondoDe`: quien lo lleva desde dentro y
 * con Finanzas encendida— y la misma que pone su pantalla de la app.
 *
 * Solo cifras: lo que hay y lo que entró y salió en el mes. Ni un concepto en
 * la portada, que se abre en un móvil en medio de la gente; los gastos uno a
 * uno están en su pantalla. Y sin vista de participante: el voluntario no ve
 * el dinero del equipo.
 */
export const fondoEnLaApp: HerramientaDerivada = {
  id: 'fondo',
  nombre: 'Fondo',
  Icono: Wallet,
  abrir: 'Ver el fondo',
  pantalla: 'app',
  aplica: (ctx, ministerio) =>
    ministerio.conFondo && puedeVerFondoDe(ctx, ministerio.id),
  async resumen(ctx, ministerio) {
    const mes = mesPedido(ctx.iglesia.timezone, undefined);
    const cuentas = await cuentasDelFondo(ctx, ministerio.id, mes.desde, mes.hasta);
    const moneda = ctx.iglesia.moneda as Moneda;

    if (!cuentas) {
      return {
        pendientes: [],
        vacio: 'Este ministerio ya no tiene un fondo vinculado.',
      };
    }

    const nombreMes = mes.etiqueta.split(' de ')[0] ?? mes.etiqueta;
    return {
      pendientes: [],
      cifras: [
        {
          rotulo: `Hay en «${cuentas.fondo.nombre}»`,
          valor: formatearDineroConSigno(cuentas.saldo, moneda).replace(/^\+/, ''),
        },
        { rotulo: `Entró en ${nombreMes}`, valor: formatearDinero(cuentas.entro, moneda) },
        { rotulo: `Salió en ${nombreMes}`, valor: formatearDinero(cuentas.salio, moneda) },
      ],
      vacio: '',
    };
  },
};
