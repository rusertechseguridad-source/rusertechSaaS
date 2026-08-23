import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isAdminRole } from '../common/constants/admin-roles';

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

    // Los protocolos globales (tenant_id null) son visibles para todos.
    if (!isAdminRole(user.role) && protocol.tenant_id !== user.tenantId && protocol.tenant_id !== null) {
      throw new NotFoundException('Protocolo no encontrado');
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

  /**
   * Valida que el protocolo se pueda modificar desde este tenant.
   *
   * ⚠️ Corrige un hueco real: la condición anterior era
   * `if (existing.tenant_id !== tenantId && existing.tenant_id !== null) { ... }`,
   * de modo que un protocolo GLOBAL (tenant_id null) caía fuera del `if` y
   * quedaba editable y borrable desde cualquier tenant — afectando a todos los
   * clientes a la vez. Ahora los globales sólo los toca un rol administrativo.
   */
  private async assertProtocoloEditable(id: string, tenantId: string, role?: string) {
    const existing = await this.prisma.extended.operationalProtocol.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Protocolo no encontrado');

    if (existing.tenant_id === null) {
      if (!isAdminRole(role)) {
        throw new ForbiddenException(
          'Los protocolos globales sólo pueden modificarse desde un rol administrativo.',
        );
      }
      return existing;
    }

    if (existing.tenant_id !== tenantId) throw new NotFoundException('Protocolo no encontrado');
    return existing;
  }

  async update(id: string, data: any, tenantId: string, role?: string) {
    await this.assertProtocoloEditable(id, tenantId, role);

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

  async remove(id: string, tenantId: string, role?: string) {
    await this.assertProtocoloEditable(id, tenantId, role);
    return this.prisma.extended.operationalProtocol.delete({
      where: { id }
    });
  }
}
