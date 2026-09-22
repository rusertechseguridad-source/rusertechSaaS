import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AvisoAtendido,
  AvisoDespacho,
  AvisoResuelto,
  CANALES_DE_AVISO,
  CanalDeAviso,
  MensajeDeCanal,
  entraALaCampana,
  interrumpe,
} from './tipos-despacho';

/** Lo que devuelve la consulta que arma los avisos de condiciones. */
interface FilaAviso {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  trip_id: string | null;
  tipo: string;
  titulo: string | null;
  nivel_riesgo: string | null;
  color: string | null;
  interrumpe_al_operador: boolean | null;
  requiere_atencion_operador: boolean | null;
  ocurrio_at: Date;
  patente: string | null;
  latitud: number | null;
  longitud: number | null;
  direccion: string | null;
  disparador: string | null;
}

/**
 * ══════════════════════════════════════════════════════════════════════════
 * EL PUNTO ÚNICO DE DESPACHO
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Cuando se abre una condición, **un solo lugar** decide a quién avisar. Hoy
 * entrega a un canal —la campana del panel—; la entrega 2 agrega Telegram y la
 * 3 el correo **sin tocar una línea del motor**: implementan `CanalDeAviso` y
 * se suman al proveedor `CANALES_DE_AVISO`.
 *
 * ⚠️ POR QUÉ NO ESTÁ ADENTRO DEL MOTOR. El motor decide qué pasó. Quién se
 * entera es otra decisión, con otro ritmo de cambio: el catálogo de canales va
 * a moverse mucho más que el evaluador de desvío. Mezclarlas obligaría a tocar
 * el evaluador para agregar un mensajero.
 *
 * ⚠️ LA IDEMPOTENCIA SE HEREDA, NO SE REINVENTA. `CondicionesService.abrir`
 * inserta con `WHERE NOT EXISTS` sobre la clave de identidad y ahora devuelve
 * las filas que REALMENTE insertó. Un camión parado veinte minutos genera 240
 * puntos, una sola fila y —por lo tanto— un solo aviso. Si el despacho contara
 * evaluaciones en vez de inserciones, la campana sonaría 240 veces por el mismo
 * camión quieto y el operador la silenciaría para siempre.
 */
