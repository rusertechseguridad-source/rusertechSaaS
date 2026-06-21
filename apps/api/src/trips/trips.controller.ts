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
  findOne(@Param('id') id: string) {
    return this.tripsService.findOne(id);
  }

  @Post()
  @RequirePermissions('trips:manage')
  create(@Body() data: any, @CurrentUser() user: any) {
    return this.tripsService.create(data, user.tenantId, user.id);
  }

  @Put(':id')
  @RequirePermissions('trips:manage')
  update(@Param('id') id: string, @Body() data: any) {
    return this.tripsService.update(id, data);
  }

  @Delete(':id')
  @RequirePermissions('trips:manage')
  remove(@Param('id') id: string) {
    return this.tripsService.remove(id);
  }

  // Permiso específico para choferes
  @Post(':id/status')
  @RequirePermissions('trips:update_status')
  updateStatus(@Param('id') id: string, @Body() data: any) {
    return this.tripsService.updateStatus(id, data);
  }

  @Get(':id/logs')
  getLogs(@Param('id') id: string) {
    return this.tripsService.getLogs(id);
  }

  @Post(':id/logs')
  addLog(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.tripsService.addLog(id, data.text, user);
  }
  @Get(':id/linked-vehicles')
  getLinkedVehicles(@Param('id') id: string) {
    return this.tripsService.getLinkedVehicles(id);
  }

  @Post(':id/linked-vehicles')
  @RequirePermissions('trips:manage')
  linkVehicle(@Param('id') id: string, @Body() data: any) {
    return this.tripsService.linkVehicle(id, data.vehicle_id, data.link_type, data.notes);
  }

  @Delete(':id/linked-vehicles/:vehicleId')
  @RequirePermissions('trips:manage')
  unlinkVehicle(@Param('id') id: string, @Param('vehicleId') vehicleId: string) {
    return this.tripsService.unlinkVehicle(id, vehicleId);
  }
}
