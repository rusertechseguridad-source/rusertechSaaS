import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Processor('forwarding.send')
export class ForwardingProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { forwarderId, positionData } = job.data;

    // Fetch the forwarder
    const forwarder = await this.prisma.positionForwarder.findUnique({
      where: { id: forwarderId }
    });

    if (!forwarder || !forwarder.is_active || forwarder.circuit_open) {
      return; // Do nothing if inactive or circuit open
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (forwarder.auth_type === 'bearer' && forwarder.auth_credentials) {
        const creds = forwarder.auth_credentials as any;
        if (creds.token) {
          headers['Authorization'] = `Bearer ${creds.token}`;
        }
      }

      // Basic timeout of 5s
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(forwarder.target_url, {
        method: 'POST',
        headers,
        body: JSON.stringify(positionData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      // Success
      await this.prisma.positionForwarder.update({
        where: { id: forwarderId },
        data: {
          total_sent: { increment: 1 },
          consecutive_failures: 0
        }
      });

    } catch (error: any) {
      const newFailures = forwarder.consecutive_failures + 1;
      const circuitOpen = newFailures >= 10; // Simple threshold

      await this.prisma.positionForwarder.update({
        where: { id: forwarderId },
        data: {
          total_failed: { increment: 1 },
          consecutive_failures: newFailures,
          last_error: error.message,
          circuit_open: circuitOpen,
          circuit_opened_at: circuitOpen ? new Date() : null
        }
      });

      throw error; // Let BullMQ retry
    }
  }
}
