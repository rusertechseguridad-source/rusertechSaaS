import { Controller, Get, Post, Put, Delete, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { AvlUsersService } from './avl-users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/avl-users')
@UseGuards(JwtAuthGuard)
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
  create(@CurrentUser() user: any, @Body() data: any) {
    return this.service.create(user.tenantId, data);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.service.update(id, data);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Patch(':id/toggle')
  toggleActive(@Param('id') id: string, @Body('is_active') is_active: boolean) {
    return this.service.toggleActive(id, is_active);
  }

  @Post(':id/regenerate-api-key')
  regenerateApiKey(@Param('id') id: string) {
    return this.service.regenerateApiKey(id);
  }

  @Get(':id/dictionary')
  getDictionary(@Param('id') id: string) {
    return this.service.getDictionary(id);
  }

  @Post(':id/dictionary')
  addDictionaryEntry(@Param('id') id: string, @Body() data: any) {
    return this.service.addDictionaryEntry(id, data);
  }

  @Put(':id/dictionary/:dictId')
  updateDictionaryEntry(@Param('dictId') dictId: string, @Body() data: any) {
    return this.service.updateDictionaryEntry(dictId, data);
  }

  @Delete(':id/dictionary/:dictId')
  deleteDictionaryEntry(@Param('dictId') dictId: string) {
    return this.service.deleteDictionaryEntry(dictId);
  }

  @Get(':id/unknown-codes')
  getUnknownCodes(@Param('id') id: string) {
    return this.service.getUnknownCodes(id);
  }
}
