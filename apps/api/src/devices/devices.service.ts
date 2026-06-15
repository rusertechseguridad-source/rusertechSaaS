import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.device.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const device = await this.prisma.device.findUnique({
      where: { id },
    });
    if (!device || device.tenant_id !== tenantId) {
      throw new NotFoundException(`Device ${id} not found`);
    }
    return device;
  }

  async create(tenantId: string, data: any) {
    return this.prisma.device.create({
      data: {
        ...data,
        tenant_id: tenantId,
      },
    });
  }

  async update(tenantId: string, id: string, data: any) {
    const device = await this.findOne(tenantId, id);
    return this.prisma.device.update({
      where: { id: device.id },
      data,
    });
  }

  async remove(tenantId: string, id: string) {
    const device = await this.findOne(tenantId, id);
    return this.prisma.device.delete({
      where: { id: device.id },
    });
  }
}
