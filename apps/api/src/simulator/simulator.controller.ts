import { Controller, Post, Get, Delete, Body, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { SimulatorService } from './simulator.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/simulator')
@UseGuards(JwtAuthGuard)
export class SimulatorController {
  constructor(private readonly service: SimulatorService) {}

  private checkEnabled() {
    if (process.env.AVL_SIMULATOR_ENABLED !== 'true') {
      throw new ForbiddenException('Simulator not available in production');
    }
  }

  @Post('send')
  sendPoint(@CurrentUser() user: any, @Body() data: any) {
    this.checkEnabled();
    return this.service.sendPoint(data, user.tenantId);
  }

  @Post('alert')
  sendAlert(@CurrentUser() user: any, @Body() data: any) {
    this.checkEnabled();
    return this.service.sendAlert(data, user.tenantId);
  }

  @Post('route')
  startRoute(@CurrentUser() user: any, @Body() data: any) {
    this.checkEnabled();
    return this.service.startRoute(data, user.tenantId);
  }

  @Get('status')
  getStatus() {
    this.checkEnabled();
    return this.service.getStatus();
  }

  @Delete('route/:jobId')
  deleteRoute(@Param('jobId') jobId: string) {
    this.checkEnabled();
    return this.service.deleteRoute(jobId);
  }
}
