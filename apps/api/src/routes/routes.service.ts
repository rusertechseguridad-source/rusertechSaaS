import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  async findOne(id: string) {
    const route = await this.prisma.extended.route.findUnique({
      where: { id },
      include: {
        origin_location: true,
        destination_location: true,
      }
    });

    if (!route) throw new NotFoundException('Route not found');

    // Get the GeoJSON separately to avoid geography deserialization
    const geo: any = await this.prisma.$queryRawUnsafe(`
      SELECT ST_AsGeoJSON(geometry) as geojson FROM "routes" WHERE id = '${id}'
    `);
    
    return {
      ...route,
      geojson: geo[0]?.geojson ? JSON.parse(geo[0].geojson) : null,
    };
  }

  async create(data: any, tenantId: string, userId: string) {
    const { name, description, origin_location_id, destination_location_id, corridor_meters = 500, geojson, operation_id, distance_km, estimated_minutes } = data;
    
    if (!geojson) throw new BadRequestException('GeoJSON LineString is required for the route');

    const safeName = String(name).replace(/'/g, "''");
    const safeDesc = description ? `'${String(description).replace(/'/g, "''")}'` : 'NULL';
    const geomText = JSON.stringify(geojson).replace(/'/g, "''");

    // Step 1: INSERT with $executeRawUnsafe (no RETURNING * to avoid geography deserialization crash)
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "routes" (
        tenant_id, name, description, origin_location_id, destination_location_id, operation_id, corridor_meters, distance_km, estimated_minutes, created_by, geometry
      ) VALUES (
        '${tenantId}'::uuid, 
        '${safeName}', 
        ${safeDesc}, 
        ${origin_location_id ? `'${origin_location_id}'::uuid` : 'NULL'}, 
        ${destination_location_id ? `'${destination_location_id}'::uuid` : 'NULL'}, 
        ${operation_id ? `'${operation_id}'::uuid` : 'NULL'}, 
        ${corridor_meters}, 
        ${distance_km || 'NULL'}, 
        ${estimated_minutes || 'NULL'}, 
        '${userId}'::uuid, 
        ST_SetSRID(ST_GeomFromGeoJSON('${geomText}'), 4326)::geography
      );
    `);

    // Step 2: Fetch via Prisma (excludes Unsupported geography column)
    const created = await this.prisma.extended.route.findFirst({
      where: { name: name, tenant_id: tenantId },
      orderBy: { created_at: 'desc' }
    });

    return created;
  }

  async update(id: string, data: any) {
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
      const geomText = JSON.stringify(geojson).replace(/'/g, "''");
      await this.prisma.$executeRawUnsafe(`
        UPDATE "routes" 
        SET geometry = ST_SetSRID(ST_GeomFromGeoJSON('${geomText}'), 4326)::geography 
        WHERE id = '${id}'
      `);
    }

    return route;
  }

  async remove(id: string) {
    return this.prisma.extended.route.delete({ where: { id } });
  }

  async toggleActive(id: string, isActive: boolean) {
    return this.prisma.extended.route.update({
      where: { id },
      data: { is_active: isActive }
    });
  }
}
