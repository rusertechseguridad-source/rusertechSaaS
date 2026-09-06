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

  // ⚠️ Cerrado en la Tanda 7. Sin permiso, esta ruta entregaba
  // `tenants.settings_json` entero —con la contraseña SMTP adentro— a
  // cualquier usuario autenticado. Ahora son las DOS cosas: el mismo permiso
  // que la ruta hermana de escritura, y la respuesta enmascarada en el
  // servicio. El permiso solo no alcanzaba: un `manager` legítimo tampoco
  // necesita ver la contraseña.
  @RequirePermissions('manage_settings')
  @Get('settings')
  getSettings(@Request() req: any) {
    return this.alertsService.getSettings(req.user.tenantId);
  }

  // Escribe `tenants.settings_json`, que es configuración de la empresa (y
  // donde viven las credenciales SMTP). Mismo permiso que la ruta hermana de
  // `settings`, que sí lo exigía: `manage_settings`.
  //
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