@Injectable()
export class DespachoService implements OnModuleInit {
  private readonly logger = new Logger(DespachoService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CANALES_DE_AVISO) private readonly canales: CanalDeAviso[],
  ) {}

  /**
   * Despacha las condiciones recién ABIERTAS, por sus ids.
   *
   * Recibe ids y no las decisiones del evaluador a propósito: los ids son los
   * de las filas que el INSERT creó, así que lo que se despacha es lo que se
   * escribió. Una decisión que el `WHERE NOT EXISTS` descartó no llega acá.
   */
  async despacharCondiciones(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const filas = await this.prisma.$queryRaw<FilaAviso[]>`
      SELECT
        c.id::text                       AS id,
        c.tenant_id::text                AS tenant_id,
        c.vehicle_id::text               AS vehicle_id,
        c.trip_id::text                  AS trip_id,
        c.tipo                           AS tipo,
        mt.nombre                        AS titulo,
        c.nivel_riesgo                   AS nivel_riesgo,
        nr.color                         AS color,
        nr.interrumpe_al_operador        AS interrumpe_al_operador,
        nr.requiere_atencion_operador    AS requiere_atencion_operador,
        c.inicio                         AS ocurrio_at,
        v.plate                          AS patente,
        NULL::float8                     AS latitud,
        NULL::float8                     AS longitud,
        NULL::text                       AS direccion,
        c.disparador                     AS disparador
      FROM trip_conditions c
      LEFT JOIN motor_tipos_condicion mt ON mt.codigo = c.tipo
      LEFT JOIN motor_niveles_riesgo  nr ON nr.codigo = c.nivel_riesgo
                                        AND (nr.tenant_id = c.tenant_id OR nr.tenant_id IS NULL)
      LEFT JOIN vehicles v ON v.id = c.vehicle_id
      WHERE c.id = ANY(${ids}::uuid[])
    `;

    const avisos = filas.map((f) => this.armar(f, 'condicion'));
    return this.entregar(avisos.map((aviso) => ({ clase: 'nuevo' as const, aviso })));
  }

  /** Que alguien la atendió: es lo que apaga el sonido en las demás pantallas. */
  async despacharAtencion(aviso: AvisoAtendido): Promise<number> {
    return this.entregar([{ clase: 'atendido', aviso }]);
  }

  /** Que se cerró sola —el camión volvió a reportar—: deja de sonar. */
  async despacharResolucion(aviso: AvisoResuelto): Promise<number> {
    return this.entregar([{ clase: 'resuelto', aviso }]);
  }

  /**
   * ⚠️ ESTE LOG EXISTE PORQUE R19 CAZÓ ALGO EN SU PRIMERA CORRIDA.
   *
   * Acá había un método público `canalesRegistrados()` que sólo llamaban las
   * pruebas. R19 —escrita en esta misma tanda— lo marcó como huérfano apenas
   * se corrió, que es exactamente para lo que se escribió: un método público
   * sin llamador de producción es código que parece hacer algo y no lo hace.
   *
   * Se borró, y en su lugar quedó esto, que sí sirve: al arrancar, el registro
   * dice qué canales están enchufados. Cuando llegue Telegram, esa línea es la
   * forma de saber en un vistazo si quedó registrado — sin ella habría que
   * deducirlo de que no llegan mensajes, que es la peor manera de enterarse.
   */
  onModuleInit(): void {
    const nombres = this.canales.map((c) => c.nombre);
    this.logger.log(
      nombres.length > 0
        ? `Canales de aviso registrados: ${nombres.join(', ')}.`
        : '⚠️ NINGÚN canal de aviso registrado: las alertas se escriben pero no se avisan.',
    );
  }

  private armar(f: FilaAviso, fuente: 'condicion' | 'evento'): AvisoDespacho {
    // `nivel` es null cuando el LEFT JOIN no encontró el código: no se pudo
    // clasificar. No es lo mismo que «no importa».
    const nivel =
      f.interrumpe_al_operador === null || f.requiere_atencion_operador === null
        ? null
        : {
            interrumpe_al_operador: f.interrumpe_al_operador,
            requiere_atencion_operador: f.requiere_atencion_operador,
          };

    return {
      fuente,
      id: f.id,
      tenant_id: f.tenant_id,
      vehicle_id: f.vehicle_id,
      trip_id: f.trip_id,
      tipo: f.tipo,
      // El nombre sale del catálogo; si falta, se muestra el código y no una
      // frase inventada — que el operador vea `SIN_REPORTE` es peor que una
      // etiqueta linda, pero mucho mejor que una etiqueta equivocada.
      titulo: f.titulo ?? f.tipo,
      nivel_riesgo: f.nivel_riesgo,
      color: f.color ?? '#6B7280',
      interrumpe: interrumpe(nivel),
      requiere_atencion: entraALaCampana(nivel),
      clasificado: nivel !== null,
      ocurrio_at: f.ocurrio_at,
      patente: f.patente,
      latitud: f.latitud === null ? null : Number(f.latitud),
      longitud: f.longitud === null ? null : Number(f.longitud),
      direccion: f.direccion,
      disparador: f.disparador,
    };
  }

  /**
   * Entrega a todos los canales.
   *
   * ⚠️ UN CANAL QUE FALLA NO TUMBA AL MOTOR, y no es silenciar un error.
   *
   * Cuando esto corre, la condición YA ESTÁ ESCRITA en `trip_conditions`: el
   * hecho es durable. Lo que se pierde si un canal revienta es el empujón en
   * vivo, y la campana se reconstruye leyendo la base en cuanto el operador
   * entra o vuelve la conexión. Dejar subir la excepción, en cambio, haría que
   * el lote de telemetría se marque fallido y se reprocese — o sea, castigar
   * al motor por un problema del mensajero.
   *
   * El error se registra en `error`, con el nombre del canal, que es lo que
   * hace falta para darse cuenta de que un canal está caído.
   */
  private async entregar(mensajes: MensajeDeCanal[]): Promise<number> {
    let entregados = 0;
    for (const mensaje of mensajes) {
      for (const canal of this.canales) {
        try {
          await canal.entregar(mensaje);
          entregados += 1;
        } catch (error) {
          this.logger.error(
            `El canal "${canal.nombre}" no pudo entregar un aviso (${mensaje.clase}): ` +
              `${(error as Error).message}. El aviso está en la base y la campana ` +
              `lo va a mostrar igual al reconstruirse.`,
          );
        }
      }
    }
    return entregados;
  }
}
