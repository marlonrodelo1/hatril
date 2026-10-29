# Cola de los módulos

20 de octubre de 2026. Lo que falta de la primera tanda de módulos, en orden.

**Por qué va en cola y no en paralelo:** la base de Supabase es una y
compartida, y el migrador de drizzle-orm se salta EN SILENCIO una migración más
antigua si ya se aplicó otra más nueva. Dos ramas aplicando migraciones a la vez
pueden dejar una sin aplicar sin que nadie se entere. Así que lo que lleva
migración va de una en una, y cada sesión empieza cuando la anterior ha
commiteado y su migración está en `main`.

## Hecho y fusionado en `main` (20-oct, sin migraciones)

| Rama | Qué | Estado |
|---|---|---|
| `main` | Tanda 1: entrega de alimentos, con entregar sin inscribir, aviso «ya vino esta semana» e informe del mes | `ESTADO.md` |
| `consolidacion-nuevos` | Defectos del seguimiento, vista Nuevos, alta rápida, cifras del pastor en Inicio | `estado-consolidacion-nuevos-9b87a5.md` |
| `radio-emisora` | Tipo Radio, emisora con parrilla y tema por programa, reproductor en `/mi` y en la web pública | `estado-radio-emisora.md` |
| `alabanza-pulido` | Ensayo repetido, ensayo dentro del turno, indicador de lista | `estado-alabanza-pulido-61bccd.md` |
| `arreglos-sueltos` | Libro de caja paginado, casilla de asistencia en `/registro`, nombres accesibles, confirmación de foto | `estado-arreglos-sueltos.md` |
| `app-lider` | Pestaña Equipo en `/mi`, con vista de líder y de participante y un contrato por módulo | `estado-app-lider.md` |
| `diseno-auditoria` | Guía visual e inventario de lo que falla (fase 1) | `docs/diseno/` |
| `contabilidad` (21-oct, migraciones 0043-0045) | Finanzas activable por el pastor, fondo de ministerio con su pestaña para el líder, y arqueo a dos personas garantizado por la base | `estado-contabilidad.md` |

Lo de cada rama ya está contado en `ESTADO.md`; los `estado-*.md` se quedan
con el detalle. La próxima rama sigue igual: deja su estado en
`docs/modulos/estado-<rama>.md` y no toca `ESTADO.md`, que se integra al
fusionar.

## Cola con migración (de una en una)

La siguiente migración es la **0053** y el siguiente código de trigger,
**HT136**. Células está en marcha (21-oct) y se llevó las **0046-0051** y los
códigos hasta **HT134**, ya aplicadas en la base aunque solo estén en su rama.

**Una se coló fuera de la cola**: el registro del super admin (29-oct) tomó la
**0052** y **HT135** en `main`, detrás de células y en el orden en que la base
las recibió, porque esperar a que células se fusionara dejaba `/admin`
cambiando contraseñas sin rastro. Quien fusione células tiene que coser el
journal y el snapshot de la `0052`; los pasos están en la cabecera de esa
migración.

1. ~~Contabilidad completa~~: hecha y fusionada el 21-oct.
2. **Células** — en marcha. Con la pieza genérica de grupos (`grupos`, `grupo_miembros`):
   reporte semanal en un toque, guía común de la semana para toda la red, aviso
   de célula sin reportar, invitación por enlace hacia `/solicitar`. Si el tema
   de cada semana va en `turnos.tema`, esa columna sirve también a la radio.
3. **Consolidación v2**: ruta de crecimiento (primera visita, encuentro,
   bautismo, célula, escuela de líderes), asignar al nuevo a una célula, y la
   tarjeta de bienvenida por QR con la tabla `llegadas`, el aviso
   `llegada_nueva` y el borrado de las caducadas (antes, decidir dónde vive el
   visitante: ver el plan). La v1 ya dejó sitio en la fila para la ruta y la
   célula.
4. **Escuela dominical v1 sin fichas de niños**: clases por edad sobre la pieza
   de grupos, maestros, tema, versículo para memorizar en casa y «qué aprendimos
   hoy» para los padres. Las fichas de niños, la recogida segura con código y
   las fotos esperan una revisión legal de menores en España y Colombia.
5. **Alabanza v2**: el índice único de `reuniones` —buscar antes duplicados, o
   la migración se cae—, fechas en que alguien no puede, tono por cantante y
   aviso «ya está la lista».
6. **Radio v2**: el tema de cada emisión (`turnos.tema`, si no llegó antes con
   células), el CHECK de `stream_url` y planificar los turnos desde la parrilla.
7. **La secretaria aprueba solicitudes**: una función `security definer` que
   active o borre solo membresías pendientes.
8. **Avisos fuera de la app**: correo con Resend (antes hace falta el dominio y
   la cuenta, que no son código) y notificaciones push (con la app nativa).
9. **Resumen mensual del pastor**, una página por ministerio. Va al final porque
   lee de todos los módulos.

## Sin migración, cuando haya hueco (pueden ir en paralelo a la cola)

- **Pase visual, fase 2 del inventario**, empezando por M1: los campos nativos
  a 15 px en el móvil se arreglan sacando la regla de `globals.css` de
  `@layer base`. Después M2, A9, A16 y D2, que son de un fichero; luego M3 y
  A1, que tocan casi todo. El orden está en `docs/diseno/inventario-visual.md`.
- **Zod en los parámetros de la URL** que hoy dan 500 (`?mes=`, `?ficha=`, un
  id que no es uuid) y `Object.hasOwn` en las pantallas de `/mi/equipo` que
  buscan `CONFIRMACIONES[guardado]`.
- **Dar o retirar el permiso de asistencia** desde `/mi/cuenta` o la ficha.
- **«Nuevos» y el alta rápida en la app del líder**, ampliando
  `seguimientoEnLaApp`.

## Decisiones de Marlon que bloquean algo

- **Subir `VERSION_POLITICA_PRIVACIDAD`**, con los textos ya redactados de
  consolidación y radio. Antes, guardar la negativa de asistencia como fila.
- **Si el reparto entra en `sinMuro`**: con el pago caído no se pueden marcar
  entregas un domingo.
