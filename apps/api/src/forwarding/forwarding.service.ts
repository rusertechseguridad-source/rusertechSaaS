import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ForwardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getForwarders(tenantId: string) {
    return this.prisma.positionForwarder.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' }
    });
  }

  async createForwarder(tenantId: string, data: any) {
    return this.prisma.positionForwarder.create({
      data: {
        tenant_id: tenantId,
        name: data.name,
        target_url: data.target_url,
        auth_type: data.auth_type || 'none',
        auth_credentials: data.auth_credentials || null,
        payload_format: data.payload_format || 'rusertech_v1',
        is_active: data.is_active ?? true
      }
    });
  }

  async getForwarder(tenantId: string, id: string) {
    const forwarder = await this.prisma.positionForwarder.findFirst({
      where: { id, tenant_id: tenantId }
    });
    if (!forwarder) throw new NotFoundException('Forwarder no encontrado');
    return forwarder;
  }

  async updateForwarder(tenantId: string, id: string, data: any) {
    return this.prisma.positionForwarder.update({
      where: { id, tenant_id: tenantId },
      data: {
        name: data.name,
        target_url: data.target_url,
        auth_type: data.auth_type,
        auth_credentials: data.auth_credentials,
        payload_format: data.payload_format,
        is_active: data.is_active
      }
    });
  }

  async deleteForwarder(tenantId: string, id: string) {
    return this.prisma.positionForwarder.delete({
      where: { id, tenant_id: tenantId }
    });
  }

  async toggleForwarder(tenantId: string, id: string, isActive: boolean) {
    return this.prisma.positionForwarder.update({
      where: { id, tenant_id: tenantId },
      data: { is_active: isActive }
    });
  }

  async resetCircuit(tenantId: string, id: string) {
    return this.prisma.positionForwarder.update({
      where: { id, tenant_id: tenantId },
      data: {
        circuit_open: false,
        circuit_opened_at: null,
        consecutive_failures: 0
      }
    });
  }

  async getStats(tenantId: string, id: string) {
    const forwarder = await this.getForwarder(tenantId, id);
    return {
      total_sent: forwarder.total_sent,
      total_failed: forwarder.total_failed,
      consecutive_failures: forwarder.consecutive_failures,
      circuit_open: forwarder.circuit_open,
      last_error: forwarder.last_error
    };
  }
}
