import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SecurityKeysService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: any) {
    const where: any = {};
    if (user.role !== 'super_admin' && user.role !== 'rusertech_admin') {
      where.tenant_id = user.tenantId;
    }

    return this.prisma.extended.securityKey.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, user: any) {
    const key = await this.prisma.extended.securityKey.findUnique({
      where: { id },
    });
    if (!key) throw new NotFoundException('Security key not found');

    if (user.role !== 'super_admin' && user.role !== 'rusertech_admin') {
      if (key.tenant_id !== user.tenantId) {
        throw new NotFoundException('Security key not found');
      }
    }
    return key;
  }

  async create(data: any, tenantId: string) {
    return this.prisma.extended.securityKey.create({
      data: {
        ...data,
        tenant_id: tenantId,
      }
    });
  }

  async update(id: string, data: any, tenantId: string) {
    const existing = await this.prisma.extended.securityKey.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Security key not found');
    if (existing.tenant_id !== tenantId) {
      throw new NotFoundException('Security key not found or unauthorized');
    }

    return this.prisma.extended.securityKey.update({
      where: { id },
      data
    });
  }

  async remove(id: string, tenantId: string) {
    const existing = await this.prisma.extended.securityKey.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Security key not found');
    if (existing.tenant_id !== tenantId) {
      throw new NotFoundException('Security key not found or unauthorized');
    }
    return this.prisma.extended.securityKey.delete({
      where: { id }
    });
  }
}
