import { Controller, Get, Put, Param, UseGuards, Request, Body } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('api/v1/alerts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.alertsService.findAll(req.user);
  }

  @Get('settings')
  getSettings(@Request() req: any) {
    return this.alertsService.getSettings(req.user.tenantId);
  }

  // Escribe `tenants.settings_json`, que es configuración de la empresa (y
  // donde viven las credenciales SMTP). Mismo permiso que la ruta hermana de
  // `settings`, que sí lo exigía: `manage_settings`.
  //
  // ⚠️ El `GET settings` de arriba NO lleva permiso en esta tanda, a propósito:
  // el encargo nombra las rutas de ESCRITURA. Pero sigue entregando la
  // contraseña SMTP a cualquier usuario autenticado (informe §2.2, asignado a
  // la Tanda 7). Cerrarlo antes es agregarle la misma línea que tiene el PUT.
  @RequirePermissions('manage_settings')
  @Put('settings')
  updateSettings(@Request() req: any, @Body() body: any) {
    return this.alertsService.updateSettings(req.user.tenantId, req.user.id, body);
  }

  // `manage_alerts` lo tienen rusertech_admin, account_owner, manager,
  // operator y key_user: nadie que hoy resuelva alertas pierde el acceso.
  @RequirePermissions('manage_alerts')
  @Put(':id/resolve')
  resolveAlert(@Request() req: any, @Param('id') id: string, @Body() body: { resolution_note?: string }) {
    return this.alertsService.resolveAlert(req.user.tenantId, id, req.user.id, body.resolution_note);
  }
}
