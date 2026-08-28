import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertTenantOwnership, tenantWhere } from '../common/tenant/tenant-scope';
import { AccesoEntidadesService } from '../common/access/acceso-entidades.service';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService,
    private readonly acceso: AccesoEntidadesService,
  ) {}

  async findAll(user: any) {
    // 🔴 Acá había una fuga entre clientes, no sólo un problema de
    // restricciones: `restrictions` quedaba en `undefined` para todo rol que no
    // fuera `viewer`, y `where: undefined` devuelve las ubicaciones de TODOS
    // los tenants. `vehicles` y `trips` sí filtraban; esta se salteó.
    const restricciones = await this.acceso.filtroPara(user, 'locations', 'id');

    return this.prisma.extended.savedLocation.findMany({
      where: tenantWhere(user?.tenantId, 'LocationsService.findAll', restricciones),
      include: {
        operation: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async findOne(id: string, tenantId: string) {
    const loc = await this.prisma.extended.savedLocation.findUnique({
      where: tenantWhere(tenantId, 'LocationsService.findOne', { id })
    });
    if (!loc) throw new NotFoundException('Location not found');
    return loc;
  }

  async create(data: any, tenantId: string, userId: string) {
    const { name, address, location_type, lat, lng, radius_meters = 100, operation_id, is_authorized_stop, notes } = data;
    
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      throw new BadRequestException('Coordinates are required');
    }

    // INSERT parametrizado. Antes se escapaban las comillas a mano
    // (`replace(/'/g, "''")`) y se concatenaba: un sanitizador casero es
    // justamente lo que hay que evitar. La forma tagged-template de
    // $executeRaw envía los valores como parámetros del driver.
    await this.prisma.$executeRaw`
      INSERT INTO "saved_locations" (
        tenant_id, name, address, location_type, latitude, longitude,
        radius_meters, created_by, geometry, operation_id, is_authorized_stop, notes
      ) VALUES (
        ${tenantId}::uuid,
        ${String(name)},
        ${address ?? null},
        ${String(location_type || 'generic')},
        ${lat},
        ${lng},
        ${radius_meters},
        ${userId}::uuid,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${operation_id ?? null}::uuid,
        ${!!is_authorized_stop},
        ${notes ?? null}
      );
    `;

    // Step 2: Fetch the just-created record via Prisma (avoids geography column)
    const created = await this.prisma.extended.savedLocation.findFirst({
      where: { name: name, tenant_id: tenantId },
      orderBy: { created_at: 'desc' }
    });

    return created;
  }

  async update(id: string, tenantId: string, data: any) {
    await assertTenantOwnership(this.prisma.extended.savedLocation, id, tenantId, 'Ubicación');

    const { name, address, location_type, lat, lng, radius_meters, operation_id, is_authorized_stop, notes } = data;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (location_type) updateData.location_type = location_type;
    if (lat !== undefined) updateData.latitude = lat;
    if (lng !== undefined) updateData.longitude = lng;
    if (radius_meters !== undefined) updateData.radius_meters = radius_meters;
    if (operation_id !== undefined) updateData.operation_id = operation_id || null;
    if (is_authorized_stop !== undefined) updateData.is_authorized_stop = is_authorized_stop;
    if (notes !== undefined) updateData.notes = notes;

    const loc = await this.prisma.extended.savedLocation.update({
      where: { id },
      data: updateData
    });

    // Update geometry if coordinates changed
    if (lat !== undefined || lng !== undefined) {
      const rLat = loc.latitude;
      const rLng = loc.longitude;
      await this.prisma.$executeRaw`
        UPDATE "saved_locations"
        SET geometry = ST_SetSRID(ST_MakePoint(${rLng}, ${rLat}), 4326)::geography
        WHERE id = ${id}::uuid
      `;
    }

    return loc;
  }

  async remove(id: string, tenantId: string) {
    await assertTenantOwnership(this.prisma.extended.savedLocation, id, tenantId, 'Ubicación');
    return this.prisma.extended.savedLocation.delete({ where: { id } });
  }

  async toggleActive(id: string, tenantId: string, isActive: boolean) {
    await assertTenantOwnership(this.prisma.extended.savedLocation, id, tenantId, 'Ubicación');

    return this.prisma.extended.savedLocation.update({
      where: { id },
      data: { is_active: isActive }
    });
  }
}
