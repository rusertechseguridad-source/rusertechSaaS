import { Body, Controller, Get, Param, Put, Request, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CampanaService } from './campana.service';
import { CanalCampanaService, EventoDeCampana } from './canal-campana.service';
import { AtenderAvisoDto } from './dto/atender-aviso.dto';

/**
 * LA CAMPANA, desde el navegador.
 *
 * ⚠️ TRES RUTAS Y DOS PERMISOS, los dos del catálogo. No se inventa ninguno:
 * `view_alerts` y `manage_alerts` ya existen en `SYSTEM_PERMISSIONS` y son los
 * que usa la pantalla de alertas.
 *
 *   ver la lista y el flujo  → `view_alerts`
 *   atender                  → `manage_alerts`
 *
 * Es la misma separación que ya hace `AlertsController` entre mirar y resolver.
 */
@Controller('api/v1/campana')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CampanaController {
  constructor(
    private readonly campana: CampanaService,
    private readonly canal: CanalCampanaService,
  ) {}

  /**
   * Todo lo pendiente. **Ésta es la campana**; el flujo es sólo el empujón.
   *
   * El navegador la pide al entrar y en cada reconexión, y por eso no se
   * pierde nada: si estuvo cerrado dos horas, acá están las dos horas.
   */
  @RequirePermissions('view_alerts')
  @Get('pendientes')
  pendientes(@Request() req: any) {
    return this.campana.pendientes(req.user);
  }

  /**
   * El flujo en vivo.
   *
   * ⚠️ LOS VEHÍCULOS PERMITIDOS SE RESUELVEN UNA VEZ, AL CONECTAR, y quedan
   * fijos mientras la conexión viva. Si un administrador le cambia las
   * restricciones a alguien que está conectado, el cambio entra cuando ese
   * navegador se reconecte. Es una ventana real y está en el reporte; cerrarla
   * del todo exigiría releer las restricciones en cada aviso, que es una
   * consulta por alerta por pantalla abierta.
   *
   * ⚠️ El navegador NO usa `EventSource` para leer esto: ese cliente no puede
   * mandar el encabezado `Authorization`. El frontend lo lee con `fetch`. La
   * alternativa —el token en la dirección— lo dejaría escrito en los registros
   * de cualquier proxy que haya en el medio.
   */
  @RequirePermissions('view_alerts')
  @Sse('flujo')
  async flujo(@Request() req: any): Promise<Observable<EventoDeCampana>> {
    const vehiculos = await this.campana.vehiculosVisibles(req.user);
    return this.canal.flujoPara(req.user.tenantId, vehiculos);
  }

  /**
   * Atender. Apaga el sonido en TODAS las pantallas del cliente, no sólo en la
   * de quien apretó: el aviso de atención sale por el mismo canal.
   */
  @RequirePermissions('manage_alerts')
  @Put(':id/atender')
  atender(@Request() req: any, @Param('id') id: string, @Body() body: AtenderAvisoDto) {
    return this.campana.atender(req.user, body.fuente, id, body.nota ?? null);
  }
}
