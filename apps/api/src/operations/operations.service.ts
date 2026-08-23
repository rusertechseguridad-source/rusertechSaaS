import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertTenantOwnership, tenantWhere } from '../common/tenant/tenant-scope';

@Injectable()
export class OperationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    // Antes devolvía las operaciones activas de TODOS los tenants.
    return this.prisma.extended.operation.findMany({
      where: tenantWhere(tenantId, 'OperationsService.findAll', { status: 'active' }),
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const op = await this.prisma.extended.operation.findFirst({
      where: tenantWhere(tenantId, 'OperationsService.findOne', { id }),
    });
    if (!op) throw new NotFoundException('Operación no encontrada');
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

  async update(id: string, tenantId: string, data: any) {
    await assertTenantOwnership(this.prisma.extended.operation, id, tenantId, 'Operación');

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

  async remove(id: string, tenantId: string) {
    await assertTenantOwnership(this.prisma.extended.operation, id, tenantId, 'Operación');

    // Baja lógica: las operaciones quedan referenciadas por viajes históricos.
    return this.prisma.extended.operation.update({
      where: { id },
      data: { status: 'inactive' },
    });
  }
}
