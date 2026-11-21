/**
 * Las dos iglesias de las pruebas, de usar y tirar.
 *
 * POR QUÉ EXISTE
 * --------------
 * Hasta el 20-nov-2026 las baterías de puertas y una parte de la de
 * aislamiento se apoyaban en Betania, una iglesia de demostración fija con diez
 * cuentas `@hatril.test` cuya contraseña estaba escrita en el repo, que es
 * público. Marlon la borró entera: salía en el buscador de hatril.com, y la base
 * de local ES la de producción. Las cuatro baterías dejaron de correr.
 *
 * De ahí salen tres reglas:
 *
 * - Cada ejecución monta sus propias iglesias y cuentas, y las borra al
 *   terminar, también si falla o se corta con Ctrl+C.
 * - Las cuentas no tienen contraseña: se entra con enlace mágico, como ya hacía
 *   `test:puertas`. No hay nada que filtrar.
 * - **Nunca se toca una iglesia que no haya montado esto.** El borrado se niega
 *   a tocar un slug que no empiece por `PREFIJO_SLUG`: Cuerpo de Cristo tiene
 *   gente de verdad, y un fallo aquí sería borrar su fichero.
 *
 * QUÉ MONTA
 * ---------
 * Lo mismo que tenía Betania para estas pruebas, con los mismos papeles, porque
 * las expectativas de las baterías están calibradas sobre ellos:
 *
 *   Betel (la propia): publicada, con la prueba gratis en vigor.
 *     pastor        lo puede todo
 *     secretaria    fichero, eventos y asistencia; nada de pastor ni de caja
 *     lider         rol líder, responsable de Alabanza; sin ver_seguimiento
 *     colider       rol miembro, colíder de Acción social y de la Radio
 *     consolidacion rol miembro con ver_seguimiento, responsable de Consolidación
 *     miembro       miembro raso, voluntaria de Alabanza
 *     enlace        miembro raso, voluntario de Acción social
 *     visita        sin iglesia: su solicitud está pendiente en Betel
 *   Sion (la otra): sin publicar, con la suscripción bloqueada.
 *     sion          su pastor
 *
 * Y en Betel, lo justo para que cada pantalla tenga algo que esconder: una
 * ficha sin cuenta con dirección, notas, teléfono y correo; Alabanza con
 * ensayo, turno con gente y una canción; Consolidación con una persona en
 * seguimiento; Acción social con un hogar en el padrón y un fondo vinculado;
 * la Radio con la emisora encendida; un culto con asistencia; un evento con un
 * inscrito, y un movimiento de caja.
 *
 * LO QUE DURA PUBLICADA
 * ---------------------
 * Betel sale en el buscador público mientras corre la batería (un par de
 * minutos): `test:puertas:app` comprueba justo eso, que lo publicado sale y lo
 * que no, no. Su nombre lo dice («Betel prueba …») y su descripción también.
 * Quien no lo necesite pide `publicada: false`.
 *
 * SI UNA EJECUCIÓN SE QUEDA A MEDIAS
 * ----------------------------------
 * Un `kill -9` o un corte de luz no pasan por el `finally`. Por eso montar
 * empieza barriendo los restos: iglesias con el prefijo y cuentas del dominio
 * de pruebas de más de dos horas. Las recientes no, porque pueden ser de otra
 * batería corriendo a la vez en otra terminal.
 */

import { randomBytes, randomUUID } from 'node:crypto';

import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';

export const PREFIJO_SLUG = 'prueba-auto-';
export const DOMINIO = 'pruebas.hatril.test';

// Las hijas antes que la iglesia, y en este orden por dos motivos:
// - `auditar()` apunta en `auditoria` cada baja de miembros, ministerios,
//   turnos… con el `iglesia_id` de la fila. Borrando la iglesia de golpe, esas
//   altas llegarían con la iglesia ya borrada. Así que primero las hijas,
//   luego `auditoria` —que se lleva también lo que acaban de apuntar— y la
//   iglesia la última.
// - Hay claves foráneas sin cascada entre hijas (movimientos → arqueos, cajas
//   y fondos; arqueos → fondos y cajas; donativo_lineas → fondos;
//   turno_canciones → canciones): se borra antes quien apunta.
// `registro_admin` no está: es el diario del super admin, solo admite añadir
// y estas pruebas no escriben en él.
const ORDEN_BORRADO = [
  'publicaciones_comentarios_me_gusta', 'publicaciones_me_gusta', 'publicaciones_comentarios',
  'denuncias_comunidad', 'publicaciones', 'bloqueos_comunidad', 'notificaciones',
  'turno_canciones', 'turno_asignaciones', 'turnos', 'canciones',
  'asistencias', 'reuniones', 'evento_inscripciones', 'eventos',
  'donativo_lineas', 'donativos', 'donativos_mensuales',
  'movimientos', 'arqueos', 'cajas', 'fondos',
  'grupo_guias', 'grupo_miembros', 'grupo_semanas', 'grupos',
  'reparto_entregas', 'reparto_beneficiarios', 'reparto_jornadas',
  'seguimiento_asignaciones', 'seguimiento_contactos',
  'solicitud_invitaciones', 'solicitudes_ingreso',
  'ministerio_miembros', 'devocionales', 'consentimientos', 'cuentas_stripe',
  'iglesia_usuarios', 'ministerios', 'miembros', 'auditoria',
];

