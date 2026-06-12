import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/drivers')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.driversService.findAll(req.user.tenantId);
  }

  @Post()
  create(@Req() req: any, @Body() data: any) {
    return this.driversService.create(req.user.tenantId, data);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() data: any) {
    return this.driversService.update(req.user.tenantId, id, data);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.driversService.remove(req.user.tenantId, id);
  }
}
