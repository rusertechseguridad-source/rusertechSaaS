import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { CarriersService } from './carriers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/carriers')
@UseGuards(JwtAuthGuard)
export class CarriersController {
  constructor(private readonly carriersService: CarriersService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.carriersService.findAll(req.user.tenantId);
  }

  @Post()
  create(@Req() req: any, @Body() data: any) {
    return this.carriersService.create(req.user.tenantId, data);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() data: any) {
    return this.carriersService.update(req.user.tenantId, id, data);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.carriersService.remove(req.user.tenantId, id);
  }
}
