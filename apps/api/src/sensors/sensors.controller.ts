import { Controller, Get, Post, Put, Patch, Body, Param, UseGuards, Query } from '@nestjs/common';
import { SensorsService } from './sensors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('api/v1/sensors')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SensorsController {
  constructor(private readonly sensorsService: SensorsService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: any) {
    return this.sensorsService.getDashboard(user);
  }

  @Get('config')
  getConfigs(@CurrentUser() user: any) {
    return this.sensorsService.getConfigs(user.tenantId);
  }

  // `manage_sensors` lo tienen rusertech_admin, account_owner y key_user.
  // ⚠️ `manager` y `operator` tienen `view_sensors` pero NO `manage_sensors`:
  // dejan de poder configurar umbrales. Verificado contra el seed.
  @RequirePermissions('manage_sensors')
  @Post('config')
  createConfig(@Body() data: any, @CurrentUser() user: any) {
    return this.sensorsService.upsertConfig(data, user.tenantId);
  }

  @RequirePermissions('manage_sensors')
  @Patch('config/:id/toggle')
  toggleConfig(@Param('id') id: string, @CurrentUser() user: any) {
    return this.sensorsService.toggleConfig(id, user.tenantId);
  }

  @Get('history/:vehicleId')
  getHistory(
    @Param('vehicleId') vehicleId: string, 
    @Query('sensorType') sensorType: string,
    @Query('period') period: string,
    @CurrentUser() user: any
  ) {
    return this.sensorsService.getHistory(vehicleId, user, sensorType, period || '24h');
  }
}
