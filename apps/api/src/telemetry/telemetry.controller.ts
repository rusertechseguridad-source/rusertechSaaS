import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@Controller('api/v1/telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('ingest')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async ingest(@Req() req: any, @Body() payload: any) {
    const { avlUserId, tenantId } = req.avlUser;
    // In a real scenario we could add rate limiting here per API Key
    return this.telemetryService.processIngest(payload, avlUserId, tenantId);
  }
}