/** Los papeles; cada uno es una cuenta `<papel>.<run>@pruebas.hatril.test`. */
const CUENTAS = ['pastor', 'secretaria', 'lider', 'colider', 'consolidacion', 'miembro', 'enlace', 'visita', 'sion'];

function conectar() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL (va en .env.local).');
  return postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1, onnotice: () => {} });
}

function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (van en .env.local).');
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}

const dia = (desplazamiento) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + desplazamiento);
  return d.toISOString().slice(0, 10);
};

/**
 * Borra iglesias montadas aquí, con todo lo suyo, en una transacción.
 *
 * Se niega a tocar cualquier slug sin el prefijo: es la única barrera entre un
 * id equivocado y el fichero de una iglesia de verdad.
 */
async function borrarIglesias(sql, ids) {
  if (!ids.length) return;
  await sql.begin(async (tx) => {
    const filas = await tx`select id, slug from iglesias where id in ${tx(ids)} for update`;
    const ajenas = filas.filter((f) => !f.slug.startsWith(PREFIJO_SLUG));
    if (ajenas.length) {
      throw new Error(`Me niego a borrar iglesias que no son de prueba: ${ajenas.map((f) => f.slug).join(', ')}`);
    }
    for (const t of ORDEN_BORRADO) await tx`delete from ${tx(t)} where iglesia_id in ${tx(ids)}`;
    await tx`delete from iglesias where id in ${tx(ids)}`;
  });
}

async function borrarCuentas(admin, ids) {
  const errores = [];
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    // Ya no existe: lo borró otra pasada. No es un fallo.
    if (error && error.status !== 404) errores.push(`${id}: ${error.message}`);
  }
  if (errores.length) throw new Error('No se pudieron borrar cuentas de prueba: ' + errores.join('; '));
}

/** Los restos de ejecuciones que no llegaron a su `finally`. */
export async function barrerRestos({ cuentas = true } = {}) {
  const sql = conectar();
  try {
    const viejas = await sql`
      select id from iglesias
       where slug like ${PREFIJO_SLUG + '%'} and created_at < now() - interval '2 hours'`;
    await borrarIglesias(sql, viejas.map((f) => f.id));

    if (cuentas) {
      const restos = await sql`
        select id from auth.users
         where email like ${'%@' + DOMINIO} and created_at < now() - interval '2 hours'`;
      if (restos.length) await borrarCuentas(clienteAdmin(), restos.map((f) => f.id));
    }
  } finally {
    await sql.end();
  }
}

/**
 * Monta Betel y Sion. Devuelve lo que las pruebas necesitan saber.
 *
 * `cuentas: false` no crea cuentas en auth: los usuarios son uuids sueltos.
 * Vale para lo que entra por `withUser()`, que solo mira `iglesia_usuarios`
 * (ninguna tabla de `public` tiene clave foránea a `auth.users` salvo
 * `dispositivos_push`), y así `test:aislamiento` no necesita la clave de
 * servicio.
 */
