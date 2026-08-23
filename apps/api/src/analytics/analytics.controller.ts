import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('fleet')
  @RequirePermissions('view_analytics')
  getFleetAnalytics(
    @CurrentUser() user: any,
    @Query('period') period?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('operationId') operationId?: string,
  ) {
    return this.analyticsService.getFleetAnalytics(user.tenantId, { period, vehicleId, operationId });
  }

  @Get('carbon')
  @RequirePermissions('view_analytics')
  getCarbonAnalytics(
    @CurrentUser() user: any,
    @Query('period') period?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('operationId') operationId?: string,
  ) {
    return this.analyticsService.getCarbonAnalytics(user.tenantId, { period, vehicleId, operationId });
  }

  @Get('trips')
  @RequirePermissions('view_analytics')
  getTripsAnalytics(
    @CurrentUser() user: any,
    @Query('period') period?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('operationId') operationId?: string,
  ) {
    return this.analyticsService.getTripsAnalytics(user.tenantId, { period, vehicleId, operationId });
  }

  @Get('alerts')
  @RequirePermissions('view_analytics')
  getAlertsAnalytics(
    @CurrentUser() user: any,
    @Query('period') period?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('operationId') operationId?: string,
  ) {
    return this.analyticsService.getAlertsAnalytics(user.tenantId, { period, vehicleId, operationId });
  }
}
