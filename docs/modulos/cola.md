# Cola de los módulos

20 de octubre de 2026. Lo que falta de la primera tanda de módulos, en orden.

**Por qué va en cola y no en paralelo:** la base de Supabase es una y
compartida, y el migrador de drizzle-orm se salta EN SILENCIO una migración más
antigua si ya se aplicó otra más nueva. Dos ramas aplicando migraciones a la vez
pueden dejar una sin aplicar sin que nadie se entere. Así que lo que lleva
migración va de una en una, y cada sesión empieza cuando la anterior ha
commiteado y su migración está en `main`.

## En marcha (sin migración, cada una en su rama)

| Rama | Qué |
|---|---|
| `main` | Tanda 1: entrega de alimentos, con entregar sin inscribir, aviso «ya vino esta semana» e informe del mes |
| `consolidacion-nuevos` | Defectos del seguimiento, vista Nuevos, cifras del pastor en Inicio |
| `radio-emisora` | Tipo Radio, emisora con parrilla y tema por programa, reproductor en `/mi` y en la web pública |
| `alabanza-pulido` | Ensayo repetido, ensayo dentro del turno, indicador de lista |
| `arreglos-sueltos` | Libro de caja a 50, casilla de asistencia en `/registro`, nombres accesibles, confirmación de foto |
| `app-lider` | La zona del líder dentro de `/mi`, genérica por módulo |
| `diseno-auditoria` | Inventario visual de toda la aplicación; los arreglos, después de fusionar |

Cada rama deja su estado en `docs/modulos/estado-<rama>.md` y no toca
`ESTADO.md`: se integra al fusionar.

## Cola con migración (de una en una, tras alimentos)

1. **Contabilidad completa**: Finanzas activable por el pastor
   (`iglesias.modulos`), fondo vinculado a un ministerio con su pestaña de solo
   lectura para el líder, y arqueo del culto a dos personas.
2. **Células** con la pieza genérica de grupos (`grupos`, `grupo_miembros`):
   reporte semanal en un toque, guía común de la semana para toda la red, aviso
   de célula sin reportar, invitación por enlace hacia `/solicitar`.
3. **Consolidación v2**: ruta de crecimiento (primera visita, encuentro,
   bautismo, célula, escuela de líderes), asignar al nuevo a una célula, y la
   tarjeta de bienvenida por QR (antes, decidir dónde vive el visitante: ver el
   plan).
4. **Escuela dominical v1 sin fichas de niños**: clases por edad sobre la pieza
   de grupos, maestros, tema, versículo para memorizar en casa y «qué aprendimos
   hoy» para los padres. Las fichas de niños, la recogida segura con código y
   las fotos esperan una revisión legal de menores en España y Colombia.
5. **Alabanza v2**: fechas en que alguien no puede, tono por cantante y aviso
   «ya está la lista».
6. **La secretaria aprueba solicitudes**: una función `security definer` que
   active o borre solo membresías pendientes.
7. **Avisos fuera de la app**: correo con Resend (antes hace falta el dominio y
   la cuenta, que no son código) y notificaciones push (con la app nativa).
8. **Resumen mensual del pastor**, una página por ministerio. Va al final porque
   lee de todos los módulos.
9. **Pase visual completo** sobre lo fusionado, con el inventario de
   `diseno-auditoria`.
