import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { OperationsService } from './operations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/operations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OperationsController {
  constructor(private readonly service: OperationsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('locations:edit')
  create(@Body() data: any, @CurrentUser() user: any) {
    return this.service.create(data, user.tenantId);
  }

  @Put(':id')
  @RequirePermissions('locations:edit')
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @RequirePermissions('locations:edit')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
