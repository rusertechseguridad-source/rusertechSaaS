import { Controller, Post, Body, Req, Ip, Get, Patch, Param, UseGuards, Query } from '@nestjs/common';
import { MobileService } from './mobile.service';
import { Public } from '../common/decorators/public.decorator';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

@Controller('api/v1/mobile')
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Public()
  @Post('login')
  async login(
    @Body('documentId') documentId: string,
    @Body('plate') plate: string,
    @Body('activationCode') activationCode: string,
    @Ip() ipAddress: string,
    @Req() req: any
  ) {
    const userAgent = req.headers['user-agent'];
    const ip = ipAddress || req.ip || '0.0.0.0';
    return this.mobileService.login(documentId, plate, activationCode, ip, userAgent);
  }

  @UseGuards(ApiKeyGuard)
  @Get('trips/active')
  async getActiveTrip(@Query('vehicleId') vehicleId: string, @Req() req: any) {
    const tenantId = req.avlUser?.tenant_id;
    return this.mobileService.getActiveTrip(tenantId, vehicleId);
  }

  @UseGuards(ApiKeyGuard)
  @Post('trips')
  async createTrip(@Body() body: any, @Req() req: any) {
    const tenantId = req.avlUser?.tenant_id;
    const userId = req.avlUser?.id; // Usamos el avl_user.id como creador
    return this.mobileService.createTrip(tenantId, userId, body);
  }

  @UseGuards(ApiKeyGuard)
  @Patch('trips/:id/complete')
  async completeTrip(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const tenantId = req.avlUser?.tenant_id;
    return this.mobileService.completeTrip(tenantId, id, body);
  }
}
