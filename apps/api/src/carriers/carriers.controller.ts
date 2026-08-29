import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { CarriersService } from './carriers.service';
import { ActualizarTransportistaDto } from './dto/actualizar-transportista.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/carriers')
@UseGuards(JwtAuthGuard)
export class CarriersController {
  constructor(private readonly carriersService: CarriersService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.carriersService.findAll(req.user.tenantId);
  }

  // El alta tiene el MISMO passthrough que la edición, pero el encargo de la
  // Tanda 3 nombra seis handlers y pide no ampliar el alcance. Medido: acá
  // `tenant_id` NO es inyectable (el servicio lo pisa después del spread);
  // lo que sí entra es un `id` elegido por el cliente. Queda reportado.
  @Post()
  create(@Req() req: any, @Body() data: any) {
    return this.carriersService.create(req.user.tenantId, data);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() data: ActualizarTransportistaDto) {
    return this.carriersService.update(req.user.tenantId, id, data);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.carriersService.remove(req.user.tenantId, id);
  }
}
