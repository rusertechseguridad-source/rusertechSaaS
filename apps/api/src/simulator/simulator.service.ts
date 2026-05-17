import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { TelemetryService } from '../telemetry/telemetry.service';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SimulatorService {
  private readonly logger = new Logger(SimulatorService.name);

  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly prisma: PrismaService,
    @InjectQueue('simulator.route') private readonly routeQueue: Queue,
  ) {}

  async sendPoint(data: any, tenantId: string) {
    const { avlUserId, vehicleId, lat, lng, speedKmh = 0, ignition = true, temperatureC, humidityPct, code, timestamp } = data;
    
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new BadRequestException('Vehicle not found');

    const payload: any = {
      Asset: vehicle.hub_asset_id,
      Latitude: lat,
      Longitude: lng,
      Speed: speedKmh.toString(),
      Ignition: ignition ? '1' : '0',
      Date: timestamp || new Date().toISOString(),
    };

    if (temperatureC !== undefined) payload['Temperature'] = temperatureC.toString();
    if (humidityPct !== undefined) payload['Humidity'] = humidityPct.toString();
    if (code) payload['Code'] = code;

    return this.telemetryService.processIngest(payload, avlUserId, tenantId);
  }

  async sendAlert(data: any, tenantId: string) {
    const { avlUserId, vehicleId, alertType, lat, lng } = data;
    
    let code = '';
    if (alertType === 'speed_exceeded') code = 'SPEED_ALERT';
    else if (alertType === 'sos') code = 'SOS_ALERT';
    else if (alertType === 'geofence_enter') code = 'GEO_ENTER';
    else code = 'GENERIC_ALERT';

    return this.sendPoint({ avlUserId, vehicleId, lat, lng, code }, tenantId);
  }

  async startRoute(data: any, tenantId: string) {
    const { avlUserId, vehicleId, routeGeoJson, intervalSeconds = 10, speedKmh = 40 } = data;
    
    if (!routeGeoJson || routeGeoJson.type !== 'LineString') {
      throw new BadRequestException('routeGeoJson must be a valid GeoJSON LineString');
    }

    const coordinates = routeGeoJson.coordinates; 
    
    const job = await this.routeQueue.add('simulateRoute', {
      tenantId, avlUserId, vehicleId, coordinates, intervalSeconds, speedKmh, currentIndex: 0
    });

    return { jobId: job.id, status: 'started', points: coordinates.length };
  }

  async getStatus() {
    const active = await this.routeQueue.getActive();
    const waiting = await this.routeQueue.getWaiting();
    const delayed = await this.routeQueue.getDelayed();

    return {
      activeJobs: active.map(j => ({ id: j.id, data: j.data })),
      waitingJobs: waiting.map(j => ({ id: j.id, data: j.data })),
      delayedJobs: delayed.map(j => ({ id: j.id, data: j.data })),
    };
  }

  async deleteRoute(jobId: string) {
    const job = await this.routeQueue.getJob(jobId);
    if (job) {
      await job.remove();
      return { status: 'cancelled' };
    }
    return { status: 'not_found' };
  }
}
