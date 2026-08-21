import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OperationsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.extended.operation.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const op = await this.prisma.extended.operation.findUnique({ where: { id } });
    if (!op) throw new NotFoundException('Operation not found');
    return op;
  }

  async create(data: any, tenantId: string) {
    const { name, code, description, status, operation_flow_type } = data;
    return this.prisma.extended.operation.create({
      data: {
        tenant_id: tenantId,
        name,
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(operation_flow_type !== undefined && { operation_flow_type }),
      },
    });
  }

  async update(id: string, data: any) {
    const { name, code, description, status, operation_flow_type } = data;
    return this.prisma.extended.operation.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(operation_flow_type !== undefined && { operation_flow_type }),
      },
    });
  }

  async remove(id: string) {
    return this.prisma.extended.operation.update({
      where: { id },
      data: { status: 'inactive' },
    });
  }
}
