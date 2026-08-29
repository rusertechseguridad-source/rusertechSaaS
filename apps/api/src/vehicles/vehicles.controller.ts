import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ActualizarVehiculoDto } from './dto/actualizar-vehiculo.dto';

@Controller('api/v1/vehicles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.vehiclesService.findAll(
      user,
      skip ? parseInt(skip) : undefined,
      take ? parseInt(take) : undefined,
    );
  }

  @Get('live')
  getLivePositions(@CurrentUser() user: any) {
    return this.vehiclesService.getLivePositions(user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.vehiclesService.findOne(id, user.tenantId);
  }

  // El alta tiene el MISMO passthrough que la edición, pero el encargo de la
  // Tanda 3 nombra seis handlers y pide no ampliar el alcance. Medido: acá
  // `tenant_id` NO es inyectable (el servicio lo pisa después del spread);
  // lo que sí entra es un `id` elegido por el cliente. Queda reportado.
  @Post()
  @RequirePermissions('manage_vehicles')
  create(@Body() data: any, @CurrentUser() user: any) {
    return this.vehiclesService.create(data, user.tenantId);
  }

  @Put(':id')
  @RequirePermissions('manage_vehicles')
  update(@Param('id') id: string, @Body() data: ActualizarVehiculoDto, @CurrentUser() user: any) {
    return this.vehiclesService.update(id, user.tenantId, data);
  }

  @Delete(':id')
  @RequirePermissions('manage_vehicles')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.vehiclesService.remove(id, user.tenantId);
  }

  @Patch(':id/block')
  @RequirePermissions('manage_vehicles')
  toggleBlock(
    @Param('id') id: string,
    @Body() body: { blocked: boolean; reason?: string },
    @CurrentUser() user: any,
  ) {
    return this.vehiclesService.toggleBlock(id, user.tenantId, body.blocked, body.reason);
  }
}
