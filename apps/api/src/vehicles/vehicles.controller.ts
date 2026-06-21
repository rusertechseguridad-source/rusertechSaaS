import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/vehicles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  findAll(@Query('skip') skip?: string, @Query('take') take?: string, @CurrentUser() user?: any) {
    return this.vehiclesService.findAll(user, skip ? parseInt(skip) : undefined, take ? parseInt(take) : undefined);
  }

  @Get('live')
  getLivePositions() {
    return this.vehiclesService.getLivePositions();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Post()
  @RequirePermissions('vehicles:manage')
  create(@Body() data: any, @CurrentUser() user: any) {
    return this.vehiclesService.create(data, user.tenantId);
  }

  @Put(':id')
  @RequirePermissions('vehicles:manage')
  update(@Param('id') id: string, @Body() data: any) {
    return this.vehiclesService.update(id, data);
  }

  @Delete(':id')
  @RequirePermissions('vehicles:manage')
  remove(@Param('id') id: string) {
    return this.vehiclesService.remove(id);
  }

  @Patch(':id/block')
  @RequirePermissions('vehicles:manage')
  toggleBlock(@Param('id') id: string, @Body() body: { blocked: boolean; reason?: string }) {
    return this.vehiclesService.toggleBlock(id, body.blocked, body.reason);
  }
}
