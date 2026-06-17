import { Controller, Get, Put, Patch, Body, UseGuards } from '@nestjs/common';
import { CarbonService } from './carbon.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/carbon/settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CarbonController {
  constructor(private readonly carbonService: CarbonService) {}

  @Get()
  @RequirePermissions('admin:settings')
  getSettings(@CurrentUser() user: any) {
    return this.carbonService.getSettings(user.tenantId);
  }

  @Put()
  @RequirePermissions('admin:settings')
  updateSettings(@CurrentUser() user: any, @Body() data: any) {
    return this.carbonService.updateSettings(user.tenantId, data);
  }

  @Patch('toggle-climatiq')
  @RequirePermissions('admin:settings')
  toggleClimatiq(@CurrentUser() user: any, @Body() data: { use_climatiq_api: boolean, climatiq_api_key?: string }) {
    return this.carbonService.toggleClimatiq(user.tenantId, data.use_climatiq_api, data.climatiq_api_key);
  }
}
