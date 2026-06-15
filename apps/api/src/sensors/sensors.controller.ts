import { Controller, Get, Post, Put, Patch, Body, Param, UseGuards, Query } from '@nestjs/common';
import { SensorsService } from './sensors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/sensors')
@UseGuards(JwtAuthGuard)
export class SensorsController {
  constructor(private readonly sensorsService: SensorsService) {}

  @Get('config')
  getConfigs(@CurrentUser() user: any) {
    return this.sensorsService.getConfigs(user.tenantId);
  }

  @Post('config')
  createConfig(@Body() data: any, @CurrentUser() user: any) {
    return this.sensorsService.upsertConfig(data, user.tenantId);
  }

  @Patch('config/:id/toggle')
  toggleConfig(@Param('id') id: string) {
    return this.sensorsService.toggleConfig(id);
  }

  @Get('history/:vehicleId')
  getHistory(
    @Param('vehicleId') vehicleId: string, 
    @Query('sensorType') sensorType: string,
    @Query('period') period: string
  ) {
    return this.sensorsService.getHistory(vehicleId, sensorType, period || '24h');
  }
}
