import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SecurityKeysService } from './security-keys.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { Request } from 'express';

@Controller('api/v1/security-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SecurityKeysController {
  constructor(private readonly service: SecurityKeysService) {}

  @Get()
  @Roles('rusertech_admin', 'account_owner')
  findAll(@Req() req?: Request) {
    const user = (req as any).user;
    return this.service.findAll(user);
  }

  @Get(':id')
  @Roles('rusertech_admin', 'account_owner')
  findOne(@Param('id') id: string, @Req() req?: Request) {
    const user = (req as any).user;
    return this.service.findOne(id, user);
  }

  @Post()
  @Roles('rusertech_admin', 'account_owner')
  create(@Body() data: any, @Req() req?: Request) {
    const user = (req as any).user;
    return this.service.create(data, user.tenantId);
  }

  @Patch(':id')
  @Roles('rusertech_admin', 'account_owner')
  update(@Param('id') id: string, @Body() data: any, @Req() req?: Request) {
    const user = (req as any).user;
    return this.service.update(id, data, user.tenantId);
  }

  @Delete(':id')
  @Roles('rusertech_admin')
  remove(@Param('id') id: string, @Req() req?: Request) {
    const user = (req as any).user;
    return this.service.remove(id, user.tenantId);
  }
}
