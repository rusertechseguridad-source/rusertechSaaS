import { Controller, Get, Post, Put, Delete, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get('events')
  getAvailableEvents() {
    return this.notificationsService.getAvailableEvents();
  }

  @Get('channels')
  getChannels(@Request() req: any) {
    return this.notificationsService.getChannels(req.user.tenantId);
  }

  // Los canales de notificación son configuración de la empresa. El catálogo
  // NO tiene un `manage_notifications`, y no se inventa uno: el permiso que
  // corresponde es `manage_settings`. Lo tienen rusertech_admin y
  // account_owner; manager y key_user NO, así que dejan de poder tocarlos.
  @RequirePermissions('manage_settings')
  @Post('channels')
  createChannel(@Request() req: any, @Body() body: any) {
    return this.notificationsService.createChannel(req.user.tenantId, body);
  }


  @RequirePermissions('manage_settings')
  @Put('channels/:id')
  updateChannel(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.notificationsService.updateChannel(req.user.tenantId, id, body);
  }


  @RequirePermissions('manage_settings')
  @Patch('channels/:id/toggle')
  toggleChannel(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.toggleChannel(req.user.tenantId, id);
  }


  @RequirePermissions('manage_settings')
  @Delete('channels/:id')
  deleteChannel(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.deleteChannel(req.user.tenantId, id);
  }
}
