import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CarriersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.carrier.findMany({
      where: { tenant_id: tenantId },
      include: {
        _count: {
          select: { vehicles: true, drivers: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async create(tenantId: string, data: any) {
    return this.prisma.carrier.create({
      data: {
        ...data,
        tenant_id: tenantId,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.carrier.findFirst({
      where: { id, tenant_id: tenantId }
    });
    if (!existing) throw new NotFoundException('Carrier not found');

    return this.prisma.carrier.update({
      where: { id },
      data,
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.carrier.findFirst({
      where: { id, tenant_id: tenantId }
    });
    if (!existing) throw new NotFoundException('Carrier not found');

    return this.prisma.carrier.delete({
      where: { id },
    });
  }
}
