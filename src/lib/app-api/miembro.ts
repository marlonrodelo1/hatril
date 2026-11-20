/**
 * Contrato de las pantallas del área del miembro en la app
 * (`/api/v1/app/mi/*`). Ver `src/lib/app-api/yo.ts` para las reglas.
 *
 * Los tipos salen de las vistas que la web y la app comparten: lo que la API
 * devuelve es justo lo que esas vistas pintan.
 */
import type { AvisoEnCampana } from '@/components/campana';
import type {
  DevocionalAnterior,
  DevocionalParaLeer,
} from '@/app/mi/devocional/_components/vista-devocional';
import type { leerVideo } from '@/lib/devocionales/video';
import type { Notificacion } from '@/lib/notificaciones/consultas';
import type { DatosDelMuro } from '@/app/mi/comunidad/_components/vista-comunidad';
import type { ColaDeDenuncias } from '@/app/mi/comunidad/_components/vista-denuncias';
import type { DatosDeMiCuenta } from '@/app/mi/cuenta/_components/vista-cuenta';
import type { MisBloqueos } from '@/app/mi/cuenta/_components/vista-bloqueados';
import type { Impedimento, TurnosPorVenir } from '@/app/mi/cuenta/_components/vista-borrar';
import type { CapituloCargado } from '@/app/mi/biblia/_components/vista-biblia';
import type { MisDonativos } from '@/lib/donativos/consultas';
import type { datosDeLaAgenda } from '@/app/mi/agenda/datos';
import type { DatosDelTurno } from '@/app/mi/agenda/turno/[id]/_components/vista-turno';
import type { ReunionParaMiembro } from '@/app/mi/agenda/reunion/[id]/_components/vista-reunion';

export type RespuestaCampana = { avisos: AvisoEnCampana[]; sinLeer: number };

export type RespuestaDevocional = {
  fecha: string | null;
  d: DevocionalParaLeer;
  video: ReturnType<typeof leerVideo>;
  anteriores: DevocionalAnterior[];
};

export type RespuestaAgenda = Awaited<ReturnType<typeof datosDeLaAgenda>>;

export type RespuestaTurno = DatosDelTurno;

export type RespuestaReunion = { reunion: ReunionParaMiembro };

export type RespuestaAvisos = { avisos: Notificacion[]; zona: string };

export type RespuestaComunidad = DatosDelMuro;

export type RespuestaDenuncias = { cola: ColaDeDenuncias };

export type RespuestaDenunciaEnviada = {
  autorId: string | null;
  nombre: string | null;
  yaBloqueado: boolean;
};

export type RespuestaAcepta = { iglesiaNombre: string; primeraVez: boolean };

export type RespuestaCuenta = DatosDeMiCuenta;

export type RespuestaBloqueados = { bloqueos: MisBloqueos; timezone: string };

export type RespuestaBorrar = { impedimento: Impedimento; turnos: TurnosPorVenir; dia: string };

export type RespuestaDonativos = {
  iglesia: { slug: string; nombre: string };
  mios: MisDonativos;
  dar: { conTarjeta: boolean; conTransferencia: boolean };
  actual: number;
};

export type RespuestaBiblia = { capitulo: CapituloCargado };
