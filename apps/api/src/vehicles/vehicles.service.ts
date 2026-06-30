import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { MailService } from '../mail/mail.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class VehiclesService {
  constructor(
    private prisma: PrismaService, 
    private redis: RedisService,
    private mailService: MailService
  ) {}

  async findAll(user?: any, skip?: number, take?: number) {
    // Determine restrictions
    let restrictions = undefined;
    if (user?.role === 'viewer') {
      const fullUser = await this.prisma.user.findUnique({ where: { id: user.id }, select: { entity_restrictions: true } });
      const er = fullUser?.entity_restrictions as any;
      if (er && Array.isArray(er.vehicles) && er.vehicles.length > 0) {
        restrictions = { id: { in: er.vehicles } };
      }
    }

    return this.prisma.extended.vehicle.findMany({
      skip,
      take,
      where: restrictions,
      include: {
        avl_user: { select: { name: true, user_avl_code: true } }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.extended.vehicle.findUnique({
      where: { id },
      include: {
        avl_user: { select: { name: true, user_avl_code: true } }
      }
    });

    if (!vehicle) throw new NotFoundException('Vehicle not found');

    // Get live position from Redis
    const posStr = await this.redis.getClient().get(`vehicle:pos:${vehicle.hub_asset_id}`);
    const lastPosition = posStr ? JSON.parse(posStr) : null;

    return { ...vehicle, lastPosition };
  }

  async getLivePositions() {
    // Gets all live positions from Redis using keys
    const client = this.redis.getClient();
    const keys = await client.keys('vehicle:pos:*');
    
    if (keys.length === 0) return [];
    
    const pipeline = client.pipeline();
    keys.forEach(k => pipeline.get(k));
    const results = await pipeline.exec();
    
    return results?.map(([err, val]) => val ? JSON.parse(val as string) : null).filter(v => v !== null) || [];
  }

  async create(data: any, tenantId: string) {
    // Add validation later if needed
    return this.prisma.extended.vehicle.create({
      data: {
        ...data,
        tenant_id: tenantId,
      }
    });
  }

  async update(id: string, data: any) {
    return this.prisma.extended.vehicle.update({
      where: { id },
      data
    });
  }

  async remove(id: string) {
    // Soft delete
    return this.prisma.extended.vehicle.update({
      where: { id },
      data: { status: 'inactive' }
    });
  }

  async toggleBlock(id: string, blocked: boolean, reason?: string) {
    const updated = await this.prisma.extended.vehicle.update({
      where: { id },
      data: { 
        is_blocked: blocked, 
        block_reason: blocked ? reason : null 
      },
      select: { 
        id: true, 
        plate: true, 
        is_blocked: true, 
        block_reason: true, 
        hub_asset_id: true, 
        avl_user_id: true,
        tenant_id: true,
        tenant: { select: { name: true } }
      }
    });

    // Invalidate Redis cache so TelemetryService picks up the new status
    if (updated.hub_asset_id && updated.avl_user_id) {
      await this.redis.getClient().del(`vehicle:asset:${updated.avl_user_id}:${updated.hub_asset_id}`);
    }

    if (blocked && reason) {
      const toEmails: string[] = [];
      
      const tenantManagers = await this.prisma.extended.user.findMany({
        where: { tenant_id: updated.tenant_id, role_code: { in: ['account_owner', 'manager'] }, status: 'active' },
        select: { email: true }
      });
      tenantManagers.forEach(u => toEmails.push(u.email));

      if (toEmails.length > 0) {
        this.mailService.sendVehicleBlockedAlert({
          plate: updated.plate,
          reason,
          toEmails,
          tenantName: (updated as any).tenant?.name
        }).catch(err => console.error('Failed to send block alert email:', err));
      }

      // 2. Registrar el EventLog (Auditoría de Bloqueo)
      await this.prisma.extended.eventLog.create({
        data: {
          tenant_id: updated.tenant_id,
          vehicle_id: updated.id,
          event_type: 'vehicle_blocked',
          severity: 'critical',
          metadata_json: { reason, plate: updated.plate },
          status: 'open'
        }
      });
    } else if (!blocked) {
      // Al desbloquear, marcamos el EventLog como resuelto
      await this.prisma.extended.eventLog.updateMany({
        where: { vehicle_id: updated.id, event_type: 'vehicle_blocked', status: 'open' },
        data: { status: 'resolved', resolved_at: new Date(), resolution_note: 'Vehículo desbloqueado manualmente' }
      });
    }

    return updated;
  }
}
