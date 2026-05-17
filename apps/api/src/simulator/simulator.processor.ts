import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { SimulatorService } from './simulator.service';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
@Processor('simulator.route')
export class SimulatorProcessor extends WorkerHost {
  private readonly logger = new Logger(SimulatorProcessor.name);

  constructor(
    private readonly simulatorService: SimulatorService,
    @InjectQueue('simulator.route') private readonly routeQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    if (job.name === 'simulateRoute') {
      const { tenantId, avlUserId, vehicleId, coordinates, intervalSeconds, speedKmh, currentIndex } = job.data;
      
      if (currentIndex >= coordinates.length) {
        this.logger.log(`Simulation finished for job ${job.id}`);
        return { status: 'completed' };
      }

      const [lng, lat] = coordinates[currentIndex];
      
      try {
        await this.simulatorService.sendPoint({
          avlUserId, vehicleId, lat, lng, speedKmh
        }, tenantId);
      } catch (err) {
        this.logger.error(`Error simulating point ${currentIndex} for job ${job.id}`, err);
      }

      // If there's a next point, schedule it
      if (currentIndex + 1 < coordinates.length) {
        await this.routeQueue.add('simulateRoute', {
          ...job.data,
          currentIndex: currentIndex + 1
        }, {
          delay: intervalSeconds * 1000,
          jobId: `${job.id}-step-${currentIndex + 1}` // Keep a predictable job ID if needed or let bull generate
        });
      }

      return { processedIndex: currentIndex };
    }
  }
}
