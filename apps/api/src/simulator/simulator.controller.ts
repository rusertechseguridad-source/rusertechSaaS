import { Controller, Post, Get, Delete, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { SimulatorService } from './simulator.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * ⚠️ EL INTERRUPTOR DE ENTORNO NO ES AUTORIZACIÓN. `AVL_SIMULATOR_ENABLED`
 * decide si el simulador EXISTE en este despliegue; los permisos deciden QUIÉN
 * lo usa donde existe. Antes sólo estaba lo primero: con el interruptor
 * encendido, cualquier usuario autenticado inyectaba puntos y alertas falsas
 * en su cliente. `use_simulator` estaba en el catálogo y nadie lo pedía.
 */
@Controller('api/v1/simulator')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SimulatorController {
  constructor(private readonly service: SimulatorService) {}

  private checkEnabled() {
    if (process.env.AVL_SIMULATOR_ENABLED !== 'true') {
      throw new ForbiddenException('Simulator not available in production');
    }
  }

  @RequirePermissions('use_simulator')
  @Post('send')
  sendPoint(@CurrentUser() user: any, @Body() data: any) {
    this.checkEnabled();
    return this.service.sendPoint(data, user.tenantId);
  }

  @RequirePermissions('use_simulator')
  @Post('alert')
  sendAlert(@CurrentUser() user: any, @Body() data: any) {
    this.checkEnabled();
    return this.service.sendAlert(data, user.tenantId);
  }

  @RequirePermissions('use_simulator')
  @Post('route')
  startRoute(@CurrentUser() user: any, @Body() data: any) {
    this.checkEnabled();
    return this.service.startRoute(data, user.tenantId);
  }

  // Leer el estado es ver, no operar: el mismo permiso que abre la pantalla.
  @RequirePermissions('view_simulator')
  @Get('status')
  getStatus() {
    this.checkEnabled();
    return this.service.getStatus();
  }

  @RequirePermissions('use_simulator')
  @Delete('route/:jobId')
  deleteRoute(@Param('jobId') jobId: string) {
    this.checkEnabled();
    return this.service.deleteRoute(jobId);
  }
}
