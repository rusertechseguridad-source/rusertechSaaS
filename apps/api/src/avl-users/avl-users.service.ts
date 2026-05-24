import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

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

  async exportDictionary(id: string, res: Response) {
    const dictionary = await this.prisma.extended.avlEventDictionary.findMany({
      where: { avl_user_id: id },
      orderBy: [{ category: 'asc' }, { raw_code: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Dictionary');

    worksheet.columns = [
      { header: 'category', key: 'category', width: 20 },
      { header: 'raw_code', key: 'raw_code', width: 20 },
      { header: 'event_type', key: 'event_type', width: 30 },
      { header: 'description', key: 'description', width: 40 },
      { header: 'severity', key: 'severity', width: 15 },
      { header: 'triggers_alert', key: 'triggers_alert', width: 15 },
      { header: 'is_active', key: 'is_active', width: 15 },
    ];

    dictionary.forEach(entry => {
      worksheet.addRow({
        category: entry.category,
        raw_code: entry.raw_code,
        event_type: entry.event_type,
        description: entry.description || '',
        severity: entry.severity,
        triggers_alert: entry.triggers_alert ? 'YES' : 'NO',
        is_active: entry.is_active ? 'YES' : 'NO',
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=dictionary_${id}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  async importDictionary(id: string, fileBuffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);
    const worksheet = workbook.getWorksheet(1);
    
    if (!worksheet) {
      throw new Error('No worksheet found');
    }

    let importedCount = 0;
    let updatedCount = 0;
    let errors = 0;

    const rows = worksheet.getRows(2, worksheet.rowCount) || [];

    for (const row of rows) {
      try {
        const category = row.getCell(1).value?.toString() || 'event';
        const raw_code = row.getCell(2).value?.toString();
        const event_type = row.getCell(3).value?.toString();
        
        if (!raw_code || !event_type) continue;

        const description = row.getCell(4).value?.toString();
        const severity = row.getCell(5).value?.toString() || 'info';
        const triggers_alert_str = row.getCell(6).value?.toString()?.toUpperCase();
        const is_active_str = row.getCell(7).value?.toString()?.toUpperCase();
        
        const triggers_alert = triggers_alert_str === 'YES' || triggers_alert_str === 'TRUE';
        const is_active = is_active_str !== 'NO' && is_active_str !== 'FALSE';

        const existing = await this.prisma.extended.avlEventDictionary.findUnique({
          where: {
            avl_user_id_category_raw_code: {
              avl_user_id: id,
              category,
              raw_code,
            }
          }
        });

        if (existing) {
          await this.prisma.extended.avlEventDictionary.update({
            where: { id: existing.id },
            data: { event_type, description, severity, triggers_alert, is_active }
          });
          updatedCount++;
        } else {
          await this.prisma.extended.avlEventDictionary.create({
            data: {
              avl_user_id: id,
              category,
              raw_code,
              event_type,
              description,
              severity,
              triggers_alert,
              is_active
            }
          });
          importedCount++;
        }

        // Remove from unknown cache if we just mapped it
        await this.redis.getClient().srem(`avl:unknown:${id}`, raw_code);
      } catch (e) {
        errors++;
      }
    }

    return { imported: importedCount, updated: updatedCount, errors };
  }
}