export async function montarDemo({ cuentas = true, publicada = true } = {}) {
  await barrerRestos({ cuentas });

  const run = randomBytes(4).toString('hex');
  const correo = (rol) => `${rol}.${run}@${DOMINIO}`;
  const admin = cuentas ? clienteAdmin() : null;

  // Las cuentas, sin contraseña. Si una falla, las ya creadas se borran.
  /** @type {Record<string, string>} */
  const usuarios = {};
  try {
    for (const rol of CUENTAS) {
      if (!admin) {
        usuarios[rol] = randomUUID();
        continue;
      }
      const { data, error } = await admin.auth.admin.createUser({ email: correo(rol), email_confirm: true });
      if (error) throw new Error(`No se pudo crear ${correo(rol)}: ${error.message}`);
      usuarios[rol] = data.user.id;
    }
  } catch (e) {
    if (admin) await borrarCuentas(admin, Object.values(usuarios)).catch(() => {});
    throw e;
  }

  const sql = conectar();
  try {
    const demo = await sql.begin(async (tx) => {
      const [betel] = await tx`
        insert into iglesias ${tx({
          slug: `${PREFIJO_SLUG}${run}`,
          nombre: `Betel prueba ${run}`,
          denominacion: 'Prueba automática',
          descripcion: 'Iglesia creada por las pruebas automáticas de Hatril. Se borra sola al terminar.',
          pais: 'CO',
          ciudad: 'Bogotá',
          direccion: 'Calle 45 #12-30',
          timezone: 'America/Bogota',
          moneda: 'COP',
          visible_en_directorio: publicada,
          web_publica: publicada,
          acepta_solicitudes: true,
          plan: 'trial',
          trial_until: new Date(Date.now() + 30 * 86_400_000),
          activa: true,
          comunidad_activa: true,
          latitud: 4.6312,
          longitud: -74.0668,
        })}
        returning id, slug, nombre`;
      // Vencida hace un mes: pasada la gracia de tres días, el panel la manda
      // a /suscripcion antes de consultar nada.
      const [sion] = await tx`
        insert into iglesias ${tx({
          slug: `${PREFIJO_SLUG}sion-${run}`,
          nombre: `Sion prueba ${run}`,
          denominacion: 'Prueba automática',
          pais: 'ES',
          ciudad: 'Madrid',
          timezone: 'Europe/Madrid',
          moneda: 'EUR',
          visible_en_directorio: false,
          web_publica: false,
          plan: 'trial',
          trial_until: new Date(Date.now() - 30 * 86_400_000),
          activa: true,
        })}
        returning id, slug, nombre`;
      const B = betel.id;

      const ficha = async (iglesia, datos) =>
        (await tx`insert into miembros ${tx({ iglesia_id: iglesia, estado: 'miembro', ...datos })} returning id`)[0].id;

      const f = {
        pastor: await ficha(B, { nombre: 'Brandon', apellidos: 'Quintero Ruiz', telefono: '+573104567890', auth_user_id: usuarios.pastor }),
        secretaria: await ficha(B, { nombre: 'Pilar', apellidos: 'Montoya Vélez', telefono: '+573118765432', auth_user_id: usuarios.secretaria }),
        lider: await ficha(B, { nombre: 'David', apellidos: 'Ospina Lara', telefono: '+573125551234', auth_user_id: usuarios.lider }),
        colider: await ficha(B, { nombre: 'Sara', apellidos: 'Nieto Cárdenas', telefono: '+573136662345', auth_user_id: usuarios.colider }),
        consolidacion: await ficha(B, { nombre: 'Noemí', apellidos: 'Arango Pérez', telefono: '+573147773456', auth_user_id: usuarios.consolidacion }),
        miembro: await ficha(B, { nombre: 'Lucía', apellidos: 'Ramírez Soto', telefono: '+573158884567', auth_user_id: usuarios.miembro }),
        enlace: await ficha(B, { nombre: 'Andrés', apellidos: 'Duque Rendón', telefono: '+573169995678', auth_user_id: usuarios.enlace }),
        // Sin cuenta. Carmen es «la ficha»: la que más datos protegidos tiene,
        // de alguien que no hace la prueba.
        marcel: await ficha(B, { nombre: 'Marcel', apellidos: 'Zapata Gil', telefono: '+573171116789' }),
        carmen: await ficha(B, {
          nombre: 'Carmen',
          apellidos: 'Restrepo Gil',
          telefono: '+573157778899',
          email: 'carmen.restrepo@ejemplo.test',
          direccion: 'Carrera 15 #80-21, apartamento 302',
          notas: 'Prefiere que la llamen por la tarde',
        }),
        ruben: await ficha(B, { nombre: 'Rubén', apellidos: 'Castaño Mejía', telefono: '+573182227890', estado: 'nuevo' }),
        sion: await ficha(sion.id, { nombre: 'Esteban', apellidos: 'Moreno Sáez', telefono: '+34611223344', auth_user_id: usuarios.sion }),
      };

      const membresia = (iglesia, rol, datos) =>
        tx`insert into iglesia_usuarios ${tx({ iglesia_id: iglesia, auth_user_id: usuarios[rol], estado: 'activo', permisos: {}, ...datos })}`;
      await membresia(B, 'pastor', { rol: 'pastor', miembro_id: f.pastor });
      await membresia(B, 'secretaria', { rol: 'secretaria', miembro_id: f.secretaria });
      await membresia(B, 'lider', { rol: 'lider', miembro_id: f.lider, permisos: { ver_datos_sensibles: true } });
      await membresia(B, 'colider', { rol: 'miembro', miembro_id: f.colider });
      await membresia(B, 'consolidacion', { rol: 'miembro', miembro_id: f.consolidacion, permisos: { ver_seguimiento: true } });
      await membresia(B, 'miembro', { rol: 'miembro', miembro_id: f.miembro });
      await membresia(B, 'enlace', { rol: 'miembro', miembro_id: f.enlace });
      await membresia(B, 'visita', { rol: 'miembro', estado: 'pendiente', miembro_id: null });
      await membresia(sion.id, 'sion', { rol: 'pastor', miembro_id: f.sion });
      await tx`insert into solicitudes_ingreso ${tx({ iglesia_id: B, auth_user_id: usuarios.visita, nombre: 'Valentina Visita' })}`;

      // Los módulos, tal como los tenía Betania.
      const ministerio = async (nombre, tipo, modulos) =>
        (await tx`insert into ministerios ${tx({ iglesia_id: B, nombre, tipo, modulos })} returning id`)[0].id;
      const m = {
        alabanza: await ministerio('Alabanza', 'alabanza', {
          agenda: { activo: true }, turnos: { activo: true }, repertorio: { activo: true }, seguimiento: { activo: false },
        }),
        consolidacion: await ministerio('Consolidación', 'consolidacion', {
          agenda: { activo: true }, seguimiento: { activo: true },
        }),
        accionSocial: await ministerio('Acción social', 'accion_social', {
          agenda: { activo: true }, turnos: { activo: false }, reparto: { activo: true }, repertorio: { activo: false }, seguimiento: { activo: false },
        }),
        radio: await ministerio('Radio', 'radio', {
          agenda: { activo: true },
          turnos: { activo: true },
          emisora: {
            activo: true,
            en_web: true,
            nombre: 'Radio de prueba',
            parrilla: [{ dia: 'Lunes', hora: '19:00', nombre: 'Alabanza de la tarde', duracion_min: 120 }],
            stream_url: 'https://icecast.radiofrance.fr/fip-midfi.mp3',
          },
          repertorio: { activo: false },
          seguimiento: { activo: false },
        }),
      };

      const equipo = (min, miembro, rol_equipo) =>
        tx`insert into ministerio_miembros ${tx({ iglesia_id: B, ministerio_id: min, miembro_id: miembro, rol_equipo })}`;
      await equipo(m.alabanza, f.lider, 'responsable');
      await equipo(m.alabanza, f.miembro, 'voluntario');
      await equipo(m.consolidacion, f.consolidacion, 'responsable');
      await equipo(m.consolidacion, f.pastor, 'voluntario');
      await equipo(m.accionSocial, f.marcel, 'responsable');
      await equipo(m.accionSocial, f.colider, 'colider');
      await equipo(m.accionSocial, f.enlace, 'voluntario');
      await equipo(m.radio, f.colider, 'colider');

      const uno = async (tabla, datos) =>
        (await tx`insert into ${tx(tabla)} ${tx({ iglesia_id: B, ...datos })} returning id`)[0].id;

      const reunionAlabanza = await uno('reuniones', {
        ministerio_id: m.alabanza, titulo: 'Ensayo de alabanza', fecha: dia(2), notas: 'Traer las partituras nuevas impresas',
      });
      const reunionCongregacion = await uno('reuniones', {
        titulo: 'Culto dominical', fecha: dia(-3), notas: 'Predicación sobre Nehemías, capítulo dos',
      });
      for (const miembro of [f.miembro, f.enlace, f.ruben]) {
        await uno('asistencias', { reunion_id: reunionCongregacion, miembro_id: miembro, presente: true });
      }

      const turnoAlabanza = await uno('turnos', {
        ministerio_id: m.alabanza, titulo: 'Culto del domingo', fecha: dia(5), notas: 'Llegar a las ocho para la prueba de sonido',
      });
      await uno('turno_asignaciones', { turno_id: turnoAlabanza, miembro_id: f.miembro, puesto: 'Voz' });
      await uno('turno_asignaciones', { turno_id: turnoAlabanza, miembro_id: f.lider, puesto: 'Guitarra' });
      const cancionAlabanza = await uno('canciones', {
        ministerio_id: m.alabanza, titulo: 'Cuán grande es Él', autor: 'Carl Boberg', tono: 'G',
      });

      await uno('seguimiento_asignaciones', {
        ministerio_id: m.consolidacion, miembro_id: f.ruben, responsable_miembro_id: f.consolidacion,
      });
      await uno('seguimiento_contactos', {
        ministerio_id: m.consolidacion, miembro_id: f.ruben, autor_miembro_id: f.consolidacion,
        fecha: dia(-2), via: 'llamada', resultado: 'volvera', proximo_paso: 'Invitarle al grupo de los jueves',
      });

      const beneficiario = await uno('reparto_beneficiarios', {
        ministerio_id: m.accionSocial, nombre: 'Familia Gutiérrez Pardo', telefono: '+573209998877',
        personas_hogar: 4, consentimiento_version: 'reparto-2026-10',
      });

      const fondoGeneral = await uno('fondos', { nombre: 'Fondo general', es_general: true });
      const fondoAccionSocial = await uno('fondos', { nombre: 'Fondo de Acción social', ministerio_id: m.accionSocial });
      const caja = await uno('cajas', { nombre: 'Caja del templo', tipo: 'efectivo' });
      const movimiento = await uno('movimientos', {
        tipo: 'ingreso', tipo_ingreso: 'ofrenda', fecha: dia(-3), importe: 185000,
        concepto: 'Ofrenda del culto dominical', fondo_id: fondoGeneral, caja_id: caja,
      });

      const evento = await uno('eventos', {
        titulo: 'Retiro de matrimonios', inicio_en: new Date(Date.now() + 20 * 86_400_000), lugar: 'Finca La Esperanza',
      });
      await uno('evento_inscripciones', {
        evento_id: evento, nombre: 'Julián Herrera Patiño', email: 'julian.herrera@ejemplo.test',
        telefono: '+573001112233', nota: 'Viene con su esposa', origen: 'panel',
        codigo_cancelacion: randomBytes(16).toString('hex'), consentimiento_version: 'eventos-2026-09',
      });

      return {
        run,
        conCuentas: cuentas,
        betel: { id: betel.id, slug: betel.slug, nombre: betel.nombre },
        sion: { id: sion.id, slug: sion.slug, nombre: sion.nombre },
        cuentas: Object.fromEntries(CUENTAS.map((rol) => [rol, correo(rol)])),
        usuarios,
        fichas: f,
        ids: {
          alabanza: m.alabanza,
          consolidacion: m.consolidacion,
          accionSocial: m.accionSocial,
          radio: m.radio,
          reunionAlabanza,
          reunionCongregacion,
          turnoAlabanza,
          cancionAlabanza,
          personaSeguimiento: f.ruben,
          beneficiario,
          movimiento,
          fondoGeneral,
          fondoAccionSocial,
          caja,
          evento,
          ficha: f.carmen,
        },
      };
    });
    return demo;
  } catch (e) {
    // La transacción ya se deshizo; quedan las cuentas.
    if (admin) await borrarCuentas(admin, Object.values(usuarios)).catch(() => {});
    throw e;
  } finally {
    await sql.end();
  }
}

