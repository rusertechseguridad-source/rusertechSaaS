import { Controller, Get, Put, Patch, Post, Delete, Body, Param, UseGuards, Request, Req, ForbiddenException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import {
  MonitoringConfigService,
  type UmbralesMonitoreo,
} from '../common/monitoring/monitoring-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly monitoringConfig: MonitoringConfigService,
  ) {}

  @Get('profile')
  getProfile(@Request() req: any) {
    return this.settingsService.getProfile(req.user.tenantId);
  }

  @Put('profile')
  updateProfile(@Request() req: any, @Body() body: any) {
    // Regla de producto (Etapa 2): configuración = solo administradores.
    // manager pierde la edición del perfil; conserva la lectura.
    if (req.user.role !== 'account_owner' && req.user.role !== 'rusertech_admin') {
      throw new ForbiddenException('No tienes permisos para editar el perfil del Tenant.');
    }
    return this.settingsService.updateProfile(req.user.tenantId, body);
  }

  @Get('users')
  getUsers(@Request() req: any) {
    if (req.user.role !== 'account_owner' && req.user.role !== 'manager' && req.user.role !== 'rusertech_admin') {
      throw new ForbiddenException('No tienes permisos para ver usuarios.');
    }
    return this.settingsService.getUsers(req.user.tenantId);
  }

  @Post('users/invite')
  inviteUser(@Request() req: any, @Body() body: any) {
    if (req.user.role !== 'account_owner' && req.user.role !== 'rusertech_admin') {
      throw new ForbiddenException('No tienes permisos para invitar usuarios.');
    }
    return this.settingsService.inviteUser(req.user.tenantId, body);
  }

  @Put('users/:id')
  updateUser(@Request() req: any, @Param('id') userId: string, @Body() body: { role_code?: string, full_name?: string, entity_restrictions?: any, contact_type?: string }) {
    if (req.user.role !== 'account_owner' && req.user.role !== 'rusertech_admin') {
      throw new ForbiddenException('Solo el propietario puede editar usuarios.');
    }
    return this.settingsService.updateUser(req.user.tenantId, userId, body);
  }

  @Patch('users/:id/toggle')
  @Roles('account_owner', 'rusertech_admin')
  async toggleUserStatus(@Req() req: Request, @Param('id') userId: string, @Body('is_active') isActive: boolean) {
    const { tenantId } = (req as any).user;
    return this.settingsService.toggleUserStatus(tenantId, userId, isActive);
  }

  @Delete('users/:id')
  @Roles('account_owner', 'rusertech_admin')
  async deleteUser(@Req() req: Request, @Param('id') userId: string) {
    const { tenantId, id: requesterId } = (req as any).user;
    if (requesterId === userId) {
      throw new ForbiddenException('No puedes eliminar tu propio usuario.');
    }
    return this.settingsService.deleteUser(tenantId, userId);
  }

  // --- SETTINGS JSON (Notifications & Carbon) ---
  @Get('notifications')
  @Roles('account_owner', 'manager', 'rusertech_admin')
  async getNotificationsConfig(@Req() req: Request) {
    const { tenantId } = (req as any).user;
    return this.settingsService.getNotificationsConfig(tenantId);
  }

  @Put('notifications')
  @Roles('account_owner', 'rusertech_admin')
  async updateNotificationsConfig(@Req() req: Request, @Body() body: any) {
    const { tenantId } = (req as any).user;
    return this.settingsService.updateNotificationsConfig(tenantId, body);
  }

  @Get('carbon')
  @Roles('account_owner', 'manager', 'rusertech_admin')
  async getCarbonConfig(@Req() req: Request) {
    const { tenantId } = (req as any).user;
    return this.settingsService.getCarbonConfig(tenantId);
  }

  @Put('carbon')
  @Roles('account_owner', 'rusertech_admin')
  async updateCarbonConfig(@Req() req: Request, @Body() body: any) {
    const { tenantId } = (req as any).user;
    return this.settingsService.updateCarbonConfig(tenantId, body);
  }

  // --- MONITOREO (umbrales de frescura y ventana del mapa) ---

  /**
   * Umbrales efectivos del tenant. Lo puede leer cualquier usuario autenticado:
   * el mapa necesita estos valores para explicar qué significa cada color, y
   * ocultárselos a un operador convertiría la leyenda en un misterio.
   */
  @Get('monitoring')
  @UseGuards(JwtAuthGuard)
  async getMonitoringConfig(@Req() req: Request) {
    const { tenantId } = (req as any).user;
    return this.monitoringConfig.obtenerUmbrales(tenantId);
  }

  /**
   * Cambia los umbrales del tenant. Escribir sí es privilegiado: mover la
   * ventana o los umbrales cambia lo que ve toda la operación.
   *
   * El servicio acota los valores en lugar de rechazarlos, así que la respuesta
   * devuelve lo que quedó realmente guardado — que puede no ser lo enviado.
   */
  @Put('monitoring')
  @Roles('account_owner', 'rusertech_admin')
  async updateMonitoringConfig(@Req() req: Request, @Body() body: Partial<UmbralesMonitoreo>) {
    const { tenantId } = (req as any).user;
    return this.monitoringConfig.guardarUmbrales(tenantId, body);
  }

  // --- PARAMETERS ---
  @Get('parameters')
  @UseGuards(JwtAuthGuard)
  async getTenantParameters(@Req() req: Request) {
    const { tenantId } = (req as any).user;
    return this.settingsService.getTenantParameters(tenantId);
  }

  @Put('parameters')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('account_owner', 'rusertech_admin')
  async updateTenantParameter(@Req() req: Request, @Body() body: { key: string, value: string }) {
    const user = (req as any).user;
    return this.settingsService.updateTenantParameter(user.tenantId, body.key, body.value, user.id);
  }

  @Post('parameters/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('account_owner', 'rusertech_admin')
  async restoreTenantParameter(@Req() req: Request, @Body() body: { key: string }) {
    const user = (req as any).user;
    return this.settingsService.restoreTenantParameter(user.tenantId, body.key);
  }
}
