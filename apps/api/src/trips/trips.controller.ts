import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TripsService } from './trips.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/trips')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.tripsService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tripsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions('manage_trips')
  create(@Body() data: any, @CurrentUser() user: any) {
    return this.tripsService.create(data, user.tenantId, user.id);
  }

  @Put(':id')
  @RequirePermissions('manage_trips')
  update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.tripsService.update(id, user.tenantId, data);
  }

  @Delete(':id')
  @RequirePermissions('manage_trips')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tripsService.remove(id, user.tenantId);
  }

  // Cambio de estado del viaje.
  // NOTA: el decorador original pedía `trips:update_status`, un permiso que no
  // existe en el catálogo ni en ningún rol del seed. Se mapea a `manage_trips`
  // (ver reporte de la tanda): no se pierde ninguna capacidad, porque con el
  // formato anterior este endpoint nunca autorizaba a nadie.
  @Post(':id/status')
  @RequirePermissions('manage_trips')
  updateStatus(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.tripsService.updateStatus(id, user.tenantId, data);
  }

  @Get(':id/logs')
  getLogs(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tripsService.getLogs(id, user.tenantId);
  }

  @Post(':id/logs')
  addLog(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.tripsService.addLog(id, data.text, user);
  }

  @Get(':id/linked-vehicles')
  getLinkedVehicles(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tripsService.getLinkedVehicles(id, user.tenantId);
  }

  @Post(':id/linked-vehicles')
  @RequirePermissions('manage_trips')
  linkVehicle(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.tripsService.linkVehicle(
      id,
      user.tenantId,
      data.vehicle_id,
      data.link_type,
      data.notes,
    );
  }

  @Delete(':id/linked-vehicles/:vehicleId')
  @RequirePermissions('manage_trips')
  unlinkVehicle(
    @Param('id') id: string,
    @Param('vehicleId') vehicleId: string,
    @CurrentUser() user: any,
  ) {
    return this.tripsService.unlinkVehicle(id, user.tenantId, vehicleId);
  }

  @Post(':id/driver-contact-attempt')
  @RequirePermissions('manage_trips')
  contactDriverAttempt(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tripsService.contactDriverAttempt(id, user);
  }

  @Post(':id/driver-contact-response')
  contactDriverResponse(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.tripsService.contactDriverResponse(id, user.tenantId, data);
  }

  @Post(':id/mobile-pairing')
  @RequirePermissions('manage_trips')
  generateMobilePairing(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tripsService.generateMobilePairing(id, user.tenantId);
  }
}
