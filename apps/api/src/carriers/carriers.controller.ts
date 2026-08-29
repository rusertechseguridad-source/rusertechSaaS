import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { CarriersService } from './carriers.service';
import { ActualizarTransportistaDto } from './dto/actualizar-transportista.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('api/v1/carriers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CarriersController {
  constructor(private readonly carriersService: CarriersService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.carriersService.findAll(req.user.tenantId);
  }

  // El alta tiene el MISMO passthrough que la edición, pero el encargo de la
  // Tanda 3 nombra seis handlers y pide no ampliar el alcance. Medido: acá
  // `tenant_id` NO es inyectable (el servicio lo pisa después del spread);
  // lo que sí entra es un `id` elegido por el cliente. Queda reportado.
  // `manage_carriers` lo tienen rusertech_admin, account_owner, manager y
  // key_user.
  // ⚠️ `operator` tiene `view_carriers` pero NO `manage_carriers`: pierde el
  // alta, la edición y el borrado de transportistas. Verificado contra el seed.
  @RequirePermissions('manage_carriers')
  @Post()
  create(@Req() req: any, @Body() data: any) {
    return this.carriersService.create(req.user.tenantId, data);
  }


  @RequirePermissions('manage_carriers')
  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() data: ActualizarTransportistaDto) {
    return this.carriersService.update(req.user.tenantId, id, data);
  }


  @RequirePermissions('manage_carriers')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.carriersService.remove(req.user.tenantId, id);
  }
}
