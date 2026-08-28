import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertTenantOwnership, tenantWhere } from '../common/tenant/tenant-scope';
import { RedisService } from '../common/redis/redis.service';
import { TOLERANCIA_RELOJ_MINUTOS } from '../common/config/live-positions';
import { MonitoringConfigService } from '../common/monitoring/monitoring-config.service';
import { v4 as uuidv4 } from 'uuid';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { aVistaPublica, credencialParaGuardar, descifrarCredenciales } from './avl-users.credenciales';
import { CONTEXTO } from '../common/crypto/secretos-cifrados';

/**
 * Cuánto hacia atrás se buscan códigos sin diccionario.
 *
 * Es más ancha que la ventana del mapa a propósito: un código raro que llegó
 * anteayer sigue siendo un código que hay que mapear, aunque el vehículo ya no
 * esté en pantalla. El techo lo sigue imponiendo el particionado mensual.
 */
const VENTANA_CODIGOS_DESCONOCIDOS_HORAS = 168;

@Injectable()
export class AvlUsersService {
  private readonly logger = new Logger(AvlUsersService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private monitoringConfig: MonitoringConfigService,
  ) {}

  /**
   * Verifica que el avl_user pertenezca al tenant antes de operar sobre él o
   * sobre su diccionario. Es el punto más sensible del módulo:
   * `regenerateApiKey` sobre un avl_user ajeno cortaría la ingesta GPS de otro
   * cliente.
   */
  /**
   * Quita un código del registro auxiliar de "desconocidos" en Redis.
   *
   * ⚠️ Ese set YA NO es la fuente de los códigos desconocidos: desde esta tanda
   * `getUnknownCodes` los calcula contra `telemetry` y `avl_event_dictionary`.
   * El set lo sigue escribiendo el ingest de NestJS, así que se mantiene la
   * limpieza para no dejarlo creciendo con códigos ya mapeados. No se eliminó
   * la pieza porque el ingest todavía la escribe: sacarla es una decisión
   * aparte, que corresponde a la tanda que revise el ingest.
   */
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

  /**
   * Listado de proveedores GPS del tenant.
   *
   * Devuelve además `ultimo_dato` y `ventana_horas`, calculados contra
   * `telemetry`.
   *
   * ⚠️ POR QUÉ NO SE USA `avl_users.last_data_at`: esa columna la escribe
   * **únicamente** el ingest de NestJS (`telemetry.service.ts`). La Mobile API
   * escribe directo a `telemetry` sin pasar por ahí, así que el proveedor
   * `Rusertech_Mobile` tenía `last_data_at = null` para siempre y la pantalla
   * mostraba "Último dato: Nunca" mientras la base acumulaba decenas de puntos
   * por día. Es exactamente la misma causa raíz que dejaba el mapa en vivo
   * vacío: depender de un dato que sólo conoce una de las dos vías de ingreso.
   *
   * La columna NO se elimina —el ingest la sigue escribiendo y puede haber
   * consumidores fuera de este repo—, pero deja de ser lo que se muestra.
   */
  async findAll(tenantId: string) {
    // Antes devolvía los avl_users de TODOS los tenants, con su api_key incluida.
    const usuarios = await this.prisma.extended.avlUser.findMany({
      where: tenantWhere(tenantId, 'AvlUsersService.findAll'),
      include: {
        _count: {
          select: { vehicles: true }
        }
      }
    });

    if (usuarios.length === 0) return usuarios;

    const { ventanaHoras, ultimoPorProveedor } = await this.consultarUltimoDato(tenantId);

    // `aVistaPublica` saca las credenciales y deja en su lugar dos booleanos:
    // la pantalla necesita saber SI hay credencial guardada, no cuál es.
    return usuarios.map((u: any) => ({
      ...aVistaPublica(u),
      ultimo_dato: ultimoPorProveedor.get(u.id) ?? null,
      ventana_horas: ventanaHoras,
    }));
  }