/** Borra lo que montó `montarDemo`: las dos iglesias y sus cuentas. */
export async function desmontarDemo(demo) {
  if (!demo) return;
  const sql = conectar();
  try {
    await borrarIglesias(sql, [demo.betel.id, demo.sion.id]);
  } finally {
    await sql.end();
  }
  // Con `cuentas: false` los usuarios son uuids sueltos: no hay nada en auth.
  if (demo.conCuentas) await borrarCuentas(clienteAdmin(), Object.values(demo.usuarios));
}

/**
 * Monta, ejecuta y desmonta. El desmontaje corre también si `fn` lanza o si
 * se pulsa Ctrl+C. Lo que no lo salva es un `process.exit()` dentro de `fn`:
 * por eso las baterías ponen `process.exitCode` y vuelven.
 *
 * @template T
 * @param {{ cuentas?: boolean, publicada?: boolean }} opciones
 * @param {(demo: Awaited<ReturnType<typeof montarDemo>>) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function conDemo(opciones, fn) {
  const demo = await montarDemo(opciones);
  console.log(`Montadas ${demo.betel.slug} y ${demo.sion.slug}; se borran al terminar.`);
  let desmontada = false;
  const desmontar = async () => {
    if (desmontada) return;
    desmontada = true;
    await desmontarDemo(demo);
  };
  const alInterrumpir = () => {
    console.error('\nInterrumpido: borrando las iglesias de prueba…');
    desmontar().finally(() => process.exit(130));
  };
  process.once('SIGINT', alInterrumpir);
  try {
    return await fn(demo);
  } finally {
    process.off('SIGINT', alInterrumpir);
    await desmontar();
    console.log('Iglesias y cuentas de prueba borradas.');
  }
}
