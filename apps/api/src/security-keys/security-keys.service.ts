import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isAdminRole } from '../common/constants/admin-roles';
import { assertTenantOwnership } from '../common/tenant/tenant-scope';

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

    // Roles administrativos: lista única en common/constants/admin-roles.
    if (!isAdminRole(user.role) && key.tenant_id !== user.tenantId) {
      throw new NotFoundException('Clave de seguridad no encontrada');
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
    await assertTenantOwnership(this.prisma.extended.securityKey, id, tenantId, 'Clave de seguridad');

    return this.prisma.extended.securityKey.update({
      where: { id },
      data
    });
  }

  async remove(id: string, tenantId: string) {
    await assertTenantOwnership(this.prisma.extended.securityKey, id, tenantId, 'Clave de seguridad');
    return this.prisma.extended.securityKey.delete({
      where: { id }
    });
  }
}