  /**
   * Último punto real por proveedor, dentro de una ventana acotada.
   *
   * ⚠️ Rango CERRADO. Sin el extremo superior Postgres no puede descartar las
   * particiones futuras de `telemetry` ni la `default`, y la planificación pasa
   * a costar más que la ejecución.
   *
   * La ventana viene de la configuración del tenant. Es deliberado que sea
   * acotada y no "toda la historia": recorrer 30 particiones para pintar una
   * fecha en un listado no se justifica. La consecuencia es que la pantalla
   * sólo puede afirmar "sin datos en las últimas N h" — nunca "nunca", que
   * sería una afirmación que esta consulta no puede sostener.
   */
  private async consultarUltimoDato(tenantId: string): Promise<{
    ventanaHoras: number;
    ultimoPorProveedor: Map<string, Date>;
  }> {
    const { ventana_mapa_horas: ventanaHoras } =
      await this.monitoringConfig.obtenerUmbrales(tenantId);

    const ahora = Date.now();
    const desde = new Date(ahora - ventanaHoras * 60 * 60 * 1000);
    const hasta = new Date(ahora + TOLERANCIA_RELOJ_MINUTOS * 60 * 1000);

    const filas: { avl_user_id: string; ultimo_dato: Date }[] = await this.prisma.$queryRaw<
      { avl_user_id: string; ultimo_dato: Date }[]
    >`
      SELECT t.avl_user_id, MAX(t."timestamp") AS ultimo_dato
      FROM telemetry t
      WHERE t.tenant_id = ${tenantId}::uuid
        AND t."timestamp" >= ${desde}
        AND t."timestamp" <= ${hasta}
        AND t.is_duplicate = false
      GROUP BY t.avl_user_id
    `;

    return {
      ventanaHoras,
      ultimoPorProveedor: new Map(filas.map((f) => [f.avl_user_id, f.ultimo_dato])),
    };
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
    return aVistaPublica(user as any);
  }

  /**
   * Campos que el cliente puede escribir. Todo lo demás del body se descarta.
   *
   * Antes se hacía `data: {...data}` con el body crudo. Eso es asignación
   * masiva: un `PUT {"tenant_id":"<otro>"}` MOVÍA el proveedor GPS a otro
   * cliente — verificado ejecutando el servicio. `tenant_id`, `id`, `api_key`
   * y las credenciales cifradas no se toman de acá: los dos primeros no se
   * cambian nunca por esta vía, y las credenciales tienen su propio camino
   * (`credencialParaGuardar`), que distingue "no vino" de "borrala".
   */
  // Verificada contra el modelo `AvlUser` de schema.prisma, columna por
  // columna. Quedan afuera a propósito: `id`, `tenant_id` (el mass assignment
  // que se está cerrando), `api_key` (tiene su propio endpoint de
  // regeneración), `last_data_at` (lo escribe el ingest), `created_at`,
  // `updated_at`, y las dos credenciales, que van por `credencialParaGuardar`.
  private static readonly CAMPOS_EDITABLES = [
    'user_avl_code',
    'name',
    'description',
    'provider_name',
    'provider_platform_url',
    'provider_username',
    'provider_api_url',
    'provider_notes',
    'operational_contact',
    'is_active',
  ] as const;

  private soloCamposEditables(data: any): Record<string, unknown> {
    const limpio: Record<string, unknown> = {};
    for (const campo of AvlUsersService.CAMPOS_EDITABLES) {
      if (data?.[campo] !== undefined) limpio[campo] = data[campo];
    }
    return limpio;
  }

  async create(tenantId: string, data: any) {
    const apiKey = uuidv4();
    // `as any` acotado: `soloCamposEditables` devuelve Record<string,unknown> y
    // Prisma no puede verificar estáticamente que los obligatorios estén. La
    // validación real de presencia la hace la base (NOT NULL); lo que esta
    // lista garantiza es que no entre NADA que el cliente no deba escribir.
    const creado = await this.prisma.extended.avlUser.create({
      data: {
        ...this.soloCamposEditables(data),
        // En un alta sí se acepta la cadena vacía: significa "no cargué
        // credencial", que es distinto de la edición, donde un vacío casi
        // siempre es un formulario reenviando un campo que nunca se completó.
        provider_password: credencialParaGuardar(
          data?.provider_password, CONTEXTO.avlProviderPassword, 'provider_password', true),
        provider_api_key: credencialParaGuardar(
          data?.provider_api_key, CONTEXTO.avlProviderApiKey, 'provider_api_key', true),
        tenant_id: tenantId,
        api_key: apiKey,
      } as any
    });
    return aVistaPublica(creado as any);
  }

