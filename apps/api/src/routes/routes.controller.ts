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
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('routes:edit')
  create(@Body() data: any, @CurrentUser() user: any) {
    return this.service.create(data, user.tenantId, user.id);
  }

  @Put(':id')
  @RequirePermissions('routes:edit')
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @RequirePermissions('routes:edit')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Patch(':id/toggle')
  @RequirePermissions('routes:edit')
  toggleActive(@Param('id') id: string, @Body() body: { is_active: boolean }) {
    return this.service.toggleActive(id, body.is_active);
  }
}
