import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  async findAll(skip?: number, take?: number) {
    return this.prisma.extended.vehicle.findMany({
      skip,
      take,
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
      select: { id: true, plate: true, is_blocked: true, block_reason: true, hub_asset_id: true, avl_user_id: true }
    });

    // Invalidate Redis cache so TelemetryService picks up the new status
    if (updated.hub_asset_id && updated.avl_user_id) {
      await this.redis.getClient().del(`vehicle:asset:${updated.avl_user_id}:${updated.hub_asset_id}`);
    }

    return updated;
  }
}
