import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertTenantOwnership, tenantWhere } from '../common/tenant/tenant-scope';

@Injectable()
export class RoutesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.extended.route.findMany({
      include: {
        origin_location: { select: { name: true } },
        destination_location: { select: { name: true } },
        operation: { select: { name: true } }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async findOne(id: string, tenantId: string) {
    const route = await this.prisma.extended.route.findUnique({
      where: tenantWhere(tenantId, 'RoutesService.findOne', { id }),
      include: {
        origin_location: true,
        destination_location: true,
      }
    });

    if (!route) throw new NotFoundException('Route not found');

    // Get the GeoJSON separately to avoid geography deserialization
    const geo: any = await this.prisma.$queryRaw`SELECT ST_AsGeoJSON(geometry) as geojson FROM "routes" WHERE id = ${id}::uuid`;
    
    return {
      ...route,
      geojson: geo[0]?.geojson ? JSON.parse(geo[0].geojson) : null,
    };
  }

  async create(data: any, tenantId: string, userId: string) {
    const { name, description, origin_location_id, destination_location_id, corridor_meters = 500, geojson, operation_id, distance_km, estimated_minutes } = data;
    
    if (!geojson) throw new BadRequestException('GeoJSON LineString is required for the route');

    // INSERT parametrizado (antes: escapado manual de comillas + concatenación).
    await this.prisma.$executeRaw`
      INSERT INTO "routes" (
        tenant_id, name, description, origin_location_id, destination_location_id,
        operation_id, corridor_meters, distance_km, estimated_minutes, created_by, geometry
      ) VALUES (
        ${tenantId}::uuid,
        ${String(name)},
        ${description ?? null},
        ${origin_location_id ?? null}::uuid,
        ${destination_location_id ?? null}::uuid,
        ${operation_id ?? null}::uuid,
        ${corridor_meters},
        ${distance_km ?? null},
        ${estimated_minutes ?? null},
        ${userId}::uuid,
        ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geojson)}), 4326)::geography
      );
    `;

    // Step 2: Fetch via Prisma (excludes Unsupported geography column)
    const created = await this.prisma.extended.route.findFirst({
      where: { name: name, tenant_id: tenantId },
      orderBy: { created_at: 'desc' }
    });

    return created;
  }

  async update(id: string, tenantId: string, data: any) {
    await assertTenantOwnership(this.prisma.extended.route, id, tenantId, 'Recorrido');

    const { name, description, origin_location_id, destination_location_id, corridor_meters, geojson, operation_id, distance_km, estimated_minutes } = data;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (origin_location_id !== undefined) updateData.origin_location_id = origin_location_id;
    if (destination_location_id !== undefined) updateData.destination_location_id = destination_location_id;
    if (operation_id !== undefined) updateData.operation_id = operation_id;
    if (corridor_meters !== undefined) updateData.corridor_meters = corridor_meters;
    if (distance_km !== undefined) updateData.distance_km = distance_km;
    if (estimated_minutes !== undefined) updateData.estimated_minutes = estimated_minutes;

    const route = await this.prisma.extended.route.update({
      where: { id },
      data: updateData
    });

    // Update geometry if geojson changed
    if (geojson) {
      await this.prisma.$executeRaw`
        UPDATE "routes"
        SET geometry = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geojson)}), 4326)::geography
        WHERE id = ${id}::uuid
      `;
    }

    return route;
  }

  async remove(id: string, tenantId: string) {
    await assertTenantOwnership(this.prisma.extended.route, id, tenantId, 'Recorrido');
    return this.prisma.extended.route.delete({ where: { id } });
  }

  async toggleActive(id: string, tenantId: string, isActive: boolean) {
    await assertTenantOwnership(this.prisma.extended.route, id, tenantId, 'Recorrido');

    return this.prisma.extended.route.update({
      where: { id },
      data: { is_active: isActive }
    });
  }
}
