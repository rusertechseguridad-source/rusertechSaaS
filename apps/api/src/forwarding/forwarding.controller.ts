import { Controller, Get, Post, Put, Delete, Patch, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ForwardingService } from './forwarding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('api/v1/forwarding')
// `RolesGuard` faltaba: el `@Roles` de abajo estaba declarado y era inerte, así
// que cualquier rol leía `auth_credentials` (el bearer token de la integración
// del cliente) y podía reapuntar el reenvío (verificación integral, §2.4).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('account_owner', 'manager', 'rusertech_admin')
export class ForwardingController {
  constructor(private readonly forwardingService: ForwardingService) {}

  @Get()
  async getForwarders(@Request() req: any) {
    return this.forwardingService.getForwarders(req.user.tenantId);
  }

  @Post()
  async createForwarder(@Request() req: any, @Body() body: any) {
    return this.forwardingService.createForwarder(req.user.tenantId, body);
  }

  @Get(':id')
  async getForwarder(@Request() req: any, @Param('id') id: string) {
    return this.forwardingService.getForwarder(req.user.tenantId, id);
  }

  @Put(':id')
  async updateForwarder(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.forwardingService.updateForwarder(req.user.tenantId, id, body);
  }

  @Delete(':id')
  async deleteForwarder(@Request() req: any, @Param('id') id: string) {
    return this.forwardingService.deleteForwarder(req.user.tenantId, id);
  }

  @Patch(':id/toggle')
  async toggleForwarder(@Request() req: any, @Param('id') id: string, @Body('is_active') isActive: boolean) {
    return this.forwardingService.toggleForwarder(req.user.tenantId, id, isActive);
  }

  @Patch(':id/reset-circuit')
  async resetCircuit(@Request() req: any, @Param('id') id: string) {
    return this.forwardingService.resetCircuit(req.user.tenantId, id);
  }

  @Get(':id/stats')
  async getStats(@Request() req: any, @Param('id') id: string) {
    return this.forwardingService.getStats(req.user.tenantId, id);
  }
}
