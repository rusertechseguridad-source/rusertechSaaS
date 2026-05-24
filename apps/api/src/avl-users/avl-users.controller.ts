import { Controller, Get, Post, Put, Delete, Patch, Body, Param, UseGuards, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AvlUsersService } from './avl-users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/avl-users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AvlUsersController {
  constructor(private readonly service: AvlUsersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions('avl:edit')
  create(@CurrentUser() user: any, @Body() data: any) {
    return this.service.create(user.tenantId, data);
  }

  @Put(':id')
  @RequirePermissions('avl:edit')
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  @RequirePermissions('avl:edit')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Patch(':id/toggle')
  @RequirePermissions('avl:edit')
  toggleActive(@Param('id') id: string, @Body('is_active') is_active: boolean) {
    return this.service.toggleActive(id, is_active);
  }

  @Post(':id/regenerate-api-key')
  @RequirePermissions('avl:edit')
  regenerateApiKey(@Param('id') id: string) {
    return this.service.regenerateApiKey(id);
  }

  @Get(':id/dictionary')
  getDictionary(@Param('id') id: string) {
    return this.service.getDictionary(id);
  }

  @Post(':id/dictionary')
  @RequirePermissions('avl:edit')
  addDictionaryEntry(@Param('id') id: string, @Body() data: any) {
    return this.service.addDictionaryEntry(id, data);
  }

  @Put(':id/dictionary/:dictId')
  @RequirePermissions('avl:edit')
  updateDictionaryEntry(@Param('dictId') dictId: string, @Body() data: any) {
    return this.service.updateDictionaryEntry(dictId, data);
  }

  @Delete(':id/dictionary/:dictId')
  @RequirePermissions('avl:edit')
  deleteDictionaryEntry(@Param('dictId') dictId: string) {
    return this.service.deleteDictionaryEntry(dictId);
  }

  @Get(':id/unknown-codes')
  getUnknownCodes(@Param('id') id: string) {
    return this.service.getUnknownCodes(id);
  }

  @Get(':id/dictionary/export')
  exportDictionary(@Param('id') id: string, @Res() res: Response) {
    return this.service.exportDictionary(id, res);
  }

  @Post(':id/dictionary/import')
  @RequirePermissions('avl:edit')
  @UseInterceptors(FileInterceptor('file'))
  importDictionary(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file provided');
    }
    return this.service.importDictionary(id, file.buffer);
  }
}
