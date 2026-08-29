import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { ActualizarConductorDto } from './dto/actualizar-conductor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('api/v1/drivers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.driversService.findAll(req.user.tenantId);
  }

  // El alta tiene el MISMO passthrough que la edición, pero el encargo de la
  // Tanda 3 nombra seis handlers y pide no ampliar el alcance. Medido: acá
  // `tenant_id` NO es inyectable (el servicio lo pisa después del spread);
  // lo que sí entra es un `id` elegido por el cliente. Queda reportado.
  // `manage_drivers` lo tienen rusertech_admin, account_owner, manager,
  // operator y key_user. Ningún rol operativo pierde nada: el que deja de
  // poder borrar conductores es `viewer`, que es exactamente el objetivo.
  @RequirePermissions('manage_drivers')
  @Post()
  create(@Req() req: any, @Body() data: any) {
    return this.driversService.create(req.user.tenantId, data);
  }


  @RequirePermissions('manage_drivers')
  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() data: ActualizarConductorDto) {
    return this.driversService.update(req.user.tenantId, id, data);
  }


  @RequirePermissions('manage_drivers')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.driversService.remove(req.user.tenantId, id);
  }
}
