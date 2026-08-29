import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { ActualizarDispositivoDto } from './dto/actualizar-dispositivo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.devicesService.findAll(req.user.tenantId);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.devicesService.findOne(req.user.tenantId, id);
  }

  // El alta tiene el MISMO passthrough que la edición, pero el encargo de la
  // Tanda 3 nombra seis handlers y pide no ampliar el alcance. Medido: acá
  // `tenant_id` NO es inyectable (el servicio lo pisa después del spread);
  // lo que sí entra es un `id` elegido por el cliente. Queda reportado.
  @Post()
  create(@Request() req: any, @Body() data: any) {
    return this.devicesService.create(req.user.tenantId, data);
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() data: ActualizarDispositivoDto) {
    return this.devicesService.update(req.user.tenantId, id, data);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.devicesService.remove(req.user.tenantId, id);
  }
}
