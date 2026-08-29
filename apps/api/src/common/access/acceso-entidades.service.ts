import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ADMIN_ROLES } from '../constants/admin-roles';
import {
  filtroDeAcceso,
  interpretarRestricciones,
  resumirValor,
  type AlcanceRestriccion,
} from './entity-restrictions';

/**
 * PUNTO ÚNICO DE APLICACIÓN DE `users.entity_restrictions`.
 *
 * Antes, vehicles, trips y locations repetían la misma lectura y la misma
 * condición. Tres copias de una regla de seguridad son tres lugares donde
 * corregirla y dos donde olvidarse: la corrección vive acá y los servicios
 * piden un fragmento de `where`.
 *
 * Este servicio hace lo que la función pura no puede hacer (leer la base,
 * loguear, lanzar) y nada más. La decisión de si un valor es legible está
 * entera en `entity-restrictions.ts` y se prueba sin Postgres.
 */

/**
 * Roles exentos de restricciones por entidad.
 *
 * `rusertech_admin` (ADMIN_ROLES) porque administra la plataforma entera, y
 * `account_owner` porque es quien CONFIGURA las restricciones: si pudiera
 * quedar sujeto a ellas, un tilde mal puesto lo dejaría fuera de su propio
 * tenant sin nadie adentro que pueda revertirlo.
 *
 * `manager`, `operator`, `viewer` y `driver` SÍ quedan sujetos. Es un cambio
 * respecto del código actual, que sólo miraba `role === 'viewer'`: hoy, si un
 * administrador tilda vehículos y en el mismo modal cambia el rol a operador,
 * la restricción se guarda y se ignora en silencio — el peor resultado
 * posible, porque en la pantalla se ve aplicada.
 */
export const ROLES_SIN_RESTRICCION_DE_ENTIDADES: readonly string[] = [
  ...ADMIN_ROLES,
  'account_owner',
];

/** Lo que el JwtStrategy inyecta en `req.user`. */
export interface UsuarioAutenticado {
  id?: string;
  tenantId?: string;
  role?: string;
}

@Injectable()
export class AccesoEntidadesService {
  private readonly logger = new Logger(AccesoEntidadesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve el fragmento de `where` que limita la consulta a lo que el
   * usuario puede ver. Se COMBINA con el filtro de tenant, nunca lo reemplaza.
   *
   * @param usuario  `req.user` (necesita `id` y `role`).
   * @param alcance  Dimensión del jsonb a leer.
   * @param campo    Columna a filtrar en la tabla consultada
   *                 (`id` en vehicles/saved_locations, `vehicle_id` en trips).
   *
   * @throws ForbiddenException si el usuario tiene restricciones ilegibles.
   */
  async filtroPara(
    usuario: UsuarioAutenticado | undefined,
    alcance: AlcanceRestriccion,
    campo: string,
  ): Promise<Record<string, unknown>> {
    // Sin identidad no hay decisión posible. Es un bug del backend (el
    // controller no propagó `req.user`), no algo que el usuario provoque: 500
    // y no un filtro vacío, que sería otra vez fallar en abierto.
    if (!usuario?.id) {
      throw new InternalServerErrorException(
        'Restricciones de acceso: falta user.id. El controller debe propagar req.user al servicio.',
      );
    }

    if (ROLES_SIN_RESTRICCION_DE_ENTIDADES.includes(usuario.role ?? '')) return {};

    const fila = await this.prisma.user.findUnique({
      where: { id: usuario.id },
      select: { entity_restrictions: true },
    });

    // Token válido de un usuario que ya no existe. El `?.` anterior lo
    // convertía en "sin restricciones" — un usuario borrado veía todo hasta
    // que expirara su JWT.
    if (!fila) {
      this.logger.error(
        `Restricciones de acceso: el usuario ${usuario.id} del token no existe en la base. ` +
          'Se deniega el acceso (posible usuario eliminado con JWT vigente).',
      );
      throw new ForbiddenException('Tu sesión ya no es válida. Iniciá sesión nuevamente.');
    }

    const restriccion = interpretarRestricciones(fila.entity_restrictions, alcance);

    if (restriccion.decision === 'ilegible') {
      // Nunca silenciar: si esto aparece, hay datos corruptos en la columna y
      // alguien tiene que arreglarlos. El log lleva todo lo necesario para
      // encontrar la fila sin tener que reproducir la request.
      this.logger.error(
        `Restricciones de acceso ILEGIBLES — se deniega. ` +
          `usuario=${usuario.id} tenant=${usuario.tenantId ?? 'desconocido'} ` +
          `rol=${usuario.role ?? 'desconocido'} alcance=${alcance} ` +
          `motivo=${restriccion.motivo} valor=${resumirValor(fila.entity_restrictions)}`,
      );
      throw new ForbiddenException(
        'Tu configuración de accesos es inválida. Contactá al administrador de la cuenta.',
      );
    }

    return filtroDeAcceso(restriccion, campo);
  }

  /**
   * La misma decisión, pero como LISTA de ids en vez de fragmento de `where`.
   *
   * Existe porque las consultas más importantes del producto —el mapa, el
   * histórico de sensores— son SQL crudo y no pueden recibir un `where` de
   * Prisma. Sin esto, la restricción sólo se podía aplicar donde ya se estaba
   * aplicando, que es exactamente por qué cubría 3 sitios de 14.
   *
   * @returns `null` cuando el usuario no tiene restricción (ve todo lo de su
   *          tenant), o el arreglo de ids permitidos — que puede venir vacío,
   *          y un arreglo vacío significa "no ve ninguno", no "ve todos".
   */
  async idsPermitidos(
    usuario: UsuarioAutenticado | undefined,
    alcance: AlcanceRestriccion,
  ): Promise<string[] | null> {
    // Se reusa `filtroPara` a propósito, con un nombre de campo interno: así
    // las dos formas comparten la MISMA decisión y no pueden divergir. Que
    // fueran dos implementaciones sería el error de siempre.
    const filtro = await this.filtroPara(usuario, alcance, '__ids');
    const condicion = filtro['__ids'] as { in?: string[] } | undefined;
    if (!condicion || !Array.isArray(condicion.in)) return null;
    return condicion.in;
  }
}
