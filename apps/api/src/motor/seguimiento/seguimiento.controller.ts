import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SeguimientoService } from './seguimiento.service';
import { DeclararEstadoDto } from './dto/declarar-estado.dto';

/**
 * EL ESTADO DE SEGUIMIENTO DE UN VIAJE.
 *
 * ── Sobre los permisos ─────────────────────────────────────────────────────
 * No se inventa ninguno. `view_trips` para mirar y `manage_trips` para
 * declarar, que son los que ya gobiernan el resto del recurso viaje.
 *
 * Declarar un estado a mano es administrar el viaje —pisa lo que dedujo el
 * motor y queda con el nombre de quien lo hizo—, así que va con el permiso de
 * administrar y no con el de ver.
 *
 * ── Sobre el guard ─────────────────────────────────────────────────────────
 * `PermissionsGuard` va enchufado en el `@UseGuards` de la clase. Sin eso los
 * `@RequirePermissions` serían decoración: es el hallazgo de `forwarding`, que
 * declaraba los roles y no enchufaba el guard, y la regla R1 del barrido de
 * cableado falla si alguien lo desconecta.
 *
 * ── Por qué vive en el módulo del motor y no en `trips` ────────────────────
 * El seguimiento lo calcula el motor a partir de las condiciones abiertas.
 * Ponerlo en `TripsController` obligaría a que ese módulo dependa del motor
 * para una responsabilidad que no es suya. La URL sí cuelga del viaje, porque
 * es donde el operador lo va a buscar.
 */
@Controller('api/v1/trips/:tripId/seguimiento')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SeguimientoController {
  constructor(private readonly seguimiento: SeguimientoService) {}

  /** El estado vigente. Una fila, sin recorrer el historial. */
  @Get()
  @RequirePermissions('view_trips')
  async actual(@Param('tripId') tripId: string, @CurrentUser() user: any) {
    const estado = await this.seguimiento.estadoActual(tripId, user.tenantId);
    // `null` y no un 404: que un viaje todavía no tenga estado de seguimiento
    // calculado es normal —recién declarado, sin puntos— y no es un error.
    // Un 404 acá haría que la pantalla muestre "no encontrado" para un viaje
    // que existe perfectamente.
    return { estado };
  }

  /**
   * La línea de tiempo del seguimiento.
   *
   * ⚠️ Incluye los intentos RECHAZADOS. «El motor quiso pasar a X y no pudo
   * porque Y» es parte de la historia: filtrarlos dejaría al operador sin saber
   * por qué el estado no cambió.
   */
  @Get('historial')
  @RequirePermissions('view_trips')
  async historial(@Param('tripId') tripId: string, @CurrentUser() user: any) {
    const filas = await this.seguimiento.historial(tripId, user.tenantId);
    return { historial: filas };
  }

  /**
   * El operador declara un estado a mano.
   *
   * ⚠️ Un rechazo devuelve **409 con el motivo**, no un 200 silencioso. Y el
   * intento queda registrado en el historial antes de devolver: la etapa exige
   * que una transición inválida no se descarte sin dejar rastro, y devolver el
   * error sin registrarlo sería descartarla igual, sólo que con más elegancia.
   */
  @Post()
  @RequirePermissions('manage_trips')
  async declarar(
    @Param('tripId') tripId: string,
    @Body() dto: DeclararEstadoDto,
    @CurrentUser() user: any,
  ) {
    const { veredicto, estado } = await this.seguimiento.declarar(
      tripId,
      user.tenantId,
      dto.tipo,
      dto.nota ?? null,
      user.id,
      new Date(),
    );

    if (!veredicto.valida) throw new ConflictException(veredicto.motivo);
    return { estado };
  }

  /** El operador levanta su declaración: el estado vuelve a ser el deducido. */
  @Delete()
  @RequirePermissions('manage_trips')
  async levantar(@Param('tripId') tripId: string, @CurrentUser() user: any) {
    const { veredicto, estado } = await this.seguimiento.levantar(
      tripId,
      user.tenantId,
      user.id,
      new Date(),
    );

    if (!veredicto.valida) throw new ConflictException(veredicto.motivo);
    return { estado };
  }
}
