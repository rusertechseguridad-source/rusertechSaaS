import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getCriticalAlerts(tenantId: string) {
    return this.prisma.eventLog.findMany({
      where: {
        tenant_id: tenantId,
        severity: { in: ['high', 'critical'] },
        status: 'open'
      },
      orderBy: { triggered_at: 'desc' },
      take: 50,
      include: {
        vehicle: true,
        trip: true
      }
    });
  }
}
