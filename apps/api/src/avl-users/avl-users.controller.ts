import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AvlUsersService } from './avl-users.service';
import { AvlMonitorService } from './avl-monitor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/avl-users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AvlUsersController {
  constructor(
    private readonly service: AvlUsersService,
    private readonly monitor: AvlMonitorService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.service.findAll(user.tenantId);
  }

  /**
   * Estado de ingesta de todos los proveedores GPS.
   *
   * ⚠️ Declarado ANTES de `@Get(':id')` a propósito: Nest resuelve las rutas en
   * orden de declaración y, al revés, `monitor` entraría como si fuera un id.
   */
  @Get('monitor')
  getMonitor(@CurrentUser() user: any, @Query('horas') horas?: string) {
    return this.monitor.obtenerResumen(user.tenantId, horas ? Number(horas) : undefined);
  }

  /** Detalle por vehículo de un proveedor: incluye los que no reportan. */
  @Get('monitor/:id/vehicles')
  getMonitorVehicles(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('horas') horas?: string,
  ) {
    return this.monitor.obtenerVehiculos(id, user.tenantId, horas ? Number(horas) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.tenantId);
  }

  @Post()
  @RequirePermissions('manage_avl')
  create(@CurrentUser() user: any, @Body() data: any) {
    return this.service.create(user.tenantId, data);
  }

  @Put(':id')
  @RequirePermissions('manage_avl')
  update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.service.update(id, user.tenantId, data);
  }

  @Delete(':id')
  @RequirePermissions('manage_avl')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.delete(id, user.tenantId);
  }

  @Patch(':id/toggle')
  @RequirePermissions('manage_avl')
  toggleActive(@Param('id') id: string, @Body('is_active') is_active: boolean, @CurrentUser() user: any) {
    return this.service.toggleActive(id, user.tenantId, is_active);
  }

  @Post(':id/regenerate-api-key')
  @RequirePermissions('manage_avl')
  regenerateApiKey(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.regenerateApiKey(id, user.tenantId);
  }

  @Get(':id/dictionary')
  getDictionary(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getDictionary(id, user.tenantId);
  }

  @Post(':id/dictionary')
  @RequirePermissions('manage_avl')
  addDictionaryEntry(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    return this.service.addDictionaryEntry(id, user.tenantId, data);
  }

  @Put(':id/dictionary/:dictId')
  @RequirePermissions('manage_avl')
  updateDictionaryEntry(@Param('dictId') dictId: string, @Body() data: any, @CurrentUser() user: any) {
    return this.service.updateDictionaryEntry(dictId, user.tenantId, data);
  }

  @Delete(':id/dictionary/:dictId')
  @RequirePermissions('manage_avl')
  deleteDictionaryEntry(@Param('dictId') dictId: string, @CurrentUser() user: any) {
    return this.service.deleteDictionaryEntry(dictId, user.tenantId);
  }

  @Get(':id/unknown-codes')
  getUnknownCodes(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getUnknownCodes(id, user.tenantId);
  }

  @Get(':id/dictionary/export')
  exportDictionary(@Param('id') id: string, @Res() res: Response, @CurrentUser() user: any) {
    return this.service.exportDictionary(id, user.tenantId, res);
  }

  @Post(':id/dictionary/import')
  @RequirePermissions('manage_avl')
  @UseInterceptors(FileInterceptor('file'))
  importDictionary(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    if (!file) {
      throw new Error('No file provided');
    }
    return this.service.importDictionary(id, user.tenantId, file.buffer);
  }
}
