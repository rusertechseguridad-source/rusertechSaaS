import { Controller, Get, Put, Param, UseGuards, Request, Body } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.alertsService.findAll(req.user.tenantId);
  }

  @Put(':id/resolve')
  resolveAlert(@Request() req: any, @Param('id') id: string, @Body() body: { resolution_note?: string }) {
    return this.alertsService.resolveAlert(req.user.tenantId, id, req.user.userId, body.resolution_note);
  }
}
