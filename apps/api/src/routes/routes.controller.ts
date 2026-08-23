import { Controller, Get, Post, Put, Delete, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/routes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoutesController {
  constructor(private readonly service: RoutesService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.service.findAll(user.tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.tenantId);
  }

  @Post()
  @RequirePermissions('manage_locations')
  create(@Body() data: any, @CurrentUser() user: any) {
    return this.service.create(data, user.tenantId, user.id);
  }

  @Put(':id')
  @RequirePermissions('manage_locations')
  update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.service.update(id, user.tenantId, data);
  }

  @Delete(':id')
  @RequirePermissions('manage_locations')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.tenantId);
  }

  @Patch(':id/toggle')
  @RequirePermissions('manage_locations')
  toggleActive(@Param('id') id: string, @Body() body: { is_active: boolean }, @CurrentUser() user: any) {
    return this.service.toggleActive(id, user.tenantId, body.is_active);
  }
}
