import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AvlUsersService {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  async findAll() {
    return this.prisma.extended.avlUser.findMany({
      include: {
        _count: {
          select: { vehicles: true }
        }
      }
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.extended.avlUser.findUnique({
      where: { id },
      include: {
        _count: {
          select: { vehicles: true }
        }
      }
    });
    if (!user) throw new NotFoundException('AVL User not found');
    return user;
  }

  async create(tenantId: string, data: any) {
    const apiKey = uuidv4();
    return this.prisma.extended.avlUser.create({
      data: {
        ...data,
        tenant_id: tenantId,
        api_key: apiKey,
      }
    });
  }

  async update(id: string, data: any) {
    return this.prisma.extended.avlUser.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.extended.avlUser.delete({ where: { id } });
  }

  async toggleActive(id: string, is_active: boolean) {
    return this.prisma.extended.avlUser.update({
      where: { id },
      data: { is_active }
    });
  }

  async regenerateApiKey(id: string) {
    const apiKey = uuidv4();
    return this.prisma.extended.avlUser.update({
      where: { id },
      data: { api_key: apiKey }
    });
  }

  async getDictionary(id: string) {
    return this.prisma.extended.avlEventDictionary.findMany({
      where: { avl_user_id: id }
    });
  }

  async addDictionaryEntry(id: string, data: any) {
    return this.prisma.extended.avlEventDictionary.create({
      data: {
        ...data,
        avl_user_id: id,
      }
    });
  }

  async updateDictionaryEntry(dictId: string, data: any) {
    const updated = await this.prisma.extended.avlEventDictionary.update({
      where: { id: dictId },
      data,
    });
    // Remove from unknown cache if we just mapped it
    await this.redis.getClient().srem(`avl:unknown:${updated.avl_user_id}`, updated.raw_code);
    return updated;
  }

  async deleteDictionaryEntry(dictId: string) {
    return this.prisma.extended.avlEventDictionary.delete({
      where: { id: dictId }
    });
  }

  async getUnknownCodes(id: string) {
    const codes = await this.redis.getClient().smembers(`avl:unknown:${id}`);
    return codes;
  }
}