  async update(id: string, tenantId: string, data: any) {
    await this.assertAvlUserDelTenant(id, tenantId);
    const actualizado = await this.prisma.extended.avlUser.update({
      where: { id },
      data: {
        ...this.soloCamposEditables(data),
        provider_password: credencialParaGuardar(
          data?.provider_password, CONTEXTO.avlProviderPassword, 'provider_password', false),
        provider_api_key: credencialParaGuardar(
          data?.provider_api_key, CONTEXTO.avlProviderApiKey, 'provider_api_key', false),
      },
    });
    return aVistaPublica(actualizado as any);
  }

  /**
   * Devuelve las credenciales EN CLARO. Endpoint aparte y con permiso propio:
   * el listado no puede traerlas, porque entonces las tendría cualquiera que
   * abra la pantalla.
   */
  async revelarCredenciales(id: string, tenantId: string) {
    await this.assertAvlUserDelTenant(id, tenantId);
    const fila = await this.prisma.extended.avlUser.findUnique({
      where: { id },
      select: { provider_username: true, provider_password: true, provider_api_key: true },
    });
    if (!fila) throw new NotFoundException('AVL User no encontrado');
    this.logger.warn(
      `Credenciales de proveedor reveladas: avl_user=${id} tenant=${tenantId}`,
    );
    return descifrarCredenciales(fila as any);
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

  /**
   * Códigos que llegaron de este proveedor y no están en su diccionario.
   *
   * Se calcula contra `telemetry` y `avl_event_dictionary`. Antes salía de un
   * set en Redis (`avl:unknown:{id}`) que escribía el ingest: ese registro se
   * pierde cuando se vacía la caché, y en las instalaciones sin Redis —la
   * actual incluida— la pantalla mostraba siempre cero códigos desconocidos,
   * que es peor que no mostrar nada porque afirma algo falso.
   *
   * ⚠️ Rango CERRADO, igual que el resto de las consultas sobre `telemetry`:
   * sin el extremo superior Postgres no puede podar las particiones futuras ni
   * la `default`.
   *
   * ⚠️ EXISTS y no un JOIN contra el diccionario: su clave única es
   * (avl_user_id, category, raw_code), así que un mismo código puede tener una
   * fila por categoría y el JOIN multiplicaría el resultado.
   */
  async getUnknownCodes(id: string, tenantId: string): Promise<string[]> {
    await this.assertAvlUserDelTenant(id, tenantId);

    const ahora = Date.now();
    const desde = new Date(ahora - VENTANA_CODIGOS_DESCONOCIDOS_HORAS * 60 * 60 * 1000);
    const hasta = new Date(ahora + TOLERANCIA_RELOJ_MINUTOS * 60 * 1000);

    const filas: { provider_code: string }[] = await this.prisma.$queryRaw<{ provider_code: string }[]>`
      SELECT t.provider_code
      FROM telemetry t
      WHERE t.tenant_id = ${tenantId}::uuid
        AND t.avl_user_id = ${id}::uuid
        AND t."timestamp" >= ${desde}
        AND t."timestamp" <= ${hasta}
        AND t.is_duplicate = false
        AND t.provider_code IS NOT NULL
        -- Los códigos de la app del conductor no se esperan en el diccionario
        -- del proveedor GPS: marcarlos como "desconocidos" sería ruido.
        AND NOT jsonb_exists(t.raw_payload, 'MobileCode')
        AND NOT EXISTS (
          SELECT 1
          FROM avl_event_dictionary d
          WHERE d.avl_user_id = t.avl_user_id
            AND d.raw_code = t.provider_code
            AND d.is_active = true
        )
      GROUP BY t.provider_code
      ORDER BY COUNT(*) DESC
    `;

    return filas.map((f) => f.provider_code);
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
