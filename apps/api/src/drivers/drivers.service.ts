import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.driver.findMany({
      where: { tenant_id: tenantId },
      include: {
        carrier: true,
      },
      orderBy: { full_name: 'asc' }
    });
  }

  async create(tenantId: string, data: any) {
    return this.prisma.driver.create({
      data: {
        ...data,
        tenant_id: tenantId,
      },
      include: { carrier: true },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const existing = await this.prisma.driver.findFirst({
      where: { id, tenant_id: tenantId }
    });
    if (!existing) throw new NotFoundException('Driver not found');

    return this.prisma.driver.update({
      where: { id },
      data,
      include: { carrier: true },
    });
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.driver.findFirst({
      where: { id, tenant_id: tenantId }
    });
    if (!existing) throw new NotFoundException('Driver not found');

    return this.prisma.driver.delete({
      where: { id },
    });
  }
}
