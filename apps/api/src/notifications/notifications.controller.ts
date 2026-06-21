import { Controller, Get, Post, Put, Delete, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
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

  @Post('channels')
  createChannel(@Request() req: any, @Body() body: any) {
    return this.notificationsService.createChannel(req.user.tenantId, body);
  }

  @Put('channels/:id')
  updateChannel(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.notificationsService.updateChannel(req.user.tenantId, id, body);
  }

  @Patch('channels/:id/toggle')
  toggleChannel(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.toggleChannel(req.user.tenantId, id);
  }

  @Delete('channels/:id')
  deleteChannel(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.deleteChannel(req.user.tenantId, id);
  }
}
