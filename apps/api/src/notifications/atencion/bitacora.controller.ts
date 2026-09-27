import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { isAdminRole } from '../../common/constants/admin-roles';
import { BitacoraService } from './bitacora.service';
import { ProtocoloService } from './protocolo.service';
import { CerrarAlertaDto, EscalarDto } from './dto/bitacora.dto';
import { motivoParaNoAtenderCritica, puedeCerrar } from './tipos-atencion';
import type { FuenteAviso } from '../despacho/tipos-despacho';

/**
 * LA BITÁCORA, desde el navegador.
 *
 * ⚠️ LOS PERMISOS SON LOS DEL CATÁLOGO. `view_alerts` para leer el hilo y el
 * protocolo, `manage_alerts` para escribir en él. El permiso nuevo
 * —`manage_critical_alerts`— NO se pone como decorador en `atender`: hasta no
 * leer la alerta no se sabe si es crítica, y exigirlo para todas dejaría a un
 * operador sin poder atender una parada prolongada. Se comprueba adentro,
 * contra el dato.
 */
@Controller('api/v1/bitacora')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BitacoraController {
  constructor(
    private readonly bitacora: BitacoraService,
    private readonly protocolo: ProtocoloService,
  ) {}

  /**
   * Lo que la pantalla necesita para armar el formulario de atención: los
   * pasos y los resultados de ESA alerta, más qué puede hacer este usuario.
   *
   * ⚠️ LAS FACULTADES VIAJAN CON EL PROTOCOLO, y con su motivo. Es lo que
   * permite mostrar el botón deshabilitado y explicado en vez de escondido:
   * la pantalla no tiene que adivinar por qué no puede, se lo dice el
   * servidor con las mismas palabras que usaría al rechazar.
   */
  @RequirePermissions('view_alerts')
  @Get(':id/protocolo')
  async protocoloDe(
    @Request() req: any,
    @Param('id') id: string,
    @Query('fuente') fuente: FuenteAviso,
  ) {
    const alerta = await this.bitacora.tipoDeAlerta(req.user.tenantId, fuente ?? 'condicion', id);
    if (!alerta) {
      return { existe: false, pasos: [], resultados: [] };
    }

    const [protocolo, rol, destino, permisos] = await Promise.all([
      this.protocolo.paraTipo(req.user.tenantId, alerta.tipo),
      this.bitacora.rolDe(req.user.role),
      this.bitacora.destinoDeEscalada(req.user.tenantId, req.user.id),
      // ⚠️ De la base y no del token — ver `permisosVigentesDe`. Si esta
      // punta leyera `req.user.permissions` y la otra la base, la pantalla
      // habilitaría un botón que la API rechaza, que es peor que no tenerlo.
      this.bitacora.permisosVigentesDe(req.user.id),
    ]);

    return {
      existe: true,
      cerrada: alerta.cerrada,
      ...protocolo,
      // El motivo, no un booleano: la pantalla lo muestra tal cual.
      motivo_sin_permiso_critica: motivoParaNoAtenderCritica({
        permisos,
        esAdmin: isAdminRole(req.user.role),
      }),
      puede_cerrar: puedeCerrar(rol),
      // Quién recibiría la escalada, para mostrarlo ANTES de confirmar. Que el
      // operador vea a quién le está pasando el problema es la diferencia
      // entre escalar y tirarlo por arriba del hombro.
      destino_de_escalada: destino,
    };
  }

  /** El hilo completo. */
  @RequirePermissions('view_alerts')
  @Get(':id/hilo')
  hilo(@Request() req: any, @Param('id') id: string, @Query('fuente') fuente: FuenteAviso) {
    return this.bitacora.hilo(req.user.tenantId, fuente ?? 'condicion', id);
  }

  /**
   * Escalar. Acción del hilo, no cierre: la alerta sigue abierta.
   */
  @RequirePermissions('manage_alerts')
  @Post(':id/escalar')
  escalar(@Request() req: any, @Param('id') id: string, @Body() body: EscalarDto) {
    return this.bitacora.escalar(req.user, body.fuente, id, body.nota ?? null);
  }

  /**
   * Cerrar. La facultad sale de `roles.puede_cerrar_alertas`, no de un
   * permiso: es una posición en la organización del cliente y no una casilla
   * del catálogo de permisos. El servicio la comprueba y explica.
   */
  @RequirePermissions('manage_alerts')
  @Post(':id/cerrar')
  cerrar(@Request() req: any, @Param('id') id: string, @Body() body: CerrarAlertaDto) {
    return this.bitacora.cerrar(req.user, body.fuente, id, body.motivo);
  }
}
