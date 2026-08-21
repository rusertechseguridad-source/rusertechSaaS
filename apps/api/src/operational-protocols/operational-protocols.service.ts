import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OperationalProtocolsService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: any, skip?: number, take?: number, filters?: any) {
    const where: any = {};
    
    if (user.role !== 'super_admin' && user.role !== 'rusertech_admin') {
      where.OR = [
        { tenant_id: user.tenantId },
        { tenant_id: null }
      ];
    }

    if (filters?.trip_status) where.trip_status = filters.trip_status;
    if (filters?.risk_level) where.risk_level = filters.risk_level;
    if (filters?.is_active !== undefined && filters?.is_active !== '') {
      where.is_active = filters.is_active === 'true';
    }

    const [data, total] = await Promise.all([
      this.prisma.extended.operationalProtocol.findMany({
        where,
        skip: skip || undefined,
        take: take || undefined,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.extended.operationalProtocol.count({ where })
    ]);

    return { data, total };
  }

  async findOne(id: string, user: any) {
    const protocol = await this.prisma.extended.operationalProtocol.findUnique({
      where: { id },
    });
    if (!protocol) throw new NotFoundException('Protocol not found');

    if (user.role !== 'super_admin' && user.role !== 'rusertech_admin') {
      if (protocol.tenant_id !== user.tenantId && protocol.tenant_id !== null) {
        throw new NotFoundException('Protocol not found');
      }
    }
    return protocol;
  }

  async create(data: any, tenantId: string) {
    try {
      return await this.prisma.extended.operationalProtocol.create({
        data: {
          ...data,
          tenant_id: tenantId,
        }
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException('Ya existe un protocolo con esa combinación activa para este tenant');
      }
      throw e;
    }
  }

  async update(id: string, data: any, tenantId: string) {
    const existing = await this.prisma.extended.operationalProtocol.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Protocol not found');
    if (existing.tenant_id !== tenantId && existing.tenant_id !== null) {
      if (existing.tenant_id !== tenantId) {
        throw new NotFoundException('Protocol not found or unauthorized');
      }
    }

    try {
      return await this.prisma.extended.operationalProtocol.update({
        where: { id },
        data
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException('Ya existe un protocolo con esa combinación activa para este tenant');
      }
      throw e;
    }
  }

  async remove(id: string, tenantId: string) {
    const existing = await this.prisma.extended.operationalProtocol.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Protocol not found');
    if (existing.tenant_id !== tenantId && existing.tenant_id !== null) {
      if (existing.tenant_id !== tenantId) {
        throw new NotFoundException('Protocol not found or unauthorized');
      }
    }
    return this.prisma.extended.operationalProtocol.delete({
      where: { id }
    });
  }
}
