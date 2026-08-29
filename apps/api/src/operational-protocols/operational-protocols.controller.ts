import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { OperationalProtocolsService } from './operational-protocols.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { Request } from 'express';
import { ActualizarProtocoloDto } from './dto/actualizar-protocolo.dto';

@Controller('api/v1/operational-protocols')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperationalProtocolsController {
  constructor(private readonly service: OperationalProtocolsService) {}

  @Get()
  @Roles('rusertech_admin', 'account_owner', 'key_user', 'manager')
  findAll(@Query('skip') skip?: string, @Query('take') take?: string, @Query('trip_status') trip_status?: string, @Query('risk_level') risk_level?: string, @Query('is_active') is_active?: string, @Req() req?: Request) {
    const user = (req as any).user;
    return this.service.findAll(user, skip ? parseInt(skip) : undefined, take ? parseInt(take) : undefined, { trip_status, risk_level, is_active });
  }

  @Get(':id')
  @Roles('rusertech_admin', 'account_owner', 'key_user', 'manager')
  findOne(@Param('id') id: string, @Req() req?: Request) {
    const user = (req as any).user;
    return this.service.findOne(id, user);
  }

  @Post()
  // Regla de producto (Etapa 2): la configuración la tocan solo el
  // administrador de Rusertech y el administrador del tenant. key_user opera,
  // no configura — se lo retira de las escrituras.
  @Roles('rusertech_admin', 'account_owner')
  create(@Body() data: any, @Req() req?: Request) {
    const user = (req as any).user;
    return this.service.create(data, user.tenantId);
  }

  // El DTO es lo que impide que `{"tenant_id": null}` en el cuerpo vuelva
  // GLOBAL un protocolo propio. La reja de abajo mira la fila que YA existe;
  // no miraba lo que se estaba escribiendo.
  @Patch(':id')
  @Roles('rusertech_admin', 'account_owner')
  update(@Param('id') id: string, @Body() data: ActualizarProtocoloDto, @Req() req?: Request) {
    const user = (req as any).user;
    return this.service.update(id, data, user.tenantId, user.role);
  }

  @Delete(':id')
  @Roles('rusertech_admin', 'account_owner')
  remove(@Param('id') id: string, @Req() req?: Request) {
    const user = (req as any).user;
    return this.service.remove(id, user.tenantId, user.role);
  }
}
