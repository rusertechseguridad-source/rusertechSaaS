import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertTenantOwnership, tenantWhere } from '../common/tenant/tenant-scope';
import { RedisService } from '../common/redis/redis.service';
import { v4 as uuidv4 } from 'uuid';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

@Injectable()
export class AvlUsersService {
  private readonly logger = new Logger(AvlUsersService.name);

  constructor(private prisma: PrismaService, private redis: RedisService) {}

  /**
   * Verifica que el avl_user pertenezca al tenant antes de operar sobre él o
   * sobre su diccionario. Es el punto más sensible del módulo:
   * `regenerateApiKey` sobre un avl_user ajeno cortaría la ingesta GPS de otro
   * cliente.
   */
  /** Quita un código del registro auxiliar de "desconocidos" (sólo en Redis). */
  private async olvidarCodigoDesconocido(avlUserId: string, rawCode: string): Promise<void> {
    if (!this.redis.isConfigured()) return;
    try {
      await this.redis.getClient().srem(`avl:unknown:${avlUserId}`, rawCode);
    } catch (error) {
      this.logger.warn(
        `No se pudo limpiar el código desconocido ${rawCode}: ${(error as Error).message}`,
      );
    }
  }

  private async assertAvlUserDelTenant(id: string, tenantId: string) {
    return assertTenantOwnership(this.prisma.extended.avlUser, id, tenantId, 'AVL User');
  }

  async findAll(tenantId: string) {
    // Antes devolvía los avl_users de TODOS los tenants, con su api_key incluida.
    return this.prisma.extended.avlUser.findMany({
      where: tenantWhere(tenantId, 'AvlUsersService.findAll'),
      include: {
        _count: {
          select: { vehicles: true }
        }
      }
    });
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.prisma.extended.avlUser.findFirst({
      where: tenantWhere(tenantId, 'AvlUsersService.findOne', { id }),
      include: {
        _count: {
          select: { vehicles: true }
        }
      }
    });
    if (!user) throw new NotFoundException('AVL User no encontrado');
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

  async update(id: string, tenantId: string, data: any) {
    await this.assertAvlUserDelTenant(id, tenantId);
    return this.prisma.extended.avlUser.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, tenantId: string) {
    await this.assertAvlUserDelTenant(id, tenantId);
    return this.prisma.extended.avlUser.delete({ where: { id } });
  }

  async toggleActive(id: string, tenantId: string, is_active: boolean) {
    await this.assertAvlUserDelTenant(id, tenantId);
    return this.prisma.extended.avlUser.update({
      where: { id },
      data: { is_active }
    });
  }

  async regenerateApiKey(id: string, tenantId: string) {
    await this.assertAvlUserDelTenant(id, tenantId);
    const apiKey = uuidv4();
    return this.prisma.extended.avlUser.update({
      where: { id },
      data: { api_key: apiKey }
    });
  }

  async getDictionary(id: string, tenantId: string) {
    await this.assertAvlUserDelTenant(id, tenantId);
    return this.prisma.extended.avlEventDictionary.findMany({
      where: { avl_user_id: id }
    });
  }

  async addDictionaryEntry(id: string, tenantId: string, data: any) {
    await this.assertAvlUserDelTenant(id, tenantId);
    return this.prisma.extended.avlEventDictionary.create({
      data: {
        ...data,
        avl_user_id: id,
      }
    });
  }

  async updateDictionaryEntry(dictId: string, tenantId: string, data: any) {
    // La entrada no tiene tenant_id propio: se valida contra el avl_user padre.
    await assertTenantOwnership(
      this.prisma.extended.avlEventDictionary,
      dictId,
      tenantId,
      'Entrada de diccionario',
      { via: (t) => ({ avl_user: { tenant_id: t } }) },
    );
    const updated = await this.prisma.extended.avlEventDictionary.update({
      where: { id: dictId },
      data,
    });
    // Los "códigos desconocidos" son un registro auxiliar que vive sólo en
    // Redis: si no está configurado, no hay nada que limpiar y la edición del
    // diccionario debe funcionar igual.
    await this.olvidarCodigoDesconocido(updated.avl_user_id, updated.raw_code);
    return updated;
  }

  async deleteDictionaryEntry(dictId: string, tenantId: string) {
    await assertTenantOwnership(
      this.prisma.extended.avlEventDictionary,
      dictId,
      tenantId,
      'Entrada de diccionario',
      { via: (t) => ({ avl_user: { tenant_id: t } }) },
    );
    return this.prisma.extended.avlEventDictionary.delete({
      where: { id: dictId }
    });
  }

  async getUnknownCodes(id: string, tenantId: string) {
    await this.assertAvlUserDelTenant(id, tenantId);
    // Sin Redis no hay registro de códigos desconocidos: se devuelve vacío en
    // lugar de romper la pantalla del diccionario.
    if (!this.redis.isConfigured()) return [];
    try {
      return await this.redis.getClient().smembers(`avl:unknown:${id}`);
    } catch (error) {
      this.logger.warn(`No se pudieron leer los códigos desconocidos: ${(error as Error).message}`);
      return [];
    }
  }

  async exportDictionary(id: string, tenantId: string, res: Response) {
    await this.assertAvlUserDelTenant(id, tenantId);
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

  async importDictionary(id: string, tenantId: string, fileBuffer: Buffer) {
    await this.assertAvlUserDelTenant(id, tenantId);
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

        await this.olvidarCodigoDesconocido(id, raw_code);
      } catch (e) {
        // Antes se contaban los errores sin registrar ninguno: si una
        // importación fallaba entera, no quedaba rastro del motivo.
        errors++;
        this.logger.warn(
          `Error importando fila del diccionario (avl_user ${id}): ${(e as Error).message}`,
        );
      }
    }

    return { imported: importedCount, updated: updatedCount, errors };
  }
}
