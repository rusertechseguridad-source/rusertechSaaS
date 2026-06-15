import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { retry, handleAll, ExponentialBackoff } from 'cockatiel';

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('telemetry.raw') private telemetryQueue: Queue,
    @InjectQueue('forwarding.send') private forwardingQueue: Queue,
  ) {}

  @Interval(3000)
  async handleOutbox() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const messages = await (this.prisma as any).outboxMessage.findMany({
        where: { status: 'pending' },
        orderBy: { created_at: 'asc' },
        take: 50,
      });

      if (messages.length === 0) {
        this.isProcessing = false;
        return;
      }

      const retryPolicy = retry(handleAll, { 
        maxAttempts: 5, 
        backoff: new ExponentialBackoff({ initialDelay: 1000, maxDelay: 16000 }) 
      });

      for (const msg of messages) {
        try {
          await retryPolicy.execute(async () => {
            if (msg.queue_name === 'telemetry.raw') {
              await this.telemetryQueue.add(msg.job_name, msg.payload);
            } else if (msg.queue_name === 'forwarding.send') {
              await this.forwardingQueue.add(msg.job_name, msg.payload);
            }
          });

          await (this.prisma as any).outboxMessage.update({
            where: { id: msg.id },
            data: { status: 'sent', processed_at: new Date() },
          });
        } catch (error) {
          this.logger.error(`Failed to process outbox message ${msg.id}`, error);
          await (this.prisma as any).outboxMessage.update({
            where: { id: msg.id },
            data: { 
              status: 'failed', 
              retry_count: msg.retry_count + 5,
            },
          });
        }
      }
    } catch (e) {
      this.logger.error('Error fetching outbox messages', e);
    } finally {
      this.isProcessing = false;
    }
  }
}
